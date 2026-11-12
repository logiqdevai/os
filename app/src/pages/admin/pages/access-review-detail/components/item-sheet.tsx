import { useEffect, useState } from "react";
import { Check, ShieldAlert } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { KeyValueList } from "@/components/ui/page";
import { useDecideAccessReviewItem, useReassignAccessReviewItem } from "@/features/admin/access-reviews/hooks/use-access-reviews";
import type { AccessReviewDecision, AccessReviewItem, RequestedChanges } from "@/features/admin/access-reviews/interfaces/access-reviews.interfaces";
import type { ModuleKey } from "@/config/apps/app.types";
import { ModuleKeyOptions } from "@/config/constants/dropdowns/admin/module-key.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatDateTime, formatRelative, personName } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { MemberPicker } from "../../../components/member-picker";
import { useScopeLabel } from "../../../components/use-scope-label";
import { AccessReviewDecisionBadge } from "../../access-reviews/components/review-badges";

type Choice = Exclude<AccessReviewDecision, "PENDING">;
const CHOICES: { id: Choice; label: string }[] = [
    { id: "CERTIFIED", label: "Certify" },
    { id: "REVOKED", label: "Revoke" },
    { id: "MODIFIED", label: "Modify" },
];
const emptyChanges = (): RequestedChanges => ({ remove_role_assignment_ids: [], revoke_grant_ids: [], disable_modules: [] });
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

interface ItemSheetProps {
    item: AccessReviewItem | null;
    onOpenChange: (open: boolean) => void;
    canManage: boolean;
    reviewOpen: boolean;
}

/** Access snapshot (frozen at start) + decision form for the assigned reviewer + reassign for managers. Mockup 01-admin `review`. */
export function ItemSheet({ item, onOpenChange, canManage, reviewOpen }: ItemSheetProps) {
    const decide = useDecideAccessReviewItem();
    const reassign = useReassignAccessReviewItem();
    const scopeLabel = useScopeLabel();
    const [choice, setChoice] = useState<Choice | null>(null);
    const [comment, setComment] = useState("");
    const [changes, setChanges] = useState<RequestedChanges>(emptyChanges());

    useEffect(() => {
        if (!item) return;
        setChoice(item.decision === "PENDING" ? null : item.decision);
        setComment(item.comment ?? "");
        setChanges(item.access_snapshot.requested_changes ?? emptyChanges());
    }, [item]);

    if (!item) return <Sheet open={false} onOpenChange={onOpenChange}><SheetContent /></Sheet>;
    const s = item.access_snapshot;
    const needsComment = choice === "REVOKED" || choice === "MODIFIED";
    const changeCount = changes.remove_role_assignment_ids.length + changes.revoke_grant_ids.length + changes.disable_modules.length;
    const valid = !!choice && (!needsComment || comment.trim().length > 0) && (choice !== "MODIFIED" || changeCount > 0);

    const save = () =>
        choice &&
        decide.mutate(
            { itemId: item.id, decision: choice, comment: comment.trim() || undefined, ...(choice === "MODIFIED" && { changes }) },
            { onSuccess: () => { toast({ title: "Decision saved" }); onOpenChange(false); }, onError: (e) => toast({ variant: "destructive", title: "Could not save the decision", description: getApiErrorMessage(e) }) }
        );

    return (
        <Sheet open={!!item} onOpenChange={onOpenChange}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-md">
                <SheetHeader>
                    <SheetTitle className="flex flex-wrap items-center gap-2">{personName(item.membership.user)} <AccessReviewDecisionBadge decision={item.decision} /></SheetTitle>
                    <SheetDescription>Access when the review started. Later changes are not shown here.</SheetDescription>
                </SheetHeader>
                <div className="space-y-5 px-4 pb-6">
                    <KeyValueList
                        columns={2}
                        items={[
                            { label: "Status", value: s.status },
                            { label: "Job title", value: s.job_title },
                            { label: "MFA", value: s.mfa_enabled ? "On" : <Badge variant="warning">Off</Badge> },
                            { label: "Last active", value: s.last_active_at ? formatRelative(s.last_active_at) : "Never" },
                            { label: "Branches", value: s.branches.map((b) => b.name + (b.is_primary ? " (primary)" : "")).join(", ") || null },
                            { label: "Teams", value: s.teams.map((t) => t.name).join(", ") || null },
                            { label: "Permissions", value: s.permission_count },
                            { label: "Modules", value: s.modules.length },
                        ]}
                    />
                    <div className="space-y-2">
                        <h3 className="text-[13px] font-medium text-foreground">Roles</h3>
                        {s.roles.length === 0 && <p className="text-xs text-muted-foreground">No roles.</p>}
                        {s.roles.map((r) => (
                            <label key={r.assignment_id} className={cn("flex items-center gap-2 rounded-md border border-border px-3 py-2 text-[13px]", choice === "MODIFIED" && "cursor-pointer")}>
                                {choice === "MODIFIED" && item.can_decide && (
                                    <Checkbox checked={changes.remove_role_assignment_ids.includes(r.assignment_id)} onCheckedChange={() => setChanges((c) => ({ ...c, remove_role_assignment_ids: toggle(c.remove_role_assignment_ids, r.assignment_id) }))} aria-label={`Remove ${r.role_name}`} />
                                )}
                                <span className="min-w-0 flex-1 truncate">{r.role_name}</span>
                                <span className="truncate text-xs text-muted-foreground">{scopeLabel(r.scope_type, r.scope_id)}{r.valid_until && ` · until ${formatDate(r.valid_until)}`}</span>
                            </label>
                        ))}
                    </div>
                    {s.grants.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-[13px] font-medium text-foreground">Direct grants</h3>
                            {s.grants.map((g) => (
                                <label key={g.grant_id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-[13px]">
                                    {choice === "MODIFIED" && item.can_decide && g.effect === "ALLOW" && (
                                        <Checkbox checked={changes.revoke_grant_ids.includes(g.grant_id)} onCheckedChange={() => setChanges((c) => ({ ...c, revoke_grant_ids: toggle(c.revoke_grant_ids, g.grant_id) }))} aria-label={`Revoke ${g.key}`} />
                                    )}
                                    <code className="min-w-0 flex-1 truncate font-mono text-xs">{g.key}</code>
                                    <Badge variant={g.effect === "DENY" ? "danger" : "success"}>{g.effect === "DENY" ? "Deny" : "Allow"}</Badge>
                                </label>
                            ))}
                        </div>
                    )}
                    <div className="space-y-2">
                        <h3 className="text-[13px] font-medium text-foreground">Modules with access</h3>
                        <div className="flex flex-wrap gap-1.5">
                            {s.modules.map((m) => {
                                const off = changes.disable_modules.includes(m);
                                const editable = choice === "MODIFIED" && item.can_decide && m !== "ADMINISTRATION";
                                return editable ? (
                                    <button key={m} type="button" onClick={() => setChanges((c) => ({ ...c, disable_modules: toggle(c.disable_modules, m as ModuleKey) }))} aria-pressed={off}>
                                        <Badge variant={off ? "danger" : "neutral"} className={cn(off && "line-through")}>{getDropdownOptionLabel(ModuleKeyOptions, m)}</Badge>
                                    </button>
                                ) : (
                                    <Badge key={m} variant={off ? "danger" : "neutral"} className={cn(off && "line-through")}>{getDropdownOptionLabel(ModuleKeyOptions, m)}</Badge>
                                );
                            })}
                            {s.modules.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
                        </div>
                        {choice === "MODIFIED" && item.can_decide && <p className="text-xs text-muted-foreground">Tick roles or grants to remove, tap modules to switch them off for this member.</p>}
                    </div>

                    <div className="space-y-3 border-t border-border-soft pt-4">
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span>Reviewer: {item.reviewer ? personName(item.reviewer.user) : "Unassigned"}</span>
                            {item.decided_at && <span title={formatDateTime(item.decided_at)}>decided {formatRelative(item.decided_at)}</span>}
                        </div>
                        {item.applied_at && <p className="flex items-center gap-1.5 text-xs text-success"><Check className="size-3.5" /> Applied {formatDateTime(item.applied_at)}</p>}
                        {item.can_decide && reviewOpen ? (
                            <>
                                <div className="grid grid-cols-3 gap-1 rounded-md border border-border p-1" role="radiogroup" aria-label="Decision">
                                    {CHOICES.map((c) => (
                                        <Button key={c.id} type="button" size="sm" variant={choice === c.id ? "default" : "ghost"} role="radio" aria-checked={choice === c.id} onClick={() => setChoice(c.id)}>{c.label}</Button>
                                    ))}
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="review-comment">Comment{needsComment ? "" : " (optional)"}</Label>
                                    <Textarea id="review-comment" rows={2} value={comment} maxLength={1000} onChange={(e) => setComment(e.target.value)} placeholder={choice === "REVOKED" ? "Left the team in October" : ""} />
                                </div>
                                {choice === "REVOKED" && <p className="flex items-start gap-1.5 text-xs text-warning"><ShieldAlert className="mt-0.5 size-3.5 flex-none" /> When applied, every role and allow grant of this member is removed.</p>}
                                <Button className="w-full" disabled={!valid} loading={decide.isPending} onClick={save}>Save decision</Button>
                            </>
                        ) : !item.can_decide && item.decision === "PENDING" && reviewOpen ? (
                            <p className="text-xs text-muted-foreground">Only the assigned reviewer can decide. A reviewer never reviews their own access.</p>
                        ) : null}
                        {canManage && reviewOpen && !item.applied_at && (
                            <div className="space-y-1.5 pt-2">
                                <Label>Give to another reviewer</Label>
                                <MemberPicker
                                    value={item.reviewer_membership_id ?? undefined}
                                    valueLabel={item.reviewer ? personName(item.reviewer.user) : undefined}
                                    exclude={[item.membership_id]}
                                    onChange={(id) => reassign.mutate({ itemId: item.id, reviewer_membership_id: id }, { onSuccess: () => toast({ title: "Reviewer changed" }), onError: (e) => toast({ variant: "destructive", title: "Could not change the reviewer", description: getApiErrorMessage(e) }) })}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
