import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Archive, Handshake, Mail, MoreHorizontal, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { Page, PageHeader, KeyValueList } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ContactRoleFormOptions } from "@/config/constants/dropdowns/crm/contact-role-form.options";
import { useArchiveContact, useContact, useDeleteContact } from "@/features/crm/contacts/hooks/use-contacts";
import { useDeals } from "@/features/crm/deals/hooks/use-deals";
import type { Deal } from "@/features/crm/deals/interfaces/deals.interfaces";
import { contactName } from "@/features/crm/common/interfaces/crm-common.interfaces";
import { CrmPaths } from "../../crm-paths";
import { DealStatusBadge, MemberChip, Money, Panel, RecordLink, ToneBadge } from "../../components/crm-ui";
import { ContactFormDialog } from "../../components/contact-form-dialog";
import { DealFormDialog } from "../../components/deal-form-dialog";
import { RecordActivities } from "../../components/activity-items";
import { NotesPanel } from "../../components/notes-panel";
import { TagEditor } from "../../components/tag-editor";

/**
 * Contact page (mockup `contact`).
 * @route /crm/contacts/:contactId?tab=activity|deals|notes
 * @perm VIEW crm.contacts.read · edit crm.contacts.update · archive crm.contacts.archive · delete crm.contacts.delete · deals tab crm.deals.read
 * @api GET /crm/contacts/:id · GET /crm/deals?contact_id= · GET /crm/activities?contact_id=
 */
export default function ContactDetailPage() {
    const { contactId } = useParams();
    const navigate = useNavigate();
    const [sp, setSp] = useSearchParams();
    const tab = sp.get("tab") ?? "activity";
    const contact = useContact(contactId);
    const p = usePermissions();
    const deals = useDeals({ contact_id: contactId, limit: 100 }, !!contactId && p.can("crm.deals.read"));
    const archive = useArchiveContact();
    const del = useDeleteContact();
    const [editing, setEditing] = useState(false);
    const [newDeal, setNewDeal] = useState(false);
    const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);

    if (contact.isPending) return <PageSkeleton />;
    if (contact.error) return <Page><ErrorState error={contact.error} onRetry={() => contact.refetch()} /></Page>;
    const c = contact.data;
    const name = contactName(c);
    const onErr = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });

    const dealCols: DataTableColumn<Deal>[] = [
        { key: "name", header: "Deal", cell: (x) => <span className="font-medium text-foreground">{x.name}</span> },
        { key: "stage", header: "Stage", cell: (x) => <ToneBadge tone={x.stage.color}>{x.stage.name}</ToneBadge>, hideBelow: "sm" },
        { key: "status", header: "Status", cell: (x) => <DealStatusBadge status={x.status} />, hideBelow: "md" },
        { key: "value", header: "Value", cell: (x) => <Money value={x.value} currency={x.currency} />, className: "text-right", headerClassName: "text-right" },
    ];

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: CrmPaths.contacts, label: "Contacts" }}
                title={name}
                meta={c.archived_at && <Badge variant="warning">Archived</Badge>}
                description={<>{c.job_title}{c.job_title && c.company && " at "}{c.company && <RecordLink to={CrmPaths.company(c.company.id)} className="text-muted-foreground">{c.company.name}</RecordLink>}</>}
                actions={
                    <>
                        {c.email && <Button variant="outline" asChild><a href={`mailto:${c.email}`}><Mail /> <span className="hidden sm:inline">Email</span></a></Button>}
                        {(c.phone || c.mobile) && <Button variant="outline" asChild><a href={`tel:${c.phone ?? c.mobile}`}><Phone /> <span className="hidden sm:inline">Call</span></a></Button>}
                        <Can permission="crm.contacts.update"><Button variant="outline" onClick={() => setEditing(true)}><Pencil /> Edit</Button></Can>
                        {(p.can("crm.contacts.archive") || p.can("crm.contacts.delete") || p.can("crm.deals.create")) && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {p.can("crm.deals.create") && <DropdownMenuItem onSelect={() => setNewDeal(true)}><Plus /> New deal</DropdownMenuItem>}
                                    {p.can("crm.contacts.archive") && !c.archived_at && <DropdownMenuItem onSelect={() => setConfirm("archive")}><Archive /> Archive</DropdownMenuItem>}
                                    {p.can("crm.contacts.delete") && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setConfirm("delete")}><Trash2 /> Delete</DropdownMenuItem>}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </>
                }
            />
            <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
                <Tabs value={tab} onValueChange={(t) => setSp((prev) => { const n = new URLSearchParams(prev); n.set("tab", t); return n; }, { replace: true })} className="min-w-0">
                    <TabsList>
                        <TabsTrigger value="activity">Activity</TabsTrigger>
                        {p.can("crm.deals.read") && <TabsTrigger value="deals">Deals ({c.summary.deals})</TabsTrigger>}
                        <TabsTrigger value="notes">Notes</TabsTrigger>
                    </TabsList>
                    <TabsContent value="activity" className="mt-4"><RecordActivities link={{ contact_id: c.id, ...(c.company_id && { company_id: c.company_id }) }} /></TabsContent>
                    <TabsContent value="deals" className="mt-4">
                        <DataTable columns={dealCols} data={deals.data?.data} rowKey={(x) => x.id} loading={deals.isFetching} error={deals.error} onRetry={() => deals.refetch()} rowHref={(x) => CrmPaths.deal(x.id)} empty={{ icon: Handshake, title: "No deals with this contact" }} />
                    </TabsContent>
                    <TabsContent value="notes" className="mt-4"><NotesPanel entityType="CRM_CONTACT" entityId={c.id} /></TabsContent>
                </Tabs>
                <div className="space-y-4">
                    <Panel title="Details">
                        <KeyValueList
                            columns={1}
                            items={[
                                { label: "Email", value: c.email },
                                { label: "Phone", value: c.phone },
                                { label: "Mobile", value: c.mobile },
                                { label: "LinkedIn", value: c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{c.linkedin_url.replace(/^https?:\/\/(www\.)?/, "")}</a> },
                                { label: "Roles", value: c.roles.length ? c.roles.map((r) => getDropdownOptionLabel(ContactRoleFormOptions, r)).join(", ") : null },
                                { label: "Lifecycle", value: c.lifecycle_stage?.name },
                                { label: "Owner", value: <MemberChip member={c.owner} /> },
                                { label: "Email consent", value: c.consent?.email ? "Yes" : "No" },
                                { label: "Added", value: formatDateTime(c.created_at) },
                            ]}
                        />
                        {c.description && <p className="mt-3 whitespace-pre-wrap border-t border-border pt-3 text-[13px] text-body">{c.description}</p>}
                    </Panel>
                    <Panel title="Tags"><TagEditor entityType="CRM_CONTACT" entityId={c.id} tags={c.tags} canEdit={p.can("crm.contacts.update")} /></Panel>
                </div>
            </div>
            <ContactFormDialog open={editing} onOpenChange={setEditing} contact={c} />
            <DealFormDialog open={newDeal} onOpenChange={setNewDeal} defaults={{ company: c.company ? { id: c.company.id, name: c.company.name } : null, contact: c }} />
            <ConfirmationDialog
                isOpen={confirm === "archive"}
                onClose={() => setConfirm(null)}
                title={`Archive ${name}?`}
                description="Archived contacts are hidden from lists and pickers."
                confirmText="Archive"
                isLoading={archive.isPending}
                onConfirm={() => archive.mutate(c.id, { onSuccess: () => { toast({ title: "Contact archived" }); setConfirm(null); }, onError: onErr("Could not archive") })}
            />
            <ConfirmationDialog
                isOpen={confirm === "delete"}
                onClose={() => setConfirm(null)}
                title={`Delete ${name}?`}
                description="The contact and its notes are deleted permanently. Deals keep their history."
                confirmText="Delete"
                variant="destructive"
                isLoading={del.isPending}
                onConfirm={() => del.mutate(c.id, { onSuccess: () => { toast({ title: "Contact deleted" }); navigate(CrmPaths.contacts); }, onError: onErr("Could not delete") })}
            />
        </Page>
    );
}
