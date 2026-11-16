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
    const Extra = app.navExtra;
    return (
        <div className="space-y-5">
            {sections.map((section, i) => (
                <div key={section.label ?? i} className="space-y-1">
                    {section.label && <div className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ash">{section.label}</div>}
                    {section.items.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            onClick={onNavigate}
                            className={({ isActive }) =>
                                cn(
                                    "relative flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm text-body transition-colors hover:bg-border-soft hover:text-foreground [&_svg]:size-4 [&_svg]:flex-none",
                                    isActive &&
                                        "bg-[color-mix(in_oklab,var(--app,var(--brand))_12%,transparent)] font-medium text-foreground overflow-hidden before:absolute before:left-0 before:inset-y-0 before:w-[3px] before:bg-[var(--app,var(--brand))]"
                                )
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    {item.icon && <item.icon className={isActive ? "text-[var(--app,var(--brand))]" : "text-muted-foreground"} />}
                                    <span className="truncate">{item.label}</span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </div>
            ))}
            {Extra && <Extra onNavigate={onNavigate} />}
        </div>
    );
}

export function ContextPanel({ app, onCollapse }: { app: AppDefinition; onCollapse: () => void }) {
    return (
        <aside aria-label={`${app.label} navigation`} className="hidden h-full w-[256px] flex-none flex-col overflow-hidden border-r border-border bg-[var(--shell-sidebar)] lg:flex">
            <div className="flex h-16 flex-none items-center gap-1 pl-5 pr-3">
                <b className="flex-1 truncate text-base font-semibold text-foreground">{app.label}</b>
                <Button variant="ghost" size="icon-sm" onClick={onCollapse} aria-label="Collapse panel">
                    <PanelLeftClose />
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-3.5 pb-4 pt-1">
                <ContextPanelNav app={app} />
            </div>
        </aside>
    );
}
