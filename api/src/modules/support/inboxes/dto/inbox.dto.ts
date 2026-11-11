import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEmail, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { SupportAgentAvailability, SupportChannelType, SupportRoutingStrategy } from 'generated/prisma';

export class CreateInboxDto {
    @ApiProperty({ example: 'Web support' })
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

    @ApiProperty({ required: false, example: 'info' })
    @IsOptional()
    @IsString()
    @MaxLength(30)
    color?: string;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    team_id?: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    branch_id?: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    default_assignee_membership_id?: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    default_sla_policy_id?: string | null;

    @ApiProperty({ required: false, enum: SupportRoutingStrategy })
    @IsOptional()
    @IsEnum(SupportRoutingStrategy)
    routing_strategy?: SupportRoutingStrategy;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsString()
    @MaxLength(4000)
    signature?: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsString()
    @MaxLength(4000)
    auto_reply_body?: string | null;
}

export class UpdateInboxDto extends PartialType(CreateInboxDto) { }

export class CreateChannelDto {
    @ApiProperty()
    @IsUUID()
    inbox_id: string;

    @ApiProperty({ enum: SupportChannelType })
    @IsEnum(SupportChannelType)
    type: SupportChannelType;

    @ApiProperty({ example: 'Support email' })
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name: string;

    @ApiProperty({ required: false, description: 'EMAIL: inbound address' })
    @IsOptional()
    @IsEmail()
    email_address?: string;

    @ApiProperty({ required: false, type: [String], description: 'Allowed https origins for the widget / API' })
    @IsOptional()
    @IsArray()
    @Matches(/^https:\/\/[^\s/]+$/, { each: true, message: 'Each origin must look like https://example.com' })
    allowed_origins?: string[];

    @ApiProperty({ required: false, description: 'Widget colours, welcome text, office hours, form fields' })
    @IsOptional()
    @IsObject()
    config?: Record<string, unknown>;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    ai_agent_enabled?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    csat_enabled?: boolean;
}

export class UpdateChannelDto extends PartialType(CreateChannelDto) { }

export class UpdateAgentProfileDto {
    @ApiProperty({ required: false, enum: SupportAgentAvailability })
    @IsOptional()
    @IsEnum(SupportAgentAvailability)
    availability?: SupportAgentAvailability;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsInt()
    @Min(1)
    @Max(500)
    max_open_conversations?: number | null;

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    skills?: string[];

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    languages?: string[];
}
