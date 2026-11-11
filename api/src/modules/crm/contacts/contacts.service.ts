import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { COMPANY_REF_SELECT, MEMBER_SELECT } from '../common/crm.constants';
import { contactScopeWhere, ownerFilter, pick } from '../common/crm-scope.utils';
import { CrmRefsService } from '../common/crm-refs.service';
import { CsvExport, memberLabel, toCsv } from '../common/csv.utils';
import { LookupQuery } from '../companies/dto/company-query.schema';
import { ContactQuery, CreateContactDto, UpdateContactDto } from './dto/contact.dto';

const READ = 'crm.contacts.read';

const LIST_INCLUDE = {
    company: { select: COMPANY_REF_SELECT },
    owner: { select: MEMBER_SELECT },
    lifecycle_stage: { select: { id: true, name: true } },
} satisfies Prisma.CrmContactInclude;

/** 02 §3 — people at companies. Also the contact picker for other modules (`search`). */
@Injectable()
export class CrmContactsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly refs: CrmRefsService,
    ) { }

    private where(ctx: OrgContext, query: ContactQuery, ids?: string[]): Prisma.CrmContactWhereInput {
        return {
            organization_id: ctx.organization_id,
            merged_into_id: null,
            AND: [
                contactScopeWhere(ctx, READ),
                query.search
                    ? {
                        OR: [
                            { first_name: { contains: query.search, mode: 'insensitive' } },
                            { last_name: { contains: query.search, mode: 'insensitive' } },
                            { email: { contains: query.search, mode: 'insensitive' } },
                            { phone: { contains: query.search } },
                            { company: { name: { contains: query.search, mode: 'insensitive' } } },
                        ],
                    }
                    : {},
            ],
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(query.company_id && { company_id: query.company_id }),
            ...(query.role?.length && { roles: { hasSome: query.role } }),
            ...(query.lifecycle_stage_id && { lifecycle_stage_id: query.lifecycle_stage_id }),
            ...ownerFilter(ctx, query.owner),
            ...(ids && { id: { in: ids } }),
        };
    }

    async findAll(ctx: OrgContext, query: ContactQuery) {
        const tagged = await this.refs.idsWithTag(RecordEntityType.CRM_CONTACT, query.tag_id);
        const where = this.where(ctx, query, tagged);
        const [items, total] = await Promise.all([
            this.prisma.crmContact.findMany({ where, ...skipTake(query), orderBy: orderBy(query, ['first_name', 'last_name', 'created_at', 'last_activity_at'], 'created_at'), include: LIST_INCLUDE }),
            this.prisma.crmContact.count({ where }),
        ]);
        return paginate(await this.refs.withTags(RecordEntityType.CRM_CONTACT, items), total, query);
    }

    async search(ctx: OrgContext, query: LookupQuery) {
        const q = query.search;
        return this.prisma.crmContact.findMany({
            where: {
                organization_id: ctx.organization_id,
                archived_at: null,
                merged_into_id: null,
                ...contactScopeWhere(ctx, READ),
                ...(query.company_id && { company_id: query.company_id }),
                ...(q && {
                    OR: [
                        { first_name: { contains: q, mode: 'insensitive' } },
                        { last_name: { contains: q, mode: 'insensitive' } },
                        { email: { contains: q, mode: 'insensitive' } },
                    ],
                }),
            },
            select: { id: true, first_name: true, last_name: true, email: true, job_title: true, company: { select: { id: true, name: true } } },
            orderBy: [{ first_name: 'asc' }, { last_name: 'asc' }],
            take: query.limit,
        });
    }

    async findOne(ctx: OrgContext, id: string) {
        const contact = await this.prisma.crmContact.findFirst({
            where: { id, organization_id: ctx.organization_id, ...contactScopeWhere(ctx, READ) },
            include: { ...LIST_INCLUDE, lead_source: { select: { id: true, name: true } }, secondary_owner: { select: MEMBER_SELECT }, merged_into: { select: { id: true, first_name: true, last_name: true } } },
        });
        if (!contact) throw new NotFoundException({ message: 'Contact not found', code: 'contact_not_found' });
        const [tags, deals, openActivities] = await Promise.all([
            this.refs.tagsFor(RecordEntityType.CRM_CONTACT, [id]),
            this.prisma.crmDeal.count({ where: { archived_at: null, OR: [{ primary_contact_id: id }, { contacts: { some: { contact_id: id } } }] } }),
            this.prisma.crmActivity.count({ where: { contact_id: id, status: 'PLANNED' } }),
        ]);
        return { ...contact, tags: tags.get(id) ?? [], summary: { deals, open_activities: openActivities } };
    }

    async findDuplicates(ctx: OrgContext, input: { email?: string; first_name?: string; last_name?: string; exclude_id?: string }) {
        const ors: Prisma.CrmContactWhereInput[] = [];
        if (input.email) ors.push({ email: { equals: input.email.trim(), mode: 'insensitive' } });
        if (input.first_name && input.last_name) {
            ors.push({ first_name: { equals: input.first_name.trim(), mode: 'insensitive' }, last_name: { equals: input.last_name.trim(), mode: 'insensitive' } });
        }
        if (!ors.length) return [];
        const rows = await this.prisma.crmContact.findMany({
            where: { organization_id: ctx.organization_id, merged_into_id: null, OR: ors, ...(input.exclude_id && { id: { not: input.exclude_id } }) },
            select: { id: true, first_name: true, last_name: true, email: true, company: { select: { id: true, name: true } } },
            take: 5,
        });
        return rows.map((r) => ({ ...r, match: input.email && r.email?.toLowerCase() === input.email.trim().toLowerCase() ? 'email' : 'name' }));
    }

    async create(ctx: OrgContext, dto: CreateContactDto) {
        const { allow_duplicate, ...data } = dto;
        await this.refs.assert(ctx, { membership: data.owner_membership_id, company: data.company_id, lifecycle_stage: data.lifecycle_stage_id, lead_source: data.lead_source_id });
        if (!allow_duplicate) {
            const duplicates = await this.findDuplicates(ctx, data);
            if (duplicates.length) throw new ConflictException({ message: 'A contact with this email or name already exists', code: 'possible_duplicates', duplicates });
        }
        const contact = await this.prisma.$transaction(async (tx) => {
            const c = await tx.crmContact.create({
                data: {
                    ...data,
                    email: data.email?.toLowerCase(),
                    address: data.address as Prisma.InputJsonValue,
                    consent: data.consent as Prisma.InputJsonValue,
                    owner_membership_id: data.owner_membership_id ?? ctx.membership_id,
                    organization_id: ctx.organization_id,
                    created_by_user_id: ctx.user_id,
                },
            });
            if (c.lifecycle_stage_id) await tx.crmLifecycleHistory.create({ data: { contact_id: c.id, stage_id: c.lifecycle_stage_id, changed_by_user_id: ctx.user_id } });
            await this.audit.record(ctx, 'crm.contact.created', { resource_type: 'crm_contact', resource_id: c.id, metadata: { after: { first_name: c.first_name, last_name: c.last_name, company_id: c.company_id } } }, tx);
            return c;
        });
        const label = [contact.first_name, contact.last_name].filter(Boolean).join(' ');
        this.events.publish(ctx, {
            event_key: 'crm.contact.created', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_CONTACT, entity_id: contact.id,
            payload: { name: label, company_id: contact.company_id, owner_membership_id: contact.owner_membership_id },
            activity: { summary: `added contact ${label}`, entity_label: label, company_id: contact.company_id },
        });
        return contact;
    }

    async update(ctx: OrgContext, id: string, dto: UpdateContactDto) {
        const before = await this.getForWrite(ctx, id, 'crm.contacts.update');
        const { allow_duplicate: _a, ...data } = dto;
        await this.refs.assert(ctx, { membership: data.owner_membership_id, company: data.company_id, lifecycle_stage: data.lifecycle_stage_id, lead_source: data.lead_source_id });
        this.refs.assertCanAssign(ctx, 'crm.contacts.assign', data.owner_membership_id !== undefined && data.owner_membership_id !== before.owner_membership_id);
        const lifecycleChanged = !!data.lifecycle_stage_id && data.lifecycle_stage_id !== before.lifecycle_stage_id;
        const contact = await this.prisma.$transaction(async (tx) => {
            const c = await tx.crmContact.update({
                where: { id },
                data: { ...data, ...(data.email && { email: data.email.toLowerCase() }), address: data.address as Prisma.InputJsonValue | undefined, consent: data.consent as Prisma.InputJsonValue | undefined },
            });
            if (lifecycleChanged) await tx.crmLifecycleHistory.create({ data: { contact_id: id, stage_id: data.lifecycle_stage_id!, changed_by_user_id: ctx.user_id } });
            await this.audit.record(ctx, data.consent ? 'crm.contact.consent_changed' : 'crm.contact.updated', { resource_type: 'crm_contact', resource_id: id, metadata: { before: pick(before, Object.keys(data)), after: data } }, tx);
            return c;
        });
        this.events.publish(ctx, {
            event_key: 'crm.contact.updated', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_CONTACT, entity_id: id,
            payload: { name: [contact.first_name, contact.last_name].filter(Boolean).join(' '), owner_membership_id: contact.owner_membership_id }, changes: data as Record<string, unknown>,
        });
        if (data.owner_membership_id && data.owner_membership_id !== before.owner_membership_id) this.publishAssigned(ctx, contact);
        return contact;
    }

    async assign(ctx: OrgContext, id: string, owner_membership_id: string) {
        const before = await this.getForWrite(ctx, id, 'crm.contacts.assign');
        await this.refs.assert(ctx, { membership: owner_membership_id });
        const contact = await this.prisma.crmContact.update({ where: { id }, data: { owner_membership_id } });
        await this.audit.record(ctx, 'crm.contact.assigned', { resource_type: 'crm_contact', resource_id: id, metadata: { before: { owner_membership_id: before.owner_membership_id }, after: { owner_membership_id } } });
        this.publishAssigned(ctx, contact);
        return contact;
    }

    private publishAssigned(ctx: OrgContext, c: { id: string; first_name: string; last_name: string | null; owner_membership_id: string | null; company_id: string | null }) {
        const name = [c.first_name, c.last_name].filter(Boolean).join(' ');
        this.events.publish(ctx, {
            event_key: 'crm.contact.assigned', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_CONTACT, entity_id: c.id,
            payload: { name, owner_membership_id: c.owner_membership_id, assignee_membership_ids: c.owner_membership_id ? [c.owner_membership_id] : [] },
            activity: { summary: `assigned contact ${name}`, entity_label: name, company_id: c.company_id },
        });
    }

    async archive(ctx: OrgContext, id: string, archived = true) {
        await this.getForWrite(ctx, id, 'crm.contacts.archive');
        const contact = await this.prisma.crmContact.update({ where: { id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'crm.contact.archived' : 'crm.contact.restored', { resource_type: 'crm_contact', resource_id: id });
        if (archived) this.events.publish(ctx, { event_key: 'crm.contact.archived', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_CONTACT, entity_id: id, payload: { name: contact.first_name } });
        return contact;
    }

    async remove(ctx: OrgContext, id: string) {
        const before = await this.getForWrite(ctx, id, 'crm.contacts.delete');
        await this.prisma.$transaction(async (tx) => {
            await tx.tagging.deleteMany({ where: { entity_type: RecordEntityType.CRM_CONTACT, entity_id: id } });
            await tx.crmNote.deleteMany({ where: { entity_type: RecordEntityType.CRM_CONTACT, entity_id: id, organization_id: ctx.organization_id } });
            await tx.crmContact.delete({ where: { id } });
            await this.audit.record(ctx, 'crm.contact.deleted', { resource_type: 'crm_contact', resource_id: id, metadata: { before: { first_name: before.first_name, last_name: before.last_name, email: before.email } } }, tx);
        });
        this.events.publish(ctx, { event_key: 'crm.contact.deleted', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_CONTACT, entity_id: id, payload: {} });
        return { success: true };
    }

    async export(ctx: OrgContext, query: ContactQuery): Promise<CsvExport> {
        const tagged = await this.refs.idsWithTag(RecordEntityType.CRM_CONTACT, query.tag_id);
        const rows = await this.prisma.crmContact.findMany({ where: this.where(ctx, query, tagged), include: LIST_INCLUDE, orderBy: { created_at: 'desc' }, take: 10000 });
        const content = toCsv(
            ['id', 'first_name', 'last_name', 'email', 'phone', 'mobile', 'job_title', 'company', 'roles', 'lifecycle_stage', 'owner', 'created_at'],
            rows.map((c) => [c.id, c.first_name, c.last_name, c.email, c.phone, c.mobile, c.job_title, c.company?.name, c.roles.join('|'), c.lifecycle_stage?.name, memberLabel(c.owner), c.created_at]),
        );
        await this.audit.record(ctx, 'crm.records.exported', { resource_type: 'crm_contact', metadata: { entity: 'contacts', count: rows.length, filters: query } });
        this.events.publish(ctx, { event_key: 'crm.records.exported', module: ModuleKey.CRM, payload: { entity: 'contacts', count: rows.length } });
        return { filename: `contacts-${new Date().toISOString().slice(0, 10)}.csv`, content, count: rows.length };
    }

    async getForWrite(ctx: OrgContext, id: string, key: string) {
        const contact = await this.prisma.crmContact.findFirst({ where: { id, organization_id: ctx.organization_id, ...contactScopeWhere(ctx, key) } });
        if (!contact) throw new NotFoundException({ message: 'Contact not found', code: 'contact_not_found' });
        return contact;
    }
}
