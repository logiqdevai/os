import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { z } from 'zod';

export const NOTE_ENTITY_TYPES = ['CRM_COMPANY', 'CRM_CONTACT', 'CRM_LEAD', 'CRM_DEAL'] as const;
export type NoteEntityType = (typeof NOTE_ENTITY_TYPES)[number];

export class CreateNoteDto {
    @ApiProperty({ enum: NOTE_ENTITY_TYPES }) @IsIn(NOTE_ENTITY_TYPES) entity_type: NoteEntityType;
    @ApiProperty() @IsUUID() entity_id: string;
    @ApiProperty({ description: 'Markdown body' }) @IsString() @MinLength(1) @MaxLength(20000) body: string;
    @ApiProperty({ required: false, description: 'Visible only to the author and holders of crm.notes.private.read' }) @IsOptional() @IsBoolean() is_private?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() pinned?: boolean;
    @ApiProperty({ required: false, type: [String], description: 'Mentioned membership ids (notified)' }) @IsOptional() @IsArray() @IsUUID('4', { each: true }) mentions?: string[];
}

export class UpdateNoteDto {
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MinLength(1) @MaxLength(20000) body?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() is_private?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() pinned?: boolean;
    @ApiProperty({ required: false, type: [String] }) @IsOptional() @IsArray() @IsUUID('4', { each: true }) mentions?: string[];
}

export const NoteQuerySchema = z.object({
    entity_type: z.enum(NOTE_ENTITY_TYPES),
    entity_id: z.string().uuid(),
});
export type NoteQuery = z.infer<typeof NoteQuerySchema>;

export const CreateNoteSchema = z.object({
    entity_type: z.enum(NOTE_ENTITY_TYPES),
    entity_id: z.string().uuid(),
    body: z.string().min(1).max(20000),
    is_private: z.boolean().optional(),
    pinned: z.boolean().optional(),
    mentions: z.array(z.string().uuid()).optional(),
});
