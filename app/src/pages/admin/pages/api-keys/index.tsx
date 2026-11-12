import { useState } from "react";
import { Ban, KeyRound, MoreHorizontal, Plus, RefreshCw } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useListParams } from "@/hooks/use-list-params";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useApiKeys, useRevokeApiKey, useRotateApiKey } from "@/features/admin/api-keys/hooks/use-api-keys";
import type { ApiKey } from "@/features/admin/api-keys/interfaces/api-keys.interfaces";
import { ApiKeyStatusFilterOptions } from "@/config/constants/dropdowns/admin/developer-form.options";
import { formatDate, formatRelative, personName } from "@/lib/format";
import { SecretOnceDialog } from "../../components/secret-once-dialog";
import { ApiKeyFormDialog } from "./components/api-key-form-dialog";

const keyState = (k: ApiKey) => (k.revoked_at ? "revoked" : k.expires_at && new Date(k.expires_at) < new Date() ? "expired" : "active");

/**
 * API keys — /admin/api-keys?status=
 * @perm organizations.api_keys.manage (creating a service-account key also needs every permission it carries)
 * @api GET /api-keys · POST /api-keys (secret once) · POST /api-keys/:id/rotate · POST /api-keys/:id/revoke
 */
export default function ApiKeysPage() {
    const session = useSessionData();
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const keys = useApiKeys(params);
    const rotate = useRotateApiKey();
    const revoke = useRevokeApiKey();
    const [formOpen, setFormOpen] = useState(false);
    const [secret, setSecret] = useState<string | null>(null);
    const [action, setAction] = useState<{ kind: "rotate" | "revoke"; key: ApiKey } | null>(null);

    const run = () => {
        if (!action) return;
        // Rotating shows the new secret once, so it waits for the API; revoking is optimistic and closes at once.
        if (action.kind === "rotate") rotate.mutate(action.key.id, { onSuccess: (k) => { setAction(null); setSecret(k.secret); } });
        else { revoke.mutate(action.key.id); setAction(null); }
    };

    const columns: DataTableColumn<ApiKey>[] = [
        {
            key: "name",
            header: "Key",
            cell: (k) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{k.name}</div>
                    <code className="text-xs text-muted-foreground">{k.key_prefix}…</code>
                </div>
            ),
        },
        { key: "owner", header: "Acts as", hideBelow: "md", cell: (k) => (k.service_account ? <span><Badge variant="violet">Service account</Badge> {k.service_account.name}</span> : personName(k.membership?.user)) },
        { key: "scopes", header: "Scopes", hideBelow: "lg", cell: (k) => (k.scopes.length ? <span className="text-muted-foreground">{k.scopes.length} scope{k.scopes.length > 1 ? "s" : ""}</span> : <span className="text-muted-foreground">Full owner access</span>) },
        { key: "used", header: "Last used", hideBelow: "sm", cell: (k) => <span className="text-muted-foreground">{k.last_used_at ? formatRelative(k.last_used_at) : "Never"}</span> },
        { key: "expires", header: "Expires", hideBelow: "lg", cell: (k) => <span className="text-muted-foreground">{k.expires_at ? formatDate(k.expires_at) : "Never"}</span> },
        { key: "status", header: "Status", cell: (k) => { const s = keyState(k); return <Badge variant={s === "active" ? "success" : "neutral"} dot>{ApiKeyStatusFilterOptions.find((o) => o.id === s)?.label}</Badge>; } },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (k) =>
                !k.revoked_at && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${k.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {(k.service_account || k.membership?.id === session?.active_organization?.membership_id) && <DropdownMenuItem onSelect={() => setAction({ kind: "rotate", key: k })}><RefreshCw /> Rotate</DropdownMenuItem>}
                            <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setAction({ kind: "revoke", key: k })}><Ban /> Revoke</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="API keys"
                description="Keys for scripts, integrations and AI agents. Use them as Bearer tokens or in the X-Api-Key header, also for the MCP endpoint."
                actions={<Button onClick={() => setFormOpen(true)}><Plus /> New key</Button>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search name or prefix…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{ApiKeyStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={keys.data?.data}
                rowKey={(k) => k.id}
                loading={keys.isFetching}
                error={keys.error}
                onRetry={() => keys.refetch()}
                pagination={keys.data?.pagination}
                onPageChange={setPage}
                empty={{ icon: KeyRound, title: "No API keys", description: "Create a key to call the API or the MCP endpoint from scripts and agents.", action: <Button size="sm" onClick={() => setFormOpen(true)}><Plus /> New key</Button> }}
            />
            <ApiKeyFormDialog open={formOpen} onOpenChange={setFormOpen} onCreated={setSecret} />
            <SecretOnceDialog secret={secret} title="Your new API key" onClose={() => setSecret(null)} />
            <ConfirmationDialog
                isOpen={!!action}
                onClose={() => setAction(null)}
                title={action?.kind === "rotate" ? `Rotate ${action.key.name}?` : `Revoke ${action?.key.name}?`}
                description={action?.kind === "rotate" ? "A new secret is issued and the current one stops working immediately. Update every place that uses it." : "Anything using this key stops working immediately. This cannot be undone."}
                confirmText={action?.kind === "rotate" ? "Rotate" : "Revoke"}
                variant="destructive"
                isLoading={rotate.isPending}
                onConfirm={run}
            />
        </Page>
    );
}
