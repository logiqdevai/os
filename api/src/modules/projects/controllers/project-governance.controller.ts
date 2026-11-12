import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ProjectGovernanceService } from '../services/project-governance.service';
import {
    AcceptHandoverInput,
    AcceptHandoverSchema,
    ChecklistItemInput,
    ChecklistItemSchema,
    CreateChecklistInput,
    CreateChecklistSchema,
    CreateGateInput,
    CreateGateSchema,
    CreateHandoverInput,
    CreateHandoverSchema,
    CreateReviewInput,
    CreateReviewSchema,
    DecideGateInput,
    DecideGateSchema,
    UpdateChecklistInput,
    UpdateChecklistItemInput,
    UpdateChecklistItemSchema,
    UpdateChecklistSchema,
    UpdateCloseoutInput,
    UpdateCloseoutSchema,
    UpdateGateInput,
    UpdateGateSchema,
    UpdateHandoverInput,
    UpdateHandoverSchema,
    UpdateReviewInput,
    UpdateReviewSchema,
} from '../dto/project-governance.schema';

const Uuid = (name: string) => Param(name, ParseUUIDPipe);

/**
 * 05 §46–49, §71–74, §92–94, §102–103 — gates, reviews, checklists, handovers, closeout of one project.
 * Reads: projects.projects.read · edits: projects.projects.update · gate decisions: projects.gates.decide* ·
 * close: projects.projects.complete · accept a handover: the receiving owner/team (checked in the service).
 */
@ApiTags('Projects · Governance & closeout')
@ApiBearerAuth()
@Controller('projects/:projectId')
@UseGuards(JwtGuard, PermissionsGuard)
export class ProjectGovernanceController {
    constructor(private readonly gov: ProjectGovernanceService) { }

    // --- gates ---

    @Get('gates') @RequirePermission('projects.projects.read') @ApiOperation({ summary: 'Approval and quality gates' })
    listGates(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string) { return this.gov.listGates(ctx, pid); }

    @Post('gates') @RequirePermission('projects.projects.update') @ApiOperation({ summary: 'Add a gate (an approver is notified)' })
    createGate(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string, @Body(new ZodValidationPipe(CreateGateSchema)) dto: CreateGateInput) { return this.gov.createGate(ctx, pid, dto); }

    @Patch('gates/:id') @RequirePermission('projects.projects.update') @ApiOperation({ summary: 'Edit a gate (not its decision)' })
    updateGate(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string, @Uuid('id') id: string, @Body(new ZodValidationPipe(UpdateGateSchema)) dto: UpdateGateInput) { return this.gov.updateGate(ctx, pid, id, dto); }

    @Delete('gates/:id') @RequirePermission('projects.projects.update') @ApiOperation({ summary: 'Delete a gate' })
    removeGate(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string, @Uuid('id') id: string) { return this.gov.removeGate(ctx, pid, id); }

    @Post('gates/:id/decide') @RequirePermission('projects.gates.decide') @ApiOperation({ summary: 'Pass, fail or waive a gate (fail / waive need a comment)' })
    decideGate(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string, @Uuid('id') id: string, @Body(new ZodValidationPipe(DecideGateSchema)) dto: DecideGateInput) { return this.gov.decideGate(ctx, pid, id, dto); }

    @Post('gates/:id/reopen') @RequirePermission('projects.gates.decide') @ApiOperation({ summary: 'Put a decided gate back to pending' })
    reopenGate(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string, @Uuid('id') id: string) { return this.gov.reopenGate(ctx, pid, id); }

    // --- reviews ---

    @Get('reviews') @RequirePermission('projects.projects.read') @ApiOperation({ summary: 'Reviews and retrospectives' })
    listReviews(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string) { return this.gov.listReviews(ctx, pid); }

    @Post('reviews') @RequirePermission('projects.projects.update') @ApiOperation({ summary: 'Record a review or retrospective' })
    createReview(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string, @Body(new ZodValidationPipe(CreateReviewSchema)) dto: CreateReviewInput) { return this.gov.createReview(ctx, pid, dto); }

    @Patch('reviews/:id') @RequirePermission('projects.projects.update') @ApiOperation({ summary: 'Edit a review' })
    updateReview(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string, @Uuid('id') id: string, @Body(new ZodValidationPipe(UpdateReviewSchema)) dto: UpdateReviewInput) { return this.gov.updateReview(ctx, pid, id, dto); }

    @Delete('reviews/:id') @RequirePermission('projects.projects.update') @ApiOperation({ summary: 'Delete a review' })
    removeReview(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string, @Uuid('id') id: string) { return this.gov.removeReview(ctx, pid, id); }

    @Post('reviews/:id/actions/:index/task') @RequirePermission('tasks.tasks.create') @ApiOperation({ summary: 'Create a task from a review action' })
    actionTask(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string, @Uuid('id') id: string, @Param('index', ParseIntPipe) index: number) { return this.gov.createActionTask(ctx, pid, id, index); }

    // --- checklists ---

    @Get('checklists') @RequirePermission('projects.projects.read') @ApiOperation({ summary: 'Phase checklists with items' })
    listChecklists(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string) { return this.gov.listChecklists(ctx, pid); }

    @Post('checklists') @RequirePermission('projects.projects.update') @ApiOperation({ summary: 'Add a checklist (with items)' })
    createChecklist(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string, @Body(new ZodValidationPipe(CreateChecklistSchema)) dto: CreateChecklistInput) { return this.gov.createChecklist(ctx, pid, dto); }

    @Patch('checklists/:id') @RequirePermission('projects.projects.update') @ApiOperation({ summary: 'Rename a checklist or change its phase' })
    updateChecklist(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string, @Uuid('id') id: string, @Body(new ZodValidationPipe(UpdateChecklistSchema)) dto: UpdateChecklistInput) { return this.gov.updateChecklist(ctx, pid, id, dto); }

    @Delete('checklists/:id') @RequirePermission('projects.projects.update') @ApiOperation({ summary: 'Delete a checklist' })
    removeChecklist(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string, @Uuid('id') id: string) { return this.gov.removeChecklist(ctx, pid, id); }

    @Post('checklists/:id/items') @RequirePermission('projects.projects.update') @ApiOperation({ summary: 'Add a checklist item' })
    addItem(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string, @Uuid('id') id: string, @Body(new ZodValidationPipe(ChecklistItemSchema)) dto: ChecklistItemInput) { return this.gov.addItem(ctx, pid, id, dto); }

    @Patch('checklists/:id/items/:itemId') @RequirePermission('projects.projects.update') @ApiOperation({ summary: 'Tick, untick or edit a checklist item' })
    updateItem(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string, @Uuid('id') id: string, @Uuid('itemId') itemId: string, @Body(new ZodValidationPipe(UpdateChecklistItemSchema)) dto: UpdateChecklistItemInput) {
        return this.gov.updateItem(ctx, pid, id, itemId, dto);
    }

    @Delete('checklists/:id/items/:itemId') @RequirePermission('projects.projects.update') @ApiOperation({ summary: 'Delete a checklist item' })
    removeItem(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string, @Uuid('id') id: string, @Uuid('itemId') itemId: string) { return this.gov.removeItem(ctx, pid, id, itemId); }

    @Post('checklists/:id/items/:itemId/task') @RequirePermission('tasks.tasks.create') @ApiOperation({ summary: 'Create a task from a checklist item' })
    itemTask(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string, @Uuid('id') id: string, @Uuid('itemId') itemId: string) { return this.gov.createItemTask(ctx, pid, id, itemId); }

    // --- handovers ---

    @Get('handovers') @RequirePermission('projects.projects.read') @ApiOperation({ summary: 'Handovers (can_accept tells the caller whether they may accept)' })
    listHandovers(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string) { return this.gov.listHandovers(ctx, pid); }

    @Post('handovers') @RequirePermission('projects.projects.update') @ApiOperation({ summary: 'Plan a handover (the new owner is asked to accept)' })
    createHandover(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string, @Body(new ZodValidationPipe(CreateHandoverSchema)) dto: CreateHandoverInput) { return this.gov.createHandover(ctx, pid, dto); }

    @Patch('handovers/:id') @RequirePermission('projects.projects.update') @ApiOperation({ summary: 'Edit, start or cancel a handover' })
    updateHandover(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string, @Uuid('id') id: string, @Body(new ZodValidationPipe(UpdateHandoverSchema)) dto: UpdateHandoverInput) { return this.gov.updateHandover(ctx, pid, id, dto); }

    @Delete('handovers/:id') @RequirePermission('projects.projects.update') @ApiOperation({ summary: 'Delete a handover' })
    removeHandover(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string, @Uuid('id') id: string) { return this.gov.removeHandover(ctx, pid, id); }

    @Post('handovers/:id/accept') @RequirePermission('projects.projects.read') @ApiOperation({ summary: 'Accept a handover (receiving owner, receiving team member, or project editor)' })
    acceptHandover(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string, @Uuid('id') id: string, @Body(new ZodValidationPipe(AcceptHandoverSchema)) dto: AcceptHandoverInput) { return this.gov.acceptHandover(ctx, pid, id, dto); }

    // --- closeout ---

    @Get('closeout') @RequirePermission('projects.projects.read') @ApiOperation({ summary: 'Closeout record and completion requirements' })
    closeout(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string) { return this.gov.closeout(ctx, pid); }

    @Put('closeout') @RequirePermission('projects.projects.update') @ApiOperation({ summary: 'Save the closeout record (customer acceptance needs projects.deliverables.accept_on_behalf)' })
    updateCloseout(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string, @Body(new ZodValidationPipe(UpdateCloseoutSchema)) dto: UpdateCloseoutInput) { return this.gov.updateCloseout(ctx, pid, dto); }

    @Post('closeout/close') @RequirePermission('projects.projects.complete') @ApiOperation({ summary: 'Save the closeout and complete the project (refused while blocking gates / required items are open)' })
    close(@CurrentOrg() ctx: OrgContext, @Uuid('projectId') pid: string, @Body(new ZodValidationPipe(UpdateCloseoutSchema)) dto: UpdateCloseoutInput) { return this.gov.close(ctx, pid, dto); }
}
