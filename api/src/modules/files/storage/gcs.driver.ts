import { NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';
import { DocumentStorageProvider } from 'generated/prisma';
import { GcsService } from '@/integrations/storage/gcs/services/gcs.service';
import { StorageDriver, StoredObject } from './storage.driver';

/** Google Cloud Storage driver (platform bucket) through the GCS integration module. */
export class GcsStorageDriver extends StorageDriver {
    readonly name = 'gcs';

    constructor(private readonly gcs: GcsService) {
        super();
    }

    async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
        const slash = key.lastIndexOf('/');
        const res = await this.gcs.uploadImage({ file: body, filename: key.slice(slash + 1), folder: key.slice(0, slash), contentType });
        return { key: res.path, bucket: res.bucket, provider: DocumentStorageProvider.PLATFORM };
    }

    async getStream(key: string): Promise<Readable> {
        try {
            const res = await this.gcs.downloadImage({ filename: key });
            return Readable.from(res.buffer);
        } catch {
            throw new NotFoundException({ message: 'File content is missing from storage', code: 'file_content_missing' });
        }
    }

    async delete(key: string): Promise<void> {
        try {
            await this.gcs.deleteImage({ filename: key });
        } catch {
            /* already gone */
        }
    }
}
