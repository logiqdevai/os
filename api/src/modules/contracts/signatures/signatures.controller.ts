import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, StreamableFile, UseGuards } from '@nestjs/common';
import { streamable } from '@/modules/files/utils/streamable.utils';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, Public, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { SignaturesService } from './signatures.service';
import { CancelSignatureRequestDto, CreateSignatureRequestDto, DeclineDto, SendCodeDto, SignDto, SignatureRequestQuery, SignatureRequestQuerySchema, VerifyCodeDto } from './dto/signature.dto';

const READ = 'contracts.signatures.read';

@ApiTags('Contracts · Signatures')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtGuard, PermissionsGuard)
export class SignaturesController {
    constructor(private readonly signatures: SignaturesService) { }

    @Post('contracts/:id/versions/:vid/signature-requests') @RequirePermission('contracts.signatures.send') @ApiOperation({ summary: 'Send a version for signature (locks it)' })
    create(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('vid', ParseUUIDPipe) vid: string, @Body() dto: CreateSignatureRequestDto) { return this.signatures.create(ctx, id, vid, dto); }

    @Get('signature-requests') @RequirePermission(READ) @ApiOperation({ summary: 'List signature requests' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(SignatureRequestQuerySchema)) q: SignatureRequestQuery) { return this.signatures.findAll(ctx, q); }

    @Get('signature-requests/:id') @RequirePermission(READ) @ApiOperation({ summary: 'Get a request with signers and the event trail' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.signatures.findOne(ctx, id); }

    @Get('signature-requests/:id/certificate') @RequirePermission(READ) @ApiOperation({ summary: 'Completion certificate data' })
    certificate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.signatures.certificate(ctx, id); }

    @Get('signature-requests/:id/certificate/pdf') @RequirePermission(READ) @ApiOperation({ summary: 'Completion certificate as PDF (stored in Files after completion)' })
    async certificatePdf(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> { return streamable(await this.signatures.certificatePdf(ctx, id)); }

    @Get('contracts/:id/versions/:vid/pdf') @RequirePermission('contracts.contracts.read') @ApiOperation({ summary: 'Version as PDF; a signed version returns the stored signed document with signature blocks' })
    async versionPdf(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('vid', ParseUUIDPipe) vid: string): Promise<StreamableFile> { return streamable(await this.signatures.versionPdf(ctx, id, vid)); }

    @Post('signature-requests/:id/remind') @RequirePermission('contracts.signatures.send') @ApiOperation({ summary: 'Remind the signers whose turn it is' })
    remind(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.signatures.remind(ctx, id); }

    @Post('signature-requests/:id/signers/:signerId/link') @RequirePermission('contracts.signatures.send') @ApiOperation({ summary: 'Issue a new signing link for one signer' })
    link(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('signerId', ParseUUIDPipe) signerId: string) { return this.signatures.resendLink(ctx, id, signerId); }

    @Post('signature-requests/:id/cancel') @RequirePermission('contracts.signatures.cancel') @ApiOperation({ summary: 'Cancel the request (unlocks the version)' })
    cancel(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelSignatureRequestDto) { return this.signatures.cancel(ctx, id, dto); }
}

const meta = (req: Request) => ({ ip: req.ip ?? null, user_agent: (req.headers['user-agent'] as string | undefined) ?? null });

/**
 * Public signing flow (no login). Possession of the single-use token identifies the signer; identity is then proven
 * with a one-time email code. The token is never stored, only its SHA-256.
 */
@ApiTags('Public · Signing')
@Controller('public/sign')
@UseGuards(JwtGuard)
export class PublicSigningController {
    constructor(private readonly signatures: SignaturesService) { }

    @Get(':token') @Public() @ApiOperation({ summary: 'Signing state (document after identity verification)' })
    state(@Param('token') token: string, @Req() req: Request) { return this.signatures.publicState(token, meta(req)); }

    @Post(':token/send-code') @Public() @ApiOperation({ summary: 'Send a one-time identity code (SMS when the signer has a phone and the organization a Twilio connection; falls back to email)' })
    sendCode(@Param('token') token: string, @Body() dto: SendCodeDto, @Req() req: Request) { return this.signatures.sendCode(token, meta(req), dto.channel); }

    @Post(':token/verify') @Public() @ApiOperation({ summary: 'Verify the one-time code' })
    verify(@Param('token') token: string, @Body() dto: VerifyCodeDto, @Req() req: Request) { return this.signatures.verify(token, dto, meta(req)); }

    @Post(':token/sign') @Public() @ApiOperation({ summary: 'Sign (typed name or drawn image)' })
    sign(@Param('token') token: string, @Body() dto: SignDto, @Req() req: Request) { return this.signatures.sign(token, dto, meta(req)); }

    @Post(':token/decline') @Public() @ApiOperation({ summary: 'Decline to sign' })
    decline(@Param('token') token: string, @Body() dto: DeclineDto, @Req() req: Request) { return this.signatures.decline(token, dto, meta(req)); }

    @Get(':token/document.pdf') @Public() @ApiOperation({ summary: 'Signed document as PDF (after everyone signed)' })
    async signedPdf(@Param('token') token: string): Promise<StreamableFile> { return streamable(await this.signatures.publicSignedPdf(token)); }

    @Get(':token/certificate.pdf') @Public() @ApiOperation({ summary: 'Completion certificate as PDF (emails of other signers masked)' })
    async certificatePdf(@Param('token') token: string): Promise<StreamableFile> { return streamable(await this.signatures.publicCertificatePdf(token)); }

    @Get(':token/certificate') @Public() @ApiOperation({ summary: 'Completion certificate (after everyone signed)' })
    certificate(@Param('token') token: string) { return this.signatures.publicCertificate(token); }
}
