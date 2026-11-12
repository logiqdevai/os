import { useEffect, useState } from "react";
import { FileText, ListPlus, Pencil, Send, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/page";
import { Markdown } from "@/components/ui/markdown";
import { EmptyState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { usePermission } from "@/hooks/use-permission";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "@/components/ui/save-status";
import { useDraftReleaseNotes, usePublishReleaseNotes, useUpdateRelease } from "@/features/tasks/hooks/use-tasks";
import type { Release } from "@/features/tasks/interfaces/tasks.interfaces";

/**
 * Release notes (06 §9, §14). "Draft with AI" writes notes from the release's tasks with the organization's own OpenAI
 * key; the draft is only put in the editor, never saved on its own. What a person types autosaves as an unpublished
 * draft (no Save button); "Publish" stays an explicit button (audited; customer-visible releases are announced to
 * customers). Without AI, a draft grouped from the task list is offered.
 * @perm VIEW tasks.tasks.read · edit / draft / publish tasks.releases.manage
 * @api POST /releases/:id/notes/draft · PATCH /releases/:id {notes} · POST /releases/:id/notes/publish
 */
export function ReleaseNotesEditor({ release }: { release: Release }) {
    const canManage = usePermission("tasks.releases.manage");
    const draft = useDraftReleaseNotes();
    const save = useUpdateRelease({ inline: true });
    const publish = usePublishReleaseNotes();
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(release.notes ?? "");
    /** Set by typing (or accepting the task-list draft); an untouched AI draft is not saved. */
    const [dirty, setDirty] = useState(false);
    const autosave = useAutosave({ value: text, enabled: editing && dirty && !!text.trim(), save: (notes) => save.mutateAsync({ id: release.id, notes }), delay: 1000 });
    const close = () => { if (dirty && text.trim()) autosave.flush(); setEditing(false); setDirty(false); setNotice(null); };
    const [notice, setNotice] = useState<{ tone: "ai" | "warn"; message: string; fallback?: string } | null>(null);
    useEffect(() => {
        if (!editing) setText(release.notes ?? "");
    }, [release.notes, editing]);

    const runDraft = () => draft.mutate(release.id, {
        onSuccess: (r) => {
            setEditing(true);
            if (r.available) {
                setText(r.notes);
                setNotice({ tone: "ai", message: `AI draft (${r.model}) from ${r.task_count} tasks. Review and edit before publishing.` });
            } else {
                setNotice({ tone: "warn", message: r.message, fallback: r.task_count ? r.fallback : undefined });
            }
        },
    });

    return (
        <Section
            title="Release notes"
            description={release.customer_visible ? "Customer-visible: published notes are announced to customers." : "Internal release."}
            actions={canManage && !editing && (
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" loading={draft.isPending} onClick={runDraft}><Sparkles /> Draft with AI</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(true); setNotice(null); }}><Pencil /> Edit</Button>
                </div>
            )}
        >
            {editing ? (
                <div className="space-y-3 rounded-lg border border-border bg-card p-3">
                    {notice && (
                        <div role="status" className={notice.tone === "ai" ? "flex items-start gap-2 rounded-md border border-violet/40 bg-violet-soft p-2.5 text-[13px] text-violet" : "flex flex-col gap-2 rounded-md border border-warning/40 bg-warning-soft p-2.5 text-[13px] text-warning"}>
                            <span className="flex items-start gap-2"><Sparkles className="mt-0.5 size-4 flex-none" />{notice.message}</span>
                            {notice.fallback && <Button size="sm" variant="outline" className="self-start" onClick={() => { setText(notice.fallback ?? ""); setDirty(true); setNotice(null); }}><ListPlus /> Use the task list</Button>}
                        </div>
                    )}
                    <Textarea aria-label="Release notes (Markdown)" rows={12} value={text} onChange={(e) => { setDirty(true); setText(e.target.value); }} onBlur={() => dirty && text.trim() && autosave.flush()} placeholder={"## New\n- …\n\n## Fixed\n- …"} className="font-mono text-[12.5px]" />
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <SaveStatus state={autosave} className="mr-auto" />
                        <Button size="sm" variant="ghost" onClick={close}>Done</Button>
                        <Button size="sm" variant="outline" loading={draft.isPending} onClick={runDraft}><Sparkles /> Redraft</Button>
                        <Button size="sm" disabled={!text.trim()} onClick={() => { publish.mutate({ id: release.id, notes: text }); setEditing(false); setDirty(false); setNotice(null); }}><Send /> Publish</Button>
                    </div>
                </div>
            ) : release.notes ? (
                <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                    {release.notes_published_at
                        ? <Badge variant="success">Published {new Date(release.notes_published_at).toLocaleDateString()}</Badge>
                        : <Badge variant="warning">Draft · not published</Badge>}
                    <Markdown source={release.notes} className="text-[13px]" />
                </div>
            ) : (
                <div className="rounded-lg border border-border bg-card"><EmptyState compact icon={FileText} title="No release notes yet" description={canManage ? "Draft them from the release's tasks." : undefined} /></div>
            )}
        </Section>
    );
}
