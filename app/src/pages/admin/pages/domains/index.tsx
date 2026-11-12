import { useState } from "react";
import { Globe, MoreHorizontal, Plus, Trash2, Zap, FileText } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useListParams } from "@/hooks/use-list-params";
import { useDeleteDomain, useDomains, useUpdateDomain, useVerifyDomain } from "@/features/admin/domains/hooks/use-domains";
import type { OrganizationDomain } from "@/features/admin/domains/interfaces/domains.interfaces";
import { DomainStatusFilterOptions, DomainStatusFormOptions } from "@/config/constants/dropdowns/admin/domain-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { DomainDialog } from "./components/domain-dialog";

const tone: Record<string, BadgeVariant> = { VERIFIED: "success", PENDING: "info", FAILED: "warning", REVOKED: "neutral" };

/**
 * Domains — /admin/domains   (mockup 01-admin `domains` + `domainNew`, spec §70)
 * @perm VIEW + every action organizations.domains.manage
 * @api GET /domains · POST /domains · PATCH /domains/:id · POST /domains/:id/verify · DELETE /domains/:id
 * @states loading · empty · error · no-access · verification pending / failed
 */
export default function DomainsPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const domains = useDomains(params);
    const update = useUpdateDomain();
    const verify = useVerifyDomain();
    const remove = useDeleteDomain();
    const [dialog, setDialog] = useState<{ open: boolean; domain: OrganizationDomain | null }>({ open: false, domain: null });
    const [removing, setRemoving] = useState<OrganizationDomain | null>(null);
    const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });

    const toggle = (d: OrganizationDomain, field: "allow_discovery" | "auto_provision", value: boolean) =>
        update.mutate({ id: d.id, [field]: value }, { onSuccess: () => toast({ title: "Domain updated" }), onError: fail("Could not update the domain") });

    const columns: DataTableColumn<OrganizationDomain>[] = [
        {
            key: "domain",
            header: "Domain",
            cell: (d) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{d.domain}</div>
                    {d.status !== "VERIFIED" && <div className="truncate font-mono text-xs text-muted-foreground">TXT {d.dns_record.name}</div>}
                </div>
            ),
        },
        { key: "status", header: "Status", cell: (d) => <Badge variant={tone[d.status] ?? "neutral"} dot>{getDropdownOptionLabel(DomainStatusFormOptions, d.status)}</Badge> },
        { key: "verified", header: "Verified", cell: (d) => (d.verified_at ? formatDate(d.verified_at) : <span className="text-muted-foreground">—</span>), hideBelow: "md" },
        {
            key: "discovery",
            header: "Discovery",
            cell: (d) => <Switch aria-label={`Discovery for ${d.domain}`} checked={d.allow_discovery} disabled={update.isPending} onCheckedChange={(v) => toggle(d, "allow_discovery", v)} />,
            hideBelow: "sm",
        },
        {
            key: "provision",
            header: "Auto-provision",
            cell: (d) => (
                <Switch
                    aria-label={`Auto-provision for ${d.domain}`}
                    checked={d.auto_provision}
                    disabled={update.isPending || (d.status !== "VERIFIED" && !d.auto_provision)}
                    title={d.status !== "VERIFIED" ? "Verify the domain first" : "Create a membership on first SSO sign-in"}
                    onCheckedChange={(v) => toggle(d, "auto_provision", v)}
                />
            ),
            hideBelow: "lg",
        },
        { key: "members", header: "Members using it", cell: (d) => <span className="tabular">{d.members_using ?? 0}</span>, className: "text-right", headerClassName: "text-right", hideBelow: "lg" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (d) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${d.domain}`}><MoreHorizontal /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {d.status !== "VERIFIED" && (
                            <DropdownMenuItem onSelect={() => verify.mutate(d.id, { onSuccess: (r) => toast({ title: r.status === "VERIFIED" ? `${r.domain} verified` : "Record not found yet", description: r.status === "VERIFIED" ? undefined : "Open the DNS record to see what was found." }), onError: fail("Could not check DNS") })}>
                                <Zap /> Check DNS now
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => setDialog({ open: true, domain: d })}><FileText /> DNS record</DropdownMenuItem>
                        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setRemoving(d)}><Trash2 /> Remove</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Domains"
                description="Email domains your organization owns. Verified domains enable SSO, discovery and invitation restrictions."
                actions={<Button onClick={() => setDialog({ open: true, domain: null })}><Plus /> Add domain</Button>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search domains…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{DomainStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={domains.data?.data}
                rowKey={(d) => d.id}
                loading={domains.isFetching}
                error={domains.error}
                onRetry={() => domains.refetch()}
                pagination={domains.data?.pagination}
                onPageChange={setPage}
                onRowClick={(d) => setDialog({ open: true, domain: d })}
                empty={{
                    icon: Globe,
                    title: search || filters.status ? "No domains match" : "No domains yet",
                    description: "Add the domain your team's email addresses use, then verify it with a DNS record.",
                    action: !search && !filters.status ? <Button size="sm" onClick={() => setDialog({ open: true, domain: null })}><Plus /> Add domain</Button> : undefined,
                }}
            />
            <DomainDialog open={dialog.open} domain={dialog.domain} onOpenChange={(open) => setDialog((s) => ({ ...s, open }))} />
            <ConfirmationDialog
                isOpen={!!removing}
                onClose={() => setRemoving(null)}
                title={`Remove ${removing?.domain}?`}
                description="SSO discovery and invitation rules stop using this domain. Members keep their accounts."
                confirmText="Remove"
                variant="destructive"
                isLoading={remove.isPending}
                onConfirm={() => removing && remove.mutate(removing.id, { onSuccess: () => { toast({ title: "Domain removed" }); setRemoving(null); }, onError: fail("Could not remove the domain") })}
            />
        </Page>
    );
}
