import { Readable } from 'stream';
import { DocumentStorageProvider } from 'generated/prisma';

export interface StoredObject {
    /** Object key inside the provider (never exposed to clients). */
    key: string;
    bucket: string | null;
    provider: DocumentStorageProvider;
}

/**
 * Storage abstraction (17 §16). Every driver stores opaque bytes under a key; the Document record and its
 * permissions stay in this module. Swap drivers without touching the services.
 */
export abstract class StorageDriver {
    abstract readonly name: string;
    abstract put(key: string, body: Buffer, contentType: string): Promise<StoredObject>;
    abstract getStream(key: string): Promise<Readable>;
    abstract delete(key: string): Promise<void>;
}
