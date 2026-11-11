import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { MEMBER_SELECT, SUPPORT_PERMS } from '../common/support.constants';
import { CannedQuery, CreateCannedResponseDto, RenderCannedResponseDto, UpdateCannedResponseDto } from './dto/canned-response.dto';

/**
 * Saved replies and macros (13 §1). ORGANIZATION and TEAM responses need support.canned_responses.manage;
 * PERSONAL responses belong to their owner and need only support.conversations.reply.
 */
@Injectable()
export class CannedResponsesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    private async visibleWhere(ctx: OrgContext): Promise<Prisma.SupportCannedResponseWhereInput> {
        const teams = ctx.membership_id ? await this.prisma.teamMembership.findMany({ where: { membership_id: ctx.membership_id, ended_at: null }, select: { team_id: true } }) : [];
        return {
            organization_id: ctx.organization_id,
            archived_at: null,
            OR: [
                { scope: 'ORGANIZATION' },
                { scope: 'TEAM', ...(ctx.can(SUPPORT_PERMS.cannedManage) ? {} : { team_id: { in: teams.map((t) => t.team_id) } }) },
                { scope: 'PERSONAL', owner_membership_id: ctx.membership_id ?? '__none__' },
            ],
        };
    }

    async findAll(ctx: OrgContext, q: CannedQuery) {
        const where: Prisma.SupportCannedResponseWhereInput = {
            AND: [
                await this.visibleWhere(ctx),
                q.scope ? { scope: q.scope } : {},
                q.category ? { category: q.category } : {},
                q.search ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { shortcut: { contains: q.search, mode: 'insensitive' } }, { body: { contains: q.search, mode: 'insensitive' } }] } : {},
            ],
        };
        const [rows, total, categories] = await Promise.all([
            this.prisma.supportCannedResponse.findMany({ where, ...skipTake(q), orderBy: [{ usage_count: 'desc' }, { name: 'asc' }], include: { team: { select: { id: true, name: true } }, owner: { select: MEMBER_SELECT } } }),
            this.prisma.supportCannedResponse.count({ where }),
            this.prisma.supportCannedResponse.findMany({ where: { organization_id: ctx.organization_id, archived_at: null, category: { not: null } }, distinct: ['category'], select: { category: true } }),
        ]);
        return { ...paginate(rows, total, q), categories: categories.map((c) => c.category).filter(Boolean) };
    }

    async findOne(ctx: OrgContext, id: string) {
        const row = await this.prisma.supportCannedResponse.findFirst({ where: { AND: [{ id }, await this.visibleWhere(ctx)] }, include: { team: { select: { id: true, name: true } }, owner: { select: MEMBER_SELECT } } });
        if (!row) throw new NotFoundException({ message: 'Canned response not found', code: 'canned_response_not_found' });
        return row;
    }

    async create(ctx: OrgContext, dto: CreateCannedResponseDto) {
        const scope = dto.scope ?? (ctx.can(SUPPORT_PERMS.cannedManage) ? 'ORGANIZATION' : 'PERSONAL');
        this.assertCanManage(ctx, scope);
        if (scope === 'TEAM' && !dto.team_id) throw new BadRequestException({ message: 'Pick the team for a team response', code: 'canned_team_required' });
        if (dto.team_id) await this.prisma.team.findFirstOrThrow({ where: { id: dto.team_id, organization_id: ctx.organization_id } }).catch(() => { throw new NotFoundException({ message: 'Team not found', code: 'team_not_found' }); });
        try {
            const row = await this.prisma.supportCannedResponse.create({
                data: {
                    organization_id: ctx.organization_id,
                    scope,
                    team_id: scope === 'TEAM' ? dto.team_id : null,
                    owner_membership_id: scope === 'PERSONAL' ? ctx.membership_id : null,
                    name: dto.name,
                    shortcut: dto.shortcut ?? null,
                    category: dto.category ?? null,
                    body: dto.body,
                    actions: (dto.actions ?? undefined) as Prisma.InputJsonValue,
                },
            });
            await this.audit.record(ctx, 'support_canned_response.created', { resource_type: 'support_canned_response', resource_id: row.id, metadata: { scope, name: row.name } });
            this.events.publish(ctx, { event_key: 'support.canned_response.created', module: ModuleKey.SUPPORT, entity_kind: 'support_canned_response', entity_id: row.id, payload: { name: row.name, scope } });
            return row;
        } catch (e) {
            this.rethrow(e);
        }
    }

    async update(ctx: OrgContext, id: string, dto: UpdateCannedResponseDto) {
        const before = await this.findOne(ctx, id);
        this.assertCanManage(ctx, before.scope, before.owner_membership_id);
        if (dto.scope && dto.scope !== before.scope) this.assertCanManage(ctx, dto.scope);
        try {
            const { actions, ...rest } = dto;
            const row = await this.prisma.supportCannedResponse.update({
                where: { id },
                data: {
                    ...rest,
                    ...(dto.scope === 'PERSONAL' && { owner_membership_id: ctx.membership_id, team_id: null }),
                    ...(dto.scope === 'ORGANIZATION' && { owner_membership_id: null, team_id: null }),
                    ...(actions !== undefined && { actions: actions as Prisma.InputJsonValue }),
                },
            });
            await this.audit.record(ctx, 'support_canned_response.updated', { resource_type: 'support_canned_response', resource_id: id, metadata: { before: { name: before.name, scope: before.scope }, after: dto } });
            return row;
        } catch (e) {
            this.rethrow(e);
        }
    }

    async remove(ctx: OrgContext, id: string) {
        const before = await this.findOne(ctx, id);
        this.assertCanManage(ctx, before.scope, before.owner_membership_id);
        await this.prisma.supportCannedResponse.update({ where: { id }, data: { archived_at: new Date(), shortcut: null } });
        await this.audit.record(ctx, 'support_canned_response.archived', { resource_type: 'support_canned_response', resource_id: id, metadata: { name: before.name } });
        return { success: true };
    }

    /** Fill placeholders for a conversation or ticket. Unknown placeholders are left empty. */
    async render(ctx: OrgContext, id: string, dto: RenderCannedResponseDto) {
        const canned = await this.findOne(ctx, id);
        const [org, agent] = await Promise.all([
            this.prisma.organization.findUnique({ where: { id: ctx.organization_id }, select: { display_name: true } }),
            ctx.membership_id ? this.prisma.membership.findUnique({ where: { id: ctx.membership_id }, select: { user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } }) : null,
        ]);
        let customerName: string | null = null;
        let reference: string | null = null;
        if (dto.ticket_id) {
            const t = await this.prisma.ticket.findFirst({ where: { id: dto.ticket_id, organization_id: ctx.organization_id }, select: { reference: true, requester_name: true } });
            reference = t?.reference ?? null;
            customerName = t?.requester_name ?? null;
        }
        if (dto.conversation_id) {
            const c = await this.prisma.supportConversation.findFirst({ where: { id: dto.conversation_id, organization_id: ctx.organization_id }, select: { customer_name: true, primary_tickets: { select: { reference: true }, take: 1 } } });
            customerName = customerName ?? c?.customer_name ?? null;
            reference = reference ?? c?.primary_tickets[0]?.reference ?? null;
        }
        const u = agent?.user;
        const values: Record<string, string> = {
            'customer.name': customerName ?? 'there',
            'customer.first_name': customerName?.split(/\s+/)[0] ?? 'there',
            'ticket.reference': reference ?? '',
            'agent.name': u?.display_name || [u?.first_name, u?.last_name].filter(Boolean).join(' ') || '',
            'agent.first_name': u?.first_name ?? '',
            'organization.name': org?.display_name ?? '',
        };
        const body = canned.body.replace(/\{\{\s*([a-z_.]+)\s*\}\}/gi, (_, key: string) => values[key] ?? '');
        return { id: canned.id, body, actions: canned.actions };
    }

    private assertCanManage(ctx: OrgContext, scope: string, ownerId?: string | null) {
        if (scope === 'PERSONAL') {
            if (ownerId && ownerId !== ctx.membership_id) throw new ForbiddenException({ message: 'Only the owner can change a personal response', code: 'canned_not_owner' });
            return;
        }
        if (!ctx.can(SUPPORT_PERMS.cannedManage)) throw new ForbiddenException({ message: 'Shared responses need support.canned_responses.manage', code: 'permission_denied', permissions: [SUPPORT_PERMS.cannedManage] });
    }

    private rethrow(e: unknown): never {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ message: 'This shortcut is already used', code: 'canned_shortcut_taken' });
        throw e;
    }
}
