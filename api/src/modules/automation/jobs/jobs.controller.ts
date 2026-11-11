import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ScheduledJobStatus } from 'generated/prisma';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { JobsService } from './jobs.service';
import { CreateJobDto, JobQuery, JobQuerySchema, JobRunQuery, JobRunQuerySchema, PreviewScheduleDto, UpdateJobDto } from './dto/job.dto';

@ApiTags('Automation · Scheduled jobs')
@ApiBearerAuth()
@Controller('automation/jobs')
@UseGuards(JwtGuard, PermissionsGuard)
export class JobsController {
    constructor(private readonly jobs: JobsService) { }

    @Get()
    @RequirePermission('automation.jobs.read')
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(JobQuerySchema)) query: JobQuery) {
        return this.jobs.findAll(ctx, query);
    }

    @Get('handlers')
    @RequirePermission('automation.jobs.read')
    @ApiOperation({ summary: 'Registered job handlers (user_creatable ones can be scheduled from the UI)' })
    handlers() {
        return this.jobs.handlerList();
    }

    @Post('preview')
    @RequirePermission('automation.jobs.read')
    @ApiOperation({ summary: 'Next 5 execution times for a schedule' })
    preview(@Body() dto: PreviewScheduleDto) {
        return this.jobs.preview(dto);
    }

    @Post()
    @RequirePermission('automation.jobs.manage')
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateJobDto) {
        return this.jobs.create(ctx, dto);
    }

    @Get(':id')
    @RequirePermission('automation.jobs.read')
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.jobs.findOne(ctx, id);
    }

    @Get(':id/runs')
    @RequirePermission('automation.jobs.read')
    runs(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(JobRunQuerySchema)) query: JobRunQuery) {
        return this.jobs.runs(ctx, id, query);
    }

    @Patch(':id')
    @RequirePermission('automation.jobs.manage')
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateJobDto) {
        return this.jobs.update(ctx, id, dto);
    }

    @Post(':id/pause')
    @RequirePermission('automation.jobs.manage')
    pause(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.jobs.setStatus(ctx, id, ScheduledJobStatus.PAUSED);
    }

    @Post(':id/resume')
    @RequirePermission('automation.jobs.manage')
    resume(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.jobs.setStatus(ctx, id, ScheduledJobStatus.ACTIVE);
    }

    @Post(':id/run-now')
    @RequirePermission('automation.jobs.manage')
    runNow(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.jobs.runNow(ctx, id);
    }

    @Delete(':id')
    @RequirePermission('automation.jobs.manage')
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.jobs.remove(ctx, id);
    }
}
