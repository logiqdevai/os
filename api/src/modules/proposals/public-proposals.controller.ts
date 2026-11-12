import { Body, Controller, Get, Headers, Param, Post, Req, StreamableFile } from '@nestjs/common';
import { streamable } from '@/modules/files/utils/streamable.utils';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '@/shared/authorization/decorators/require-permission.decorator';
import { ProposalPublicService, PublicRequestMeta } from './proposal-public.service';
import { PublicCommentDto, PublicDecisionDto, PublicEngagementDto, PublicSelectionDto, PublicSendCodeDto, PublicVerifyDto } from './dto/proposal.dto';

const meta = (req: Request, access?: string): PublicRequestMeta => ({ ip: req.ip ?? null, user_agent: (req.headers['user-agent'] as string | undefined) ?? null, access: access ?? null });

/**
 * Customer proposal link (no login). The token in the URL is the credential; only its sha256 is stored.
 * EMAIL_VERIFIED links also need the X-Proposal-Access header returned by /verify.
 */
@ApiTags('Public · Proposals')
@Public()
@Controller('public/proposals')
export class PublicProposalsController {
    constructor(private readonly publicProposals: ProposalPublicService) { }

    @Get(':token')
    @ApiOperation({ summary: 'Sent version for the customer (records a VIEWED event). state: ACTIVE | DECIDED | EXPIRED | CANCELLED | VERIFICATION_REQUIRED' })
    view(@Param('token') token: string, @Req() req: Request, @Headers('x-proposal-access') access?: string) {
        return this.publicProposals.view(token, meta(req, access));
    }

    @Get(':token/pdf')
    @ApiOperation({ summary: 'The sent version as a PDF (records a DOWNLOADED event)' })
    async pdf(@Param('token') token: string, @Req() req: Request, @Headers('x-proposal-access') access?: string): Promise<StreamableFile> {
        return streamable(await this.publicProposals.downloadPdf(token, meta(req, access)));
    }

    @Post(':token/engagement')
    @ApiOperation({ summary: 'Beacon: seconds on page and per section since the last beacon (tracking only)' })
    engagement(@Param('token') token: string, @Body() dto: PublicEngagementDto, @Req() req: Request, @Headers('x-proposal-access') access?: string) {
        return this.publicProposals.engagement(token, dto, meta(req, access));
    }

    @Post(':token/selection')
    @ApiOperation({ summary: 'Quote for a selection of optional items (stored on acceptance)' })
    select(@Param('token') token: string, @Body() dto: PublicSelectionDto, @Req() req: Request, @Headers('x-proposal-access') access?: string) {
        return this.publicProposals.select(token, dto.selected_optional_item_ids, meta(req, access));
    }

    @Post(':token/decision')
    @ApiOperation({ summary: 'Accept (typed-name signature + terms), request changes or decline' })
    decide(@Param('token') token: string, @Body() dto: PublicDecisionDto, @Req() req: Request, @Headers('x-proposal-access') access?: string) {
        return this.publicProposals.decide(token, dto, meta(req, access));
    }

    @Post(':token/comments')
    @ApiOperation({ summary: 'Customer comment / question' })
    comment(@Param('token') token: string, @Body() dto: PublicCommentDto, @Req() req: Request, @Headers('x-proposal-access') access?: string) {
        return this.publicProposals.comment(token, dto, meta(req, access));
    }

    @Post(':token/send-code')
    @ApiOperation({ summary: 'EMAIL_VERIFIED links: email a one-time code to a recipient address' })
    sendCode(@Param('token') token: string, @Body() dto: PublicSendCodeDto, @Req() req: Request) {
        return this.publicProposals.sendCode(token, dto.email, meta(req));
    }

    @Post(':token/verify')
    @ApiOperation({ summary: 'EMAIL_VERIFIED links: check the code; returns the access id for X-Proposal-Access' })
    verify(@Param('token') token: string, @Body() dto: PublicVerifyDto, @Req() req: Request) {
        return this.publicProposals.verify(token, dto.code, meta(req));
    }
}
