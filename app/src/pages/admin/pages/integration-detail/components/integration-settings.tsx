import { useEffect, useState } from "react";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "@/components/ui/save-status";
import { Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useReplaceSecrets, useUpdateIntegration } from "@/features/admin/integrations/hooks/use-integrations";
import type { IntegrationDetail, IntegrationProviderSpec } from "@/features/admin/integrations/interfaces/integrations.interfaces";
import { toast } from "@/hooks/use-toast";

const ALL = "__all";

/** Replace secrets (write-only, shows hints) and edit the non-secret configuration. */
export function IntegrationSettings({ row, spec, canManage }: { row: IntegrationDetail; spec: IntegrationProviderSpec | undefined; canManage: boolean }) {
    const session = useSessionData();
    const update = useUpdateIntegration();
    const replace = useReplaceSecrets();
    const [secrets, setSecrets] = useState<Record<string, string>>({});
    const [name, setName] = useState(row.name);
    const [config, setConfig] = useState<Record<string, string>>(row.config ?? {});
    const [branch, setBranch] = useState(row.branch_id ?? ALL);
    const disconnected = row.status === "DISCONNECTED";

    // Loaded once per integration; afterwards the fields are the source of truth (refreshes never overwrite typing).
    useEffect(() => {
        setName(row.name);
        setConfig(row.config ?? {});
        setBranch(row.branch_id ?? ALL);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [row.id]);

    /** Settings autosave (no Save button); a refusal shows in <SaveStatus /> with Retry. */
    const autosave = useAutosave({
        value: { name: name.trim(), config, branch },
        enabled: canManage && !disconnected && name.trim().length >= 2,
        save: (v) => update.mutateAsync({ id: row.id, name: v.name, config: v.config, branch_id: v.branch === ALL ? null : v.branch }),
    });
    const saveSettings = (e: React.FormEvent) => { e.preventDefault(); autosave.flush(); };
    const saveSecrets = (e: React.FormEvent) => {
        e.preventDefault();
        replace.mutate({ id: row.id, secrets }, {
            // Replacing is an explicit action (new credentials are verified); the new hint shows in the label. Only a failed check is toasted.
            onSuccess: (r) => { setSecrets({}); if (r.status === "ERROR") toast({ variant: "destructive", title: "Key replaced, but verification failed", description: r.last_error ?? undefined }); },
        });
    };

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Credentials" description="Stored encrypted. Only a short hint is ever shown.">
                <form onSubmit={saveSecrets} className="space-y-3 rounded-lg border border-border bg-card p-4">
                    {spec?.secrets.map((f) => (
                        <div key={f.key} className="space-y-1.5">
                            <Label htmlFor={`s-${f.key}`} className="flex items-center justify-between gap-2">
                                <span>{f.label}</span>
                                <code className="text-xs font-normal text-muted-foreground">{row.secret_hints?.[f.key] ?? "not set"}</code>
                            </Label>
                            <PasswordInput id={`s-${f.key}`} autoComplete="off" disabled={!canManage || disconnected} placeholder="Enter a new value to replace it" value={secrets[f.key] ?? ""} onChange={(e) => setSecrets((s) => ({ ...s, [f.key]: e.target.value }))} />
                        </div>
                    ))}
                    {canManage && !disconnected && (
                        <div className="flex justify-end">
                            <Button type="submit" loading={replace.isPending} disabled={!Object.values(secrets).some((v) => v.trim())}>Replace & verify</Button>
                        </div>
                    )}
                </form>
            </Section>
            <Section title="Settings" actions={<SaveStatus state={autosave} />}>
                <form onSubmit={saveSettings} className="space-y-3 rounded-lg border border-border bg-card p-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="i-name">Name</Label>
                        <Input id="i-name" value={name} disabled={!canManage} onChange={(e) => setName(e.target.value)} maxLength={80} />
                    </div>
                    {spec?.config.map((f) => (
                        <div key={f.key} className="space-y-1.5">
                            <Label htmlFor={`c-${f.key}`}>{f.label}{!f.required && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}</Label>
                            <Input id={`c-${f.key}`} disabled={!canManage} placeholder={f.placeholder} value={config[f.key] ?? ""} onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))} />
                        </div>
                    ))}
                    <div className="space-y-1.5">
                        <Label>Used by</Label>
                        <Select value={branch} onValueChange={setBranch} disabled={!canManage}>
                            <SelectTrigger aria-label="Branch restriction"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>Whole organization</SelectItem>
                                {session?.branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} only</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </form>
            </Section>
        </div>
    );
}
