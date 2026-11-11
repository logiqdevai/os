import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { AnnouncementStatus, NotificationPriority } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

/** Announcement.audience — null = every active member. */
export class AnnouncementAudienceDto {
    @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(500) @IsUUID('all', { each: true }) membership_ids?: string[];
    @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(100) @IsUUID('all', { each: true }) team_ids?: string[];
    @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(100) @IsUUID('all', { each: true }) branch_ids?: string[];
}

export class CreateAnnouncementDto {
    @ApiProperty({ example: 'Planned maintenance on Saturday' }) @IsString() @MinLength(1) @MaxLength(200) title: string;
    @ApiProperty({ example: 'The platform is unavailable 02:00–03:00 UTC.' }) @IsString() @MinLength(1) @MaxLength(10000) body: string;
    @ApiPropertyOptional({ enum: NotificationPriority }) @IsOptional() @IsEnum(NotificationPriority) severity?: NotificationPriority;
    @ApiPropertyOptional({ type: AnnouncementAudienceDto, nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @ValidateNested() @Type(() => AnnouncementAudienceDto) audience?: AnnouncementAudienceDto | null;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() requires_ack?: boolean;
    @ApiPropertyOptional({ nullable: true, description: 'Publish automatically at this moment (status SCHEDULED)' }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() publish_at?: string | null;
    @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() expires_at?: string | null;
}

export class UpdateAnnouncementDto extends PartialType(CreateAnnouncementDto) { }

export const AnnouncementQuerySchema = BaseListQuerySchema.extend({
    status: z.nativeEnum(AnnouncementStatus).optional(),
});
export type AnnouncementQuery = z.infer<typeof AnnouncementQuerySchema>;

export const CreateAnnouncementSchema = z.object({
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(10000),
    severity: z.nativeEnum(NotificationPriority).optional(),
    audience: z.object({ membership_ids: z.array(z.string().uuid()).optional(), team_ids: z.array(z.string().uuid()).optional(), branch_ids: z.array(z.string().uuid()).optional() }).nullable().optional(),
    requires_ack: z.boolean().optional(),
    publish_at: z.string().datetime().nullable().optional(),
    expires_at: z.string().datetime().nullable().optional(),
});
