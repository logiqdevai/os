import { Body, Controller, Get, Headers, HttpCode, Logger, NotFoundException, Param, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CommBounceType, CommDeliveryEventType, CommProviderKind, IntegrationProvider } from 'generated/prisma';
import { validateRequest } from 'twilio';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { decryptJson } from '@/shared/utils/crypto/secret-box.utils';
import { CommStatsService } from '../delivery/comm-stats.service';
import { CommDispatchService } from '../delivery/comm-dispatch.service';
import { CommProviderService } from '../delivery/comm-provider.service';

const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

const page = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title>
<style>:root{color-scheme:light dark}body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:Canvas;color:CanvasText}
main{max-width:420px;padding:32px 24px;text-align:center}h1{font-size:20px;font-weight:600;margin:0 0 8px}p{opacity:.75;font-size:14px;line-height:1.5}
button{margin-top:16px;font:inherit;padding:10px 18px;border-radius:8px;border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer}</style></head><body><main>${body}</main></body></html>`;

const RESEND_EVENTS: Record<string, CommDeliveryEventType> = {
    'email.sent': CommDeliveryEventType.SENT,
    'email.delivered': CommDeliveryEventType.DELIVERED,
    'email.delivery_delayed': CommDeliveryEventType.DEFERRED,
    'email.opened': CommDeliveryEventType.OPENED,
    'email.clicked': CommDeliveryEventType.CLICKED,
    'email.bounced': CommDeliveryEventType.BOUNCED,
    'email.complained': CommDeliveryEventType.COMPLAINED,
    'email.failed': CommDeliveryEventType.FAILED,
};

const TWILIO_EVENTS: Record<string, CommDeliveryEventType> = {
    sent: CommDeliveryEventType.SENT,
    delivered: CommDeliveryEventType.DELIVERED,
    undelivered: CommDeliveryEventType.FAILED,
    failed: CommDeliveryEventType.FAILED,
    read: CommDeliveryEventType.READ,
};

/**
 * Public endpoints of module 11 (no credential; explicitly unauthenticated by design): open pixel, click redirect,
 * unsubscribe page (+ RFC 8058 one-click), and provider delivery webhooks resolved by the connection's webhook_token
 * and verified with the organization's own signing secret.
 */
@ApiExcludeController()
@Controller('communications')
export class TrackingController {
    private readonly logger = new Logger(TrackingController.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly stats: CommStatsService,
        private readonly dispatch: CommDispatchService,
        private readonly providers: CommProviderService,
    ) { }

    @Get('t/o/:messageId')
    async open(@Param('messageId') messageId: string, @Req() req: Request, @Res() res: Response) {
        if (/^[0-9a-f-]{36}$/i.test(messageId)) {
            await this.stats.record(messageId, { type: CommDeliveryEventType.OPENED, user_agent: req.headers['user-agent'] ?? null, ip_address: req.ip ?? null }).catch(() => undefined);
        }
        res.set({ 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache, must-revalidate, private', 'Content-Length': String(PIXEL.length) });
        res.end(PIXEL);
    }

    @Get('t/c/:token')
    async click(@Param('token') token: string, @Query('m') messageId: string | undefined, @Req() req: Request, @Res() res: Response) {
        const link = await this.prisma.commTrackedLink.findUnique({ where: { token } });
        if (!link) {
            res.status(404).type('html').send(page('Link not found', '<h1>Link not found</h1><p>This link is no longer available.</p>'));
            return;
        }
        let recorded = false;
        if (messageId && /^[0-9a-f-]{36}$/i.test(messageId)) {
            const message = await this.prisma.commMessage.findFirst({ where: { id: messageId, organization_id: link.organization_id, ...(link.campaign_id ? { campaign_id: link.campaign_id } : { id: link.message_id ?? messageId }) }, select: { id: true, first_clicked_at: true } });
            if (message) {
                recorded = await this.stats.record(message.id, { type: CommDeliveryEventType.CLICKED, tracked_link_id: link.id, url: link.original_url, user_agent: req.headers['user-agent'] ?? null, ip_address: req.ip ?? null }).catch(() => false);
                const priorClick = await this.prisma.commDeliveryEvent.count({ where: { message_id: message.id, tracked_link_id: link.id, type: CommDeliveryEventType.CLICKED } });
                await this.prisma.commTrackedLink.update({
                    where: { id: link.id },
                    data: { click_count: { increment: 1 }, last_clicked_at: new Date(), first_clicked_at: link.first_clicked_at ?? new Date(), ...(recorded && priorClick <= 1 && { unique_click_count: { increment: 1 } }) },
                });
            }
        }
        res.redirect(302, link.original_url);
    }

    private async unsubscribeTarget(token: string) {
        return this.prisma.commMessage.findUnique({ where: { unsubscribe_token: token }, select: { id: true, to_address: true, channel: true, unsubscribed_at: true, organization: { select: { display_name: true } } } });
    }

    @Get('u/:token')
    async unsubscribePage(@Param('token') token: string, @Res() res: Response) {
        const target = await this.unsubscribeTarget(token);
        if (!target) {
            res.status(404).type('html').send(page('Link expired', '<h1>This link has expired</h1><p>Reply to the email to ask to be removed from the list.</p>'));
            return;
        }
        const org = target.organization.display_name.replace(/</g, '&lt;');
        if (target.unsubscribed_at) {
            res.type('html').send(page('Unsubscribed', `<h1>You are unsubscribed</h1><p>${target.to_address.replace(/</g, '&lt;')} will no longer receive marketing email from ${org}.</p>`));
            return;
        }
        res.type('html').send(page('Unsubscribe', `<h1>Unsubscribe from ${org}?</h1><p>${target.to_address.replace(/</g, '&lt;')} will stop receiving marketing messages. Service messages (invoices, contracts) still arrive.</p><form method="post"><button type="submit">Unsubscribe</button></form>`));
    }

    @Post('u/:token')
    @HttpCode(200)
    async unsubscribe(@Param('token') token: string, @Res() res: Response) {
        const target = await this.unsubscribeTarget(token);
        if (!target) throw new NotFoundException({ message: 'Link expired', code: 'unsubscribe_token_invalid' });
        await this.stats.record(target.id, { type: CommDeliveryEventType.UNSUBSCRIBED, reason: 'Unsubscribe link' });
        res.type('html').send(page('Unsubscribed', `<h1>You are unsubscribed</h1><p>${target.to_address.replace(/</g, '&lt;')} will no longer receive marketing messages from ${target.organization.display_name.replace(/</g, '&lt;')}.</p>`));
    }

    private async connectionForToken(token: string, provider: IntegrationProvider) {
        const conn = await this.prisma.integrationConnection.findUnique({ where: { webhook_token: token } });
        if (!conn || conn.provider !== provider) throw new NotFoundException();
        let secrets: Record<string, string> = {};
        try {
            secrets = conn.secret_ciphertext ? decryptJson(conn.secret_ciphertext) : {};
        } catch {
            /* undecryptable: treated as missing */
        }
        return { conn, secrets };
    }

    /** Resend delivery webhooks (svix-signed with the connection's webhook signing secret). */
    @Post('webhooks/resend/:token')
    @HttpCode(200)
    async resendWebhook(@Param('token') token: string, @Req() req: Request & { rawBody?: Buffer }, @Headers() headers: Record<string, string>, @Body() body: Record<string, unknown>) {
        const { conn, secrets } = await this.connectionForToken(token, IntegrationProvider.RESEND);
        const id = headers['svix-id'];
        if (secrets.webhook_secret) {
            try {
                this.providers.verifyResendWebhook(secrets.webhook_secret, req.rawBody?.toString('utf8') ?? JSON.stringify(body), { id, timestamp: headers['svix-timestamp'], signature: headers['svix-signature'] });
            } catch {
                throw new UnauthorizedException({ message: 'Invalid webhook signature', code: 'webhook_signature_invalid' });
            }
        }
        const type = RESEND_EVENTS[String(body.type)];
        const data = (body.data ?? {}) as Record<string, unknown>;
        const providerMessageId = data.email_id as string | undefined;
        if (!type || !providerMessageId) return { received: true, ignored: true };
        const message = await this.prisma.commMessage.findFirst({ where: { organization_id: conn.organization_id, provider: CommProviderKind.RESEND, provider_message_id: providerMessageId }, select: { id: true } });
        if (!message) return { received: true, ignored: true };
        const bounce = (data.bounce ?? {}) as Record<string, string>;
        const click = (data.click ?? {}) as Record<string, string>;
        if (type !== CommDeliveryEventType.SENT) {
            await this.stats.record(message.id, {
                type,
                occurred_at: body.created_at ? new Date(String(body.created_at)) : undefined,
                provider: CommProviderKind.RESEND,
                provider_event_id: id ?? `${providerMessageId}:${body.type}:${body.created_at}`,
                url: click.link ?? null,
                user_agent: click.userAgent ?? null,
                ip_address: click.ipAddress ?? null,
                bounce_type: type === CommDeliveryEventType.BOUNCED ? (/transient|soft/i.test(bounce.type ?? '') ? CommBounceType.SOFT : CommBounceType.HARD) : null,
                reason: bounce.message ?? (data.failed as Record<string, string> | undefined)?.reason ?? null,
                payload: { type: body.type },
            });
        }
        return { received: true };
    }

    /** Twilio status callbacks (X-Twilio-Signature validated with the connection's auth token). */
    @Post('webhooks/twilio/:token')
    @HttpCode(200)
    async twilioWebhook(@Param('token') token: string, @Headers('x-twilio-signature') signature: string | undefined, @Req() req: Request, @Body() body: Record<string, string>) {
        const { conn, secrets } = await this.connectionForToken(token, IntegrationProvider.TWILIO);
        if (secrets.auth_token) {
            const url = `${this.dispatch.apiBase}${req.originalUrl}`;
            if (!signature || !validateRequest(secrets.auth_token, signature, url, body)) throw new UnauthorizedException({ message: 'Invalid webhook signature', code: 'webhook_signature_invalid' });
        }
        const type = TWILIO_EVENTS[String(body.MessageStatus ?? '').toLowerCase()];
        if (!type || !body.MessageSid) return { received: true, ignored: true };
        const message = await this.prisma.commMessage.findFirst({ where: { organization_id: conn.organization_id, provider: CommProviderKind.TWILIO, provider_message_id: body.MessageSid }, select: { id: true } });
        if (!message || type === CommDeliveryEventType.SENT) return { received: true };
        await this.stats.record(message.id, {
            type,
            provider: CommProviderKind.TWILIO,
            provider_event_id: `${body.MessageSid}:${body.MessageStatus}`,
            reason: body.ErrorCode ? `Twilio error ${body.ErrorCode}` : null,
            payload: { status: body.MessageStatus, error_code: body.ErrorCode ?? null },
        });
        return { received: true };
    }
}
