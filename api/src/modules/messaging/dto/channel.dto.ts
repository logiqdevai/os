import { ApiProperty, PartialType, PickType } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { z } from 'zod';

/** Kinds a member may create directly. DMs go through POST /messaging/dms; project/customer channels through their modules. */
export const CREATABLE_CHANNEL_KINDS = ['PUBLIC', 'PRIVATE'] as const;
export type CreatableChannelKind = (typeof CREATABLE_CHANNEL_KINDS)[number];

export class CreateChannelDto {
    @ApiProperty({ example: 'design-reviews', description: 'Channel name; the #slug is derived from it (lowercase, dashes).' })
    @IsString()
    @MinLength(1)
    @MaxLength(80)
    name: string;

    @ApiProperty({ enum: CREATABLE_CHANNEL_KINDS, required: false, default: 'PUBLIC' })
    @IsOptional()
    @IsIn(CREATABLE_CHANNEL_KINDS as unknown as string[])
    kind?: CreatableChannelKind;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(250)
    topic?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(250)
    purpose?: string;

    @ApiProperty({ required: false, type: [String], description: 'Members to add on creation (Membership ids). The creator is always the owner.' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(200)
    @IsUUID('all', { each: true })
    membership_ids?: string[];
}

export class UpdateChannelDto extends PartialType(PickType(CreateChannelDto, ['name', 'description', 'topic', 'purpose'] as const)) { }

export class AddChannelMembersDto {
    @ApiProperty({ required: false, type: [String], description: 'Internal members (Membership ids).' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(200)
    @IsUUID('all', { each: true })
    membership_ids?: string[];

    @ApiProperty({ required: false, type: [String], description: 'External participants (User ids of portal users / guests). Needs messaging.external_users.manage and external access on the channel.' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(50)
    @IsUUID('all', { each: true })
    external_user_ids?: string[];
}

export class ChannelPreferencesDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_favorite?: boolean;

    @ApiProperty({ required: false, nullable: true, description: 'Mute until this time; null unmutes. Use a far-future date to mute indefinitely.' })
    @IsOptional()
    @IsDateString()
    muted_until?: string | null;
}

export class OpenDmDto {
    @ApiProperty({ type: [String], description: 'The other participants (Membership ids). 1 = direct message, 2–8 = group DM.' })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(8)
    @IsUUID('all', { each: true })
    membership_ids: string[];
}

/** Zod twins for the MCP tools (same rules as the DTOs). */
export const CreateChannelSchema = z.object({
    name: z.string().min(1).max(80),
    kind: z.enum(CREATABLE_CHANNEL_KINDS).optional(),
    description: z.string().max(1000).optional(),
    topic: z.string().max(250).optional(),
    purpose: z.string().max(250).optional(),
    membership_ids: z.array(z.string().uuid()).max(200).optional(),
});

export const OpenDmSchema = z.object({ membership_ids: z.array(z.string().uuid()).min(1).max(8) });
