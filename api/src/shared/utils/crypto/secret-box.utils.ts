import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * AES-256-GCM helper for write-only secrets (IntegrationConnection.secret_ciphertext, 01 §157–158).
 * The key is derived from JWT_SECRET with a fixed context label so it never equals the JWT signing key.
 * Output: base64(iv[12] | tag[16] | ciphertext). Never log or return the plain value.
 *
 * Replace with the organization VaultKey envelope (17 §12) once the vault exists; the format stays a single base64 string.
 */
const IV_BYTES = 12;
const TAG_BYTES = 16;

function deriveKey(): Buffer {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is required to encrypt secrets');
    return createHash('sha256').update(`logiqdev:secret-box:v1:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', deriveKey(), iv);
    const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}

export function decryptSecret(payload: string): string {
    const raw = Buffer.from(payload, 'base64');
    const iv = raw.subarray(0, IV_BYTES);
    const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const body = raw.subarray(IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

/** Encrypt a JSON object of secret fields as one ciphertext. */
export const encryptJson = (value: Record<string, string>) => encryptSecret(JSON.stringify(value));
export const decryptJson = (payload: string): Record<string, string> => JSON.parse(decryptSecret(payload));

/** Non-reversible hint for lists: first 3 + last 4 characters at most (e.g. `sk-…a3f9`). */
export function secretHint(value: string): string {
    if (value.length <= 8) return `…${value.slice(-2)}`;
    return `${value.slice(0, 3)}…${value.slice(-4)}`;
}
