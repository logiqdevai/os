import { NavLink } from "react-router-dom";
import { PanelLeftClose } from "lucide-react";
import type { AppDefinition } from "@/config/apps/app.types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useVisibleApps } from "./use-visible-apps";

/** Contextual navigation of the active app (mockups `.ctx`). */
export function ContextPanelNav({ app, onNavigate }: { app: AppDefinition; onNavigate?: () => void }) {
    const { filterNav } = useVisibleApps();
    const sections = filterNav(app);
    return (
        <div className="space-y-4">
            {sections.map((section, i) => (
                <div key={section.label ?? i} className="space-y-0.5">
                    {section.label && <div className="px-2 pb-1 pt-1 text-[11.5px] font-medium tracking-[0.2px] text-ash">{section.label}</div>}
                    {section.items.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            onClick={onNavigate}
                            className={({ isActive }) =>
                                cn(
                                    "flex h-[30px] items-center gap-2 rounded-md px-2 text-[13px] text-body transition-colors hover:bg-border-soft hover:text-foreground [&_svg]:size-4 [&_svg]:flex-none",
                                    isActive && "bg-accent font-medium text-foreground"
                                )
                            }
                        >
                            {item.icon && <item.icon className="text-muted-foreground" />}
                            <span className="truncate">{item.label}</span>
                        </NavLink>
                    ))}
                </div>
            ))}
        </div>
    );
}

export function ContextPanel({ app, onCollapse }: { app: AppDefinition; onCollapse: () => void }) {
    return (
        <aside aria-label={`${app.label} navigation`} className="hidden h-full w-[236px] flex-none flex-col overflow-hidden border-r border-border bg-card lg:flex">
            <div className="flex h-[52px] flex-none items-center gap-1 border-b border-border pl-4 pr-2.5">
                <b className="flex-1 truncate text-[15px] font-semibold text-foreground">{app.label}</b>
                <Button variant="ghost" size="icon-sm" onClick={onCollapse} aria-label="Collapse panel">
                    <PanelLeftClose />
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-2.5 pb-4 pt-2">
                <ContextPanelNav app={app} />
            </div>
        </aside>
    );
}
