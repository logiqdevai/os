import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliverableStatus, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { PortalInvitationsService } from '../common/portal-invitations.service';
import { applyChangeSet } from '../common/profile-changes.utils';
import { PORTAL_FEATURES } from '../common/portal-context';
import {
    CreatePortalInvitationDto,
    EnableClientDto,
    PortalActivityQuery,
    PortalApprovalQuery,
    PortalClientQuery,
    PortalInvitationQuery,
    PortalUserQuery,
    ProfileChangeQuery,
    UpdateClientSettingsDto,
    UpdatePortalSettingsDto,
    UpdatePortalUserDto,
} from './dto/portal-admin.dto';

const M = ModuleKey.CUSTOMER_PORTAL;
const USER_SELECT = { id: true, email: true, display_name: true, first_name: true, last_name: true, profile_photo_url: true, last_login_at: true } as const;
const AWAITING: DeliverableStatus[] = ['READY_FOR_REVIEW', 'SUBMITTED'];

const cleanFeatures = (raw?: Record<string, boolean>) =>
    raw ? Object.fromEntries(Object.entries(raw).filter(([k, v]) => (PORTAL_FEATURES as readonly string[]).includes(k) && typeof v === 'boolean')) : undefined;

/**
 * Agency side of the customer portal (07): settings and branding, which clients have the portal, portal users,
 * invitations, profile-change review, activity, and overviews of portal requests and deliverable approvals.
 */
@Injectable()
export class PortalAdminService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly invitations: PortalInvitationsService,
    ) { }

    // --- Overview --------------------------------------------------------------------------------

    async overview(ctx: OrgContext) {
        const org = ctx.organization_id;
        const weekAgo = new Date(Date.now() - 7 * 86400_000);
        const [settings, clientsEnabled, clientsDisabled, users, activeUsers, pendingInvites, pendingChanges, requests, approvals] = await Promise.all([
            this.settings(ctx),
            this.prisma.customerPortalClientSettings.count({ where: { organization_id: org, enabled: true } }),
            this.prisma.customerPortalClientSettings.count({ where: { organization_id: org, enabled: false } }),
            this.prisma.customerPortalMembership.count({ where: { organization_id: org, status: 'ACTIVE' } }),
            this.prisma.customerPortalMembership.count({ where: { organization_id: org, status: 'ACTIVE', last_active_at: { gte: weekAgo } } }),
            this.prisma.invitation.count({ where: { organization_id: org, audience: 'CUSTOMER_PORTAL', status: 'PENDING', expires_at: { gt: new Date() } } }),
            this.prisma.customerPortalProfileChangeRequest.count({ where: { organization_id: org, status: 'PENDING' } }),
            ctx.can('support.tickets.read')
                ? this.prisma.ticket.count({ where: { organization_id: org, source: 'PORTAL', archived_at: null, status: { category: { in: ['NEW', 'OPEN', 'PENDING_CUSTOMER', 'ON_HOLD'] } } } })
                : Promise.resolve(null),
            ctx.can('projects.projects.read')
                ? this.prisma.projectDeliverable.count({ where: { customer_visible: true, status: { in: AWAITING }, project: { organization_id: org, visibility: 'CUSTOMER_VISIBLE' } } })
                : Promise.resolve(null),
        ]);
        const activity = ctx.can('portal.activity.read') ? (await this.activity(ctx, { page: 1, limit: 8, order_direction: 'desc' })).data : null;
        return {
            enabled: settings.enabled,
            clients: { enabled: clientsEnabled, disabled: clientsDisabled },
            users: { active: users, active_last_7_days: activeUsers },
            invitations_pending: pendingInvites,
            profile_changes_pending: pendingChanges,
            portal_requests_open: requests,
            deliverables_awaiting_review: approvals,
            recent_activity: activity,
        };
    }

    // --- Settings & branding ---------------------------------------------------------------------

    async settings(ctx: OrgContext) {
        const row = await this.prisma.customerPortalSettings.upsert({ where: { organization_id: ctx.organization_id }, update: {}, create: { organization_id: ctx.organization_id } });
        const org = await this.prisma.organization.findUnique({ where: { id: ctx.organization_id }, select: { display_name: true, slug: true, logo_url: true, branding: true } });
        return { ...row, features: { ...Object.fromEntries(PORTAL_FEATURES.map((f) => [f, true])), ...((row.features as Record<string, boolean>) ?? {}) }, organization: org };
    }

    async updateSettings(ctx: OrgContext, dto: UpdatePortalSettingsDto) {
        const before = await this.settings(ctx);
        if (dto.default_role_slug) await this.invitations.resolveRole(ctx.organization_id, null, dto.default_role_slug);
        if (dto.custom_domain !== undefined && dto.custom_domain !== before.custom_domain && !ctx.can('organizations.domains.manage')) {
            throw new ForbiddenException({ message: 'A custom domain also needs organizations.domains.manage', code: 'permission_denied', permissions: ['organizations.domains.manage'] });
        }
        const { features, branding, widget_settings, ...rest } = dto;
        try {
            await this.prisma.customerPortalSettings.update({
                where: { organization_id: ctx.organization_id },
                data: {
                    ...rest,
                    ...(features && { features: { ...((before.features as Record<string, boolean>) ?? {}), ...cleanFeatures(features) } as Prisma.InputJsonValue }),
                    ...(branding && { branding: branding as Prisma.InputJsonValue }),
                    ...(widget_settings && { widget_settings: widget_settings as Prisma.InputJsonValue }),
                },
            });
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ message: 'This domain is already used', code: 'portal_domain_taken' });
            throw e;
        }
        await this.audit.record(ctx, 'portal.settings.updated', { resource_type: 'customer_portal_settings', resource_id: ctx.organization_id, metadata: { before: { enabled: before.enabled, features: before.features, default_role_slug: before.default_role_slug }, after: dto } });
        this.events.publish(ctx, { event_key: 'portal.settings.updated', module: M, entity_kind: 'customer_portal_settings', entity_id: ctx.organization_id, changes: dto as Record<string, unknown> });
        return this.settings(ctx);
    }

    // --- Clients ---------------------------------------------------------------------------------

    async clients(ctx: OrgContext, q: PortalClientQuery) {
        const org = ctx.organization_id;
        const portal: Prisma.CrmCompanyWhereInput =
            q.portal === 'enabled' ? { portal_settings: { some: { organization_id: org, enabled: true } } }
                : q.portal === 'disabled' ? { portal_settings: { some: { organization_id: org, enabled: false } } }
                    : q.portal === 'not_set_up' ? { portal_settings: { none: { organization_id: org } } } : {};
        const where: Prisma.CrmCompanyWhereInput = {
            organization_id: org,
            archived_at: null,
            merged_into_id: null,
            OR: [{ type: 'CUSTOMER' }, { portal_settings: { some: { organization_id: org } } }],
            ...portal,
            ...(q.search && { name: { contains: q.search, mode: 'insensitive' } }),
        };
        const [rows, total] = await Promise.all([
            this.prisma.crmCompany.findMany({
                where,
                ...skipTake(q),
                orderBy: { name: 'asc' },
                select: {
                    id: true, name: true, type: true, website: true, email: true,
                    portal_settings: { where: { organization_id: org }, select: { enabled: true, disabled_at: true, created_at: true, default_role_slug: true } },
                    _count: { select: { portal_invitations: { where: { status: 'PENDING', expires_at: { gt: new Date() } } } } },
                },
            }),
            this.prisma.crmCompany.count({ where }),
        ]);
        const ids = rows.map((r) => r.id);
        const [userCounts, lastActive] = await Promise.all([
            this.prisma.customerPortalMembership.groupBy({ by: ['customer_id'], where: { organization_id: org, customer_id: { in: ids }, status: 'ACTIVE' }, _count: { _all: true } }),
            this.prisma.customerPortalMembership.groupBy({ by: ['customer_id'], where: { organization_id: org, customer_id: { in: ids } }, _max: { last_active_at: true } }),
        ]);
        const data = rows.map(({ portal_settings, _count, ...c }) => {
            const s = portal_settings[0];
            const users = userCounts.find((u) => u.customer_id === c.id)?._count._all ?? 0;
            return {
                ...c,
                portal_status: s ? (s.enabled ? 'enabled' : 'disabled') : users ? 'enabled' : 'not_set_up',
                portal_enabled_at: s?.created_at ?? null,
                users,
                pending_invitations: _count.portal_invitations,
                last_active_at: lastActive.find((l) => l.customer_id === c.id)?._max.last_active_at ?? null,
            };
        });
        return paginate(data, total, q);
    }

    async client(ctx: OrgContext, companyId: string) {
        const company = await this.company(ctx, companyId);
        const org = ctx.organization_id;
        const [settings, users, invitations, changes, projects] = await Promise.all([
            this.prisma.customerPortalClientSettings.findUnique({ where: { organization_id_company_id: { organization_id: org, company_id: companyId } } }),
            this.prisma.customerPortalMembership.findMany({ where: { organization_id: org, customer_id: companyId }, include: { user: { select: USER_SELECT }, role: { select: { id: true, name: true, slug: true } } }, orderBy: { joined_at: 'asc' } }),
            this.invitations.list(org, { company_id: companyId, take: 50 }),
            this.prisma.customerPortalProfileChangeRequest.count({ where: { organization_id: org, company_id: companyId, status: 'PENDING' } }),
            this.prisma.project.findMany({ where: { organization_id: org, company_id: companyId, archived_at: null }, select: { id: true, name: true, code: true, visibility: true, progress_percent: true, health: true } }),
        ]);
        return {
            company,
            settings,
            portal_status: settings ? (settings.enabled ? 'enabled' : 'disabled') : users.length ? 'enabled' : 'not_set_up',
            users,
            invitations: invitations.rows,
            pending_profile_changes: changes,
            projects,
        };
    }

    async enableClient(ctx: OrgContext, companyId: string, dto: EnableClientDto) {
        await this.company(ctx, companyId);
        if (dto.emails?.length && !ctx.can('portal.users.manage')) throw new ForbiddenException({ message: 'Inviting people needs portal.users.manage', code: 'permission_denied', permissions: ['portal.users.manage'] });
        if (dto.default_role_slug) await this.invitations.resolveRole(ctx.organization_id, null, dto.default_role_slug);
        await this.prisma.customerPortalClientSettings.upsert({
            where: { organization_id_company_id: { organization_id: ctx.organization_id, company_id: companyId } },
            update: { enabled: true, disabled_at: null, ...(dto.default_role_slug !== undefined && { default_role_slug: dto.default_role_slug }), ...(dto.welcome_message !== undefined && { welcome_message: dto.welcome_message }) },
            create: { organization_id: ctx.organization_id, company_id: companyId, enabled: true, default_role_slug: dto.default_role_slug ?? null, welcome_message: dto.welcome_message ?? null },
        });
        await this.audit.record(ctx, 'portal.client.enabled', { resource_type: 'crm_company', resource_id: companyId, metadata: { default_role_slug: dto.default_role_slug, invitations: dto.emails?.length ?? 0 } });
        this.events.publish(ctx, { event_key: 'portal.client.enabled', module: M, entity_type: 'CRM_COMPANY', entity_id: companyId, activity: { summary: 'Client portal enabled', company_id: companyId } });
        const invited = dto.emails?.length ? await this.invitations.invite(ctx, { company_id: companyId, emails: dto.emails, role_id: dto.role_id, message: dto.message }) : { results: [] };
        return { ...(await this.client(ctx, companyId)), invitation_results: invited.results };
    }

    async disableClient(ctx: OrgContext, companyId: string) {
        await this.company(ctx, companyId);
        await this.prisma.customerPortalClientSettings.upsert({
            where: { organization_id_company_id: { organization_id: ctx.organization_id, company_id: companyId } },
            update: { enabled: false, disabled_at: new Date() },
            create: { organization_id: ctx.organization_id, company_id: companyId, enabled: false, disabled_at: new Date() },
        });
        await this.prisma.invitation.updateMany({ where: { organization_id: ctx.organization_id, audience: 'CUSTOMER_PORTAL', customer_id: companyId, status: 'PENDING' }, data: { status: 'CANCELLED', cancelled_at: new Date() } });
        await this.audit.record(ctx, 'portal.client.disabled', { resource_type: 'crm_company', resource_id: companyId });
        this.events.publish(ctx, { event_key: 'portal.client.disabled', module: M, entity_type: 'CRM_COMPANY', entity_id: companyId, activity: { summary: 'Client portal switched off', company_id: companyId } });
        return this.client(ctx, companyId);
    }

    async updateClientSettings(ctx: OrgContext, companyId: string, dto: UpdateClientSettingsDto) {
        await this.company(ctx, companyId);
        if (dto.default_role_slug) await this.invitations.resolveRole(ctx.organization_id, null, dto.default_role_slug);
        const features = cleanFeatures(dto.features);
        await this.prisma.customerPortalClientSettings.upsert({
            where: { organization_id_company_id: { organization_id: ctx.organization_id, company_id: companyId } },
            update: { ...(features && { features: features as Prisma.InputJsonValue }), ...(dto.default_role_slug !== undefined && { default_role_slug: dto.default_role_slug }), ...(dto.welcome_message !== undefined && { welcome_message: dto.welcome_message }) },
            create: { organization_id: ctx.organization_id, company_id: companyId, features: features as Prisma.InputJsonValue, default_role_slug: dto.default_role_slug ?? null, welcome_message: dto.welcome_message ?? null },
        });
        await this.audit.record(ctx, 'portal.client.settings_updated', { resource_type: 'crm_company', resource_id: companyId, metadata: { after: dto } });
        return this.client(ctx, companyId);
    }

    // --- Users -----------------------------------------------------------------------------------

    async users(ctx: OrgContext, q: PortalUserQuery) {
        const where: Prisma.CustomerPortalMembershipWhereInput = {
            organization_id: ctx.organization_id,
            ...(q.company_id && { customer_id: q.company_id }),
            ...(q.role_id && { role_id: q.role_id }),
            ...(q.status && { status: q.status }),
            ...(q.search && { user: { OR: [{ email: { contains: q.search, mode: 'insensitive' } }, { display_name: { contains: q.search, mode: 'insensitive' } }, { first_name: { contains: q.search, mode: 'insensitive' } }, { last_name: { contains: q.search, mode: 'insensitive' } }] } }),
        };
        const [rows, total] = await Promise.all([
            this.prisma.customerPortalMembership.findMany({
                where,
                ...skipTake(q),
                orderBy: { joined_at: 'desc' },
                include: { user: { select: USER_SELECT }, role: { select: { id: true, name: true, slug: true } }, _count: { select: { project_access: true } } },
            }),
            this.prisma.customerPortalMembership.count({ where }),
        ]);
        const companies = await this.prisma.crmCompany.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.customer_id))] } }, select: { id: true, name: true } });
        return paginate(rows.map((r) => ({ ...r, company: companies.find((c) => c.id === r.customer_id) ?? null })), total, q);
    }

    async user(ctx: OrgContext, id: string) {
        const m = await this.prisma.customerPortalMembership.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: { user: { select: USER_SELECT }, role: { select: { id: true, name: true, slug: true } }, project_access: { include: { project: { select: { id: true, name: true, code: true } } } } },
        });
        if (!m) throw new NotFoundException({ message: 'Portal user not found', code: 'portal_user_not_found' });
        const [company, activity] = await Promise.all([
            this.prisma.crmCompany.findUnique({ where: { id: m.customer_id }, select: { id: true, name: true } }),
            ctx.can('portal.activity.read')
                ? this.prisma.auditEvent.findMany({ where: { organization_id: ctx.organization_id, actor_user_id: m.user_id }, orderBy: { created_at: 'desc' }, take: 20, select: { id: true, event_type: true, resource_type: true, resource_id: true, created_at: true, outcome: true } })
                : Promise.resolve(null),
        ]);
        return { ...m, company, activity };
    }

    async updateUser(ctx: OrgContext, id: string, dto: UpdatePortalUserDto) {
        const before = await this.user(ctx, id);
        if (before.user_id === ctx.user_id) throw new ForbiddenException({ message: 'You cannot change your own portal access', code: 'portal_self_change' });
        if (dto.status === 'INVITED') throw new BadRequestException({ message: 'Use ACTIVE, SUSPENDED or DEACTIVATED', code: 'portal_status_invalid' });
        if (dto.role_id) await this.invitations.resolveRole(ctx.organization_id, dto.role_id);
        const row = await this.prisma.customerPortalMembership.update({
            where: { id },
            data: { ...(dto.role_id && { role_id: dto.role_id }), ...(dto.status && { status: dto.status, deactivated_at: dto.status === 'DEACTIVATED' ? new Date() : null }) },
        });
        await this.audit.record(ctx, dto.status ? `portal.user.${dto.status.toLowerCase()}` : 'portal.user.role_changed', { resource_type: 'customer_portal_membership', resource_id: id, metadata: { before: { role_id: before.role_id, status: before.status }, after: dto, user_id: before.user_id, customer_id: before.customer_id } });
        this.events.publish(ctx, { event_key: 'portal.user.updated', module: M, entity_kind: 'customer_portal_membership', entity_id: id, changes: dto as Record<string, unknown>, payload: { customer_id: before.customer_id } });
        return { ...row };
    }

    async setUserProjects(ctx: OrgContext, id: string, projectIds: string[]) {
        const m = await this.user(ctx, id);
        if (projectIds.length) {
            const valid = await this.prisma.project.count({ where: { id: { in: projectIds }, organization_id: ctx.organization_id, company_id: m.customer_id } });
            if (valid !== new Set(projectIds).size) throw new BadRequestException({ message: "Only the client's own projects can be selected", code: 'portal_project_invalid' });
        }
        await this.prisma.$transaction([
            this.prisma.customerPortalMembershipProject.deleteMany({ where: { portal_membership_id: id } }),
            this.prisma.customerPortalMembershipProject.createMany({ data: projectIds.map((p) => ({ portal_membership_id: id, project_id: p, organization_id: ctx.organization_id })) }),
        ]);
        await this.audit.record(ctx, 'portal.user.project_access_changed', { resource_type: 'customer_portal_membership', resource_id: id, metadata: { project_ids: projectIds } });
        return this.user(ctx, id);
    }

    // --- Invitations -----------------------------------------------------------------------------

    async invitationsList(ctx: OrgContext, q: PortalInvitationQuery) {
        const { rows, total } = await this.invitations.list(ctx.organization_id, { company_id: q.company_id, status: q.status, search: q.search, ...skipTake(q) });
        return paginate(rows, total, q);
    }

    async invite(ctx: OrgContext, dto: CreatePortalInvitationDto) {
        await this.company(ctx, dto.company_id);
        const existing = await this.prisma.customerPortalClientSettings.findUnique({ where: { organization_id_company_id: { organization_id: ctx.organization_id, company_id: dto.company_id } } });
        if (!existing) await this.prisma.customerPortalClientSettings.create({ data: { organization_id: ctx.organization_id, company_id: dto.company_id, enabled: true } });
        return this.invitations.invite(ctx, dto);
    }

    resend(ctx: OrgContext, id: string) {
        return this.invitations.resend(ctx, id);
    }

    cancel(ctx: OrgContext, id: string) {
        return this.invitations.cancel(ctx, id);
    }

    roles(ctx: OrgContext) {
        return this.invitations.customerRoles(ctx.organization_id);
    }

    // --- Profile changes -------------------------------------------------------------------------

    async profileChanges(ctx: OrgContext, q: ProfileChangeQuery) {
        const where: Prisma.CustomerPortalProfileChangeRequestWhereInput = { organization_id: ctx.organization_id, ...(q.status && { status: q.status }), ...(q.company_id && { company_id: q.company_id }) };
        const [rows, total] = await Promise.all([
            this.prisma.customerPortalProfileChangeRequest.findMany({
                where,
                ...skipTake(q),
                orderBy: { created_at: 'desc' },
                include: { company: { select: { id: true, name: true } }, contact: { select: { id: true, first_name: true, last_name: true } }, requested_by: { select: USER_SELECT } },
            }),
            this.prisma.customerPortalProfileChangeRequest.count({ where }),
        ]);
        return paginate(rows, total, q);
    }

    async reviewProfileChange(ctx: OrgContext, id: string, approve: boolean, note?: string) {
        const req = await this.prisma.customerPortalProfileChangeRequest.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!req) throw new NotFoundException({ message: 'Change request not found', code: 'profile_change_not_found' });
        if (req.status !== 'PENDING') throw new ConflictException({ message: `Already ${req.status.toLowerCase()}`, code: 'profile_change_decided' });
        if (approve && !ctx.can(req.contact_id ? 'crm.contacts.update' : 'crm.companies.update')) {
            const key = req.contact_id ? 'crm.contacts.update' : 'crm.companies.update';
            throw new ForbiddenException({ message: `Applying the change also needs ${key}`, code: 'permission_denied', permissions: [key] });
        }
        await this.prisma.$transaction(async (tx) => {
            if (approve) await applyChangeSet(tx, req);
            await tx.customerPortalProfileChangeRequest.update({ where: { id }, data: { status: approve ? 'APPROVED' : 'REJECTED', reviewed_by_membership_id: ctx.membership_id, reviewed_at: new Date(), review_note: note ?? null } });
        });
        await this.audit.record(ctx, approve ? 'portal.profile_change.approved' : 'portal.profile_change.rejected', { resource_type: 'customer_portal_profile_change_request', resource_id: id, metadata: { company_id: req.company_id, contact_id: req.contact_id, changes: req.changes, note } });
        this.events.publish(ctx, { event_key: approve ? 'portal.profile_change.approved' : 'portal.profile_change.rejected', module: M, entity_kind: 'customer_portal_profile_change_request', entity_id: id, payload: { company_id: req.company_id, requested_by_user_id: req.requested_by_user_id } });
        return this.prisma.customerPortalProfileChangeRequest.findUnique({ where: { id } });
    }

    // --- Activity & approvals --------------------------------------------------------------------

    async activity(ctx: OrgContext, q: PortalActivityQuery) {
        const members = await this.prisma.customerPortalMembership.findMany({ where: { organization_id: ctx.organization_id, ...(q.company_id && { customer_id: q.company_id }) }, select: { user_id: true, customer_id: true } });
        const userIds = [...new Set(members.map((m) => m.user_id))];
        const where: Prisma.AuditEventWhereInput = {
            organization_id: ctx.organization_id,
            OR: [{ actor_user_id: { in: userIds } }, ...(q.company_id ? [] : [{ event_type: { startsWith: 'portal.' } }])],
        };
        const [rows, total] = await Promise.all([
            this.prisma.auditEvent.findMany({ where, ...skipTake(q), orderBy: { created_at: 'desc' }, select: { id: true, event_type: true, resource_type: true, resource_id: true, outcome: true, created_at: true, actor_user_id: true, actor_type: true } }),
            this.prisma.auditEvent.count({ where }),
        ]);
        const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.actor_user_id).filter(Boolean) as string[])] } }, select: USER_SELECT });
        const companies = await this.prisma.crmCompany.findMany({ where: { id: { in: [...new Set(members.map((m) => m.customer_id))] } }, select: { id: true, name: true } });
        return paginate(
            rows.map((r) => {
                const m = members.find((x) => x.user_id === r.actor_user_id);
                return { ...r, actor: users.find((u) => u.id === r.actor_user_id) ?? null, is_portal_user: !!m, company: m ? companies.find((c) => c.id === m.customer_id) ?? null : null };
            }),
            total,
            q,
        );
    }

    async approvals(ctx: OrgContext, q: PortalApprovalQuery) {
        const statuses: DeliverableStatus[] = q.state === 'awaiting' ? AWAITING : q.state === 'changes_requested' ? ['CHANGES_REQUESTED'] : q.state === 'decided' ? ['ACCEPTED', 'REJECTED'] : [...AWAITING, 'CHANGES_REQUESTED', 'ACCEPTED', 'REJECTED'];
        const where: Prisma.ProjectDeliverableWhereInput = {
            customer_visible: true,
            status: { in: statuses },
            project: { organization_id: ctx.organization_id, visibility: 'CUSTOMER_VISIBLE', archived_at: null, ...(q.company_id && { company_id: q.company_id }) },
            ...(q.search && { name: { contains: q.search, mode: 'insensitive' } }),
        };
        const [rows, total] = await Promise.all([
            this.prisma.projectDeliverable.findMany({
                where,
                ...skipTake(q),
                orderBy: [{ due_date: { sort: 'asc', nulls: 'last' } }, { updated_at: 'desc' }],
                select: {
                    id: true, name: true, status: true, due_date: true, submitted_at: true, accepted_at: true, approval_mode: true,
                    project: { select: { id: true, name: true, code: true, company: { select: { id: true, name: true } } } },
                    approvers: { select: { required: true, portal_membership: { select: { id: true, user: { select: { display_name: true, email: true } } } } } },
                    reviews: { orderBy: { decided_at: 'desc' }, take: 1, select: { decision: true, comment: true, decided_at: true, reviewer_user_id: true } },
                },
            }),
            this.prisma.projectDeliverable.count({ where }),
        ]);
        return paginate(rows, total, q);
    }

    private async company(ctx: OrgContext, id: string) {
        const c = await this.prisma.crmCompany.findFirst({ where: { id, organization_id: ctx.organization_id }, select: { id: true, name: true, type: true, website: true, email: true, phone: true } });
        if (!c) throw new NotFoundException({ message: 'Client not found', code: 'company_not_found' });
        return c;
    }
}
