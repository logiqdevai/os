import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { AuditLogService, AuditQuery, AuditQuerySchema } from './audit-log.service';

@ApiTags('Admin · Audit log')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtGuard, PermissionsGuard)
export class AuditLogController {
    constructor(private readonly audit: AuditLogService) { }

    @Get('audit-events')
    @RequirePermission('organizations.audit.read')
    @ApiOperation({ summary: 'Audit events, newest first (filters: event type, actor, resource, outcome, date)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(AuditQuerySchema)) query: AuditQuery) {
        return this.audit.findAll(ctx, query);
    }

    @Get('audit-events/:id')
    @RequirePermission('organizations.audit.read')
    @ApiOperation({ summary: 'One audit event with related events on the same resource' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.audit.findOne(ctx, id);
    }

    @Get('audit-event-types')
    @RequirePermission('organizations.audit.read')
    @ApiOperation({ summary: 'Catalog of module 01 audit event types' })
    types() {
        return this.audit.types();
    }
}
