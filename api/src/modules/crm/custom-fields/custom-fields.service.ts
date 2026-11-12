import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { CrmCustomFieldValuesService } from './custom-field-values.service';
import {
    CreateCustomFieldInput, CreateFieldGroupInput, CustomFieldQuery, OPTION_TYPES, UpdateCustomFieldInput, UpdateFieldGroupInput,
} from './dto/custom-field.dto';

const json = (v: unknown) => (v === null ? Prisma.JsonNull : (v as Prisma.InputJsonValue | undefined));

/**
 * 02 §24–26 — custom field definitions and groups (platform-wide model; the CRM is the first consumer).
 * `key` is the stable API identifier and never changes; `label`, options and rules may. Archived fields keep their
 * values but leave forms, filters and exports. Managing needs `platform.custom_fields.manage`.
 */
@Injectable()
export class CrmCustomFieldsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly values: CrmCustomFieldValuesService,
    ) { }

    async findAll(ctx: OrgContext, query: CustomFieldQuery) {
        const fields = await this.prisma.customFieldDefinition.findMany({
            where: {
                organization_id: ctx.organization_id,
                ...(query.entity_type && { entity_types: { has: query.entity_type } }),
                ...(!query.include_archived && { archived_at: null }),
            },
            include: { group: { select: { id: true, name: true, sort_order: true } }, _count: { select: { values: true } } },
            orderBy: [{ sort_order: 'asc' }, { label: 'asc' }],
        });
        return fields.map(({ _count, ...f }) => ({ ...f, usage_count: _count.values }));
    }

    async findOne(ctx: OrgContext, id: string) {
        const f = await this.prisma.customFieldDefinition.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { group: { select: { id: true, name: true } }, _count: { select: { values: true } } } });
        if (!f) throw new NotFoundException({ message: 'Custom field not found', code: 'custom_field_not_found' });
        const { _count, ...rest } = f;
        return { ...rest, usage_count: _count.values };
    }

    private checkOptions(type: string, options: { value: string }[] | null | undefined) {
        if (OPTION_TYPES.includes(type as never)) {
            if (!options?.length) throw new BadRequestException({ message: 'Add at least one option', code: 'options_required' });
            const values = options.map((o) => o.value);
            if (new Set(values).size !== values.length) throw new BadRequestException({ message: 'Option values must be unique', code: 'options_duplicate' });
        }
    }

    private async checkGroup(ctx: OrgContext, group_id?: string | null) {
        if (group_id && !(await this.prisma.customFieldGroup.findFirst({ where: { id: group_id, organization_id: ctx.organization_id } }))) {
            throw new NotFoundException({ message: 'Field group not found', code: 'reference_not_found' });
        }
    }

    async create(ctx: OrgContext, dto: CreateCustomFieldInput) {
        this.checkOptions(dto.type, dto.options);
        await this.checkGroup(ctx, dto.group_id);
        if (await this.prisma.customFieldDefinition.findFirst({ where: { organization_id: ctx.organization_id, key: dto.key } })) {
            throw new ConflictException({ message: `A field with key "${dto.key}" already exists`, code: 'custom_field_key_taken' });
        }
        const entity_types = [...new Set(dto.entity_types)];
        const default_value = dto.default_value === undefined || dto.default_value === null || dto.default_value === ''
            ? undefined
            : this.values.normalize({ key: dto.key, label: dto.label, type: dto.type, options: (dto.options ?? null) as Prisma.JsonValue, validation: (dto.validation ?? null) as Prisma.JsonValue }, dto.default_value);
        const last = await this.prisma.customFieldDefinition.aggregate({ where: { organization_id: ctx.organization_id }, _max: { sort_order: true } });
        const field = await this.prisma.$transaction(async (tx) => {
            const f = await tx.customFieldDefinition.create({
                data: {
                    organization_id: ctx.organization_id,
                    key: dto.key,
                    label: dto.label,
                    description: dto.description ?? null,
                    type: dto.type,
                    entity_types,
                    is_shared: entity_types.length > 1,
                    group_id: dto.group_id ?? null,
                    is_required: dto.is_required ?? false,
                    options: OPTION_TYPES.includes(dto.type) ? json(dto.options ?? null) : Prisma.JsonNull,
                    default_value: default_value === undefined ? Prisma.JsonNull : (default_value as Prisma.InputJsonValue),
                    validation: json(dto.validation ?? null),
                    is_searchable: dto.is_searchable ?? true,
                    is_filterable: dto.is_filterable ?? true,
                    is_sortable: dto.is_sortable ?? false,
                    sort_order: dto.sort_order ?? (last._max.sort_order ?? 0) + 10,
                },
            });
            await this.audit.record(ctx, 'custom_field.created', { resource_type: 'custom_field_definition', resource_id: f.id, metadata: { after: { key: f.key, label: f.label, type: f.type, entity_types } } }, tx);
            return f;
        });
        this.events.publish(ctx, { event_key: 'platform.custom_field.created', module: ModuleKey.ADMINISTRATION, entity_kind: 'custom_field', entity_id: field.id, payload: { key: field.key, type: field.type, entity_types } });
        return field;
    }

    async update(ctx: OrgContext, id: string, dto: UpdateCustomFieldInput) {
        const before = await this.findOne(ctx, id);
        if (dto.type && dto.type !== before.type && before.usage_count > 0) {
            throw new ConflictException({ message: `The type cannot change while ${before.usage_count} record(s) have a value`, code: 'custom_field_type_locked' });
        }
        const type = dto.type ?? before.type;
        const options = dto.options !== undefined ? dto.options : (before.options as { value: string; label: string }[] | null);
        this.checkOptions(type, options);
        await this.checkGroup(ctx, dto.group_id);
        if (dto.options && before.usage_count > 0 && OPTION_TYPES.includes(type)) {
            const kept = new Set(dto.options.map((o) => o.value));
            const removed = ((before.options ?? []) as { value: string }[]).filter((o) => !kept.has(o.value)).map((o) => o.value);
            if (removed.length) {
                const used = await this.prisma.customFieldValue.count({ where: { definition_id: id, OR: removed.map((v) => (type === 'MULTI_SELECT' ? { value: { array_contains: [v] } } : { value: { equals: v } })) } });
                if (used) throw new ConflictException({ message: `Option(s) ${removed.join(', ')} are still used on ${used} record(s)`, code: 'custom_field_option_in_use' });
            }
        }
        const entity_types = dto.entity_types ? [...new Set(dto.entity_types)] : undefined;
        const default_value = dto.default_value === undefined ? undefined
            : dto.default_value === null || dto.default_value === '' ? null
                : this.values.normalize({ key: before.key, label: dto.label ?? before.label, type, options: (options ?? null) as Prisma.JsonValue, validation: ((dto.validation !== undefined ? dto.validation : before.validation) ?? null) as Prisma.JsonValue }, dto.default_value);
        const field = await this.prisma.$transaction(async (tx) => {
            const f = await tx.customFieldDefinition.update({
                where: { id },
                data: {
                    ...(dto.label !== undefined && { label: dto.label }),
                    ...(dto.description !== undefined && { description: dto.description }),
                    ...(dto.type !== undefined && { type: dto.type }),
                    ...(entity_types && { entity_types, is_shared: entity_types.length > 1 }),
                    ...(dto.group_id !== undefined && { group_id: dto.group_id }),
                    ...(dto.is_required !== undefined && { is_required: dto.is_required }),
                    ...(dto.options !== undefined && { options: OPTION_TYPES.includes(type) ? json(dto.options) : Prisma.JsonNull }),
                    ...(default_value !== undefined && { default_value: default_value === null ? Prisma.JsonNull : (default_value as Prisma.InputJsonValue) }),
                    ...(dto.validation !== undefined && { validation: json(dto.validation) }),
                    ...(dto.is_searchable !== undefined && { is_searchable: dto.is_searchable }),
                    ...(dto.is_filterable !== undefined && { is_filterable: dto.is_filterable }),
                    ...(dto.is_sortable !== undefined && { is_sortable: dto.is_sortable }),
                    ...(dto.sort_order !== undefined && { sort_order: dto.sort_order }),
                },
            });
            await this.audit.record(ctx, 'custom_field.updated', {
                resource_type: 'custom_field_definition', resource_id: id,
                metadata: { before: { label: before.label, type: before.type, entity_types: before.entity_types, is_required: before.is_required }, after: dto },
            }, tx);
            return f;
        });
        this.events.publish(ctx, { event_key: 'platform.custom_field.updated', module: ModuleKey.ADMINISTRATION, entity_kind: 'custom_field', entity_id: id, payload: { key: field.key } });
        return field;
    }

    async archive(ctx: OrgContext, id: string, archived: boolean) {
        const before = await this.findOne(ctx, id);
        const field = await this.prisma.customFieldDefinition.update({ where: { id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'custom_field.archived' : 'custom_field.restored', { resource_type: 'custom_field_definition', resource_id: id, metadata: { key: before.key, usage_count: before.usage_count } });
        this.events.publish(ctx, { event_key: archived ? 'platform.custom_field.archived' : 'platform.custom_field.restored', module: ModuleKey.ADMINISTRATION, entity_kind: 'custom_field', entity_id: id, payload: { key: before.key } });
        return field;
    }

    /** Delete a field that no record uses (otherwise archive). */
    async remove(ctx: OrgContext, id: string) {
        const before = await this.findOne(ctx, id);
        if (before.usage_count > 0) throw new ConflictException({ message: `${before.usage_count} record(s) have a value. Archive the field instead.`, code: 'custom_field_in_use' });
        await this.prisma.customFieldDefinition.delete({ where: { id } });
        await this.audit.record(ctx, 'custom_field.deleted', { resource_type: 'custom_field_definition', resource_id: id, metadata: { before: { key: before.key, label: before.label } } });
        return { success: true };
    }

    async reorder(ctx: OrgContext, ids: string[]) {
        const count = await this.prisma.customFieldDefinition.count({ where: { id: { in: ids }, organization_id: ctx.organization_id } });
        if (count !== new Set(ids).size) throw new NotFoundException({ message: 'Custom field not found', code: 'reference_not_found' });
        await this.prisma.$transaction(ids.map((id, i) => this.prisma.customFieldDefinition.update({ where: { id }, data: { sort_order: (i + 1) * 10 } })));
        await this.audit.record(ctx, 'custom_field.reordered', { resource_type: 'custom_field_definition', metadata: { ids } });
        return { success: true };
    }

    // ---- groups ----------------------------------------------------------------------------------------------

    groups(ctx: OrgContext) {
        return this.prisma.customFieldGroup.findMany({
            where: { organization_id: ctx.organization_id },
            include: { _count: { select: { fields: { where: { archived_at: null } } } } },
            orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
        });
    }

    async createGroup(ctx: OrgContext, dto: CreateFieldGroupInput) {
        if (await this.prisma.customFieldGroup.findFirst({ where: { organization_id: ctx.organization_id, name: { equals: dto.name, mode: 'insensitive' } } })) {
            throw new ConflictException({ message: 'A group with this name already exists', code: 'custom_field_group_taken' });
        }
        const group = await this.prisma.customFieldGroup.create({ data: { organization_id: ctx.organization_id, name: dto.name, description: dto.description ?? null, sort_order: dto.sort_order ?? 0 } });
        await this.audit.record(ctx, 'custom_field_group.created', { resource_type: 'custom_field_group', resource_id: group.id, metadata: { after: { name: group.name } } });
        return group;
    }

    async updateGroup(ctx: OrgContext, id: string, dto: UpdateFieldGroupInput) {
        const before = await this.prisma.customFieldGroup.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Field group not found', code: 'custom_field_group_not_found' });
        const group = await this.prisma.customFieldGroup.update({ where: { id }, data: { ...dto } });
        await this.audit.record(ctx, 'custom_field_group.updated', { resource_type: 'custom_field_group', resource_id: id, metadata: { before: { name: before.name }, after: dto } });
        return group;
    }

    /** Fields of a deleted group stay, ungrouped. */
    async removeGroup(ctx: OrgContext, id: string) {
        const before = await this.prisma.customFieldGroup.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Field group not found', code: 'custom_field_group_not_found' });
        await this.prisma.customFieldGroup.delete({ where: { id } });
        await this.audit.record(ctx, 'custom_field_group.deleted', { resource_type: 'custom_field_group', resource_id: id, metadata: { before: { name: before.name } } });
        return { success: true };
    }
}
