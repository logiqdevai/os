import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireOrgMember, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { RunsService } from './runs.service';
import { ApprovalQuery, ApprovalQuerySchema, DecideApprovalDto, EventQuery, EventQuerySchema, PublishEventDto, RunQuery, RunQuerySchema } from './dto/run.dto';

class RetryRunDto {
    @IsOptional() @IsInt() @Min(0)
    from_step?: number;
}

@ApiTags('Automation · Runs & events')
@ApiBearerAuth()
@Controller('automation')
@UseGuards(JwtGuard, PermissionsGuard)
export class RunsController {
    constructor(private readonly runs: RunsService) { }

    @Get('runs')
    @RequirePermission('automation.runs.read')
    @ApiOperation({ summary: 'Run history (filter by status, workflow, record, date)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(RunQuerySchema)) query: RunQuery) {
        return this.runs.findAll(ctx, query);
    }

    @Get('runs/:id')
    @RequirePermission('automation.runs.read')
    @ApiOperation({ summary: 'One run with steps, approvals and deliveries' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.runs.findOne(ctx, id);
    }

    @Post('runs/:id/retry')
    @RequirePermission('automation.runs.manage')
    @ApiOperation({ summary: 'Retry a failed / dead-lettered run from the failed step' })
    retry(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RetryRunDto) {
        return this.runs.retry(ctx, id, dto.from_step);
    }

    @Post('runs/:id/cancel')
    @RequirePermission('automation.runs.manage')
    @ApiOperation({ summary: 'Cancel a pending, waiting or retrying run' })
    cancel(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.runs.cancel(ctx, id);
    }

    @Get('dead-letter')
    @RequirePermission('automation.runs.read')
    @ApiOperation({ summary: 'Dead-letter queue: runs, deliveries, events and job runs that exhausted retries' })
    deadLetter(@CurrentOrg() ctx: OrgContext) {
        return this.runs.deadLetter(ctx);
    }

    @Get('approvals')
    @RequireOrgMember()
    @ApiOperation({ summary: 'Approvals: your own requests, or all with automation.runs.read' })
    approvals(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ApprovalQuerySchema)) query: ApprovalQuery) {
        return this.runs.approvals(ctx, query);
    }

    @Post('approvals/:id/decide')
    @RequireOrgMember()
    @ApiOperation({ summary: 'Approve or reject (only the requested approver; never an agent)' })
    decide(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideApprovalDto) {
        return this.runs.decide(ctx, id, dto);
    }

    @Get('events')
    @RequirePermission('automation.runs.read')
    @ApiOperation({ summary: 'Event bus log' })
    events(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(EventQuerySchema)) query: EventQuery) {
        return this.runs.eventLog(ctx, query);
    }

    @Post('events')
    @RequirePermission('automation.runs.manage')
    @ApiOperation({ summary: 'Publish a custom.* event on the bus (external systems, agents)' })
    publish(@CurrentOrg() ctx: OrgContext, @Body() dto: PublishEventDto) {
        return this.runs.publishCustom(ctx, dto);
    }

    @Get('events/:id')
    @RequirePermission('automation.runs.read')
    @ApiOperation({ summary: 'One event with the runs and deliveries it caused' })
    event(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.runs.event(ctx, id);
    }

    @Post('events/:id/reprocess')
    @RequirePermission('automation.runs.manage')
    @ApiOperation({ summary: 'Match the event against workflows again (idempotent per workflow)' })
    reprocess(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.runs.reprocess(ctx, id);
    }
}
