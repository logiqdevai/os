import { Injectable } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';

export interface McpTool<S extends z.ZodTypeAny = z.ZodTypeAny> {
    /** `<module>_<resource>_<action>`, e.g. `crm_deals_update`. */
    name: string;
    description: string;
    /** Permission key checked by the central authorization service before the handler runs. */
    permission: string;
    module: ModuleKey;
    /** Same zod schema the REST endpoint uses (or a thin wrapper of it). */
    input: S;
    /** Deletes, sends, payments, approvals, permission changes: an AI agent needs human confirmation. */
    sensitive?: boolean;
    /** Resource type for the call log (e.g. `crm_deal`). */
    resource_type?: string;
    handler: (ctx: OrgContext, args: z.infer<S>) => Promise<unknown>;
}

/**
 * Registry of MCP tools. Feature modules register their tools in `onModuleInit` and call the same service
 * methods as their REST controllers (roles-and-permissions rule §5).
 */
@Injectable()
export class McpRegistry {
    private readonly tools = new Map<string, McpTool>();

    register<S extends z.ZodTypeAny>(tool: McpTool<S>) {
        if (this.tools.has(tool.name)) throw new Error(`MCP tool ${tool.name} registered twice`);
        this.tools.set(tool.name, tool as unknown as McpTool);
    }

    registerMany(tools: McpTool<any>[]) {
        tools.forEach((t) => this.register(t));
    }

    get(name: string): McpTool | undefined {
        return this.tools.get(name);
    }

    /** Only tools whose permission the caller holds (and whose module is enabled). */
    listFor(ctx: OrgContext): McpTool[] {
        return [...this.tools.values()].filter((t) => ctx.can(t.permission) && ctx.effective.modules.includes(t.module));
    }

    all(): McpTool[] {
        return [...this.tools.values()];
    }

    jsonSchema(tool: McpTool) {
        try {
            const schema = z.toJSONSchema(tool.input, { unrepresentable: 'any' }) as Record<string, unknown>;
            delete schema.$schema;
            return schema;
        } catch {
            return { type: 'object' };
        }
    }
}
