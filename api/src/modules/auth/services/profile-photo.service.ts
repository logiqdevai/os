import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { StorageService } from '@/modules/files/storage/storage.service';
import type { IncomingFile } from '@/modules/files/services/documents.service';

export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Accepted image types, checked against the file's magic bytes (the client MIME type is not trusted). SVG is excluded (scripts). */
const SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
    { mime: 'image/png', ext: 'png', test: (b) => b.length > 8 && b.readUInt32BE(0) === 0x89504e47 },
    { mime: 'image/jpeg', ext: 'jpg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    { mime: 'image/gif', ext: 'gif', test: (b) => b.length > 6 && b.toString('ascii', 0, 4) === 'GIF8' },
    { mime: 'image/webp', ext: 'webp', test: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
];

const KEY_RE = /^users\/([0-9a-f-]{36})\/photo\/([0-9a-f-]{36})\.(png|jpg|gif|webp)$/;

/**
 * 01 §127 — the user's own profile photo. Stored through the platform StorageService (GCS or local disk) under
 * `users/{user_id}/photo/{photo_id}.{ext}`. User is a global identity (not tenant data), so it is not a 17 Document.
 * `profile_photo_url` is a public, versioned URL so every `<img>` in the app, the portal and emails can show it without a token.
 */
@Injectable()
export class ProfilePhotoService {
    private readonly logger = new Logger(ProfilePhotoService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
        private readonly audit: AuditService,
        private readonly config: ConfigService,
    ) { }

    async upload(userId: string, file: IncomingFile | undefined) {
        if (!file?.buffer?.length) throw new BadRequestException({ message: 'Choose an image to upload', code: 'file_required' });
        if (file.buffer.length > PROFILE_PHOTO_MAX_BYTES) throw new BadRequestException({ message: 'The photo must be 5 MB or smaller', code: 'file_too_large' });
        const type = SIGNATURES.find((s) => s.test(file.buffer));
        if (!type) throw new BadRequestException({ message: 'Use a PNG, JPG, GIF or WebP image', code: 'unsupported_file_type' });

        const before = await this.prisma.user.findUnique({ where: { id: userId }, select: { profile_photo_key: true } });
        const photoId = randomUUID();
        const key = `users/${userId}/photo/${photoId}.${type.ext}`;
        await this.storage.put(key, file.buffer, type.mime);
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: { profile_photo_key: key, profile_photo_url: `${this.apiBase()}/auth/photos/${userId}/${photoId}` },
            select: { profile_photo_url: true },
        });
        await this.removeObject(before?.profile_photo_key);
        await this.audit.record(null, before?.profile_photo_key ? 'user.photo_changed' : 'user.photo_added', { resource_type: 'user', resource_id: userId });
        return { profile_photo_url: user.profile_photo_url };
    }

    async remove(userId: string) {
        const before = await this.prisma.user.findUnique({ where: { id: userId }, select: { profile_photo_key: true } });
        if (!before?.profile_photo_key) return { profile_photo_url: null };
        await this.prisma.user.update({ where: { id: userId }, data: { profile_photo_key: null, profile_photo_url: null } });
        await this.removeObject(before.profile_photo_key);
        await this.audit.record(null, 'user.photo_removed', { resource_type: 'user', resource_id: userId });
        return { profile_photo_url: null };
    }

    /** Public read of the current photo. An old photo id (replaced or removed) is a 404, so stale URLs stop working. */
    async stream(userId: string, photoId: string): Promise<{ stream: Readable; mime: string }> {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { profile_photo_key: true } });
        const match = user?.profile_photo_key?.match(KEY_RE);
        if (!match || match[1] !== userId || match[2] !== photoId) throw new NotFoundException({ message: 'Photo not found', code: 'photo_not_found' });
        const mime = SIGNATURES.find((s) => s.ext === match[3])!.mime;
        return { stream: await this.storage.getStream(user!.profile_photo_key!), mime };
    }

    private apiBase() {
        return (this.config.get<string>('API_URL') ?? 'http://localhost:3000').replace(/\/+$/, '');
    }

    private async removeObject(key?: string | null) {
        if (!key) return;
        await this.storage.delete(key).catch((e) => this.logger.warn(`Could not delete old profile photo ${key}: ${e?.message ?? e}`));
    }
}
