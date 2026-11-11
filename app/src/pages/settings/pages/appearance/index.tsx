import { Monitor, Moon, Sun } from "lucide-react";
import { Section } from "@/components/ui/page";
import { useTheme, type Theme } from "@/hooks/use-theme";
import { useUpdatePreferences } from "@/features/session/hooks/use-session";
import { ThemeOptions } from "@/config/constants/dropdowns/shared/theme.options";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";

const ICONS: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

/**
 * Appearance — /settings/appearance
 * Applies instantly on this device and saves the choice to the account (PATCH /auth/me/preferences).
 */
export default function AppearanceSettingsPage() {
    const { theme, setTheme } = useTheme();
    const save = useUpdatePreferences();

    const choose = (t: Theme) => {
        setTheme(t);
        save.mutate({ theme: t }, { onError: (e) => toast({ variant: "destructive", title: "Saved on this device only", description: getApiErrorMessage(e) }) });
    };

    return (
        <Section title="Appearance" description="Choose how Logiqdev OS looks for you.">
            <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-3">
                {ThemeOptions.map((o) => {
                    const Icon = ICONS[o.id];
                    const active = theme === o.id;
                    return (
                        <button
                            key={o.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => choose(o.id)}
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
    );
}
