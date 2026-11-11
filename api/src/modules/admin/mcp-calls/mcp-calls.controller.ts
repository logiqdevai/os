import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { McpCallsService } from './mcp-calls.service';
import { McpCallQuery, McpCallQuerySchema } from './dto/mcp-call-query.schema';

@ApiTags('Admin · MCP calls')
@ApiBearerAuth()
@Controller('mcp-calls')
@UseGuards(JwtGuard, PermissionsGuard)
export class McpCallsController {
    constructor(private readonly calls: McpCallsService) { }

    @Get()
    @RequirePermission('organizations.mcp_calls.read')
    @ApiOperation({ summary: 'MCP tool call log (with the count waiting for confirmation)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(McpCallQuerySchema)) query: McpCallQuery) {
        return this.calls.findAll(ctx, query);
    }

    @Post(':id/confirm')
    @HttpCode(200)
    @RequirePermission('organizations.mcp_calls.read')
    @ApiOperation({ summary: 'Confirm a parked sensitive call; it runs as the original caller. The confirmer also needs the tool permission.' })
    confirm(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.calls.confirm(ctx, id);
    }

    @Post(':id/reject')
    @HttpCode(200)
    @RequirePermission('organizations.mcp_calls.read')
    @ApiOperation({ summary: 'Reject a parked call. The confirmer also needs the tool permission.' })
    reject(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.calls.reject(ctx, id);
    }
}
