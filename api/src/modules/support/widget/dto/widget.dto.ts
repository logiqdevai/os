import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { z } from 'zod';

/** First message from a website visitor (anonymous, or identified by name / email). */
export class StartWidgetConversationDto {
    @ApiProperty({ example: 'Hi, I cannot log in to the dashboard.' })
    @IsString()
    @MinLength(1)
    @MaxLength(5000)
    body: string;

    @ApiProperty({ required: false, example: 'Maria Papadopoulou' })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    name?: string;

    @ApiProperty({ required: false, example: 'maria@example.com' })
    @IsOptional()
    @IsEmail()
    @MaxLength(254)
    email?: string;

    @ApiProperty({ required: false, description: 'Page the visitor was on (shown to agents)' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    page_url?: string;
}

export class WidgetMessageDto {
    @ApiProperty()
    @IsString()
    @MinLength(1)
    @MaxLength(5000)
    body: string;
}

export const WidgetMessagesQuerySchema = z.object({
    /** Only messages created after this ISO timestamp (incremental refresh). */
    after: z.coerce.date().optional(),
});
export type WidgetMessagesQuery = z.infer<typeof WidgetMessagesQuerySchema>;
