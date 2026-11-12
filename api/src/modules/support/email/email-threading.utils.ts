import { createHash, createHmac, timingSafeEqual } from 'crypto';

/**
 * Email threading helpers for 13 Support EMAIL channels.
 * Outbound replies carry three independent thread markers so inbound replies find their conversation:
 * 1. our own `Message-ID` (stored in SupportMessage.external_message_id) → matched against In-Reply-To / References,
 * 2. a plus-addressed Reply-To (`support+r<token>@domain`),
 * 3. a `[#<token>]` tag in the subject.
 * The reply token = conversation id (hex, no dashes) + 10 hex chars of an HMAC, so it cannot be guessed or forged.
 */
function key(secret: string) {
    return createHash('sha256').update(`logiqdev:support-reply:v1:${secret}`).digest();
}

export function replyToken(conversationId: string, secret: string) {
    const hex = conversationId.replace(/-/g, '').toLowerCase();
    return `${hex}${createHmac('sha256', key(secret)).update(hex).digest('hex').slice(0, 10)}`;
}

/** Conversation id of a valid reply token, or null. */
export function parseReplyToken(token: string, secret: string): string | null {
    const t = token.toLowerCase();
    if (!/^[0-9a-f]{42}$/.test(t)) return null;
    const hex = t.slice(0, 32);
    const expected = replyToken(hex, secret);
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(t))) return null;
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Every token candidate in recipient addresses (`local+r<token>@…`) and the subject (`[#<token>]`). */
export function tokenCandidates(addresses: string[], subject: string | null | undefined): string[] {
    const out: string[] = [];
    for (const a of addresses) for (const m of a.matchAll(/\+r([0-9a-f]{42})@/gi)) out.push(m[1]);
    for (const m of (subject ?? '').matchAll(/\[#([0-9a-f]{42})\]/gi)) out.push(m[1]);
    return out;
}

/** `support@agency.com` → `support+r<token>@agency.com`. */
export function plusAddress(address: string, token: string) {
    const [local, domain] = address.split('@');
    if (!local || !domain) return address;
    return `${local.split('+')[0]}+r${token}@${domain}`;
}

export const domainOf = (address: string | null | undefined) => address?.split('@')[1]?.toLowerCase() || 'support.local';

/** `<a@b> <c@d>` / `a@b` → ['<a@b>', '<c@d>'] (angle brackets normalized). */
export function messageIds(value: string | string[] | null | undefined): string[] {
    const raw = Array.isArray(value) ? value.join(' ') : value ?? '';
    const ids = raw.match(/<[^<>\s]+>/g) ?? [];
    if (!ids.length && raw.trim() && !/\s/.test(raw.trim())) return [`<${raw.trim().replace(/^<|>$/g, '')}>`];
    return ids;
}

/** Plain address out of `Name <a@b>` / `a@b`, lower-cased. */
export function parseAddress(value: string | null | undefined): { email: string | null; name: string | null } {
    if (!value) return { email: null, name: null };
    const m = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
    if (m) return { email: m[2].trim().toLowerCase(), name: m[1].trim() || null };
    return { email: value.trim().toLowerCase(), name: null };
}

/** Drop the quoted history of a reply ("On … wrote:", "-----Original Message-----", "> " lines) — agents see the new text only. */
export function stripQuotedReply(text: string): string {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const out: string[] = [];
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (/^-{2,}\s*Original Message\s*-{2,}/i.test(l) || /^_{5,}$/.test(l.trim())) break;
        if (/^On .{4,200}wrote:\s*$/i.test(l.trim()) || (/^On .{4,200}$/i.test(l.trim()) && /wrote:\s*$/i.test(lines[i + 1] ?? ''))) break;
        if (/^>/.test(l)) continue;
        out.push(l);
    }
    const result = out.join('\n').trim();
    return result || text.trim();
}

/** Very small HTML → text for inbound HTML-only mails. */
export function htmlToPlain(html: string): string {
    return html
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** Plain text reply → minimal safe HTML (escaped, paragraphs and line breaks). */
export function textToHtml(text: string): string {
    const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc.split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${p.replace(/\n/g, '<br/>')}</p>`).join('');
}

/** HMAC signature of the generic inbound format: header `X-Logiq-Signature: t=<unix>,v1=<hex sha256(secret, "<t>.<raw body>")>`. */
export function verifyGenericSignature(secret: string, header: string | undefined, rawBody: string, toleranceSec = 300): boolean {
    if (!header) return false;
    const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=') as [string, string]));
    const t = Number(parts.t);
    if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec || !parts.v1) return false;
    const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
    return expected.length === parts.v1.length && timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}

/** Svix signature (Resend webhooks): `svix-signature: v1,<base64 hmac>` over "<id>.<timestamp>.<body>" with the base64 part of `whsec_…`. */
export function verifySvixSignature(secret: string, headers: { id?: string; timestamp?: string; signature?: string }, rawBody: string, toleranceSec = 300): boolean {
    if (!headers.id || !headers.timestamp || !headers.signature) return false;
    const ts = Number(headers.timestamp);
    if (!ts || Math.abs(Date.now() / 1000 - ts) > toleranceSec) return false;
    const keyBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const expected = createHmac('sha256', keyBytes).update(`${headers.id}.${headers.timestamp}.${rawBody}`).digest('base64');
    return headers.signature.split(' ').some((sig) => {
        const value = sig.split(',')[1] ?? '';
        return value.length === expected.length && timingSafeEqual(Buffer.from(value), Buffer.from(expected));
    });
}
