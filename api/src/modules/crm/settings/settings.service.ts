import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import { MEMBER_SELECT } from '../common/crm.constants';
import { CrmDefaultsService } from '../common/crm-defaults.service';
import { CreateSettingItemDto, SettingKind, UpdateSettingItemDto } from './dto/setting.dto';

type Delegate = {
    findMany: (args: any) => Promise<any[]>;
    findFirst: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    updateMany: (args: any) => Promise<any>;
};

/** 02 §4, §5, §9, §17 — configurable lead sources, lead statuses, lifecycle stages and loss reasons. */
@Injectable()
export class CrmSettingsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly defaults: CrmDefaultsService,
    ) { }

    private delegate(kind: SettingKind): Delegate {
        switch (kind) {
            case 'lead-sources': return this.prisma.crmLeadSource as unknown as Delegate;
            case 'lead-statuses': return this.prisma.crmLeadStatus as unknown as Delegate;
            case 'lifecycle-stages': return this.prisma.crmLifecycleStage as unknown as Delegate;
            case 'loss-reasons': return this.prisma.crmLossReason as unknown as Delegate;
        }
    }

    /** Only the flags that exist on the kind's table. */
    private fields(kind: SettingKind, dto: UpdateSettingItemDto) {
        const out: Record<string, unknown> = {};
        if (dto.name !== undefined) out.name = dto.name;
        if (kind !== 'loss-reasons' && dto.is_default !== undefined) out.is_default = dto.is_default;
        if (kind === 'lead-statuses') {
            if (dto.color !== undefined) out.color = dto.color;
            if (dto.is_converted !== undefined) out.is_converted = dto.is_converted;
            if (dto.is_lost !== undefined) out.is_lost = dto.is_lost;
            if (dto.is_converted && dto.is_lost) throw new BadRequestException({ message: 'A status cannot be both converted and lost', code: 'invalid_flags' });
        }
        if (kind === 'lifecycle-stages' && dto.is_customer !== undefined) out.is_customer = dto.is_customer;
        if (kind === 'loss-reasons' && dto.applies_to !== undefined) out.applies_to = dto.applies_to;
        return out;
    }

    /** Every list at once (used by pickers across CRM screens). */
    async all(ctx: OrgContext, includeArchived = false) {
        await this.defaults.ensure(ctx.organization_id);
        const where = { organization_id: ctx.organization_id, ...(includeArchived ? {} : { archived_at: null }) };
        const order = [{ sort_order: 'asc' as const }, { name: 'asc' as const }];
        const [lead_sources, lead_statuses, lifecycle_stages, loss_reasons] = await Promise.all([
            this.prisma.crmLeadSource.findMany({ where, orderBy: order }),
            this.prisma.crmLeadStatus.findMany({ where, orderBy: order }),
            this.prisma.crmLifecycleStage.findMany({ where, orderBy: order }),
            this.prisma.crmLossReason.findMany({ where, orderBy: order }),
        ]);
        return { lead_sources, lead_statuses, lifecycle_stages, loss_reasons };
    }

    async create(ctx: OrgContext, kind: SettingKind, dto: CreateSettingItemDto) {
        await this.defaults.ensure(ctx.organization_id);
        const d = this.delegate(kind);
        const data = this.fields(kind, dto);
        const slug = await this.uniqueSlug(d, ctx, dto.name);
        const last = await d.findFirst({ where: { organization_id: ctx.organization_id }, orderBy: { sort_order: 'desc' }, select: { sort_order: true } });
        const row = await this.prisma.$transaction(async (tx) => {
            if (data.is_default) await (tx as any)[this.model(kind)].updateMany({ where: { organization_id: ctx.organization_id }, data: { is_default: false } });
            const r = await (tx as any)[this.model(kind)].create({ data: { ...data, slug, organization_id: ctx.organization_id, sort_order: (last?.sort_order ?? -1) + 1 } });
            await this.audit.record(ctx, 'crm.settings.changed', { resource_type: `crm_${kind}`, resource_id: r.id, metadata: { action: 'created', after: data } }, tx);
            return r;
        });
        this.events.publish(ctx, { event_key: 'crm.settings.changed', module: ModuleKey.CRM, entity_kind: kind, entity_id: row.id, payload: { kind, action: 'created', name: row.name } });
        return row;
    }

    async update(ctx: OrgContext, kind: SettingKind, id: string, dto: UpdateSettingItemDto) {
        const before = await this.get(ctx, kind, id);
        const data = this.fields(kind, dto);
        const row = await this.prisma.$transaction(async (tx) => {
            if (data.is_default) await (tx as any)[this.model(kind)].updateMany({ where: { organization_id: ctx.organization_id, id: { not: id } }, data: { is_default: false } });
            const r = await (tx as any)[this.model(kind)].update({ where: { id }, data });
            await this.audit.record(ctx, 'crm.settings.changed', { resource_type: `crm_${kind}`, resource_id: id, metadata: { action: 'updated', before: { name: before.name }, after: data } }, tx);
            return r;
        });
        this.events.publish(ctx, { event_key: 'crm.settings.changed', module: ModuleKey.CRM, entity_kind: kind, entity_id: id, payload: { kind, action: 'updated', name: row.name } });
        return row;
    }

    async archive(ctx: OrgContext, kind: SettingKind, id: string, archived: boolean) {
        const before = await this.get(ctx, kind, id);
        if (archived && before.is_default) throw new ConflictException({ message: 'Make another option the default before archiving this one', code: 'setting_is_default' });
        if (archived && kind === 'lead-statuses' && (before.is_converted || before.is_lost)) {
            const others = await this.prisma.crmLeadStatus.count({ where: { organization_id: ctx.organization_id, archived_at: null, id: { not: id }, ...(before.is_converted ? { is_converted: true } : { is_lost: true }) } });
            if (!others) throw new ConflictException({ message: `Keep at least one ${before.is_converted ? 'converted' : 'lost'} status`, code: 'setting_required' });
        }
        const row = await this.delegate(kind).update({ where: { id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, 'crm.settings.changed', { resource_type: `crm_${kind}`, resource_id: id, metadata: { action: archived ? 'archived' : 'restored' } });
        this.events.publish(ctx, { event_key: 'crm.settings.changed', module: ModuleKey.CRM, entity_kind: kind, entity_id: id, payload: { kind, action: archived ? 'archived' : 'restored', name: row.name } });
        return row;
    }

    async reorder(ctx: OrgContext, kind: SettingKind, ids: string[]) {
        const rows = await this.delegate(kind).findMany({ where: { organization_id: ctx.organization_id, id: { in: ids } }, select: { id: true } });
        if (rows.length !== new Set(ids).size) throw new NotFoundException({ message: 'Option not found', code: 'reference_not_found' });
        await this.prisma.$transaction(ids.map((id, i) => (this.prisma as any)[this.model(kind)].update({ where: { id }, data: { sort_order: i } })));
        await this.audit.record(ctx, 'crm.settings.changed', { resource_type: `crm_${kind}`, metadata: { action: 'reordered', ids } });
        return this.all(ctx, true);
    }

    /** Active members for owner / assignee pickers (any CRM read key). */
    async members(ctx: OrgContext, search?: string) {
        return this.prisma.membership.findMany({
            where: {
                organization_id: ctx.organization_id,
                status: 'ACTIVE',
                type: 'INTERNAL',
                ...(search && { user: { OR: [{ display_name: { contains: search, mode: 'insensitive' } }, { first_name: { contains: search, mode: 'insensitive' } }, { last_name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } }),
            },
            select: MEMBER_SELECT,
            orderBy: { user: { first_name: 'asc' } },
            take: 200,
        });
    }

    private model(kind: SettingKind) {
        return ({ 'lead-sources': 'crmLeadSource', 'lead-statuses': 'crmLeadStatus', 'lifecycle-stages': 'crmLifecycleStage', 'loss-reasons': 'crmLossReason' } as const)[kind];
    }

    private async get(ctx: OrgContext, kind: SettingKind, id: string) {
        const row = await this.delegate(kind).findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!row) throw new NotFoundException({ message: 'Option not found', code: 'setting_not_found' });
        return row;
    }

    private async uniqueSlug(d: Delegate, ctx: OrgContext, name: string) {
        const base = slugify(name) || 'option';
        let slug = base;
        for (let i = 2; await d.findFirst({ where: { organization_id: ctx.organization_id, slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
        return slug;
    }
}
