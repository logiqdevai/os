import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { usePreviewDateTrigger } from "@/features/automation/hooks/use-automation";
import type { DateDirection, TriggerConfig, TriggerEntry } from "@/features/automation/interfaces/automation.interfaces";
import { DateDirectionFormOptions, ModuleKeyOptions } from "@/config/constants/dropdowns/automation/automation.options";

const NONE = "__none";

interface DateTriggerEditorProps {
    triggerKey: string;
    config: TriggerConfig | null | undefined;
    options: TriggerEntry[];
    onChange: (key: string, config: TriggerConfig) => void;
}

/**
 * DATE_RELATIVE trigger (20 §3): watched date + "N days before / after / on the day".
 * @api POST /automation/rules/date-preview — records that would fire today (needs the watched record's read key).
 * @states no date chosen · preview loading · preview empty · preview error (global error toast)
 */
export function DateTriggerEditor({ triggerKey, config, options, onChange }: DateTriggerEditorProps) {
    const preview = usePreviewDateTrigger();
    const direction: DateDirection = config?.direction ?? "before";
    const offset = config?.offset_days ?? 3;
    const selected = options.find((o) => o.key === triggerKey);
    const update = (patch: Partial<TriggerConfig>) => onChange(triggerKey, { offset_days: offset, direction, ...patch });

    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <Label>Date to watch</Label>
                <Select value={triggerKey || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v, { offset_days: offset, direction })}>
                    <SelectTrigger aria-label="Date to watch"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NONE}>Choose a date</SelectItem>
                        {options.map((o) => (
                            <SelectItem key={o.key} value={o.key} disabled={!o.can_use}>
                                {o.name} · {getDropdownOptionLabel(ModuleKeyOptions, o.module)}{!o.can_use ? " (no access)" : ""}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                <div className="space-y-1.5">
                    <Label htmlFor="wf-offset">Days</Label>
                    <Input id="wf-offset" type="number" min={0} max={365} disabled={direction === "on"} value={direction === "on" ? 0 : offset} onChange={(e) => update({ offset_days: Math.max(0, Math.min(365, Number(e.target.value) || 0)) })} />
                </div>
                <div className="space-y-1.5">
                    <Label>When</Label>
                    <Select value={direction} onValueChange={(v) => update({ direction: v as DateDirection, ...(v === "on" ? { offset_days: 0 } : {}) })}>
                        <SelectTrigger aria-label="When"><SelectValue /></SelectTrigger>
                        <SelectContent>{DateDirectionFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>
            {selected && (
                <p className="text-xs text-muted-foreground">
                    Runs once per record {direction === "on" ? `on its ${selected.date_label ?? "date"}` : `${offset} ${offset === 1 ? "day" : "days"} ${direction} its ${selected.date_label ?? "date"}`}.
                    Checked every hour; a record fires again only if its date changes. {selected.description}
                </p>
            )}
            {selected && (
                <div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={preview.isPending}
                        onClick={() => preview.mutate({ trigger_key: triggerKey, trigger_config: { offset_days: offset, direction } })}
                    >
                        <CalendarClock /> Who would match today
                    </Button>
                    {preview.data && (
                        <div className="mt-2 rounded-md border border-border bg-muted/40 p-2 text-xs">
                            {preview.data.total === 0 ? (
                                <span className="text-muted-foreground">No records with this {selected.date_label ?? "date"} on {preview.data.date ? formatDate(preview.data.date) : "that day"}.</span>
                            ) : (
                                <>
                                    <div className="mb-1 text-muted-foreground">{preview.data.total} record(s) dated {preview.data.date ? formatDate(preview.data.date) : ""}:</div>
                                    <ul className="space-y-0.5">{preview.data.records.map((r) => <li key={r.id} className="truncate text-foreground">{r.label}</li>)}</ul>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
