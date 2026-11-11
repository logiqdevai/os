import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { SupportAiService } from './support-ai.service';

class ReviewSuggestionDto {
    @ApiProperty()
    @IsBoolean()
    accepted: boolean;
}

@ApiTags('Support · AI')
@ApiBearerAuth()
@Controller('support/ai')
@UseGuards(JwtGuard, PermissionsGuard)
export class SupportAiController {
    constructor(private readonly ai: SupportAiService) { }

    @Get('status')
    @RequireAnyPermission('support.ai.use', 'support.ai.configure', 'support.conversations.read')
    @ApiOperation({ summary: 'Whether the organization connected an AI provider and the AI agent is on' })
    status(@CurrentOrg() ctx: OrgContext) {
        return this.ai.status(ctx);
    }

    @Post('conversations/:id/suggest-reply')
    @RequirePermission('support.ai.use')
    @ApiOperation({ summary: 'Draft a reply (degrades to knowledge-base matches without an AI connection)' })
    suggestReply(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.ai.suggestReply(ctx, id);
    }

    @Post('conversations/:id/summarize')
    @RequirePermission('support.ai.use')
    @ApiOperation({ summary: 'Summarize the conversation' })
    summarize(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.ai.summarize(ctx, id);
    }

    @Post('suggestions/:id/review')
    @RequirePermission('support.ai.use')
    @ApiOperation({ summary: 'Record whether a suggestion was used' })
    review(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewSuggestionDto) {
        return this.ai.review(ctx, id, dto.accepted);
    }
}
