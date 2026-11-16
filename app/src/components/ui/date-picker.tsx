import * as React from "react";
import { format, isValid, parse } from "date-fns";
import type { Matcher } from "react-day-picker";
import { CalendarDays, Clock, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const DATE_FMT = "yyyy-MM-dd";
const DATETIME_FMT = "yyyy-MM-dd'T'HH:mm";

type Props = Omit<React.ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange" | "min" | "max"> & {
    type: "date" | "datetime-local";
    value?: string | number | readonly string[];
    defaultValue?: string | number | readonly string[];
    min?: string | number;
    max?: string | number;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

const parseValue = (raw: unknown, withTime: boolean): Date | undefined => {
    if (typeof raw !== "string" || !raw) return undefined;
    const d = parse(raw.slice(0, withTime ? 16 : 10), withTime ? DATETIME_FMT : DATE_FMT, new Date());
    return isValid(d) ? d : undefined;
};

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));

/**
 * Themed replacement for the native date / datetime-local inputs (rendered by `Input` when type is "date" | "datetime-local").
 * Same string contract as the native control: "YYYY-MM-DD" / "YYYY-MM-DDTHH:mm", and onChange receives an event-like object
 * with `target.value`, so react-hook-form and existing handlers keep working unchanged.
 */
export const DatePickerInput = React.forwardRef<HTMLButtonElement, Props>(({ type, value, defaultValue, onChange, onBlur, name, id, min, max, disabled, placeholder, className, required, ...aria }, ref) => {
    const withTime = type === "datetime-local";
    const controlled = value !== undefined;
    const [inner, setInner] = React.useState<string>(typeof defaultValue === "string" ? defaultValue : "");
    const raw = controlled ? (typeof value === "string" ? value : "") : inner;
    const selected = parseValue(raw, withTime);
    const [open, setOpen] = React.useState(false);

    const minDate = parseValue(typeof min === "string" ? min : undefined, false);
    const maxDate = parseValue(typeof max === "string" ? max : undefined, false);
    const disabledDays = [minDate && { before: minDate }, maxDate && { after: maxDate }].filter(Boolean) as Matcher[];

    const emit = (next: string) => {
        if (!controlled) setInner(next);
        onChange?.({ target: { value: next, name: name ?? "", id: id ?? "" }, currentTarget: { value: next, name: name ?? "" }, type: "change" } as unknown as React.ChangeEvent<HTMLInputElement>);
    };
    const emitDate = (d: Date | undefined, h = selected?.getHours() ?? 9, m = selected?.getMinutes() ?? 0) => {
        if (!d) return emit("");
        const base = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
        emit(format(base, withTime ? DATETIME_FMT : DATE_FMT));
    };

    const label = selected ? format(selected, withTime ? "d MMM yyyy, HH:mm" : "d MMM yyyy") : null;
    const minuteOptions = selected && !MINUTES.includes(pad(selected.getMinutes())) ? [...MINUTES, pad(selected.getMinutes())].sort() : MINUTES;

    return (
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) onBlur?.({ target: { name: name ?? "" } } as unknown as React.FocusEvent<HTMLInputElement>); }}>
            <PopoverTrigger asChild>
                <button
                    ref={ref}
                    id={id}
                    type="button"
                    disabled={disabled}
                    aria-required={required}
                    aria-label={aria["aria-label"]}
                    aria-invalid={aria["aria-invalid"]}
                    aria-describedby={aria["aria-describedby"]}
                    className={cn("flex h-9 w-full items-center gap-2 rounded-full border border-input bg-transparent px-3 text-left text-sm transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger", className)}
                >
                    <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                    <span className={cn("min-w-0 flex-1 truncate tabular", !label && "text-muted-foreground")}>{label ?? placeholder ?? (withTime ? "Select date & time" : "Select date")}</span>
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto rounded-2xl border-border-soft p-3 shadow-lg">
                <Calendar
                    mode="single"
                    selected={selected}
                    defaultMonth={selected ?? minDate ?? new Date()}
                    onSelect={(d: Date | undefined) => { emitDate(d); if (!withTime && d) setOpen(false); }}
                    disabled={disabledDays.length ? disabledDays : undefined}
                />
                {withTime && (
                    <div className="mt-2 flex items-center gap-2 border-t border-border-soft pt-3">
                        <Clock className="size-4 text-muted-foreground" />
                        <Select value={selected ? pad(selected.getHours()) : undefined} onValueChange={(h) => emitDate(selected ?? new Date(), Number(h), selected?.getMinutes() ?? 0)}>
                            <SelectTrigger className="h-8 w-[4.5rem]" aria-label="Hour"><SelectValue placeholder="HH" /></SelectTrigger>
                            <SelectContent className="max-h-56">{HOURS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                        </Select>
                        <span className="text-muted-foreground">:</span>
                        <Select value={selected ? pad(selected.getMinutes()) : undefined} onValueChange={(m) => emitDate(selected ?? new Date(), selected?.getHours() ?? 9, Number(m))}>
                            <SelectTrigger className="h-8 w-[4.5rem]" aria-label="Minute"><SelectValue placeholder="MM" /></SelectTrigger>
                            <SelectContent className="max-h-56">{minuteOptions.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                )}
                <div className="mt-2 flex items-center justify-between border-t border-border-soft pt-2">
                    <button type="button" className="rounded-full px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10" onClick={() => { emitDate(new Date(), new Date().getHours(), new Date().getMinutes()); if (!withTime) setOpen(false); }}>Today</button>
                    {raw && !required && (
                        <button type="button" className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => { emit(""); setOpen(false); }}>
                            <X className="size-3" /> Clear
                        </button>
                    )}
                    {withTime && <button type="button" className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary-hover" onClick={() => setOpen(false)}>Done</button>}
                </div>
            </PopoverContent>
        </Popover>
    );
});
DatePickerInput.displayName = "DatePickerInput";
