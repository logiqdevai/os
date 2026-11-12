import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ContactRoleFilterOptions, ContactRoleFormOptions } from "@/config/constants/dropdowns/crm/contact-role-form.options";
import { ArchivedFilterOptions, OwnerFilterOptions } from "@/config/constants/dropdowns/crm/crm-filter.options";
import { useContacts, useExportContacts } from "@/features/crm/contacts/hooks/use-contacts";
import type { Contact } from "@/features/crm/contacts/interfaces/contacts.interfaces";
import { contactName } from "@/features/crm/common/interfaces/crm-common.interfaces";
import { CrmPaths } from "../../crm-paths";
import { MemberChip, RecordLink, TagList } from "../../components/crm-ui";
import { ExportButton } from "../../components/crm-actions";
import { ContactFormDialog } from "../../components/contact-form-dialog";
import { SavedViewsMenu, useHiddenColumns } from "../../components/saved-views-menu";

/**
 * Contacts (mockup `contacts`).
 * @route /crm/contacts?role=&owner=&archived=&q=
 * @perm VIEW crm.contacts.read · create crm.contacts.create · export crm.contacts.export
 * @api GET /crm/contacts · GET /crm/contacts/export
 */
export default function ContactsPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ limit: 25 });
    const hidden = useHiddenColumns();
    const contacts = useContacts(params);
    const exportContacts = useExportContacts();
    const canCreate = usePermission("crm.contacts.create");
    const [creating, setCreating] = useState(false);

    const columns: DataTableColumn<Contact>[] = [
        {
            key: "name",
            header: "Name",
            cell: (c) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{contactName(c)}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.job_title ?? c.email ?? "—"}</div>
                </div>
            ),
        },
        { key: "company", header: "Company", cell: (c) => (c.company ? <RecordLink to={CrmPaths.company(c.company.id)}>{c.company.name}</RecordLink> : <span className="text-ash">—</span>), hideBelow: "sm" },
        { key: "email", header: "Email", cell: (c) => c.email ?? <span className="text-ash">—</span>, hideBelow: "md" },
        { key: "phone", header: "Phone", cell: (c) => c.phone ?? c.mobile ?? <span className="text-ash">—</span>, hideBelow: "lg" },
        { key: "roles", header: "Roles", cell: (c) => <span className="flex flex-wrap gap-1">{c.roles.slice(0, 2).map((r) => <Badge key={r}>{getDropdownOptionLabel(ContactRoleFormOptions, r)}</Badge>)}</span>, hideBelow: "xl" },
        { key: "owner", header: "Owner", cell: (c) => <MemberChip member={c.owner} />, hideBelow: "lg" },
        { key: "tags", header: "Tags", cell: (c) => <TagList tags={c.tags} />, hideBelow: "xl" },
    ];

    const visibleColumns = columns.filter((c) => !hidden.has(c.key));

    return (
        <Page>
            <PageHeader
                title="Contacts"
                description="People at your customers, prospects, partners and vendors."
                actions={
                    <>
                        <ExportButton permission="crm.contacts.export" mutation={exportContacts} params={params} />
                        <Can permission="crm.contacts.create"><Button onClick={() => setCreating(true)}><Plus /> New contact</Button></Can>
                    </>
                }
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search name, email, company…">
                <SavedViewsMenu entityType="CRM_CONTACT" columns={columns.filter((c) => c.key !== "name").map((c) => ({ key: c.key, label: String(c.header) }))} onSearch={setSearch} />
                <Select value={filters.role ?? "all"} onValueChange={(v) => setFilter("role", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by role"><SelectValue /></SelectTrigger>
                    <SelectContent>{ContactRoleFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.owner ?? "all"} onValueChange={(v) => setFilter("owner", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by owner"><SelectValue /></SelectTrigger>
                    <SelectContent>{OwnerFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.archived === "true" ? "archived" : "active"} onValueChange={(v) => setFilter("archived", v === "archived" ? "true" : null)}>
                    <SelectTrigger className="h-8 w-full sm:w-28" aria-label="Archived"><SelectValue /></SelectTrigger>
                    <SelectContent>{ArchivedFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={visibleColumns}
                data={contacts.data?.data}
                rowKey={(c) => c.id}
                loading={contacts.isFetching}
                error={contacts.error}
                onRetry={() => contacts.refetch()}
                pagination={contacts.data?.pagination}
                onPageChange={setPage}
                rowHref={(c) => CrmPaths.contact(c.id)}
                empty={{
                    icon: Users,
                    title: search ? "No contacts match your search" : "No contacts yet",
                    description: "Add the people you sell to and work with.",
                    action: canCreate && !search ? <Button size="sm" onClick={() => setCreating(true)}><Plus /> New contact</Button> : undefined,
                }}
            />
            <ContactFormDialog open={creating} onOpenChange={setCreating} />
        </Page>
    );
}
