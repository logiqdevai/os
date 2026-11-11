import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResendMailService } from '@/integrations/notifications/resend/services/mail.service';
import { EmailConfig } from '@/shared/config/email';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/**
 * Outbound email for the signing flow. Sends through Resend when RESEND_API_KEY is configured; otherwise reports
 * `false` so callers return the link / dev code to staff instead (never fails the request).
 */
@Injectable()
export class ContractMailerService {
    private readonly logger = new Logger(ContractMailerService.name);

    constructor(
        private readonly config: ConfigService,
        private readonly mail: ResendMailService,
    ) { }

    get configured() {
        return !!this.config.get<string>('RESEND_API_KEY');
    }

    appUrl(path: string) {
        const base = (this.config.get<string>('APP_URL') || 'http://localhost:5173').replace(/\/$/, '');
        return `${base}${path}`;
    }

    async send(to: string, subject: string, lines: string[], cta?: { label: string; url: string }): Promise<boolean> {
        if (!this.configured) return false;
        const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#1f2328">${lines.map((l) => `<p>${esc(l)}</p>`).join('')}${cta ? `<p><a href="${esc(cta.url)}" style="display:inline-block;padding:10px 16px;background:#1f2328;color:#fff;border-radius:6px;text-decoration:none">${esc(cta.label)}</a></p><p style="font-size:12px;color:#57606a">${esc(cta.url)}</p>` : ''}</div>`;
        try {
            await this.mail.sendEmail({ to, subject, html, from: EmailConfig.email_addresses.confirmation });
            return true;
        } catch (error) {
            this.logger.warn(`email to ${to} failed: ${(error as Error).message}`);
            return false;
        }
    }
}
