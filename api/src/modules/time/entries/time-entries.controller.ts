import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { TimeEntriesService } from './time-entries.service';
import { CreateTimeEntryDto, MarkInvoicedDto, OptionalReasonDto, ReasonDto, UpdateTimeEntryDto, WeekGridDto } from './dto/time-entry.dto';
import { TimeEntryQuery, TimeEntryQuerySchema } from './dto/time-entry-query.schema';
import { TIME_ANY_READ } from '../common/time-permissions';

/** /time/entries — scope (own / team / all) is enforced in the service, never by the route alone. */
@ApiTags('Time · Entries')
@ApiBearerAuth()
@Controller('time/entries')
@UseGuards(JwtGuard, PermissionsGuard)
export class TimeEntriesController {
    constructor(private readonly entries: TimeEntriesService) { }

    @Get()
    @RequireAnyPermission(...TIME_ANY_READ)
    @ApiOperation({ summary: 'List time entries (scope=mine|team|all, capped at the caller\'s read key)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TimeEntryQuerySchema)) query: TimeEntryQuery) {
        return this.entries.findAll(ctx, query);
    }

    @Put('bulk')
    @RequireAnyPermission('time.entries.update_own', 'time.entries.update_team')
    @ApiOperation({ summary: 'Save the week grid (one cell = one entry; 0 removes)' })
    saveWeek(@CurrentOrg() ctx: OrgContext, @Body() dto: WeekGridDto) {
        return this.entries.saveWeek(ctx, dto);
    }

    @Post('mark-invoiced')
    @RequirePermission('finance.invoices.create')
    @ApiOperation({ summary: 'Mark approved billable entries as invoiced (called by 08 Billing)' })
    markInvoiced(@CurrentOrg() ctx: OrgContext, @Body() dto: MarkInvoicedDto) {
        return this.entries.markInvoiced(ctx, dto);
    }

    @Get(':id')
    @RequireAnyPermission(...TIME_ANY_READ)
    @ApiOperation({ summary: 'Get a time entry' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.entries.findOne(ctx, id);
    }

    @Post()
    @RequireAnyPermission('time.entries.create_own', 'time.entries.create_team')
    @ApiOperation({ summary: 'Log time (own, or for a team member with create_team)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateTimeEntryDto) {
        return this.entries.create(ctx, dto);
    }

    @Patch(':id')
    @RequireAnyPermission('time.entries.update_own', 'time.entries.update_team')
    @ApiOperation({ summary: 'Edit a draft or rejected entry' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTimeEntryDto) {
        return this.entries.update(ctx, id, dto);
    }

    @Delete(':id')
    @RequireAnyPermission('time.entries.delete_own', 'time.entries.update_team')
    @ApiOperation({ summary: 'Delete a draft or rejected entry (soft delete)' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.entries.remove(ctx, id);
    }

    @Post(':id/approve')
    @RequirePermission('time.entries.approve')
    @ApiOperation({ summary: 'Approve a single entry' })
    approve(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OptionalReasonDto) {
        return this.entries.decide(ctx, id, true, dto.reason);
    }

    @Post(':id/reject')
    @RequirePermission('time.entries.approve')
    @ApiOperation({ summary: 'Reject a single entry (reason required)' })
    reject(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
        return this.entries.decide(ctx, id, false, dto.reason);
    }

    @Post(':id/unlock')
    @RequirePermission('time.entries.unlock')
    @ApiOperation({ summary: 'Unlock an approved / locked entry (reason required)' })
    unlock(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
        return this.entries.unlock(ctx, id, dto.reason);
    }
}
