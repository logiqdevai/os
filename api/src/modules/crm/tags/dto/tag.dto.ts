import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { RecordEntityType } from 'generated/prisma';
import { z } from 'zod';

export class CreateTagDto {
    @ApiProperty({ example: 'Enterprise' }) @IsString() @MinLength(1) @MaxLength(60) name: string;
    @ApiProperty({ required: false, description: 'Semantic tone: neutral|info|success|warning|danger|violet' }) @IsOptional() @IsString() @MaxLength(20) color?: string;
    @ApiProperty({ required: false, enum: RecordEntityType, isArray: true, description: 'Restrict to entity types (empty = any)' })
    @IsOptional() @IsArray() @IsEnum(RecordEntityType, { each: true }) entity_types?: RecordEntityType[];
}

export class UpdateTagDto extends PartialType(CreateTagDto) { }

export class MergeTagDto {
    @ApiProperty({ description: 'Tag that survives; this tag is deleted after its records move' }) @IsUUID() into_id: string;
}

export class SetTaggingsDto {
    @ApiProperty({ enum: RecordEntityType }) @IsEnum(RecordEntityType) entity_type: RecordEntityType;
    @ApiProperty() @IsUUID() entity_id: string;
    @ApiProperty({ type: [String], description: 'The full tag set of the record' }) @IsArray() @IsUUID('4', { each: true }) tag_ids: string[];
}

export const TagQuerySchema = z.object({
    entity_type: z.nativeEnum(RecordEntityType).optional(),
    search: z.string().trim().optional(),
});
export type TagQuery = z.infer<typeof TagQuerySchema>;
