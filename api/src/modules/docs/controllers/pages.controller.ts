import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { DocsPagesService } from '../services/pages.service';
import {
    AddPageLinkDto,
    AnalyticsQuery,
    AnalyticsQuerySchema,
    CreateCommentDto,
    CreatePageDto,
    MarkReviewedDto,
    MovePageDto,
    PageQuery,
    PageQuerySchema,
    PublishPageDto,
    RequireAckDto,
    RestoreVersionDto,
    SearchQuery,
    SearchQuerySchema,
    SetPagePermissionsDto,
    TrashQuery,
    TrashQuerySchema,
    UpdateCommentDto,
    UpdatePageDto,
} from '../dto/page.dto';

@ApiTags('Docs · Pages')
@ApiBearerAuth()
@Controller('docs')
@UseGuards(JwtGuard, PermissionsGuard)
export class DocsPagesController {
    constructor(private readonly pages: DocsPagesService) { }

    @Get('home')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Docs home: favorites, recent, recently updated, required reading, reviews due, spaces' })
    home(@CurrentOrg() ctx: OrgContext) {
        return this.pages.home(ctx);
    }

    @Get('search')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Keyword search over page titles and content (permission-filtered)' })
    search(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(SearchQuerySchema)) query: SearchQuery) {
        return this.pages.search(ctx, query);
    }

    @Get('trash')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Archived or deleted pages' })
    trashList(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TrashQuerySchema)) query: TrashQuery) {
        return this.pages.trashList(ctx, query);
    }

    @Get('analytics')
    @RequirePermission('docs.analytics.read')
    @ApiOperation({ summary: 'Content health, reader and search analytics' })
    analytics(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(AnalyticsQuerySchema)) query: AnalyticsQuery) {
        return this.pages.analytics(ctx, query);
    }

    @Get('pages')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'List pages (filters: space, parent, status, type, owner, review)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(PageQuerySchema)) query: PageQuery) {
        return this.pages.findAll(ctx, query);
    }

    @Get('pages/:id')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Get a page with breadcrumbs, children and the caller access' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.pages.findOne(ctx, id);
    }

    @Post('pages')
    @RequirePermission('docs.pages.create')
    @ApiOperation({ summary: 'Create a page (optionally from a template, optionally published)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreatePageDto) {
        return this.pages.create(ctx, dto);
    }

    @Patch('pages/:id')
    @RequirePermission('docs.pages.update')
    @ApiOperation({ summary: 'Save a page; a content/title change creates a new version' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePageDto) {
        return this.pages.update(ctx, id, dto);
    }

    @Post('pages/:id/move')
    @RequirePermission('docs.pages.update')
    @ApiOperation({ summary: 'Move / reorder a page in the tree' })
    move(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MovePageDto) {
        return this.pages.move(ctx, id, dto);
    }

    @Post('pages/:id/publish')
    @RequirePermission('docs.pages.publish')
    @ApiOperation({ summary: 'Publish the current version' })
    publish(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PublishPageDto) {
        return this.pages.publish(ctx, id, dto.change_summary);
    }

    @Post('pages/:id/unpublish')
    @RequirePermission('docs.pages.publish')
    @ApiOperation({ summary: 'Move a published page back to draft' })
    unpublish(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.pages.unpublish(ctx, id);
    }

    @Post('pages/:id/archive')
    @RequirePermission('docs.pages.archive')
    @ApiOperation({ summary: 'Archive a page' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.pages.setArchived(ctx, id, true);
    }

    @Post('pages/:id/unarchive')
    @RequirePermission('docs.pages.archive')
    @ApiOperation({ summary: 'Unarchive a page' })
    unarchive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.pages.setArchived(ctx, id, false);
    }

    @Post('pages/:id/trash')
    @RequirePermission('docs.pages.archive')
    @ApiOperation({ summary: 'Move a page and its subtree to trash' })
    trash(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.pages.trash(ctx, id);
    }

    @Post('pages/:id/restore')
    @RequirePermission('docs.pages.archive')
    @ApiOperation({ summary: 'Restore a page from trash' })
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.pages.restore(ctx, id);
    }

    @Delete('pages/:id')
    @RequirePermission('docs.pages.delete')
    @ApiOperation({ summary: 'Permanently delete a trashed page (sensitive)' })
    purge(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.pages.purge(ctx, id);
    }

    // --- Versions --------------------------------------------------------------------------

    @Get('pages/:id/versions')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Version history' })
    versions(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.pages.versions(ctx, id);
    }

    @Get('pages/:id/versions/:n')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'One version snapshot' })
    version(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('n', ParseIntPipe) n: number) {
        return this.pages.version(ctx, id, n);
    }

    @Post('pages/:id/versions/:n/restore')
    @RequirePermission('docs.pages.update')
    @ApiOperation({ summary: 'Restore a version (creates a new version)' })
    restoreVersion(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('n', ParseIntPipe) n: number, @Body() dto: RestoreVersionDto) {
        return this.pages.restoreVersion(ctx, id, n, dto.change_summary);
    }

    // --- Permissions -----------------------------------------------------------------------

    @Get('pages/:id/permissions')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Page visibility and grants' })
    permissions(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.pages.permissions(ctx, id);
    }

    @Put('pages/:id/permissions')
    @RequirePermission('docs.pages.update')
    @ApiOperation({ summary: 'Replace page visibility and grants (needs MANAGE on the page)' })
    setPermissions(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetPagePermissionsDto) {
        return this.pages.setPermissions(ctx, id, dto);
    }

    // --- Comments --------------------------------------------------------------------------

    @Get('pages/:id/comments')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Page comments' })
    comments(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.pages.comments(ctx, id);
    }

    @Post('pages/:id/comments')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Add a comment (needs COMMENT level on the page)' })
    addComment(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateCommentDto) {
        return this.pages.addComment(ctx, id, dto);
    }

    @Patch('pages/:id/comments/:commentId')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Edit your comment' })
    updateComment(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('commentId', ParseUUIDPipe) commentId: string, @Body() dto: UpdateCommentDto) {
        return this.pages.updateComment(ctx, id, commentId, dto.body);
    }

    @Post('pages/:id/comments/:commentId/resolve')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Resolve a comment thread' })
    resolve(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('commentId', ParseUUIDPipe) commentId: string) {
        return this.pages.resolveComment(ctx, id, commentId, true);
    }

    @Post('pages/:id/comments/:commentId/reopen')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Reopen a resolved comment thread' })
    reopen(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('commentId', ParseUUIDPipe) commentId: string) {
        return this.pages.resolveComment(ctx, id, commentId, false);
    }

    @Delete('pages/:id/comments/:commentId')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Delete a comment (author or page manager)' })
    deleteComment(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('commentId', ParseUUIDPipe) commentId: string) {
        return this.pages.deleteComment(ctx, id, commentId);
    }

    // --- Favorites, views, acknowledgements, reviews ---------------------------------------

    @Post('pages/:id/favorite')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Star a page' })
    favorite(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.pages.setFavorite(ctx, id, true);
    }

    @Delete('pages/:id/favorite')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Unstar a page' })
    unfavorite(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.pages.setFavorite(ctx, id, false);
    }

    @Post('pages/:id/view')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Record a page view (reader analytics)' })
    view(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.pages.recordView(ctx, id);
    }

    @Post('pages/:id/acknowledge')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Acknowledge that you read the current published version' })
    acknowledge(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.pages.acknowledge(ctx, id);
    }

    @Get('pages/:id/acknowledgements')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Who acknowledged the page' })
    acknowledgements(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.pages.acknowledgements(ctx, id);
    }

    @Post('pages/:id/acknowledgements')
    @RequirePermission('docs.pages.update')
    @ApiOperation({ summary: 'Require members to acknowledge the page' })
    requireAck(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RequireAckDto) {
        return this.pages.requireAcknowledgement(ctx, id, dto);
    }

    @Post('pages/:id/review')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Mark the page reviewed (owner, reviewer or editor)' })
    review(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MarkReviewedDto) {
        return this.pages.markReviewed(ctx, id, dto);
    }

    // --- Links -----------------------------------------------------------------------------

    @Get('pages/:id/links')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Outgoing record links and backlinks from other pages' })
    links(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.pages.links(ctx, id);
    }

    @Post('pages/:id/links')
    @RequirePermission('docs.pages.update')
    @ApiOperation({ summary: 'Link a platform record to the page' })
    addLink(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddPageLinkDto) {
        return this.pages.addLink(ctx, id, dto);
    }

    @Delete('pages/:id/links/:linkId')
    @RequirePermission('docs.pages.update')
    @ApiOperation({ summary: 'Remove a record link' })
    removeLink(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('linkId', ParseUUIDPipe) linkId: string) {
        return this.pages.removeLink(ctx, id, linkId);
    }
}
