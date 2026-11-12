import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Archive, ArchiveRestore, Handshake, MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Page, PageHeader, KeyValueList } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { usePermissions } from "@/hooks/use-permission";
import { InlineText } from "@/components/ui/inline-edit";
import { MarkdownField } from "@/components/ui/markdown-field";
import { formatDate, formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { CompanyTypeFormOptions } from "@/config/constants/dropdowns/crm/company-type-form.options";
import { ContactRoleFormOptions } from "@/config/constants/dropdowns/crm/contact-role-form.options";
import { useArchiveCompany, useCompany, useDeleteCompany, useRestoreCompany, useUpdateCompany } from "@/features/crm/companies/hooks/use-companies";
import { useContacts } from "@/features/crm/contacts/hooks/use-contacts";
import { useDeals } from "@/features/crm/deals/hooks/use-deals";
import type { Contact } from "@/features/crm/contacts/interfaces/contacts.interfaces";
import type { Deal } from "@/features/crm/deals/interfaces/deals.interfaces";
import { contactName } from "@/features/crm/common/interfaces/crm-common.interfaces";
import { CrmPaths } from "../../crm-paths";
import { DealStatusBadge, MemberChip, Money, Panel, ToneBadge } from "../../components/crm-ui";
import { CompanyFormDialog } from "../../components/company-form-dialog";
import { ContactFormDialog } from "../../components/contact-form-dialog";
import { DealFormDialog } from "../../components/deal-form-dialog";
import { MemberSelect } from "../../components/crm-pickers";
import { RecordActivities } from "../../components/activity-items";
import { NotesPanel } from "../../components/notes-panel";
import { TagEditor } from "../../components/tag-editor";
import { CustomFieldsPanel } from "../../components/custom-fields";

/**
 * Company page — Customer 360 (mockup `company`).
 * @route /crm/companies/:companyId?tab=overview|contacts|deals|activity|notes
 * @perm VIEW crm.companies.read · tabs need their own read key (crm.contacts.read, crm.deals.read, crm.activities.read) · money crm.financials.read
 * @api GET /crm/companies/:id · GET /crm/contacts?company_id= · GET /crm/deals?company_id=
 */
export default function CompanyDetailPage() {
    const { companyId } = useParams();
    const navigate = useNavigate();
    const [sp, setSp] = useSearchParams();
    const tab = sp.get("tab") ?? "overview";
    const company = useCompany(companyId);
    const p = usePermissions();
    const contacts = useContacts({ company_id: companyId, limit: 100 }, !!companyId && p.can("crm.contacts.read"));
    const deals = useDeals({ company_id: companyId, limit: 100, status: undefined }, !!companyId && p.can("crm.deals.read"));
    const archive = useArchiveCompany();
    const restore = useRestoreCompany();
    const del = useDeleteCompany();
    const update = useUpdateCompany();
    const [editing, setEditing] = useState(false);
    const [newContact, setNewContact] = useState(false);
    const [newDeal, setNewDeal] = useState(false);
    const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);

    if (company.isPending) return <PageSkeleton />;
    if (company.error) return <Page><ErrorState error={company.error} onRetry={() => company.refetch()} /></Page>;
    const c = company.data;
    const s = c.summary;
    const canEdit = p.can("crm.companies.update");
    const setTab = (t: string) => setSp((prev) => { const n = new URLSearchParams(prev); n.set("tab", t); return n; }, { replace: true });

    const contactCols: DataTableColumn<Contact>[] = [
        { key: "name", header: "Name", cell: (x) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{contactName(x)}</div><div className="truncate text-xs text-muted-foreground">{x.job_title ?? "—"}</div></div> },
        { key: "email", header: "Email", cell: (x) => x.email ?? "—", hideBelow: "sm" },
        { key: "roles", header: "Roles", cell: (x) => <span className="flex flex-wrap gap-1">{x.roles.map((r) => <Badge key={r}>{getDropdownOptionLabel(ContactRoleFormOptions, r)}</Badge>)}</span>, hideBelow: "md" },
    ];
    const dealCols: DataTableColumn<Deal>[] = [
        { key: "name", header: "Deal", cell: (x) => <span className="font-medium text-foreground">{x.name}</span> },
        { key: "stage", header: "Stage", cell: (x) => <ToneBadge tone={x.stage.color}>{x.stage.name}</ToneBadge>, hideBelow: "sm" },
        { key: "status", header: "Status", cell: (x) => <DealStatusBadge status={x.status} />, hideBelow: "md" },
        { key: "value", header: "Value", cell: (x) => <Money value={x.value} currency={x.currency} />, className: "text-right", headerClassName: "text-right" },
    ];

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: CrmPaths.companies, label: "Companies" }}
                title={<InlineText value={c.name} aria-label="Company name" disabled={!canEdit} onSave={(name) => update.mutate({ id: c.id, name })} />}
                documentTitle={c.name}
                meta={<><Badge variant={c.type === "CUSTOMER" ? "success" : c.type === "PROSPECT" ? "info" : "neutral"}>{getDropdownOptionLabel(CompanyTypeFormOptions, c.type)}</Badge>{c.lifecycle_stage && <Badge>{c.lifecycle_stage.name}</Badge>}{c.archived_at && <Badge variant="warning">Archived</Badge>}</>}
                description={[c.website, c.industry, c.country].filter(Boolean).join(" · ") || undefined}
                actions={
                    <>
                        <Can permission="crm.deals.create"><Button variant="outline" onClick={() => setNewDeal(true)}><Plus /> Deal</Button></Can>
                        <Can permission="crm.companies.update"><Button variant="outline" onClick={() => setEditing(true)}><Pencil /> Edit</Button></Can>
                        {(p.can("crm.companies.archive") || p.can("crm.companies.delete")) && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {p.can("crm.companies.archive") && (c.archived_at
                                        ? <DropdownMenuItem onSelect={() => restore.mutate(c.id)}><ArchiveRestore /> Restore</DropdownMenuItem>
                                        : <DropdownMenuItem onSelect={() => setConfirm("archive")}><Archive /> Archive</DropdownMenuItem>)}
                                    {p.can("crm.companies.delete") && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setConfirm("delete")}><Trash2 /> Delete</DropdownMenuItem>}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </>
                }
            />

            <StatGrid className="mb-5">
                <StatCard label="Open deals" value={s.open_deals} hint={<Money value={s.open_value} currency={c.currency} />} />
                <StatCard label="Won deals" value={s.won_deals} hint={<Money value={s.won_value} currency={c.currency} />} tone="success" />
                <StatCard label="Contacts" value={s.contacts} />
                <StatCard label="Last activity" value={s.last_activity ? formatRelative(s.last_activity.completed_at) : "—"} hint={s.open_activities ? `${s.open_activities} open` : undefined} />
            </StatGrid>

            <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
                <Tabs value={tab} onValueChange={setTab} className="min-w-0">
                    <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        {p.can("crm.contacts.read") && <TabsTrigger value="contacts">Contacts</TabsTrigger>}
                        {p.can("crm.deals.read") && <TabsTrigger value="deals">Deals</TabsTrigger>}
                        <TabsTrigger value="activity">Activity</TabsTrigger>
                        <TabsTrigger value="notes">Notes</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="mt-4 space-y-4">
                        <Panel title="Recent deals" actions={p.can("crm.deals.read") && <Button variant="ghost" size="sm" onClick={() => setTab("deals")}>All deals</Button>}>
                            {!p.can("crm.deals.read") ? <p className="text-[13px] text-muted-foreground">You don't have access to deals.</p>
                                : deals.data?.data.length ? (
                                    <ul className="divide-y divide-border-soft">
                                        {deals.data.data.slice(0, 5).map((d) => (
                                            <li key={d.id} className="flex items-center justify-between gap-2 py-2 text-[13px]">
                                                <button type="button" className="min-w-0 truncate text-left font-medium text-foreground hover:underline" onClick={() => navigate(CrmPaths.deal(d.id))}>{d.name}</button>
                                                <span className="flex shrink-0 items-center gap-2"><ToneBadge tone={d.stage.color}>{d.stage.name}</ToneBadge><Money value={d.value} currency={d.currency} /></span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : <EmptyState compact icon={Handshake} title="No deals yet" />}
                        </Panel>
                        {(c.description || canEdit) && (
                            <Panel title="About">
                                <MarkdownField value={c.description} canEdit={canEdit} aria-label="About" onSave={(description) => update.mutateAsync({ id: c.id, description })} />
                            </Panel>
                        )}
                    </TabsContent>
                    <TabsContent value="contacts" className="mt-4">
                        <div className="mb-2 flex justify-end"><Can permission="crm.contacts.create"><Button size="sm" variant="outline" onClick={() => setNewContact(true)}><Plus /> Contact</Button></Can></div>
                        <DataTable columns={contactCols} data={contacts.data?.data} rowKey={(x) => x.id} loading={contacts.isFetching} error={contacts.error} onRetry={() => contacts.refetch()} rowHref={(x) => CrmPaths.contact(x.id)} empty={{ icon: Users, title: "No contacts yet", description: "Add the people you work with at this company." }} />
                    </TabsContent>
                    <TabsContent value="deals" className="mt-4">
                        <DataTable columns={dealCols} data={deals.data?.data} rowKey={(x) => x.id} loading={deals.isFetching} error={deals.error} onRetry={() => deals.refetch()} rowHref={(x) => CrmPaths.deal(x.id)} empty={{ icon: Handshake, title: "No deals yet" }} />
                    </TabsContent>
                    <TabsContent value="activity" className="mt-4"><RecordActivities link={{ company_id: c.id }} /></TabsContent>
                    <TabsContent value="notes" className="mt-4"><NotesPanel entityType="CRM_COMPANY" entityId={c.id} /></TabsContent>
                </Tabs>
                <div className="space-y-4">
                    <Panel title="Details">
                        <KeyValueList
                            columns={1}
                            items={[
                                { label: "Legal name", value: c.legal_name },
                                { label: "Email", value: c.email },
                                { label: "Phone", value: c.phone },
                                { label: "VAT number", value: c.vat_number },
                                { label: "Company size", value: c.company_size },
                                { label: "Annual revenue", value: c.annual_revenue === null && !c.financials_hidden ? null : <Money value={c.annual_revenue} currency={c.currency} /> },
                                {
                                    label: "Owner",
                                    // Saves on change (optimistic); needs crm.companies.assign.
                                    value: p.can("crm.companies.assign")
                                        ? <MemberSelect value={c.owner_membership_id} className="h-8" onChange={(id, owner) => id && update.mutate({ id: c.id, owner_membership_id: id, optimistic: { owner } })} />
                                        : <MemberChip member={c.owner} />,
                                },
                                { label: "Account manager", value: c.account_manager ? <MemberChip member={c.account_manager} /> : null },
                                { label: "Source", value: c.lead_source?.name },
                                { label: "Customer since", value: c.customer_since ? formatDate(c.customer_since) : null },
                                ...(c.parent ? [{ label: "Parent company", value: c.parent.name }] : []),
                            ]}
                        />
                    </Panel>
                    <CustomFieldsPanel entityType="CRM_COMPANY" values={c.custom_fields} />
                    <Panel title="Tags"><TagEditor entityType="CRM_COMPANY" entityId={c.id} tags={c.tags} canEdit={p.can("crm.companies.update")} /></Panel>
                </div>
            </div>

            <CompanyFormDialog open={editing} onOpenChange={setEditing} company={c} />
            <ContactFormDialog open={newContact} onOpenChange={setNewContact} company={{ id: c.id, name: c.name }} onCreated={() => setTab("contacts")} />
            <DealFormDialog open={newDeal} onOpenChange={setNewDeal} defaults={{ company: { id: c.id, name: c.name }, name: `${c.name} — ` }} />
            <ConfirmationDialog
                isOpen={confirm === "archive"}
                onClose={() => setConfirm(null)}
                title={`Archive ${c.name}?`}
                description="Archived companies are hidden from lists and pickers. Their deals and history stay."
                confirmText="Archive"
                onConfirm={() => { archive.mutate(c.id); setConfirm(null); }}
            />
            <ConfirmationDialog
                isOpen={confirm === "delete"}
                onClose={() => setConfirm(null)}
                title={`Delete ${c.name}?`}
                description="Only companies without deals can be deleted. This cannot be undone."
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => { del.mutate(c.id); navigate(CrmPaths.companies); }}
            />
        </Page>
    );
}
