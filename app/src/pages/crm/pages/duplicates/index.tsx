import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CopyCheck, ExternalLink, GitMerge, MoreHorizontal, XCircle } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState, ListSkeleton, NoAccessState } from "@/components/ui/states";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { DuplicateMatchOptions } from "@/config/constants/dropdowns/crm/crm-merge.options";
import { useDismissDuplicate, useDuplicates } from "@/features/crm/merge/hooks/use-merge";
import type { DuplicateEntity, DuplicatePair } from "@/features/crm/merge/interfaces/merge.interfaces";
import { CrmPaths } from "../../crm-paths";
import { MemberChip } from "../../components/crm-ui";

const TABS: { id: DuplicateEntity; label: string; read: string; update: string; href: (id: string) => string }[] = [
    { id: "CRM_COMPANY", label: "Companies", read: "crm.companies.read", update: "crm.companies.update", href: CrmPaths.company },
    { id: "CRM_CONTACT", label: "Contacts", read: "crm.contacts.read", update: "crm.contacts.update", href: CrmPaths.contact },
    { id: "CRM_LEAD", label: "Leads", read: "crm.leads.read", update: "crm.leads.update", href: CrmPaths.lead },
];
const ALL = "all";

/**
 * Duplicates inbox (mockup `duplicates`, 02 §22). Suggestions only — nothing is merged automatically.
 * @route /crm/duplicates?entity=CRM_COMPANY|CRM_CONTACT|CRM_LEAD&match=
 * @perm VIEW the entity read key · merge crm.<entity>.merge · dismiss the entity update key
 * @api GET /crm/duplicates · POST /crm/duplicates/dismiss
 * @mcp crm_duplicates_read · crm_duplicates_dismiss
 */
export default function DuplicatesPage() {
    const p = usePermissions();
    const navigate = useNavigate();
    const tabs = TABS.filter((t) => p.can(t.read));
    const [sp, setSp] = useSearchParams();
    const tab = tabs.find((t) => t.id === sp.get("entity")) ?? tabs[0];
    const match = sp.get("match") ?? ALL;
    const dupes = useDuplicates({ entity_type: tab?.id ?? "CRM_COMPANY", match: match === ALL ? undefined : match }, !!tab);
    const dismiss = useDismissDuplicate();
    const [busy, setBusy] = useState<string | null>(null);
    if (!tab) return <Page><NoAccessState /></Page>;

    const doDismiss = (pair: DuplicatePair) => {
        const key = `${pair.records[0].id}|${pair.records[1].id}`;
        setBusy(key);
        dismiss.mutate({ entity_type: tab.id, record_a_id: pair.records[0].id, record_b_id: pair.records[1].id }, {
            onSuccess: () => toast({ title: "Marked as not a duplicate" }),
            onError: (e) => toast({ variant: "destructive", title: "Could not dismiss", description: getApiErrorMessage(e) }),
            onSettled: () => setBusy(null),
        });
    };

    return (
        <Page width="wide">
            <PageHeader title="Duplicates" description="Records that look like the same company, person or lead. Review them, merge the real duplicates and dismiss the rest." />
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Tabs value={tab.id} onValueChange={(v) => setSp({ entity: v }, { replace: true })}>
                    <TabsList>{tabs.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}</TabsList>
                </Tabs>
                <Select value={match} onValueChange={(v) => setSp((prev) => { const n = new URLSearchParams(prev); if (v === ALL) n.delete("match"); else n.set("match", v); return n; }, { replace: true })}>
                    <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Match key"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>Any match</SelectItem>
                        {DuplicateMatchOptions.filter((o) => tab.id === "CRM_COMPANY" || ["email", "phone", "name"].includes(o.id)).map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="rounded-lg border border-border bg-card">
                {dupes.isPending ? <ListSkeleton /> : dupes.error ? <ErrorState error={dupes.error} onRetry={() => dupes.refetch()} /> : !dupes.data.data.length ? (
                    <EmptyState icon={CopyCheck} title="No duplicates found" description={`Nothing scores ${dupes.data.min_score} or more on ${dupes.data.match_keys.map((k) => getDropdownOptionLabel(DuplicateMatchOptions, k).toLowerCase()).join(", ")}.`} />
                ) : (
                    <>
                        <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">{dupes.data.total} possible duplicate pair{dupes.data.total === 1 ? "" : "s"}{dupes.data.total > dupes.data.data.length ? ` · showing ${dupes.data.data.length}` : ""}</div>
                        <ul className="divide-y divide-border-soft">
                            {dupes.data.data.map((pair) => {
                                const key = `${pair.records[0].id}|${pair.records[1].id}`;
                                return (
                                    <li key={key} className="flex flex-col gap-2 px-3 py-3 md:flex-row md:items-center">
                                        <div className="flex shrink-0 items-center gap-2 md:w-28 md:flex-col md:items-start md:gap-1">
                                            <Badge variant={pair.score >= 80 ? "danger" : pair.score >= 60 ? "warning" : "neutral"}>{pair.score}% match</Badge>
                                            <span className="text-xs text-muted-foreground">{pair.reasons.map((r) => getDropdownOptionLabel(DuplicateMatchOptions, r)).join(", ")}</span>
                                        </div>
                                        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                                            {pair.records.map((r) => (
                                                <div key={r.id} className="min-w-0 rounded-md border border-border px-3 py-2">
                                                    <Link to={tab.href(r.id)} className="block truncate text-[13px] font-medium text-foreground hover:underline">{r.label}</Link>
                                                    <div className="truncate text-xs text-muted-foreground">{r.sub || "—"}</div>
                                                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground"><MemberChip member={r.owner} /><span className="shrink-0">Added {formatDate(r.created_at)}</span></div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex shrink-0 gap-2 md:flex-col">
                                            {dupes.data.can_merge && <Button size="sm" onClick={() => navigate(CrmPaths.merge(tab.id, pair.records.map((r) => r.id)))}><GitMerge /> Merge</Button>}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button size="sm" variant="outline" aria-label="More"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    {p.can(tab.update) && <DropdownMenuItem disabled={busy === key} onSelect={() => doDismiss(pair)}><XCircle /> Not a duplicate</DropdownMenuItem>}
                                                    {pair.records.map((r) => <DropdownMenuItem key={r.id} onSelect={() => window.open(tab.href(r.id), "_blank", "noopener")}><ExternalLink /> Open {r.label}</DropdownMenuItem>)}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}
            </div>
        </Page>
    );
}
