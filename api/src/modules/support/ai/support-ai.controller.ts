import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { SuggestionQuery, SuggestionQuerySchema, SupportAiService } from './support-ai.service';

class ReviewSuggestionDto {
    @ApiProperty()
    @IsBoolean()
    accepted: boolean;
}

class AcceptSuggestionDto {
    @ApiProperty({ required: false, description: 'Edited text; defaults to the suggested text' })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(50000)
    body?: string;

    @ApiProperty({ required: false, enum: ['AGENT', 'INTERNAL_NOTE'], description: 'Reply suggestions: send publicly (default) or keep as an internal note' })
    @IsOptional()
    @IsIn(['AGENT', 'INTERNAL_NOTE'])
    as?: 'AGENT' | 'INTERNAL_NOTE';

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    note?: string;
}

class RejectSuggestionDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    note?: string;
}

@ApiTags('Support · AI')
@ApiBearerAuth()
@Controller('support/ai')
@UseGuards(JwtGuard, PermissionsGuard)
export class SupportAiController {
    constructor(private readonly ai: SupportAiService) { }

    @Get('status')
    @RequireAnyPermission('support.ai.use', 'support.ai.configure', 'support.conversations.read')
    @ApiOperation({ summary: 'Whether the organization connected an AI provider, the AI agent is on, and pending suggestions' })
    status(@CurrentOrg() ctx: OrgContext) {
        return this.ai.status(ctx);
    }

    @Post('conversations/:id/suggest-reply')
    @RequirePermission('support.ai.use')
    @ApiOperation({ summary: 'Draft a reply into the review queue (degrades to knowledge-base matches without an AI connection)' })
    suggestReply(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.ai.suggestReply(ctx, id);
    }

    @Post('conversations/:id/summarize')
    @RequirePermission('support.ai.use')
    @ApiOperation({ summary: 'Summarize the conversation' })
    summarize(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.ai.summarize(ctx, id);
    }

    @Get('suggestions')
    @RequirePermission('support.ai.use')
    @ApiOperation({ summary: 'AI suggestion review queue (status=PENDING by default; kind, conversation_id, ticket_id)' })
    suggestions(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(SuggestionQuerySchema)) q: SuggestionQuery) {
        return this.ai.list(ctx, q);
    }

    @Post('suggestions/:id/accept')
    @RequirePermission('support.ai.use')
    @ApiOperation({ summary: 'Accept (optionally edited); reply suggestions are sent through the conversation (needs support.conversations.reply)' })
    accept(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AcceptSuggestionDto) {
        return this.ai.accept(ctx, id, dto);
    }

    @Post('suggestions/:id/reject')
    @RequirePermission('support.ai.use')
    @ApiOperation({ summary: 'Reject a suggestion' })
    reject(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectSuggestionDto) {
        return this.ai.reject(ctx, id, dto.note);
    }

    @Post('suggestions/:id/review')
    @RequirePermission('support.ai.use')
    @ApiOperation({ summary: 'Record whether an inline suggestion was used' })
    review(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewSuggestionDto) {
        return this.ai.review(ctx, id, dto.accepted);
    }
}
