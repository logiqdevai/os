import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateIntegration } from "@/features/admin/integrations/hooks/use-integrations";
import type { IntegrationMode, IntegrationProviderSpec } from "@/features/admin/integrations/interfaces/integrations.interfaces";
import { IntegrationCategoryFormOptions, IntegrationModeFormOptions } from "@/config/constants/dropdowns/admin/developer-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";

/**
 * Connect a provider with the organization's own credentials. Fields come from the provider registry
 * (api/src/shared/constants/integration-providers.ts). Secrets are write-only.
 */
export function ConnectIntegrationDialog({ spec, onClose }: { spec: IntegrationProviderSpec | null; onClose: () => void }) {
    const navigate = useNavigate();
    const create = useCreateIntegration();
    const [name, setName] = useState("");
    const [mode, setMode] = useState<IntegrationMode>("LIVE");
    const [values, setValues] = useState<Record<string, string>>({});
    const [makeDefault, setMakeDefault] = useState(true);

    useEffect(() => {
        if (spec) { setName(spec.label); setMode("LIVE"); setValues({}); setMakeDefault(true); }
    }, [spec]);

    const missing = useMemo(() => (spec ? [...spec.secrets, ...spec.config].filter((f) => f.required && !values[f.key]?.trim()).map((f) => f.label) : []), [spec, values]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!spec || missing.length || name.trim().length < 2) return;
        const pick = (keys: string[]) => Object.fromEntries(keys.filter((k) => values[k]?.trim()).map((k) => [k, values[k].trim()]));
        create.mutate(
            { provider: spec.provider, name: name.trim(), mode, secrets: pick(spec.secrets.map((f) => f.key)), config: pick(spec.config.map((f) => f.key)), make_default: makeDefault },
            {
                onSuccess: (row) => {
                    toast(row.status === "ACTIVE" ? { title: `${spec.label} connected`, description: "The credentials were verified." } : row.status === "ERROR" ? { variant: "destructive", title: "Saved, but verification failed", description: row.last_error ?? undefined } : { title: `${spec.label} saved`, description: "It could not be verified automatically." });
                    onClose();
                    navigate(`/admin/integrations/${row.id}`);
                },
                onError: (err) => toast({ variant: "destructive", title: "Could not connect", description: getApiErrorMessage(err) }),
            }
        );
    };

    const field = (f: IntegrationProviderSpec["secrets"][number], secret: boolean) => (
        <div key={f.key} className="space-y-1.5">
            <Label htmlFor={`f-${f.key}`}>{f.label}{!f.required && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}</Label>
            {secret ? (
                <PasswordInput id={`f-${f.key}`} autoComplete="off" placeholder={f.placeholder} value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
            ) : (
                <Input id={`f-${f.key}`} placeholder={f.placeholder} value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
            )}
            {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
        </div>
    );

    return (
        <Dialog open={!!spec} onOpenChange={(o) => !o && !create.isPending && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                {spec && (
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Connect {spec.label}</DialogTitle>
                            <DialogDescription>
                                {spec.description} Your keys are encrypted and never shown again — only a short hint.
                                {spec.docsUrl && <a href={spec.docsUrl} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-foreground underline-offset-4 hover:underline">Get a key <ExternalLink className="size-3" /></a>}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                            <div className="space-y-1.5">
                                <Label htmlFor="int-name">Name</Label>
                                <Input id="int-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
                            </div>
                            {spec.hasTestMode && (
                                <div className="space-y-1.5">
                                    <Label>Mode</Label>
                                    <Select value={mode} onValueChange={(v) => setMode(v as IntegrationMode)}>
                                        <SelectTrigger aria-label="Mode"><SelectValue /></SelectTrigger>
                                        <SelectContent>{IntegrationModeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                        <div className="space-y-3 rounded-md border border-border p-3">
                            <div className="text-xs font-medium text-muted-foreground">Secrets</div>
                            {spec.secrets.map((f) => field(f, true))}
                        </div>
                        {spec.config.length > 0 && <div className="space-y-3">{spec.config.map((f) => field(f, false))}</div>}
                        <label className="flex items-center justify-between gap-3 text-[13px] text-foreground">
                            Use as the default {getDropdownOptionLabel(IntegrationCategoryFormOptions, spec.category)} connection
                            <Switch checked={makeDefault} onCheckedChange={setMakeDefault} aria-label="Make default" />
                        </label>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={onClose} disabled={create.isPending}>Cancel</Button>
                            <Button type="submit" loading={create.isPending} disabled={missing.length > 0 || name.trim().length < 2}>Connect & verify</Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
