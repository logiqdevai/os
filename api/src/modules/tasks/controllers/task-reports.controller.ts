import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { TaskReportsService } from '../services/task-reports.service';
import { TaskReportQuery, TaskReportQuerySchema } from '../dto/task-reports.schema';

/** 06 §11 — reports. Registered before TasksController so `/tasks/reports` is not read as a task key. */
@ApiTags('Tasks · Reports')
@ApiBearerAuth()
@Controller('tasks/reports')
@UseGuards(JwtGuard, PermissionsGuard)
export class TaskReportsController {
    constructor(private readonly reports: TaskReportsService) { }

    @Get()
    @RequirePermission('tasks.tasks.read')
    @ApiOperation({ summary: 'Throughput, created vs completed, lead / cycle time, breakdowns by assignee / label / priority and a cycle burn-up (caller scope)' })
    report(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TaskReportQuerySchema)) query: TaskReportQuery) {
        return this.reports.report(ctx, query);
    }
}
