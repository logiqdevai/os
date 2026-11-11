import { Injectable, Logger, Optional } from '@nestjs/common';
import { Readable } from 'stream';
import { GcsService } from '@/integrations/storage/gcs/services/gcs.service';
import { GcsStorageDriver } from './gcs.driver';
import { LocalDiskStorageDriver } from './local-disk.driver';
import { StorageDriver, StoredObject } from './storage.driver';

/** True when the platform bucket is configured (GCS_PROJECT_ID + GCS_BUCKET_NAME). */
export const isGcsConfigured = () => !!(process.env.GCS_PROJECT_ID && process.env.GCS_BUCKET_NAME);

/**
 * Picks the storage driver once: GCS when configured, otherwise the local disk driver (`api/storage/`).
 * Services only talk to this class, never to a driver or SDK.
 */
@Injectable()
export class StorageService {
    private readonly logger = new Logger(StorageService.name);
    private readonly driver: StorageDriver;

    constructor(@Optional() gcs?: GcsService) {
        this.driver = gcs && isGcsConfigured() ? new GcsStorageDriver(gcs) : new LocalDiskStorageDriver();
        this.logger.log(`Document storage driver: ${this.driver.name}`);
    }

    get driverName() {
        return this.driver.name;
    }

    put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
        return this.driver.put(key, body, contentType);
    }

    getStream(key: string): Promise<Readable> {
        return this.driver.getStream(key);
    }

    delete(key: string): Promise<void> {
        return this.driver.delete(key);
    }
}
