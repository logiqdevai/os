import { Injectable } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { OrgAiService } from '@/integrations/ai/services/org-ai.service';
import { ReleasesService } from './releases.service';

export const PublishReleaseNotesSchema = z.object({ notes: z.string().trim().min(1).max(50_000) });
export type PublishReleaseNotesInput = z.infer<typeof PublishReleaseNotesSchema>;
export const ReleaseIdToolSchema = z.object({ id: z.string().uuid() });
export const PublishReleaseNotesToolSchema = PublishReleaseNotesSchema.extend({ id: z.string().uuid() });

type Section = 'New' | 'Improved' | 'Fixed' | 'Other';
const sectionOf = (type: string | null | undefined): Section => {
    const t = (type ?? '').toLowerCase();
    if (/bug|fix|defect|incident/.test(t)) return 'Fixed';
    if (/feature|story|epic/.test(t)) return 'New';
    if (/improve|enhance|refactor|chore|tech/.test(t)) return 'Improved';
    return 'Other';
};

/**
 * 06 §9, §14 — release notes from a release's tasks. The AI draft runs on the organization's own OpenAI key (BYOK) and is
 * only returned, never saved: a person edits it and publishes (PATCH notes or POST publish). Without an AI connection the
 * response carries a clear message and a draft grouped from the task list. Tasks outside the caller's scope are never used.
 */
@Injectable()
export class ReleaseNotesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly releases: ReleasesService,
        private readonly ai: OrgAiService,
    ) { }

    async draft(ctx: OrgContext, id: string) {
        const release = await this.releases.get(ctx, id);
        const done = release.tasks.filter((t) => t.status?.category === 'DONE');
        const tasks = (done.length ? done : release.tasks).filter((t) => t.status?.category !== 'CANCELLED');
        const customerFacing = release.customer_visible;
        const items = tasks.map((t) => ({ id: t.identifier, title: t.title, type: t.type?.name ?? null, section: sectionOf(t.type?.name), customer_visible: t.customer_visible, labels: t.labels.map((l) => l.name) }));
        const fallback = this.fallback(release.name, release.version, items, customerFacing);
        if (!items.length) return { available: false as const, reason: 'no_tasks' as const, message: 'This release has no tasks yet. Add tasks to the release first.', fallback, task_count: 0 };

        const result = await this.ai.generateText(ctx.organization_id, {
            system: [
                'You write release notes for a software product. Use only the tasks given; never invent features.',
                customerFacing ? 'The notes are customer-facing: plain language, user benefit first, no internal ticket keys, no internal jargon.' : 'The notes are internal: you may keep ticket keys in parentheses.',
                'Write Markdown: a one-sentence intro, then "## New", "## Improved", "## Fixed" sections with "- " bullets (omit empty sections). Respond with the Markdown only.',
            ].join(' '),
            prompt: `Release: ${release.name}${release.version ? ` ${release.version}` : ''}\nTasks (JSON):\n${JSON.stringify(items, null, 1)}`,
            temperature: 0.3,
            maxTokens: 1500,
        });
        if (result.available === false) return { available: false as const, reason: result.reason, message: result.message, fallback, task_count: items.length };
        const notes = result.text.replace(/^```(?:markdown|md)?\s*/i, '').replace(/```\s*$/, '').trim();
        await this.audit.record(ctx, 'release.notes_ai_drafted', {
            resource_type: 'release', resource_id: id,
            metadata: { model: result.model, input_tokens: result.input_tokens, output_tokens: result.output_tokens, cost: result.cost, task_count: items.length },
        });
        return { available: true as const, notes, model: result.model, fallback, task_count: items.length };
    }

    /** A person publishes the (edited) notes: saved on the release, audited, and announced (customer-visible releases show in the portal feed). */
    async publish(ctx: OrgContext, id: string, dto: PublishReleaseNotesInput) {
        const release = await this.releases.get(ctx, id);
        const updated = await this.prisma.release.update({ where: { id }, data: { notes: dto.notes, notes_published_at: new Date(), notes_published_by_membership_id: ctx.membership_id } });
        await this.audit.record(ctx, 'release.notes_published', {
            resource_type: 'release', resource_id: id,
            metadata: { before: { length: release.notes?.length ?? 0 }, after: { length: dto.notes.length }, customer_visible: release.customer_visible },
        });
        this.events.publish(ctx, {
            event_key: 'tasks.release.notes_published', module: ModuleKey.TASKS, entity_kind: 'release', entity_id: id,
            payload: { name: release.name, version: release.version, project_id: release.project?.id ?? null, customer_visible: release.customer_visible, link: `/tasks/releases/${id}` },
            activity: { summary: `published release notes for ${release.name}${release.version ? ` ${release.version}` : ''}`, entity_label: release.name, project_id: release.project?.id ?? null, customer_visible: release.customer_visible },
        });
        return updated;
    }

    private fallback(name: string, version: string | null, items: { id: string; title: string; section: Section }[], customerFacing: boolean) {
        const order: Section[] = ['New', 'Improved', 'Fixed', 'Other'];
        const parts = [`${name}${version ? ` ${version}` : ''} includes ${items.length} change${items.length === 1 ? '' : 's'}.`];
        for (const s of order) {
            const rows = items.filter((i) => i.section === s);
            if (rows.length) parts.push(`## ${s}\n${rows.map((i) => `- ${i.title}${customerFacing ? '' : ` (${i.id})`}`).join('\n')}`);
        }
        return parts.join('\n\n');
    }
}
