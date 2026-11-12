import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Calculator, MoreHorizontal, Pencil, Plus, Shuffle, Sparkles, Trash2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { EmptyState, ErrorState, ListSkeleton, NoAccessState } from "@/components/ui/states";
import { usePermission } from "@/hooks/use-permission";
import { getApiErrorMessage } from "@/lib/api-error";
import { AssignModeOptions, AssignStrategyOptions } from "@/config/constants/dropdowns/crm/crm-rules.options";
import {
    useAssignmentRules, useCreateAssignmentRule, useCreateScoringRule, useDeleteAssignmentRule, useDeleteScoringRule, useRecalculateScores,
    useScoringRules, useUpdateAssignmentRule, useUpdateScoringRule,
} from "@/features/crm/rules/hooks/use-rules";
import { useTeamOptions } from "@/features/crm/saved-views/hooks/use-saved-views";
import { useCrmMembers } from "@/features/crm/settings/hooks/use-crm-settings";
import type { AssignmentRule, AssignStrategy, AssignTo, RuleCondition, ScoringRule } from "@/features/crm/rules/interfaces/rules.interfaces";
import { memberLabel } from "../../components/crm-ui";
import { RuleConditionsEditor, useConditionSummary } from "../../components/rule-conditions";

/**
 * Lead rules: assignment (who gets a new lead) and scoring (02 §5–6, §31).
 * @route /crm/lead-rules?tab=assignment|scoring
 * @perm assignment crm.settings.manage · scoring crm.scoring_rules.manage
 * @api GET/POST/PATCH/DELETE /crm/assignment-rules · /crm/scoring-rules · POST /crm/scoring-rules/recalculate · GET /crm/rules/fields
 * @mcp crm_assignment_rules_list|create · crm_scoring_rules_list|create|recalculate
 */
export default function LeadRulesPage() {
    const canAssign = usePermission("crm.settings.manage");
    const canScore = usePermission("crm.scoring_rules.manage");
    const [sp, setSp] = useSearchParams();
    const tab = sp.get("tab") ?? (canAssign ? "assignment" : "scoring");
    if (!canAssign && !canScore) return <Page><NoAccessState /></Page>;
    return (
        <Page width="wide">
            <PageHeader title="Lead rules" description="Route new leads to the right person and score them automatically. Rules apply to leads from forms, imports, the API and the app." />
            <Tabs value={tab} onValueChange={(t) => setSp({ tab: t }, { replace: true })}>
                <TabsList>
                    {canAssign && <TabsTrigger value="assignment">Assignment</TabsTrigger>}
                    {canScore && <TabsTrigger value="scoring">Scoring</TabsTrigger>}
                </TabsList>
                {canAssign && <TabsContent value="assignment" className="mt-4"><AssignmentRules /></TabsContent>}
                {canScore && <TabsContent value="scoring" className="mt-4"><ScoringRules /></TabsContent>}
            </Tabs>
        </Page>
    );
}

function useAssignSummary() {
    const members = useCrmMembers();
    const teams = useTeamOptions(usePermission("organizations.teams.read"));
    const name = (id: string) => { const m = members.data?.find((x) => x.id === id); return m ? memberLabel(m) : "a member"; };
    return (to: AssignTo) => {
        if ("membership_id" in to) return name(to.membership_id);
        const how = to.strategy === "least_loaded" ? "least loaded" : "round robin";
        if ("team_id" in to) return `${teams.data?.find((t) => t.id === to.team_id)?.name ?? "a team"} (${how})`;
        return `${to.membership_ids.map(name).join(", ")} (${how})`;
    };
}

function AssignmentRules() {
    const rules = useAssignmentRules();
    const update = useUpdateAssignmentRule();
    const del = useDeleteAssignmentRule();
    const summary = useConditionSummary();
    const assignSummary = useAssignSummary();
    const [editing, setEditing] = useState<AssignmentRule | null>(null);
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState<AssignmentRule | null>(null);

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13px] text-muted-foreground">When a lead is created without an owner, the first enabled rule that matches decides the owner. Otherwise the creator owns it.</p>
                <Button size="sm" onClick={() => setCreating(true)}><Plus /> New rule</Button>
            </div>
            <div className="rounded-lg border border-border bg-card">
                {rules.isPending ? <ListSkeleton /> : rules.error ? <ErrorState error={rules.error} onRetry={() => rules.refetch()} /> : !rules.data.length ? (
                    <EmptyState compact icon={Shuffle} title="No assignment rules" description="Example: leads from the website go round robin to the Sales team." action={<Button size="sm" onClick={() => setCreating(true)}><Plus /> New rule</Button>} />
                ) : (
                    <ol className="divide-y divide-border-soft">
                        {rules.data.map((r, i) => (
                            <li key={r.id} className="flex items-start gap-3 px-3 py-2.5">
                                <span className="mt-0.5 w-5 shrink-0 text-xs text-muted-foreground tabular">{i + 1}.</span>
                                <div className="min-w-0 flex-1 text-[13px]">
                                    <div className="flex flex-wrap items-center gap-1.5"><span className="font-medium text-foreground">{r.name}</span>{!r.enabled && <Badge>Off</Badge>}</div>
                                    <div className="mt-0.5 text-xs text-muted-foreground">If {summary(r.conditions).toLowerCase()} → {assignSummary(r.assign_to)}</div>
                                </div>
                                <Switch checked={r.enabled} aria-label={`Enable ${r.name}`} onCheckedChange={(c) => update.mutate({ id: r.id, enabled: c })} />
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onSelect={() => setEditing(r)}><Pencil /> Edit</DropdownMenuItem>
                                        {i > 0 && <DropdownMenuItem onSelect={() => update.mutate({ id: r.id, priority: rules.data[i - 1].priority - 1 })}>Move up</DropdownMenuItem>}
                                        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(r)}><Trash2 /> Delete</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </li>
                        ))}
                    </ol>
                )}
            </div>
            <AssignmentRuleDialog open={creating || !!editing} rule={editing} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }} />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete rule “${deleting?.name}”?`}
                description="Existing leads keep their owners."
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => { if (deleting) del.mutate(deleting.id); setDeleting(null); }}
            />
        </div>
    );
}

function AssignmentRuleDialog({ open, rule, onOpenChange }: { open: boolean; rule: AssignmentRule | null; onOpenChange: (o: boolean) => void }) {
    // Complex multi-field edit: stays a dialog with Save; API errors show inline, no toasts.
    const create = useCreateAssignmentRule();
    const update = useUpdateAssignmentRule({ errorToast: false });
    const members = useCrmMembers(open);
    const canTeams = usePermission("organizations.teams.read");
    const teams = useTeamOptions(open && canTeams);
    const [name, setName] = useState("");
    const [conditions, setConditions] = useState<RuleCondition[]>([]);
    const [mode, setMode] = useState<"member" | "team" | "members">("member");
    const [memberId, setMemberId] = useState("");
    const [teamId, setTeamId] = useState("");
    const [memberIds, setMemberIds] = useState<string[]>([]);
    const [strategy, setStrategy] = useState<AssignStrategy>("round_robin");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        const to = rule?.assign_to;
        setName(rule?.name ?? "");
        setConditions(rule?.conditions ?? []);
        setMode(!to || "membership_id" in to ? "member" : "team_id" in to ? "team" : "members");
        setMemberId(to && "membership_id" in to ? to.membership_id : "");
        setTeamId(to && "team_id" in to ? to.team_id : "");
        setMemberIds(to && "membership_ids" in to ? to.membership_ids : []);
        setStrategy(to && "strategy" in to ? to.strategy : "round_robin");
        setError(null);
    }, [open, rule]);

    const pending = create.isPending || update.isPending;
    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return setError("Enter a name");
        if (conditions.some((c) => !["is_empty", "is_not_empty"].includes(c.operator) && (c.value === null || c.value === undefined || c.value === ""))) return setError("Every condition needs a value");
        let assign_to: AssignTo;
        if (mode === "member") { if (!memberId) return setError("Choose a member"); assign_to = { membership_id: memberId }; }
        else if (mode === "team") { if (!teamId) return setError("Choose a team"); assign_to = { team_id: teamId, strategy }; }
        else { if (!memberIds.length) return setError("Choose at least one member"); assign_to = { membership_ids: memberIds, strategy }; }
        const opts = { onSuccess: () => onOpenChange(false), onError: (err: unknown) => setError(getApiErrorMessage(err)) };
        if (rule) update.mutate({ id: rule.id, name: name.trim(), conditions, assign_to }, opts);
        else create.mutate({ name: name.trim(), conditions, assign_to, enabled: true }, opts);
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>{rule ? "Edit assignment rule" : "New assignment rule"}</DialogTitle>
                        <DialogDescription>Applies when a lead is created without an owner.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5"><Label htmlFor="rule-name">Name</Label><Input id="rule-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Website leads to Sales" /></div>
                    <div className="space-y-1.5"><Label>When the lead matches</Label><RuleConditionsEditor value={conditions} onChange={setConditions} allowEmpty /></div>
                    <div className="space-y-2">
                        <Label>Assign to</Label>
                        <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                            <SelectTrigger aria-label="Assign to"><SelectValue /></SelectTrigger>
                            <SelectContent>{AssignModeOptions.filter((o) => o.id !== "team" || canTeams).map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                        {mode === "member" && (
                            <Select value={memberId} onValueChange={setMemberId}>
                                <SelectTrigger aria-label="Member"><SelectValue placeholder="Choose a member" /></SelectTrigger>
                                <SelectContent>{members.data?.map((m) => <SelectItem key={m.id} value={m.id}>{memberLabel(m)}</SelectItem>)}</SelectContent>
                            </Select>
                        )}
                        {mode === "team" && (
                            <Select value={teamId} onValueChange={setTeamId}>
                                <SelectTrigger aria-label="Team"><SelectValue placeholder="Choose a team" /></SelectTrigger>
                                <SelectContent>{teams.data?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                            </Select>
                        )}
                        {mode === "members" && (
                            <div className="grid max-h-48 gap-1.5 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
                                {members.data?.map((m) => (
                                    <label key={m.id} className="flex items-center gap-2 text-[13px]">
                                        <Checkbox checked={memberIds.includes(m.id)} onCheckedChange={(c) => setMemberIds(c ? [...memberIds, m.id] : memberIds.filter((x) => x !== m.id))} />
                                        <span className="truncate">{memberLabel(m)}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                        {mode !== "member" && (
                            <Select value={strategy} onValueChange={(v) => setStrategy(v as AssignStrategy)}>
                                <SelectTrigger aria-label="Strategy"><SelectValue /></SelectTrigger>
                                <SelectContent>{AssignStrategyOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        )}
                    </div>
                    {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                        <Button type="submit" loading={pending}>Save rule</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ScoringRules() {
    const rules = useScoringRules();
    const update = useUpdateScoringRule();
    const del = useDeleteScoringRule();
    const recalc = useRecalculateScores();
    const summary = useConditionSummary();
    const [editing, setEditing] = useState<ScoringRule | null>(null);
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState<ScoringRule | null>(null);
    const [recalculated, setRecalculated] = useState<{ leads: number; changed: number } | null>(null);
    const max = rules.data?.filter((r) => r.enabled && r.points > 0).reduce((n, r) => n + r.points, 0) ?? 0;

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13px] text-muted-foreground">A lead's score is the sum of the points of every matching rule, from 0 to 100. A manual score set on the lead takes precedence in lists.</p>
                <div className="flex gap-2">
                    {recalculated && !recalc.isPending && <span role="status" className="self-center text-xs text-muted-foreground">{recalculated.changed} of {recalculated.leads} open leads changed</span>}
                    <Button size="sm" variant="outline" loading={recalc.isPending} onClick={() => recalc.mutate(undefined, { onSuccess: setRecalculated })}><Calculator /> Recalculate</Button>
                    <Button size="sm" onClick={() => setCreating(true)}><Plus /> New rule</Button>
                </div>
            </div>
            {max > 100 && <p className="text-xs text-warning">Positive points add up to {max}; scores are capped at 100.</p>}
            <div className="rounded-lg border border-border bg-card">
                {rules.isPending ? <ListSkeleton /> : rules.error ? <ErrorState error={rules.error} onRetry={() => rules.refetch()} /> : !rules.data.length ? (
                    <EmptyState compact icon={Sparkles} title="No scoring rules" description="Example: +20 when the source is Referral, +15 when the estimated value is at least 10 000." action={<Button size="sm" onClick={() => setCreating(true)}><Plus /> New rule</Button>} />
                ) : (
                    <ul className="divide-y divide-border-soft">
                        {rules.data.map((r) => (
                            <li key={r.id} className="flex items-start gap-3 px-3 py-2.5">
                                <Badge variant={r.points >= 0 ? "success" : "danger"} className="mt-0.5 w-12 justify-center tabular">{r.points > 0 ? `+${r.points}` : r.points}</Badge>
                                <div className="min-w-0 flex-1 text-[13px]">
                                    <div className="flex flex-wrap items-center gap-1.5"><span className="font-medium text-foreground">{r.name}</span>{!r.enabled && <Badge>Off</Badge>}</div>
                                    <div className="mt-0.5 text-xs text-muted-foreground">When {summary(r.conditions).toLowerCase()}</div>
                                </div>
                                <Switch checked={r.enabled} aria-label={`Enable ${r.name}`} onCheckedChange={(c) => update.mutate({ id: r.id, enabled: c })} />
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onSelect={() => setEditing(r)}><Pencil /> Edit</DropdownMenuItem>
                                        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(r)}><Trash2 /> Delete</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <ScoringRuleDialog open={creating || !!editing} rule={editing} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }} />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete rule “${deleting?.name}”?`}
                description="Scores change the next time leads are saved or recalculated."
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => { if (deleting) del.mutate(deleting.id); setDeleting(null); }}
            />
        </div>
    );
}

function ScoringRuleDialog({ open, rule, onOpenChange }: { open: boolean; rule: ScoringRule | null; onOpenChange: (o: boolean) => void }) {
    // Complex multi-field edit: stays a dialog with Save; API errors show inline, no toasts.
    const create = useCreateScoringRule();
    const update = useUpdateScoringRule({ errorToast: false });
    const [name, setName] = useState("");
    const [points, setPoints] = useState("10");
    const [conditions, setConditions] = useState<RuleCondition[]>([]);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (!open) return;
        setName(rule?.name ?? "");
        setPoints(String(rule?.points ?? 10));
        setConditions(rule?.conditions ?? []);
        setError(null);
    }, [open, rule]);
    const pending = create.isPending || update.isPending;
    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const p = Number(points);
        if (!name.trim()) return setError("Enter a name");
        if (!Number.isInteger(p) || p < -100 || p > 100 || p === 0) return setError("Points must be a whole number between -100 and 100 (not 0)");
        if (!conditions.length) return setError("Add at least one condition");
        if (conditions.some((c) => !["is_empty", "is_not_empty"].includes(c.operator) && (c.value === null || c.value === undefined || c.value === ""))) return setError("Every condition needs a value");
        const opts = { onSuccess: () => onOpenChange(false), onError: (err: unknown) => setError(getApiErrorMessage(err)) };
        if (rule) update.mutate({ id: rule.id, name: name.trim(), points: p, conditions }, opts);
        else create.mutate({ name: name.trim(), points: p, conditions, description: null, enabled: true }, opts);
    };
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>{rule ? "Edit scoring rule" : "New scoring rule"}</DialogTitle>
                        <DialogDescription>Points are added (or subtracted) when every condition matches.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                        <div className="space-y-1.5"><Label htmlFor="score-name">Name</Label><Input id="score-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Referral leads" /></div>
                        <div className="space-y-1.5"><Label htmlFor="score-points">Points</Label><Input id="score-points" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value)} /></div>
                    </div>
                    <div className="space-y-1.5"><Label>Conditions</Label><RuleConditionsEditor value={conditions} onChange={setConditions} /></div>
                    {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                        <Button type="submit" loading={pending}>Save rule</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
