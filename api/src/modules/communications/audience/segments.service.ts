import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { CommChannel, ModuleKey, Prisma, SegmentEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { BaseListQuery, orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { isUniqueError, notFound } from '../common/comm.utils';
import { AudienceService } from './audience.service';
import { CONTACT_FIELDS, MEMBERSHIP_FIELDS, SegmentNodeSchema } from './segment-definition';
import { CreateSegmentDto, PreviewSegmentDto, SegmentQuery, UpdateSegmentDto } from './dto/audience.dto';

/** Saved dynamic audiences over CRM contacts (11 "Customer Segmentation"). Evaluated at send time. */
@Injectable()
export class SegmentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly audience: AudienceService,
    ) { }

    fields() {
        return { CRM_CONTACT: CONTACT_FIELDS, CRM_COMPANY: CONTACT_FIELDS.filter((f) => f.key.startsWith('company.')).map((f) => ({ ...f, key: f.key.slice(8) })), MEMBERSHIP: MEMBERSHIP_FIELDS };
    }

    private validate(definition: unknown) {
        const parsed = SegmentNodeSchema.safeParse(definition);
        if (!parsed.success) throw new BadRequestException({ message: 'Invalid segment definition', code: 'segment_definition_invalid', issues: parsed.error.issues.slice(0, 5) });
        return parsed.data;
    }

    async findAll(ctx: OrgContext, query: SegmentQuery) {
        const where: Prisma.SegmentWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(query.entity_type && { entity_type: query.entity_type }),
            ...(query.channel && { OR: [{ channel: query.channel }, { channel: null }] }),
            ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.segment.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['name', 'created_at', 'updated_at', 'last_count'], 'updated_at'),
                include: { _count: { select: { audiences: true } }, created_by: { select: { id: true, user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } } },
            }),
            this.prisma.segment.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const segment = await this.prisma.segment.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: { audiences: { include: { campaign: { select: { id: true, name: true, status: true, channel: true } } } } },
        });
        if (!segment) throw notFound('Segment', 'segment_not_found');
        return segment;
    }

    async preview(ctx: OrgContext, dto: PreviewSegmentDto) {
        const definition = this.validate(dto.definition);
        const entity_type = dto.entity_type ?? SegmentEntityType.CRM_CONTACT;
        const { candidates, total } = await this.audience.evaluateSegment(ctx.organization_id, { entity_type, definition, require_consent: dto.require_consent }, dto.channel ?? null, { limit: 10 });
        const excluded = { no_consent: 0, suppressed: 0, no_address: 0 };
        if (entity_type !== SegmentEntityType.MEMBERSHIP) {
            const where = await this.audience.segmentWhere(ctx.organization_id, entity_type, definition);
            const channel = dto.channel ?? CommChannel.EMAIL;
            const addressField = channel === CommChannel.EMAIL ? { email: null } : { AND: [{ mobile: null }, { phone: null }] };
            const [noAddress, noConsent] = await Promise.all([
                this.prisma.crmContact.count({ where: { AND: [where, addressField] } }),
                dto.require_consent === false ? 0 : this.prisma.crmContact.count({ where: { AND: [where, { NOT: { comm_consents: { some: { channel, status: 'OPTED_IN' } } } }] } }),
            ]);
            excluded.no_address = noAddress;
            excluded.no_consent = noConsent;
            const emails = await this.prisma.crmContact.findMany({ where, select: { email: true }, take: 5000 });
            const addrs = emails.map((e) => e.email?.toLowerCase()).filter((x): x is string => !!x);
            excluded.suppressed = channel === CommChannel.EMAIL
                ? await this.prisma.commSuppression.count({ where: { organization_id: ctx.organization_id, channel, address: { in: addrs }, removed_at: null } })
                : 0;
        }
        return { count: total, sample: candidates.map(({ context: _c, ...rest }) => rest), excluded };
    }

    async members(ctx: OrgContext, id: string, query: BaseListQuery) {
        const segment = await this.findOne(ctx, id);
        const { candidates, total } = await this.audience.evaluateSegment(ctx.organization_id, segment, segment.channel, { ...skipTake(query), search: query.search });
        const items = candidates.map(({ context: _c, ...rest }) => rest);
        return paginate(items, total, query);
    }

    async refresh(ctx: OrgContext, id: string) {
        const segment = await this.findOne(ctx, id);
        const { total } = await this.audience.evaluateSegment(ctx.organization_id, segment, segment.channel, { limit: 0 });
        return this.prisma.segment.update({ where: { id }, data: { last_count: total, last_evaluated_at: new Date() } });
    }

    async create(ctx: OrgContext, dto: CreateSegmentDto) {
        const definition = this.validate(dto.definition);
        const entity_type = dto.entity_type ?? SegmentEntityType.CRM_CONTACT;
        const { total } = await this.audience.evaluateSegment(ctx.organization_id, { entity_type, definition }, dto.channel ?? null, { limit: 0 });
        try {
            const segment = await this.prisma.segment.create({
                data: {
                    organization_id: ctx.organization_id,
                    name: dto.name,
                    description: dto.description ?? null,
                    entity_type,
                    definition: definition as Prisma.InputJsonValue,
                    channel: dto.channel ?? null,
                    require_consent: dto.require_consent ?? true,
                    saved_view_id: dto.saved_view_id ?? null,
                    last_count: total,
                    last_evaluated_at: new Date(),
                    created_by_membership_id: ctx.membership_id,
                },
            });
            await this.audit.record(ctx, 'communications.segment.created', { resource_type: 'segment', resource_id: segment.id, metadata: { after: { name: dto.name, entity_type, definition } } });
            this.events.publish(ctx, { event_key: 'communications.segment.created', module: ModuleKey.COMMUNICATION, entity_kind: 'segment', entity_id: segment.id, payload: { name: segment.name, count: total } });
            return segment;
        } catch (error) {
            if (isUniqueError(error)) throw new ConflictException({ message: 'A segment with this name already exists', code: 'segment_conflict' });
            throw error;
        }
    }

    async update(ctx: OrgContext, id: string, dto: UpdateSegmentDto) {
        const before = await this.findOne(ctx, id);
        const definition = dto.definition ? this.validate(dto.definition) : undefined;
        const entity_type = dto.entity_type ?? before.entity_type;
        const last_count = definition || dto.entity_type
            ? (await this.audience.evaluateSegment(ctx.organization_id, { entity_type, definition: definition ?? before.definition }, dto.channel ?? before.channel, { limit: 0 })).total
            : undefined;
        try {
            const segment = await this.prisma.segment.update({
                where: { id },
                data: {
                    name: dto.name,
                    description: dto.description,
                    entity_type: dto.entity_type,
                    definition: definition as Prisma.InputJsonValue,
                    channel: dto.channel,
                    require_consent: dto.require_consent,
                    ...(last_count !== undefined && { last_count, last_evaluated_at: new Date() }),
                },
            });
            await this.audit.record(ctx, 'communications.segment.updated', { resource_type: 'segment', resource_id: id, metadata: { before: { name: before.name, definition: before.definition }, after: dto } });
            this.events.publish(ctx, { event_key: 'communications.segment.updated', module: ModuleKey.COMMUNICATION, entity_kind: 'segment', entity_id: id, payload: { name: segment.name }, changes: dto as Record<string, unknown> });
            return segment;
        } catch (error) {
            if (isUniqueError(error)) throw new ConflictException({ message: 'A segment with this name already exists', code: 'segment_conflict' });
            throw error;
        }
    }

    async archive(ctx: OrgContext, id: string, archived: boolean) {
        await this.findOne(ctx, id);
        const segment = await this.prisma.segment.update({ where: { id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'communications.segment.archived' : 'communications.segment.restored', { resource_type: 'segment', resource_id: id });
        this.events.publish(ctx, { event_key: archived ? 'communications.segment.archived' : 'communications.segment.restored', module: ModuleKey.COMMUNICATION, entity_kind: 'segment', entity_id: id, payload: { name: segment.name } });
        return segment;
    }

    async remove(ctx: OrgContext, id: string) {
        const segment = await this.findOne(ctx, id);
        if (segment.audiences.some((a) => ['SCHEDULED', 'SENDING', 'PAUSED'].includes(a.campaign.status))) {
            throw new ConflictException({ message: 'The segment is used by a scheduled or sending campaign', code: 'segment_in_use' });
        }
        await this.prisma.segment.delete({ where: { id } });
        await this.audit.record(ctx, 'communications.segment.deleted', { resource_type: 'segment', resource_id: id, metadata: { before: { name: segment.name, definition: segment.definition } } });
        this.events.publish(ctx, { event_key: 'communications.segment.deleted', module: ModuleKey.COMMUNICATION, entity_kind: 'segment', entity_id: id, payload: { name: segment.name } });
        return { success: true };
    }
}
