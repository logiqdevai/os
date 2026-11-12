import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { DocsAiService } from '../services/docs-ai.service';
import { AskDocsInput, AskDocsSchema } from '../dto/ai-transfer.dto';

/** 15 §6 — AI Q&A over the organization's pages (only pages the asker can read; organization's own AI key). */
@ApiTags('Docs · AI')
@ApiBearerAuth()
@Controller('docs/ai')
@UseGuards(JwtGuard, PermissionsGuard)
export class DocsAiController {
    constructor(private readonly ai: DocsAiService) { }

    @Post('ask')
    @HttpCode(200)
    @RequirePermission('docs.ai.query')
    @ApiOperation({ summary: 'Ask a question; the answer cites readable pages. Falls back to keyword passages without an AI connection.' })
    ask(@CurrentOrg() ctx: OrgContext, @Body(new ZodValidationPipe(AskDocsSchema)) dto: AskDocsInput) {
        return this.ai.ask(ctx, dto);
    }

    @Get('status')
    @RequirePermission('docs.ai.query')
    @ApiOperation({ summary: 'Index status: AI connected, semantic vs keyword mode, indexed pages' })
    status(@CurrentOrg() ctx: OrgContext) {
        return this.ai.status(ctx);
    }

    @Post('reindex')
    @HttpCode(200)
    @RequirePermission('docs.spaces.manage')
    @ApiOperation({ summary: 'Rebuild the AI index (chunks + embeddings with the organization key)' })
    reindex(@CurrentOrg() ctx: OrgContext) {
        return this.ai.reindex(ctx);
    }
}
