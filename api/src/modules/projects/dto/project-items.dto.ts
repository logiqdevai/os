import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, MinLength } from 'class-validator';
import {
    DeliverableApprovalMode,
    DeliverableStatus,
    DependencyItemType,
    DependencyStatus,
    DependencyType,
    ProjectChangeRequestStatus,
    ProjectHealth,
    ProjectIssueKind,
    ProjectIssueStatus,
    ProjectItemStatus,
    ProjectPriority,
    RiskStatus,
    Severity,
} from 'generated/prisma';
import { z } from 'zod';

// --- Milestones ----------------------------------------------------------------------------

export class CreateMilestoneDto {
    @ApiProperty({ example: 'Design sign-off' })
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    owner_membership_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    workstream_id?: string;

    @ApiProperty({ enum: ProjectItemStatus, required: false })
    @IsOptional()
    @IsEnum(ProjectItemStatus)
    status?: ProjectItemStatus;

    @ApiProperty({ required: false, example: '2026-12-01' })
    @IsOptional()
    @IsDateString()
    planned_date?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    actual_date?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100)
    progress_percent?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    customer_visible?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_billing_milestone?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    notes?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    sort_order?: number;
}
export class UpdateMilestoneDto extends PartialType(CreateMilestoneDto) { }

// --- Workstreams ---------------------------------------------------------------------------

export class CreateWorkstreamDto {
    @ApiProperty({ example: 'Frontend' })
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    owner_membership_id?: string;

    @ApiProperty({ enum: ProjectItemStatus, required: false })
    @IsOptional()
    @IsEnum(ProjectItemStatus)
    status?: ProjectItemStatus;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    planned_start?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    planned_end?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    color?: string;
}
export class UpdateWorkstreamDto extends PartialType(CreateWorkstreamDto) { }

// --- Deliverables --------------------------------------------------------------------------

export class CreateDeliverableDto {
    @ApiProperty({ example: 'Homepage design (Figma)' })
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    milestone_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    workstream_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    owner_membership_id?: string;

    @ApiProperty({ enum: DeliverableStatus, required: false, description: 'ACCEPTED / REJECTED / CHANGES_REQUESTED are set through the review endpoint' })
    @IsOptional()
    @IsIn([DeliverableStatus.PLANNED, DeliverableStatus.IN_PROGRESS, DeliverableStatus.READY_FOR_REVIEW, DeliverableStatus.CANCELLED])
    status?: DeliverableStatus;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    due_date?: string;

    @ApiProperty({ required: false, description: 'Shown in the Customer Portal and approvable by the customer' })
    @IsOptional()
    @IsBoolean()
    customer_visible?: boolean;

    @ApiProperty({ enum: DeliverableApprovalMode, required: false })
    @IsOptional()
    @IsEnum(DeliverableApprovalMode)
    approval_mode?: DeliverableApprovalMode;

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsUUID('all', { each: true })
    document_ids?: string[];
}
export class UpdateDeliverableDto extends PartialType(CreateDeliverableDto) { }

export class ReviewDeliverableDto {
    @ApiProperty({ enum: [DeliverableStatus.ACCEPTED, DeliverableStatus.CHANGES_REQUESTED, DeliverableStatus.REJECTED] })
    @IsIn([DeliverableStatus.ACCEPTED, DeliverableStatus.CHANGES_REQUESTED, DeliverableStatus.REJECTED])
    decision: DeliverableStatus;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    comment?: string;

    @ApiProperty({ required: false, description: 'Customer contact the acceptance is recorded for (accept on behalf)' })
    @IsOptional()
    @IsUUID()
    on_behalf_of_contact_id?: string;
}

// --- Risks ---------------------------------------------------------------------------------

export class CreateRiskDto {
    @ApiProperty({ example: 'Content from the customer arrives late' })
    @IsString()
    @MinLength(1)
    @MaxLength(300)
    title: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(60)
    category?: string;

    @ApiProperty({ required: false, minimum: 1, maximum: 5 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(5)
    probability?: number;

    @ApiProperty({ required: false, minimum: 1, maximum: 5 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(5)
    impact?: number;

    @ApiProperty({ enum: Severity, required: false, description: 'Derived from probability × impact when both are given' })
    @IsOptional()
    @IsEnum(Severity)
    severity?: Severity;

    @ApiProperty({ enum: RiskStatus, required: false })
    @IsOptional()
    @IsEnum(RiskStatus)
    status?: RiskStatus;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    owner_membership_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    mitigation?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    contingency?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    due_date?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    milestone_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    task_id?: string;
}
export class UpdateRiskDto extends PartialType(CreateRiskDto) { }

// --- Issues & blockers -----------------------------------------------------------------------

export class CreateIssueDto {
    @ApiProperty({ example: 'Staging server unavailable' })
    @IsString()
    @MinLength(1)
    @MaxLength(300)
    title: string;

    @ApiProperty({ enum: ProjectIssueKind, required: false })
    @IsOptional()
    @IsEnum(ProjectIssueKind)
    kind?: ProjectIssueKind;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    description?: string;

    @ApiProperty({ enum: Severity, required: false })
    @IsOptional()
    @IsEnum(Severity)
    severity?: Severity;

    @ApiProperty({ enum: ProjectPriority, required: false })
    @IsOptional()
    @IsEnum(ProjectPriority)
    priority?: ProjectPriority;

    @ApiProperty({ enum: ProjectIssueStatus, required: false })
    @IsOptional()
    @IsEnum(ProjectIssueStatus)
    status?: ProjectIssueStatus;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    owner_membership_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    milestone_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    task_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    target_resolution?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    resolution?: string;
}
export class UpdateIssueDto extends PartialType(CreateIssueDto) { }

// --- Decisions -------------------------------------------------------------------------------

export class CreateDecisionDto {
    @ApiProperty({ example: 'Use Next.js for the marketing site' })
    @IsString()
    @MinLength(1)
    @MaxLength(300)
    title: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    decided_at?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    decision_maker_membership_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    alternatives_considered?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    selected_option?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    reason?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    consequences?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    milestone_id?: string;
}
export class UpdateDecisionDto extends PartialType(CreateDecisionDto) { }

// --- Dependencies ------------------------------------------------------------------------------

export class CreateDependencyDto {
    @ApiProperty({ enum: DependencyItemType })
    @IsEnum(DependencyItemType)
    source_type: DependencyItemType;

    @ApiProperty()
    @IsString()
    @MaxLength(200)
    source_id: string;

    @ApiProperty({ enum: DependencyItemType })
    @IsEnum(DependencyItemType)
    target_type: DependencyItemType;

    @ApiProperty()
    @IsString()
    @MaxLength(200)
    target_id: string;

    @ApiProperty({ enum: DependencyType, required: false })
    @IsOptional()
    @IsEnum(DependencyType)
    type?: DependencyType;

    @ApiProperty({ enum: DependencyStatus, required: false })
    @IsOptional()
    @IsEnum(DependencyStatus)
    status?: DependencyStatus;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    owner_membership_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    expected_resolution?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    notes?: string;
}
export class UpdateDependencyDto extends PartialType(CreateDependencyDto) { }

// --- Status updates ------------------------------------------------------------------------------

export class CreateStatusUpdateDto {
    @ApiProperty({ example: 'Design approved, development started on schedule.' })
    @IsString()
    @MinLength(1)
    @MaxLength(5000)
    summary: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    period_start?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    period_end?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(10000)
    completed_work?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(10000)
    current_work?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(10000)
    upcoming_work?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100)
    progress_percent?: number;

    @ApiProperty({ enum: ProjectHealth, required: false })
    @IsOptional()
    @IsEnum(ProjectHealth)
    health?: ProjectHealth;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    risks_summary?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    blockers_summary?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    decisions_summary?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    required_actions?: string;

    @ApiProperty({ required: false, description: 'Needs a CUSTOMER_VISIBLE project' })
    @IsOptional()
    @IsBoolean()
    customer_visible?: boolean;

    @ApiProperty({ required: false, description: 'Publish immediately (otherwise saved as draft)' })
    @IsOptional()
    @IsBoolean()
    publish?: boolean;
}
export class UpdateStatusUpdateDto extends PartialType(CreateStatusUpdateDto) { }

// --- Change requests --------------------------------------------------------------------------------

export class CreateChangeRequestDto {
    @ApiProperty({ example: 'Add a blog section' })
    @IsString()
    @MinLength(1)
    @MaxLength(300)
    title: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(10000)
    description?: string;

    @ApiProperty({ enum: ProjectPriority, required: false })
    @IsOptional()
    @IsEnum(ProjectPriority)
    priority?: ProjectPriority;

    @ApiProperty({ enum: ProjectChangeRequestStatus, required: false, description: 'APPROVED / REJECTED are set through the decide endpoint' })
    @IsOptional()
    @IsIn([
        ProjectChangeRequestStatus.REQUESTED,
        ProjectChangeRequestStatus.UNDER_REVIEW,
        ProjectChangeRequestStatus.ESTIMATING,
        ProjectChangeRequestStatus.AWAITING_APPROVAL,
        ProjectChangeRequestStatus.SCHEDULED,
        ProjectChangeRequestStatus.IMPLEMENTED,
        ProjectChangeRequestStatus.CANCELLED,
    ])
    status?: ProjectChangeRequestStatus;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    scope_impact?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    timeline_impact_days?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    resource_impact?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    cost_impact_amount?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Length(3, 3)
    currency?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    customer_visible?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    requester_contact_id?: string;
}
export class UpdateChangeRequestDto extends PartialType(CreateChangeRequestDto) { }

export class DecideChangeRequestDto {
    @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
    @IsIn([ProjectChangeRequestStatus.APPROVED, ProjectChangeRequestStatus.REJECTED])
    decision: ProjectChangeRequestStatus;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    reason?: string;
}

// --- Allocations -------------------------------------------------------------------------------------

export class CreateAllocationDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    membership_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    team_id?: string;

    @ApiProperty({ required: false, example: 'Frontend developer' })
    @IsOptional()
    @IsString()
    @MaxLength(60)
    role_label?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    milestone_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    @Min(0)
    planned_hours?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(200)
    allocation_percent?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    start_date?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    end_date?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    notes?: string;
}
export class UpdateAllocationDto extends PartialType(CreateAllocationDto) { }

// --- Zod twins for MCP tools ---------------------------------------------------------------------------

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'YYYY-MM-DD');

export const CreateMilestoneSchema = z.object({
    project_id: z.string().uuid(),
    name: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    owner_membership_id: z.string().uuid().optional(),
    status: z.nativeEnum(ProjectItemStatus).optional(),
    planned_date: date.optional(),
    customer_visible: z.boolean().optional(),
    is_billing_milestone: z.boolean().optional(),
});

export const UpdateMilestoneSchema = CreateMilestoneSchema.partial().extend({ project_id: z.string().uuid(), id: z.string().uuid() });

export const CreateRiskSchema = z.object({
    project_id: z.string().uuid(),
    title: z.string().min(1).max(300),
    description: z.string().max(5000).optional(),
    probability: z.number().int().min(1).max(5).optional(),
    impact: z.number().int().min(1).max(5).optional(),
    severity: z.nativeEnum(Severity).optional(),
    owner_membership_id: z.string().uuid().optional(),
    mitigation: z.string().max(5000).optional(),
    due_date: date.optional(),
});

export const CreateIssueSchema = z.object({
    project_id: z.string().uuid(),
    title: z.string().min(1).max(300),
    kind: z.nativeEnum(ProjectIssueKind).optional(),
    description: z.string().max(5000).optional(),
    severity: z.nativeEnum(Severity).optional(),
    priority: z.nativeEnum(ProjectPriority).optional(),
    owner_membership_id: z.string().uuid().optional(),
    target_resolution: date.optional(),
});

export const CreateStatusUpdateSchema = z.object({
    project_id: z.string().uuid(),
    summary: z.string().min(1).max(5000),
    completed_work: z.string().max(10000).optional(),
    current_work: z.string().max(10000).optional(),
    upcoming_work: z.string().max(10000).optional(),
    progress_percent: z.number().int().min(0).max(100).optional(),
    health: z.nativeEnum(ProjectHealth).optional(),
    risks_summary: z.string().max(5000).optional(),
    blockers_summary: z.string().max(5000).optional(),
    customer_visible: z.boolean().optional(),
    publish: z.boolean().optional(),
});
