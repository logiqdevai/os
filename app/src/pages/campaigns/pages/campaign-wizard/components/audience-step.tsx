import { Link } from "react-router-dom";
import { Filter, List, Users } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { formatNumber } from "@/lib/format";
import { useLists, useSegments } from "@/features/communications/hooks/use-communications";
import type { CampaignFormValues } from "@/features/communications/validation-schemas/communications.schema";
import { usePermission } from "@/hooks/use-permission";
import { CampaignPaths } from "../../../campaign-paths";

type Source = { key: string; kind: "list" | "segment"; id: string; name: string; count: number | null; hint?: string };

/** Step 1 — pick lists and segments to include or exclude (CampaignAudience). */
export function AudienceStep({ form }: { form: UseFormReturn<CampaignFormValues> }) {
    const canLists = usePermission("communications.recipient_lists.read");
    const canSegments = usePermission("communications.segments.read");
    const channel = form.watch("channel");
    const audiences = form.watch("audiences");
    const lists = useLists({ limit: 100, channel }, canLists);
    const segments = useSegments({ limit: 100, channel }, canSegments);

    const sources: Source[] = [
        ...(lists.data?.data ?? []).map<Source>((l) => ({ key: `list:${l.id}`, kind: "list", id: l.id, name: l.name, count: l.member_count, hint: "Static list" })),
        ...(segments.data?.data ?? []).map<Source>((s) => ({ key: `segment:${s.id}`, kind: "segment", id: s.id, name: s.name, count: s.last_count, hint: "Segment (evaluated at send time)" })),
    ];

    const find = (s: Source) => audiences.findIndex((a) => (s.kind === "list" ? a.list_id === s.id : a.segment_id === s.id));
    const toggle = (s: Source, on: boolean) => {
        const next = audiences.filter((a) => (s.kind === "list" ? a.list_id !== s.id : a.segment_id !== s.id));
        if (on) next.push({ mode: "INCLUDE", ...(s.kind === "list" ? { list_id: s.id } : { segment_id: s.id }) });
        form.setValue("audiences", next, { shouldDirty: true });
    };
    const setMode = (s: Source, mode: "INCLUDE" | "EXCLUDE") =>
        form.setValue("audiences", audiences.map((a) => ((s.kind === "list" ? a.list_id === s.id : a.segment_id === s.id) ? { ...a, mode } : a)), { shouldDirty: true });

    if (lists.isPending && segments.isPending && (canLists || canSegments)) {
        return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
    }
    if (lists.error || segments.error) return <ErrorState error={lists.error ?? segments.error} onRetry={() => { lists.refetch(); segments.refetch(); }} />;
    if (!sources.length) {
        return (
            <EmptyState
                icon={Users}
                title="No lists or segments yet"
                description={<>Create a <Link className="text-primary hover:underline" to={CampaignPaths.lists}>recipient list</Link> or a <Link className="text-primary hover:underline" to={CampaignPaths.segment_new}>segment</Link> first, then come back.</>}
            />
        );
    }

    return (
        <div className="space-y-2">
            <p className="text-[13px] text-muted-foreground">Choose who receives the campaign. Excluded sources remove their people from the included ones. Suppressed addresses and contacts without opt-in are skipped automatically.</p>
            <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                {sources.map((s) => {
                    const idx = find(s);
                    const selected = idx >= 0;
                    const Icon = s.kind === "list" ? List : Filter;
                    return (
                        <li key={s.key} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                            <Checkbox id={s.key} checked={selected} onCheckedChange={(v) => toggle(s, v === true)} aria-label={`Use ${s.name}`} />
                            <label htmlFor={s.key} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                                <Icon className="size-4 shrink-0 text-muted-foreground" />
                                <span className="min-w-0">
                                    <span className="block truncate text-[13px] font-medium text-foreground">{s.name}</span>
                                    <span className="block text-xs text-muted-foreground">{s.hint} · {s.count === null ? "not counted yet" : `${formatNumber(s.count)} people`}</span>
                                </span>
                            </label>
                            {selected && (
                                <Select value={audiences[idx].mode} onValueChange={(v) => setMode(s, v as "INCLUDE" | "EXCLUDE")}>
                                    <SelectTrigger className="h-7 w-28" aria-label={`Include or exclude ${s.name}`}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="INCLUDE">Include</SelectItem>
                                        <SelectItem value="EXCLUDE">Exclude</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        </li>
                    );
                })}
            </ul>
            {form.formState.errors.audiences && <p className="text-xs text-danger">{form.formState.errors.audiences.message}</p>}
        </div>
    );
}
