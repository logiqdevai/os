import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { CrmPipelinesService } from './pipelines.service';
import { CreatePipelineDto, ReplaceStagesDto, UpdatePipelineDto } from './dto/pipeline.dto';

@ApiTags('CRM · Pipelines')
@ApiBearerAuth()
@Controller('crm/pipelines')
@UseGuards(JwtGuard, PermissionsGuard)
export class CrmPipelinesController {
    constructor(private readonly pipelines: CrmPipelinesService) { }

    @Get()
    @RequireAnyPermission('crm.deals.read', 'crm.pipelines.manage', 'crm.forecast.read', 'crm.dashboards.read')
    @ApiOperation({ summary: 'List pipelines with their ordered stages (creates the default pipeline on first use)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query('archived') archived?: string) {
        return this.pipelines.findAll(ctx, archived === 'true' && ctx.can('crm.pipelines.manage'));
    }

    @Get(':id')
    @RequireAnyPermission('crm.deals.read', 'crm.pipelines.manage')
    @ApiOperation({ summary: 'Get a pipeline with stages' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.pipelines.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('crm.pipelines.manage')
    @ApiOperation({ summary: 'Create a pipeline (default stages when none are given)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreatePipelineDto) {
        return this.pipelines.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('crm.pipelines.manage')
    @ApiOperation({ summary: 'Update a pipeline' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePipelineDto) {
        return this.pipelines.update(ctx, id, dto);
    }

    @Put(':id/stages')
    @RequirePermission('crm.pipelines.manage')
    @ApiOperation({ summary: 'Replace the ordered stage list (exactly one won and one lost stage)' })
    replaceStages(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplaceStagesDto) {
        return this.pipelines.replaceStages(ctx, id, dto.stages);
    }

    @Post(':id/archive')
    @RequirePermission('crm.pipelines.manage')
    @ApiOperation({ summary: 'Archive a pipeline without open deals' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.pipelines.archive(ctx, id);
    }
}
