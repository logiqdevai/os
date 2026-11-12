import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import { useCalendarDetail, useShareCalendar, useUnshareCalendar } from "@/features/calendar/hooks/use-calendar";
import type { CalendarRole } from "@/features/calendar/interfaces/calendar.interfaces";
import { CalendarRoleOptions } from "@/config/constants/dropdowns/calendar/calendar.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { personName } from "@/lib/format";
import { PeoplePicker } from "../../../components/people-picker";

/** Sharing of one calendar with members (19 §7, §10). Sharing is audited by the API. */
export function ShareSheet({ calendarId, onClose }: { calendarId: string | null; onClose: () => void }) {
    const detail = useCalendarDetail(calendarId ?? undefined);
    const share = useShareCalendar();
    const unshare = useUnshareCalendar();
    const [people, setPeople] = useState<string[]>([]);
    const [role, setRole] = useState<CalendarRole>("READ");
    const shares = detail.data && Array.isArray(detail.data.shares) ? detail.data.shares : [];

    const add = async () => {
        if (!calendarId) return;
        for (const membership_id of people) await share.mutateAsync({ id: calendarId, membership_id, role }).catch(() => undefined);
        setPeople([]);
    };

    return (
        <Sheet open={!!calendarId} onOpenChange={(o) => !o && onClose()}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>Share “{detail.data?.name ?? "calendar"}”</SheetTitle>
                    <SheetDescription>Private events always show as Busy, whatever the role.</SheetDescription>
                </SheetHeader>
                {detail.isLoading ? <ListSkeleton rows={4} /> : detail.error ? <ErrorState error={detail.error} onRetry={() => detail.refetch()} /> : !detail.data?.can_manage ? (
                    <p className="mt-4 text-[13px] text-muted-foreground">Only people who manage this calendar can change its sharing.</p>
                ) : (
                    <div className="mt-4 space-y-5">
                        <div className="space-y-3 rounded-lg border border-border p-3">
                            <PeoplePicker value={people} onChange={setPeople} excludeMe placeholder="Choose people" />
                            <div className="flex gap-2">
                                <Select value={role} onValueChange={(v) => setRole(v as CalendarRole)}>
                                    <SelectTrigger className="h-8 flex-1" aria-label="Role"><SelectValue /></SelectTrigger>
                                    <SelectContent>{CalendarRoleOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                                <Button size="sm" disabled={!people.length} loading={share.isPending} onClick={add}>Share</Button>
                            </div>
                        </div>
                        <ul className="divide-y divide-border-soft rounded-lg border border-border">
                            {shares.length ? shares.map((s) => (
                                <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-[13px] text-foreground">{s.membership ? personName(s.membership.user) : s.team?.name ?? "—"}</p>
                                        <p className="text-xs text-muted-foreground">{getDropdownOptionLabel(CalendarRoleOptions, s.role)}</p>
                                    </div>
                                    <Button variant="ghost" size="icon-sm" aria-label="Remove share" onClick={() => calendarId && unshare.mutate({ id: calendarId, shareId: s.id })}><Trash2 /></Button>
                                </li>
                            )) : <li className="px-3 py-2 text-[13px] text-muted-foreground">Not shared with anyone yet.</li>}
                        </ul>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
