import { StreamableFile } from '@nestjs/common';
import { Readable } from 'stream';
import { safeFilename } from './file-policy.utils';

/** StreamableFile with a safe Content-Disposition (ASCII fallback + RFC 5987 UTF-8 name) and no caching. */
export function streamable(file: { stream: Readable; filename: string; mimetype: string; size?: number; disposition: 'inline' | 'attachment' }) {
    const ascii = safeFilename(file.filename);
    return new StreamableFile(file.stream, {
        type: file.mimetype || 'application/octet-stream',
        length: file.size,
        disposition: `${file.disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    });
}
