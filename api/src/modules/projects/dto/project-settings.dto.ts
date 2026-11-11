import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ProjectStatusCategory } from 'generated/prisma';

export class CreateProjectTypeDto {
    @ApiProperty({ example: 'Website' })
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    default_template_id?: string;

    @ApiProperty({ required: false, type: [String], description: 'Workspace sections enabled by default' })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    enabled_sections?: string[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_default?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    sort_order?: number;
}
export class UpdateProjectTypeDto extends PartialType(CreateProjectTypeDto) { }

export class CreateProjectStatusDto {
    @ApiProperty({ example: 'In delivery' })
    @IsString()
    @MinLength(1)
    @MaxLength(80)
    name: string;

    @ApiProperty({ enum: ProjectStatusCategory })
    @IsEnum(ProjectStatusCategory)
    category: ProjectStatusCategory;

    @ApiProperty({ required: false, example: 'blue', description: 'Semantic color token name' })
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

    @ApiProperty({ required: false, type: [String], description: 'Slugs this status may move to; empty = any' })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    allowed_transitions?: string[];
}
export class UpdateProjectStatusDto extends PartialType(CreateProjectStatusDto) { }

/**
 * Template structure (05 §37). Offsets are days from the project's planned start.
 * { milestones: [{ key, name, offset_days, customer_visible, is_billing_milestone }],
 *   workstreams: [{ name }], deliverables: [{ name, milestone_key, customer_visible }],
 *   tasks: [{ title, milestone_key, priority, estimate_points }], checklists: [{ name, phase, items: [string] }] }
 */
export class CreateProjectTemplateDto {
    @ApiProperty({ example: 'Website build (6 weeks)' })
    @IsString()
    @MinLength(1)
    @MaxLength(160)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    type_id?: string;

    @ApiProperty({ required: false, description: 'Template structure; see class doc' })
    @IsOptional()
    @IsObject()
    structure?: Record<string, unknown>;
}

export class UpdateProjectTemplateDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(160)
    name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    type_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}

export class PublishTemplateVersionDto {
    @ApiProperty({ description: 'New immutable structure' })
    @IsObject()
    structure: Record<string, unknown>;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    change_summary?: string;
}
