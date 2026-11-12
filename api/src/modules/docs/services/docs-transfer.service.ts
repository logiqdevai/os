import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, WikiPageType, WikiTransferFormat, WikiTransferKind, WikiTransferScope, WikiTransferStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { createZip, readZip, ZipEntry } from '@/shared/utils/zip/zip.utils';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import { DocsAccessService } from '../docs-access.service';
import { DocsPagesService } from './pages.service';

const MAX_IMPORT_PAGES = 500;
const PAGE_TYPES = new Set<string>(Object.values(WikiPageType));

export interface ExportInput {
    scope: 'PAGE' | 'SUBTREE' | 'SPACE';
    page_id?: string;
    space_id?: string;
}

export interface ImportInput {
    space_id: string;
    parent_page_id?: string;
    publish?: boolean;
}

/** `---` front matter with simple `key: value` lines (quoted or bare). */
function parseFrontMatter(md: string): { meta: Record<string, string>; body: string } {
    const m = md.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!m) return { meta: {}, body: md.replace(/^﻿/, '') };
    const meta: Record<string, string> = {};
    for (const line of m[1].split(/\r?\n/)) {
        const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
        if (!kv) continue;
        let v = kv[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            try { v = v.startsWith('"') ? JSON.parse(v) : v.slice(1, -1); } catch { v = v.slice(1, -1); }
        }
        meta[kv[1]] = v;
    }
    return { meta, body: md.slice(m[0].length) };
}

const yaml = (v: string) => JSON.stringify(v);
const prettify = (segment: string) => segment.replace(/\.md$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase()) || 'Untitled';

/**
 * 15 §2, §10 — Markdown import / export. Export: one `.md` file per readable page (front matter + content) in a
 * folder tree that mirrors the page tree, zipped. Import: a `.md` file or a `.zip` of them; folders become parent
 * pages (`folder.md` next to `folder/` is used as that parent). Every created page goes through DocsPagesService.create,
 * so space access, versions, audit and events are the same as a manual create. Jobs are logged in WikiTransferJob.
 */
@Injectable()
export class DocsTransferService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly access: DocsAccessService,
        private readonly pages: DocsPagesService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    async export(ctx: OrgContext, input: ExportInput): Promise<{ filename: string; buffer: Buffer; page_count: number }> {
        const p = await this.access.principals(ctx);
        const readable: Prisma.WikiPageWhereInput = { ...this.access.readablePageWhere(ctx, p), archived_at: null };
        let where: Prisma.WikiPageWhereInput;
        let rootName: string;
        let rootPath = '';
        let spaceId: string | null = null;
        let pageId: string | null = null;
        if (input.scope === 'SPACE') {
            if (!input.space_id) throw new BadRequestException({ message: 'space_id is required', code: 'wiki_export_invalid' });
            const { space } = await this.access.readableSpace(ctx, input.space_id, p);
            where = { ...readable, space_id: space.id };
            rootName = space.name;
            spaceId = space.id;
        } else {
            if (!input.page_id) throw new BadRequestException({ message: 'page_id is required', code: 'wiki_export_invalid' });
            const { page } = await this.access.readablePage(ctx, input.page_id, p);
            rootName = page.title;
            pageId = page.id;
            spaceId = page.space_id;
            rootPath = `${page.path}${page.id}/`;
            where = input.scope === 'PAGE' ? { ...readable, id: page.id } : { ...readable, OR: [{ id: page.id }, { path: { startsWith: rootPath } }] };
        }
        const rows = await this.prisma.wikiPage.findMany({
            where,
            select: { id: true, parent_page_id: true, title: true, slug: true, icon: true, page_type: true, status: true, content_markdown: true, current_version_number: true, updated_at: true, depth: true, sort_order: true },
            orderBy: [{ depth: 'asc' }, { sort_order: 'asc' }, { title: 'asc' }],
            take: 5000,
        });
        if (!rows.length) throw new NotFoundException({ message: 'Nothing to export', code: 'wiki_export_empty' });

        const ids = new Set(rows.map((r) => r.id));
        const hasChildren = new Set(rows.filter((r) => r.parent_page_id && ids.has(r.parent_page_id)).map((r) => r.parent_page_id as string));
        const used = new Set<string>();
        const folderOf = new Map<string, string>();
        const entries: ZipEntry[] = [];
        for (const r of rows) {
            const parentFolder = r.parent_page_id && ids.has(r.parent_page_id) ? folderOf.get(r.parent_page_id) ?? '' : '';
            let base = r.slug || slugify(r.title) || 'page';
            for (let i = 2; used.has(`${parentFolder}${base}`); i++) base = `${r.slug || 'page'}-${i}`;
            used.add(`${parentFolder}${base}`);
            if (hasChildren.has(r.id)) folderOf.set(r.id, `${parentFolder}${base}/`);
            const front = ['---', `title: ${yaml(r.title)}`, ...(r.icon ? [`icon: ${yaml(r.icon)}`] : []), `page_type: ${r.page_type}`, `status: ${r.status}`, `version: ${r.current_version_number}`, `updated_at: ${r.updated_at.toISOString()}`, `source_id: ${r.id}`, '---', ''];
            entries.push({ name: `${parentFolder}${base}.md`, data: Buffer.from(`${front.join('\n')}\n${r.content_markdown ?? ''}\n`, 'utf8') });
        }
        const buffer = createZip(entries);
        const filename = `${slugify(rootName) || 'docs'}-export.zip`;
        const job = await this.prisma.wikiTransferJob.create({
            data: {
                organization_id: ctx.organization_id, kind: WikiTransferKind.EXPORT, format: WikiTransferFormat.MARKDOWN, scope: input.scope as WikiTransferScope,
                space_id: spaceId, page_id: pageId, status: WikiTransferStatus.COMPLETED, page_count: rows.length, requested_by_membership_id: ctx.membership_id ?? null, finished_at: new Date(),
            },
        });
        await this.audit.record(ctx, 'wiki_page.exported', { resource_type: 'wiki_transfer_job', resource_id: job.id, metadata: { scope: input.scope, space_id: spaceId, page_id: pageId, page_count: rows.length, bytes: buffer.length } });
        this.events.publish(ctx, { event_key: 'docs.export.completed', module: ModuleKey.BUSINESS_DOCS, entity_kind: 'wiki_transfer_job', entity_id: job.id, payload: { scope: input.scope, page_count: rows.length } });
        return { filename, buffer, page_count: rows.length };
    }

    async import(ctx: OrgContext, file: { buffer: Buffer; originalname: string } | undefined, input: ImportInput) {
        if (!file?.buffer?.length) throw new BadRequestException({ message: 'Choose a .md or .zip file', code: 'wiki_import_no_file' });
        const p = await this.access.principals(ctx);
        const { space, level } = await this.access.readableSpace(ctx, input.space_id, p);
        this.access.assert(level, 'EDIT', 'this space');
        if (input.parent_page_id) await this.access.readablePage(ctx, input.parent_page_id, p);

        const lower = file.originalname.toLowerCase();
        let files: ZipEntry[];
        if (lower.endsWith('.zip')) {
            try {
                files = readZip(file.buffer);
            } catch (e) {
                throw new BadRequestException({ message: `The ZIP file could not be read: ${(e as Error).message}`, code: 'wiki_import_bad_zip' });
            }
        } else if (/\.(md|markdown|txt)$/.test(lower)) {
            files = [{ name: file.originalname, data: file.buffer }];
        } else {
            throw new BadRequestException({ message: 'Only .md, .markdown, .txt or .zip files can be imported', code: 'wiki_import_unsupported' });
        }
        const warnings: string[] = [];
        const docs = files.filter((f) => !f.name.endsWith('/') && /\.(md|markdown|txt)$/i.test(f.name));
        files.filter((f) => !f.name.endsWith('/') && !/\.(md|markdown|txt)$/i.test(f.name)).slice(0, 50).forEach((f) => warnings.push(`Skipped ${f.name} (not Markdown)`));
        if (!docs.length) throw new BadRequestException({ message: 'No Markdown files found in the upload', code: 'wiki_import_empty' });
        if (docs.length > MAX_IMPORT_PAGES) throw new BadRequestException({ message: `At most ${MAX_IMPORT_PAGES} pages per import`, code: 'wiki_import_too_many' });

        // Common top folder (e.g. "export/") is dropped so a re-imported export lands at the chosen parent.
        const keyOf = (name: string) => name.replace(/\.(md|markdown|txt)$/i, '');
        const keys = docs.map((d) => keyOf(d.name));
        const firstSeg = keys[0].split('/')[0];
        const strip = keys.length > 1 && keys.every((k) => k.includes('/') && k.split('/')[0] === firstSeg) && !keys.includes(firstSeg) ? `${firstSeg}/` : '';
        const nodes = new Map<string, { key: string; doc: ZipEntry | null }>();
        for (const d of docs) nodes.set(keyOf(d.name).slice(strip.length), { key: keyOf(d.name).slice(strip.length), doc: d });
        // Folders without a matching .md become empty parent pages.
        for (const key of [...nodes.keys()]) {
            const segs = key.split('/');
            for (let i = 1; i < segs.length; i++) {
                const folder = segs.slice(0, i).join('/');
                if (!nodes.has(folder)) nodes.set(folder, { key: folder, doc: null });
            }
        }
        const ordered = [...nodes.values()].sort((a, b) => a.key.split('/').length - b.key.split('/').length || a.key.localeCompare(b.key));
        if (ordered.length > MAX_IMPORT_PAGES) throw new BadRequestException({ message: `At most ${MAX_IMPORT_PAGES} pages per import`, code: 'wiki_import_too_many' });

        const job = await this.prisma.wikiTransferJob.create({
            data: { organization_id: ctx.organization_id, kind: WikiTransferKind.IMPORT, format: WikiTransferFormat.MARKDOWN, scope: WikiTransferScope.SUBTREE, space_id: space.id, page_id: input.parent_page_id ?? null, status: WikiTransferStatus.RUNNING, requested_by_membership_id: ctx.membership_id ?? null },
        });
        const created = new Map<string, string>();
        const createdPages: { id: string; title: string }[] = [];
        try {
            for (const node of ordered) {
                const segs = node.key.split('/');
                const parentKey = segs.slice(0, -1).join('/');
                const parentId = parentKey ? created.get(parentKey) : input.parent_page_id;
                let title = prettify(segs[segs.length - 1]);
                let content = '';
                let pageType: WikiPageType | undefined;
                let icon: string | undefined;
                if (node.doc) {
                    const { meta, body } = parseFrontMatter(node.doc.data.toString('utf8'));
                    content = body;
                    const h1 = content.match(/^\s*#\s+(.+?)\s*#*\s*(\r?\n|$)/);
                    if (meta.title) title = meta.title.slice(0, 200);
                    else if (h1) {
                        title = h1[1].slice(0, 200);
                        content = content.slice(h1[0].length);
                    }
                    if (meta.page_type && PAGE_TYPES.has(meta.page_type)) pageType = meta.page_type as WikiPageType;
                    if (meta.icon && [...meta.icon].length <= 4) icon = meta.icon;
                    if (content.length > 500_000) {
                        warnings.push(`${node.doc.name}: content truncated to 500 000 characters`);
                        content = content.slice(0, 500_000);
                    }
                }
                const page = await this.pages.create(ctx, {
                    space_id: space.id,
                    ...(parentId ? { parent_page_id: parentId } : {}),
                    title: title || 'Untitled',
                    ...(icon ? { icon } : {}),
                    ...(pageType ? { page_type: pageType } : {}),
                    content_markdown: content.trim(),
                    publish: !!input.publish && ctx.can('docs.pages.publish'),
                });
                created.set(node.key, page.id);
                createdPages.push({ id: page.id, title: page.title });
            }
        } catch (error) {
            await this.prisma.wikiTransferJob.update({ where: { id: job.id }, data: { status: WikiTransferStatus.FAILED, page_count: createdPages.length, warning_count: warnings.length, error_report: { error: (error as Error).message, warnings } as Prisma.InputJsonValue, finished_at: new Date() } });
            throw error;
        }
        await this.prisma.wikiTransferJob.update({ where: { id: job.id }, data: { status: WikiTransferStatus.COMPLETED, page_count: createdPages.length, warning_count: warnings.length, error_report: warnings.length ? ({ warnings } as Prisma.InputJsonValue) : Prisma.DbNull, finished_at: new Date() } });
        await this.audit.record(ctx, 'wiki_page.imported', { resource_type: 'wiki_transfer_job', resource_id: job.id, metadata: { space_id: space.id, parent_page_id: input.parent_page_id ?? null, page_count: createdPages.length, file: file.originalname } });
        this.events.publish(ctx, { event_key: 'docs.import.completed', module: ModuleKey.BUSINESS_DOCS, entity_kind: 'wiki_transfer_job', entity_id: job.id, payload: { space_id: space.id, page_count: createdPages.length } });
        return { job_id: job.id, page_count: createdPages.length, warnings, pages: createdPages.slice(0, 50), root_page_id: createdPages[0]?.id ?? null };
    }

    async jobs(ctx: OrgContext) {
        return this.prisma.wikiTransferJob.findMany({
            where: { organization_id: ctx.organization_id, ...(ctx.can('docs.spaces.manage') ? {} : { requested_by_membership_id: ctx.membership_id ?? '__none__' }) },
            orderBy: { created_at: 'desc' },
            take: 20,
            include: { space: { select: { id: true, name: true } }, page: { select: { id: true, title: true } } },
        });
    }
}
