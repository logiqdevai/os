import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { StorageService } from '@/modules/files/storage/storage.service';
import type { IncomingFile } from '@/modules/files/services/documents.service';
import { OrganizationService } from './organization.service';

export const LOGO_MAX_BYTES = 5 * 1024 * 1024;
export type LogoVariant = 'light' | 'dark';

/** Accepted image types, checked against the file's magic bytes (the client MIME type is not trusted). SVG is excluded (scripts). */
const SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
    { mime: 'image/png', ext: 'png', test: (b) => b.length > 8 && b.readUInt32BE(0) === 0x89504e47 },
    { mime: 'image/jpeg', ext: 'jpg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    { mime: 'image/webp', ext: 'webp', test: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
];

const KEY_RE = /^organizations\/([0-9a-f-]{36})\/branding\/(light|dark)\/([0-9a-f-]{36})\.(png|jpg|webp)$/;

/**
 * Organization logos (01 §8–15). Uploaded through the platform StorageService (Google Cloud Storage, or local disk in dev)
 * under `organizations/{org_id}/branding/{light|dark}/{logo_id}.{ext}`. The light logo is mirrored to `Organization.logo_url`
 * and the dark one to `branding.logo_dark_url` as public, versioned URLs, so emails, PDFs, the portal and public pages
 * can show them with a plain `<img>`. Replaced or removed logos return 404.
 */
@Injectable()
export class OrganizationLogoService {
    private readonly logger = new Logger(OrganizationLogoService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly config: ConfigService,
        private readonly organization: OrganizationService,
    ) { }

    async upload(ctx: OrgContext, variant: LogoVariant, file: IncomingFile | undefined) {
        if (!file?.buffer?.length) throw new BadRequestException({ message: 'Choose an image to upload', code: 'file_required' });
        if (file.buffer.length > LOGO_MAX_BYTES) throw new BadRequestException({ message: 'The logo must be 5 MB or smaller', code: 'file_too_large' });
        const type = SIGNATURES.find((s) => s.test(file.buffer));
        if (!type) throw new BadRequestException({ message: 'Use a PNG, JPG or WebP image', code: 'unsupported_file_type' });

        const logoId = randomUUID();
        const key = `organizations/${ctx.organization_id}/branding/${variant}/${logoId}.${type.ext}`;
        await this.storage.put(key, file.buffer, type.mime);
        const url = `${this.apiBase()}/organization/logos/${ctx.organization_id}/${variant}/${logoId}`;
        const previousKey = await this.write(ctx, variant, { key, url });
        await this.removeObject(previousKey);
        return this.finish(ctx, variant, previousKey ? 'replaced' : 'added');
    }

    async remove(ctx: OrgContext, variant: LogoVariant) {
        const previousKey = await this.write(ctx, variant, null);
        await this.removeObject(previousKey);
        if (previousKey) return this.finish(ctx, variant, 'removed');
        return this.organization.get(ctx);
    }

    /** Public read of the current logo. A stale logo id (replaced or removed) is a 404. */
    async stream(orgId: string, variant: LogoVariant, logoId: string): Promise<{ stream: Readable; mime: string }> {
        const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { branding: true } });
        const key = ((org?.branding ?? {}) as Record<string, unknown>)[variant === 'dark' ? 'logo_dark_key' : 'logo_key'];
        const match = typeof key === 'string' ? key.match(KEY_RE) : null;
        if (!match || match[1] !== orgId || match[2] !== variant || match[3] !== logoId) throw new NotFoundException({ message: 'Logo not found', code: 'logo_not_found' });
        const mime = SIGNATURES.find((s) => s.ext === match[4])!.mime;
        return { stream: await this.storage.getStream(key as string), mime };
    }

    /** Sets (or clears) the stored key and URL for a variant; returns the previous storage key. */
    private async write(ctx: OrgContext, variant: LogoVariant, next: { key: string; url: string } | null) {
        const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: ctx.organization_id }, select: { branding: true } });
        const branding = { ...((org.branding ?? {}) as Record<string, unknown>) };
        const keyField = variant === 'dark' ? 'logo_dark_key' : 'logo_key';
        const previousKey = typeof branding[keyField] === 'string' ? (branding[keyField] as string) : null;
        if (next) branding[keyField] = next.key; else delete branding[keyField];
        if (variant === 'dark') {
            if (next) branding.logo_dark_url = next.url; else delete branding.logo_dark_url;
        }
        await this.prisma.organization.update({
            where: { id: ctx.organization_id },
            data: { branding: branding as Prisma.InputJsonValue, ...(variant === 'light' && { logo_url: next?.url ?? null }) },
        });
        return previousKey;
    }

    private async finish(ctx: OrgContext, variant: LogoVariant, action: 'added' | 'replaced' | 'removed') {
        await this.audit.record(ctx, 'organization.updated', { resource_type: 'organization', resource_id: ctx.organization_id, metadata: { section: 'branding', logo: variant, action } });
        this.events.publish(ctx, { event_key: 'organizations.branding.updated', module: ModuleKey.ADMINISTRATION, entity_kind: 'organization', entity_id: ctx.organization_id, payload: { logo: variant, action } });
        return this.organization.get(ctx);
    }

    private apiBase() {
        return (this.config.get<string>('API_URL') ?? 'http://localhost:3000').replace(/\/+$/, '');
    }

    private async removeObject(key?: string | null) {
        if (!key) return;
        await this.storage.delete(key).catch((e) => this.logger.warn(`Could not delete old logo ${key}: ${e?.message ?? e}`));
    }
}
