import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, CircleAlert, Pause, Play, RefreshCw, Star, Unplug } from "lucide-react";
import { KeyValueList, Page, PageHeader, Section } from "@/components/ui/page";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermission } from "@/hooks/use-permission";
import { useDisconnectIntegration, useIntegration, useIntegrationProviders, useSetDefaultIntegration, useSetIntegrationEnabled, useVerifyIntegration } from "@/features/admin/integrations/hooks/use-integrations";
import { IntegrationCategoryFormOptions, IntegrationModeFormOptions } from "@/config/constants/dropdowns/admin/developer-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { IntegrationStatusBadge } from "../../components/status-badges";
import { CopyField } from "../../components/copy-field";
import { IntegrationSettings } from "./components/integration-settings";

/**
 * Integration detail — /admin/integrations/:id
 * @perm VIEW organizations.integrations.read · everything else organizations.integrations.manage
 * @api GET /integrations/:id · PATCH · PUT /secrets · POST /verify|default|enable|disable · DELETE (disconnect)
 */
export default function IntegrationDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const row = useIntegration(id);
    const providers = useIntegrationProviders();
    const canManage = usePermission("organizations.integrations.manage");
    const verify = useVerifyIntegration();
    const setDefault = useSetDefaultIntegration();
    const setEnabled = useSetIntegrationEnabled();
    const disconnect = useDisconnectIntegration();
    const [disconnecting, setDisconnecting] = useState(false);
    /** Result of the last Test, shown on the button for a few seconds (no success toast). */
    const [tested, setTested] = useState<"ok" | "manual" | null>(null);
    const test = (id: string) =>
        verify.mutate(id, {
            onSuccess: (r) => {
                if (!r.verification?.ok) return void toast({ variant: "destructive", title: "Verification failed", description: r.verification?.error ?? undefined });
                setTested(r.verification.automatic ? "ok" : "manual");
                setTimeout(() => setTested(null), 3000);
            },
        });

    if (row.isPending) return <PageSkeleton />;
    if (row.error) return <Page><PageHeader title="Integration" back={{ to: "/admin/integrations", label: "Integrations" }} /><ErrorState error={row.error} onRetry={() => row.refetch()} /></Page>;
    const c = row.data;
    const spec = providers.data?.find((p) => p.provider === c.provider);
    const disconnected = c.status === "DISCONNECTED";
    const capabilities = Object.entries(c.capabilities ?? {}).filter(([, v]) => v !== null && v !== undefined);

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: "/admin/integrations", label: "Integrations" }}
                title={c.name}
                meta={<><IntegrationStatusBadge status={c.status} />{c.is_default && <Badge variant="violet"><Star className="size-3" /> Default</Badge>}</>}
                description={`${spec?.label ?? c.provider} · ${getDropdownOptionLabel(IntegrationCategoryFormOptions, c.category)} · ${getDropdownOptionLabel(IntegrationModeFormOptions, c.mode)}`}
                actions={canManage && !disconnected && (
                    <>
                        <Button variant="outline" loading={verify.isPending} onClick={() => test(c.id)} title={tested === "manual" ? "This provider cannot be tested automatically" : undefined}>
                            {tested ? <><Check className="text-success" /> {tested === "ok" ? "Credentials work" : "Saved"}</> : <><RefreshCw /> Test</>}
                        </Button>
                        {!c.is_default && c.status !== "DISABLED" && <Button variant="outline" onClick={() => setDefault.mutate(c.id)}><Star /> Make default</Button>}
                        {c.status === "DISABLED"
                            ? <Button variant="outline" onClick={() => setEnabled.mutate({ id: c.id, enabled: true })}><Play /> Enable</Button>
                            : <Button variant="outline" onClick={() => setEnabled.mutate({ id: c.id, enabled: false })}><Pause /> Disable</Button>}
                        <Button variant="destructive" onClick={() => setDisconnecting(true)}><Unplug /> Disconnect</Button>
                    </>
                )}
            />
            {c.status === "ERROR" && c.last_error && <Alert className="mb-4 border-danger/40"><CircleAlert className="size-4 text-danger" /><AlertDescription>{c.last_error} <span className="text-muted-foreground">({formatDateTime(c.last_error_at)})</span></AlertDescription></Alert>}
            {disconnected && <Alert className="mb-4"><Unplug className="size-4" /><AlertDescription>Disconnected on {formatDate(c.disconnected_at)}. The key was destroyed. Connect {spec?.label ?? "the provider"} again with the same name to reuse this entry.</AlertDescription></Alert>}

            <div className="space-y-6">
                <IntegrationSettings row={c} spec={spec} canManage={canManage} />
                <div className="grid gap-6 lg:grid-cols-2">
                    <Section title="Status">
                        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                            <KeyValueList items={[
                                { label: "Last verified", value: c.last_verified_at ? formatDateTime(c.last_verified_at) : "Never" },
                                { label: "Last used", value: c.last_used_at ? formatDateTime(c.last_used_at) : "Never" },
                                { label: "Key replaced", value: c.rotated_at ? formatDate(c.rotated_at) : null },
                                { label: "Connected by", value: c.created_by?.user.display_name ?? c.created_by?.user.email ?? null },
                                ...capabilities.slice(0, 4).map(([k, v]) => ({ label: k.replace(/_/g, " "), value: Array.isArray(v) ? `${v.length} item${v.length === 1 ? "" : "s"}` : String(v) })),
                            ]} />
                            {c.webhook_url && (
                                <div className="space-y-1.5">
                                    <div className="text-xs text-muted-foreground">Webhook URL (paste it in the {spec?.label ?? "provider"} dashboard)</div>
                                    <CopyField value={c.webhook_url} label="webhook URL" />
                                </div>
                            )}
                        </div>
                    </Section>
                    <Section title="Usage (30 days)">
                        <div className="overflow-hidden rounded-lg border border-border bg-card">
                            {c.usage.length === 0 ? (
                                <p className="p-4 text-[13px] text-muted-foreground">No usage recorded yet.</p>
                            ) : (
                                <div className="max-h-72 overflow-y-auto">
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Day</TableHead><TableHead className="text-right">Requests</TableHead><TableHead className="text-right">Failures</TableHead><TableHead className="text-right">Units</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {[...c.usage].reverse().map((u) => (
                                                <TableRow key={u.date}>
                                                    <TableCell className="text-[13px]">{formatDate(u.date)}</TableCell>
                                                    <TableCell className="text-right tabular">{formatNumber(u.requests)}</TableCell>
                                                    <TableCell className="text-right tabular">{formatNumber(u.failures)}</TableCell>
                                                    <TableCell className="text-right tabular">{formatNumber(u.units)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    </Section>
                </div>
            </div>
            <ConfirmationDialog
                isOpen={disconnecting}
                onClose={() => setDisconnecting(false)}
                title={`Disconnect ${c.name}?`}
                description="The stored key is destroyed. Features using this connection stop working until another one is connected."
                confirmText="Disconnect"
                variant="destructive"
                isLoading={disconnect.isPending}
                onConfirm={() => disconnect.mutate(c.id, { onSuccess: () => { setDisconnecting(false); navigate("/admin/integrations"); } })}
            />
        </Page>
    );
}
