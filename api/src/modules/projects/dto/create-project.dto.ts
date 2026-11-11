import { ApiProperty, PartialType } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CalculationMode, ProjectHealth, ProjectPriority, ProjectVisibility } from 'generated/prisma';
import { z } from 'zod';

export class CreateProjectDto {
    @ApiProperty({ example: 'Acme website relaunch' })
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    name: string;

    @ApiProperty({ required: false, example: 'ACME-WEB' })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    code?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(20000)
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    type_id?: string;

    @ApiProperty({ required: false, description: 'Defaults to the organization default status' })
    @IsOptional()
    @IsUUID()
    status_id?: string;

    @ApiProperty({ required: false, description: 'Customer (CRM company)' })
    @IsOptional()
    @IsUUID()
    company_id?: string;

    @ApiProperty({ required: false, description: 'Defaults to the caller' })
    @IsOptional()
    @IsUUID()
    owner_membership_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    team_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    branch_id?: string;

    @ApiProperty({ required: false, description: 'Create from this template (its current version is copied)' })
    @IsOptional()
    @IsUUID()
    template_id?: string;

    @ApiProperty({ enum: ProjectPriority, required: false })
    @IsOptional()
    @IsEnum(ProjectPriority)
    priority?: ProjectPriority;

    @ApiProperty({ enum: ProjectVisibility, required: false })
    @IsOptional()
    @IsEnum(ProjectVisibility)
    visibility?: ProjectVisibility;

    @ApiProperty({ enum: ProjectHealth, required: false })
    @IsOptional()
    @IsEnum(ProjectHealth)
    health?: ProjectHealth;

    @ApiProperty({ enum: CalculationMode, required: false })
    @IsOptional()
    @IsEnum(CalculationMode)
    health_mode?: CalculationMode;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    health_reason?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100)
    progress_percent?: number;

    @ApiProperty({ enum: CalculationMode, required: false })
    @IsOptional()
    @IsEnum(CalculationMode)
    progress_mode?: CalculationMode;

    @ApiProperty({ required: false, example: '2026-11-15' })
    @IsOptional()
    @IsDateString()
    planned_start?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    actual_start?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    target_completion?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    internal_deadline?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    customer_deadline?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    review_date?: string;

    @ApiProperty({ required: false, description: 'Needs projects.projects.manage_budgets' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    budget_hours?: number;

    @ApiProperty({ required: false, description: 'Needs projects.projects.manage_budgets' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    budget_amount?: number;

    @ApiProperty({ required: false, example: 'EUR' })
    @IsOptional()
    @Length(3, 3)
    currency?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    color?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    icon?: string;

    @ApiProperty({ required: false, type: [String], description: 'Membership ids added as project members' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(100)
    @IsUUID('all', { each: true })
    member_ids?: string[];
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) { }

export class AddProjectMemberDto {
    @ApiProperty()
    @IsUUID()
    membership_id: string;

    @ApiProperty({ required: false, example: 'Developer' })
    @IsOptional()
    @IsString()
    @MaxLength(60)
    role_label?: string;

    @ApiProperty({ required: false, description: 'Project role (Role of type PROJECT)' })
    @IsOptional()
    @IsUUID()
    role_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100)
    allocation_percent?: number;
}

export class UpdateProjectMemberDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(60)
    role_label?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    role_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100)
    allocation_percent?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}

export class ReopenProjectDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    reason?: string;
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'YYYY-MM-DD');

/** Zod twin of CreateProjectDto for MCP tools (same rules). */
export const CreateProjectSchema = z.object({
    name: z.string().min(1).max(200),
    code: z.string().max(40).optional(),
    description: z.string().max(20000).optional(),
    type_id: z.string().uuid().optional(),
    status_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
    owner_membership_id: z.string().uuid().optional(),
    team_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
    template_id: z.string().uuid().optional(),
    priority: z.nativeEnum(ProjectPriority).optional(),
    visibility: z.nativeEnum(ProjectVisibility).optional(),
    health: z.nativeEnum(ProjectHealth).optional(),
    health_reason: z.string().max(2000).optional(),
    progress_percent: z.number().int().min(0).max(100).optional(),
    planned_start: date.optional(),
    target_completion: date.optional(),
    customer_deadline: date.optional(),
    budget_hours: z.number().min(0).optional(),
    budget_amount: z.number().min(0).optional(),
    currency: z.string().length(3).optional(),
    member_ids: z.array(z.string().uuid()).max(100).optional(),
});

export const UpdateProjectSchema = CreateProjectSchema.partial().omit({ template_id: true }).extend({ id: z.string().uuid() });
