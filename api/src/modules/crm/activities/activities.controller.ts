import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { CrmActivitiesService } from './activities.service';
import { ActivityQuery, ActivityQuerySchema, CompleteActivityDto, CreateActivityDto, UpdateActivityDto } from './dto/activity.dto';

@ApiTags('CRM · Activities')
@ApiBearerAuth()
@Controller('crm/activities')
@UseGuards(JwtGuard, PermissionsGuard)
export class CrmActivitiesController {
    constructor(private readonly activities: CrmActivitiesService) { }

    @Get()
    @RequirePermission('crm.activities.read')
    @ApiOperation({ summary: 'List activities (due=overdue|today|upcoming|open, owner=me, record filters)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ActivityQuerySchema)) query: ActivityQuery) {
        return this.activities.findAll(ctx, query);
    }

    @Get('summary')
    @RequirePermission('crm.activities.read')
    @ApiOperation({ summary: "The caller's open, overdue and due-today counts" })
    summary(@CurrentOrg() ctx: OrgContext) {
        return this.activities.summary(ctx);
    }

    @Get(':id')
    @RequirePermission('crm.activities.read')
    @ApiOperation({ summary: 'Get an activity' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.activities.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('crm.activities.create')
    @ApiOperation({ summary: 'Schedule or log an activity' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateActivityDto) {
        return this.activities.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('crm.activities.update')
    @ApiOperation({ summary: 'Update an activity' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateActivityDto) {
        return this.activities.update(ctx, id, dto);
    }

    @Post(':id/complete')
    @RequirePermission('crm.activities.update')
    @ApiOperation({ summary: 'Complete an activity with an optional outcome' })
    complete(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CompleteActivityDto) {
        return this.activities.complete(ctx, id, dto.outcome);
    }

    @Delete(':id')
    @RequirePermission('crm.activities.delete')
    @ApiOperation({ summary: 'Delete an activity (sensitive)' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.activities.remove(ctx, id);
    }
}
