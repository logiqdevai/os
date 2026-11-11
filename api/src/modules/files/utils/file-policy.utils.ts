import { DocumentPreviewKind } from 'generated/prisma';

/** Extensions that are never accepted, whatever the organization settings say (17 §5). */
export const ALWAYS_BLOCKED_EXTENSIONS = ['exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'pif', 'vbs', 'vbe', 'ps1', 'jar', 'dll', 'cpl', 'hta', 'reg', 'lnk'];

/** Hard request cap for multipart uploads; the organization limit (DocumentSettings.max_file_size_bytes) applies on top. */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

export const extensionOf = (filename: string) => {
    const i = filename.lastIndexOf('.');
    return i > 0 ? filename.slice(i + 1).toLowerCase() : '';
};

/** `image/*` style wildcard match. */
export const mimeMatches = (mime: string, pattern: string) => {
    const p = pattern.trim().toLowerCase();
    if (!p) return false;
    if (p.endsWith('/*')) return mime.toLowerCase().startsWith(p.slice(0, -1));
    return mime.toLowerCase() === p;
};

/** Windows PE / ELF executables by magic bytes (renamed binaries). */
export const looksExecutable = (buf: Buffer) =>
    (buf.length > 2 && buf[0] === 0x4d && buf[1] === 0x5a) || (buf.length > 4 && buf[0] === 0x7f && buf.toString('ascii', 1, 4) === 'ELF');

/** Safe file name for storage keys and Content-Disposition. */
export const safeFilename = (name: string) =>
    name.normalize('NFKD').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').replace(/^\.+/, '').slice(-120) || 'file';

/** Inline preview kind for a mime type (null = download only). */
export function previewKindFor(mime: string): DocumentPreviewKind | null {
    const m = mime.toLowerCase();
    if (m.startsWith('image/') && m !== 'image/svg+xml') return DocumentPreviewKind.IMAGE;
    if (m === 'application/pdf') return DocumentPreviewKind.PDF;
    if (m.startsWith('video/')) return DocumentPreviewKind.VIDEO;
    if (m.startsWith('audio/')) return DocumentPreviewKind.AUDIO;
    if (m.startsWith('text/') || ['application/json', 'application/xml', 'application/x-yaml'].includes(m)) return DocumentPreviewKind.TEXT;
    return null;
}

export type FileTypeGroup = 'image' | 'pdf' | 'document' | 'spreadsheet' | 'presentation' | 'video' | 'audio' | 'archive' | 'text' | 'other';

/** Coarse type group used by filters and storage usage. */
export function typeGroupOf(mime: string | null | undefined): FileTypeGroup {
    const m = (mime ?? '').toLowerCase();
    if (m.startsWith('image/')) return 'image';
    if (m === 'application/pdf') return 'pdf';
    if (m.startsWith('video/')) return 'video';
    if (m.startsWith('audio/')) return 'audio';
    if (m.includes('spreadsheet') || m.includes('excel') || m === 'text/csv') return 'spreadsheet';
    if (m.includes('presentation') || m.includes('powerpoint')) return 'presentation';
    if (m.includes('word') || m.includes('opendocument.text') || m === 'application/rtf') return 'document';
    if (m.includes('zip') || m.includes('compressed') || m.includes('tar') || m.includes('rar')) return 'archive';
    if (m.startsWith('text/') || m === 'application/json') return 'text';
    return 'other';
}

/** Mime prefixes per type group, for list filters. */
export const TYPE_GROUP_MIME: Record<Exclude<FileTypeGroup, 'other'>, string[]> = {
    image: ['image/'],
    pdf: ['application/pdf'],
    video: ['video/'],
    audio: ['audio/'],
    spreadsheet: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml', 'text/csv', 'application/vnd.oasis.opendocument.spreadsheet'],
    presentation: ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml'],
    document: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml', 'application/rtf', 'application/vnd.oasis.opendocument.text'],
    archive: ['application/zip', 'application/x-zip', 'application/x-7z', 'application/x-tar', 'application/gzip', 'application/x-rar'],
    text: ['text/plain', 'text/markdown', 'application/json'],
};
