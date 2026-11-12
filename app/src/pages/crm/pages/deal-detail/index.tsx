import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Archive, Check, MoreHorizontal, Pencil, RotateCcw, Trash2, UserPlus, X } from "lucide-react";
import { Page, PageHeader, KeyValueList } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { usePermissions } from "@/hooks/use-permission";
import { Input } from "@/components/ui/input";
import { InlineText } from "@/components/ui/inline-edit";
import { MarkdownField } from "@/components/ui/markdown-field";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ForecastCategoryFormOptions } from "@/config/constants/dropdowns/crm/deal-status-form.options";
import { useAddDealContact, useArchiveDeal, useAssignDeal, useChangeDealStage, useDeal, useDeleteDeal, useRemoveDealContact, useReopenDeal, useUpdateDeal } from "@/features/crm/deals/hooks/use-deals";
import type { DealDetail, DealStageRef } from "@/features/crm/deals/interfaces/deals.interfaces";
import { contactName } from "@/features/crm/common/interfaces/crm-common.interfaces";
import { CrmPaths } from "../../crm-paths";
import { DealStatusBadge, MemberChip, Money, Panel, RecordLink, toneDot } from "../../components/crm-ui";
import { CloseDealDialog, type CloseDealTarget } from "../../components/close-deal-dialog";
import { DealFormDialog } from "../../components/deal-form-dialog";
import { RecordActivities } from "../../components/activity-items";
import { NotesPanel } from "../../components/notes-panel";
import { TagEditor } from "../../components/tag-editor";
import { ContactPicker, MemberSelect } from "../../components/crm-pickers";
import { DealLineItems } from "./components/deal-line-items";
import { CustomFieldsPanel } from "../../components/custom-fields";

const days = (s: number | null) => (s == null ? "—" : s < 86400 ? "< 1 day" : `${Math.round(s / 86400)} days`);

/**
 * Deal page (mockup `deal`).
 * @route /crm/deals/:dealId?tab=activity|notes|items|history
 * @perm VIEW crm.deals.read · edit crm.deals.update · stage crm.deals.change_stage · archive crm.deals.archive · delete crm.deals.delete · money crm.financials.read
 * @api GET /crm/deals/:id · POST /crm/deals/:id/stage · POST /crm/deals/:id/reopen · PUT /crm/deals/:id/line-items · POST/DELETE /crm/deals/:id/contacts
 */
export default function DealDetailPage() {
    const { dealId } = useParams();
    const navigate = useNavigate();
    const [sp, setSp] = useSearchParams();
    const tab = sp.get("tab") ?? "activity";
    const deal = useDeal(dealId);
    const p = usePermissions();
    const change = useChangeDealStage();
    const reopen = useReopenDeal();
    const archive = useArchiveDeal();
    const del = useDeleteDeal();
    const update = useUpdateDeal();
    const assign = useAssignDeal();
    const [editing, setEditing] = useState(false);
    const [closing, setClosing] = useState<CloseDealTarget | null>(null);
    const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);

    if (deal.isPending) return <PageSkeleton />;
    if (deal.error) return <Page><ErrorState error={deal.error} onRetry={() => deal.refetch()} /></Page>;
    const d = deal.data;
    const canStage = p.can("crm.deals.change_stage");
    const wonStage = d.pipeline_stages.find((s) => s.is_won);
    const lostStage = d.pipeline_stages.find((s) => s.is_lost);
    const canEdit = p.can("crm.deals.update");

    // Optimistic: the stepper, status and board move at once; a refusal rolls back and toasts.
    const goStage = (s: DealStageRef) => {
        if (!canStage || s.id === d.stage_id) return;
        if (s.is_won || s.is_lost) setClosing({ deal: d, stage_id: s.id, mode: s.is_won ? "won" : "lost", stage: s });
        else if (d.status !== "OPEN") reopen.mutate({ id: d.id, stage_id: s.id, stage: s });
        else change.mutate({ id: d.id, stage_id: s.id, stage: s });
    };

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: CrmPaths.deals, label: "Deals" }}
                title={<InlineText value={d.name} aria-label="Deal name" disabled={!canEdit} onSave={(name) => update.mutate({ id: d.id, name })} />}
                documentTitle={d.name}
                meta={<><DealStatusBadge status={d.status} />{d.archived_at && <span className="text-xs text-muted-foreground">Archived</span>}</>}
                description={<>{d.company ? <RecordLink to={CrmPaths.company(d.company.id)} className="text-muted-foreground">{d.company.name}</RecordLink> : "No company"} · {d.pipeline.name}</>}
                actions={
                    <>
                        {d.status === "OPEN" && canStage && wonStage && <Button variant="outline" onClick={() => setClosing({ deal: d, stage_id: wonStage.id, mode: "won", stage: wonStage })}><Check /> Won</Button>}
                        {d.status === "OPEN" && canStage && lostStage && <Button variant="outline" onClick={() => setClosing({ deal: d, stage_id: lostStage.id, mode: "lost", stage: lostStage })}><X /> Lost</Button>}
                        {d.status !== "OPEN" && p.can("crm.deals.update") && <Button variant="outline" onClick={() => reopen.mutate({ id: d.id })}><RotateCcw /> Reopen</Button>}
                        <Can permission="crm.deals.update"><Button variant="outline" onClick={() => setEditing(true)}><Pencil /> Edit</Button></Can>
                        {(p.can("crm.deals.archive") || p.can("crm.deals.delete")) && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {p.can("crm.deals.archive") && <DropdownMenuItem onSelect={() => setConfirm("archive")}><Archive /> Archive</DropdownMenuItem>}
                                    {p.can("crm.deals.delete") && <><DropdownMenuSeparator /><DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setConfirm("delete")}><Trash2 /> Delete</DropdownMenuItem></>}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </>
                }
            />

            <StageStepper deal={d} onPick={goStage} disabled={!canStage} />

            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_20rem]">
                <div className="min-w-0">
                    <Tabs value={tab} onValueChange={(t) => setSp((prev) => { const n = new URLSearchParams(prev); n.set("tab", t); return n; }, { replace: true })}>
                        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
                            <TabsTrigger value="activity">Activity</TabsTrigger>
                            <TabsTrigger value="notes">Notes</TabsTrigger>
                            <TabsTrigger value="items">Line items</TabsTrigger>
                            <TabsTrigger value="history">History</TabsTrigger>
                        </TabsList>
                        <TabsContent value="activity" className="mt-4"><RecordActivities link={{ deal_id: d.id }} /></TabsContent>
                        <TabsContent value="notes" className="mt-4"><NotesPanel entityType="CRM_DEAL" entityId={d.id} /></TabsContent>
                        <TabsContent value="items" className="mt-4"><DealLineItems deal={d} /></TabsContent>
                        <TabsContent value="history" className="mt-4"><StageHistory deal={d} /></TabsContent>
                    </Tabs>
                </div>
                <div className="space-y-4">
                    <Panel title="Details">
                        <KeyValueList
                            columns={1}
                            items={[
                                { label: "Value", value: <Money value={d.value} currency={d.currency} className="text-[15px] font-medium" /> },
                                { label: "Weighted", value: <Money value={d.weighted_value ?? null} currency={d.currency} /> },
                                { label: "Probability", value: `${d.probability ?? d.stage.probability}% · ${getDropdownOptionLabel(ForecastCategoryFormOptions, d.forecast_category)}` },
                                {
                                    label: "Expected close",
                                    // Saves on change (optimistic).
                                    value: canEdit
                                        ? <Input type="date" aria-label="Expected close date" className="h-8" value={d.expected_close_date?.slice(0, 10) ?? ""} onChange={(e) => e.target.value && update.mutate({ id: d.id, expected_close_date: e.target.value })} />
                                        : formatDate(d.expected_close_date),
                                },
                                ...(d.actual_close_date ? [{ label: "Closed", value: formatDate(d.actual_close_date) }] : []),
                                {
                                    label: "Owner",
                                    // Saves on change (optimistic); needs crm.deals.assign.
                                    value: p.can("crm.deals.assign")
                                        ? <MemberSelect value={d.owner_membership_id} className="h-8" onChange={(id, owner) => id && assign.mutate({ id: d.id, owner_membership_id: id, optimistic: { owner } })} />
                                        : <MemberChip member={d.owner} />,
                                },
                                { label: "In stage", value: `${d.days_in_stage} day${d.days_in_stage === 1 ? "" : "s"}` },
                                { label: "Source", value: d.lead_source?.name },
                                { label: "Next step", value: canEdit ? <InlineText value={d.next_step ?? ""} required={false} placeholder="Add next step" aria-label="Next step" onSave={(next_step) => update.mutate({ id: d.id, next_step })} /> : d.next_step },
                                ...(d.status === "LOST" ? [{ label: "Lost reason", value: [d.loss_reason?.name, d.lost_reason].filter(Boolean).join(" — ") || null }, { label: "Competitor", value: d.competitor }] : []),
                                ...(d.status === "WON" && d.won_note ? [{ label: "Why we won", value: d.won_note }] : []),
                                ...(d.converted_from_leads.length ? [{ label: "From lead", value: <RecordLink to={CrmPaths.lead(d.converted_from_leads[0].id)}>{d.converted_from_leads[0].name}</RecordLink> }] : []),
                            ]}
                        />
                        {(d.description || canEdit) && (
                            <div className="mt-3 border-t border-border pt-3">
                                <MarkdownField value={d.description} canEdit={canEdit} rows={5} onSave={(description) => update.mutateAsync({ id: d.id, description })} />
                            </div>
                        )}
                    </Panel>
                    <DealContacts deal={d} />
                    <CustomFieldsPanel entityType="CRM_DEAL" values={d.custom_fields} />
                    <Panel title="Tags">
                        <TagEditor entityType="CRM_DEAL" entityId={d.id} tags={d.tags} canEdit={p.can("crm.deals.update")} />
                    </Panel>
                    <p className="px-1 text-xs text-muted-foreground">Created {formatDateTime(d.created_at)}</p>
                </div>
            </div>

            <DealFormDialog open={editing} onOpenChange={setEditing} deal={d} />
            <CloseDealDialog target={closing} onClose={() => setClosing(null)} />
            <ConfirmationDialog
                isOpen={confirm === "archive"}
                onClose={() => setConfirm(null)}
                title={`Archive ${d.name}?`}
                description="Archived deals leave the board and reports. You can restore them later."
                confirmText="Archive"
                onConfirm={() => { archive.mutate(d.id); navigate(CrmPaths.deals); }}
            />
            <ConfirmationDialog
                isOpen={confirm === "delete"}
                onClose={() => setConfirm(null)}
                title={`Delete ${d.name}?`}
                description="The deal, its line items, activities and notes are deleted permanently. This is recorded in the audit log."
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => { del.mutate(d.id); navigate(CrmPaths.deals); }}
            />
        </Page>
    );
}

function StageStepper({ deal, onPick, disabled }: { deal: DealDetail; onPick: (s: DealStageRef) => void; disabled: boolean }) {
    const currentIndex = deal.pipeline_stages.findIndex((s) => s.id === deal.stage_id);
    return (
        <nav aria-label="Deal stage" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <ol className="flex min-w-max gap-1">
                {deal.pipeline_stages.map((s, i) => {
                    const current = s.id === deal.stage_id;
                    const passed = deal.status === "OPEN" ? i < currentIndex : false;
                    return (
                        <li key={s.id}>
                            <button
                                type="button"
                                disabled={disabled || current}
                                onClick={() => onPick(s)}
                                aria-current={current ? "step" : undefined}
                                className={cn(
                                    "flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors disabled:cursor-default",
                                    current ? "border-border-strong bg-accent text-foreground"
                                        : passed ? "border-border bg-card text-foreground hover:bg-accent"
                                            : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                                )}
                            >
                                <span className={cn("size-2 rounded-full", current || passed ? toneDot(s.color) : "bg-border-strong")} />
                                {s.name}
                                {!s.is_won && !s.is_lost && <span className="text-muted-foreground tabular">{s.probability}%</span>}
                            </button>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

function StageHistory({ deal }: { deal: DealDetail }) {
    if (!deal.stage_history.length) return <p className="text-[13px] text-muted-foreground">No stage changes yet.</p>;
    return (
        <ol className="space-y-3">
            {deal.stage_history.map((h) => (
                <li key={h.id} className="flex gap-3 text-[13px]">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-border-strong" />
                    <div>
                        <div className="text-foreground">{h.from_stage ? <>{h.from_stage.name} → <span className="font-medium">{h.to_stage.name}</span></> : <>Created in <span className="font-medium">{h.to_stage.name}</span></>}</div>
                        <div className="text-xs text-muted-foreground">{formatDateTime(h.changed_at)}{h.from_stage && ` · ${days(h.duration_seconds)} in ${h.from_stage.name}`}</div>
                    </div>
                </li>
            ))}
        </ol>
    );
}

function DealContacts({ deal }: { deal: DealDetail }) {
    const p = usePermissions();
    const add = useAddDealContact();
    const remove = useRemoveDealContact();
    const [adding, setAdding] = useState(false);
    const canEdit = p.can("crm.deals.update");
    const people = [
        ...(deal.primary_contact ? [{ contact: deal.primary_contact, role: "Primary", primary: true }] : []),
        ...deal.contacts.map((c) => ({ contact: c.contact, role: c.role, primary: false })),
    ];
    return (
        <Panel title="Contacts" actions={canEdit && <Button variant="ghost" size="icon-sm" aria-label="Add contact" onClick={() => setAdding((a) => !a)}><UserPlus /></Button>}>
            {adding && (
                <div className="mb-3">
                    <ContactPicker
                        companyId={deal.company_id}
                        value={undefined}
                        placeholder="Add a contact…"
                        onChange={(id) => id && add.mutate({ id: deal.id, contact_id: id }, { onSuccess: () => setAdding(false) })}
                    />
                </div>
            )}
            {!people.length ? <p className="text-[13px] text-muted-foreground">No contacts on this deal.</p> : (
                <ul className="space-y-2">
                    {people.map(({ contact, role, primary }) => (
                        <li key={contact.id} className="flex items-center justify-between gap-2 text-[13px]">
                            <div className="min-w-0">
                                <RecordLink to={CrmPaths.contact(contact.id)} className="block font-medium">{contactName(contact)}</RecordLink>
                                <div className="truncate text-xs text-muted-foreground">{[role, contact.email].filter(Boolean).join(" · ")}</div>
                            </div>
                            {canEdit && !primary && (
                                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${contactName(contact)}`} onClick={() => remove.mutate({ id: deal.id, contact_id: contact.id })}><X /></Button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}
