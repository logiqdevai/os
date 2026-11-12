import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZBody } from '@/modules/finance-shared/zod-body.pipe';
import { AiFeedbackInput, AiFeedbackSchema, AiGenerateInput, AiGenerateSchema, CommAiService } from './comm-ai.service';

/** AI writing assistant of module 11 (organization's own OpenAI connection). */
@ApiTags('Communications · AI assistant')
@ApiBearerAuth()
@Controller('communications/ai')
@UseGuards(JwtGuard, PermissionsGuard)
export class CommAiController {
    constructor(private readonly ai: CommAiService) { }

    @Get('status')
    @RequirePermission('communications.ai.use')
    @ApiOperation({ summary: 'Whether an OpenAI connection is configured for the organization' })
    status(@CurrentOrg() ctx: OrgContext) {
        return this.ai.status(ctx);
    }

    @Post('generate')
    @RequirePermission('communications.ai.use')
    @ApiOperation({ summary: 'Subject lines, email / SMS draft, tone rewrite or translation (available=false without an AI connection)' })
    generate(@CurrentOrg() ctx: OrgContext, @Body(ZBody(AiGenerateSchema)) dto: AiGenerateInput) {
        return this.ai.generate(ctx, dto);
    }

    @Get('generations')
    @RequirePermission('communications.ai.use')
    @ApiOperation({ summary: 'My recent AI generations' })
    history(@CurrentOrg() ctx: OrgContext) {
        return this.ai.history(ctx);
    }

    @Post('generations/:id/feedback')
    @RequirePermission('communications.ai.use')
    @ApiOperation({ summary: 'Mark a suggestion kept or discarded' })
    feedback(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(AiFeedbackSchema)) dto: AiFeedbackInput) {
        return this.ai.feedback(ctx, id, dto);
    }
}
