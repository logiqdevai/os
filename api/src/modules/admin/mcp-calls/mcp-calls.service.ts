import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, McpToolCallStatus, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { RedisService } from '@/core/databases/redis/redis.service';
import { McpService } from '@/core/mcp/mcp.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { McpCallQuery } from './dto/mcp-call-query.schema';

const MODULE = ModuleKey.ADMINISTRATION;

/**
 * MCP tool call log (01 §75, §136) and the human confirmation step for sensitive tools called by agents.
 * Confirming re-runs the tool AS THE ORIGINAL CALLER (service account / API key, narrowed by its scopes) with the
 * arguments saved when the call was parked; the confirmer must hold the tool's permission themselves.
 */
@Injectable()
export class McpCallsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
        private readonly mcp: McpService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly authorization: AuthorizationService,
    ) { }

    async findAll(ctx: OrgContext, query: McpCallQuery) {
        const where: Prisma.McpToolCallWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.status && { status: query.status }),
            ...(query.tool_name && { tool_name: query.tool_name }),
            ...(query.service_account_id && { service_account_id: query.service_account_id }),
            ...(query.api_key_id && { api_key_id: query.api_key_id }),
            ...(query.search && { OR: [{ tool_name: { contains: query.search, mode: 'insensitive' } }, { client_name: { contains: query.search, mode: 'insensitive' } }] }),
            ...((query.from || query.to) && { created_at: { ...(query.from && { gte: query.from }), ...(query.to && { lte: query.to }) } }),
        };
        const [items, total, awaiting] = await Promise.all([
            this.prisma.mcpToolCall.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['created_at', 'duration_ms'], 'created_at'),
                include: {
                    service_account: { select: { id: true, name: true } },
                    api_key: { select: { id: true, name: true, key_prefix: true } },
                },
            }),
            this.prisma.mcpToolCall.count({ where }),
            this.prisma.mcpToolCall.count({ where: { organization_id: ctx.organization_id, status: McpToolCallStatus.AWAITING_CONFIRMATION } }),
        ]);
        const memberIds = [...new Set(items.flatMap((i) => [i.actor_membership_id, i.confirmed_by_membership_id]).filter(Boolean) as string[])];
        const members = memberIds.length
            ? await this.prisma.membership.findMany({ where: { id: { in: memberIds }, organization_id: ctx.organization_id }, select: { id: true, user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } })
            : [];
        const name = (id: string | null) => (id ? members.find((m) => m.id === id)?.user ?? null : null);
        const data = items.map((i) => ({
            ...i,
            actor_member: name(i.actor_membership_id),
            confirmed_by: name(i.confirmed_by_membership_id),
            can_decide: i.status === McpToolCallStatus.AWAITING_CONFIRMATION && (!i.permission_key || ctx.can(i.permission_key)),
        }));
        return { ...paginate(data, total, query), awaiting_confirmation: awaiting };
    }

    private async pending(ctx: OrgContext, id: string) {
        const call = await this.prisma.mcpToolCall.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!call) throw new NotFoundException({ message: 'Call not found', code: 'mcp_call_not_found' });
        if (call.status !== McpToolCallStatus.AWAITING_CONFIRMATION) {
            throw new ConflictException({ message: `This call is ${call.status.toLowerCase().replace('_', ' ')}`, code: 'mcp_call_not_pending' });
        }
        if (call.permission_key && !ctx.can(call.permission_key)) {
            throw new ForbiddenException({ message: `Only someone holding ${call.permission_key} can decide this call`, code: 'permission_denied', permissions: [call.permission_key] });
        }
        return call;
    }

    async confirm(ctx: OrgContext, id: string) {
        const call = await this.pending(ctx, id);
        const args = await this.redis.get<Record<string, unknown>>(McpService.pendingArgsKey(id));
        if (!args) {
            await this.prisma.mcpToolCall.update({ where: { id }, data: { status: McpToolCallStatus.EXPIRED, error_code: 'arguments_expired' } });
            throw new ConflictException({ message: 'The call expired before it was confirmed. Ask the agent to run it again.', code: 'mcp_call_expired' });
        }
        // Rebuild the ORIGINAL caller's context — never the confirmer's, so the agent cannot gain the confirmer's access.
        const actor = await this.authorization.contextFor({
            organization_id: ctx.organization_id,
            membership_id: call.service_account_id ? null : call.actor_membership_id,
            service_account_id: call.service_account_id,
            channel: 'mcp',
        });
        if (call.api_key_id) {
            const key = await this.prisma.apiKey.findFirst({ where: { id: call.api_key_id, organization_id: ctx.organization_id }, select: { scopes: true, revoked_at: true } });
            if (!key || key.revoked_at) throw new ConflictException({ message: 'The API key used for this call was revoked', code: 'api_key_revoked' });
            actor.api_key_id = call.api_key_id;
            actor.effective = this.authorization.narrowByScopes(actor.effective, key.scopes);
        }
        await this.prisma.mcpToolCall.update({ where: { id }, data: { confirmed_by_membership_id: ctx.membership_id, confirmed_at: new Date() } });
        const result = await this.mcp.callTool(actor, call.tool_name, args, call.client_name ?? undefined, id);
        await this.redis.del(McpService.pendingArgsKey(id));
        await this.audit.record(ctx, 'mcp_call.confirmed', { resource_type: 'mcp_tool_call', resource_id: id, metadata: { tool_name: call.tool_name, service_account_id: call.service_account_id, api_key_id: call.api_key_id } });
        this.events.publish(ctx, { event_key: 'organizations.mcp_call.confirmed', module: MODULE, entity_kind: 'mcp_tool_call', entity_id: id, payload: { tool_name: call.tool_name } });
        const updated = await this.prisma.mcpToolCall.findUnique({ where: { id } });
        return { call: updated, result };
    }

    async reject(ctx: OrgContext, id: string) {
        const call = await this.pending(ctx, id);
        const updated = await this.prisma.mcpToolCall.update({ where: { id }, data: { status: McpToolCallStatus.REJECTED, rejected_at: new Date(), confirmed_by_membership_id: ctx.membership_id } });
        await this.redis.del(McpService.pendingArgsKey(id));
        await this.audit.record(ctx, 'mcp_call.rejected', { resource_type: 'mcp_tool_call', resource_id: id, metadata: { tool_name: call.tool_name, service_account_id: call.service_account_id, api_key_id: call.api_key_id } });
        this.events.publish(ctx, { event_key: 'organizations.mcp_call.rejected', module: MODULE, entity_kind: 'mcp_tool_call', entity_id: id, payload: { tool_name: call.tool_name } });
        return updated;
    }
}
