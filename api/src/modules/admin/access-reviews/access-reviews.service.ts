import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
    AccessReviewDecision,
    AccessReviewStatus,
    MembershipStatus,
    ModuleKey,
    Prisma,
    ReviewerStrategy,
    ScopeType,
} from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { AdminAccessService, USER_SELECT } from '../shared/admin-access.service';
import { MembersService } from '../members/members.service';
import { PermissionsService } from '../permissions/permissions.service';
import {
    AccessReviewItemQuery,
    AccessReviewQuery,
    CreateAccessReviewInput,
    DecideItemInput,
    ReassignItemInput,
    RequestedChanges,
} from './dto/access-review.dto';

const READ = 'organizations.access_reviews.read';
const MANAGE = 'organizations.access_reviews.manage';
const DECIDE = 'organizations.access_reviews.decide';

/** Shape of AccessReviewItem.access_snapshot (frozen on Start; `requested_changes` is added by a MODIFIED decision). */
export interface AccessSnapshot {
    status: string;
    job_title: string | null;
    roles: { assignment_id: string; role_id: string; role_name: string; scope_type: ScopeType; scope_id: string | null; valid_until: string | null }[];
    grants: { grant_id: string; key: string; effect: string; scope_type: ScopeType; scope_id: string | null }[];
    module_overrides: { module: string; enabled: boolean }[];
    branches: { branch_id: string; name: string; is_primary: boolean }[];
    teams: { team_id: string; name: string }[];
    modules: string[];
    permission_count: number;
    mfa_enabled: boolean;
    last_active_at: string | null;
    requested_changes?: RequestedChanges;
}

const PERSON = { id: true, job_title: true, user: { select: USER_SELECT } } as const;

/**
 * Access reviews (01 §98, mockup 01-admin `reviews` / `reviewNew` / `review`).
 * DRAFT → start (one item per in-scope member, access snapshot, reviewer resolved by strategy; nobody reviews themselves)
 * → reviewers certify / revoke / modify their own items (organizations.access_reviews.decide)
 * → apply (REVOKED / MODIFIED decisions go through MembersService / PermissionsService so audit and cache invalidation happen)
 * → complete (every item decided and applied). Cancel at any time before completion.
 */
@Injectable()
export class AccessReviewsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly authorization: AuthorizationService,
        private readonly access: AdminAccessService,
        private readonly members: MembersService,
        private readonly permissions: PermissionsService,
    ) { }

    // ---------------------------------------------------------------------------------------------
    // Visibility
    // ---------------------------------------------------------------------------------------------

    /** Readers / managers see reviews (organization-wide, or of their branches / teams); reviewers see reviews with items assigned to them. */
    private reviewWhere(ctx: OrgContext): Prisma.AccessReviewWhereInput {
        const scopes = [ctx.scopeOf(READ), ctx.scopeOf(MANAGE)].filter(Boolean);
        if (scopes.some((s) => s!.organization)) return { organization_id: ctx.organization_id };
        const or: Prisma.AccessReviewWhereInput[] = [];
        const branchIds = scopes.flatMap((s) => s!.branch_ids);
        const teamIds = scopes.flatMap((s) => s!.team_ids);
        if (branchIds.length) or.push({ scope_type: { in: [ScopeType.BRANCH, ScopeType.BRANCH_HIERARCHY] }, scope_id: { in: branchIds } });
        if (teamIds.length) or.push({ scope_type: ScopeType.TEAM, scope_id: { in: teamIds } });
        if (ctx.membership_id && ctx.can(DECIDE)) or.push({ items: { some: { reviewer_membership_id: ctx.membership_id } } });
        // Never an empty OR (matches nothing on purpose when the caller has no reachable review).
        return { organization_id: ctx.organization_id, OR: or.length ? or : [{ id: { in: [] } }] };
    }

    /** Can the caller see every item of a visible review, or only the ones assigned to them? */
    private seesAllItems(ctx: OrgContext) {
        return ctx.can(READ) || ctx.can(MANAGE);
    }

    // ---------------------------------------------------------------------------------------------
    // Reviews
    // ---------------------------------------------------------------------------------------------

    async findAll(ctx: OrgContext, query: AccessReviewQuery) {
        const where: Prisma.AccessReviewWhereInput = {
            AND: [this.reviewWhere(ctx), { ...(query.status && { status: query.status }), ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }) }],
        };
        const [rows, total] = await Promise.all([
            this.prisma.accessReview.findMany({ where, ...skipTake(query), orderBy: orderBy(query, ['created_at', 'due_at', 'name'], 'created_at'), include: { created_by: { select: PERSON } } }),
            this.prisma.accessReview.count({ where }),
        ]);
        const stats = await this.stats(rows.map((r) => r.id), this.seesAllItems(ctx) ? null : ctx.membership_id);
        return paginate(rows.map((r) => ({ ...r, stats: stats.get(r.id) ?? emptyStats() })), total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const review = await this.prisma.accessReview.findFirst({ where: { AND: [{ id }, this.reviewWhere(ctx)] }, include: { created_by: { select: PERSON } } });
        if (!review) throw new NotFoundException({ message: 'Access review not found', code: 'access_review_not_found' });
        return review;
    }

    async get(ctx: OrgContext, id: string) {
        const review = await this.findOne(ctx, id);
        const mineOnly = this.seesAllItems(ctx) ? null : ctx.membership_id;
        const stats = (await this.stats([id], mineOnly)).get(id) ?? emptyStats();
        const byReviewer = await this.prisma.accessReviewItem.groupBy({
            by: ['reviewer_membership_id', 'decision'],
            where: { review_id: id, ...(mineOnly && { reviewer_membership_id: mineOnly }) },
            _count: { _all: true },
        });
        const reviewerIds = [...new Set(byReviewer.map((r) => r.reviewer_membership_id).filter(Boolean) as string[])];
        const people = await this.prisma.membership.findMany({ where: { id: { in: reviewerIds } }, select: PERSON });
        // A reviewer without the decide key cannot record decisions: flag it so a manager can grant it or reassign.
        const canDecide = await Promise.all(reviewerIds.map(async (rid) => !!(await this.authorization.effectiveFor({ organization_id: ctx.organization_id, membership_id: rid })).permissions[DECIDE]));
        const reviewers = reviewerIds.map((rid, i) => {
            const rows = byReviewer.filter((r) => r.reviewer_membership_id === rid);
            const assigned = rows.reduce((n, r) => n + r._count._all, 0);
            const decided = rows.filter((r) => r.decision !== AccessReviewDecision.PENDING).reduce((n, r) => n + r._count._all, 0);
            return { reviewer: people.find((p) => p.id === rid) ?? null, assigned, decided, has_decide_permission: canDecide[i] };
        });
        const unassigned = byReviewer.filter((r) => !r.reviewer_membership_id).reduce((n, r) => n + r._count._all, 0);
        return { ...review, stats, reviewers, unassigned_items: unassigned, scope_label: await this.scopeLabel(ctx, review.scope_type, review.scope_id) };
    }

    async create(ctx: OrgContext, dto: CreateAccessReviewInput) {
        const now = new Date();
        if (dto.due_at <= now) throw new BadRequestException({ message: 'The due date must be in the future', code: 'access_review_due_past' });
        if (dto.starts_at && dto.starts_at > dto.due_at) throw new BadRequestException({ message: 'The start must be before the due date', code: 'access_review_dates' });
        const scope_id = await this.access.assertScope(ctx, dto.scope_type, dto.scope_id);
        const reviewerIds = [...new Set(dto.reviewer_membership_ids)];
        if (reviewerIds.length) {
            const found = await this.prisma.membership.count({ where: { id: { in: reviewerIds }, organization_id: ctx.organization_id, status: MembershipStatus.ACTIVE } });
            if (found !== reviewerIds.length) throw new NotFoundException({ message: 'Reviewer not found or not active', code: 'reviewer_not_found' });
        }
        const review = await this.prisma.accessReview.create({
            data: {
                organization_id: ctx.organization_id,
                name: dto.name,
                description: dto.description,
                scope_type: dto.scope_type,
                scope_id,
                modules: dto.modules,
                reviewer_strategy: dto.reviewer_strategy,
                reviewer_membership_ids: dto.reviewer_strategy === ReviewerStrategy.SPECIFIC ? reviewerIds : [],
                starts_at: dto.starts_at ?? null,
                due_at: dto.due_at,
                created_by_membership_id: ctx.membership_id,
            },
        });
        await this.audit.record(ctx, 'access_review.created', { resource_type: 'access_review', resource_id: review.id, metadata: { name: review.name, scope_type: review.scope_type, scope_id, modules: dto.modules, reviewer_strategy: dto.reviewer_strategy, due_at: dto.due_at } });
        this.events.publish(ctx, { event_key: 'organizations.access_review.created', module: ModuleKey.ADMINISTRATION, entity_kind: 'access_review', entity_id: review.id, payload: { name: review.name } });
        if (dto.start) return this.start(ctx, review.id);
        return this.get(ctx, review.id);
    }

    /** Snapshot every in-scope member into an item and resolve its reviewer. */
    async start(ctx: OrgContext, id: string) {
        const review = await this.findOne(ctx, id);
        if (review.status !== AccessReviewStatus.DRAFT) throw new ConflictException({ message: 'Only a draft review can be started', code: 'access_review_not_draft' });

        const memberWhere: Prisma.MembershipWhereInput = { organization_id: ctx.organization_id, status: { in: [MembershipStatus.ACTIVE, MembershipStatus.SUSPENDED] } };
        if (review.scope_type === ScopeType.BRANCH) memberWhere.branches = { some: { branch_id: review.scope_id!, ended_at: null } };
        if (review.scope_type === ScopeType.BRANCH_HIERARCHY) memberWhere.branches = { some: { branch_id: { in: await this.branchTree(ctx, review.scope_id!) }, ended_at: null } };
        if (review.scope_type === ScopeType.TEAM) memberWhere.teams = { some: { team_id: review.scope_id!, ended_at: null } };

        const members = await this.prisma.membership.findMany({
            where: memberWhere,
            select: {
                id: true, status: true, job_title: true, last_active_at: true,
                user: { select: { mfa_enabled: true } },
                role_assignments: {
                    where: { revoked_at: null, OR: [{ valid_until: null }, { valid_until: { gt: new Date() } }] },
                    select: { id: true, role_id: true, scope_type: true, scope_id: true, valid_until: true, role: { select: { name: true } } },
                },
                permission_grants: { where: { revoked_at: null, OR: [{ valid_until: null }, { valid_until: { gt: new Date() } }] }, select: { id: true, effect: true, scope_type: true, scope_id: true, permission: { select: { key: true } } } },
                module_access: { select: { module: true, enabled: true } },
                branches: { where: { ended_at: null }, select: { branch_id: true, is_primary: true, branch: { select: { name: true } } } },
                teams: { where: { ended_at: null }, select: { team_id: true, team: { select: { name: true } } } },
            },
        });
        const permModules = new Map((await this.prisma.permission.findMany({ select: { key: true, module: true } })).map((p) => [p.key, p.module as string]));

        const items: { membership_id: string; reviewer_membership_id: string | null; access_snapshot: AccessSnapshot }[] = [];
        let specificCursor = 0;
        for (const m of members) {
            const effective = await this.authorization.effectiveFor({ organization_id: ctx.organization_id, membership_id: m.id });
            const keys = Object.keys(effective.permissions);
            const modulesHeld = [...new Set(keys.map((k) => permModules.get(k)).filter(Boolean) as string[])].sort();
            if (review.modules.length && !review.modules.some((mod) => modulesHeld.includes(mod))) continue;
            const reviewer = await this.resolveReviewer(ctx, review, m, specificCursor);
            if (review.reviewer_strategy === ReviewerStrategy.SPECIFIC) specificCursor++;
            items.push({
                membership_id: m.id,
                reviewer_membership_id: reviewer,
                access_snapshot: {
                    status: m.status,
                    job_title: m.job_title,
                    roles: m.role_assignments.map((a) => ({ assignment_id: a.id, role_id: a.role_id, role_name: a.role.name, scope_type: a.scope_type, scope_id: a.scope_id, valid_until: a.valid_until?.toISOString() ?? null })),
                    grants: m.permission_grants.map((g) => ({ grant_id: g.id, key: g.permission.key, effect: g.effect, scope_type: g.scope_type, scope_id: g.scope_id })),
                    module_overrides: m.module_access,
                    branches: m.branches.map((b) => ({ branch_id: b.branch_id, name: b.branch.name, is_primary: b.is_primary })),
                    teams: m.teams.map((t) => ({ team_id: t.team_id, name: t.team.name })),
                    modules: modulesHeld,
                    permission_count: keys.length,
                    mfa_enabled: m.user.mfa_enabled,
                    last_active_at: m.last_active_at?.toISOString() ?? null,
                },
            });
        }
        if (!items.length) throw new BadRequestException({ message: 'Nobody matches this scope and module filter', code: 'access_review_empty' });

        await this.prisma.$transaction(async (tx) => {
            await tx.accessReviewItem.createMany({
                data: items.map((i) => ({ review_id: id, membership_id: i.membership_id, reviewer_membership_id: i.reviewer_membership_id, access_snapshot: i.access_snapshot as unknown as Prisma.InputJsonValue })),
            });
            await tx.accessReview.update({ where: { id }, data: { status: AccessReviewStatus.IN_PROGRESS, starts_at: review.starts_at ?? new Date() } });
        });
        const reviewers = [...new Set(items.map((i) => i.reviewer_membership_id).filter(Boolean) as string[])];
        await this.audit.record(ctx, 'access_review.started', { resource_type: 'access_review', resource_id: id, metadata: { items: items.length, reviewers: reviewers.length, unassigned: items.filter((i) => !i.reviewer_membership_id).length } });
        this.events.publish(ctx, {
            event_key: 'organizations.access_review.started',
            module: ModuleKey.ADMINISTRATION,
            entity_kind: 'access_review',
            entity_id: id,
            payload: {
                name: review.name,
                items: items.length,
                assignee_membership_ids: reviewers,
                entity_label: review.name,
                link: `/admin/access-reviews/${id}`,
                notification_title: `Access review assigned to you: ${review.name}`,
                notification_body: `Due ${review.due_at.toISOString().slice(0, 10)}`,
            },
        });
        return this.get(ctx, id);
    }

    async cancel(ctx: OrgContext, id: string) {
        const review = await this.findOne(ctx, id);
        if (review.status === AccessReviewStatus.COMPLETED || review.status === AccessReviewStatus.CANCELLED) {
            throw new ConflictException({ message: `The review is already ${review.status.toLowerCase()}`, code: 'access_review_closed' });
        }
        await this.prisma.accessReview.update({ where: { id }, data: { status: AccessReviewStatus.CANCELLED } });
        await this.audit.record(ctx, 'access_review.cancelled', { resource_type: 'access_review', resource_id: id, metadata: { from: review.status } });
        this.events.publish(ctx, { event_key: 'organizations.access_review.cancelled', module: ModuleKey.ADMINISTRATION, entity_kind: 'access_review', entity_id: id, payload: { name: review.name } });
        return this.get(ctx, id);
    }

    /** Apply every REVOKED / MODIFIED decision not applied yet. Failures are reported per item and left unapplied. */
    async apply(ctx: OrgContext, id: string) {
        const review = await this.findOne(ctx, id);
        if (review.status !== AccessReviewStatus.IN_PROGRESS) throw new ConflictException({ message: 'Only a review in progress can be applied', code: 'access_review_not_in_progress' });
        const items = await this.prisma.accessReviewItem.findMany({
            where: { review_id: id, applied_at: null, decision: { in: [AccessReviewDecision.REVOKED, AccessReviewDecision.MODIFIED] } },
            include: { membership: { select: { id: true, user: { select: USER_SELECT } } } },
        });
        const results: { item_id: string; membership_id: string; applied: boolean; changes: number; error?: string }[] = [];
        for (const item of items) {
            try {
                const changes = await this.applyItem(ctx, item.membership_id, item.decision, item.access_snapshot as unknown as AccessSnapshot);
                await this.prisma.accessReviewItem.update({ where: { id: item.id }, data: { applied_at: new Date() } });
                await this.audit.record(ctx, 'access_review.decision_applied', { resource_type: 'access_review_item', resource_id: item.id, metadata: { review_id: id, membership_id: item.membership_id, decision: item.decision, changes } });
                results.push({ item_id: item.id, membership_id: item.membership_id, applied: true, changes });
            } catch (error) {
                results.push({ item_id: item.id, membership_id: item.membership_id, applied: false, changes: 0, error: (error as { message?: string }).message ?? 'Could not apply' });
            }
        }
        if (items.length) await this.authorization.invalidate(ctx.organization_id);
        this.events.publish(ctx, { event_key: 'organizations.access_review.applied', module: ModuleKey.ADMINISTRATION, entity_kind: 'access_review', entity_id: id, payload: { applied: results.filter((r) => r.applied).length, failed: results.filter((r) => !r.applied).length } });
        return { applied: results.filter((r) => r.applied).length, failed: results.filter((r) => !r.applied).length, results };
    }

    async complete(ctx: OrgContext, id: string) {
        const review = await this.findOne(ctx, id);
        if (review.status !== AccessReviewStatus.IN_PROGRESS) throw new ConflictException({ message: 'Only a review in progress can be completed', code: 'access_review_not_in_progress' });
        const [pending, unapplied] = await Promise.all([
            this.prisma.accessReviewItem.count({ where: { review_id: id, decision: AccessReviewDecision.PENDING } }),
            this.prisma.accessReviewItem.count({ where: { review_id: id, applied_at: null, decision: { in: [AccessReviewDecision.REVOKED, AccessReviewDecision.MODIFIED] } } }),
        ]);
        if (pending) throw new ConflictException({ message: `${pending} member${pending === 1 ? '' : 's'} still need a decision`, code: 'access_review_pending_items' });
        if (unapplied) throw new ConflictException({ message: `Apply the ${unapplied} revoke / modify decision${unapplied === 1 ? '' : 's'} first`, code: 'access_review_unapplied' });
        await this.prisma.accessReview.update({ where: { id }, data: { status: AccessReviewStatus.COMPLETED, completed_at: new Date() } });
        await this.audit.record(ctx, 'access_review.completed', { resource_type: 'access_review', resource_id: id });
        this.events.publish(ctx, { event_key: 'organizations.access_review.completed', module: ModuleKey.ADMINISTRATION, entity_kind: 'access_review', entity_id: id, payload: { name: review.name } });
        return this.get(ctx, id);
    }

    // ---------------------------------------------------------------------------------------------
    // Items
    // ---------------------------------------------------------------------------------------------

    async items(ctx: OrgContext, reviewId: string, query: AccessReviewItemQuery) {
        await this.findOne(ctx, reviewId);
        const mineOnly = !this.seesAllItems(ctx) || query.mine;
        if (mineOnly && !ctx.membership_id) return paginate([], 0, query);
        const where: Prisma.AccessReviewItemWhereInput = {
            review_id: reviewId,
            ...(mineOnly ? { reviewer_membership_id: ctx.membership_id } : query.reviewer_membership_id ? { reviewer_membership_id: query.reviewer_membership_id } : {}),
            ...(query.decision && { decision: query.decision }),
            ...(query.search && {
                membership: { user: { OR: [{ display_name: { contains: query.search, mode: 'insensitive' } }, { email: { contains: query.search, mode: 'insensitive' } }] } },
            }),
        };
        const [rows, total] = await Promise.all([
            this.prisma.accessReviewItem.findMany({
                where,
                ...skipTake(query),
                orderBy: [{ decision: 'asc' }, { created_at: 'asc' }],
                include: { membership: { select: PERSON }, reviewer: { select: PERSON } },
            }),
            this.prisma.accessReviewItem.count({ where }),
        ]);
        return paginate(rows.map((r) => ({ ...r, can_decide: this.canDecide(ctx, r) })), total, query);
    }

    async decide(ctx: OrgContext, itemId: string, dto: DecideItemInput) {
        const item = await this.findItem(ctx, itemId);
        if (item.review.status !== AccessReviewStatus.IN_PROGRESS) throw new ConflictException({ message: 'The review is not in progress', code: 'access_review_not_in_progress' });
        if (item.membership_id === ctx.membership_id) throw new ForbiddenException({ message: 'You cannot review your own access', code: 'access_review_self' });
        if (!ctx.membership_id || item.reviewer_membership_id !== ctx.membership_id) {
            throw new ForbiddenException({ message: 'This member is not assigned to you', code: 'access_review_not_assigned' });
        }
        if (item.applied_at) throw new ConflictException({ message: 'This decision was already applied', code: 'access_review_item_applied' });

        const snapshot = item.access_snapshot as unknown as AccessSnapshot;
        let requested: RequestedChanges | undefined;
        if (dto.decision === AccessReviewDecision.MODIFIED) {
            requested = dto.changes!;
            const roleIds = new Set(snapshot.roles.map((r) => r.assignment_id));
            const grantIds = new Set(snapshot.grants.map((g) => g.grant_id));
            if (requested.remove_role_assignment_ids.some((rid) => !roleIds.has(rid)) || requested.revoke_grant_ids.some((gid) => !grantIds.has(gid))) {
                throw new BadRequestException({ message: 'Pick changes from the member’s access at review time', code: 'access_review_change_unknown' });
            }
        }
        const { requested_changes: _old, ...rest } = snapshot;
        const access_snapshot = (requested ? { ...rest, requested_changes: requested } : rest) as unknown as Prisma.InputJsonValue;
        const updated = await this.prisma.accessReviewItem.update({
            where: { id: itemId },
            data: { decision: dto.decision, comment: dto.comment ?? null, decided_at: new Date(), access_snapshot },
            include: { membership: { select: PERSON }, reviewer: { select: PERSON } },
        });
        await this.audit.record(ctx, 'access_review.decision_recorded', {
            resource_type: 'access_review_item',
            resource_id: itemId,
            metadata: { review_id: item.review_id, membership_id: item.membership_id, decision: dto.decision, comment: dto.comment ?? null, changes: requested ?? null },
        });
        this.events.publish(ctx, { event_key: 'organizations.access_review.decision_recorded', module: ModuleKey.ADMINISTRATION, entity_kind: 'access_review_item', entity_id: itemId, payload: { review_id: item.review_id, decision: dto.decision } });
        return { ...updated, can_decide: this.canDecide(ctx, updated) };
    }

    /** Managers can hand an item to another reviewer (e.g. unassigned items, or a reviewer on leave). */
    async reassign(ctx: OrgContext, itemId: string, dto: ReassignItemInput) {
        const item = await this.findItem(ctx, itemId);
        if (item.review.status !== AccessReviewStatus.IN_PROGRESS) throw new ConflictException({ message: 'The review is not in progress', code: 'access_review_not_in_progress' });
        if (dto.reviewer_membership_id === item.membership_id) throw new BadRequestException({ message: 'A member cannot review their own access', code: 'access_review_self' });
        const reviewer = await this.access.findMembership(ctx, dto.reviewer_membership_id);
        if (reviewer.status !== MembershipStatus.ACTIVE) throw new BadRequestException({ message: 'The reviewer must be an active member', code: 'membership_not_active' });
        const updated = await this.prisma.accessReviewItem.update({ where: { id: itemId }, data: { reviewer_membership_id: reviewer.id }, include: { membership: { select: PERSON }, reviewer: { select: PERSON } } });
        await this.audit.record(ctx, 'access_review.reviewer_changed', { resource_type: 'access_review_item', resource_id: itemId, metadata: { review_id: item.review_id, from: item.reviewer_membership_id, to: reviewer.id } });
        this.events.publish(ctx, {
            event_key: 'organizations.access_review.reviewer_changed',
            module: ModuleKey.ADMINISTRATION,
            entity_kind: 'access_review_item',
            entity_id: itemId,
            payload: { review_id: item.review_id, assignee_membership_ids: [reviewer.id], link: `/admin/access-reviews/${item.review_id}`, entity_label: item.review.name },
        });
        return { ...updated, can_decide: this.canDecide(ctx, updated) };
    }

    // ---------------------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------------------

    private canDecide(ctx: OrgContext, item: { membership_id: string; reviewer_membership_id: string | null; applied_at: Date | null }) {
        return ctx.can(DECIDE) && !!ctx.membership_id && item.reviewer_membership_id === ctx.membership_id && item.membership_id !== ctx.membership_id && !item.applied_at;
    }

    private async findItem(ctx: OrgContext, itemId: string) {
        const item = await this.prisma.accessReviewItem.findFirst({ where: { id: itemId, review: { organization_id: ctx.organization_id } }, include: { review: true } });
        if (!item) throw new NotFoundException({ message: 'Review item not found', code: 'access_review_item_not_found' });
        await this.findOne(ctx, item.review_id); // visibility
        return item;
    }

    /** Writes the decision through the owning services (audit + cache invalidation happen there). Returns the change count. */
    private async applyItem(ctx: OrgContext, membershipId: string, decision: AccessReviewDecision, snapshot: AccessSnapshot) {
        let changes = 0;
        const activeAssignments = await this.prisma.roleAssignment.findMany({ where: { membership_id: membershipId, revoked_at: null }, select: { id: true } });
        const activeGrants = await this.prisma.permissionGrant.findMany({ where: { membership_id: membershipId, revoked_at: null }, select: { id: true, effect: true } });
        const liveAssignment = new Set(activeAssignments.map((a) => a.id));
        const liveGrant = new Set(activeGrants.map((g) => g.id));

        if (decision === AccessReviewDecision.REVOKED) {
            // Remove every role and every ALLOW grant (explicit denies stay: they only restrict).
            for (const a of activeAssignments) {
                await this.members.removeRole(ctx, membershipId, a.id);
                changes++;
            }
            for (const g of activeGrants.filter((x) => x.effect === 'ALLOW')) {
                await this.permissions.revokeGrant(ctx, g.id);
                changes++;
            }
            return changes;
        }
        const req = snapshot.requested_changes ?? { remove_role_assignment_ids: [], revoke_grant_ids: [], disable_modules: [] };
        for (const aid of req.remove_role_assignment_ids) {
            if (!liveAssignment.has(aid)) continue; // already removed since the snapshot
            await this.members.removeRole(ctx, membershipId, aid);
            changes++;
        }
        for (const gid of req.revoke_grant_ids) {
            if (!liveGrant.has(gid)) continue;
            await this.permissions.revokeGrant(ctx, gid);
            changes++;
        }
        for (const mod of req.disable_modules) {
            await this.members.setModuleAccess(ctx, membershipId, mod, false);
            changes++;
        }
        return changes;
    }

    private async resolveReviewer(
        ctx: OrgContext,
        review: { reviewer_strategy: ReviewerStrategy; reviewer_membership_ids: string[]; created_by_membership_id: string | null },
        member: { id: string; branches: { branch_id: string; is_primary: boolean }[]; teams: { team_id: string }[] },
        cursor: number,
    ): Promise<string | null> {
        const not = (id: string | null | undefined) => (id && id !== member.id ? id : null);
        let reviewer: string | null = null;
        switch (review.reviewer_strategy) {
            case ReviewerStrategy.BRANCH_MANAGERS: {
                const branchIds = [...member.branches].sort((a, b) => Number(b.is_primary) - Number(a.is_primary)).map((b) => b.branch_id);
                if (branchIds.length) {
                    const managers = await this.prisma.branchManager.findMany({
                        where: { branch_id: { in: branchIds }, membership_id: { not: member.id }, membership: { status: MembershipStatus.ACTIVE } },
                        select: { branch_id: true, membership_id: true },
                    });
                    reviewer = branchIds.map((b) => managers.find((m) => m.branch_id === b)?.membership_id).find(Boolean) ?? null;
                }
                break;
            }
            case ReviewerStrategy.TEAM_LEADS: {
                const teamIds = member.teams.map((t) => t.team_id);
                if (teamIds.length) {
                    const lead = await this.prisma.teamMembership.findFirst({
                        where: { team_id: { in: teamIds }, is_lead: true, ended_at: null, membership_id: { not: member.id }, membership: { status: MembershipStatus.ACTIVE } },
                        select: { membership_id: true },
                    });
                    reviewer = lead?.membership_id ?? null;
                }
                break;
            }
            case ReviewerStrategy.LINE_MANAGER: {
                const employee = await this.prisma.employee.findFirst({ where: { membership_id: member.id }, select: { manager: { select: { membership_id: true, membership: { select: { status: true } } } } } });
                reviewer = employee?.manager?.membership.status === MembershipStatus.ACTIVE ? not(employee.manager.membership_id) : null;
                break;
            }
            case ReviewerStrategy.SPECIFIC: {
                const pool = review.reviewer_membership_ids.filter((r) => r !== member.id);
                reviewer = pool.length ? pool[cursor % pool.length] : null;
                break;
            }
        }
        if (reviewer) return reviewer;
        // Fallback (mockup: "members without a manager fall back to an Admin"): the creator, then any owner — never the member.
        const creator = not(review.created_by_membership_id);
        if (creator) return creator;
        const owners = await this.access.ownerMembershipIds(ctx.organization_id);
        return owners.find((o) => o !== member.id) ?? null;
    }

    private async branchTree(ctx: OrgContext, rootId: string) {
        const all = await this.prisma.branch.findMany({ where: { organization_id: ctx.organization_id }, select: { id: true, parent_branch_id: true } });
        const out = new Set([rootId]);
        let grew = true;
        while (grew) {
            grew = false;
            for (const b of all) if (b.parent_branch_id && out.has(b.parent_branch_id) && !out.has(b.id)) { out.add(b.id); grew = true; }
        }
        return [...out];
    }

    private async scopeLabel(ctx: OrgContext, type: ScopeType, id: string | null) {
        if (type === ScopeType.ORGANIZATION || !id) return null;
        if (type === ScopeType.TEAM) return (await this.prisma.team.findFirst({ where: { id, organization_id: ctx.organization_id }, select: { name: true } }))?.name ?? null;
        return (await this.prisma.branch.findFirst({ where: { id, organization_id: ctx.organization_id }, select: { name: true } }))?.name ?? null;
    }

    private async stats(ids: string[], onlyReviewer: string | null) {
        const out = new Map<string, ReturnType<typeof emptyStats>>();
        if (!ids.length) return out;
        const rows = await this.prisma.accessReviewItem.groupBy({
            by: ['review_id', 'decision'],
            where: { review_id: { in: ids }, ...(onlyReviewer && { reviewer_membership_id: onlyReviewer }) },
            _count: { _all: true },
        });
        const unapplied = await this.prisma.accessReviewItem.groupBy({
            by: ['review_id'],
            where: { review_id: { in: ids }, applied_at: null, decision: { in: [AccessReviewDecision.REVOKED, AccessReviewDecision.MODIFIED] }, ...(onlyReviewer && { reviewer_membership_id: onlyReviewer }) },
            _count: { _all: true },
        });
        for (const r of rows) {
            const s = out.get(r.review_id) ?? emptyStats();
            s.total += r._count._all;
            s[r.decision.toLowerCase() as 'pending' | 'certified' | 'revoked' | 'modified'] += r._count._all;
            out.set(r.review_id, s);
        }
        for (const u of unapplied) {
            const s = out.get(u.review_id) ?? emptyStats();
            s.pending_apply = u._count._all;
            out.set(u.review_id, s);
        }
        for (const s of out.values()) s.decided = s.total - s.pending;
        return out;
    }
}

function emptyStats() {
    return { total: 0, decided: 0, pending: 0, certified: 0, revoked: 0, modified: 0, pending_apply: 0 };
}
