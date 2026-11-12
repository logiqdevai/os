import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * TOTP (RFC 6238) on top of HOTP (RFC 4226) with node:crypto only: HMAC-SHA1, 6 digits, 30-second steps —
 * the defaults every authenticator app supports.
 */
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Accept the previous and next step as well, for clock drift. */
const TOTP_WINDOW = 1;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let out = '';
    for (const byte of buffer) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    return out;
}

export function base32Decode(input: string): Buffer {
    const clean = input.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
    let bits = 0;
    let value = 0;
    const out: number[] = [];
    for (const char of clean) {
        const idx = BASE32_ALPHABET.indexOf(char);
        if (idx === -1) throw new Error('Invalid base32 character');
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return Buffer.from(out);
}

/** New 160-bit seed, base32 encoded (what the user types if they cannot scan the QR code). */
export const generateTotpSecret = () => base32Encode(randomBytes(20));

export function hotp(secret: Buffer, counter: number): string {
    const message = Buffer.alloc(8);
    message.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac('sha1', secret).update(message).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
    return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

export const currentTotpStep = (now = Date.now()) => Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);

/**
 * Returns the matched time step, or null. Callers store the step and reject codes at or before it (replay protection).
 */
export function verifyTotp(base32Secret: string, code: string, now = Date.now()): number | null {
    const clean = code.replace(/\s+/g, '');
    if (!new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(clean)) return null;
    const secret = base32Decode(base32Secret);
    const step = currentTotpStep(now);
    for (let delta = -TOTP_WINDOW; delta <= TOTP_WINDOW; delta++) {
        const expected = Buffer.from(hotp(secret, step + delta));
        if (timingSafeEqual(expected, Buffer.from(clean))) return step + delta;
    }
    return null;
}

/** `otpauth://totp/<issuer>:<account>?secret=…` — rendered as a QR code by the app. */
export function otpauthUri(input: { issuer: string; account: string; secret: string }) {
    const label = `${encodeURIComponent(input.issuer)}:${encodeURIComponent(input.account)}`;
    const params = new URLSearchParams({ secret: input.secret, issuer: input.issuer, algorithm: 'SHA1', digits: String(TOTP_DIGITS), period: String(TOTP_PERIOD_SECONDS) });
    return `otpauth://totp/${label}?${params.toString()}`;
}

/** Recovery codes: 10 × `xxxxx-xxxxx` from an unambiguous alphabet (~50 bits each). */
const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const RECOVERY_CODE_COUNT = 10;

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
    return Array.from({ length: count }, () => {
        const bytes = randomBytes(10);
        const chars = [...bytes].map((b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join('');
        return `${chars.slice(0, 5)}-${chars.slice(5)}`;
    });
}

/** Lower-case, strip spaces; keep the dash optional when the user types it without. */
export const normalizeRecoveryCode = (code: string) => {
    const raw = code.trim().toLowerCase().replace(/[\s-]+/g, '');
    return raw.length === 10 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
};
