import { useEffect, useState } from "react";
import { Archive, FileStack, MoreHorizontal, Pencil, Plus, UserPlus } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermissions } from "@/hooks/use-permission";
import {
    useArchiveLeavePolicy, useAssignLeavePolicy, useCreateLeavePolicy, useLeavePolicies, useLeaveTypes, usePolicyAssignments, useUpdateLeavePolicy,
} from "@/features/people/leave/hooks/use-leave";
import { useEmployees } from "@/features/people/employees/hooks/use-employees";
import type { LeaveAccrualMethod, LeavePolicy, LeavePolicyDto } from "@/features/people/leave/interfaces/leave.interfaces";
import { LeaveAccrualFormOptions, LeaveTypeColorTone } from "@/config/constants/dropdowns/people/leave-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatNumber } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { Field, Toggle } from "./general-tab";

const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });
const NONE = "__none__";

/** LeavePolicy list, editor and explicit assignment (EmployeeLeavePolicy). @perm employees.leave.manage_policies */
export function LeavePoliciesTab({ branches }: { branches: { id: string; name: string }[] }) {
    const q = useLeavePolicies();
    const archive = useArchiveLeavePolicy();
    const [editing, setEditing] = useState<LeavePolicy | "new" | null>(null);
    const [assigning, setAssigning] = useState<LeavePolicy | null>(null);
    const [archiving, setArchiving] = useState<LeavePolicy | null>(null);
    const columns: DataTableColumn<LeavePolicy>[] = [
        { key: "name", header: "Policy", cell: (p) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{p.name}</div><div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Badge variant={LeaveTypeColorTone[p.leave_type.color ?? "neutral"] ?? "neutral"}>{p.leave_type.code}</Badge>{p.leave_type.name}</div></div> },
        { key: "branch", header: "Branch", cell: (p) => p.branch?.name ?? "All", hideBelow: "md" },
        { key: "accrual", header: "Accrual", cell: (p) => getDropdownOptionLabel(LeaveAccrualFormOptions, p.accrual_method), hideBelow: "lg" },
        { key: "days", header: <span className="block text-right">Days / year</span>, cell: (p) => <span className="block text-right tabular">{formatNumber(p.annual_entitlement_days, 1)}</span> },
        { key: "carry", header: "Carry over", cell: (p) => (p.carry_over_max_days ? `${formatNumber(p.carry_over_max_days, 1)} d${p.carry_over_expiry_months ? ` · ${p.carry_over_expiry_months} m` : ""}` : "—"), hideBelow: "lg" },
        { key: "default", header: "Applies", cell: (p) => (p.is_default ? <Badge variant="success">Default</Badge> : <span className="text-xs text-muted-foreground tabular">{p._count.assignments} assigned</span>), hideBelow: "sm" },
        {
            key: "actions", header: <span className="sr-only">Actions</span>, className: "w-12",
            cell: (p) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Actions for ${p.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing(p)}><Pencil /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setAssigning(p)}><UserPlus /> Assign to employee</DropdownMenuItem>
                        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setArchiving(p)}><Archive /> Archive</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">A default policy applies to everyone in its branch; others apply by explicit assignment.</p>
                <Button onClick={() => setEditing("new")}><Plus /> New policy</Button>
            </div>
            <DataTable columns={columns} data={q.data} rowKey={(p) => p.id} loading={q.isFetching} error={q.error} onRetry={() => q.refetch()} onRowClick={setEditing}
                empty={{ icon: FileStack, title: "No leave policies", description: "Policies set the yearly entitlement, accrual and carry-over per leave type." }} />
            <PolicyDialog value={editing} branches={branches} onClose={() => setEditing(null)} />
            <AssignDialog policy={assigning} onClose={() => setAssigning(null)} />
            <ConfirmationDialog isOpen={!!archiving} onClose={() => setArchiving(null)} title={`Archive ${archiving?.name ?? "policy"}?`} description="Existing balances keep their history; the policy no longer applies to new periods."
                confirmText="Archive" variant="destructive" isLoading={archive.isPending}
                onConfirm={() => archiving && archive.mutate(archiving.id, { onSuccess: () => { toast({ title: "Policy archived" }); setArchiving(null); }, onError: fail("Could not archive") })} />
        </div>
    );
}

interface Form {
    leave_type_id: string;
    branch_id: string;
    name: string;
    accrual_method: LeaveAccrualMethod;
    annual_entitlement_days: string;
    prorate_first_year: boolean;
    carry_over_max_days: string;
    carry_over_expiry_months: string;
    allow_negative_balance: boolean;
    max_negative_days: string;
    period_start_month: string;
    is_default: boolean;
}
const EMPTY: Form = { leave_type_id: "", branch_id: NONE, name: "", accrual_method: "ANNUAL_UPFRONT", annual_entitlement_days: "22", prorate_first_year: true, carry_over_max_days: "", carry_over_expiry_months: "", allow_negative_balance: false, max_negative_days: "", period_start_month: "1", is_default: true };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function PolicyDialog({ value, branches, onClose }: { value: LeavePolicy | "new" | null; branches: { id: string; name: string }[]; onClose: () => void }) {
    const types = useLeaveTypes(!!value);
    const create = useCreateLeavePolicy();
    const update = useUpdateLeavePolicy();
    const assignments = usePolicyAssignments(value && value !== "new" ? value.id : undefined);
    const [f, setF] = useState<Form>(EMPTY);
    useEffect(() => {
        if (!value) return;
        if (value === "new") return setF(EMPTY);
        setF({
            leave_type_id: value.leave_type_id, branch_id: value.branch_id ?? NONE, name: value.name, accrual_method: value.accrual_method, annual_entitlement_days: String(Number(value.annual_entitlement_days)),
            prorate_first_year: value.prorate_first_year, carry_over_max_days: value.carry_over_max_days ? String(Number(value.carry_over_max_days)) : "", carry_over_expiry_months: value.carry_over_expiry_months?.toString() ?? "",
            allow_negative_balance: value.allow_negative_balance, max_negative_days: value.max_negative_days ? String(Number(value.max_negative_days)) : "", period_start_month: String(value.period_start_month), is_default: value.is_default,
        });
    }, [value]);
    const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
    const pending = create.isPending || update.isPending;
    const valid = !!f.leave_type_id && !!f.name.trim() && f.annual_entitlement_days !== "" && Number(f.annual_entitlement_days) >= 0;
    const submit = () => {
        const dto: LeavePolicyDto = {
            leave_type_id: f.leave_type_id, name: f.name.trim(), accrual_method: f.accrual_method, annual_entitlement_days: Number(f.annual_entitlement_days), prorate_first_year: f.prorate_first_year,
            allow_negative_balance: f.allow_negative_balance, period_start_month: Number(f.period_start_month), period_start_day: 1, is_default: f.is_default,
            ...(f.branch_id !== NONE && { branch_id: f.branch_id }),
            ...(f.carry_over_max_days !== "" && { carry_over_max_days: Number(f.carry_over_max_days) }),
            ...(f.carry_over_expiry_months !== "" && { carry_over_expiry_months: Number(f.carry_over_expiry_months) }),
            ...(f.allow_negative_balance && f.max_negative_days !== "" && { max_negative_days: Number(f.max_negative_days) }),
        };
        const done = { onSuccess: () => { toast({ title: "Policy saved" }); onClose(); }, onError: fail("Could not save the policy") };
        if (value === "new") create.mutate(dto, done);
        else if (value) {
            const { leave_type_id: _type, ...rest } = dto;
            update.mutate({ id: value.id, ...rest }, done);
        }
    };
    return (
        <Dialog open={!!value} onOpenChange={(o) => !o && !pending && onClose()}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <DialogHeader><DialogTitle>{value === "new" ? "New leave policy" : "Edit leave policy"}</DialogTitle><DialogDescription>Entitlement and accrual rules for one leave type.</DialogDescription></DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2"><Field label="Name" htmlFor="lp-name"><Input id="lp-name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Vacation — Portugal" /></Field></div>
                    <Field label="Leave type">
                        <Select value={f.leave_type_id} onValueChange={(v) => set("leave_type_id", v)} disabled={value !== "new"}>
                            <SelectTrigger aria-label="Leave type"><SelectValue placeholder="Pick a type" /></SelectTrigger>
                            <SelectContent>{types.data?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </Field>
                    <Field label="Branch">
                        <Select value={f.branch_id} onValueChange={(v) => set("branch_id", v)}>
                            <SelectTrigger aria-label="Branch"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value={NONE}>All branches</SelectItem>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </Field>
                    <Field label="Accrual">
                        <Select value={f.accrual_method} onValueChange={(v) => set("accrual_method", v as LeaveAccrualMethod)}>
                            <SelectTrigger aria-label="Accrual"><SelectValue /></SelectTrigger>
                            <SelectContent>{LeaveAccrualFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </Field>
                    <Field label="Days per year" htmlFor="lp-days"><Input id="lp-days" type="number" min={0} max={366} step="0.5" value={f.annual_entitlement_days} onChange={(e) => set("annual_entitlement_days", e.target.value)} /></Field>
                    <Field label="Year starts in">
                        <Select value={f.period_start_month} onValueChange={(v) => set("period_start_month", v)}>
                            <SelectTrigger aria-label="Year starts in"><SelectValue /></SelectTrigger>
                            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                    </Field>
                    <Field label="Carry over (max days)" htmlFor="lp-carry"><Input id="lp-carry" type="number" min={0} step="0.5" value={f.carry_over_max_days} onChange={(e) => set("carry_over_max_days", e.target.value)} /></Field>
                    <Field label="Carried days expire after (months)" htmlFor="lp-exp"><Input id="lp-exp" type="number" min={0} value={f.carry_over_expiry_months} onChange={(e) => set("carry_over_expiry_months", e.target.value)} /></Field>
                    <div className="space-y-3 sm:col-span-2">
                        <Toggle label="Pro-rate the first year" checked={f.prorate_first_year} onChange={(v) => set("prorate_first_year", v)} />
                        <Toggle label="Allow a negative balance" checked={f.allow_negative_balance} onChange={(v) => set("allow_negative_balance", v)} />
                        {f.allow_negative_balance && <Field label="Max negative days" htmlFor="lp-neg"><Input id="lp-neg" type="number" min={0} step="0.5" value={f.max_negative_days} onChange={(e) => set("max_negative_days", e.target.value)} className="w-28" /></Field>}
                        <Toggle label="Default policy" hint="Applies to everyone in the branch without an explicit assignment." checked={f.is_default} onChange={(v) => set("is_default", v)} />
                    </div>
                    {value !== "new" && !!assignments.data?.length && (
                        <div className="sm:col-span-2">
                            <div className="mb-1.5 text-xs text-muted-foreground">Assigned to</div>
                            <ul className="divide-y divide-border rounded-md border border-border text-[13px]">
                                {assignments.data.map((a) => <li key={a.id} className="flex justify-between gap-2 px-3 py-1.5"><span className="truncate text-foreground">{a.employee.name}</span><span className="shrink-0 tabular text-muted-foreground">from {formatDate(a.effective_from)}</span></li>)}
                            </ul>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button disabled={!valid} loading={pending} onClick={submit}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AssignDialog({ policy, onClose }: { policy: LeavePolicy | null; onClose: () => void }) {
    const p = usePermissions();
    const people = useEmployees({ limit: 200, status: "ACTIVE,ONBOARDING,ON_LEAVE" }, !!policy && p.can("employees.employees.read"));
    const assign = useAssignLeavePolicy();
    const [employeeId, setEmployeeId] = useState("");
    const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
    return (
        <Dialog open={!!policy} onOpenChange={(o) => !o && !assign.isPending && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Assign {policy?.name}</DialogTitle><DialogDescription>Overrides the default policy for this employee from the chosen date.</DialogDescription></DialogHeader>
                <div className="space-y-4">
                    <Field label="Employee">
                        <Select value={employeeId} onValueChange={setEmployeeId}>
                            <SelectTrigger aria-label="Employee"><SelectValue placeholder={people.isLoading ? "Loading…" : "Pick an employee"} /></SelectTrigger>
                            <SelectContent>{people.data?.data.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} · {e.employee_number}</SelectItem>)}</SelectContent>
                        </Select>
                    </Field>
                    <Field label="Effective from" htmlFor="as-from"><Input id="as-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button disabled={!employeeId || !from} loading={assign.isPending} onClick={() => policy && assign.mutate({ id: policy.id, employee_id: employeeId, effective_from: from }, { onSuccess: () => { toast({ title: "Policy assigned" }); setEmployeeId(""); onClose(); }, onError: fail("Could not assign") })}>Assign</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
