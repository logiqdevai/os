import { useState } from "react";
import { GitCompare, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermission } from "@/hooks/use-permission";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCompareVersions, useCreateProposalVersion } from "@/features/proposals/hooks/use-proposals";
import type { ProposalDetail, ProposalVersionSummary } from "@/features/proposals/interfaces/proposals.interfaces";
import { VersionStatusBadge } from "../../../components/proposal-badges";

const STATUS_TONE = { added: "success", removed: "danger", changed: "warning", same: "neutral" } as const;

/** Version history: open, compare and restore (restore = copy into a new draft; history is never rewritten). */
export function VersionsTab({ proposal, onOpenVersion }: { proposal: ProposalDetail; onOpenVersion: (versionId: string) => void }) {
    const canUpdate = usePermission("proposals.proposals.update");
    const create = useCreateProposalVersion();
    const [restoring, setRestoring] = useState<ProposalVersionSummary | null>(null);
    const [compare, setCompare] = useState<{ from: string; to: string } | null>(null);
    const closed = ["ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"].includes(proposal.status);
    const latest = proposal.versions[0];

    return (
        <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border border-border bg-card">
                <ul className="divide-y divide-border">
                    {proposal.versions.map((v, i) => (
                        <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
                            <span className="font-mono text-[13px] text-foreground">v{v.version_number}</span>
                            <VersionStatusBadge status={v.status} />
                            {v.id === proposal.sent_version_id && <Badge variant="outline">customer version</Badge>}
                            {v.id === proposal.current_version_id && v.id !== proposal.sent_version_id && <Badge variant="outline">working version</Badge>}
                            <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">{v.change_summary ?? "—"}</span>
                            <span className="tabular text-[13px] text-foreground">{formatMoney(v.gross_total, proposal.currency)}</span>
                            <span className="w-full text-xs text-muted-foreground sm:w-auto">{v.sent_at ? `sent ${formatDateTime(v.sent_at)}` : `created ${formatDateTime(v.created_at)}`}</span>
                            <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => onOpenVersion(v.id)}>Open</Button>
                                {i < proposal.versions.length - 1 && (
                                    <Button size="sm" variant="ghost" onClick={() => setCompare({ from: proposal.versions[i + 1].id, to: v.id })}><GitCompare /> Compare</Button>
                                )}
                                {canUpdate && !closed && v.id !== latest?.id && (
                                    <Button size="sm" variant="ghost" onClick={() => setRestoring(v)}><History /> Restore</Button>
                                )}
                            </div>
                            {v.content_hash && <code className="w-full truncate text-[11px] text-muted-foreground">sha256 {v.content_hash}</code>}
                        </li>
                    ))}
                </ul>
            </div>

            <ConfirmationDialog
                isOpen={!!restoring}
                onClose={() => setRestoring(null)}
                title={`Restore v${restoring?.version_number} as a new draft?`}
                description="A new draft version is created from it. Unsent working versions are superseded; sent versions stay as they are."
                confirmText="Restore"
                isLoading={create.isPending}
                onConfirm={() =>
                    restoring &&
                    create.mutate(
                        { id: proposal.id, from_version_id: restoring.id },
                        { onSuccess: (nv: { id: string }) => { setRestoring(null); onOpenVersion(nv.id); } } // opens the new draft
                    )
                }
            />
            <CompareSheet proposal={proposal} value={compare} onChange={setCompare} />
        </div>
    );
}

function CompareSheet({ proposal, value, onChange }: { proposal: ProposalDetail; value: { from: string; to: string } | null; onChange: (v: { from: string; to: string } | null) => void }) {
    const diff = useCompareVersions(proposal.id, value?.from, value?.to);
    const d = diff.data;
    const versionSelect = (key: "from" | "to") => (
        <Select value={value?.[key]} onValueChange={(id) => value && onChange({ ...value, [key]: id })}>
            <SelectTrigger className="h-8 w-28" aria-label={`Compare ${key}`}><SelectValue /></SelectTrigger>
            <SelectContent>{proposal.versions.map((v) => <SelectItem key={v.id} value={v.id}>v{v.version_number}</SelectItem>)}</SelectContent>
        </Select>
    );
    return (
        <Sheet open={!!value} onOpenChange={(o) => !o && onChange(null)}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
                <SheetHeader>
                    <SheetTitle>Compare versions</SheetTitle>
                    <SheetDescription>Sections, pricing and totals between two versions.</SheetDescription>
                </SheetHeader>
                <div className="mt-4 flex items-center gap-2">{versionSelect("from")} <span className="text-muted-foreground">→</span> {versionSelect("to")}</div>
                {value?.from === value?.to ? (
                    <p className="mt-6 text-[13px] text-muted-foreground">Pick two different versions.</p>
                ) : diff.isPending ? (
                    <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
                ) : diff.error ? (
                    <ErrorState error={diff.error} onRetry={() => diff.refetch()} />
                ) : d ? (
                    <div className="mt-4 space-y-5">
                        <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-3 text-[13px]">
                            <div><div className="text-xs text-muted-foreground">v{d.from.version_number} total</div><div className="tabular text-foreground">{formatMoney(d.totals.from.gross_total, proposal.currency)}</div></div>
                            <div><div className="text-xs text-muted-foreground">v{d.to.version_number} total</div><div className="tabular text-foreground">{formatMoney(d.totals.to.gross_total, proposal.currency)}</div></div>
                        </div>
                        <section className="space-y-2">
                            <h3 className="text-[13px] font-medium text-foreground">Sections</h3>
                            {d.sections.filter((s) => s.status !== "same").length === 0 && <p className="text-[13px] text-muted-foreground">No section changes.</p>}
                            {d.sections.filter((s) => s.status !== "same").map((s, i) => (
                                <div key={i} className="rounded-md border border-border">
                                    <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[13px]"><Badge variant={STATUS_TONE[s.status]}>{s.status}</Badge> {s.title}</div>
                                    <div className={cn("grid gap-0 text-[12.5px]", s.status === "changed" && "sm:grid-cols-2")}>
                                        {s.from !== null && <pre className="whitespace-pre-wrap break-words bg-danger-soft/40 p-2 font-sans text-foreground">{s.from || "(empty)"}</pre>}
                                        {s.to !== null && <pre className="whitespace-pre-wrap break-words bg-success-soft/40 p-2 font-sans text-foreground">{s.to || "(empty)"}</pre>}
                                    </div>
                                </div>
                            ))}
                        </section>
                        <section className="space-y-2">
                            <h3 className="text-[13px] font-medium text-foreground">Pricing</h3>
                            <ul className="divide-y divide-border rounded-md border border-border">
                                {d.line_items.filter((l) => l.status !== "same").map((l, i) => (
                                    <li key={i} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[13px]">
                                        <Badge variant={STATUS_TONE[l.status]}>{l.status}</Badge>
                                        <span className="min-w-0 flex-1 truncate text-foreground">{l.name}</span>
                                        <span className="tabular text-muted-foreground">{l.from ? formatMoney(l.from.net_amount, proposal.currency) : "—"} → {l.to ? formatMoney(l.to.net_amount, proposal.currency) : "—"}</span>
                                    </li>
                                ))}
                                {d.line_items.every((l) => l.status === "same") && <li className="px-3 py-2 text-[13px] text-muted-foreground">No pricing changes.</li>}
                            </ul>
                        </section>
                    </div>
                ) : null}
            </SheetContent>
        </Sheet>
    );
}
