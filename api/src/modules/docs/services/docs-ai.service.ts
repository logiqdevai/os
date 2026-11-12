import { createHash } from 'crypto';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ModuleKey, Prisma, WikiAiIndexStatus, WikiAiSourceType, WikiSearchMode } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService, PublishedEvent } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { cosineSimilarity, OrgAiService } from '@/integrations/ai/services/org-ai.service';
import { DocsAccessService } from '../docs-access.service';
import { markdownToText } from '../utils/docs.utils';

const CHUNK_CHARS = 1200;
const MAX_CANDIDATES = 4000;
const TOP_K = 6;
const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'what', 'when', 'where', 'which', 'how', 'who', 'why', 'does', 'from', 'have', 'are', 'was', 'our', 'your', 'can', 'there', 'about', 'into', 'than', 'then', 'they', 'them', 'will', 'should', 'would', 'could', 'is', 'do', 'we', 'a', 'an', 'of', 'to', 'in', 'on', 'it', 'be', 'or', 'as', 'at', 'by', 'if', 'i']);

export interface DocChunk {
    chunk_index: number;
    heading_path: string | null;
    content_text: string;
}

/** Split markdown at headings (keeping the heading path) and then into ~1200-character chunks on paragraph breaks. */
export function chunkMarkdown(title: string, md: string | null): DocChunk[] {
    const lines = (md ?? '').split('\n');
    const sections: { path: string[]; body: string[] }[] = [{ path: [], body: [] }];
    const stack: { level: number; text: string }[] = [];
    let inCode = false;
    for (const line of lines) {
        if (/^\s*```/.test(line)) inCode = !inCode;
        const h = !inCode && line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
        if (h) {
            const level = h[1].length;
            while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
            stack.push({ level, text: h[2].trim() });
            sections.push({ path: stack.map((s) => s.text), body: [] });
        } else {
            sections[sections.length - 1].body.push(line);
        }
    }
    const out: DocChunk[] = [];
    for (const s of sections) {
        const text = markdownToText(s.body.join('\n'));
        if (!text && !s.path.length) continue;
        const heading = s.path.length ? s.path.join(' > ') : null;
        const paragraphs = text.length <= CHUNK_CHARS ? [text] : splitLong(text);
        for (const p of paragraphs) {
            if (!p.trim() && !heading) continue;
            out.push({ chunk_index: out.length, heading_path: heading, content_text: `${title}${heading ? ` — ${heading}` : ''}\n${p}`.trim() });
        }
    }
    if (!out.length) out.push({ chunk_index: 0, heading_path: null, content_text: title });
    return out;
}

function splitLong(text: string) {
    const parts: string[] = [];
    const sentences = text.split(/(?<=[.!?])\s+/);
    let cur = '';
    for (const s of sentences) {
        if ((cur + ' ' + s).length > CHUNK_CHARS && cur) {
            parts.push(cur.trim());
            cur = '';
        }
        cur += ` ${s}`;
        while (cur.length > CHUNK_CHARS * 1.5) {
            parts.push(cur.slice(0, CHUNK_CHARS).trim());
            cur = cur.slice(CHUNK_CHARS);
        }
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
}

const terms = (q: string) => [...new Set((q.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []).filter((w) => !STOP.has(w)))].slice(0, 12);
const hash = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * 15 §6 — AI Q&A over the organization's wiki. Pages are chunked into WikiAiIndexEntry rows (re-indexed when a page
 * changes, embeddings with the organization's own OpenAI key when connected). Questions retrieve chunks only from
 * pages the asker can read (DocsAccessService), answer with numbered citations, and fall back to keyword retrieval
 * plus the matching passages when no AI provider is connected.
 */
@Injectable()
export class DocsAiService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(DocsAiService.name);
    private readonly listener = (event: PublishedEvent) => this.onEvent(event);

    constructor(
        private readonly prisma: PrismaService,
        private readonly access: DocsAccessService,
        private readonly ai: OrgAiService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    onModuleInit() {
        this.events.bus.on('event', this.listener);
    }

    onModuleDestroy() {
        this.events.bus.off('event', this.listener);
    }

    /** Re-index a page whenever it is created, saved, moved, restored or its permissions change. */
    private onEvent(event: PublishedEvent) {
        if (!event.organization_id || !event.entity_id || !event.event_key.startsWith('docs.page.')) return;
        if (['docs.page.commented', 'docs.page.acknowledged', 'docs.page.linked'].includes(event.event_key)) return;
        const orgId = event.organization_id;
        const pageId = event.entity_id;
        setImmediate(() => void this.indexPage(orgId, pageId).catch((e) => this.logger.warn(`index ${pageId} failed: ${(e as Error).message}`)));
    }

    /** Chunk one page and (re)embed only the chunks whose text changed. Archived / deleted pages lose their entries. */
    async indexPage(organizationId: string, pageId: string) {
        const page = await this.prisma.wikiPage.findFirst({
            where: { id: pageId, organization_id: organizationId },
            select: { id: true, title: true, content_markdown: true, space_id: true, visibility: true, customer_visible: true, current_version_number: true, archived_at: true, deleted_at: true },
        });
        if (!page || page.archived_at || page.deleted_at) {
            await this.prisma.wikiAiIndexEntry.deleteMany({ where: { source_type: WikiAiSourceType.WIKI_PAGE, source_id: pageId } });
            return { chunks: 0, embedded: 0 };
        }
        const chunks = chunkMarkdown(page.title, page.content_markdown);
        const existing = await this.prisma.wikiAiIndexEntry.findMany({ where: { source_type: WikiAiSourceType.WIKI_PAGE, source_id: pageId }, select: { chunk_index: true, content_hash: true, embedding: true, embedding_model: true } });
        const byIndex = new Map(existing.map((e) => [e.chunk_index, e]));
        const conn = await this.ai.connection(organizationId);
        const toEmbed = conn ? chunks.filter((c) => { const e = byIndex.get(c.chunk_index); return !e || e.content_hash !== hash(c.content_text) || !e.embedding.length || e.embedding_model !== conn.embedding_model; }) : [];
        let vectors = new Map<number, number[]>();
        let model: string | null = null;
        let embedError: string | null = null;
        if (toEmbed.length) {
            const res = await this.ai.embed(organizationId, toEmbed.map((c) => c.content_text));
            if (res.available) {
                vectors = new Map(toEmbed.map((c, i) => [c.chunk_index, res.vectors[i]]));
                model = res.model;
            } else {
                embedError = res.available === false ? res.message : null;
            }
        }
        const now = new Date();
        await this.prisma.$transaction([
            this.prisma.wikiAiIndexEntry.deleteMany({ where: { source_type: WikiAiSourceType.WIKI_PAGE, source_id: pageId, chunk_index: { gte: chunks.length } } }),
            ...chunks.map((c) => {
                const prev = byIndex.get(c.chunk_index);
                const h = hash(c.content_text);
                const vector = vectors.get(c.chunk_index);
                const keepVector = !vector && prev && prev.content_hash === h ? { embedding: prev.embedding, embedding_model: prev.embedding_model } : null;
                const data = {
                    heading_path: c.heading_path,
                    content_text: c.content_text,
                    content_hash: h,
                    token_count: Math.ceil(c.content_text.length / 4),
                    embedding: vector ?? keepVector?.embedding ?? [],
                    embedding_model: vector ? model : keepVector?.embedding_model ?? null,
                    space_id: page.space_id,
                    visibility: page.visibility,
                    customer_visible: page.customer_visible,
                    source_version: page.current_version_number,
                    status: WikiAiIndexStatus.INDEXED,
                    indexed_at: now,
                    error: embedError,
                };
                return this.prisma.wikiAiIndexEntry.upsert({
                    where: { source_type_source_id_chunk_index: { source_type: WikiAiSourceType.WIKI_PAGE, source_id: pageId, chunk_index: c.chunk_index } },
                    create: { organization_id: organizationId, source_type: WikiAiSourceType.WIKI_PAGE, source_id: pageId, page_id: pageId, chunk_index: c.chunk_index, ...data },
                    update: data,
                });
            }),
        ]);
        return { chunks: chunks.length, embedded: vectors.size };
    }

    /** Index every page of the organization the caller can read (managers: all). Used by "Rebuild index". */
    async reindex(ctx: OrgContext) {
        const p = await this.access.principals(ctx);
        const pages = await this.prisma.wikiPage.findMany({ where: { ...this.access.readablePageWhere(ctx, p), archived_at: null }, select: { id: true }, take: 2000 });
        let chunks = 0;
        let embedded = 0;
        for (const pg of pages) {
            const r = await this.indexPage(ctx.organization_id, pg.id);
            chunks += r.chunks;
            embedded += r.embedded;
        }
        await this.audit.record(ctx, 'wiki_ai.reindexed', { resource_type: 'wiki_ai_index', resource_id: ctx.organization_id, metadata: { pages: pages.length, chunks, embedded } });
        return { pages: pages.length, chunks, embedded, ai_configured: await this.ai.isConfigured(ctx.organization_id) };
    }

    async status(ctx: OrgContext) {
        const [configured, total, embedded, pages, last] = await Promise.all([
            this.ai.isConfigured(ctx.organization_id),
            this.prisma.wikiAiIndexEntry.count({ where: { organization_id: ctx.organization_id, source_type: WikiAiSourceType.WIKI_PAGE } }),
            this.prisma.wikiAiIndexEntry.count({ where: { organization_id: ctx.organization_id, source_type: WikiAiSourceType.WIKI_PAGE, embedding_model: { not: null } } }),
            this.prisma.wikiAiIndexEntry.groupBy({ by: ['page_id'], where: { organization_id: ctx.organization_id, source_type: WikiAiSourceType.WIKI_PAGE } }),
            this.prisma.wikiAiIndexEntry.findFirst({ where: { organization_id: ctx.organization_id }, orderBy: { indexed_at: 'desc' }, select: { indexed_at: true } }),
        ]);
        return { ai_configured: configured, mode: configured && embedded ? 'semantic' : 'keyword', chunks: total, embedded_chunks: embedded, indexed_pages: pages.length, last_indexed_at: last?.indexed_at ?? null };
    }

    /**
     * Answer a question from the wiki. Retrieval is restricted to pages the caller can read; the answer cites
     * them as [1], [2]… Without an AI provider (or on provider error) the best passages are returned instead.
     */
    async ask(ctx: OrgContext, input: { question: string; space_id?: string }) {
        const question = input.question.trim();
        const p = await this.access.principals(ctx);
        const readable: Prisma.WikiPageWhereInput = { ...this.access.readablePageWhere(ctx, p), archived_at: null, ...(input.space_id && { space_id: input.space_id }) };

        // Lazy first index so a fresh organization gets answers without a manual rebuild.
        const anyEntry = await this.prisma.wikiAiIndexEntry.findFirst({ where: { organization_id: ctx.organization_id, source_type: WikiAiSourceType.WIKI_PAGE }, select: { id: true } });
        if (!anyEntry) {
            const pages = await this.prisma.wikiPage.findMany({ where: { organization_id: ctx.organization_id, archived_at: null, deleted_at: null }, select: { id: true }, take: 300 });
            for (const pg of pages) await this.indexPage(ctx.organization_id, pg.id).catch(() => undefined);
        }

        const conn = await this.ai.connection(ctx.organization_id);
        let mode: 'semantic' | 'keyword' = 'keyword';
        let scored: { id: string; page_id: string; heading_path: string | null; content_text: string; score: number }[] = [];

        if (conn) {
            const qv = await this.ai.embed(ctx.organization_id, [question]);
            if (qv.available) {
                const candidates = await this.prisma.wikiAiIndexEntry.findMany({
                    where: { organization_id: ctx.organization_id, source_type: WikiAiSourceType.WIKI_PAGE, embedding_model: qv.model, page: readable },
                    select: { id: true, page_id: true, heading_path: true, content_text: true, embedding: true },
                    take: MAX_CANDIDATES,
                });
                if (candidates.length) {
                    mode = 'semantic';
                    scored = candidates
                        .map((c) => ({ id: c.id, page_id: c.page_id as string, heading_path: c.heading_path, content_text: c.content_text, score: cosineSimilarity(qv.vectors[0], c.embedding) }))
                        .filter((c) => c.score > 0.2)
                        .sort((a, b) => b.score - a.score)
                        .slice(0, TOP_K);
                }
            }
        }
        if (mode === 'keyword') {
            const words = terms(question);
            if (words.length) {
                const candidates = await this.prisma.wikiAiIndexEntry.findMany({
                    where: { organization_id: ctx.organization_id, source_type: WikiAiSourceType.WIKI_PAGE, page: readable, OR: words.map((w) => ({ content_text: { contains: w, mode: 'insensitive' as const } })) },
                    select: { id: true, page_id: true, heading_path: true, content_text: true },
                    take: 400,
                });
                scored = candidates
                    .map((c) => {
                        const text = c.content_text.toLowerCase();
                        const hits = words.filter((w) => text.includes(w));
                        const freq = hits.reduce((n, w) => n + text.split(w).length - 1, 0);
                        return { ...c, page_id: c.page_id as string, score: hits.length / words.length + Math.min(freq, 20) / 100 };
                    })
                    .sort((a, b) => b.score - a.score)
                    .slice(0, TOP_K);
            }
        }

        const pageIds = [...new Set(scored.map((s) => s.page_id))];
        const pages = pageIds.length ? await this.prisma.wikiPage.findMany({ where: { id: { in: pageIds } }, select: { id: true, title: true, icon: true, space: { select: { id: true, name: true } } } }) : [];
        // One citation number per page, in order of first appearance.
        const citations = pageIds.map((id, i) => {
            const pg = pages.find((x) => x.id === id);
            const best = scored.find((s) => s.page_id === id)!;
            return { index: i + 1, page_id: id, title: pg?.title ?? 'Untitled', icon: pg?.icon ?? null, space: pg?.space ?? null, heading_path: best.heading_path, excerpt: best.content_text.split('\n').slice(1).join(' ').slice(0, 280), score: Math.round(best.score * 1000) / 1000 };
        });

        let answer: string | null = null;
        let aiAvailable = !!conn;
        let reason: string | null = conn ? null : 'ai_not_configured';
        let model: string | null = null;
        if (conn && scored.length) {
            const context = scored.map((s) => `[${pageIds.indexOf(s.page_id) + 1}] ${s.content_text}`).join('\n\n---\n\n');
            const res = await this.ai.generateText(ctx.organization_id, {
                system: 'You answer questions for employees using only the company wiki excerpts provided. Cite the excerpts you used with their numbers in square brackets, e.g. [1] or [2][3]. If the excerpts do not contain the answer, say so plainly and suggest who or which page might help. Answer in the language of the question. Be concise.',
                prompt: `Question: ${question}\n\nWiki excerpts:\n${context}`,
                temperature: 0.1,
                maxTokens: 600,
            });
            if (res.available) {
                answer = res.text;
                model = res.model;
            } else {
                aiAvailable = false;
                reason = res.available === false ? res.reason : null;
            }
        }

        this.prisma.wikiSearchQuery
            .create({ data: { organization_id: ctx.organization_id, membership_id: ctx.membership_id, query: question.slice(0, 200), mode: mode === 'semantic' ? WikiSearchMode.SEMANTIC : WikiSearchMode.KEYWORD, filters: { ask: true, space_id: input.space_id ?? null } as Prisma.InputJsonValue, result_count: citations.length } })
            .catch(() => undefined);
        await this.audit.record(ctx, 'wiki_ai.question_answered', { resource_type: 'wiki_ai', resource_id: ctx.organization_id, metadata: { mode, answered: !!answer, citations: citations.map((c) => c.page_id), model } });
        this.events.publish(ctx, { event_key: 'docs.ai.question_asked', module: ModuleKey.BUSINESS_DOCS, entity_kind: 'wiki_ai_question', payload: { mode, answered: !!answer, citation_count: citations.length } });

        return { question, answer, mode, ai_available: aiAvailable, reason, model, citations };
    }
}
