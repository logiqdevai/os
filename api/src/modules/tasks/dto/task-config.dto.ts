import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { CycleStatus, DeploymentStatus, ReleaseStatus, TaskStatusCategory } from 'generated/prisma';

// --- Workflow ------------------------------------------------------------------------------------

export class CreateTaskStatusDto {
    @ApiProperty({ example: 'QA' })
    @IsString()
    @MinLength(1)
    @MaxLength(60)
    name: string;

    @ApiProperty({ enum: TaskStatusCategory })
    @IsEnum(TaskStatusCategory)
    category: TaskStatusCategory;

    @ApiProperty({ required: false, description: 'Team workflow; omit for the organization-wide workflow' })
    @IsOptional()
    @IsUUID()
    team_id?: string;

    @ApiProperty({ required: false, example: 'violet', description: 'Semantic color token' })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    color?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    sort_order?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_default?: boolean;

    @ApiProperty({ required: false, type: [String], description: 'Slugs reachable from this status; empty = any' })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    allowed_transitions?: string[];
}
export class UpdateTaskStatusDto extends PartialType(OmitType(CreateTaskStatusDto, ['team_id'] as const)) { }

export class ArchiveTaskStatusDto {
    @ApiProperty({ required: false, description: 'Move tasks in this status to another status first' })
    @IsOptional()
    @IsUUID()
    replacement_status_id?: string;
}

export class ReorderStatusesDto {
    @ApiProperty({ type: [String], description: 'Status ids in the new order' })
    @IsArray()
    @IsUUID('all', { each: true })
    status_ids: string[];
}

export class CreateTaskTypeDto {
    @ApiProperty({ example: 'Bug' })
    @IsString()
    @MinLength(1)
    @MaxLength(60)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    icon?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    color?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_default?: boolean;
}
export class UpdateTaskTypeDto extends PartialType(CreateTaskTypeDto) { }

export class CreateTaskLabelDto {
    @ApiProperty({ example: 'frontend' })
    @IsString()
    @MinLength(1)
    @MaxLength(60)
    name: string;

    @ApiProperty({ required: false, example: 'info' })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    color?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    parent_label_id?: string;
}
export class UpdateTaskLabelDto extends PartialType(CreateTaskLabelDto) { }

// --- Cycles ----------------------------------------------------------------------------------------

export class CreateCycleDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    team_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    project_id?: string;

    @ApiProperty({ required: false, example: 'Sprint 12' })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    goal?: string;

    @ApiProperty({ example: '2026-11-16' })
    @IsDateString()
    starts_at: string;

    @ApiProperty({ example: '2026-11-29' })
    @IsDateString()
    ends_at: string;
}

export class UpdateCycleDto extends PartialType(OmitType(CreateCycleDto, ['team_id', 'project_id'] as const)) {
    @ApiProperty({ enum: [CycleStatus.PLANNED, CycleStatus.ACTIVE, CycleStatus.CANCELLED], required: false })
    @IsOptional()
    @IsIn([CycleStatus.PLANNED, CycleStatus.ACTIVE, CycleStatus.CANCELLED])
    status?: CycleStatus;
}

export class CompleteCycleDto {
    @ApiProperty({ enum: ['next', 'backlog'], description: 'Unfinished tasks move to the next cycle or back to the backlog (no cycle)' })
    @IsIn(['next', 'backlog'])
    carry_over: 'next' | 'backlog';
}

// --- Releases ----------------------------------------------------------------------------------------

export class CreateReleaseDto {
    @ApiProperty({ example: 'Website 2.0' })
    @IsString()
    @MinLength(1)
    @MaxLength(160)
    name: string;

    @ApiProperty({ required: false, example: '2.0.0' })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    version?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    team_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    project_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    milestone_id?: string;

    @ApiProperty({ enum: ReleaseStatus, required: false })
    @IsOptional()
    @IsEnum(ReleaseStatus)
    status?: ReleaseStatus;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsDateString()
    target_date?: string | null;

    @ApiProperty({ required: false, description: 'Markdown release notes' })
    @IsOptional()
    @IsString()
    @MaxLength(50000)
    notes?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    customer_visible?: boolean;
}
export class UpdateReleaseDto extends PartialType(CreateReleaseDto) { }

export class ReleaseTasksDto {
    @ApiProperty({ type: [String] })
    @IsArray()
    @IsUUID('all', { each: true })
    task_ids: string[];
}

export class CreateDeploymentDto {
    @ApiProperty({ example: 'production' })
    @IsString()
    @MinLength(1)
    @MaxLength(40)
    environment: string;

    @ApiProperty({ enum: DeploymentStatus, required: false })
    @IsOptional()
    @IsEnum(DeploymentStatus)
    status?: DeploymentStatus;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    url?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    external_ref?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    notes?: string;
}
