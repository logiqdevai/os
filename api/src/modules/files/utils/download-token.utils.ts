import { createHash, createHmac, timingSafeEqual } from 'crypto';

/**
 * Short-lived signed download tokens (17 §8: signed, expiring URLs; no public storage URLs).
 * A token is `base64url(payload).base64url(hmac)`; the HMAC key is derived from JWT_SECRET with its own label.
 * Used for `<a href>` / `<img src>` links where the browser cannot send the bearer header.
 */
export interface DownloadTokenPayload {
    /** DocumentVersion id. */
    v: string;
    /** Organization id. */
    o: string;
    /** inline (preview) or attachment (download). */
    d: 'inline' | 'attachment';
    /** Expiry, epoch seconds. */
    e: number;
    /** Share id when issued through a share link (download counting). */
    s?: string;
}

function key() {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is required to sign download links');
    return createHash('sha256').update(`logiqdev:document-download:v1:${secret}`).digest();
}

export function signDownloadToken(payload: DownloadTokenPayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', key()).update(body).digest('base64url');
    return `${body}.${sig}`;
}

export function verifyDownloadToken(token: string): DownloadTokenPayload | null {
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = createHmac('sha256', key()).update(body).digest();
    const given = Buffer.from(sig, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as DownloadTokenPayload;
        if (!payload.v || !payload.o || payload.e * 1000 < Date.now()) return null;
        return payload;
    } catch {
        return null;
    }
}
