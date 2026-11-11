import { ForbiddenException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { McpToolCallStatus, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { RedisService } from '@/core/databases/redis/redis.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { AuditService } from '@/shared/audit/audit.service';
import { McpRegistry } from './mcp.registry';

interface JsonRpcRequest {
    jsonrpc: '2.0';
    id?: string | number | null;
    method: string;
    params?: Record<string, any>;
}

const PROTOCOL_VERSION = '2025-06-18';

/** Summarise arguments for the call log: ids, counts and field names only — never bodies or secrets. */
function summarize(args: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(args ?? {})) {
        if (/(^id$|_id$|_ids$)/.test(k)) out[k] = v;
        else if (Array.isArray(v)) out[k] = `[${v.length} items]`;
        else out[k] = typeof v;
    }
    return out;
}

/**
 * MCP server over streamable HTTP (JSON responses). Runs as the caller's own identity (user, API key or
 * service account); the organization always comes from the credential.
 */
@Injectable()
export class McpService {
    constructor(
        private readonly registry: McpRegistry,
        private readonly prisma: PrismaService,
        private readonly authorization: AuthorizationService,
        private readonly audit: AuditService,
        private readonly redis: RedisService,
    ) { }

    /** Validated arguments of a call waiting for human confirmation (Admin → MCP calls re-runs it with them). */
    static pendingArgsKey(callId: string) {
        return `mcp:pending:${callId}`;
    }

    /** Write the call log row; a confirmed re-run updates the waiting row instead of adding a new one. */
    private async logCall(confirmedCallId: string | undefined, data: Prisma.McpToolCallUncheckedCreateInput) {
        if (confirmedCallId) {
            const { organization_id: _o, ...rest } = data;
            await this.prisma.mcpToolCall.update({ where: { id: confirmedCallId }, data: { ...rest, actor_type: undefined, actor_membership_id: undefined } });
            return;
        }
        await this.prisma.mcpToolCall.create({ data });
    }

    async handle(ctx: OrgContext, body: JsonRpcRequest | JsonRpcRequest[], clientName?: string) {
        if (Array.isArray(body)) return Promise.all(body.map((b) => this.handleOne(ctx, b, clientName)));
        return this.handleOne(ctx, body, clientName);
    }

    private async handleOne(ctx: OrgContext, req: JsonRpcRequest, clientName?: string) {
        const id = req.id ?? null;
        try {
            const result = await this.dispatch(ctx, req, clientName);
            if (req.id === undefined) return null; // notification
            return { jsonrpc: '2.0', id, result };
        } catch (error) {
            const message = error instanceof HttpException ? (error.getResponse() as any)?.message ?? error.message : (error as Error).message;
            return { jsonrpc: '2.0', id, error: { code: error instanceof NotFoundException ? -32601 : -32000, message } };
        }
    }

    private async dispatch(ctx: OrgContext, req: JsonRpcRequest, clientName?: string) {
        switch (req.method) {
            case 'initialize':
                return {
                    protocolVersion: PROTOCOL_VERSION,
                    capabilities: { tools: { listChanged: false } },
                    serverInfo: { name: 'logiqdev-os', version: '1.0.0' },
                    instructions: 'Logiqdev OS tools. Every call runs with your own permissions inside your organization.',
                };
            case 'notifications/initialized':
            case 'ping':
                return {};
            case 'tools/list':
                return {
                    tools: this.registry.listFor(ctx).map((t) => ({
                        name: t.name,
                        description: t.description + (t.sensitive ? ' (Sensitive: requires human confirmation when called by an agent.)' : ''),
                        inputSchema: this.registry.jsonSchema(t),
                        annotations: { destructiveHint: !!t.sensitive },
                    })),
                };
            case 'tools/call':
                return this.callTool(ctx, req.params?.name, req.params?.arguments ?? {}, clientName);
            default:
                throw new NotFoundException(`Method ${req.method} not found`);
        }
    }

    async callTool(ctx: OrgContext, name: string, args: Record<string, unknown>, clientName?: string, confirmedCallId?: string) {
        const tool = this.registry.get(name);
        if (!tool) throw new NotFoundException(`Unknown tool ${name}`);
        const started = Date.now();
        const base = {
            organization_id: ctx.organization_id,
            tool_name: tool.name,
            permission_key: tool.permission,
            module: tool.module,
            actor_type: ctx.actor_type,
            api_key_id: ctx.api_key_id,
            service_account_id: ctx.service_account_id,
            actor_membership_id: ctx.membership_id,
            client_name: clientName ?? null,
            resource_type: tool.resource_type ?? null,
            input_summary: summarize(args) as Prisma.InputJsonValue,
            requires_confirmation: !!tool.sensitive,
        };

        if (!ctx.can(tool.permission) || !ctx.effective.modules.includes(tool.module)) {
            await this.prisma.mcpToolCall.create({ data: { ...base, status: McpToolCallStatus.DENIED, error_code: 'permission_denied' } });
            this.audit.recordDenied(ctx, [tool.permission], `mcp:${tool.name}`);
            throw new ForbiddenException(`Missing permission ${tool.permission}`);
        }

        const parsed = tool.input.safeParse(args);
        if (!parsed.success) {
            return { isError: true, content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }] };
        }

        // Non-human callers need a human to confirm sensitive tools (rule §5).
        if (tool.sensitive && ctx.actor_type === 'SERVICE_ACCOUNT' && !confirmedCallId) {
            const call = await this.prisma.mcpToolCall.create({ data: { ...base, status: McpToolCallStatus.AWAITING_CONFIRMATION } });
            await this.redis.set(McpService.pendingArgsKey(call.id), parsed.data, 60 * 60 * 24 * 7);
            return {
                content: [{ type: 'text', text: `This action needs human confirmation. Call id ${call.id} is waiting in Admin → MCP calls.` }],
                structuredContent: { status: 'awaiting_confirmation', call_id: call.id },
            };
        }

        try {
            const result = await tool.handler(ctx, parsed.data);
            await this.logCall(confirmedCallId, { ...base, status: McpToolCallStatus.SUCCEEDED, duration_ms: Date.now() - started });
            return {
                content: [{ type: 'text', text: JSON.stringify(result ?? { ok: true }, null, 2).slice(0, 100_000) }],
                structuredContent: (result && typeof result === 'object' && !Array.isArray(result) ? result : { result }) as Record<string, unknown>,
            };
        } catch (error) {
            const code = error instanceof HttpException ? (error.getResponse() as any)?.code ?? String(error.getStatus()) : 'error';
            await this.logCall(confirmedCallId, { ...base, status: McpToolCallStatus.FAILED, error_code: String(code).slice(0, 100), duration_ms: Date.now() - started });
            const message = error instanceof HttpException ? (error.getResponse() as any)?.message ?? error.message : (error as Error).message;
            return { isError: true, content: [{ type: 'text', text: Array.isArray(message) ? message.join('; ') : String(message) }] };
        }
    }
}
