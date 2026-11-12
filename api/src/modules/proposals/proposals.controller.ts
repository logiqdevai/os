import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { streamable } from '@/modules/files/utils/streamable.utils';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { boolish } from '@/shared/utils/pagination/pagination.utils';
import { ProposalsService } from './proposals.service';
import { ProposalFlowService } from './proposal-flow.service';
import { ProposalPdfService } from './proposal-pdf.service';
import {
    ApprovalDecisionDto, ConvertProposalDto, CreateProposalCommentDto, CreateProposalDto, CreateVersionDto, MarkLostDto, ResolveCommentDto, SaveProposalContentDto, SendProposalDto, SubmitForReviewDto, UpdateProposalDto,
} from './dto/proposal.dto';
import { LookupQuery, LookupQuerySchema, ProposalAnalyticsQuery, ProposalAnalyticsQuerySchema, ProposalQuery, ProposalQuerySchema, ProposalTrackingQuery, ProposalTrackingQuerySchema } from './dto/proposal-query.schema';
import { ProposalTrackingService } from './proposal-tracking.service';
import { AiApplyProposalDto, AiApplyProposalSchema, AiGenerateProposalDto, AiGenerateProposalSchema, ProposalAiService } from './proposal-ai.service';

const VersionQuery = z.object({ version_id: z.string().uuid().optional() });
const CompareQuery = z.object({ from: z.string().uuid(), to: z.string().uuid() });
const CommentQuery = z.object({ version_id: z.string().uuid().optional(), section_id: z.string().uuid().optional(), resolved: boolish });

@ApiTags('Proposals')
@ApiBearerAuth()
@Controller('proposals')
@UseGuards(JwtGuard, PermissionsGuard)
export class ProposalsController {
    constructor(
        private readonly proposals: ProposalsService,
        private readonly flow: ProposalFlowService,
        private readonly pdf: ProposalPdfService,
        private readonly trackingService: ProposalTrackingService,
        private readonly ai: ProposalAiService,
    ) { }

    // --- Collection ----------------------------------------------------------------------------

    @Get()
    @RequirePermission('proposals.proposals.read')
    @ApiOperation({ summary: 'List proposals (scoped). Filters: status (csv), owner=me, company_id, deal_id, project_id, expiring_within_days, archived, search' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ProposalQuerySchema)) query: ProposalQuery) {
        return this.proposals.findAll(ctx, query);
    }

    @Get('summary')
    @RequirePermission('proposals.proposals.read')
    @ApiOperation({ summary: 'KPI strip: open value, accepted (90d), win rate, awaiting approval, expiring in 7 days' })
    summary(@CurrentOrg() ctx: OrgContext) {
        return this.proposals.summary(ctx);
    }

    @Get('analytics')
    @RequirePermission('proposals.analytics.read')
    @ApiOperation({ summary: 'Funnel, win rate, values, months, owners, lost reasons' })
    analytics(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ProposalAnalyticsQuerySchema)) query: ProposalAnalyticsQuery) {
        return this.flow.analytics(ctx, query);
    }

    @Get('tracking')
    @RequirePermission('proposals.proposals.read')
    @ApiOperation({ summary: 'Customer activity across proposals: views, time on page, opened sections, downloads, decisions, hot / not opened (scoped)' })
    tracking(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ProposalTrackingQuerySchema)) query: ProposalTrackingQuery) {
        return this.trackingService.tracking(ctx, query);
    }

    @Get('ai/status')
    @RequirePermission('proposals.ai.generate')
    @ApiOperation({ summary: 'Whether the organization has an active OpenAI connection (BYOK) for proposal drafting' })
    aiStatus(@CurrentOrg() ctx: OrgContext) {
        return this.ai.status(ctx);
    }

    @Get('approvals/mine')
    @RequirePermission('proposals.proposals.approve')
    @ApiOperation({ summary: 'Approval steps waiting for the caller' })
    myApprovals(@CurrentOrg() ctx: OrgContext) {
        return this.flow.myApprovals(ctx);
    }

    @Get('lookups')
    @RequireAnyPermission('proposals.proposals.create', 'proposals.proposals.update')
    @ApiOperation({ summary: 'Picker options (ids + labels): companies, contacts, deals, projects, members' })
    lookups(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(LookupQuerySchema)) query: LookupQuery) {
        return this.proposals.lookups(ctx, query);
    }

    @Post()
    @RequirePermission('proposals.proposals.create')
    @ApiOperation({ summary: 'Create a proposal (number allocated from NumberSequence; totals computed by the server)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateProposalDto) {
        return this.proposals.create(ctx, dto);
    }

    // --- Record ----------------------------------------------------------------------------------

    @Get(':id')
    @RequirePermission('proposals.proposals.read')
    @ApiOperation({ summary: 'Proposal with versions and the selected (default current) version content' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(VersionQuery)) q: { version_id?: string }) {
        return this.proposals.findOne(ctx, id, q.version_id);
    }

    @Patch(':id')
    @RequirePermission('proposals.proposals.update')
    @ApiOperation({ summary: 'Update header fields (customer, owner, validity, link access, reminders)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProposalDto) {
        return this.proposals.update(ctx, id, dto);
    }

    @Delete(':id')
    @RequirePermission('proposals.proposals.delete')
    @ApiOperation({ summary: 'Delete a proposal that was never sent' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.proposals.remove(ctx, id);
    }

    @Post(':id/duplicate')
    @RequirePermission('proposals.proposals.create')
    @ApiOperation({ summary: 'Copy the current version into a new draft proposal' })
    duplicate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.proposals.duplicate(ctx, id);
    }

    @Post(':id/archive')
    @RequirePermission('proposals.proposals.archive')
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.proposals.archive(ctx, id);
    }

    @Post(':id/restore')
    @RequirePermission('proposals.proposals.archive')
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.proposals.archive(ctx, id, true);
    }

    @Post(':id/cancel')
    @RequirePermission('proposals.proposals.cancel')
    @ApiOperation({ summary: 'Cancel (the customer link stops working)' })
    cancel(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.proposals.cancel(ctx, id);
    }

    @Post(':id/mark-lost')
    @RequirePermission('proposals.proposals.update')
    @ApiOperation({ summary: 'Record a lost proposal with a reason' })
    markLost(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MarkLostDto) {
        return this.proposals.markLost(ctx, id, dto);
    }

    @Get(':id/pdf')
    @RequirePermission('proposals.proposals.read')
    @ApiOperation({ summary: 'Version as a branded PDF (default current). Sent versions are stored once in Files (ProposalVersion.pdf_document_id)' })
    async downloadPdf(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(VersionQuery)) q: { version_id?: string }): Promise<StreamableFile> {
        return streamable(await this.pdf.download(ctx, id, q.version_id));
    }

    @Get(':id/activity')
    @RequirePermission('proposals.proposals.read')
    @ApiOperation({ summary: 'Tracking: ProposalEvent and ProposalDelivery rows' })
    activity(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.proposals.activity(ctx, id);
    }

    // --- Versions & content ---------------------------------------------------------------------------

    @Post(':id/versions')
    @RequirePermission('proposals.proposals.update')
    @ApiOperation({ summary: 'New draft version (revision of the current one, or restore from `from_version_id`)' })
    createVersion(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateVersionDto) {
        return this.proposals.createVersion(ctx, id, dto);
    }

    @Put(':id/versions/:versionId/content')
    @RequirePermission('proposals.proposals.update')
    @ApiOperation({ summary: 'Replace sections / line items / payment schedule of a DRAFT version (409 when locked)' })
    saveContent(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('versionId', ParseUUIDPipe) versionId: string, @Body() dto: SaveProposalContentDto) {
        return this.proposals.saveContent(ctx, id, versionId, dto);
    }

    @Get(':id/compare')
    @RequirePermission('proposals.proposals.read')
    @ApiOperation({ summary: 'Diff two versions (sections, lines, schedule, totals)' })
    compare(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(CompareQuery)) q: { from: string; to: string }) {
        return this.proposals.compare(ctx, id, q.from, q.to);
    }

    // --- Review & approval ------------------------------------------------------------------------------

    @Get(':id/versions/:versionId/review-preview')
    @RequirePermission('proposals.proposals.read')
    @ApiOperation({ summary: 'Approval rules that match this version and the steps they would request' })
    reviewPreview(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('versionId', ParseUUIDPipe) versionId: string) {
        return this.flow.evaluateRules(ctx, id, versionId);
    }

    @Post(':id/versions/:versionId/submit-for-review')
    @RequirePermission('proposals.proposals.update')
    @ApiOperation({ summary: 'Request approval (rule steps + manual approvers). No matching rule = approved' })
    submit(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('versionId', ParseUUIDPipe) versionId: string, @Body() dto: SubmitForReviewDto) {
        return this.flow.submitForReview(ctx, id, versionId, dto);
    }

    @Get(':id/approvals/:approvalId')
    @RequirePermission('proposals.proposals.read')
    getApproval(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('approvalId', ParseUUIDPipe) approvalId: string) {
        return this.flow.getApproval(ctx, id, approvalId);
    }

    @Post(':id/approvals/:approvalId/decision')
    @RequirePermission('proposals.proposals.approve')
    @ApiOperation({ summary: 'Approve, reject or request changes on one approval step (assigned approver only)' })
    decide(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('approvalId', ParseUUIDPipe) approvalId: string, @Body() dto: ApprovalDecisionDto) {
        return this.flow.decide(ctx, id, approvalId, dto);
    }

    // --- Send ----------------------------------------------------------------------------------------------

    @Get(':id/send-preview')
    @RequirePermission('proposals.proposals.send')
    @ApiOperation({ summary: 'Pre-send checklist, default recipients and validity' })
    sendPreview(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(VersionQuery)) q: { version_id?: string }) {
        return this.flow.sendPreview(ctx, id, q.version_id);
    }

    @Post(':id/send')
    @RequirePermission('proposals.proposals.send')
    @ApiOperation({ summary: 'Send: locks the version, creates deliveries and the public link (returned once)' })
    send(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SendProposalDto) {
        return this.flow.send(ctx, id, dto);
    }

    @Post(':id/share-link')
    @RequirePermission('proposals.proposals.send')
    @ApiOperation({ summary: 'Create a new customer link (the previous one stops working)' })
    rotateLink(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.flow.rotateLink(ctx, id);
    }

    // --- Comments --------------------------------------------------------------------------------------------

    @Get(':id/comments')
    @RequirePermission('proposals.proposals.read')
    @ApiOperation({ summary: 'Comments (internal ones only with proposals.comments.internal.read)' })
    comments(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(CommentQuery)) q: z.infer<typeof CommentQuery>) {
        return this.flow.comments(ctx, id, q);
    }

    @Post(':id/comments')
    @RequirePermission('proposals.proposals.read')
    @ApiOperation({ summary: 'Add a comment (internal needs proposals.comments.internal.read; customer-visible needs proposals.proposals.update)' })
    addComment(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateProposalCommentDto) {
        return this.flow.addComment(ctx, id, dto);
    }

    @Patch(':id/comments/:commentId')
    @RequirePermission('proposals.proposals.update')
    resolveComment(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('commentId', ParseUUIDPipe) commentId: string, @Body() dto: ResolveCommentDto) {
        return this.flow.resolveComment(ctx, id, commentId, dto.resolved);
    }

    // --- AI (drafts only; humans apply) ---------------------------------------------------------------

    @Post(':id/ai/generate')
    @RequirePermission('proposals.ai.generate')
    @ApiOperation({ summary: 'Draft sections + line items from the CRM deal, its notes and your notes (organization OpenAI key). Returns a draft; nothing is saved' })
    aiGenerate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AiGenerateProposalSchema)) dto: AiGenerateProposalDto) {
        return this.ai.generate(ctx, id, dto);
    }

    @Post(':id/ai/apply')
    @RequirePermission('proposals.ai.generate', 'proposals.proposals.update')
    @ApiOperation({ summary: 'Apply a reviewed AI draft to a DRAFT version (append or replace); marks the content as AI generated' })
    aiApply(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AiApplyProposalSchema)) dto: AiApplyProposalDto) {
        return this.ai.apply(ctx, id, dto);
    }

    // --- Conversion --------------------------------------------------------------------------------------------

    @Post(':id/convert')
    @RequirePermission('proposals.proposals.convert')
    @ApiOperation({ summary: 'Accepted proposal → draft contract (also needs contracts.contracts.create)' })
    convert(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConvertProposalDto) {
        return this.flow.convert(ctx, id, dto);
    }
}
