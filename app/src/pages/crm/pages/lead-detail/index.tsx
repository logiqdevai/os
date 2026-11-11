import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ArrowRightCircle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Page, PageHeader, KeyValueList } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate, formatDateTime } from "@/lib/format";
import { useArchiveLead, useDeleteLead, useLead, useSetLeadStatus } from "@/features/crm/leads/hooks/use-leads";
import { leadLostSchema, type LeadLostValues } from "@/features/crm/leads/validation-schemas/leads.schema";
import { useCrmSettings } from "@/features/crm/settings/hooks/use-crm-settings";
import { contactName } from "@/features/crm/common/interfaces/crm-common.interfaces";
import { CrmPaths } from "../../crm-paths";
import { MemberChip, Money, Panel, RecordLink, ToneBadge } from "../../components/crm-ui";
import { LeadFormDialog } from "../../components/lead-form-dialog";
import { RecordActivities } from "../../components/activity-items";
import { NotesPanel } from "../../components/notes-panel";
import { TagEditor } from "../../components/tag-editor";
import { LeadConvertDialog } from "./components/lead-convert-dialog";

/**
 * Lead page (mockup `lead`).
 * @route /crm/leads/:leadId?tab=activity|notes
 * @perm VIEW crm.leads.read · edit/status crm.leads.update · convert crm.leads.convert · archive crm.leads.archive · delete crm.leads.delete
 * @api GET /crm/leads/:id · POST /crm/leads/:id/status · POST /crm/leads/:id/convert
 */
export default function LeadDetailPage() {
    const { leadId } = useParams();
    const navigate = useNavigate();
    const [sp, setSp] = useSearchParams();
    const tab = sp.get("tab") ?? "activity";
    const lead = useLead(leadId);
    const settings = useCrmSettings();
    const p = usePermissions();
    const setStatus = useSetLeadStatus();
    const archive = useArchiveLead();
    const del = useDeleteLead();
    const [editing, setEditing] = useState(false);
    const [converting, setConverting] = useState(false);
    const [lostStatusId, setLostStatusId] = useState<string | null>(null);
    const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
    const lostForm = useForm<LeadLostValues>({ resolver: zodResolver(leadLostSchema), defaultValues: { lost_reason_id: "" } });
    useEffect(() => { if (lostStatusId) lostForm.reset({ lost_reason_id: "", lost_reason: "" }); }, [lostStatusId, lostForm]);

    if (lead.isPending) return <PageSkeleton />;
    if (lead.error) return <Page><ErrorState error={lead.error} onRetry={() => lead.refetch()} /></Page>;
    const l = lead.data;
    const converted = !!l.converted_at;
    const statuses = settings.data?.lead_statuses.filter((s) => !s.is_converted) ?? [];
    const onErr = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });

    const pickStatus = (id: string) => {
        const s = statuses.find((x) => x.id === id);
        if (!s || id === l.status_id) return;
        if (s.is_lost) setLostStatusId(id);
        else setStatus.mutate({ id: l.id, status_id: id }, { onSuccess: () => toast({ title: `Status: ${s.name}` }), onError: onErr("Could not change the status") });
    };

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: CrmPaths.leads, label: "Leads" }}
                title={l.name}
                meta={l.status && <ToneBadge tone={l.status.color}>{l.status.name}</ToneBadge>}
                description={[l.company?.name ?? l.company_name, l.contact?.first_name ? contactName(l.contact) : l.contact_name].filter(Boolean).join(" · ") || undefined}
                actions={
                    <>
                        {!converted && p.can("crm.leads.update") && (
                            <Select value={l.status_id ?? undefined} onValueChange={pickStatus}>
                                <SelectTrigger className="h-8 w-40" aria-label="Lead status"><SelectValue placeholder="Set status" /></SelectTrigger>
                                <SelectContent>{statuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                            </Select>
                        )}
                        {!converted && <Can permission="crm.leads.convert"><Button onClick={() => setConverting(true)}><ArrowRightCircle /> Convert</Button></Can>}
                        <Can permission="crm.leads.update"><Button variant="outline" onClick={() => setEditing(true)}><Pencil /> Edit</Button></Can>
                        {(p.can("crm.leads.archive") || p.can("crm.leads.delete")) && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {p.can("crm.leads.archive") && <DropdownMenuItem onSelect={() => setConfirm("archive")}><Archive /> Archive</DropdownMenuItem>}
                                    {p.can("crm.leads.delete") && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setConfirm("delete")}><Trash2 /> Delete</DropdownMenuItem>}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </>
                }
            />

            {converted && (
                <div className="mb-4 rounded-lg border border-border bg-success-soft p-3 text-[13px] text-foreground">
                    Converted {formatDate(l.converted_at)}
                    {l.converted_deal && <> · deal <RecordLink to={CrmPaths.deal(l.converted_deal.id)} className="font-medium">{l.converted_deal.name}</RecordLink></>}
                    {l.converted_company && <> · company <RecordLink to={CrmPaths.company(l.converted_company.id)} className="font-medium">{l.converted_company.name}</RecordLink></>}
                    {l.converted_contact && <> · contact <RecordLink to={CrmPaths.contact(l.converted_contact.id)} className="font-medium">{contactName(l.converted_contact)}</RecordLink></>}
                </div>
            )}

            <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
                <Tabs value={tab} onValueChange={(t) => setSp((prev) => { const n = new URLSearchParams(prev); n.set("tab", t); return n; }, { replace: true })} className="min-w-0">
                    <TabsList>
                        <TabsTrigger value="activity">Activity</TabsTrigger>
                        <TabsTrigger value="notes">Notes</TabsTrigger>
                    </TabsList>
                    <TabsContent value="activity" className="mt-4"><RecordActivities link={{ lead_id: l.id }} /></TabsContent>
                    <TabsContent value="notes" className="mt-4"><NotesPanel entityType="CRM_LEAD" entityId={l.id} /></TabsContent>
                </Tabs>
                <div className="space-y-4">
                    <Panel title="Details">
                        <KeyValueList
                            columns={1}
                            items={[
                                { label: "Email", value: l.email && <a href={`mailto:${l.email}`} className="underline-offset-2 hover:underline">{l.email}</a> },
                                { label: "Phone", value: l.phone },
                                { label: "Website", value: l.website },
                                { label: "Industry", value: l.industry },
                                { label: "Estimated value", value: l.estimated_value === null && !l.financials_hidden ? null : <Money value={l.estimated_value} currency={l.currency} /> },
                                { label: "Score", value: l.manual_score ?? l.lead_score },
                                { label: "Source", value: l.lead_source?.name },
                                { label: "Owner", value: <MemberChip member={l.owner} /> },
                                { label: "Next follow-up", value: l.next_follow_up_at ? formatDate(l.next_follow_up_at) : null },
                                ...(l.loss_reason ? [{ label: "Lost reason", value: [l.loss_reason.name, l.lost_reason].filter(Boolean).join(" — ") }] : []),
                            ]}
                        />
                        {l.description && <p className="mt-3 whitespace-pre-wrap border-t border-border pt-3 text-[13px] text-body">{l.description}</p>}
                    </Panel>
                    <Panel title="Tags"><TagEditor entityType="CRM_LEAD" entityId={l.id} tags={l.tags} canEdit={p.can("crm.leads.update")} /></Panel>
                    <p className="px-1 text-xs text-muted-foreground">Created {formatDateTime(l.created_at)}</p>
                </div>
            </div>

            <LeadFormDialog open={editing} onOpenChange={setEditing} lead={l} />
            <LeadConvertDialog leadId={l.id} open={converting} onOpenChange={setConverting} />
            <Dialog open={!!lostStatusId} onOpenChange={(o) => !o && !setStatus.isPending && setLostStatusId(null)}>
                <DialogContent className="sm:max-w-md">
                    <Form {...lostForm}>
                        <form className="space-y-4" onSubmit={lostForm.handleSubmit((v) => lostStatusId && setStatus.mutate({ id: l.id, status_id: lostStatusId, lost_reason_id: v.lost_reason_id, lost_reason: v.lost_reason || undefined }, { onSuccess: () => { toast({ title: "Lead marked lost" }); setLostStatusId(null); }, onError: onErr("Could not change the status") }))}>
                            <DialogHeader>
                                <DialogTitle>Mark lead lost</DialogTitle>
                                <DialogDescription>Pick a reason for reporting.</DialogDescription>
                            </DialogHeader>
                            <FormField control={lostForm.control} name="lost_reason_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reason</FormLabel>
                                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Loss reason"><SelectValue placeholder="Choose a reason" /></SelectTrigger></FormControl>
                                        <SelectContent>{settings.data?.loss_reasons.filter((r) => r.applies_to !== "DEAL").map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={lostForm.control} name="lost_reason" render={({ field }) => (
                                <FormItem><FormLabel>Details</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setLostStatusId(null)} disabled={setStatus.isPending}>Cancel</Button>
                                <Button type="submit" variant="destructive" loading={setStatus.isPending}>Mark lost</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <ConfirmationDialog
                isOpen={confirm === "archive"}
                onClose={() => setConfirm(null)}
                title={`Archive ${l.name}?`}
                description="Archived leads are hidden from lists. You can restore them later."
                confirmText="Archive"
                isLoading={archive.isPending}
                onConfirm={() => archive.mutate(l.id, { onSuccess: () => { toast({ title: "Lead archived" }); navigate(CrmPaths.leads); }, onError: onErr("Could not archive") })}
            />
            <ConfirmationDialog
                isOpen={confirm === "delete"}
                onClose={() => setConfirm(null)}
                title={`Delete ${l.name}?`}
                description="The lead, its activities and notes are deleted permanently."
                confirmText="Delete"
                variant="destructive"
                isLoading={del.isPending}
                onConfirm={() => del.mutate(l.id, { onSuccess: () => { toast({ title: "Lead deleted" }); navigate(CrmPaths.leads); }, onError: onErr("Could not delete") })}
            />
        </Page>
    );
}
