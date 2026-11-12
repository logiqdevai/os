import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { PublishReleaseNotesInput, PublishReleaseNotesSchema, ReleaseNotesService } from '../services/release-notes.service';

/** 06 §9, §14 — release notes: AI draft (BYOK, never saved) and human publish. */
@ApiTags('Tasks · Releases')
@ApiBearerAuth()
@Controller('releases/:id/notes')
@UseGuards(JwtGuard, PermissionsGuard)
export class ReleaseNotesController {
    constructor(private readonly notes: ReleaseNotesService) { }

    @Post('draft')
    @RequirePermission('tasks.releases.manage')
    @ApiOperation({ summary: 'Draft release notes from the release tasks (returned, not saved; available=false with a task-list draft when no AI key is connected)' })
    draft(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.notes.draft(ctx, id);
    }

    @Post('publish')
    @RequirePermission('tasks.releases.manage')
    @ApiOperation({ summary: 'Save and publish the (edited) release notes' })
    publish(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(PublishReleaseNotesSchema)) dto: PublishReleaseNotesInput) {
        return this.notes.publish(ctx, id, dto);
    }
}
