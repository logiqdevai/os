import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ProjectItemsService } from '../services/project-items.service';
import {
    CreateAllocationDto,
    CreateChangeRequestDto,
    CreateDecisionDto,
    CreateDeliverableDto,
    CreateDependencyDto,
    CreateIssueDto,
    CreateMilestoneDto,
    CreateRiskDto,
    CreateStatusUpdateDto,
    CreateWorkstreamDto,
    DecideChangeRequestDto,
    ReviewDeliverableDto,
    UpdateAllocationDto,
    UpdateChangeRequestDto,
    UpdateDecisionDto,
    UpdateDeliverableDto,
    UpdateDependencyDto,
    UpdateIssueDto,
    UpdateMilestoneDto,
    UpdateRiskDto,
    UpdateStatusUpdateDto,
    UpdateWorkstreamDto,
} from '../dto/project-items.dto';

/**
 * 05 Projects — child records of one project. Reads need projects.projects.read; writes need the child's own key.
 * The project id is checked against the caller's scope for that key (404 when out of scope).
 */
@ApiTags('Projects · Delivery')
@ApiBearerAuth()
@Controller('projects/:projectId')
@UseGuards(JwtGuard, PermissionsGuard)
export class ProjectItemsController {
    constructor(private readonly items: ProjectItemsService) { }

    // --- milestones ---

    @Get('milestones')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'List milestones of a project' })
    listMilestones(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string) {
        return this.items.list(ctx, projectId, 'milestones');
    }

    @Get('milestones/:id')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Get one milestone' })
    getMilestone(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.get(ctx, projectId, 'milestones', id);
    }

    @Post('milestones')
    @RequirePermission('projects.milestones.manage')
    @ApiOperation({ summary: 'Create milestone' })
    createMilestone(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: CreateMilestoneDto) {
        return this.items.create(ctx, projectId, 'milestones', { ...dto });
    }

    @Patch('milestones/:id')
    @RequirePermission('projects.milestones.manage')
    @ApiOperation({ summary: 'Update milestone' })
    updateMilestone(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMilestoneDto) {
        return this.items.update(ctx, projectId, 'milestones', id, { ...dto });
    }

    @Delete('milestones/:id')
    @RequirePermission('projects.milestones.manage')
    @ApiOperation({ summary: 'Delete milestone' })
    removeMilestone(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.remove(ctx, projectId, 'milestones', id);
    }

    // --- workstreams ---

    @Get('workstreams')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'List workstreams of a project' })
    listWorkstreams(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string) {
        return this.items.list(ctx, projectId, 'workstreams');
    }

    @Get('workstreams/:id')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Get one workstream' })
    getWorkstream(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.get(ctx, projectId, 'workstreams', id);
    }

    @Post('workstreams')
    @RequirePermission('projects.workstreams.manage')
    @ApiOperation({ summary: 'Create workstream' })
    createWorkstream(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: CreateWorkstreamDto) {
        return this.items.create(ctx, projectId, 'workstreams', { ...dto });
    }

    @Patch('workstreams/:id')
    @RequirePermission('projects.workstreams.manage')
    @ApiOperation({ summary: 'Update workstream' })
    updateWorkstream(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWorkstreamDto) {
        return this.items.update(ctx, projectId, 'workstreams', id, { ...dto });
    }

    @Delete('workstreams/:id')
    @RequirePermission('projects.workstreams.manage')
    @ApiOperation({ summary: 'Delete workstream' })
    removeWorkstream(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.remove(ctx, projectId, 'workstreams', id);
    }

    // --- deliverables ---

    @Get('deliverables')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'List deliverables of a project' })
    listDeliverables(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string) {
        return this.items.list(ctx, projectId, 'deliverables');
    }

    @Get('deliverables/:id')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Get one deliverable' })
    getDeliverable(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.get(ctx, projectId, 'deliverables', id);
    }

    @Post('deliverables')
    @RequirePermission('projects.deliverables.manage')
    @ApiOperation({ summary: 'Create deliverable' })
    createDeliverable(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: CreateDeliverableDto) {
        return this.items.create(ctx, projectId, 'deliverables', { ...dto });
    }

    @Patch('deliverables/:id')
    @RequirePermission('projects.deliverables.manage')
    @ApiOperation({ summary: 'Update deliverable' })
    updateDeliverable(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDeliverableDto) {
        return this.items.update(ctx, projectId, 'deliverables', id, { ...dto });
    }

    @Delete('deliverables/:id')
    @RequirePermission('projects.deliverables.manage')
    @ApiOperation({ summary: 'Delete deliverable' })
    removeDeliverable(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.remove(ctx, projectId, 'deliverables', id);
    }

    // --- risks ---

    @Get('risks')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'List risks of a project' })
    listRisks(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string) {
        return this.items.list(ctx, projectId, 'risks');
    }

    @Get('risks/:id')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Get one risk' })
    getRisk(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.get(ctx, projectId, 'risks', id);
    }

    @Post('risks')
    @RequirePermission('projects.risks.manage')
    @ApiOperation({ summary: 'Create risk' })
    createRisk(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: CreateRiskDto) {
        return this.items.create(ctx, projectId, 'risks', { ...dto });
    }

    @Patch('risks/:id')
    @RequirePermission('projects.risks.manage')
    @ApiOperation({ summary: 'Update risk' })
    updateRisk(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRiskDto) {
        return this.items.update(ctx, projectId, 'risks', id, { ...dto });
    }

    @Delete('risks/:id')
    @RequirePermission('projects.risks.manage')
    @ApiOperation({ summary: 'Delete risk' })
    removeRisk(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.remove(ctx, projectId, 'risks', id);
    }

    // --- issues ---

    @Get('issues')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'List issues of a project' })
    listIssues(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string) {
        return this.items.list(ctx, projectId, 'issues');
    }

    @Get('issues/:id')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Get one issue' })
    getIssue(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.get(ctx, projectId, 'issues', id);
    }

    @Post('issues')
    @RequirePermission('projects.issues.manage')
    @ApiOperation({ summary: 'Create issue' })
    createIssue(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: CreateIssueDto) {
        return this.items.create(ctx, projectId, 'issues', { ...dto });
    }

    @Patch('issues/:id')
    @RequirePermission('projects.issues.manage')
    @ApiOperation({ summary: 'Update issue' })
    updateIssue(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateIssueDto) {
        return this.items.update(ctx, projectId, 'issues', id, { ...dto });
    }

    @Delete('issues/:id')
    @RequirePermission('projects.issues.manage')
    @ApiOperation({ summary: 'Delete issue' })
    removeIssue(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.remove(ctx, projectId, 'issues', id);
    }

    // --- decisions ---

    @Get('decisions')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'List decisions of a project' })
    listDecisions(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string) {
        return this.items.list(ctx, projectId, 'decisions');
    }

    @Get('decisions/:id')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Get one decision' })
    getDecision(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.get(ctx, projectId, 'decisions', id);
    }

    @Post('decisions')
    @RequirePermission('projects.issues.manage')
    @ApiOperation({ summary: 'Create decision' })
    createDecision(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: CreateDecisionDto) {
        return this.items.create(ctx, projectId, 'decisions', { ...dto });
    }

    @Patch('decisions/:id')
    @RequirePermission('projects.issues.manage')
    @ApiOperation({ summary: 'Update decision' })
    updateDecision(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDecisionDto) {
        return this.items.update(ctx, projectId, 'decisions', id, { ...dto });
    }

    @Delete('decisions/:id')
    @RequirePermission('projects.issues.manage')
    @ApiOperation({ summary: 'Delete decision' })
    removeDecision(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.remove(ctx, projectId, 'decisions', id);
    }

    // --- dependencies ---

    @Get('dependencies')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'List dependencies of a project' })
    listDependencys(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string) {
        return this.items.list(ctx, projectId, 'dependencies');
    }

    @Get('dependencies/:id')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Get one dependencie' })
    getDependency(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.get(ctx, projectId, 'dependencies', id);
    }

    @Post('dependencies')
    @RequirePermission('projects.dependencies.manage')
    @ApiOperation({ summary: 'Create dependencie' })
    createDependency(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: CreateDependencyDto) {
        return this.items.create(ctx, projectId, 'dependencies', { ...dto });
    }

    @Patch('dependencies/:id')
    @RequirePermission('projects.dependencies.manage')
    @ApiOperation({ summary: 'Update dependencie' })
    updateDependency(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDependencyDto) {
        return this.items.update(ctx, projectId, 'dependencies', id, { ...dto });
    }

    @Delete('dependencies/:id')
    @RequirePermission('projects.dependencies.manage')
    @ApiOperation({ summary: 'Delete dependencie' })
    removeDependency(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.remove(ctx, projectId, 'dependencies', id);
    }

    // --- status updates ---

    @Get('status-updates')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'List status updates of a project' })
    listStatusUpdates(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string) {
        return this.items.list(ctx, projectId, 'status-updates');
    }

    @Get('status-updates/:id')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Get one status update' })
    getStatusUpdate(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.get(ctx, projectId, 'status-updates', id);
    }

    @Post('status-updates')
    @RequirePermission('projects.status_updates.publish')
    @ApiOperation({ summary: 'Create status update' })
    createStatusUpdate(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: CreateStatusUpdateDto) {
        return this.items.create(ctx, projectId, 'status-updates', { ...dto });
    }

    @Patch('status-updates/:id')
    @RequirePermission('projects.status_updates.publish')
    @ApiOperation({ summary: 'Update status update' })
    updateStatusUpdate(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStatusUpdateDto) {
        return this.items.update(ctx, projectId, 'status-updates', id, { ...dto });
    }

    @Delete('status-updates/:id')
    @RequirePermission('projects.status_updates.publish')
    @ApiOperation({ summary: 'Delete status update' })
    removeStatusUpdate(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.remove(ctx, projectId, 'status-updates', id);
    }

    // --- change requests ---

    @Get('change-requests')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'List change requests of a project' })
    listChangeRequests(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string) {
        return this.items.list(ctx, projectId, 'change-requests');
    }

    @Get('change-requests/:id')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Get one change request' })
    getChangeRequest(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.get(ctx, projectId, 'change-requests', id);
    }

    @Post('change-requests')
    @RequirePermission('projects.change_requests.manage')
    @ApiOperation({ summary: 'Create change request' })
    createChangeRequest(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: CreateChangeRequestDto) {
        return this.items.create(ctx, projectId, 'change-requests', { ...dto });
    }

    @Patch('change-requests/:id')
    @RequirePermission('projects.change_requests.manage')
    @ApiOperation({ summary: 'Update change request' })
    updateChangeRequest(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateChangeRequestDto) {
        return this.items.update(ctx, projectId, 'change-requests', id, { ...dto });
    }

    @Delete('change-requests/:id')
    @RequirePermission('projects.change_requests.manage')
    @ApiOperation({ summary: 'Delete change request' })
    removeChangeRequest(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.remove(ctx, projectId, 'change-requests', id);
    }

    // --- allocations ---

    @Get('allocations')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'List allocations of a project' })
    listAllocations(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string) {
        return this.items.list(ctx, projectId, 'allocations');
    }

    @Get('allocations/:id')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Get one allocation' })
    getAllocation(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.get(ctx, projectId, 'allocations', id);
    }

    @Post('allocations')
    @RequirePermission('projects.members.manage')
    @ApiOperation({ summary: 'Create allocation' })
    createAllocation(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: CreateAllocationDto) {
        return this.items.create(ctx, projectId, 'allocations', { ...dto });
    }

    @Patch('allocations/:id')
    @RequirePermission('projects.members.manage')
    @ApiOperation({ summary: 'Update allocation' })
    updateAllocation(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAllocationDto) {
        return this.items.update(ctx, projectId, 'allocations', id, { ...dto });
    }

    @Delete('allocations/:id')
    @RequirePermission('projects.members.manage')
    @ApiOperation({ summary: 'Delete allocation' })
    removeAllocation(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.remove(ctx, projectId, 'allocations', id);
    }

    // --- actions ---

    @Post('milestones/:id/complete')
    @RequirePermission('projects.milestones.manage')
    @ApiOperation({ summary: 'Complete a milestone (billing milestones notify Billing)' })
    completeMilestone(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.completeMilestone(ctx, projectId, id);
    }

    @Post('deliverables/:id/submit')
    @RequirePermission('projects.deliverables.manage')
    @ApiOperation({ summary: 'Submit a deliverable for (customer) review' })
    submitDeliverable(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.submitDeliverable(ctx, projectId, id);
    }

    @Post('deliverables/:id/review')
    @RequirePermission('projects.deliverables.manage')
    @ApiOperation({ summary: 'Record a review decision (accepting on behalf of the customer needs accept_on_behalf)' })
    reviewDeliverable(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDeliverableDto) {
        return this.items.reviewDeliverable(ctx, projectId, id, dto);
    }

    @Post('status-updates/:id/publish')
    @RequirePermission('projects.status_updates.publish')
    @ApiOperation({ summary: 'Publish a drafted status update' })
    publishStatusUpdate(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.items.publishStatusUpdate(ctx, projectId, id);
    }

    @Post('change-requests/:id/decide')
    @RequirePermission('projects.change_requests.approve')
    @ApiOperation({ summary: 'Approve or reject a change request' })
    decideChangeRequest(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideChangeRequestDto) {
        return this.items.decideChangeRequest(ctx, projectId, id, dto);
    }
}
