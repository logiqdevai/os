import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, Public, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { SupportEmailService } from './support-email.service';

export class SetInboundSecretDto {
    @ApiProperty({ required: false, description: 'Signing secret of the Resend inbound webhook (whsec_…). Omit to generate one for a generic forwarder.' })
    @IsOptional()
    @IsString()
    @MinLength(16)
    @MaxLength(200)
    secret?: string;
}

@ApiTags('Support · Email')
@ApiBearerAuth()
@Controller('support/channels')
@UseGuards(JwtGuard, PermissionsGuard)
export class SupportEmailSetupController {
    constructor(private readonly email: SupportEmailService) { }

    @Get(':id/email-setup')
    @RequireAnyPermission('support.inboxes.read', 'support.inboxes.manage')
    @ApiOperation({ summary: 'Inbound webhook URL, secret status and sending connection of an email channel (never the secret)' })
    setup(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.email.setup(ctx, id);
    }

    @Post(':id/email-secret')
    @RequirePermission('support.inboxes.manage')
    @ApiOperation({ summary: 'Set (paste) or generate the inbound signing secret; a generated secret is returned once' })
    setSecret(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetInboundSecretDto) {
        return this.email.setInboundSecret(ctx, id, dto.secret);
    }
}

/**
 * Inbound email webhook (public). Authenticated by signature only: Svix headers (Resend inbound) or
 * `X-Logiq-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>` with JSON
 * `{ from, to[], subject, text, html?, message_id, in_reply_to?, references? }`.
 */
@ApiTags('Public · Support email')
@Public()
@Controller('support/email')
export class SupportEmailInboundController {
    constructor(private readonly email: SupportEmailService) { }

    @Post('inbound/:channelId')
    @HttpCode(200)
    @ApiOperation({ summary: 'Receive an email for an EMAIL channel (threads replies into their conversation)' })
    inbound(@Param('channelId') channelId: string, @Req() req: RawBodyRequest<Request>) {
        const headers: Record<string, string | undefined> = {};
        for (const [k, v] of Object.entries(req.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
        return this.email.inbound(channelId, {
            raw_body: req.rawBody?.toString('utf8') ?? JSON.stringify(req.body ?? {}),
            headers,
            ip: req.ip ?? null,
            user_agent: headers['user-agent'] ?? null,
        });
    }
}
