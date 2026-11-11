import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { DocsChecklistsService } from '../services/checklists.service';
import {
    ChecklistQuery,
    ChecklistQuerySchema,
    CreateChecklistDto,
    ReplaceChecklistItemsDto,
    RunQuery,
    RunQuerySchema,
    SkipRunItemDto,
    StartChecklistRunDto,
    UpdateChecklistDto,
} from '../dto/checklist.dto';

@ApiTags('Docs · Checklists')
@ApiBearerAuth()
@Controller('docs')
@UseGuards(JwtGuard, PermissionsGuard)
export class DocsChecklistsController {
    constructor(private readonly checklists: DocsChecklistsService) { }

    @Get('checklists')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'List onboarding / offboarding checklists' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ChecklistQuerySchema)) query: ChecklistQuery) {
        return this.checklists.findAll(ctx, query);
    }

    @Get('checklists/:id')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Get a checklist with its items' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.checklists.findOne(ctx, id);
    }

    @Post('checklists')
    @RequirePermission('docs.checklists.manage')
    @ApiOperation({ summary: 'Create a checklist (with items)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateChecklistDto) {
        return this.checklists.create(ctx, dto);
    }

    @Patch('checklists/:id')
    @RequirePermission('docs.checklists.manage')
    @ApiOperation({ summary: 'Update checklist settings' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateChecklistDto) {
        return this.checklists.update(ctx, id, dto);
    }

    @Put('checklists/:id/items')
    @RequirePermission('docs.checklists.manage')
    @ApiOperation({ summary: 'Replace the ordered item list' })
    replaceItems(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplaceChecklistItemsDto) {
        return this.checklists.replaceItems(ctx, id, dto.items);
    }

    @Post('checklists/:id/archive')
    @RequirePermission('docs.checklists.manage')
    @ApiOperation({ summary: 'Archive a checklist' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.checklists.setArchived(ctx, id, true);
    }

    @Post('checklists/:id/unarchive')
    @RequirePermission('docs.checklists.manage')
    @ApiOperation({ summary: 'Unarchive a checklist' })
    unarchive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.checklists.setArchived(ctx, id, false);
    }

    @Post('checklists/:id/runs')
    @RequirePermission('docs.checklists.manage')
    @ApiOperation({ summary: 'Start a run of the checklist for a member' })
    start(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StartChecklistRunDto) {
        return this.checklists.startRun(ctx, id, dto);
    }

    @Get('runs')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Checklist runs (own runs; all runs with docs.checklists.manage)' })
    runs(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(RunQuerySchema)) query: RunQuery) {
        return this.checklists.findRuns(ctx, query);
    }

    @Get('runs/:id')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'One run with item states' })
    run(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.checklists.findRun(ctx, id);
    }

    @Post('runs/:id/items/:itemId/complete')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Complete a run item (subject, assignee or manager)' })
    complete(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string) {
        return this.checklists.completeItem(ctx, id, itemId);
    }

    @Post('runs/:id/items/:itemId/reopen')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Reopen a run item' })
    reopenItem(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string) {
        return this.checklists.reopenItem(ctx, id, itemId);
    }

    @Post('runs/:id/items/:itemId/skip')
    @RequirePermission('docs.checklists.manage')
    @ApiOperation({ summary: 'Skip a run item with a reason' })
    skip(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string, @Body() dto: SkipRunItemDto) {
        return this.checklists.skipItem(ctx, id, itemId, dto.reason);
    }

    @Post('runs/:id/cancel')
    @RequirePermission('docs.checklists.manage')
    @ApiOperation({ summary: 'Cancel a run' })
    cancel(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.checklists.cancelRun(ctx, id);
    }
}
