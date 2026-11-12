import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, GitMerge } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { CrmEntitySingularOptions } from "@/config/constants/dropdowns/crm/custom-field.options";
import { MergeFieldOptions } from "@/config/constants/dropdowns/crm/crm-merge.options";
import { useMergePreview, useMergeRecords } from "@/features/crm/merge/hooks/use-merge";
import type { MergeEntity } from "@/features/crm/merge/interfaces/merge.interfaces";
import { CrmPaths } from "../../crm-paths";
import { Panel } from "../../components/crm-ui";

const HREF: Record<MergeEntity, (id: string) => string> = { CRM_COMPANY: CrmPaths.company, CRM_CONTACT: CrmPaths.contact, CRM_LEAD: CrmPaths.lead, CRM_DEAL: CrmPaths.deal };
const LIST: Record<MergeEntity, string> = { CRM_COMPANY: CrmPaths.companies, CRM_CONTACT: CrmPaths.contacts, CRM_LEAD: CrmPaths.leads, CRM_DEAL: CrmPaths.deals };
const MOVE_LABEL: Record<string, string> = {
    "crmContact.company_id": "contacts", "crmDeal.company_id": "deals", "crmLead.company_id": "leads", "crmActivity.company_id": "activities", "crmActivity.contact_id": "activities",
    "crmActivity.lead_id": "activities", "crmActivity.deal_id": "activities", "proposal.company_id": "proposals", "proposal.contact_id": "proposals", "proposal.deal_id": "proposals",
    "project.company_id": "projects", "invoice.company_id": "invoices", "ticket.company_id": "tickets", "ticket.requester_contact_id": "tickets", "document.company_id": "files",
    "crmDeal.primary_contact_id": "deals (primary contact)", "crmDealContact.contact_id": "deal contacts", "crmDealLineItem.deal_id": "line items", "crmDealStageHistory.deal_id": "stage history",
    notes: "notes", tags: "tags", custom_field_values: "custom field values",
};

const show = (v: { value: unknown; label: string | null }) => {
    if (v.label) return v.label;
    if (v.value === null || v.value === undefined || v.value === "") return null;
    if (typeof v.value === "object") return Object.values(v.value as Record<string, unknown>).filter(Boolean).join(", ");
    const s = String(v.value);
    return /^\d{4}-\d{2}-\d{2}T/.test(s) ? formatDate(s) : s;
};

/**
 * Merge records (mockups `company-merge`, `contact-merge`, 02 §22).
 * @route /crm/merge?entity=CRM_COMPANY|CRM_CONTACT|CRM_LEAD|CRM_DEAL&ids=a,b
 * @perm crm.<entity>.merge + update scope on every record · owner fields need crm.<entity>.assign
 * @api GET /crm/merge/preview · POST /crm/merge
 * @mcp crm_records_merge_preview · crm_records_merge (sensitive)
 * @states loading preview · conflict (a record changed since the preview) · merging · success · blocked (out of scope → 404)
 */
export default function MergePage() {
    const [sp] = useSearchParams();
    const navigate = useNavigate();
    const entity = (sp.get("entity") as MergeEntity | null) ?? undefined;
    const ids = useMemo(() => (sp.get("ids") ?? "").split(",").filter(Boolean).slice(0, 5), [sp]);
    const preview = useMergePreview(entity, ids);
    const merge = useMergeRecords();
    const [survivor, setSurvivor] = useState<string>("");
    const [choices, setChoices] = useState<Record<string, string>>({});
    const [confirm, setConfirm] = useState(false);

    useEffect(() => {
        if (!preview.data) return;
        setSurvivor((s) => s || preview.data.records[0].id);
        setChoices(Object.fromEntries(preview.data.fields.filter((f) => f.differs).map((f) => [f.field, f.suggested_record_id])));
    }, [preview.data]);

    if (!entity || ids.length < 2) return <Page><EmptyState icon={GitMerge} title="Pick two records to merge" description="Open the duplicates inbox or select two records in a list." action={<Button size="sm" onClick={() => navigate(CrmPaths.duplicates)}>Duplicates</Button>} /></Page>;
    if (preview.isPending) return <PageSkeleton />;
    if (preview.error) return <Page><ErrorState error={preview.error} onRetry={() => preview.refetch()} /></Page>;
    const d = preview.data;
    const label = getDropdownOptionLabel(CrmEntitySingularOptions, entity).toLowerCase();
    const differing = d.fields.filter((f) => f.differs);
    const same = d.fields.filter((f) => !f.differs && f.values.some((v) => show(v)));
    const moves = Object.entries(d.moves);
    const merged = d.records.filter((r) => r.id !== survivor);

    const run = () => {
        const field_choices = Object.fromEntries(Object.entries(choices).filter(([field, rid]) => rid !== survivor && (d.can_assign || !["owner_membership_id", "account_manager_membership_id"].includes(field))));
        merge.mutate({
            entity_type: entity, survivor_id: survivor, merged_ids: merged.map((r) => r.id), field_choices,
            expected_updated_at: Object.fromEntries(d.records.map((r) => [r.id, r.updated_at])),
        }, {
            onSuccess: () => { toast({ title: "Records merged", description: `${merged.length} ${label}${merged.length > 1 ? "s" : ""} merged. Old links now open the surviving record.` }); navigate(HREF[entity](survivor), { replace: true }); },
            onError: (e) => { setConfirm(false); toast({ variant: "destructive", title: "Could not merge", description: getApiErrorMessage(e) }); if ((e as { response?: { status?: number } }).response?.status === 409) preview.refetch(); },
        });
    };

    return (
        <Page width="wide">
            <PageHeader back={{ to: LIST[entity], label: "Back" }} title={`Merge ${d.records.length} ${label}s`} description="Choose the record to keep and, for every field that differs, which value it keeps. Everything linked to the other records moves to it." />
            <Panel title="1 · Record to keep" className="mb-4">
                <RadioGroup value={survivor} onValueChange={setSurvivor} className="grid gap-2 sm:grid-cols-2">
                    {d.records.map((r) => (
                        <label key={r.id} className={cn("flex cursor-pointer items-start gap-2 rounded-md border p-3", survivor === r.id ? "border-primary bg-muted/50" : "border-border")}>
                            <RadioGroupItem value={r.id} className="mt-0.5" />
                            <div className="min-w-0">
                                <div className="truncate text-[13px] font-medium text-foreground">{r.label}</div>
                                <div className="text-xs text-muted-foreground">Created {formatDate(r.created_at)} · updated {formatDate(r.updated_at)}{r.archived_at ? " · archived" : ""}</div>
                            </div>
                        </label>
                    ))}
                </RadioGroup>
            </Panel>
            <Panel title={`2 · Values (${differing.length} field${differing.length === 1 ? "" : "s"} differ)`} className="mb-4" bodyClassName="p-0">
                {!differing.length ? <p className="p-4 text-[13px] text-muted-foreground">All compared fields have the same values.</p> : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="text-xs">Field</TableHead>
                                    {d.records.map((r) => <TableHead key={r.id} className="min-w-40 text-xs">{r.label}{r.id === survivor && <Badge variant="info" className="ml-1.5">Keep</Badge>}</TableHead>)}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {differing.map((f) => {
                                    const locked = !d.can_assign && ["owner_membership_id", "account_manager_membership_id"].includes(f.field);
                                    return (
                                        <TableRow key={f.field} className="border-border-soft">
                                            <TableCell className="py-2 text-xs font-medium text-muted-foreground">{getDropdownOptionLabel(MergeFieldOptions, f.field)}{locked && <div className="font-normal">needs assign permission</div>}</TableCell>
                                            {f.values.map((v) => (
                                                <TableCell key={v.record_id} className="py-2">
                                                    <label className={cn("flex items-start gap-2 text-[13px]", locked ? "cursor-not-allowed opacity-70" : "cursor-pointer")}>
                                                        <input type="radio" className="mt-1 accent-primary" name={f.field} disabled={locked} checked={(choices[f.field] ?? survivor) === v.record_id} onChange={() => setChoices((c) => ({ ...c, [f.field]: v.record_id }))} />
                                                        <span className={cn("break-words", !show(v) && "text-ash")}>{show(v) ?? "empty"}</span>
                                                    </label>
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
                {!!same.length && <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Same on all records: {same.map((f) => getDropdownOptionLabel(MergeFieldOptions, f.field)).join(", ")}.</p>}
            </Panel>
            <Panel title="3 · What moves to the kept record" className="mb-4">
                {!moves.length ? <p className="text-[13px] text-muted-foreground">No linked records to move.</p> : (
                    <ul className="flex flex-wrap gap-2">{moves.map(([k, n]) => <li key={k}><Badge>{n} {MOVE_LABEL[k] ?? k.split(".")[0].replace(/^crm/, "").replace(/([A-Z])/g, " $1").trim().toLowerCase()}</Badge></li>)}</ul>
                )}
                <p className="mt-2 text-xs text-muted-foreground">Tags and custom field values are combined; where both records have a value, the kept record's value stays.</p>
            </Panel>
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft p-3 text-[13px] text-warning"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> Merging cannot be undone. The other records are archived and redirect to the kept one.</div>
            <div className="mt-4 flex justify-end"><Button onClick={() => setConfirm(true)} disabled={!survivor}><GitMerge /> Merge into “{d.records.find((r) => r.id === survivor)?.label}”</Button></div>
            <ConfirmationDialog
                isOpen={confirm}
                onClose={() => setConfirm(false)}
                title={`Merge ${merged.length} ${label}${merged.length > 1 ? "s" : ""}?`}
                description={`${merged.map((r) => r.label).join(", ")} will be merged into ${d.records.find((r) => r.id === survivor)?.label}. This cannot be undone.`}
                confirmText="Merge"
                variant="destructive"
                isLoading={merge.isPending}
                onConfirm={run}
            />
        </Page>
    );
}
