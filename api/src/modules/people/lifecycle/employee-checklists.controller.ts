import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { P } from '../common/people.utils';
import { EmployeeChecklistsService } from './employee-checklists.service';

export class StartEmployeeChecklistDto {
    @ApiProperty() @IsUUID() checklist_id: string;
    @ApiPropertyOptional() @IsOptional() @IsDateString() due_at?: string;
}

const uuid = new ParseUUIDPipe();

@ApiTags('People · Onboarding & offboarding')
@ApiBearerAuth()
@Controller('people')
@UseGuards(JwtGuard, PermissionsGuard)
export class EmployeeChecklistsController {
    constructor(private readonly checklists: EmployeeChecklistsService) { }

    @Get('checklists')
    @RequireAnyPermission(P.update, P.offboard)
    @ApiOperation({ summary: 'Active onboarding / offboarding checklists (15) that can be started for an employee' })
    available(@CurrentOrg() ctx: OrgContext, @Query('kind') kind: string) {
        return this.checklists.available(ctx, EmployeeChecklistsService.assertKind(kind ?? 'ONBOARDING'));
    }

    @Get('employees/:id/checklist-runs')
    @RequireAnyPermission(P.read, P.directoryRead)
    @ApiOperation({ summary: 'Onboarding / offboarding checklist runs of an employee with progress' })
    list(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.checklists.list(ctx, id);
    }

    @Post('employees/:id/checklist-runs')
    @RequireAnyPermission(P.update, P.offboard)
    @ApiOperation({ summary: 'Start a checklist for the employee (onboarding: employees.update, offboarding: employees.offboard)' })
    start(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: StartEmployeeChecklistDto) {
        return this.checklists.start(ctx, id, dto);
    }

    @Post('employees/:id/checklist-runs/:runId/items/:itemId/complete')
    @RequireAnyPermission(P.read, P.directoryRead)
    @ApiOperation({ summary: 'Complete a checklist item (checklist managers, the employee, or the item assignee)' })
    complete(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Param('runId', uuid) runId: string, @Param('itemId', uuid) itemId: string) {
        return this.checklists.setItem(ctx, id, runId, itemId, true);
    }

    @Post('employees/:id/checklist-runs/:runId/items/:itemId/reopen')
    @RequireAnyPermission(P.read, P.directoryRead)
    reopen(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Param('runId', uuid) runId: string, @Param('itemId', uuid) itemId: string) {
        return this.checklists.setItem(ctx, id, runId, itemId, false);
    }
}
