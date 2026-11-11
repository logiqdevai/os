import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { CommChannel, CommRecipientKind, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { BaseListQuery, orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { isUniqueError, normalizeAddress, notFound } from '../common/comm.utils';
import { CreateRecipientListDto, ListMemberInputDto, ListQuery, UpdateRecipientListDto } from './dto/audience.dto';

/** Static recipient lists of CRM contacts, members and external addresses (11 "Recipients"). */
@Injectable()
export class ListsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    async findAll(ctx: OrgContext, query: ListQuery) {
        const where: Prisma.CommRecipientListWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(query.channel && { OR: [{ channel: query.channel }, { channel: null }] }),
            ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.commRecipientList.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['name', 'created_at', 'member_count', 'updated_at'], 'updated_at'),
                include: { _count: { select: { audiences: true } }, created_by: { select: { id: true, user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } } },
            }),
            this.prisma.commRecipientList.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const list = await this.prisma.commRecipientList.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { _count: { select: { audiences: true } } } });
        if (!list) throw notFound('Recipient list', 'recipient_list_not_found');
        return list;
    }

    async members(ctx: OrgContext, id: string, query: BaseListQuery) {
        await this.findOne(ctx, id);
        const where: Prisma.CommRecipientListMemberWhereInput = {
            list_id: id,
            ...(query.search && {
                OR: [
                    { address: { contains: query.search, mode: 'insensitive' } },
                    { name: { contains: query.search, mode: 'insensitive' } },
                    { contact: { OR: [{ first_name: { contains: query.search, mode: 'insensitive' } }, { last_name: { contains: query.search, mode: 'insensitive' } }, { email: { contains: query.search, mode: 'insensitive' } }] } },
                ],
            }),
        };
        const [items, total] = await Promise.all([
            this.prisma.commRecipientListMember.findMany({
                where,
                ...skipTake(query),
                orderBy: { created_at: 'desc' },
                include: {
                    contact: { select: { id: true, first_name: true, last_name: true, email: true, mobile: true, company: { select: { id: true, name: true } } } },
                    membership: { select: { id: true, user: { select: { email: true, display_name: true, first_name: true, last_name: true } } } },
                },
            }),
            this.prisma.commRecipientListMember.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async create(ctx: OrgContext, dto: CreateRecipientListDto) {
        try {
            const list = await this.prisma.commRecipientList.create({ data: { ...dto, organization_id: ctx.organization_id, created_by_membership_id: ctx.membership_id } });
            await this.audit.record(ctx, 'communications.recipient_list.created', { resource_type: 'comm_recipient_list', resource_id: list.id, metadata: { after: dto } });
            this.events.publish(ctx, { event_key: 'communications.recipient_list.created', module: ModuleKey.COMMUNICATION, entity_kind: 'comm_recipient_list', entity_id: list.id, payload: { name: list.name } });
            return list;
        } catch (error) {
            if (isUniqueError(error)) throw new ConflictException({ message: 'A list with this name already exists', code: 'recipient_list_conflict' });
            throw error;
        }
    }

    async update(ctx: OrgContext, id: string, dto: UpdateRecipientListDto) {
        const before = await this.findOne(ctx, id);
        try {
            const list = await this.prisma.commRecipientList.update({ where: { id }, data: dto });
            await this.audit.record(ctx, 'communications.recipient_list.updated', { resource_type: 'comm_recipient_list', resource_id: id, metadata: { before: { name: before.name, channel: before.channel }, after: dto } });
            this.events.publish(ctx, { event_key: 'communications.recipient_list.updated', module: ModuleKey.COMMUNICATION, entity_kind: 'comm_recipient_list', entity_id: id, payload: { name: list.name }, changes: dto as Record<string, unknown> });
            return list;
        } catch (error) {
            if (isUniqueError(error)) throw new ConflictException({ message: 'A list with this name already exists', code: 'recipient_list_conflict' });
            throw error;
        }
    }

    async archive(ctx: OrgContext, id: string, archived: boolean) {
        await this.findOne(ctx, id);
        const list = await this.prisma.commRecipientList.update({ where: { id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'communications.recipient_list.archived' : 'communications.recipient_list.restored', { resource_type: 'comm_recipient_list', resource_id: id });
        this.events.publish(ctx, { event_key: archived ? 'communications.recipient_list.archived' : 'communications.recipient_list.restored', module: ModuleKey.COMMUNICATION, entity_kind: 'comm_recipient_list', entity_id: id, payload: { name: list.name } });
        return list;
    }

    async remove(ctx: OrgContext, id: string) {
        const list = await this.findOne(ctx, id);
        const active = await this.prisma.campaignAudience.count({ where: { list_id: id, campaign: { status: { in: ['SCHEDULED', 'SENDING', 'PAUSED'] } } } });
        if (active) throw new ConflictException({ message: 'The list is used by a scheduled or sending campaign', code: 'recipient_list_in_use' });
        await this.prisma.commRecipientList.delete({ where: { id } });
        await this.audit.record(ctx, 'communications.recipient_list.deleted', { resource_type: 'comm_recipient_list', resource_id: id, metadata: { before: { name: list.name, member_count: list.member_count } } });
        this.events.publish(ctx, { event_key: 'communications.recipient_list.deleted', module: ModuleKey.COMMUNICATION, entity_kind: 'comm_recipient_list', entity_id: id, payload: { name: list.name } });
        return { success: true };
    }

    /**
     * Add members (also used for CSV import, parsed client-side into rows). Existing members are skipped;
     * invalid rows are returned with a reason instead of failing the whole batch.
     */
    async addMembers(ctx: OrgContext, id: string, rows: ListMemberInputDto[]) {
        const list = await this.findOne(ctx, id);
        const channel = list.channel ?? CommChannel.EMAIL;
        const contactIds = rows.filter((r) => r.kind === CommRecipientKind.CRM_CONTACT && r.contact_id).map((r) => r.contact_id as string);
        const membershipIds = rows.filter((r) => r.kind === CommRecipientKind.MEMBERSHIP && r.membership_id).map((r) => r.membership_id as string);
        const [contacts, memberships] = await Promise.all([
            this.prisma.crmContact.findMany({ where: { id: { in: contactIds }, organization_id: ctx.organization_id }, select: { id: true } }),
            this.prisma.membership.findMany({ where: { id: { in: membershipIds }, organization_id: ctx.organization_id }, select: { id: true } }),
        ]);
        const validContacts = new Set(contacts.map((c) => c.id));
        const validMemberships = new Set(memberships.map((m) => m.id));
        const invalid: { row: number; reason: string }[] = [];
        const data: Prisma.CommRecipientListMemberCreateManyInput[] = [];
        rows.forEach((r, i) => {
            if (r.kind === CommRecipientKind.CRM_CONTACT) {
                if (!r.contact_id || !validContacts.has(r.contact_id)) return invalid.push({ row: i, reason: 'Contact not found' });
                data.push({ list_id: id, kind: r.kind, contact_id: r.contact_id, address: r.address ? normalizeAddress(channel, r.address) : null, name: r.name ?? null, added_by_membership_id: ctx.membership_id });
            } else if (r.kind === CommRecipientKind.MEMBERSHIP) {
                if (!r.membership_id || !validMemberships.has(r.membership_id)) return invalid.push({ row: i, reason: 'Member not found' });
                data.push({ list_id: id, kind: r.kind, membership_id: r.membership_id, name: r.name ?? null, added_by_membership_id: ctx.membership_id });
            } else {
                const address = normalizeAddress(channel, r.address) ?? (list.channel ? null : normalizeAddress(CommChannel.SMS, r.address));
                if (!address) return invalid.push({ row: i, reason: 'Invalid email address or phone number' });
                data.push({ list_id: id, kind: CommRecipientKind.EXTERNAL, address, name: r.name ?? null, added_by_membership_id: ctx.membership_id });
            }
        });
        if (!data.length && invalid.length) throw new BadRequestException({ message: 'No valid rows to add', code: 'list_members_invalid', invalid });
        const res = await this.prisma.commRecipientListMember.createMany({ data, skipDuplicates: true });
        const count = await this.prisma.commRecipientListMember.count({ where: { list_id: id } });
        await this.prisma.commRecipientList.update({ where: { id }, data: { member_count: count } });
        await this.audit.record(ctx, 'communications.recipient_list.members_added', { resource_type: 'comm_recipient_list', resource_id: id, metadata: { added: res.count, skipped: data.length - res.count, invalid: invalid.length } });
        this.events.publish(ctx, { event_key: 'communications.recipient_list.members_added', module: ModuleKey.COMMUNICATION, entity_kind: 'comm_recipient_list', entity_id: id, payload: { added: res.count } });
        return { added: res.count, skipped: data.length - res.count, invalid, member_count: count };
    }

    async removeMember(ctx: OrgContext, id: string, memberId: string) {
        await this.findOne(ctx, id);
        const res = await this.prisma.commRecipientListMember.deleteMany({ where: { id: memberId, list_id: id } });
        if (!res.count) throw notFound('List member', 'list_member_not_found');
        const count = await this.prisma.commRecipientListMember.count({ where: { list_id: id } });
        await this.prisma.commRecipientList.update({ where: { id }, data: { member_count: count } });
        await this.audit.record(ctx, 'communications.recipient_list.member_removed', { resource_type: 'comm_recipient_list', resource_id: id, metadata: { member_id: memberId } });
        return { success: true, member_count: count };
    }
}
