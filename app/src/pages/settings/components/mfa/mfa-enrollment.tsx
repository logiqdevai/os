import { useState, type FormEvent } from "react";
import { Check, Copy, Download, KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { QrCode } from "@/components/ui/qr-code";
import { CopyField } from "@/pages/admin/components/copy-field";
import { useConfirmTotpSetup, useStartTotpSetup } from "@/features/session/hooks/use-session";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/hooks/use-toast";

/** Six digits, spaces allowed while typing. */
export const cleanTotp = (v: string) => v.replace(/\D/g, "").slice(0, 6);

/**
 * Authenticator enrolment (01 §74): start → scan the QR code (or type the key) → confirm with a code → save the
 * recovery codes. Used in Settings → Security and on the forced /mfa-setup screen.
 * @api POST /auth/mfa/totp/setup · POST /auth/mfa/totp/confirm (audited as user.mfa_enabled)
 */
export function MfaEnrollment({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
    const start = useStartTotpSetup();
    const confirm = useConfirmTotpSetup();
    const [code, setCode] = useState("");
    const [codes, setCodes] = useState<string[] | null>(null);
    const [showKey, setShowKey] = useState(false);

    if (codes) return <RecoveryCodesStep codes={codes} onDone={onDone} />;

    if (!start.data) {
        return (
            <div className="space-y-4">
                <div className="flex gap-3">
                    <div className="grid size-9 flex-none place-items-center rounded-lg bg-info-soft text-info"><Smartphone className="size-4" /></div>
                    <div className="space-y-1 text-[13px]">
                        <p className="font-medium text-foreground">Use an authenticator app</p>
                        <p className="text-muted-foreground">Google Authenticator, Microsoft Authenticator, 1Password, Authy or any app that supports time-based codes. You will enter a 6-digit code from it each time you sign in.</p>
                    </div>
                </div>
                {start.isError && <Alert variant="destructive"><AlertDescription>{getApiErrorMessage(start.error)}</AlertDescription></Alert>}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
                    <Button loading={start.isPending} onClick={() => start.mutate()}><ShieldCheck /> Set up authenticator</Button>
                </div>
            </div>
        );
    }

    const setup = start.data;
    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (code.length !== 6) return;
        confirm.mutate(code, {
            onSuccess: (res) => setCodes(res.recovery_codes),
            onError: () => setCode(""),
        });
    };

    return (
        <form onSubmit={submit} className="space-y-5">
            <ol className="space-y-5 text-[13px]">
                <li className="space-y-3">
                    <p className="font-medium text-foreground">1. Scan this code with your authenticator app</p>
                    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                        <div className="rounded-lg border border-border p-2">
                            <QrCode value={setup.otpauth_uri} label={`QR code for ${setup.issuer} (${setup.account})`} />
                        </div>
                        <div className="w-full min-w-0 space-y-2 text-muted-foreground">
                            <p>Account: <span className="text-foreground">{setup.account}</span></p>
                            {showKey ? (
                                <div className="space-y-1">
                                    <p>Enter this key in the app (time-based, 6 digits):</p>
                                    <CopyField value={setup.secret.replace(/(.{4})/g, "$1 ").trim()} label="setup key" />
                                </div>
                            ) : (
                                <Button type="button" variant="link" className="h-auto p-0 text-[13px]" onClick={() => setShowKey(true)}>Can’t scan? Enter a key instead</Button>
                            )}
                        </div>
                    </div>
                </li>
                <li className="space-y-2">
                    <Label htmlFor="mfa-confirm-code" className="font-medium text-foreground">2. Enter the 6-digit code the app shows</Label>
                    <Input
                        id="mfa-confirm-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
                        placeholder="123456"
                        className="max-w-[12rem] font-mono text-base tracking-[0.3em]"
                        value={code}
                        onChange={(e) => setCode(cleanTotp(e.target.value))}
                        aria-invalid={confirm.isError || undefined}
                    />
                    {confirm.isError && <p className="text-xs text-danger">{getApiErrorMessage(confirm.error)}</p>}
                </li>
            </ol>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {onCancel && <Button type="button" variant="ghost" onClick={onCancel} disabled={confirm.isPending}>Cancel</Button>}
                <Button type="submit" disabled={code.length !== 6} loading={confirm.isPending}><Check /> Verify and turn on</Button>
            </div>
        </form>
    );
}

function RecoveryCodesStep({ codes, onDone }: { codes: string[]; onDone: () => void }) {
    const [saved, setSaved] = useState(false);
    return (
        <div className="space-y-4">
            <Alert>
                <AlertDescription className="text-[13px]">Two-step verification is on. Save these recovery codes now: each one signs you in once if you lose your phone. They are not shown again.</AlertDescription>
            </Alert>
            <RecoveryCodesList codes={codes} />
            <div className="flex items-center gap-2">
                <Checkbox id="mfa-codes-saved" checked={saved} onCheckedChange={(v) => setSaved(v === true)} />
                <Label htmlFor="mfa-codes-saved" className="text-[13px] font-normal">I saved my recovery codes somewhere safe</Label>
            </div>
            <div className="flex justify-end">
                <Button disabled={!saved} onClick={onDone}>Done</Button>
            </div>
        </div>
    );
}

/** The plain codes (shown once) with copy and download. */
export function RecoveryCodesList({ codes }: { codes: string[] }) {
    const text = codes.join("\n");
    const [copied, setCopied] = useState(false);
    const copy = () => navigator.clipboard.writeText(text).then(
        () => { setCopied(true); setTimeout(() => setCopied(false), 1500); },
        () => toast({ variant: "destructive", title: "Could not copy", description: "Select the codes and copy them manually." })
    );
    const download = () => {
        const url = URL.createObjectURL(new Blob([`Logiqdev OS recovery codes\nEach code works once.\n\n${text}\n`], { type: "text/plain" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = "logiqdev-recovery-codes.txt";
        a.click();
        URL.revokeObjectURL(url);
    };
    return (
        <div className="space-y-2">
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border border-border bg-secondary p-3 font-mono text-[13px] text-foreground" aria-label="Recovery codes">
                {codes.map((c) => <li key={c} className="select-all"><KeyRound className="mr-1.5 inline size-3 text-muted-foreground" aria-hidden />{c}</li>)}
            </ul>
            <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={copy}>{copied ? <><Check className="text-success" /> Copied</> : <><Copy /> Copy</>}</Button>
                <Button type="button" size="sm" variant="outline" onClick={download}><Download /> Download</Button>
            </div>
        </div>
    );
}
