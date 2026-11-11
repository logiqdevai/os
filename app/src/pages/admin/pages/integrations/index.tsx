import { useState } from "react";
import { Link } from "react-router-dom";
import { Plug, Star } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermission } from "@/hooks/use-permission";
import { useIntegrationProviders, useIntegrations } from "@/features/admin/integrations/hooks/use-integrations";
import type { IntegrationProviderSpec } from "@/features/admin/integrations/interfaces/integrations.interfaces";
import { IntegrationCategoryFilterOptions, IntegrationCategoryFormOptions } from "@/config/constants/dropdowns/admin/developer-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatRelative } from "@/lib/format";
import { IntegrationStatusBadge } from "../../components/status-badges";
import { ConnectIntegrationDialog } from "./components/connect-integration-dialog";

/**
 * Integrations — /admin/integrations?category=
 * @perm VIEW organizations.integrations.read · connect / manage organizations.integrations.manage
 * @api GET /integrations · GET /integrations/providers · POST /integrations
 */
export default function IntegrationsPage() {
    const [category, setCategory] = useState("all");
    const providers = useIntegrationProviders();
    const connections = useIntegrations({ limit: 100, ...(category !== "all" && { category }) });
    const canManage = usePermission("organizations.integrations.manage");
    const [connecting, setConnecting] = useState<IntegrationProviderSpec | null>(null);
    const rows = connections.data?.data ?? [];

    return (
        <Page width="wide">
            <PageHeader title="Integrations" description="Connect your own OpenAI, Resend, Twilio, Stripe or Viva Wallet accounts. Every module uses the default connection of its category." />
            <div className="space-y-6">
                <Section
                    title="Connected"
                    actions={
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger className="h-8 w-40" aria-label="Filter by category"><SelectValue /></SelectTrigger>
                            <SelectContent>{IntegrationCategoryFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                    }
                >
                    <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                        {connections.isPending && <ListSkeleton rows={3} />}
                        {connections.error && <ErrorState error={connections.error} onRetry={() => connections.refetch()} />}
                        {connections.data && rows.length === 0 && <EmptyState compact icon={Plug} title="Nothing connected yet" description="Connect a provider below." />}
                        {rows.map((c) => (
                            <Link key={c.id} to={`/admin/integrations/${c.id}`} className="flex flex-col gap-2 px-4 py-3 hover:bg-border-soft sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium text-foreground">{c.name}</span>
                                        <Badge>{getDropdownOptionLabel(IntegrationCategoryFormOptions, c.category)}</Badge>
                                        {c.is_default && <Badge variant="violet"><Star className="size-3" /> Default</Badge>}
                                        {c.mode === "TEST" && <Badge variant="warning">Test</Badge>}
                                        {c.credential_source === "PLATFORM" && <Badge variant="info">Provided by Logiqdev</Badge>}
                                    </div>
                                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                                        {Object.values(c.secret_hints ?? {}).join(" · ") || "No key stored"}{c.branch ? ` · ${c.branch.name} only` : ""} · verified {c.last_verified_at ? formatRelative(c.last_verified_at) : "never"}
                                    </div>
                                    {c.status === "ERROR" && c.last_error && <div className="mt-0.5 truncate text-xs text-danger">{c.last_error}</div>}
                                </div>
                                <IntegrationStatusBadge status={c.status} />
                            </Link>
                        ))}
                    </div>
                </Section>

                <Section title="Available providers">
                    {providers.isPending && <ListSkeleton rows={2} />}
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {providers.data?.map((p) => {
                            const count = rows.filter((r) => r.provider === p.provider).length;
                            return (
                                <div key={p.provider} className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-card p-4">
                                    <div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-medium text-foreground">{p.label}</span>
                                            <Badge>{getDropdownOptionLabel(IntegrationCategoryFormOptions, p.category)}</Badge>
                                        </div>
                                        <p className="mt-1 text-[13px] text-muted-foreground">{p.description}</p>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-muted-foreground">{count ? `${count} connected` : "Not connected"}</span>
                                        {canManage && <Button size="sm" variant={count ? "outline" : "default"} onClick={() => setConnecting(p)}>{count ? "Add another" : "Connect"}</Button>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Section>
            </div>
            <ConnectIntegrationDialog spec={connecting} onClose={() => setConnecting(null)} />
        </Page>
    );
}
