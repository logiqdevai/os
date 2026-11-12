import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webPush from 'web-push';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { decryptSecret, encryptSecret } from '@/shared/utils/crypto/secret-box.utils';

export interface VapidKeys {
    public_key: string;
    private_key: string;
    subject: string;
}

const ROW_ID = 'default';

/**
 * 14 §5 — the deployment's VAPID key pair for Web Push (platform-level, not BYOK: push devices belong to a User).
 * Generated on first use and stored in `platform_web_push_keys` with the private key encrypted by the secret box.
 * The private key only lives in memory of this process; it is never returned by any endpoint.
 */
@Injectable()
export class WebPushKeysService {
    private readonly logger = new Logger(WebPushKeysService.name);
    private pending: Promise<VapidKeys> | null = null;

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) { }

    /** VAPID subject: WEB_PUSH_SUBJECT, else the app URL when it is https, else a mailto placeholder. */
    private subject() {
        const explicit = this.config.get<string>('WEB_PUSH_SUBJECT');
        if (explicit && /^(mailto:|https:)/.test(explicit)) return explicit;
        const app = this.config.get<string>('APP_URL');
        return app && app.startsWith('https://') ? app.replace(/\/+$/, '') : 'mailto:notifications@logiqdev.app';
    }

    keys(): Promise<VapidKeys> {
        if (!this.pending) {
            this.pending = this.load();
            this.pending.catch(() => (this.pending = null));
        }
        return this.pending;
    }

    async publicKey() {
        return (await this.keys()).public_key;
    }

    private async load(): Promise<VapidKeys> {
        const existing = await this.prisma.platformWebPushKey.findUnique({ where: { id: ROW_ID } });
        if (existing) return { public_key: existing.public_key, private_key: decryptSecret(existing.private_key_ciphertext), subject: existing.subject };
        const generated = webPush.generateVAPIDKeys();
        const subject = this.subject();
        try {
            await this.prisma.platformWebPushKey.create({ data: { id: ROW_ID, public_key: generated.publicKey, private_key_ciphertext: encryptSecret(generated.privateKey), subject } });
            this.logger.log('generated the Web Push (VAPID) key pair');
            return { public_key: generated.publicKey, private_key: generated.privateKey, subject };
        } catch {
            // Another instance generated it at the same time: use the stored pair.
            const row = await this.prisma.platformWebPushKey.findUniqueOrThrow({ where: { id: ROW_ID } });
            return { public_key: row.public_key, private_key: decryptSecret(row.private_key_ciphertext), subject: row.subject };
        }
    }
}
