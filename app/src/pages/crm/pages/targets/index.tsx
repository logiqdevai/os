import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MoreHorizontal, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { usePermission } from "@/hooks/use-permission";
import { getApiErrorMessage } from "@/lib/api-error";
import { TargetMetricOptions, TargetPeriodOptions } from "@/config/constants/dropdowns/crm/crm-rules.options";
import { useCreateTarget, useDeleteTarget, useTargets, useUpdateTarget } from "@/features/crm/rules/hooks/use-rules";
import { useTeamOptions } from "@/features/crm/saved-views/hooks/use-saved-views";
import { useCrmMembers } from "@/features/crm/settings/hooks/use-crm-settings";
import { usePipelines } from "@/features/crm/pipelines/hooks/use-pipelines";
import type { SalesTarget, TargetMetric, TargetPeriod } from "@/features/crm/rules/interfaces/rules.interfaces";
import { memberLabel, Panel } from "../../components/crm-ui";
import { TargetRow } from "../../components/target-progress";

const ALL = "all";
const NONE = "__none";

/**
 * Sales targets (02 §11, §33): per member, team or organization for a month / quarter / year, with attainment.
 * @route /crm/targets?year=&period=
 * @perm VIEW crm.targets.read · create/edit/delete crm.targets.manage (sensitive) · amounts crm.financials.read
 * @api GET /crm/targets?year=&period= · POST/PATCH/DELETE /crm/targets
 * @mcp crm_targets_read · crm_targets_create · crm_targets_update
 */
export default function TargetsPage() {
    const [sp, setSp] = useSearchParams();
    const year = Number(sp.get("year")) || new Date().getFullYear();
    const period = sp.get("period") ?? ALL;
    const targets = useTargets({ year, period: period === ALL ? undefined : period });
    const del = useDeleteTarget();
    const canManage = usePermission("crm.targets.manage");
    const [editing, setEditing] = useState<SalesTarget | null>(null);
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState<SalesTarget | null>(null);
    const set = (k: string, v: string) => setSp((prev) => { const n = new URLSearchParams(prev); if (v && v !== ALL) n.set(k, v); else n.delete(k); return n; }, { replace: true });

    const groups = useMemo(() => {
        const map = new Map<string, SalesTarget[]>();
        for (const t of targets.data ?? []) {
            const k = `${t.period}|${t.period_start}`;
            map.set(k, [...(map.get(k) ?? []), t]);
        }
        return [...map.entries()];
    }, [targets.data]);

    const today = new Date().toISOString().slice(0, 10);

    return (
        <Page width="wide">
            <PageHeader
                title="Sales targets"
                description="Goals per person, team or the whole organization. The marker on each bar shows how much of the period has passed."
                actions={<Can permission="crm.targets.manage"><Button onClick={() => setCreating(true)}><Plus /> New target</Button></Can>}
            />
            <div className="mb-3 flex flex-wrap gap-2">
                <Select value={String(year)} onValueChange={(v) => set("year", v)}>
                    <SelectTrigger className="h-8 w-28" aria-label="Year"><SelectValue /></SelectTrigger>
                    <SelectContent>{[year - 2, year - 1, year, year + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={period} onValueChange={(v) => set("period", v)}>
                    <SelectTrigger className="h-8 w-36" aria-label="Period"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>All periods</SelectItem>
                        {TargetPeriodOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            {targets.isPending ? <ListSkeleton /> : targets.error ? <ErrorState error={targets.error} onRetry={() => targets.refetch()} /> : !groups.length ? (
                <EmptyState icon={Target} title={`No targets in ${year}`} description="Set monthly, quarterly or yearly goals for won revenue, deals won or pipeline created." action={canManage ? <Button size="sm" onClick={() => setCreating(true)}><Plus /> New target</Button> : undefined} />
            ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                    {groups.map(([key, rows]) => {
                        const t0 = rows[0];
                        const current = t0.period_start <= today && t0.period_end >= today;
                        return (
                            <Panel key={key} title={<span>{TargetPeriodOptions.find((o) => o.id === t0.period)?.label} from {t0.period_start} to {t0.period_end}{current && <span className="ml-2 text-xs text-info">current</span>}</span>} bodyClassName="py-1">
                                <div className="divide-y divide-border-soft">
                                    {rows.map((t) => (
                                        <TargetRow key={t.id} t={t} actions={canManage ? (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Target actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onSelect={() => setEditing(t)}><Pencil /> Edit</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(t)}><Trash2 /> Delete</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        ) : undefined} />
                                    ))}
                                </div>
                            </Panel>
                        );
                    })}
                </div>
            )}
            <TargetDialog open={creating || !!editing} target={editing} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }} />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title="Delete this target?"
                description="Deals are not affected."
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => { if (deleting) del.mutate(deleting.id); setDeleting(null); }}
            />
        </Page>
    );
}

function TargetDialog({ open, target, onOpenChange }: { open: boolean; target: SalesTarget | null; onOpenChange: (o: boolean) => void }) {
    const create = useCreateTarget();
    const update = useUpdateTarget();
    const members = useCrmMembers(open);
    const canTeams = usePermission("organizations.teams.read");
    const teams = useTeamOptions(open && canTeams);
    const pipelines = usePipelines();
    const [scope, setScope] = useState<"member" | "team" | "org">("member");
    const [memberId, setMemberId] = useState("");
    const [teamId, setTeamId] = useState("");
    const [pipelineId, setPipelineId] = useState(NONE);
    const [period, setPeriod] = useState<TargetPeriod>("QUARTER");
    const [start, setStart] = useState("");
    const [metric, setMetric] = useState<TargetMetric>("REVENUE_WON");
    const [amount, setAmount] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setScope(target ? (target.owner_membership_id ? "member" : target.team_id ? "team" : "org") : "member");
        setMemberId(target?.owner_membership_id ?? "");
        setTeamId(target?.team_id ?? "");
        setPipelineId(target?.pipeline_id ?? NONE);
        setPeriod(target?.period ?? "QUARTER");
        setStart(target?.period_start ?? new Date().toISOString().slice(0, 10));
        setMetric(target?.metric ?? "REVENUE_WON");
        setAmount(target?.amount != null ? String(target.amount) : "");
        setError(null);
    }, [open, target]);

    const pending = create.isPending || update.isPending;
    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const n = Number(amount);
        if (!Number.isFinite(n) || n <= 0) return setError(metric === "DEALS_WON" ? "Enter the number of deals" : "Enter the target amount");
        if (scope === "member" && !memberId) return setError("Choose a member");
        if (scope === "team" && !teamId) return setError("Choose a team");
        const dto = {
            owner_membership_id: scope === "member" ? memberId : null,
            team_id: scope === "team" ? teamId : null,
            pipeline_id: pipelineId === NONE ? null : pipelineId,
            period, period_start: start, metric, amount: n,
        };
        // Multi-field edit: stays a dialog with Save; API errors show inline (the hooks do not toast).
        const opts = { onSuccess: () => onOpenChange(false), onError: (err: unknown) => setError(getApiErrorMessage(err)) };
        if (target) update.mutate({ id: target.id, ...dto }, opts);
        else create.mutate(dto, opts);
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
                <form onSubmit={submit} className="space-y-3">
                    <DialogHeader>
                        <DialogTitle>{target ? "Edit target" : "New target"}</DialogTitle>
                        <DialogDescription>The period snaps to the month, quarter or year that contains the start date.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5">
                        <Label>For</Label>
                        <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
                            <SelectTrigger aria-label="Target for"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="member">A member</SelectItem>
                                {canTeams && <SelectItem value="team">A team</SelectItem>}
                                <SelectItem value="org">The whole organization</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {scope === "member" && (
                        <Select value={memberId} onValueChange={setMemberId}>
                            <SelectTrigger aria-label="Member"><SelectValue placeholder="Choose a member" /></SelectTrigger>
                            <SelectContent>{members.data?.map((m) => <SelectItem key={m.id} value={m.id}>{memberLabel(m)}</SelectItem>)}</SelectContent>
                        </Select>
                    )}
                    {scope === "team" && (
                        <Select value={teamId} onValueChange={setTeamId}>
                            <SelectTrigger aria-label="Team"><SelectValue placeholder="Choose a team" /></SelectTrigger>
                            <SelectContent>{teams.data?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                        </Select>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Period</Label>
                            <Select value={period} onValueChange={(v) => setPeriod(v as TargetPeriod)}>
                                <SelectTrigger aria-label="Period"><SelectValue /></SelectTrigger>
                                <SelectContent>{TargetPeriodOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5"><Label htmlFor="t-start">Starting</Label><Input id="t-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} required /></div>
                        <div className="space-y-1.5">
                            <Label>Metric</Label>
                            <Select value={metric} onValueChange={(v) => setMetric(v as TargetMetric)}>
                                <SelectTrigger aria-label="Metric"><SelectValue /></SelectTrigger>
                                <SelectContent>{TargetMetricOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5"><Label htmlFor="t-amount">{metric === "DEALS_WON" ? "Deals" : "Amount"}</Label><Input id="t-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                    </div>
                    {(pipelines.data?.length ?? 0) > 1 && (
                        <div className="space-y-1.5">
                            <Label>Pipeline</Label>
                            <Select value={pipelineId} onValueChange={setPipelineId}>
                                <SelectTrigger aria-label="Pipeline"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE}>All pipelines</SelectItem>
                                    {pipelines.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                        <Button type="submit" loading={pending}>Save target</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
