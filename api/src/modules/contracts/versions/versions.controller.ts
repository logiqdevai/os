import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ContractVersionsService } from './versions.service';
import {
    ApprovalDecisionDto, CommentsQuery, CommentsQuerySchema, CompareQuery, CompareQuerySchema, CreateCommentDto, CreateVersionDto, RequestReviewDto, ResolveCommentDto, ReviewDecisionDto,
    SubmitApprovalDto, UpdateSectionsDto, UpdateVersionDto,
} from './dto/version.dto';

const READ = 'contracts.contracts.read';

@ApiTags('Contracts · Versions, review & approval')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtGuard, PermissionsGuard)
export class ContractVersionsController {
    constructor(private readonly versions: ContractVersionsService) { }

    @Get('contract-approvals/mine') @RequirePermission('contracts.contracts.approve') @ApiOperation({ summary: 'Approvals waiting on me' })
    mine(@CurrentOrg() ctx: OrgContext) { return this.versions.myApprovals(ctx); }

    @Get('contracts/:id/compare') @RequirePermission(READ) @ApiOperation({ summary: 'Compare two versions section by section' })
    compare(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(CompareQuerySchema)) q: CompareQuery) { return this.versions.compare(ctx, id, q); }

    @Get('contracts/:id/versions/:vid') @RequirePermission(READ) @ApiOperation({ summary: 'Get a version with sections, reviews and approvals' })
    getVersion(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('vid', ParseUUIDPipe) vid: string) { return this.versions.getVersion(ctx, id, vid); }

    @Post('contracts/:id/versions') @RequirePermission('contracts.versions.create') @ApiOperation({ summary: 'New draft version (or restore an older one)' })
    createVersion(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateVersionDto) { return this.versions.createVersion(ctx, id, dto); }

    @Patch('contracts/:id/versions/:vid') @RequirePermission('contracts.contracts.update') @ApiOperation({ summary: 'Update version summary / portal visibility' })
    updateVersion(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('vid', ParseUUIDPipe) vid: string, @Body() dto: UpdateVersionDto) { return this.versions.updateVersion(ctx, id, vid, dto); }

    @Put('contracts/:id/versions/:vid/sections') @RequirePermission('contracts.contracts.update') @ApiOperation({ summary: 'Save the sections of a draft version' })
    updateSections(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('vid', ParseUUIDPipe) vid: string, @Body() dto: UpdateSectionsDto) { return this.versions.updateSections(ctx, id, vid, dto); }

    @Post('contracts/:id/versions/:vid/reviews') @RequirePermission('contracts.contracts.update') @ApiOperation({ summary: 'Request a review of a version' })
    requestReview(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('vid', ParseUUIDPipe) vid: string, @Body() dto: RequestReviewDto) { return this.versions.requestReview(ctx, id, vid, dto); }

    @Post('contracts/:id/reviews/:reviewId/decision') @RequirePermission('contracts.contracts.review') @ApiOperation({ summary: 'Decide a review (requested reviewer only)' })
    decideReview(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('reviewId', ParseUUIDPipe) reviewId: string, @Body() dto: ReviewDecisionDto) { return this.versions.decideReview(ctx, id, reviewId, dto); }

    @Get('contracts/:id/versions/:vid/approval-preview') @RequirePermission(READ) @ApiOperation({ summary: 'Matched approval rules and resulting steps' })
    approvalPreview(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('vid', ParseUUIDPipe) vid: string) { return this.versions.approvalPreview(ctx, id, vid); }

    @Post('contracts/:id/versions/:vid/submit-for-approval') @RequirePermission('contracts.contracts.update') @ApiOperation({ summary: 'Submit the version for approval' })
    submit(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('vid', ParseUUIDPipe) vid: string, @Body() dto: SubmitApprovalDto) { return this.versions.submitForApproval(ctx, id, vid, dto); }

    @Post('contracts/:id/approvals/:approvalId/decision') @RequirePermission('contracts.contracts.approve') @ApiOperation({ summary: 'Approve or reject a step (assigned approver only)' })
    decideApproval(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('approvalId', ParseUUIDPipe) approvalId: string, @Body() dto: ApprovalDecisionDto) { return this.versions.decideApproval(ctx, id, approvalId, dto); }

    @Get('contracts/:id/comments') @RequirePermission(READ) @ApiOperation({ summary: 'Comments (internal ones need contracts.comments.internal.read)' })
    listComments(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(CommentsQuerySchema)) q: CommentsQuery) { return this.versions.listComments(ctx, id, q); }

    @Post('contracts/:id/comments') @RequireAnyPermission('contracts.contracts.update', 'contracts.contracts.review') @ApiOperation({ summary: 'Add a comment' })
    createComment(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateCommentDto) { return this.versions.createComment(ctx, id, dto); }

    @Patch('contracts/:id/comments/:commentId') @RequireAnyPermission('contracts.contracts.update', 'contracts.contracts.review') @ApiOperation({ summary: 'Resolve or reopen a comment' })
    resolveComment(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('commentId', ParseUUIDPipe) commentId: string, @Body() dto: ResolveCommentDto) { return this.versions.resolveComment(ctx, id, commentId, dto); }
}
