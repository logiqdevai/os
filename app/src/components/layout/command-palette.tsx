import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Moon, Plus, Search } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { usePermissions } from "@/hooks/use-permission";
import { useTheme } from "@/hooks/use-theme";
import { useVisibleApps } from "./use-visible-apps";

/** ⌘K command palette: jump to any app page the caller may open, run primary "New" actions. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const navigate = useNavigate();
    const { visible, filterNav } = useVisibleApps();
    const p = usePermissions();
    const { toggleTheme } = useTheme();

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                onOpenChange(!open);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onOpenChange]);

    const go = (to: string) => {
        onOpenChange(false);
        navigate(to);
    };

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange}>
            <CommandInput placeholder="Search pages and actions…" />
            <CommandList>
                <CommandEmpty>No results.</CommandEmpty>
                <CommandGroup heading="Create">
                    {visible
                        .filter((a) => a.newAction && (!a.newAction.permission || p.can(a.newAction.permission)))
                        .map((a) => (
                            <CommandItem key={`new-${a.id}`} value={`new ${a.newAction!.label} ${a.label}`} onSelect={() => go(a.newAction!.to)}>
                                <Plus /> {a.newAction!.label}
                            </CommandItem>
                        ))}
                </CommandGroup>
                <CommandSeparator />
                {visible.map((app) => (
                    <CommandGroup key={app.id} heading={app.label}>
                        {filterNav(app).flatMap((s) =>
                            s.items.map((item) => {
                                const Icon = item.icon ?? Search;
                                return (
                                    <CommandItem key={item.to} value={`${app.label} ${item.label}`} onSelect={() => go(item.to)}>
                                        <Icon /> {item.label}
                                    </CommandItem>
                                );
                            })
                        )}
                    </CommandGroup>
                ))}
                <CommandSeparator />
                <CommandGroup heading="Preferences">
                    <CommandItem value="toggle theme dark light" onSelect={() => { toggleTheme(); onOpenChange(false); }}>
                        <Moon /> Toggle theme
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}

export function useCommandPalette() {
    const [open, setOpen] = useState(false);
    return { open, setOpen };
}
