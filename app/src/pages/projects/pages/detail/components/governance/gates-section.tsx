import { useEffect, useState } from "react";
import { CheckCircle2, MoreHorizontal, Pencil, Plus, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermissions } from "@/hooks/use-permission";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "@/components/ui/save-status";
import { useGovernance, useGovernanceDelete, useGovernancePatch, useGovernancePost, useProjectChildren } from "@/features/projects/hooks/use-projects";
import type { Milestone, ProjectGate, ProjectGateKind } from "@/features/projects/interfaces/projects.interfaces";
import { GateDecisionOptions, GateKindFormOptions, GateStatusFormOptions } from "@/config/constants/dropdowns/projects/project-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate } from "@/lib/format";
import { PersonPicker } from "../../../../components/project-pickers";

const statusVariant: Record<ProjectGate["status"], BadgeVariant> = { PENDING: "warning", PASSED: "success", FAILED: "danger", WAIVED: "neutral" };

/**
 * Approval and quality gates (05 §46, §93). Gates with "blocks completion" must be passed or waived before the project completes.
 * @perm VIEW projects.projects.read · add / edit / delete projects.projects.update · decide / reopen projects.gates.decide*
 * @api GET/POST /projects/:id/gates · PATCH/DELETE /projects/:id/gates/:gid · POST …/decide · POST …/reopen
 */
export function GatesSection({ projectId, readOnly }: { projectId: string; readOnly: boolean }) {
    const p = usePermissions();
    const gates = useGovernance<ProjectGate[]>(projectId, "gates");
    const remove = useGovernanceDelete("Could not delete the gate");
    const reopen = useGovernancePost("Could not reopen the gate");
    const canEdit = p.can("projects.projects.update") && !readOnly;
    const canDecide = p.can("projects.gates.decide") && !readOnly;
    const [editing, setEditing] = useState<ProjectGate | "new" | null>(null);
    const [deciding, setDeciding] = useState<ProjectGate | null>(null);
    const [deleting, setDeleting] = useState<ProjectGate | null>(null);

    return (
        <Section
            title="Gates"
            description="Approval and quality checkpoints. Blocking gates must be passed or waived before completion."
            actions={canEdit && <Button size="sm" variant="outline" onClick={() => setEditing("new")}><Plus /> Add gate</Button>}
        >
            {gates.isPending ? <ListSkeleton rows={3} /> : gates.error ? <ErrorState error={gates.error} onRetry={() => gates.refetch()} /> : !gates.data.length ? (
                <div className="rounded-lg border border-border bg-card"><EmptyState compact icon={ShieldCheck} title="No gates" description="Add gates such as design approval, QA sign-off or customer acceptance." /></div>
            ) : (
                <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                    {gates.data.map((g) => (
                        <li key={g.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-foreground">{g.name}</span>
                                    <Badge variant={statusVariant[g.status]} dot>{getDropdownOptionLabel(GateStatusFormOptions, g.status)}</Badge>
                                    <Badge variant={g.kind === "QUALITY" ? "violet" : "info"}>{getDropdownOptionLabel(GateKindFormOptions, g.kind)}</Badge>
                                    {g.blocks_completion && <Badge variant="neutral">Blocks completion</Badge>}
                                </div>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {[g.milestone ? `Milestone: ${g.milestone.name}` : null, g.decided_at ? `Decided ${formatDate(g.decided_at)}` : null].filter(Boolean).join(" · ") || g.description || "No milestone"}
                                </p>
                                {g.decision_comment && <p className="mt-1 whitespace-pre-line text-[13px] text-body">“{g.decision_comment}”</p>}
                            </div>
                            <div className="flex items-center gap-2">
                                <MemberAvatar person={g.approver?.user} size="xs" showName emptyLabel="No approver" />
                                {canDecide && g.status === "PENDING" && <Button size="sm" onClick={() => setDeciding(g)}><CheckCircle2 /> Decide</Button>}
                                {(canEdit || (canDecide && g.status !== "PENDING")) && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${g.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {canDecide && g.status !== "PENDING" && <DropdownMenuItem onSelect={() => reopen.mutate({ id: projectId, path: `gates/${g.id}/reopen`, patch: { id: g.id, value: { status: "PENDING", decided_at: null, decision_comment: null } } })}><RotateCcw /> Reopen</DropdownMenuItem>}
                                            {canEdit && <DropdownMenuItem onSelect={() => setEditing(g)}><Pencil /> Edit</DropdownMenuItem>}
                                            {canEdit && (
                                                <>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(g)}><Trash2 /> Delete</DropdownMenuItem>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            <GateDialog projectId={projectId} gate={editing} onClose={() => setEditing(null)} />
            <DecideDialog projectId={projectId} gate={deciding} onClose={() => setDeciding(null)} />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete gate “${deleting?.name}”?`}
                description="The gate and its decision are removed. The deletion is recorded in the audit log."
                confirmText="Delete gate"
                variant="destructive"
                onConfirm={() => { if (deleting) remove.mutate({ id: projectId, path: `gates/${deleting.id}`, removeId: deleting.id }); setDeleting(null); }}
            />
        </Section>
    );
}

/** Add a gate (explicit "Add gate") or edit one (autosaves; "Done" closes). */
function GateDialog({ projectId, gate, onClose }: { projectId: string; gate: ProjectGate | "new" | null; onClose: () => void }) {
    const create = useGovernancePost("Could not add the gate");
    const update = useGovernancePatch("Could not update the gate", false);
    const [dirty, setDirty] = useState(false);
    const touch = <T,>(set: (v: T) => void) => (v: T) => { setDirty(true); set(v); };
    const milestones = useProjectChildren<Milestone>(gate ? projectId : undefined, "milestones");
    const [name, setName] = useState("");
    const [kind, setKind] = useState<ProjectGateKind>("APPROVAL");
    const [description, setDescription] = useState("");
    const [milestoneId, setMilestoneId] = useState<string>("none");
    const [approver, setApprover] = useState<string | null>(null);
    const [blocks, setBlocks] = useState(true);
    const existing = gate && gate !== "new" ? gate : null;
    useEffect(() => {
        if (!gate) return;
        setName(existing?.name ?? "");
        setKind(existing?.kind ?? "APPROVAL");
        setDescription(existing?.description ?? "");
        setMilestoneId(existing?.milestone_id ?? "none");
        setApprover(existing?.approver_membership_id ?? null);
        setBlocks(existing?.blocks_completion ?? true);
        setDirty(false);
    }, [gate, existing]);
    const pending = create.isPending;
    const dto = { name: name.trim(), kind, description: description.trim() || undefined, milestone_id: milestoneId === "none" ? null : milestoneId, approver_membership_id: approver, blocks_completion: blocks };
    const autosave = useAutosave({
        value: dto,
        enabled: !!existing && dirty && !!dto.name,
        save: (v) => update.mutateAsync({ id: projectId, path: `gates/${existing!.id}`, dto: v, patch: { id: existing!.id, value: { ...v, description: v.description ?? null } } }),
    });
    const close = () => { if (existing && dto.name) autosave.flush(); onClose(); };
    const submit = () => {
        if (existing) return close();
        create.mutate({ id: projectId, path: "gates", dto }, { onSuccess: onClose });
    };
    return (
        <Dialog open={!!gate} onOpenChange={(o) => !o && !pending && close()}>
            <DialogContent className="sm:max-w-lg">
                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (name.trim()) submit(); }}>
                    <DialogHeader>
                        <DialogTitle>{existing ? "Edit gate" : "Add gate"}</DialogTitle>
                        <DialogDescription>The approver is notified and decides in this tab.</DialogDescription>
                        {existing && <SaveStatus state={autosave} />}
                    </DialogHeader>
                    <div className="space-y-1.5">
                        <Label htmlFor="gate-name">Name</Label>
                        <Input id="gate-name" autoFocus value={name} onChange={(e) => touch(setName)(e.target.value)} placeholder="QA sign-off" maxLength={200} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Kind</Label>
                            <Select value={kind} onValueChange={(v) => touch(setKind)(v as ProjectGateKind)}>
                                <SelectTrigger aria-label="Kind"><SelectValue /></SelectTrigger>
                                <SelectContent>{GateKindFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Milestone</Label>
                            <Select value={milestoneId} onValueChange={touch(setMilestoneId)}>
                                <SelectTrigger aria-label="Milestone"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No milestone</SelectItem>
                                    {(milestones.data ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Approver</Label>
                        <PersonPicker value={approver} onChange={touch(setApprover)} placeholder="Choose an approver" noneLabel="No approver" selected={existing?.approver} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="gate-desc">What must be true</Label>
                        <Textarea id="gate-desc" rows={2} value={description} onChange={(e) => touch(setDescription)(e.target.value)} placeholder="All P1 bugs closed, regression suite green." />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                        <Label htmlFor="gate-blocks" className="font-normal">Blocks project completion</Label>
                        <Switch id="gate-blocks" checked={blocks} onCheckedChange={touch(setBlocks)} />
                    </div>
                    <DialogFooter>
                        {existing ? (
                            <Button type="button" onClick={close}>Done</Button>
                        ) : (
                            <>
                                <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
                                <Button type="submit" loading={pending} disabled={!name.trim()}>Add gate</Button>
                            </>
                        )}
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function DecideDialog({ projectId, gate, onClose }: { projectId: string; gate: ProjectGate | null; onClose: () => void }) {
    // Approval decision: an explicit, recorded action. The gate shows the decision at once and the dialog closes.
    const decide = useGovernancePost("Could not record the decision");
    const [decision, setDecision] = useState<"PASSED" | "FAILED" | "WAIVED">("PASSED");
    const [comment, setComment] = useState("");
    useEffect(() => {
        if (gate) {
            setDecision("PASSED");
            setComment("");
        }
    }, [gate]);
    const needsComment = decision !== "PASSED";
    return (
        <Dialog open={!!gate} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-md">
                <form className="space-y-4" onSubmit={(e) => {
                    e.preventDefault();
                    if (gate && (!needsComment || comment.trim())) {
                        decide.mutate({ id: projectId, path: `gates/${gate.id}/decide`, dto: { decision, comment: comment.trim() || undefined }, patch: { id: gate.id, value: { status: decision, decided_at: new Date().toISOString(), decision_comment: comment.trim() || null } } });
                        onClose();
                    }
                }}>
                    <DialogHeader>
                        <DialogTitle>Decide “{gate?.name}”</DialogTitle>
                        <DialogDescription>Your decision is recorded in the audit log with your comment.</DialogDescription>
                    </DialogHeader>
                    <RadioGroup value={decision} onValueChange={(v) => setDecision(v as typeof decision)} className="flex flex-wrap gap-4">
                        {GateDecisionOptions.map((o) => (
                            <div key={o.id} className="flex items-center gap-2">
                                <RadioGroupItem id={`decide-${o.id}`} value={o.id} />
                                <Label htmlFor={`decide-${o.id}`} className="font-normal">{o.label}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                    <div className="space-y-1.5">
                        <Label htmlFor="decide-comment">Comment{needsComment ? " (required)" : ""}</Label>
                        <Textarea id="decide-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={needsComment ? "Why does it fail / why is it waived?" : "Optional"} />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button type="submit" variant={decision === "FAILED" ? "destructive" : "default"} disabled={needsComment && !comment.trim()}>
                            {getDropdownOptionLabel(GateDecisionOptions, decision)} gate
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
