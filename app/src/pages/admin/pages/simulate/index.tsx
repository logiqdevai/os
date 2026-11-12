import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, FlaskConical, XCircle } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useSimulate } from "@/features/admin/permissions/hooks/use-permissions-admin";
import { AccessReasonOptions } from "@/config/constants/dropdowns/admin/access-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MemberPicker } from "../../components/member-picker";
import { PermissionPicker } from "../../components/permission-picker";
import { useScopeLabel } from "../../components/use-scope-label";

const ANY = "__any";

/**
 * Simulate access — /admin/simulate
 * @perm users.permissions.simulate (read-only: never changes data)
 * @api POST /permissions/simulate → uses AuthorizationService.explain for the member
 */
export default function SimulatePage() {
    const session = useSessionData();
    const scopeLabel = useScopeLabel();
    const simulate = useSimulate();
    const [memberId, setMemberId] = useState<string | undefined>();
    const [memberName, setMemberName] = useState("");
    const [key, setKey] = useState<string | undefined>();
    const [branchId, setBranchId] = useState(ANY);
    const result = simulate.data;

    const run = () =>
        memberId && key &&
        simulate.mutate({ membership_id: memberId, permission_key: key, ...(branchId !== ANY && { branch_id: branchId }) });

    return (
        <Page width="wide">
            <PageHeader title="Simulate access" description="Check whether someone may do something, and see exactly why. Nothing is changed." />
            <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
                <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                    <div className="space-y-1.5">
                        <Label>Member</Label>
                        <MemberPicker value={memberId} onChange={(id, label) => { setMemberId(id); setMemberName(label); }} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Permission</Label>
                        <PermissionPicker value={key} onChange={setKey} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>On a record in branch</Label>
                        <Select value={branchId} onValueChange={setBranchId}>
                            <SelectTrigger aria-label="Branch of the record"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ANY}>Any record</SelectItem>
                                {session?.branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button className="w-full" onClick={run} disabled={!memberId || !key} loading={simulate.isPending}><FlaskConical /> Check access</Button>
                </div>

                <div className="min-w-0">
                    {!result ? (
                        <div className="rounded-lg border border-border bg-card"><EmptyState icon={FlaskConical} title="Pick a member and a permission" description="The result explains every step: membership, module access, roles, exceptions, denies and scope." /></div>
                    ) : (
                        <div className="space-y-5">
                            <div className={cn("flex items-start gap-3 rounded-lg border p-4", result.allowed ? "border-success/40 bg-success-soft" : "border-danger/40 bg-danger-soft")}>
                                {result.allowed ? <CheckCircle2 className="mt-0.5 size-5 text-success" /> : <XCircle className="mt-0.5 size-5 text-danger" />}
                                <div className="min-w-0">
                                    <p className="font-medium text-foreground">{memberName} {result.allowed ? "can" : "cannot"} <code className="text-[13px]">{result.permission.key}</code></p>
                                    <p className="text-[13px] text-muted-foreground">{getDropdownOptionLabel(AccessReasonOptions, result.reason)}</p>
                                </div>
                            </div>
                            <Section title="How it was decided">
                                <ol className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                                    {result.steps.map((s) => (
                                        <li key={s.check} className="flex items-start gap-2.5 px-4 py-2.5 text-[13px]">
                                            {s.passed ? <CheckCircle2 className="mt-0.5 size-4 flex-none text-success" /> : <XCircle className="mt-0.5 size-4 flex-none text-danger" />}
                                            <span className="text-foreground">{s.detail}</span>
                                        </li>
                                    ))}
                                </ol>
                            </Section>
                            <Section title="Sources">
                                <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                                    {result.sources.length === 0 && <p className="px-4 py-3 text-[13px] text-muted-foreground">No role or exception mentions this permission.</p>}
                                    {result.sources.map((s) => (
                                        <div key={`${s.kind}-${s.id}`} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex flex-wrap items-center gap-2 text-[13px]">
                                                <Badge variant={s.effect === "ALLOW" ? "success" : "danger"}>{s.effect === "ALLOW" ? "Allow" : "Deny"}</Badge>
                                                <span className="font-medium text-foreground">{s.kind === "role" ? `Role: ${s.name}` : `Exception: ${s.name}`}</span>
                                                {s.draft && <Badge variant="warning">Draft — not active</Badge>}
                                            </div>
                                            <span className="text-xs text-muted-foreground">{scopeLabel(s.scope_type, s.scope_id)}{s.valid_until ? ` · until ${formatDate(s.valid_until)}` : ""}</span>
                                        </div>
                                    ))}
                                </div>
                            </Section>
                            {memberId && <Link to={`/admin/members/${memberId}?tab=access`} className="text-[13px] text-muted-foreground hover:text-foreground">Open {memberName}&apos;s access →</Link>}
                        </div>
                    )}
                </div>
            </div>
        </Page>
    );
}
