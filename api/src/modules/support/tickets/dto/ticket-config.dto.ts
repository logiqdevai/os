import { ApiProperty, PartialType } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { TicketPriority, TicketStatusCategory } from 'generated/prisma';

export class CreateTicketStatusDto {
    @ApiProperty({ example: 'Waiting on vendor' })
    @IsString()
    @MinLength(1)
    @MaxLength(60)
    name: string;

    @ApiProperty({ enum: TicketStatusCategory })
    @IsEnum(TicketStatusCategory)
    category: TicketStatusCategory;

    @ApiProperty({ required: false, example: 'warning' })
    @IsOptional()
    @IsString()
    @MaxLength(30)
    color?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_default?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    pauses_sla?: boolean;

    @ApiProperty({ required: false, type: [String], description: 'Slugs this status may move to; empty = any' })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    allowed_transitions?: string[];

    @ApiProperty({ required: false, nullable: true, description: 'Label shown to customers in the portal' })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsString()
    @MaxLength(60)
    customer_label?: string | null;
}

export class UpdateTicketStatusDto extends PartialType(CreateTicketStatusDto) { }

export class ArchiveTicketStatusDto {
    @ApiProperty({ required: false, description: 'Move tickets currently in this status here' })
    @IsOptional()
    @IsUUID()
    replacement_status_id?: string;
}

export class ReorderDto {
    @ApiProperty({ type: [String] })
    @IsArray()
    @ArrayMaxSize(200)
    @IsUUID('all', { each: true })
    ids: string[];
}

export class CreateTicketCategoryDto {
    @ApiProperty({ example: 'Billing' })
    @IsString()
    @MinLength(1)
    @MaxLength(80)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(30)
    color?: string;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    parent_category_id?: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    default_team_id?: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    default_inbox_id?: string | null;

    @ApiProperty({ required: false, nullable: true, enum: TicketPriority })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsEnum(TicketPriority)
    default_priority?: TicketPriority | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    default_sla_policy_id?: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    default_project_id?: string | null;

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    ai_hints?: string[];
}

export class UpdateTicketCategoryDto extends PartialType(CreateTicketCategoryDto) { }
