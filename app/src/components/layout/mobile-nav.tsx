import { NavLink } from "react-router-dom";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { AppDefinition } from "@/config/apps/app.types";
import { cn } from "@/lib/utils";
import { ContextPanelNav } from "./context-panel";
import { useVisibleApps } from "./use-visible-apps";
import { BrandMark } from "./brand-mark";

/**
 * Navigation sheet for tablets and phones: the app grid (phones, where the rail is hidden)
 * plus the active app's contextual navigation.
 */
export function MobileNav({ open, onOpenChange, app }: { open: boolean; onOpenChange: (open: boolean) => void; app: AppDefinition | null }) {
    const { visible } = useVisibleApps();
    const close = () => onOpenChange(false);
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="left" className="flex w-[300px] max-w-[85vw] flex-col gap-0 p-0">
                <SheetHeader className="flex-row items-center gap-2 space-y-0 border-b border-border px-4 py-3">
                    <BrandMark className="size-7" />
                    <SheetTitle className="text-[15px]">{app?.label ?? "Logiqdev OS"}</SheetTitle>
                    <SheetDescription className="sr-only">Navigation</SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-4 gap-1 border-b border-border p-3 md:hidden">
                        {visible.map((a) => (
                            <NavLink
                                key={a.id}
                                to={a.basePath}
                                onClick={close}
                                className={cn(
                                    "flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] text-muted-foreground hover:bg-border-soft hover:text-foreground [&_svg]:size-[18px]",
                                    app?.id === a.id && "bg-accent text-foreground"
                                )}
                            >
                                <a.icon />
                                <span className="w-full truncate text-center">{a.label}</span>
                            </NavLink>
                        ))}
                    </div>
                    {app && (
                        <div className="p-3">
                            <ContextPanelNav app={app} onNavigate={close} />
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
