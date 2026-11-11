import { Body, CanActivate, Controller, ExecutionContext, Get, Headers, HttpCode, Injectable, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireOrgMember } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { McpService } from './mcp.service';
import { McpRegistry } from './mcp.registry';

/** Marks the request channel as `mcp` before PermissionsGuard builds the context. */
@Injectable()
class McpChannelGuard implements CanActivate {
    canActivate(context: ExecutionContext) {
        context.switchToHttp().getRequest().lqChannel = 'mcp';
        return true;
    }
}

/** MCP endpoint. Each tool call is permission-checked inside McpService against the tool's own key. */
@ApiTags('MCP')
@ApiBearerAuth()
@Controller('mcp')
@UseGuards(JwtGuard, McpChannelGuard, PermissionsGuard)
export class McpController {
    constructor(
        private readonly mcp: McpService,
        private readonly registry: McpRegistry,
    ) { }

    @Post()
    @HttpCode(200)
    @RequireOrgMember()
    @ApiOperation({ summary: 'MCP JSON-RPC endpoint (initialize, tools/list, tools/call)' })
    handle(@CurrentOrg() ctx: OrgContext, @Body() body: any, @Headers('x-mcp-client') client?: string) {
        return this.mcp.handle(ctx, body, client);
    }

    @Get('tools')
    @RequireOrgMember()
    @ApiOperation({ summary: 'Tools visible to the caller (for the admin UI)' })
    tools(@CurrentOrg() ctx: OrgContext) {
        return this.registry.listFor(ctx).map((t) => ({ name: t.name, description: t.description, permission: t.permission, module: t.module, sensitive: !!t.sensitive }));
    }
}
