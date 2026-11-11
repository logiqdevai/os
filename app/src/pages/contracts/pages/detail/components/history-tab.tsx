import { useState } from "react";
import { Link } from "react-router-dom";
import { GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { cn } from "@/lib/utils";
import { ContractHistoryEventOptions } from "@/config/constants/dropdowns/contracts/contract-history.options";
import { ContractRelationKindOptions } from "@/config/constants/dropdowns/contracts/contract-terms.options";
import { useCompareVersions, useContractHistory } from "@/features/contracts/hooks/use-contracts";
import type { ContractDetail } from "@/features/contracts/interfaces/contracts.interfaces";
import { ContractStatusBadge, ContractVersionBadge } from "../../../components/contract-badges";

/** Versions (open / compare), lineage (amendments, renewals) and the audit + signature timeline. */
export function HistoryTab({ contract, onOpenVersion }: { contract: ContractDetail; onOpenVersion: (vid: string) => void }) {
    const history = useContractHistory(contract.id);
    const [compare, setCompare] = useState<{ from: string; to: string } | null>(null);
    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-4">
                <div className="rounded-lg border border-border bg-card">
                    <div className="border-b border-border px-3 py-2 text-[13px] font-medium text-foreground">Versions</div>
                    <ul className="divide-y divide-border">
                        {contract.versions.map((v, i) => (
                            <li key={v.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[13px]">
                                <span className="font-mono text-foreground">{v.label}</span>
                                <ContractVersionBadge status={v.status} />
                                {v.id === contract.signed_version_id && <Badge variant="success">signed version</Badge>}
                                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{v.change_summary ?? ""}</span>
                                <Button size="sm" variant="ghost" onClick={() => onOpenVersion(v.id)}>Open</Button>
                                {i < contract.versions.length - 1 && <Button size="sm" variant="ghost" onClick={() => setCompare({ from: contract.versions[i + 1].id, to: v.id })}><GitCompare /> Compare</Button>}
                            </li>
                        ))}
                    </ul>
                </div>
                {(contract.parent || contract.children.length > 0 || contract.superseded_by) && (
                    <div className="rounded-lg border border-border bg-card">
                        <div className="border-b border-border px-3 py-2 text-[13px] font-medium text-foreground">Related contracts</div>
                        <ul className="divide-y divide-border text-[13px]">
                            {contract.parent && <li className="flex items-center gap-2 px-3 py-2"><span className="text-xs text-muted-foreground">Parent</span><Link className="hover:underline" to={`/contracts/${contract.parent.id}`}>{contract.parent.number} · {contract.parent.title}</Link><span className="ml-auto"><ContractStatusBadge status={contract.parent.status} /></span></li>}
                            {contract.superseded_by && <li className="flex items-center gap-2 px-3 py-2"><span className="text-xs text-muted-foreground">Replaced by</span><Link className="hover:underline" to={`/contracts/${contract.superseded_by.id}`}>{contract.superseded_by.number}</Link></li>}
                            {contract.children.map((c) => (
                                <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                                    <span className="text-xs text-muted-foreground">{getDropdownOptionLabel(ContractRelationKindOptions, c.relation_kind)}{c.relation_sequence ? ` ${c.relation_sequence}` : ""}</span>
                                    <Link className="min-w-0 truncate hover:underline" to={`/contracts/${c.id}`}>{c.number} · {c.title}</Link>
                                    <span className="ml-auto"><ContractStatusBadge status={c.status} /></span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 text-[13px] font-medium text-foreground">Timeline</div>
                {history.isPending ? <Skeleton className="h-48" /> : history.error ? <ErrorState error={history.error} onRetry={() => history.refetch()} /> : !history.data?.data.length ? <p className="text-[13px] text-muted-foreground">Nothing yet.</p> : (
                    <ol className="space-y-2.5 border-l border-border pl-4">
                        {history.data.data.map((h) => (
                            <li key={h.id} className="relative">
                                <span className={cn("absolute -left-[21px] top-1.5 size-2 rounded-full", h.kind === "signature" ? "bg-violet" : "bg-border-strong")} />
                                <div className="text-[13px] text-foreground">{getDropdownOptionLabel(ContractHistoryEventOptions, h.type)}</div>
                                <div className="text-xs text-muted-foreground">{[h.actor, formatDateTime(h.at)].filter(Boolean).join(" · ")}</div>
                            </li>
                        ))}
                    </ol>
                )}
            </div>
            <CompareSheet contract={contract} value={compare} onChange={setCompare} />
        </div>
    );
}

function CompareSheet({ contract, value, onChange }: { contract: ContractDetail; value: { from: string; to: string } | null; onChange: (v: { from: string; to: string } | null) => void }) {
    const q = useCompareVersions(contract.id, value?.from, value?.to);
    const pick = (key: "from" | "to") => (
        <Select value={value?.[key]} onValueChange={(id) => value && onChange({ ...value, [key]: id })}>
            <SelectTrigger className="h-8 w-28" aria-label={`Compare ${key}`}><SelectValue /></SelectTrigger>
            <SelectContent>{contract.versions.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}</SelectContent>
        </Select>
    );
    return (
        <Sheet open={!!value} onOpenChange={(o) => !o && onChange(null)}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
                <SheetHeader><SheetTitle>Compare versions</SheetTitle><SheetDescription>Line-by-line changes per section.</SheetDescription></SheetHeader>
                <div className="mt-4 flex items-center gap-2">{pick("from")} <span className="text-muted-foreground">→</span> {pick("to")}</div>
                {value?.from === value?.to ? <p className="mt-6 text-[13px] text-muted-foreground">Pick two different versions.</p> : q.isPending ? <Skeleton className="mt-4 h-64" /> : q.error ? <ErrorState error={q.error} /> : q.data ? (
                    <div className="mt-4 space-y-3">
                        <p className="text-xs text-muted-foreground">{q.data.summary.changed} changed · {q.data.summary.added} added · {q.data.summary.removed} removed · {q.data.summary.same} unchanged</p>
                        {q.data.sections.filter((s) => s.status !== "same").map((s) => (
                            <div key={s.key} className="rounded-md border border-border">
                                <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[13px]"><Badge variant={s.status === "added" ? "success" : s.status === "removed" ? "danger" : "warning"}>{s.status}</Badge>{s.title}</div>
                                <div className="space-y-0.5 p-2 font-mono text-[12px]">
                                    {s.diff.map((d, i) => <div key={i} className={cn("whitespace-pre-wrap break-words px-1", d.op === "add" && "bg-success-soft text-success", d.op === "del" && "bg-danger-soft text-danger line-through", d.op === "same" && "text-muted-foreground")}>{d.op === "add" ? "+ " : d.op === "del" ? "− " : "  "}{d.text}</div>)}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : null}
            </SheetContent>
        </Sheet>
    );
}
