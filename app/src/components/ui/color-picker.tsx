import { useEffect, useRef, useState } from "react";
import { cssColor, HEX_COLOR, pickerHex } from "@/lib/color";
import { cn } from "@/lib/utils";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

/**
 * Shared color picker: native color input + hex text field. The stored value is `#rrggbb`
 * (legacy semantic token names from seed data are shown as their hex and replaced on the first edit).
 * User-chosen colors are data, so the swatch is the one place a raw color is rendered.
 */
export function ColorPicker({
    value, onChange, label = "Color", disabled, className, id, debounce,
}: { value: string | null | undefined; onChange: (hex: string) => void; label?: string; disabled?: boolean; className?: string; id?: string; /** Wait this many ms after the last change before calling onChange (for pickers that save immediately). */ debounce?: number }) {
    const hex = pickerHex(value);
    const [text, setText] = useState(hex);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => setText(hex), [hex]);
    useEffect(() => () => clearTimeout(timer.current), []);
    const emit = (v: string) => {
        const next = v.toLowerCase();
        setText(next);
        clearTimeout(timer.current);
        if (debounce) timer.current = setTimeout(() => onChange(next), debounce);
        else onChange(next);
    };
    return (
        <div className={cn("flex items-center gap-2", className)}>
            <input
                type="color"
                aria-label={`${label} picker`}
                disabled={disabled}
                value={HEX_COLOR.test(text) ? text : hex}
                onChange={(e) => emit(e.target.value)}
                className="size-9 flex-none cursor-pointer rounded-md border border-input bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <Input
                id={id}
                aria-label={`${label} hex`}
                disabled={disabled}
                value={text}
                maxLength={7}
                placeholder="#2563eb"
                className="font-mono"
                onChange={(e) => {
                    const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
                    setText(v);
                    if (HEX_COLOR.test(v)) emit(v);
                }}
                onBlur={() => setText(hex)}
            />
        </div>
    );
}

/** Small round swatch for a stored color (hex or legacy token name). */
export function ColorDot({ color, className }: { color: string | null | undefined; className?: string }) {
    return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full bg-ash", className)} style={{ backgroundColor: cssColor(color) }} />;
}

const TOKEN_VARIANT: Record<string, BadgeVariant> = { neutral: "neutral", info: "info", success: "success", warning: "warning", danger: "danger", violet: "violet" };

/** Badge tinted with a stored color: a picked hex, or a legacy semantic token name. */
export function ColorBadge({ color, children, className }: { color: string | null | undefined; children: React.ReactNode; className?: string }) {
    if (color && HEX_COLOR.test(color)) {
        return <Badge variant="neutral" className={className} style={{ color, borderColor: `color-mix(in srgb, ${color} 35%, transparent)`, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}>{children}</Badge>;
    }
    return <Badge variant={TOKEN_VARIANT[color ?? ""] ?? "neutral"} className={className}>{children}</Badge>;
}
