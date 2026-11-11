import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResendMailService } from '@/integrations/notifications/resend/services/mail.service';
import { escapeHtml } from './utils/proposal.utils';

/**
 * Customer-facing proposal emails. Uses Resend when RESEND_API_KEY is configured; otherwise `enabled` is false and
 * callers return the public link instead of sending (the delivery is recorded as LINK / FAILED with the reason).
 */
@Injectable()
export class ProposalMailer {
    private readonly logger = new Logger(ProposalMailer.name);

    constructor(
        private readonly config: ConfigService,
        private readonly mail: ResendMailService,
    ) { }

    get enabled() {
        return !!this.config.get<string>('RESEND_API_KEY');
    }

    appUrl(path: string) {
        const base = (this.config.get<string>('APP_URL') ?? 'http://localhost:5173').replace(/\/$/, '');
        return `${base}${path}`;
    }

    /** Throws on failure so the caller can record the delivery as FAILED. */
    async send(to: string, subject: string, paragraphs: string[], cta?: { label: string; url: string }, from?: string) {
        const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.6">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`).join('');
        const button = cta
            ? `<p style="margin:22px 0"><a href="${cta.url}" style="background:#111827;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">${escapeHtml(cta.label)}</a></p><p style="font-size:12px;color:#6b7280">Or open: ${cta.url}</p>`
            : '';
        const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;color:#111827;max-width:560px">${body}${button}</div>`;
        try {
            await this.mail.sendEmail({ to, subject, html, text: [...paragraphs, cta ? `${cta.label}: ${cta.url}` : ''].join('\n\n'), ...(from && { from }) });
        } catch (error) {
            this.logger.warn(`proposal email to ${to} failed: ${(error as Error).message}`);
            throw error;
        }
    }
}
