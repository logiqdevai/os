import { useEffect, useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_APPEARANCE, resolveMode, useTheme, type ColorMode } from "@/hooks/use-theme";
import { useSessionData } from "@/features/session/hooks/use-session";
import { ColorModeOptions, presetIdOf, themeOf } from "@/config/constants/dropdowns/shared/theme.options";
import { ACCENT_SWATCHES, ThemePresets, type ThemePalette, type ThemePreset } from "@/config/constants/themes/theme-presets";
import { FontFamilyOptions, MAX_FONT_SIZE, MIN_FONT_SIZE, MonoFontFamilyOptions, getFontOption, type FontOption } from "@/config/constants/dropdowns/shared/font-family.options";
import { cn } from "@/lib/utils";

const ICONS: Record<ColorMode, typeof Sun> = { LIGHT: Sun, DARK: Moon, SYSTEM: Monitor };
const HEX = /^#[0-9a-f]{6}$/i;

/** Base palettes drawn for the "Default" preset, which keeps the app's own tokens. */
const BASE_DARK: ThemePalette = { canvas: "#07080a", surface: "#0d0d0d", elevated: "#101111", card: "#18191a", ink: "#f4f4f6", body: "#cdcdcd", muted: "#9c9c9d", border: "#242728", primary: "#ffffff", primaryForeground: "#000000", terminal: "#050505" };
const BASE_LIGHT: ThemePalette = { canvas: "#ffffff", surface: "#fafafa", elevated: "#f4f4f5", card: "#ececee", ink: "#0b0b0c", body: "#3f3f46", muted: "#63636b", border: "#e4e4e7", primary: "#0b0b0c", primaryForeground: "#ffffff", terminal: "#0b0b0c" };

/**
 * Appearance — /settings/appearance (01 §127)
 * @api   PATCH /auth/me/appearance { color_mode?, theme?, primary_color?, font_family?, mono_font_family?, font_size? } — saved per user per organization (UserAppearance).
 * @data  session.appearance for the active organization; every organization keeps its own look (like Slack workspaces).
 * @ui    Mode, preset, accent color, typography and a live preview; changes apply instantly.
 */
export default function AppearanceSettingsPage() {
    const session = useSessionData();
    const { appearance, setAppearance } = useTheme();
    const orgName = session?.active_organization?.display_name;
    const previewMode = resolveMode(appearance.color_mode);
    const selectedPreset = presetIdOf(appearance.theme);
    const isDefault = (Object.keys(DEFAULT_APPEARANCE) as (keyof typeof DEFAULT_APPEARANCE)[]).every((k) => appearance[k] === DEFAULT_APPEARANCE[k]);

    return (
        <div className="space-y-8">
            <Section title="Color theme" description={orgName ? `Pick a mode and a preset for ${orgName}. Changes apply instantly; each organization keeps its own theme.` : "Pick a mode and a preset. Changes apply instantly."}>
                <div className="space-y-5">
                    <Row label="Mode" description="System follows your operating system setting.">
                        <div role="radiogroup" aria-label="Mode" className="inline-flex rounded-md border border-border p-0.5">
                            {ColorModeOptions.map((o) => {
                                const Icon = ICONS[o.id];
                                const active = appearance.color_mode === o.id;
                                return (
                                    <Button key={o.id} type="button" role="radio" aria-checked={active} variant={active ? "secondary" : "ghost"} size="sm" onClick={() => setAppearance({ color_mode: o.id })}>
                                        <Icon /> {o.label}
                                    </Button>
                                );
                            })}
                        </div>
                    </Row>

                    <div>
                        <div className="mb-2 text-[13px] font-medium text-foreground">Preset</div>
                        <div role="radiogroup" aria-label="Preset" className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-3">
                            {ThemePresets.map((preset) => (
                                <PresetCard key={preset.id} preset={preset} mode={previewMode} accent={appearance.primary_color} selected={selectedPreset === preset.id} onSelect={() => setAppearance({ theme: themeOf(preset.id) })} />
                            ))}
                        </div>
                    </div>

                    <Row label="Accent color" description="Overrides the preset's primary color for buttons, highlights and focus rings.">
                        <AccentPicker value={appearance.primary_color} onChange={(primary_color) => setAppearance({ primary_color })} />
                    </Row>
                </div>
            </Section>

            <Section title="Typography" description="Applies to the whole app.">
                <div className="space-y-5">
                    <Row label="Interface font">
                        <FontSelect label="Interface font" options={FontFamilyOptions} value={appearance.font_family} onChange={(font_family) => setAppearance({ font_family })} />
                    </Row>
                    <Row label="Monospace font" description="Code, IDs and technical values.">
                        <FontSelect label="Monospace font" options={MonoFontFamilyOptions} value={appearance.mono_font_family} onChange={(mono_font_family) => setAppearance({ mono_font_family })} />
                    </Row>
                    <Row label="Font size" description={`${MIN_FONT_SIZE}–${MAX_FONT_SIZE}px. Default is ${DEFAULT_APPEARANCE.font_size}px.`}>
                        <FontSizeSlider value={appearance.font_size} onChange={(font_size) => setAppearance({ font_size })} />
                    </Row>
                </div>
            </Section>

            <Section title="Preview" description="A sample of your current settings.">
                <div className="space-y-2 rounded-lg border border-border bg-card p-4">
                    <div className="text-sm font-medium text-foreground">Prepare weekly product update</div>
                    <p className="text-[13px] text-muted-foreground">The quick brown fox jumps over the lazy dog. 0123456789</p>
                    <pre className="overflow-x-auto rounded-sm bg-muted p-3 font-mono text-xs text-body" style={{ fontFamily: getFontOption(MonoFontFamilyOptions, appearance.mono_font_family).stack }}>
                        {'INV-2026-0042 · due 2026-12-01\nstatus: "SENT"'}
                    </pre>
                    <div className="flex gap-2 pt-1">
                        <Button size="sm">Primary</Button>
                        <Button size="sm" variant="secondary">
                            Secondary
                        </Button>
                    </div>
                </div>
                <div className="mt-3 flex justify-end">
                    <Button variant="ghost" size="sm" disabled={isDefault} onClick={() => setAppearance(DEFAULT_APPEARANCE)}>
                        Reset all to defaults
                    </Button>
                </div>
            </Section>
        </div>
    );
}

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-2 border-b border-border-soft pb-5 last:border-b-0 last:pb-0 md:flex-row md:items-start md:gap-8">
            <div className="md:w-64 md:flex-none">
                <div className="text-[13px] font-medium text-foreground">{label}</div>
                {description && <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>}
            </div>
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}

/** Miniature app mock-up painted with the preset's palette, so the choice can be judged at a glance. */
function PresetCard({ preset, mode, accent, selected, onSelect }: { preset: ThemePreset; mode: "light" | "dark"; accent: string | null; selected: boolean; onSelect: () => void }) {
    const p = (mode === "dark" ? preset.dark : preset.light) ?? (mode === "dark" ? BASE_DARK : BASE_LIGHT);
    const primary = accent ?? p.primary;
    return (
        <button type="button" role="radio" aria-checked={selected} aria-label={`${preset.label} theme`} onClick={onSelect} className="group flex flex-col gap-1.5 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className={cn("relative h-16 overflow-hidden rounded-md border-2 transition-colors", selected ? "border-primary" : "border-border group-hover:border-border-strong")} style={{ background: p.canvas }}>
                <div className="absolute inset-y-0 left-0 w-3.5" style={{ background: p.surface, borderRight: `1px solid ${p.border}` }}>
                    <div className="mx-auto mt-2 size-2 rounded-sm" style={{ background: primary }} />
                    <div className="mx-auto mt-1 size-2 rounded-sm" style={{ background: p.card }} />
                </div>
                <div className="absolute left-5 right-2 top-2 h-2 rounded-sm" style={{ background: p.elevated }} />
                <div className="absolute left-5 top-6 h-1.5 w-10 rounded-sm" style={{ background: p.ink, opacity: 0.85 }} />
                <div className="absolute left-5 top-9 h-1.5 w-14 rounded-sm" style={{ background: p.muted, opacity: 0.6 }} />
                <div className="absolute bottom-2 left-5 h-3 w-8 rounded-sm" style={{ background: primary }} />
                {selected && (
                    <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" />
                    </span>
                )}
            </div>
            <span className={cn("text-xs", selected ? "text-foreground" : "text-muted-foreground")}>{preset.label}</span>
        </button>
    );
}

/** Eight swatches, a native color picker and a hex field. Reset returns to the preset's own primary color. */
function AccentPicker({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
    const [draft, setDraft] = useState(value ?? "");
    useEffect(() => setDraft(value ?? ""), [value]);

    const commit = (next: string) => {
        setDraft(next);
        if (HEX.test(next)) onChange(next.toLowerCase());
    };

    return (
        <div className="flex w-full max-w-md flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                {ACCENT_SWATCHES.map((color) => (
                    <button
                        key={color}
                        type="button"
                        aria-label={`Accent ${color}`}
                        aria-pressed={value === color}
                        onClick={() => onChange(color)}
                        className={cn("flex size-6 items-center justify-center rounded-full outline-none ring-offset-2 ring-offset-background transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring")}
                        style={{ background: color }}
                    >
                        {value === color && <Check className="size-3.5 text-white mix-blend-difference" />}
                    </button>
                ))}
            </div>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    aria-label="Pick a custom accent color"
                    value={HEX.test(value ?? "") ? value! : "#5b8def"}
                    onChange={(e) => onChange(e.target.value.toLowerCase())}
                    className="h-8 w-10 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0.5 [&::-moz-color-swatch]:rounded-sm [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0"
                />
                <Input className="h-8 flex-1 font-mono text-xs" placeholder="#5b8def" aria-label="Custom accent color" value={draft} onChange={(e) => commit(e.target.value)} maxLength={7} />
                <Button variant="ghost" size="sm" disabled={!value} onClick={() => onChange(null)}>
                    Reset
                </Button>
            </div>
        </div>
    );
}

function FontSelect({ label, options, value, onChange }: { label: string; options: FontOption[]; value: string; onChange: (id: string) => void }) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-full md:w-56" aria-label={label}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                        {o.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

/** Applies live while dragging; saves once the pointer is released so the API isn't hit on every step. */
function FontSizeSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [draft, setDraft] = useState(value);
    useEffect(() => setDraft(value), [value]);
    const commit = () => draft !== value && onChange(draft);
    return (
        <div className="flex w-full max-w-md items-center gap-3">
            <input
                type="range"
                aria-label="Font size"
                min={MIN_FONT_SIZE}
                max={MAX_FONT_SIZE}
                step={1}
                value={draft}
                onChange={(e) => setDraft(Number(e.target.value))}
                onPointerUp={commit}
                onKeyUp={commit}
                onBlur={commit}
                className="h-1.5 flex-1 cursor-pointer accent-[var(--brand)]"
            />
            <span className="w-10 shrink-0 text-right font-mono text-xs text-muted-foreground">{draft}px</span>
        </div>
    );
}
