import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { PortalGuard } from '../common/portal.guard';
import { CurrentPortal, PortalContext, PortalMember, RequirePortalPermission } from '../common/portal-context';
import { PortalCustomerService } from './portal-customer.service';
import {
    CreatePortalRequestDto,
    DeliverableReviewDto,
    PortalListQuery,
    PortalListQuerySchema,
    PortalMessageDto,
    PortalRatingDto,
    PortalTeamInviteDto,
    PortalTeamUpdateDto,
    ProfileChangeRequestDto,
    StartPortalConversationDto,
    UpdatePortalRequestDto,
} from './dto/portal-customer.dto';

class KnowledgeFeedbackDto {
    @ApiProperty()
    @IsBoolean()
    is_helpful: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    comment?: string;
}

/** Session bootstrap that needs only a signed-in user (before a company is chosen). */
@ApiTags('Customer portal')
@ApiBearerAuth()
@Controller('portal/me')
@UseGuards(JwtGuard)
export class PortalSessionController {
    constructor(private readonly portal: PortalCustomerService) { }

    @Get('memberships')
    @ApiOperation({ summary: 'Companies the signed-in user can open in the portal' })
    memberships(@CurrentUser('id') userId: string) {
        return this.portal.memberships(userId);
    }
}

/**
 * Customer portal API. Guards: JwtGuard → PortalGuard (portal.* keys of the caller's customer role only).
 * Send `X-Portal-Membership-Id` (from GET /portal/me/memberships) when the user belongs to several companies.
 */
@ApiTags('Customer portal')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Portal-Membership-Id', required: false })
@Controller('portal')
@UseGuards(JwtGuard, PortalGuard)
export class PortalCustomerController {
    constructor(private readonly portal: PortalCustomerService) { }

    @Get('me')
    @PortalMember()
    @ApiOperation({ summary: 'Portal session: company, role, portal.* permissions, features, branding' })
    me(@CurrentPortal() p: PortalContext) {
        return this.portal.me(p);
    }

    @Get('dashboard')
    @PortalMember()
    @ApiOperation({ summary: 'Dashboard widgets the caller may see' })
    dashboard(@CurrentPortal() p: PortalContext) {
        return this.portal.dashboard(p);
    }

    // --- Projects & approvals ------------------------------------------------------------------

    @Get('projects')
    @RequirePortalPermission('portal.projects.read')
    @ApiOperation({ summary: 'Customer-visible projects' })
    projects(@CurrentPortal() p: PortalContext, @Query(new ZodValidationPipe(PortalListQuerySchema)) q: PortalListQuery) {
        return this.portal.projects(p, q);
    }

    @Get('projects/:id')
    @RequirePortalPermission('portal.projects.read')
    @ApiOperation({ summary: 'Project: milestones, deliverables, published updates, customer-visible tasks, team' })
    project(@CurrentPortal() p: PortalContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.portal.project(p, id);
    }

    @Get('approvals')
    @RequirePortalPermission('portal.deliverables.approve', 'portal.projects.read')
    @ApiOperation({ summary: 'Deliverables waiting for review (status=decided for history)' })
    approvals(@CurrentPortal() p: PortalContext, @Query(new ZodValidationPipe(PortalListQuerySchema)) q: PortalListQuery) {
        return this.portal.approvals(p, q);
    }

    @Post('deliverables/:id/review')
    @RequirePortalPermission('portal.deliverables.approve')
    @ApiOperation({ summary: 'Approve, request changes or reject a deliverable' })
    review(@CurrentPortal() p: PortalContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DeliverableReviewDto) {
        return this.portal.reviewDeliverable(p, id, dto);
    }

    // --- Requests --------------------------------------------------------------------------------

    @Get('requests')
    @RequirePortalPermission('portal.requests.read')
    @ApiOperation({ summary: "Your company's requests (status=open|closed)" })
    requests(@CurrentPortal() p: PortalContext, @Query(new ZodValidationPipe(PortalListQuerySchema)) q: PortalListQuery) {
        return this.portal.requests(p, q);
    }

    @Get('requests/:idOrReference')
    @RequirePortalPermission('portal.requests.read')
    @ApiOperation({ summary: 'One request with its public thread (internal notes are never returned)' })
    request(@CurrentPortal() p: PortalContext, @Param('idOrReference') idOrReference: string) {
        return this.portal.request(p, idOrReference);
    }

    @Post('requests')
    @RequirePortalPermission('portal.requests.create')
    @ApiOperation({ summary: 'Open a request (creates a support ticket, source PORTAL)' })
    createRequest(@CurrentPortal() p: PortalContext, @Body() dto: CreatePortalRequestDto) {
        return this.portal.createRequest(p, dto);
    }

    @Patch('requests/:id')
    @RequirePortalPermission('portal.requests.create')
    @ApiOperation({ summary: 'Edit a request while nobody is working on it yet' })
    updateRequest(@CurrentPortal() p: PortalContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePortalRequestDto) {
        return this.portal.updateRequest(p, id, dto);
    }

    @Post('requests/:id/replies')
    @RequirePortalPermission('portal.requests.create')
    @ApiOperation({ summary: 'Reply on a request' })
    reply(@CurrentPortal() p: PortalContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PortalMessageDto) {
        return this.portal.replyToRequest(p, id, dto.body);
    }

    @Post('requests/:id/rating')
    @RequirePortalPermission('portal.requests.create')
    @ApiOperation({ summary: 'Rate the support received on a resolved request' })
    rate(@CurrentPortal() p: PortalContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PortalRatingDto) {
        return this.portal.rateRequest(p, id, dto.rating, dto.comment);
    }

    // --- Messages (support conversations) ------------------------------------------------------

    @Get('conversations')
    @RequirePortalPermission('portal.conversations.participate')
    @ApiOperation({ summary: 'Your support conversations' })
    conversations(@CurrentPortal() p: PortalContext, @Query(new ZodValidationPipe(PortalListQuerySchema)) q: PortalListQuery) {
        return this.portal.conversationsList(p, q);
    }

    @Get('conversations/:id')
    @RequirePortalPermission('portal.conversations.participate')
    @ApiOperation({ summary: 'One conversation (public messages only); marks it read' })
    conversation(@CurrentPortal() p: PortalContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.portal.conversation(p, id);
    }

    @Post('conversations')
    @RequirePortalPermission('portal.conversations.participate')
    @ApiOperation({ summary: 'Send a new message to the team' })
    start(@CurrentPortal() p: PortalContext, @Body() dto: StartPortalConversationDto) {
        return this.portal.startConversation(p, dto);
    }

    @Post('conversations/:id/messages')
    @RequirePortalPermission('portal.conversations.participate')
    @ApiOperation({ summary: 'Reply in a conversation' })
    message(@CurrentPortal() p: PortalContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PortalMessageDto) {
        return this.portal.postConversationMessage(p, id, dto.body);
    }

    // --- Documents, agreements, billing --------------------------------------------------------

    @Get('documents')
    @RequirePortalPermission('portal.documents.read')
    @ApiOperation({ summary: 'Customer-visible documents of your company and projects' })
    documents(@CurrentPortal() p: PortalContext, @Query(new ZodValidationPipe(PortalListQuerySchema)) q: PortalListQuery) {
        return this.portal.documents(p, q);
    }

    @Get('proposals')
    @RequirePortalPermission('portal.proposals.read')
    @ApiOperation({ summary: 'Proposals sent to your company' })
    proposals(@CurrentPortal() p: PortalContext, @Query(new ZodValidationPipe(PortalListQuerySchema)) q: PortalListQuery) {
        return this.portal.proposals(p, q);
    }

    @Get('contracts')
    @RequirePortalPermission('portal.contracts.read')
    @ApiOperation({ summary: 'Customer-visible contracts' })
    contracts(@CurrentPortal() p: PortalContext, @Query(new ZodValidationPipe(PortalListQuerySchema)) q: PortalListQuery) {
        return this.portal.contracts(p, q);
    }

    @Get('invoices')
    @RequirePortalPermission('portal.invoices.read')
    @ApiOperation({ summary: 'Invoices (status=outstanding|paid); pay_url with portal.invoices.pay' })
    invoices(@CurrentPortal() p: PortalContext, @Query(new ZodValidationPipe(PortalListQuerySchema)) q: PortalListQuery) {
        return this.portal.invoices(p, q);
    }

    // --- Help center ---------------------------------------------------------------------------

    @Get('knowledge')
    @PortalMember()
    @ApiOperation({ summary: 'Help center for customers (public + customer-only articles)' })
    knowledge(@CurrentPortal() p: PortalContext) {
        return this.portal.knowledgeHome(p);
    }

    @Get('knowledge/articles')
    @PortalMember()
    @ApiOperation({ summary: 'Search help articles' })
    knowledgeArticles(@CurrentPortal() p: PortalContext, @Query(new ZodValidationPipe(PortalListQuerySchema)) q: PortalListQuery, @Query('category') category?: string) {
        return this.portal.knowledgeArticles(p, { ...q, category });
    }

    @Get('knowledge/articles/:slug')
    @PortalMember()
    @ApiOperation({ summary: 'Read a help article' })
    knowledgeArticle(@CurrentPortal() p: PortalContext, @Param('slug') slug: string) {
        return this.portal.knowledgeArticle(p, slug);
    }

    @Post('knowledge/articles/:slug/feedback')
    @PortalMember()
    @ApiOperation({ summary: 'Was this article helpful?' })
    knowledgeFeedback(@CurrentPortal() p: PortalContext, @Param('slug') slug: string, @Body() dto: KnowledgeFeedbackDto) {
        return this.portal.knowledgeFeedback(p, slug, dto.is_helpful, dto.comment);
    }

    // --- Company & team ------------------------------------------------------------------------

    @Get('company')
    @PortalMember()
    @ApiOperation({ summary: 'Company profile and contacts' })
    company(@CurrentPortal() p: PortalContext) {
        return this.portal.company(p);
    }

    @Post('company/profile-changes')
    @RequirePortalPermission('portal.users.manage', 'portal.settings.manage')
    @ApiOperation({ summary: 'Propose changes to company or contact details (agency approval policy applies)' })
    profileChange(@CurrentPortal() p: PortalContext, @Body() dto: ProfileChangeRequestDto) {
        return this.portal.requestProfileChange(p, dto);
    }

    @Get('team')
    @PortalMember()
    @ApiOperation({ summary: 'Portal users of your company' })
    team(@CurrentPortal() p: PortalContext) {
        return this.portal.team(p);
    }

    @Post('team/invitations')
    @RequirePortalPermission('portal.users.manage')
    @ApiOperation({ summary: 'Invite colleagues to the portal' })
    invite(@CurrentPortal() p: PortalContext, @Body() dto: PortalTeamInviteDto) {
        return this.portal.inviteColleagues(p, dto);
    }

    @Post('team/invitations/:id/cancel')
    @RequirePortalPermission('portal.users.manage')
    @ApiOperation({ summary: 'Cancel a pending invitation' })
    cancelInvite(@CurrentPortal() p: PortalContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.portal.cancelInvitation(p, id);
    }

    @Patch('team/:membershipId')
    @RequirePortalPermission('portal.users.manage')
    @ApiOperation({ summary: "Change a colleague's role or deactivate them" })
    updateMember(@CurrentPortal() p: PortalContext, @Param('membershipId', ParseUUIDPipe) id: string, @Body() dto: PortalTeamUpdateDto) {
        return this.portal.updateTeamMember(p, id, dto);
    }
}
