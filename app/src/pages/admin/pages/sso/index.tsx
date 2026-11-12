import { useState } from "react";
import { Link } from "react-router-dom";
import { Info, KeySquare, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Page, PageHeader, KeyValueList } from "@/components/ui/page";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useDeleteGroupMapping, useDeleteSsoConfiguration, useSsoConfigurations, useUpdateSsoSettings } from "@/features/admin/sso/hooks/use-sso";
import type { SsoConfiguration, SsoGroupMapping } from "@/features/admin/sso/interfaces/sso.interfaces";
import { SsoProtocolFormOptions, SsoStatusOptions } from "@/config/constants/dropdowns/admin/sso-form.options";
import { ModuleKeyOptions } from "@/config/constants/dropdowns/admin/module-key.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { CopyField } from "../../components/copy-field";
import { ProviderDialog } from "./components/provider-dialog";
import { MappingDialog } from "./components/mapping-dialog";

/**
 * Single sign-on — /admin/sso   (mockup 01-admin `sso`, spec §68–71)
 * @perm VIEW + every action organizations.sso.manage (domains live on /admin/domains with organizations.domains.manage)
 * @api GET/POST /sso-configurations · PATCH/DELETE /sso-configurations/:id · POST/PATCH/DELETE /sso-configurations/:id/group-mappings[/:mappingId]
 * @states loading · not configured (empty) · error · no-access. The SSO sign-in handshake is not built yet: providers show
 *         "Configured · not tested" and cannot be enabled, so nobody can be locked out.
 */
export default function SsoPage() {
    const providers = useSsoConfigurations();
    const [providerDialog, setProviderDialog] = useState<{ open: boolean; provider: SsoConfiguration | null }>({ open: false, provider: null });
    const [deleting, setDeleting] = useState<SsoConfiguration | null>(null);
    const remove = useDeleteSsoConfiguration();

    if (providers.isPending) return <PageSkeleton />;

    const list = providers.data?.data ?? [];
    return (
        <Page width="wide">
            <PageHeader
                title="Single sign-on"
                description="Identity provider settings and group mappings. Verify a domain first on the Domains page."
                actions={<Button onClick={() => setProviderDialog({ open: true, provider: null })}><Plus /> Add provider</Button>}
            />
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-info-soft p-3 text-[13px] text-info">
                <Info className="mt-0.5 size-4 flex-none" />
                <span>
                    SSO sign-in is not switched on yet. You can store and review your provider settings now; members keep signing in with their password until SSO sign-in is released and a test sign-in succeeds. <Link className="underline" to="/admin/domains">Manage domains</Link>
                </span>
            </div>
            {providers.error ? (
                <ErrorState error={providers.error} onRetry={() => providers.refetch()} />
            ) : list.length === 0 ? (
                <div className="rounded-lg border border-border bg-card">
                    <EmptyState icon={KeySquare} title="No identity provider yet" description="Add your SAML or OpenID Connect provider to prepare single sign-on." action={<Button size="sm" onClick={() => setProviderDialog({ open: true, provider: null })}><Plus /> Add provider</Button>} />
                </div>
            ) : (
                <div className="space-y-6">
                    {list.map((p) => (
                        <ProviderCard key={p.id} provider={p} onEdit={() => setProviderDialog({ open: true, provider: p })} onDelete={() => setDeleting(p)} />
                    ))}
                </div>
            )}
            <ProviderDialog open={providerDialog.open} provider={providerDialog.provider} onOpenChange={(open) => setProviderDialog((s) => ({ ...s, open }))} />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete ${deleting?.name}?`}
                description="The provider settings, the encrypted secret and all group mappings are removed."
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => { if (deleting) remove.mutate(deleting.id); setDeleting(null); }}
            />
        </Page>
    );
}

function ProviderCard({ provider: p, onEdit, onDelete }: { provider: SsoConfiguration; onEdit: () => void; onDelete: () => void }) {
    const settings = useUpdateSsoSettings();
    const removeMapping = useDeleteGroupMapping();
    const [mappingDialog, setMappingDialog] = useState<{ open: boolean; mapping: SsoGroupMapping | null }>({ open: false, mapping: null });
    const c = p.config;
    const items =
        p.protocol === "SAML"
            ? [
                { label: "IdP entity ID", value: c.idp_entity_id && <code className="font-mono text-xs">{c.idp_entity_id}</code> },
                { label: "Sign-in URL", value: c.sso_url },
                { label: "Certificate", value: c.certificate ? "Stored (PEM)" : null },
                { label: "Metadata URL", value: c.metadata_url },
            ]
            : [
                { label: "Issuer", value: c.issuer },
                { label: "Client ID", value: c.client_id && <code className="font-mono text-xs">{c.client_id}</code> },
                { label: "Client secret", value: p.secret_hints.client_secret ? <code className="font-mono text-xs">{p.secret_hints.client_secret}</code> : <span className="text-danger">Missing</span> },
                { label: "Discovery URL", value: c.discovery_url },
            ];

    return (
        <section className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-border-soft px-4 py-3">
                <h2 className="mr-auto min-w-0 truncate text-[15px] font-medium text-foreground">{p.name}</h2>
                <Badge variant="info">{getDropdownOptionLabel(SsoProtocolFormOptions, p.protocol)}</Badge>
                <Badge variant={p.status === "configured" ? "warning" : "danger"} dot>{getDropdownOptionLabel(SsoStatusOptions, p.status)}</Badge>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={onEdit}><Pencil /> Edit settings</DropdownMenuItem>
                        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={onDelete}><Trash2 /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="grid gap-6 p-4 lg:grid-cols-2">
                <div className="space-y-4">
                    <KeyValueList items={items} />
                    <div className="space-y-1.5">
                        <div className="text-xs text-muted-foreground">Service provider entity ID (give this to your identity provider)</div>
                        <CopyField value={p.service_provider.entity_id} label="entity ID" />
                    </div>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="text-[13px] font-medium text-foreground">Auto-provision members</div>
                            <div className="text-xs text-muted-foreground">Create a membership on first SSO sign-in, using the mappings.</div>
                        </div>
                        <Switch
                            aria-label="Auto-provision members"
                            checked={p.auto_provision}
                            disabled={settings.isPending}
                            onCheckedChange={(v) => settings.mutate({ id: p.id, auto_provision: v })}
                        />
                    </div>
                </div>
                <div className="min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-[13px] font-medium text-foreground">Group mappings</h3>
                        <Button size="sm" variant="outline" onClick={() => setMappingDialog({ open: true, mapping: null })}><Plus /> Add mapping</Button>
                    </div>
                    {p.group_mappings.length === 0 ? (
                        <EmptyState compact title="No mappings" description="Map identity-provider groups to a role, team, branch and modules." />
                    ) : (
                        <div className="overflow-x-auto rounded-md border border-border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Group</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead className="hidden sm:table-cell">Team · branch</TableHead>
                                        <TableHead className="hidden md:table-cell">Modules</TableHead>
                                        <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {p.group_mappings.map((m) => (
                                        <TableRow key={m.id}>
                                            <TableCell className="font-mono text-xs">{m.external_group}</TableCell>
                                            <TableCell>{m.role?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                                            <TableCell className="hidden sm:table-cell">{[m.team?.name, m.branch?.name].filter(Boolean).join(" · ") || <span className="text-muted-foreground">—</span>}</TableCell>
                                            <TableCell className="hidden md:table-cell" title={m.modules.map((k) => getDropdownOptionLabel(ModuleKeyOptions, k)).join(", ")}>{m.modules.length || <span className="text-muted-foreground">—</span>}</TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.external_group}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onSelect={() => setMappingDialog({ open: true, mapping: m })}><Pencil /> Edit</DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-danger focus:text-danger"
                                                            onSelect={() => removeMapping.mutate({ configId: p.id, mappingId: m.id })}
                                                        >
                                                            <Trash2 /> Remove
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </div>
            <MappingDialog open={mappingDialog.open} mapping={mappingDialog.mapping} configId={p.id} onOpenChange={(open) => setMappingDialog((s) => ({ ...s, open }))} />
        </section>
    );
}
