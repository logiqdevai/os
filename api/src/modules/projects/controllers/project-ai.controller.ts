import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { DraftStatusUpdateInput, DraftStatusUpdateSchema, ProjectAiService } from '../services/project-ai.service';

/** 05 §39–40 — AI-assisted status updates (BYOK). A draft is never published automatically. */
@ApiTags('Projects · AI')
@ApiBearerAuth()
@Controller('projects/:projectId')
@UseGuards(JwtGuard, PermissionsGuard)
export class ProjectAiController {
    constructor(private readonly ai: ProjectAiService) { }

    @Post('status-updates/draft')
    @RequirePermission('projects.status_updates.publish')
    @ApiOperation({ summary: 'Draft a status update from recent task, milestone, risk and decision changes (unpublished; available=false with facts when no AI key is connected)' })
    draft(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Body(new ZodValidationPipe(DraftStatusUpdateSchema)) dto: DraftStatusUpdateInput) {
        return this.ai.draftStatusUpdate(ctx, projectId, dto);
    }
}
