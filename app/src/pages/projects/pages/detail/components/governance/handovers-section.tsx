import { useEffect, useState } from "react";
import { ArrowRightLeft, CheckCircle2, MoreHorizontal, Play, Plus, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Section } from "@/components/ui/page";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermissions } from "@/hooks/use-permission";
import { useGovernance, useGovernanceDelete, useGovernancePatch, useGovernancePost } from "@/features/projects/hooks/use-projects";
import { useWorkflows } from "@/features/tasks/hooks/use-tasks";
import type { HandoverType, ProjectHandover } from "@/features/projects/interfaces/projects.interfaces";
import { HandoverStatusFormOptions, HandoverTypeFormOptions } from "@/config/constants/dropdowns/projects/project-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate } from "@/lib/format";
import { PersonPicker } from "../../../../components/project-pickers";

const statusVariant: Record<ProjectHandover["status"], BadgeVariant> = { PLANNED: "neutral", IN_PROGRESS: "info", COMPLETED: "success", CANCELLED: "neutral" };

/**
 * Handovers (05 §72, §102): sales → delivery, delivery → support, project → maintenance … The receiving owner (or a member
 * of the receiving team) accepts; accepting can also transfer project ownership.
 * @perm VIEW projects.projects.read · plan / edit projects.projects.update · accept: receiving owner/team or projects.projects.update
 * @api /projects/:id/handovers · POST /handovers/:hid/accept
 */
export function HandoversSection({ projectId, readOnly }: { projectId: string; readOnly: boolean }) {
    const p = usePermissions();
    const handovers = useGovernance<ProjectHandover[]>(projectId, "handovers");
    const patch = useGovernancePatch("Could not update the handover");
    const remove = useGovernanceDelete("Could not delete the handover");
    const canEdit = p.can("projects.projects.update") && !readOnly;
    const [planning, setPlanning] = useState(false);
    const [accepting, setAccepting] = useState<ProjectHandover | null>(null);
    const [deleting, setDeleting] = useState<ProjectHandover | null>(null);

    return (
        <Section
            title="Handovers"
            description="Hand the project to support, maintenance or the customer with a checklist and notes."
            actions={canEdit && <Button size="sm" variant="outline" onClick={() => setPlanning(true)}><Plus /> Plan handover</Button>}
        >
            {handovers.isPending ? <ListSkeleton rows={2} /> : handovers.error ? <ErrorState error={handovers.error} onRetry={() => handovers.refetch()} /> : !handovers.data.length ? (
                <div className="rounded-lg border border-border bg-card"><EmptyState compact icon={ArrowRightLeft} title="No handover planned" description="Hand over to maintenance, support or customer success when delivery ends." /></div>
            ) : (
                <ul className="space-y-3">
                    {handovers.data.map((h) => {
                        const open = h.status === "PLANNED" || h.status === "IN_PROGRESS";
                        const list = h.details?.checklist ?? [];
                        return (
                            <li key={h.id} className="rounded-lg border border-border bg-card p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-foreground">{getDropdownOptionLabel(HandoverTypeFormOptions, h.type)}</span>
                                    <Badge variant={statusVariant[h.status]} dot>{getDropdownOptionLabel(HandoverStatusFormOptions, h.status)}</Badge>
                                    <span className="text-xs text-muted-foreground">
                                        {[h.from_team?.name, h.to_team?.name].filter(Boolean).join(" → ") || "No teams"}{h.scheduled_at ? ` · ${formatDate(h.scheduled_at)}` : ""}
                                    </span>
                                    <div className="ml-auto flex items-center gap-1">
                                        {h.new_owner && <MemberAvatar person={h.new_owner.user} size="xs" showName />}
                                        {open && h.can_accept && !readOnly && <Button size="sm" onClick={() => setAccepting(h)}><CheckCircle2 /> Accept</Button>}
                                        {canEdit && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Handover actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    {h.status === "PLANNED" && <DropdownMenuItem onSelect={() => patch.mutate({ id: projectId, path: `handovers/${h.id}`, dto: { status: "IN_PROGRESS" }, patch: { id: h.id, value: { status: "IN_PROGRESS" } } })}><Play /> Start</DropdownMenuItem>}
                                                    {open && <DropdownMenuItem onSelect={() => patch.mutate({ id: projectId, path: `handovers/${h.id}`, dto: { status: "CANCELLED" }, patch: { id: h.id, value: { status: "CANCELLED" } } })}><XCircle /> Cancel handover</DropdownMenuItem>}
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(h)}><Trash2 /> Delete</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </div>
                                </div>
                                {list.length > 0 && (
                                    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                                        {list.map((c, i) => <li key={i} className="text-[13px] text-body">{c.done ? "✓" : "○"} {c.title}</li>)}
                                    </ul>
                                )}
                                {(h.details?.notes || h.details?.open_items) && (
                                    <dl className="mt-2 grid gap-2 text-[13px] sm:grid-cols-2">
                                        {h.details?.open_items && <div><dt className="text-xs text-muted-foreground">Open items</dt><dd className="whitespace-pre-line text-body">{h.details.open_items}</dd></div>}
                                        {h.details?.notes && <div><dt className="text-xs text-muted-foreground">Notes</dt><dd className="whitespace-pre-line text-body">{h.details.notes}</dd></div>}
                                    </dl>
                                )}
                                {h.accepted_at && <p className="mt-2 text-xs text-muted-foreground">Accepted {formatDate(h.accepted_at)}{h.accepted_by ? ` by ${h.accepted_by.user.display_name ?? h.accepted_by.user.email}` : ""}{h.details?.acceptance_comment ? ` — “${h.details.acceptance_comment}”` : ""}</p>}
                            </li>
                        );
                    })}
                </ul>
            )}
            <PlanHandoverDialog projectId={projectId} open={planning} onOpenChange={setPlanning} />
            <AcceptDialog projectId={projectId} handover={accepting} onClose={() => setAccepting(null)} canTransfer={p.can("projects.projects.update")} />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title="Delete this handover?"
                description="The handover and its checklist are removed. The deletion is audited."
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => { if (deleting) remove.mutate({ id: projectId, path: `handovers/${deleting.id}`, removeId: deleting.id }); setDeleting(null); }}
            />
        </Section>
    );
}

function PlanHandoverDialog({ projectId, open, onOpenChange }: { projectId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
    const create = useGovernancePost("Could not plan the handover");
    const workflows = useWorkflows(open);
    const teams = (workflows.data ?? []).map((w) => w.team).filter((t): t is NonNullable<typeof t> => !!t);
    const [type, setType] = useState<HandoverType>("delivery_to_support");
    const [fromTeam, setFromTeam] = useState("none");
    const [toTeam, setToTeam] = useState("none");
    const [owner, setOwner] = useState<string | null>(null);
    const [date, setDate] = useState("");
    const [checklist, setChecklist] = useState("");
    const [openItems, setOpenItems] = useState("");
    const [notes, setNotes] = useState("");
    useEffect(() => {
        if (open) {
            setType("delivery_to_support"); setFromTeam("none"); setToTeam("none"); setOwner(null); setDate(""); setChecklist("Documentation shared\nAccess and credentials transferred\nOpen bugs reviewed\nSupport contacts confirmed"); setOpenItems(""); setNotes("");
        }
    }, [open]);
    const submit = () => create.mutate({
        id: projectId, path: "handovers",
        dto: {
            type, from_team_id: fromTeam === "none" ? null : fromTeam, to_team_id: toTeam === "none" ? null : toTeam, new_owner_membership_id: owner, scheduled_at: date || null,
            details: { checklist: checklist.split("\n").map((t) => t.trim()).filter(Boolean).map((title) => ({ title, done: false })), open_items: openItems.trim() || undefined, notes: notes.trim() || undefined },
        },
    }, { onSuccess: () => onOpenChange(false) });
    const teamSelect = (value: string, set: (v: string) => void, label: string) => (
        <div className="space-y-1.5">
            <Label>{label}</Label>
            <Select value={value} onValueChange={set}>
                <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="none">No team</SelectItem>
                    {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
    );
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
                    <DialogHeader>
                        <DialogTitle>Plan handover</DialogTitle>
                        <DialogDescription>The new owner is asked to accept it.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Type</Label>
                            <Select value={type} onValueChange={(v) => setType(v as HandoverType)}>
                                <SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger>
                                <SelectContent>{HandoverTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="ho-date">Scheduled for</Label>
                            <Input id="ho-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                        </div>
                        {teamSelect(fromTeam, setFromTeam, "From team")}
                        {teamSelect(toTeam, setToTeam, "To team")}
                    </div>
                    <div className="space-y-1.5">
                        <Label>New owner</Label>
                        <PersonPicker value={owner} onChange={setOwner} placeholder="Who receives it" noneLabel="Nobody in particular" />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="ho-list">Checklist (one per line)</Label>
                        <Textarea id="ho-list" rows={4} value={checklist} onChange={(e) => setChecklist(e.target.value)} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="ho-open">Open items</Label>
                            <Textarea id="ho-open" rows={3} value={openItems} onChange={(e) => setOpenItems(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="ho-notes">Notes</Label>
                            <Textarea id="ho-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                        <Button type="submit" loading={create.isPending}>Plan handover</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function AcceptDialog({ projectId, handover, onClose, canTransfer }: { projectId: string; handover: ProjectHandover | null; onClose: () => void; canTransfer: boolean }) {
    // Accepting is an explicit, audited action; the handover shows as completed at once and the dialog closes.
    const accept = useGovernancePost("Could not accept the handover");
    const [comment, setComment] = useState("");
    const [transfer, setTransfer] = useState(false);
    useEffect(() => {
        if (handover) {
            setComment("");
            setTransfer(false);
        }
    }, [handover]);
    return (
        <Dialog open={!!handover} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-md">
                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (handover) { accept.mutate({ id: projectId, path: `handovers/${handover.id}/accept`, dto: { comment: comment.trim() || undefined, transfer_ownership: transfer || undefined }, patch: { id: handover.id, value: { status: "COMPLETED", accepted_at: new Date().toISOString() } } }); onClose(); } }}>
                    <DialogHeader>
                        <DialogTitle>Accept handover</DialogTitle>
                        <DialogDescription>Confirm that you received everything you need. This is recorded in the audit log.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5">
                        <Label htmlFor="acc-comment">Comment</Label>
                        <Textarea id="acc-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional" />
                    </div>
                    {canTransfer && handover?.new_owner && (
                        <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                            <Label htmlFor="acc-transfer" className="font-normal">Make {handover.new_owner.user.display_name ?? handover.new_owner.user.email} the project owner</Label>
                            <Switch id="acc-transfer" checked={transfer} onCheckedChange={setTransfer} />
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button type="submit">Accept handover</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
