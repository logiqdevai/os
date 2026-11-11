import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, Public, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { KnowledgeService } from './knowledge.service';
import { CsatService } from '../csat/csat.service';
import { ReorderDto } from '../tickets/dto/ticket-config.dto';
import {
    ArticleFeedbackDto,
    ArticleQuery,
    ArticleQuerySchema,
    CreateArticleDto,
    CreateKnowledgeCategoryDto,
    CsatSubmitDto,
    PublicArticleQuery,
    PublicArticleQuerySchema,
    RestoreVersionDto,
    UpdateArticleDto,
    UpdateKnowledgeCategoryDto,
} from './dto/knowledge.dto';

@ApiTags('Support · Knowledge base')
@ApiBearerAuth()
@Controller('support/knowledge')
@UseGuards(JwtGuard, PermissionsGuard)
export class KnowledgeController {
    constructor(private readonly kb: KnowledgeService) { }

    @Get('categories')
    @RequirePermission('support.knowledge.read')
    @ApiOperation({ summary: 'Help-center categories' })
    categories(@CurrentOrg() ctx: OrgContext) {
        return this.kb.categories(ctx);
    }

    @Post('categories')
    @RequirePermission('support.knowledge.update')
    @ApiOperation({ summary: 'Create a category' })
    createCategory(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateKnowledgeCategoryDto) {
        return this.kb.createCategory(ctx, dto);
    }

    @Post('categories/reorder')
    @RequirePermission('support.knowledge.update')
    @ApiOperation({ summary: 'Reorder categories' })
    reorderCategories(@CurrentOrg() ctx: OrgContext, @Body() dto: ReorderDto) {
        return this.kb.reorderCategories(ctx, dto.ids);
    }

    @Patch('categories/:id')
    @RequirePermission('support.knowledge.update')
    @ApiOperation({ summary: 'Update a category' })
    updateCategory(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateKnowledgeCategoryDto) {
        return this.kb.updateCategory(ctx, id, dto);
    }

    @Post('categories/:id/archive')
    @RequirePermission('support.knowledge.archive')
    @ApiOperation({ summary: 'Archive an empty category' })
    archiveCategory(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.kb.archiveCategory(ctx, id);
    }

    @Get('articles')
    @RequirePermission('support.knowledge.read')
    @ApiOperation({ summary: 'Articles (all statuses and visibilities)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ArticleQuerySchema)) q: ArticleQuery) {
        return this.kb.findAll(ctx, q);
    }

    @Get('articles/:id')
    @RequirePermission('support.knowledge.read')
    @ApiOperation({ summary: 'Article with versions and feedback' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.kb.findOne(ctx, id);
    }

    @Post('articles')
    @RequirePermission('support.knowledge.create')
    @ApiOperation({ summary: 'Create a draft article' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateArticleDto) {
        return this.kb.create(ctx, dto);
    }

    @Patch('articles/:id')
    @RequirePermission('support.knowledge.update')
    @ApiOperation({ summary: 'Update an article (content changes create a new version)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateArticleDto) {
        return this.kb.update(ctx, id, dto);
    }

    @Post('articles/:id/submit-review')
    @RequirePermission('support.knowledge.update')
    @ApiOperation({ summary: 'Send for review' })
    submitReview(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.kb.submitReview(ctx, id);
    }

    @Post('articles/:id/publish')
    @RequirePermission('support.knowledge.publish')
    @ApiOperation({ summary: 'Publish the article' })
    publish(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.kb.publish(ctx, id);
    }

    @Post('articles/:id/unpublish')
    @RequirePermission('support.knowledge.publish')
    @ApiOperation({ summary: 'Unpublish (back to draft)' })
    unpublish(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.kb.unpublish(ctx, id);
    }

    @Post('articles/:id/archive')
    @RequirePermission('support.knowledge.archive')
    @ApiOperation({ summary: 'Archive the article' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.kb.archive(ctx, id);
    }

    @Delete('articles/:id')
    @RequirePermission('support.knowledge.delete')
    @ApiOperation({ summary: 'Delete the article permanently' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.kb.remove(ctx, id);
    }

    @Get('articles/:id/versions/:version')
    @RequirePermission('support.knowledge.read')
    @ApiOperation({ summary: 'One version of an article' })
    version(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('version', ParseIntPipe) version: number) {
        return this.kb.version(ctx, id, version);
    }

    @Post('articles/:id/restore')
    @RequirePermission('support.knowledge.update')
    @ApiOperation({ summary: 'Restore an earlier version (as a new version)' })
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RestoreVersionDto) {
        return this.kb.restoreVersion(ctx, id, dto.version);
    }
}

/** Public help center and CSAT rating links (no login). Only PUBLIC, PUBLISHED content is served. */
@ApiTags('Public · Help center')
@Controller('help')
@UseGuards(JwtGuard)
export class HelpCenterController {
    constructor(
        private readonly kb: KnowledgeService,
        private readonly csat: CsatService,
    ) { }

    @Get('csat/:token')
    @Public()
    @ApiOperation({ summary: 'CSAT rating page by token' })
    csatPage(@Param('token', ParseUUIDPipe) token: string) {
        return this.csat.byToken(token);
    }

    @Post('csat/:token')
    @Public()
    @ApiOperation({ summary: 'Submit a CSAT rating by token' })
    csatSubmit(@Param('token', ParseUUIDPipe) token: string, @Body() dto: CsatSubmitDto) {
        return this.csat.submitByToken(token, dto.rating, dto.comment);
    }

    @Get(':orgSlug')
    @Public()
    @ApiOperation({ summary: 'Help center home: categories, FAQs, popular articles' })
    home(@Param('orgSlug') orgSlug: string) {
        return this.kb.helpCenter(orgSlug);
    }

    @Get(':orgSlug/articles')
    @Public()
    @ApiOperation({ summary: 'Search published public articles' })
    articles(@Param('orgSlug') orgSlug: string, @Query(new ZodValidationPipe(PublicArticleQuerySchema)) q: PublicArticleQuery) {
        return this.kb.publicArticles(orgSlug, q);
    }

    @Get(':orgSlug/articles/:slug')
    @Public()
    @ApiOperation({ summary: 'Read a published public article' })
    article(@Param('orgSlug') orgSlug: string, @Param('slug') slug: string) {
        return this.kb.publicArticle(orgSlug, slug);
    }

    @Post(':orgSlug/articles/:slug/feedback')
    @Public()
    @ApiOperation({ summary: 'Was this article helpful?' })
    feedback(@Param('orgSlug') orgSlug: string, @Param('slug') slug: string, @Body() dto: ArticleFeedbackDto) {
        return this.kb.feedback(orgSlug, slug, dto);
    }
}
