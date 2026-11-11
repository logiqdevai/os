import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TaskCommentVisibility, TaskDependencyType, TaskPriority } from 'generated/prisma';
import { z } from 'zod';

export class CreateTaskDto {
    @ApiProperty({ example: 'Build the pricing page' })
    @IsString()
    @MinLength(1)
    @MaxLength(300)
    title: string;

    @ApiProperty({ required: false, description: 'Markdown' })
    @IsOptional()
    @IsString()
    @MaxLength(50000)
    description?: string;

    @ApiProperty({ required: false, description: 'Team (gives the WEB-142 key and the workflow). Defaults to the project team.' })
    @IsOptional()
    @IsUUID()
    team_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    project_id?: string | null;

    @ApiProperty({ required: false })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    workstream_id?: string | null;

    @ApiProperty({ required: false })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    milestone_id?: string | null;

    @ApiProperty({ required: false, description: 'Create as a sub-task' })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    parent_task_id?: string | null;

    @ApiProperty({ required: false })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    cycle_id?: string | null;

    @ApiProperty({ required: false })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    release_id?: string | null;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    type_id?: string;

    @ApiProperty({ required: false, description: 'Defaults to the workflow default status' })
    @IsOptional()
    @IsUUID()
    status_id?: string;

    @ApiProperty({ enum: TaskPriority, required: false })
    @IsOptional()
    @IsEnum(TaskPriority)
    priority?: TaskPriority;

    @ApiProperty({ required: false, nullable: true, description: 'Assigning someone else needs tasks.tasks.assign' })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    assignee_membership_id?: string | null;

    @ApiProperty({ required: false, type: [String], description: 'Additional assignees' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(20)
    @IsUUID('all', { each: true })
    assignee_ids?: string[];

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(30)
    @IsUUID('all', { each: true })
    label_ids?: string[];

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsNumber()
    @Min(0)
    @Max(1000)
    estimate_points?: number | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsNumber()
    @Min(0)
    @Max(10000)
    estimate_hours?: number | null;

    @ApiProperty({ required: false, nullable: true, example: '2026-11-20' })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsDateString()
    start_date?: string | null;

    @ApiProperty({ required: false, nullable: true, example: '2026-11-28' })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsDateString()
    due_date?: string | null;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    customer_visible?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    blocked?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    blocked_reason?: string;

    @ApiProperty({ required: false, type: [String], description: 'Starter checklist items' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(50)
    @IsString({ each: true })
    checklist?: string[];

    @ApiProperty({ required: false, type: [String], description: 'Members mentioned in the description (notified)' })
    @IsOptional()
    @IsArray()
    @IsUUID('all', { each: true })
    mentioned_membership_ids?: string[];
}

export class UpdateTaskDto extends PartialType(OmitType(CreateTaskDto, ['checklist'] as const)) { }

export class MoveTaskDto {
    @ApiProperty({ required: false, description: 'Target status (column)' })
    @IsOptional()
    @IsUUID()
    status_id?: string;

    @ApiProperty({ required: false, nullable: true, description: 'Place right after this task' })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    after_task_id?: string | null;

    @ApiProperty({ required: false, nullable: true, description: 'Place right before this task' })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    before_task_id?: string | null;
}

export class AssignTaskDto {
    @ApiProperty({ nullable: true, description: 'Membership id, or null to unassign' })
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    assignee_membership_id: string | null;
}

export class BulkTaskPatchDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    status_id?: string;

    @ApiProperty({ enum: TaskPriority, required: false })
    @IsOptional()
    @IsEnum(TaskPriority)
    priority?: TaskPriority;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    assignee_membership_id?: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    cycle_id?: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    project_id?: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsDateString()
    due_date?: string | null;
}

export class BulkTaskDto {
    @ApiProperty({ type: [String] })
    @IsArray()
    @ArrayMaxSize(200)
    @IsUUID('all', { each: true })
    task_ids: string[];

    @ApiProperty({ required: false, type: BulkTaskPatchDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => BulkTaskPatchDto)
    patch?: BulkTaskPatchDto;

    @ApiProperty({ required: false, enum: ['archive', 'delete', 'add_labels', 'remove_labels'] })
    @IsOptional()
    @IsIn(['archive', 'delete', 'add_labels', 'remove_labels'])
    action?: 'archive' | 'delete' | 'add_labels' | 'remove_labels';

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsUUID('all', { each: true })
    label_ids?: string[];
}

export class CreateCommentDto {
    @ApiProperty()
    @IsString()
    @MinLength(1)
    @MaxLength(20000)
    body: string;

    @ApiProperty({ enum: TaskCommentVisibility, required: false })
    @IsOptional()
    @IsEnum(TaskCommentVisibility)
    visibility?: TaskCommentVisibility;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    parent_comment_id?: string;

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsUUID('all', { each: true })
    mentions?: string[];
}

export class UpdateCommentDto {
    @ApiProperty()
    @IsString()
    @MinLength(1)
    @MaxLength(20000)
    body: string;
}

export class CreateChecklistItemDto {
    @ApiProperty()
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    title: string;
}

export class UpdateChecklistItemDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    title?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_completed?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    sort_order?: number;
}

export class CreateDependencyDto {
    @ApiProperty({ description: 'Other task id' })
    @IsUUID()
    target_task_id: string;

    @ApiProperty({ enum: TaskDependencyType, required: false, description: 'BLOCKS = this task blocks the target' })
    @IsOptional()
    @IsEnum(TaskDependencyType)
    type?: TaskDependencyType;
}

export class AddAttachmentDto {
    @ApiProperty({ required: false, description: 'Existing document (17)' })
    @IsOptional()
    @IsUUID()
    document_id?: string;

    @ApiProperty({ required: false, example: 'brief.pdf' })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    file_name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    mime_type?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(0)
    size?: number;

    @ApiProperty({ required: false, description: 'External link (Figma, Drive, …)' })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    url?: string;
}

export class WatcherDto {
    @ApiProperty({ required: false, description: 'Defaults to the caller' })
    @IsOptional()
    @IsUUID()
    membership_id?: string;
}

// --- Zod twins for MCP ------------------------------------------------------------------------------

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'YYYY-MM-DD');

export const CreateTaskSchema = z.object({
    title: z.string().min(1).max(300),
    description: z.string().max(50000).optional(),
    team_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    milestone_id: z.string().uuid().optional(),
    parent_task_id: z.string().uuid().optional(),
    cycle_id: z.string().uuid().optional(),
    type_id: z.string().uuid().optional(),
    status_id: z.string().uuid().optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    assignee_membership_id: z.string().uuid().nullable().optional(),
    label_ids: z.array(z.string().uuid()).max(30).optional(),
    estimate_points: z.number().min(0).max(1000).nullable().optional(),
    due_date: date.nullable().optional(),
    customer_visible: z.boolean().optional(),
    checklist: z.array(z.string().max(500)).max(50).optional(),
});

export const UpdateTaskSchema = CreateTaskSchema.omit({ checklist: true }).partial().extend({
    id: z.string().min(1).describe('Task id or identifier such as WEB-142'),
    project_id: z.string().uuid().nullable().optional(),
    cycle_id: z.string().uuid().nullable().optional(),
    milestone_id: z.string().uuid().nullable().optional(),
    blocked: z.boolean().optional(),
    blocked_reason: z.string().max(2000).optional(),
});

export const AssignTaskSchema = z.object({ id: z.string().min(1).describe('Task id or identifier'), assignee_membership_id: z.string().uuid().nullable() });

export const CommentTaskSchema = z.object({
    id: z.string().min(1).describe('Task id or identifier'),
    body: z.string().min(1).max(20000),
    visibility: z.nativeEnum(TaskCommentVisibility).optional(),
    mentions: z.array(z.string().uuid()).optional(),
});

export const BulkTaskSchema = z.object({
    task_ids: z.array(z.string().uuid()).min(1).max(200),
    patch: z.object({
        status_id: z.string().uuid().optional(),
        priority: z.nativeEnum(TaskPriority).optional(),
        assignee_membership_id: z.string().uuid().nullable().optional(),
        cycle_id: z.string().uuid().nullable().optional(),
        project_id: z.string().uuid().nullable().optional(),
        due_date: date.nullable().optional(),
    }).optional(),
    action: z.enum(['archive', 'delete', 'add_labels', 'remove_labels']).optional(),
    label_ids: z.array(z.string().uuid()).optional(),
});
