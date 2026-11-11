import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { SlaPoliciesService } from './sla-policies.service';
import { CreateSlaPolicyDto, UpdateSlaPolicyDto } from './dto/sla-policy.dto';

@ApiTags('Support · SLA policies')
@ApiBearerAuth()
@Controller('support/sla-policies')
@UseGuards(JwtGuard, PermissionsGuard)
export class SlaPoliciesController {
    constructor(private readonly policies: SlaPoliciesService) { }

    @Get()
    @RequireAnyPermission('support.tickets.read', 'support.sla_policies.manage')
    @ApiOperation({ summary: 'List SLA policies with targets' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query('archived') archived?: string) {
        return this.policies.findAll(ctx, archived === 'true');
    }

    @Get(':id')
    @RequireAnyPermission('support.tickets.read', 'support.sla_policies.manage')
    @ApiOperation({ summary: 'Get an SLA policy' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.policies.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('support.sla_policies.manage')
    @ApiOperation({ summary: 'Create an SLA policy' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateSlaPolicyDto) {
        return this.policies.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('support.sla_policies.manage')
    @ApiOperation({ summary: 'Update an SLA policy (targets are replaced when sent)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSlaPolicyDto) {
        return this.policies.update(ctx, id, dto);
    }

    @Post(':id/archive')
    @RequirePermission('support.sla_policies.manage')
    @ApiOperation({ summary: 'Archive an SLA policy' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.policies.archive(ctx, id);
    }

    @Post(':id/restore')
    @RequirePermission('support.sla_policies.manage')
    @ApiOperation({ summary: 'Restore an archived SLA policy' })
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.policies.restore(ctx, id);
    }
}
