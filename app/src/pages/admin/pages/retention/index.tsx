import { useEffect, useState } from "react";
import { Lock, Play, ShieldAlert } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRetentionPolicies, useRunRetention, useSetLegalHold, useUpdateRetentionPolicy } from "@/features/admin/retention/hooks/use-retention";
import type { RetentionAction, RetentionPolicy } from "@/features/admin/retention/interfaces/retention.interfaces";
import {
    RetentionActionOptions,
    RetentionDataClassOptions,
    RetentionPeriodOptions,
    RetentionSkipOptions,
    getRetentionDataClassDescription,
} from "@/config/constants/dropdowns/admin/retention-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatNumber, formatRelative } from "@/lib/format";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";

/**
 * Data retention — /admin/retention   (mockup 01-admin `retention`, spec §100, §134)
 * @perm VIEW + save organizations.retention.manage (documents.retention.manage / messaging.retention.manage own their modules' policies)
 * @api GET /retention-policies · PUT /retention-policies/:data_class · POST /retention-policies/legal-hold · POST /retention-policies/run
 * @states loading · saving · error · no-access · legal hold on
 */
export default function RetentionPage() {
    const policies = useRetentionPolicies();
    const run = useRunRetention();
    const [holdDialog, setHoldDialog] = useState(false);

    if (policies.isPending) return <PageSkeleton />;
    if (policies.error || !policies.data) return <Page><PageHeader title="Data retention" /><ErrorState error={policies.error} onRetry={() => policies.refetch()} /></Page>;

    const list = policies.data.data;
    const onHold = list.some((p) => p.legal_hold);
    const holdReason = list.find((p) => p.legal_hold)?.legal_hold_reason;

    const runNow = () =>
        run.mutate(undefined, {
            onSuccess: (res) => {
                const touched = res.results.filter((r) => r.affected > 0);
                toast({
                    title: touched.length ? `Removed or anonymized ${touched.reduce((n, r) => n + r.affected, 0)} rows` : "Nothing to clean up",
                    description: res.results.filter((r) => r.skipped).map((r) => `${getDropdownOptionLabel(RetentionDataClassOptions, r.data_class)} ${getDropdownOptionLabel(RetentionSkipOptions, r.skipped)}`).join(" · ") || undefined,
                });
            },
            onError: (e) => toast({ variant: "destructive", title: "Could not run retention", description: getApiErrorMessage(e) }),
        });

    return (
        <Page width="narrow">
            <PageHeader
                title="Data retention"
                description="How long platform data is kept before it is removed or anonymized. Runs daily at 03:00."
                actions={<Button variant="outline" onClick={runNow} loading={run.isPending} disabled={onHold}><Play /> Run now</Button>}
            />
            <div className="space-y-6">
                <div className="flex items-start gap-2 rounded-lg border border-border bg-warning-soft p-3 text-[13px] text-warning">
                    <Lock className="mt-0.5 size-4 flex-none" />
                    <span>Audit events are evidence and are never deleted: after the period they are archived or anonymized. A legal hold suspends every clean-up.</span>
                </div>

                <Section title="Platform data">
                    <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                        {list.map((p) => <PolicyRow key={p.data_class} policy={p} />)}
                    </div>
                </Section>

                <Section title="Legal hold">
                    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">Suspend all clean-up {onHold && <Badge variant="danger" dot>On</Badge>}</div>
                            <p className="text-xs text-muted-foreground">{onHold ? `Reason: ${holdReason ?? "—"}` : "Use during a dispute or investigation. Turning it on or off is audited."}</p>
                        </div>
                        <Switch aria-label="Legal hold" checked={onHold} onCheckedChange={() => setHoldDialog(true)} />
                    </div>
                </Section>

                <Section title="Owned by other modules">
                    <div className="divide-y divide-border-soft rounded-lg border border-border bg-card text-[13px]">
                        <div className="px-4 py-3"><div className="font-medium text-foreground">Documents & files</div><div className="text-xs text-muted-foreground">Retention rules and legal holds per folder, managed in Files (documents.retention.manage).</div></div>
                        <div className="px-4 py-3"><div className="font-medium text-foreground">Messages</div><div className="text-xs text-muted-foreground">Message retention, managed in Messaging (messaging.retention.manage).</div></div>
                    </div>
                </Section>
            </div>
            <LegalHoldDialog open={holdDialog} onOpenChange={setHoldDialog} enabled={onHold} />
        </Page>
    );
}

function PolicyRow({ policy: p }: { policy: RetentionPolicy }) {
    const update = useUpdateRetentionPolicy();
    const canManage = usePermission("organizations.retention.manage");
    const [days, setDays] = useState(p.retention_days === null ? "forever" : String(p.retention_days));
    const [action, setAction] = useState<RetentionAction>(p.action);
    useEffect(() => {
        setDays(p.retention_days === null ? "forever" : String(p.retention_days));
        setAction(p.action);
    }, [p.retention_days, p.action]);

    const periodOptions = RetentionPeriodOptions.filter((o) => o.id === "forever" || Number(o.id) >= p.min_days);
    const options = p.retention_days !== null && !periodOptions.some((o) => o.id === String(p.retention_days)) ? [...periodOptions, { id: String(p.retention_days), label: `${p.retention_days} days` }] : periodOptions;
    const dirty = days !== (p.retention_days === null ? "forever" : String(p.retention_days)) || action !== p.action;

    const save = () =>
        update.mutate(
            { data_class: p.data_class, retention_days: days === "forever" ? null : Number(days), action },
            { onSuccess: () => toast({ title: `${getDropdownOptionLabel(RetentionDataClassOptions, p.data_class)} saved` }), onError: (e) => toast({ variant: "destructive", title: "Could not save", description: getApiErrorMessage(e) }) }
        );

    return (
        <div className="space-y-3 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-medium text-foreground">{getDropdownOptionLabel(RetentionDataClassOptions, p.data_class)}</span>
                {p.legal_hold && <Badge variant="danger">Legal hold</Badge>}
                {p.retention_days !== null && p.eligible > 0 && <Badge variant="warning">{formatNumber(p.eligible)} eligible now</Badge>}
                {p.last_run_at && <span className="text-xs text-muted-foreground">last run {formatRelative(p.last_run_at)}</span>}
            </div>
            <p className="text-xs text-muted-foreground">{getRetentionDataClassDescription(p.data_class)}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={days} onValueChange={setDays} disabled={!canManage}>
                    <SelectTrigger className="sm:w-44" aria-label={`Keep ${p.data_class} for`}><SelectValue /></SelectTrigger>
                    <SelectContent>{options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={action} onValueChange={(v) => setAction(v as RetentionAction)} disabled={!canManage || p.allowed_actions.length < 2}>
                    <SelectTrigger className="sm:w-44" aria-label={`Then for ${p.data_class}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{RetentionActionOptions.filter((o) => p.allowed_actions.includes(o.id)).map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" className="sm:ml-auto" disabled={!dirty} loading={update.isPending} onClick={save}>Save</Button>
            </div>
        </div>
    );
}

function LegalHoldDialog({ open, onOpenChange, enabled }: { open: boolean; onOpenChange: (open: boolean) => void; enabled: boolean }) {
    const hold = useSetLegalHold();
    const [reason, setReason] = useState("");
    useEffect(() => { if (open) setReason(""); }, [open]);
    const turnOn = !enabled;
    const confirm = () =>
        hold.mutate(
            { enabled: turnOn, reason: turnOn ? reason.trim() : null },
            { onSuccess: () => { toast({ title: turnOn ? "Legal hold on: clean-up suspended" : "Legal hold lifted" }); onOpenChange(false); }, onError: (e) => toast({ variant: "destructive", title: "Could not change the legal hold", description: getApiErrorMessage(e) }) }
        );
    return (
        <Dialog open={open} onOpenChange={(o) => !hold.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><ShieldAlert className="size-4 text-warning" /> {turnOn ? "Put all platform data on legal hold?" : "Lift the legal hold?"}</DialogTitle>
                    <DialogDescription>{turnOn ? "Nothing is removed or anonymized until the hold is lifted." : "The next daily run applies the retention periods again."}</DialogDescription>
                </DialogHeader>
                {turnOn && (
                    <div className="space-y-1.5">
                        <Label htmlFor="hold-reason">Reason</Label>
                        <Textarea id="hold-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Dispute with a former client (case 2026-14)" />
                    </div>
                )}
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={hold.isPending}>Cancel</Button>
                    <Button variant={turnOn ? "default" : "destructive"} disabled={turnOn && !reason.trim()} loading={hold.isPending} onClick={confirm}>{turnOn ? "Turn on legal hold" : "Lift hold"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
