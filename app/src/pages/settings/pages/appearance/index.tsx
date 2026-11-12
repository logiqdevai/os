import { useEffect, useRef, useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyAppearance, readableOn, useTheme, type Appearance, type ColorMode } from "@/hooks/use-theme";
import { useSessionData } from "@/features/session/hooks/use-session";
import { ColorModeOptions, PrimaryColorPresets, ThemeOptions } from "@/config/constants/dropdowns/shared/theme.options";
import { cn } from "@/lib/utils";

const ICONS: Record<ColorMode, typeof Sun> = { LIGHT: Sun, DARK: Moon, SYSTEM: Monitor };
const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Appearance — /settings/appearance (01 §127)
 * @api   PATCH /auth/me/appearance { color_mode?, theme?, primary_color? } — saved per user per organization (UserAppearance).
 * @data  session.appearance for the active organization; every organization keeps its own look (like Slack workspaces).
 * @ui    Changes apply instantly; signed-out pages keep the last appearance used on this device.
 */
export default function AppearanceSettingsPage() {
    const session = useSessionData();
    const { appearance, resolved, setAppearance } = useTheme();
    const orgName = session?.active_organization?.display_name;

    return (
        <div className="space-y-8">
            <Section title="Color mode" description="Light, dark, or follow your device.">
                <div role="radiogroup" aria-label="Color mode" className="grid gap-3 sm:grid-cols-3">
                    {ColorModeOptions.map((o) => {
                        const Icon = ICONS[o.id];
                        const active = appearance.color_mode === o.id;
                        return (
                            <button
                                key={o.id}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => setAppearance({ color_mode: o.id })}
                                className={cn("flex flex-col items-start gap-2 rounded-lg border bg-card p-4 text-left transition-colors hover:border-border-strong", active ? "border-primary ring-1 ring-primary" : "border-border")}
                            >
                                <Icon className="size-5 text-muted-foreground" />
                                <span className="text-[13px] font-medium text-foreground">{o.label}</span>
                                <span className="text-xs text-muted-foreground">{o.description}</span>
                            </button>
                        );
                    })}
                </div>
            </Section>

            <Section title="Theme" description={orgName ? `Colors for ${orgName}. Each organization you belong to keeps its own theme.` : "Colors for the app."}>
                <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {ThemeOptions.map((t) => {
                        const accent = resolved === "dark" ? t.dark : t.light;
                        const active = appearance.theme === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                aria-label={`${t.label} theme`}
                                onClick={() => setAppearance({ theme: t.id })}
                                className={cn("group overflow-hidden rounded-lg border bg-card text-left transition-colors hover:border-border-strong", active ? "border-primary ring-1 ring-primary" : "border-border")}
                            >
                                <ThemePreview accent={accent} tinted={t.id !== "DEFAULT"} />
                                <span className="flex items-center gap-2 px-3 py-2">
                                    <span className="size-3 flex-none rounded-full" style={{ background: accent }} />
                                    <span className="flex-1 truncate text-[13px] font-medium text-foreground">{t.label}</span>
                                    {active && <Check className="size-4 text-primary" />}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </Section>

            <PrimaryColorSection appearance={appearance} setAppearance={setAppearance} />
        </div>
    );
}

/** Miniature of the shell: tinted rail + side panel, a selected nav item and a primary button. */
function ThemePreview({ accent, tinted }: { accent: string; tinted: boolean }) {
    const mix = (pct: number, base: string) => (tinted ? `color-mix(in oklab, ${accent} ${pct}%, ${base})` : base);
    return (
        <span aria-hidden className="flex h-20 border-b border-border bg-background">
            <span className="flex w-6 flex-col items-center gap-1 pt-2" style={{ background: mix(12, "var(--background)") }}>
                <span className="size-3 rounded" style={{ background: accent }} />
                <span className="size-2.5 rounded-sm bg-border" />
                <span className="size-2.5 rounded-sm bg-border" />
            </span>
            <span className="flex w-14 flex-col gap-1 px-1.5 pt-2" style={{ background: mix(8, "var(--card)") }}>
                <span className="h-1.5 w-8 rounded-full bg-border" />
                <span className="h-2.5 w-full rounded-sm" style={{ background: mix(18, "var(--accent)") }} />
                <span className="h-1.5 w-7 rounded-full bg-border" />
            </span>
            <span className="flex flex-1 flex-col gap-1.5 p-2">
                <span className="h-1.5 w-12 rounded-full bg-border" />
                <span className="h-1.5 w-16 rounded-full bg-border" />
                <span className="mt-auto h-3 w-10 self-end rounded-sm" style={{ background: accent }} />
            </span>
        </span>
    );
}

function PrimaryColorSection({ appearance, setAppearance }: { appearance: Appearance; setAppearance: (p: Partial<Appearance>) => void }) {
    const [hex, setHex] = useState(appearance.primary_color ?? "");
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
    useEffect(() => setHex(appearance.primary_color ?? ""), [appearance.primary_color]);
    useEffect(() => () => clearTimeout(timer.current), []);

    /** Live preview while dragging the picker; saves once the value settles. */
    const preview = (value: string) => {
        setHex(value);
        if (!HEX.test(value)) return;
        const v = value.toLowerCase();
        applyAppearance({ ...appearance, primary_color: v });
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setAppearance({ primary_color: v }), 400);
    };
    const choose = (value: string | null) => {
        clearTimeout(timer.current);
        setHex(value ?? "");
        setAppearance({ primary_color: value });
    };

    const custom = appearance.primary_color;
    return (
        <Section title="Primary color" description="Override the theme's accent for buttons, links and highlights. Leave it on the theme color to follow the theme.">
            <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Primary color">
                    <button
                        type="button"
                        role="radio"
                        aria-checked={!custom}
                        onClick={() => choose(null)}
                        className={cn("h-8 rounded-full border px-3 text-xs font-medium transition-colors", !custom ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground")}
                    >
                        Theme color
                    </button>
                    {PrimaryColorPresets.map((c) => (
                        <button
                            key={c}
                            type="button"
                            role="radio"
                            aria-checked={custom === c}
                            aria-label={`Primary color ${c}`}
                            onClick={() => choose(c)}
                            className={cn("grid size-8 place-items-center rounded-full ring-offset-2 ring-offset-card transition-shadow", custom === c ? "ring-2 ring-foreground" : "hover:ring-2 hover:ring-border-strong")}
                            style={{ background: c }}
                        >
                            {custom === c && <Check className="size-4" style={{ color: readableOn(c) }} />}
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <label className="relative grid size-9 cursor-pointer place-items-center overflow-hidden rounded-md border border-border" style={{ background: HEX.test(hex) ? hex : "var(--primary)" }}>
                        <span className="sr-only">Pick a custom color</span>
                        <input type="color" value={HEX.test(hex) ? hex : "#0891b2"} onChange={(e) => preview(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
                    </label>
                    <Input value={hex} onChange={(e) => preview(e.target.value.trim())} placeholder="#0891b2" aria-label="Custom hex color" className="w-32 font-mono" maxLength={7} />
                    {hex && !HEX.test(hex) && <span className="text-xs text-danger">Use a hex color like #0891b2</span>}
                    <div className="ml-auto flex items-center gap-2">
                        <Button size="sm">Preview button</Button>
                        {custom && (
                            <Button size="sm" variant="ghost" onClick={() => choose(null)}>
                                Reset
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Section>
    );
}
