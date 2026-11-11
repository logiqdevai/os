import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAssignableRoles } from "@/features/admin/roles/hooks/use-roles";
import type { ScopeType } from "@/config/constants/dropdowns/admin/scope-type-form.options";
import { ScopeFields, scopeComplete } from "./scope-fields";

export interface AssignRoleValues {
    role_id: string;
    scope_type: ScopeType;
    scope_id?: string;
    valid_until?: string;
    reason?: string;
}

interface AssignRoleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    pending: boolean;
    onSubmit: (values: AssignRoleValues) => void;
    /** Hide the reason field (service accounts). */
    withReason?: boolean;
}

/** Role + scope + optional end date. Shared by members and service accounts. */
export function AssignRoleDialog({ open, onOpenChange, title, pending, onSubmit, withReason = true }: AssignRoleDialogProps) {
    const roles = useAssignableRoles(open);
    const [roleId, setRoleId] = useState("");
    const [scopeType, setScopeType] = useState<ScopeType>("ORGANIZATION");
    const [scopeId, setScopeId] = useState<string | undefined>();
    const [until, setUntil] = useState("");
    const [reason, setReason] = useState("");

    useEffect(() => {
        if (open) {
            setRoleId("");
            setScopeType("ORGANIZATION");
            setScopeId(undefined);
            setUntil("");
            setReason("");
        }
    }, [open]);

    const role = roles.data?.find((r) => r.id === roleId);
    const valid = !!roleId && scopeComplete(scopeType, scopeId) && (!until || new Date(until) > new Date());

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!valid) return;
                        onSubmit({ role_id: roleId, scope_type: scopeType, scope_id: scopeId, valid_until: until ? new Date(`${until}T23:59:59`).toISOString() : undefined, reason: reason || undefined });
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>You can only give roles whose permissions you hold yourself.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5">
                        <Label htmlFor="role">Role</Label>
                        <Select value={roleId} onValueChange={(v) => { setRoleId(v); const r = roles.data?.find((x) => x.id === v); if (r && r.default_scope !== "ORGANIZATION" && ["BRANCH", "BRANCH_HIERARCHY", "TEAM"].includes(r.default_scope)) { setScopeType(r.default_scope); setScopeId(undefined); } }}>
                            <SelectTrigger id="role" aria-label="Role"><SelectValue placeholder={roles.isPending ? "Loading roles…" : "Pick a role"} /></SelectTrigger>
                            <SelectContent>
                                {roles.data?.map((r) => (
                                    <SelectItem key={r.id} value={r.id}>{r.name}{r.is_template ? "" : " (custom)"}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {role?.description && <p className="text-xs text-muted-foreground">{role.description}</p>}
                    </div>
                    <ScopeFields scopeType={scopeType} scopeId={scopeId} onChange={(t, s) => { setScopeType(t); setScopeId(s); }} />
                    <div className="space-y-1.5">
                        <Label htmlFor="valid_until">Ends on (optional)</Label>
                        <Input id="valid_until" type="date" value={until} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setUntil(e.target.value)} />
                        <p className="text-xs text-muted-foreground">Leave empty for permanent access.</p>
                    </div>
                    {withReason && (
                        <div className="space-y-1.5">
                            <Label htmlFor="reason">Reason (optional)</Label>
                            <Textarea id="reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Shown in the audit log" />
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                        <Button type="submit" loading={pending} disabled={!valid}>Assign role</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
