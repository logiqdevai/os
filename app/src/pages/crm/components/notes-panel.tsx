import { useState } from "react";
import { Lock, MoreHorizontal, NotebookPen, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { useCreateNote, useDeleteNote, useNotes, useUpdateNote } from "@/features/crm/notes/hooks/use-notes";
import type { CrmNote, NoteEntityType } from "@/features/crm/notes/interfaces/notes.interfaces";
import { MemberAvatar, memberLabel } from "./crm-ui";

const UPDATE_KEY: Record<NoteEntityType, string> = { CRM_COMPANY: "crm.companies.update", CRM_CONTACT: "crm.contacts.update", CRM_LEAD: "crm.leads.update", CRM_DEAL: "crm.deals.update" };

/**
 * Notes block (mockup "Notes block", 02 §16).
 * @perm read = the record's read key · write = the record's update key · private notes crm.notes.private.read (or author)
 * @api GET/POST /crm/notes?entity_type=&entity_id= · PATCH/DELETE /crm/notes/:id
 */
export function NotesPanel({ entityType, entityId }: { entityType: NoteEntityType; entityId: string }) {
    const notes = useNotes(entityType, entityId);
    const create = useCreateNote();
    const update = useUpdateNote();
    const del = useDeleteNote();
    const canWrite = usePermission(UPDATE_KEY[entityType]);
    const [body, setBody] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);
    const [editing, setEditing] = useState<CrmNote | null>(null);
    const [editBody, setEditBody] = useState("");
    const [deleting, setDeleting] = useState<CrmNote | null>(null);
    const onError = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });

    const add = () => {
        if (!body.trim()) return;
        create.mutate({ entity_type: entityType, entity_id: entityId, body: body.trim(), is_private: isPrivate }, {
            onSuccess: () => { setBody(""); setIsPrivate(false); toast({ title: "Note added" }); },
            onError: onError("Could not add note"),
        });
    };

    return (
        <div className="space-y-4">
            {canWrite && (
                <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                    <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a note… (Markdown supported)" aria-label="New note" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Switch id={`private-${entityId}`} checked={isPrivate} onCheckedChange={setIsPrivate} />
                            <Label htmlFor={`private-${entityId}`} className="text-[13px] text-muted-foreground">Private</Label>
                        </div>
                        <Button size="sm" onClick={add} loading={create.isPending} disabled={!body.trim()}>Add note</Button>
                    </div>
                </div>
            )}
            {notes.isPending ? <ListSkeleton rows={3} className="p-0" />
                : notes.error ? <ErrorState error={notes.error} onRetry={() => notes.refetch()} />
                    : !notes.data.length ? <EmptyState compact icon={NotebookPen} title="No notes yet" description="Notes keep context for everyone working on this record." />
                        : (
                            <ul className="space-y-3">
                                {notes.data.map((n) => (
                                    <li key={n.id} className="rounded-lg border border-border bg-card p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <MemberAvatar member={n.author} />
                                                <div className="min-w-0">
                                                    <div className="truncate text-[13px] font-medium text-foreground">{memberLabel(n.author)}</div>
                                                    <div className="text-xs text-muted-foreground">{formatDateTime(n.created_at)}{n.edited_at && ` · edited${n.edit_count > 1 ? ` ${n.edit_count}×` : ""}`}</div>
                                                </div>
                                                {n.pinned && <Badge variant="info"><Pin className="size-3" /> Pinned</Badge>}
                                                {n.is_private && <Badge variant="violet"><Lock className="size-3" /> Private</Badge>}
                                            </div>
                                            {canWrite && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Note actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {n.can_edit && <DropdownMenuItem onSelect={() => { setEditing(n); setEditBody(n.body); }}><Pencil /> Edit</DropdownMenuItem>}
                                                        {n.can_edit && (
                                                            <DropdownMenuItem onSelect={() => update.mutate({ id: n.id, pinned: !n.pinned }, { onError: onError("Could not update note") })}>
                                                                {n.pinned ? <><PinOff /> Unpin</> : <><Pin /> Pin</>}
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(n)}><Trash2 /> Delete</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </div>
                                        {editing?.id === n.id ? (
                                            <div className="mt-2 space-y-2">
                                                <Textarea rows={3} value={editBody} onChange={(e) => setEditBody(e.target.value)} aria-label="Edit note" />
                                                <div className="flex justify-end gap-2">
                                                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                                                    <Button size="sm" loading={update.isPending} disabled={!editBody.trim()} onClick={() => update.mutate({ id: n.id, body: editBody.trim() }, { onSuccess: () => { setEditing(null); toast({ title: "Note updated" }); }, onError: onError("Could not update note") })}>Save</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="mt-2 whitespace-pre-wrap break-words text-[13px] text-body">{n.body}</p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title="Delete this note?"
                description="This cannot be undone."
                confirmText="Delete"
                variant="destructive"
                isLoading={del.isPending}
                onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => { setDeleting(null); toast({ title: "Note deleted" }); }, onError: onError("Could not delete note") })}
            />
        </div>
    );
}
