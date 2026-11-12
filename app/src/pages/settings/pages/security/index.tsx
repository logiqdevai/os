import { useState, type FormEvent } from "react";
import { KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { Section } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import { useDisableMfa, useMfaStatus, useRegenerateRecoveryCodes } from "@/features/session/hooks/use-session";
import type { MfaFactorDto } from "@/features/session/interfaces/session.interfaces";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime, formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { MfaRequiredReasonOptions } from "@/config/constants/dropdowns/admin/security-form.options";
import { toast } from "@/hooks/use-toast";
import { MfaEnrollment, RecoveryCodesList, cleanTotp } from "../../components/mfa/mfa-enrollment";

/**
 * Settings → Security — /settings/security (01 §74)
 * @api GET /auth/mfa · POST /auth/mfa/totp/setup|confirm · POST /auth/mfa/recovery-codes · POST /auth/mfa/disable
 * @states loading · error · off · enrolling · on · required by the organization (cannot turn off)
 * @audit user.mfa_enabled · user.mfa_disabled · user.mfa_recovery_codes_regenerated
 */
export default function SecuritySettingsPage() {
    const status = useMfaStatus();
    const [enrolling, setEnrolling] = useState(false);
    const [action, setAction] = useState<"codes" | "disable" | null>(null);

    return (
        <Section title="Two-step verification" description="Sign in with your password and a code from an authenticator app.">
            {status.isPending ? (
                <ListSkeleton rows={3} />
            ) : status.error ? (
                <ErrorState error={status.error} onRetry={() => status.refetch()} />
            ) : (
                <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                    {status.data.required && (
                        <Alert>
                            <AlertDescription className="text-[13px]">
                                Your organization requires two-step verification ({getDropdownOptionLabel(MfaRequiredReasonOptions, status.data.required_reason ?? "ALL").toLowerCase()}).
                                {status.data.enabled ? " It cannot be turned off." : " Set it up to keep working."}
                            </AlertDescription>
                        </Alert>
                    )}
                    {status.data.enabled ? (
                        <>
                            <div className="flex flex-wrap items-start gap-3">
                                <div className="grid size-9 flex-none place-items-center rounded-lg bg-success-soft text-success"><ShieldCheck className="size-4" /></div>
                                <div className="min-w-0 flex-1 space-y-0.5 text-[13px]">
                                    <div className="flex flex-wrap items-center gap-2 font-medium text-foreground">Authenticator app <Badge variant="success">On</Badge></div>
                                    <div className="text-muted-foreground">
                                        Added {formatDateTime(status.data.totp?.verified_at)}{status.data.totp?.last_used_at ? ` · last used ${formatRelative(status.data.totp.last_used_at)}` : ""}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-start gap-3 border-t border-border pt-4">
                                <div className="grid size-9 flex-none place-items-center rounded-lg bg-secondary text-muted-foreground"><KeyRound className="size-4" /></div>
                                <div className="min-w-0 flex-1 space-y-0.5 text-[13px]">
                                    <div className="font-medium text-foreground">Recovery codes</div>
                                    <div className={status.data.recovery_codes.remaining <= 2 ? "text-danger" : "text-muted-foreground"}>
                                        {status.data.recovery_codes.remaining} of {status.data.recovery_codes.total} left. Each one signs you in once without your phone.
                                    </div>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => setAction("codes")}>New codes</Button>
                            </div>
                            {!status.data.required && (
                                <div className="flex justify-end border-t border-border pt-4">
                                    <Button size="sm" variant="ghost" className="text-danger" onClick={() => setAction("disable")}><ShieldOff /> Turn off</Button>
                                </div>
                            )}
                        </>
                    ) : enrolling ? (
                        <MfaEnrollment onDone={() => { setEnrolling(false); toast({ title: "Two-step verification is on" }); }} onCancel={() => setEnrolling(false)} />
                    ) : (
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="grid size-9 flex-none place-items-center rounded-lg bg-warning-soft text-warning"><ShieldOff className="size-4" /></div>
                            <div className="min-w-0 flex-1 text-[13px]">
                                <div className="font-medium text-foreground">Off</div>
                                <div className="text-muted-foreground">Anyone with your password can sign in as you.</div>
                            </div>
                            <Button onClick={() => setEnrolling(true)}><ShieldCheck /> Turn on</Button>
                        </div>
                    )}
                </div>
            )}
            <FactorDialog mode={action} onClose={() => setAction(null)} />
        </Section>
    );
}

/** Regenerate recovery codes or turn MFA off: both need a current code (or a recovery code). */
function FactorDialog({ mode, onClose }: { mode: "codes" | "disable" | null; onClose: () => void }) {
    const regenerate = useRegenerateRecoveryCodes();
    const disable = useDisableMfa();
    const [useRecovery, setUseRecovery] = useState(false);
    const [value, setValue] = useState("");
    const [codes, setCodes] = useState<string[] | null>(null);
    const pending = regenerate.isPending || disable.isPending;
    const error = mode === "codes" ? regenerate.error : disable.error;

    const close = () => {
        if (pending) return;
        setValue("");
        setUseRecovery(false);
        setCodes(null);
        regenerate.reset();
        disable.reset();
        onClose();
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const dto: MfaFactorDto = useRecovery ? { recovery_code: value.trim() } : { code: value };
        if (mode === "codes") regenerate.mutate(dto, { onSuccess: (r) => setCodes(r.recovery_codes), onError: () => setValue("") });
        else disable.mutate(dto, { onSuccess: () => { toast({ title: "Two-step verification is off" }); close(); }, onError: () => setValue("") });
    };

    const valid = useRecovery ? value.trim().length >= 10 : value.length === 6;

    return (
        <Dialog open={!!mode} onOpenChange={(o) => !o && close()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{mode === "codes" ? "New recovery codes" : "Turn off two-step verification?"}</DialogTitle>
                    <DialogDescription>
                        {codes ? "Your old codes no longer work. Save these now; they are not shown again." : mode === "codes" ? "Your current codes stop working. Confirm with a code from your app." : "Anyone with your password could sign in as you. Confirm with a code from your app."}
                    </DialogDescription>
                </DialogHeader>
                {codes ? (
                    <>
                        <RecoveryCodesList codes={codes} />
                        <DialogFooter><Button onClick={close}>Done</Button></DialogFooter>
                    </>
                ) : (
                    <form onSubmit={submit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="mfa-factor">{useRecovery ? "Recovery code" : "Authenticator code"}</Label>
                            <Input
                                id="mfa-factor"
                                autoFocus
                                autoComplete="one-time-code"
                                inputMode={useRecovery ? "text" : "numeric"}
                                placeholder={useRecovery ? "abcde-fghjk" : "123456"}
                                className="font-mono tracking-widest"
                                value={value}
                                onChange={(e) => setValue(useRecovery ? e.target.value.slice(0, 24) : cleanTotp(e.target.value))}
                            />
                            {error && <p className="text-xs text-danger">{getApiErrorMessage(error)}</p>}
                            <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => { setUseRecovery((v) => !v); setValue(""); }}>
                                {useRecovery ? "Use an authenticator code" : "Use a recovery code instead"}
                            </Button>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={close} disabled={pending}>Cancel</Button>
                            <Button type="submit" variant={mode === "disable" ? "destructive" : "default"} disabled={!valid} loading={pending}>
                                {mode === "codes" ? "Create new codes" : "Turn off"}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
