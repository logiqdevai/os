import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCreateGrant } from "@/features/admin/permissions/hooks/use-permissions-admin";
import { PermissionEffectFormOptions } from "@/config/constants/dropdowns/admin/access-form.options";
import type { ScopeType } from "@/config/constants/dropdowns/admin/scope-type-form.options";
import { PermissionPicker } from "../../../components/permission-picker";
import { ScopeFields, scopeComplete } from "../../../components/scope-fields";

/** Add an explicit allow or deny for one permission (deny always wins). */
export function GrantDialog({ open, onOpenChange, membershipId }: { open: boolean; onOpenChange: (o: boolean) => void; membershipId: string }) {
    const create = useCreateGrant();
    const [key, setKey] = useState<string | undefined>();
    const [effect, setEffect] = useState<"ALLOW" | "DENY">("ALLOW");
    const [scopeType, setScopeType] = useState<ScopeType>("ORGANIZATION");
    const [scopeId, setScopeId] = useState<string | undefined>();
    const [until, setUntil] = useState("");
    const [reason, setReason] = useState("");

    useEffect(() => {
        if (open) { setKey(undefined); setEffect("ALLOW"); setScopeType("ORGANIZATION"); setScopeId(undefined); setUntil(""); setReason(""); }
    }, [open]);

    const valid = !!key && scopeComplete(scopeType, scopeId);
    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!key || !valid) return;
        create.mutate(
            { membership_id: membershipId, permission_key: key, effect, scope_type: scopeType, scope_id: scopeId, valid_until: until ? new Date(`${until}T23:59:59`).toISOString() : undefined, reason: reason || undefined },
            { onSuccess: () => onOpenChange(false) }
        );
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Allow or deny a permission</DialogTitle>
                        <DialogDescription>For exceptions outside roles. A deny always wins over any role.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5">
                        <Label>Permission</Label>
                        <PermissionPicker value={key} onChange={setKey} onlyHeld={effect === "ALLOW"} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Effect</Label>
                        <RadioGroup value={effect} onValueChange={(v) => setEffect(v as "ALLOW" | "DENY")} className="flex flex-wrap gap-4">
                            {PermissionEffectFormOptions.map((o) => (
                                <label key={o.id} className="flex items-center gap-2 text-[13px] text-foreground">
                                    <RadioGroupItem value={o.id} /> {o.label}
                                </label>
                            ))}
                        </RadioGroup>
                    </div>
                    <ScopeFields scopeType={scopeType} scopeId={scopeId} onChange={(t, s) => { setScopeType(t); setScopeId(s); }} />
                    <div className="space-y-1.5">
                        <Label htmlFor="grant-until">Ends on (optional)</Label>
                        <Input id="grant-until" type="date" value={until} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setUntil(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="grant-reason">Reason</Label>
                        <Textarea id="grant-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this exception exists" />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                        <Button type="submit" variant={effect === "DENY" ? "destructive" : "default"} loading={create.isPending} disabled={!valid}>{effect === "ALLOW" ? "Allow" : "Deny"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
