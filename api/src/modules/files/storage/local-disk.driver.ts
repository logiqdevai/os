import { NotFoundException } from '@nestjs/common';
import { createReadStream, promises as fs } from 'fs';
import { dirname, join, resolve, sep } from 'path';
import { Readable } from 'stream';
import { DocumentStorageProvider } from 'generated/prisma';
import { StorageDriver, StoredObject } from './storage.driver';

/** Local disk driver for development: bytes under `api/storage/` (git-ignored). */
export class LocalDiskStorageDriver extends StorageDriver {
    readonly name = 'local';
    private readonly root = resolve(process.cwd(), 'storage');

    /** Resolve a key inside the root; rejects traversal (`..`, absolute keys). */
    private pathOf(key: string) {
        const full = resolve(join(this.root, key));
        if (!full.startsWith(this.root + sep)) throw new NotFoundException({ message: 'File not found', code: 'file_not_found' });
        return full;
    }

    async put(key: string, body: Buffer): Promise<StoredObject> {
        const full = this.pathOf(key);
        await fs.mkdir(dirname(full), { recursive: true });
        await fs.writeFile(full, body);
        return { key, bucket: null, provider: DocumentStorageProvider.PLATFORM };
    }

    async getStream(key: string): Promise<Readable> {
        const full = this.pathOf(key);
        try {
            await fs.access(full);
        } catch {
            throw new NotFoundException({ message: 'File content is missing from storage', code: 'file_content_missing' });
        }
        return createReadStream(full);
    }

    async delete(key: string): Promise<void> {
        try {
            await fs.unlink(this.pathOf(key));
        } catch {
            /* already gone */
        }
    }
}
