import { crc32, deflateRawSync, inflateRawSync } from 'zlib';

export interface ZipEntry {
    /** Path inside the archive, forward slashes, no leading slash. Names ending in "/" are folders. */
    name: string;
    data: Buffer;
}

const MAX_ENTRIES = 5000;
const MAX_TOTAL_UNCOMPRESSED = 200 * 1024 * 1024;

/** Minimal ZIP writer (deflate, UTF-8 names, no zip64) — enough for document exports without a dependency. */
export function createZip(entries: ZipEntry[]): Buffer {
    const locals: Buffer[] = [];
    const centrals: Buffer[] = [];
    let offset = 0;
    const { time, date } = dosDateTime(new Date());
    for (const entry of entries) {
        const name = Buffer.from(entry.name.replace(/^\/+/, ''), 'utf8');
        const isDir = entry.name.endsWith('/');
        const raw = isDir ? Buffer.alloc(0) : entry.data;
        const compressed = isDir ? raw : deflateRawSync(raw);
        const useDeflate = !isDir && compressed.length < raw.length;
        const body = useDeflate ? compressed : raw;
        const crc = crc32(raw) >>> 0;

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6); // UTF-8 names
        local.writeUInt16LE(useDeflate ? 8 : 0, 8);
        local.writeUInt16LE(time, 10);
        local.writeUInt16LE(date, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(body.length, 18);
        local.writeUInt32LE(raw.length, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);
        locals.push(local, name, body);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(useDeflate ? 8 : 0, 10);
        central.writeUInt16LE(time, 12);
        central.writeUInt16LE(date, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(body.length, 20);
        central.writeUInt32LE(raw.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE(isDir ? 0x10 : 0, 38);
        central.writeUInt32LE(offset, 42);
        centrals.push(central, name);
        offset += local.length + name.length + body.length;
    }
    const centralSize = centrals.reduce((n, b) => n + b.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, ...centrals, end]);
}

/**
 * Minimal ZIP reader (stored + deflate). Reads the central directory, rejects encrypted entries, path traversal
 * and archives above 5000 entries / 200 MB uncompressed (zip-bomb guard). Throws Error with a readable message.
 */
export function readZip(buffer: Buffer): ZipEntry[] {
    let eocd = -1;
    for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65_557); i--) {
        if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Not a ZIP archive');
    const count = buffer.readUInt16LE(eocd + 10);
    if (count > MAX_ENTRIES) throw new Error(`The archive has more than ${MAX_ENTRIES} files`);
    let ptr = buffer.readUInt32LE(eocd + 16);
    const out: ZipEntry[] = [];
    let total = 0;
    for (let n = 0; n < count; n++) {
        if (buffer.readUInt32LE(ptr) !== 0x02014b50) throw new Error('Corrupt ZIP central directory');
        const flags = buffer.readUInt16LE(ptr + 8);
        const method = buffer.readUInt16LE(ptr + 10);
        const compSize = buffer.readUInt32LE(ptr + 20);
        const size = buffer.readUInt32LE(ptr + 24);
        const nameLen = buffer.readUInt16LE(ptr + 28);
        const extraLen = buffer.readUInt16LE(ptr + 30);
        const commentLen = buffer.readUInt16LE(ptr + 32);
        const localOffset = buffer.readUInt32LE(ptr + 42);
        const name = buffer.subarray(ptr + 46, ptr + 46 + nameLen).toString(flags & 0x0800 ? 'utf8' : 'latin1').replace(/\\/g, '/');
        ptr += 46 + nameLen + extraLen + commentLen;
        if (flags & 0x1) throw new Error(`Encrypted entries are not supported (${name})`);
        if (name.startsWith('/') || name.split('/').includes('..')) throw new Error(`Unsafe path in archive: ${name}`);
        if (name.startsWith('__MACOSX/')) continue;
        total += size;
        if (total > MAX_TOTAL_UNCOMPRESSED) throw new Error('The archive is too large once unpacked');
        if (name.endsWith('/')) { out.push({ name, data: Buffer.alloc(0) }); continue; }
        if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('Corrupt ZIP entry');
        const start = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
        const body = buffer.subarray(start, start + compSize);
        let data: Buffer;
        if (method === 0) data = Buffer.from(body);
        else if (method === 8) data = inflateRawSync(body, { maxOutputLength: Math.max(size, 1) });
        else throw new Error(`Unsupported compression in ${name}`);
        out.push({ name, data });
    }
    return out;
}

function dosDateTime(d: Date) {
    return {
        time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
        date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
}
