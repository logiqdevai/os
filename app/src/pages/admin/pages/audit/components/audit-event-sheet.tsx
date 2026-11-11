import { KeyValueList } from "@/components/ui/page";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import { useAuditEvent } from "@/features/admin/audit/hooks/use-audit";
import { AuditActorTypeFormOptions } from "@/config/constants/dropdowns/admin/developer-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDateTime, personName } from "@/lib/format";
import { AuditOutcomeBadge } from "../../../components/status-badges";

/** One audit event: actor, resource, outcome, before/after metadata and related events on the same resource. */
export function AuditEventSheet({ id, onClose, onOpen }: { id: string | null; onClose: () => void; onOpen: (id: string) => void }) {
    const event = useAuditEvent(id);
    const e = event.data;
    return (
        <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                <SheetHeader>
                    <SheetTitle className="font-mono text-[15px]">{e?.event_type ?? "Audit event"}</SheetTitle>
                    <SheetDescription>{e ? formatDateTime(e.created_at) : "Loading…"}</SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-5">
                    {event.isPending && <ListSkeleton rows={5} className="p-0" />}
                    {event.error && <ErrorState error={event.error} />}
                    {e && (
                        <>
                            <KeyValueList columns={2} items={[
                                { label: "Outcome", value: <AuditOutcomeBadge outcome={e.outcome} /> },
                                { label: "Actor type", value: getDropdownOptionLabel(AuditActorTypeFormOptions, e.actor_type) },
                                { label: "Actor", value: e.actor_user ? personName(e.actor_user) : e.actor_service_account?.name ?? null },
                                { label: "Channel", value: String((e.metadata as Record<string, unknown> | null)?.channel ?? "—") },
                                { label: "Resource", value: e.resource_type },
                                { label: "Resource id", value: e.resource_id ? <code className="text-xs">{e.resource_id}</code> : null },
                                { label: "IP address", value: e.ip_address },
                                { label: "Branch", value: e.branch_id ? <code className="text-xs">{e.branch_id.slice(0, 8)}</code> : "Organization-wide" },
                            ]} />
                            <div className="space-y-1.5">
                                <div className="text-xs text-muted-foreground">Details</div>
                                <pre className="max-h-80 overflow-auto rounded-md border border-border bg-secondary p-3 text-xs text-foreground">{JSON.stringify(e.metadata ?? {}, null, 2)}</pre>
                            </div>
                            {e.related.length > 0 && (
                                <div className="space-y-1.5">
                                    <div className="text-xs text-muted-foreground">Other events on this resource</div>
                                    <ul className="divide-y divide-border-soft rounded-md border border-border">
                                        {e.related.map((r) => (
                                            <li key={r.id}>
                                                <button type="button" onClick={() => onOpen(r.id)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-border-soft">
                                                    <code className="truncate text-xs text-foreground">{r.event_type}</code>
                                                    <span className="flex-none text-xs text-muted-foreground">{formatDateTime(r.created_at)}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
