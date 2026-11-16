import { useState } from "react";
import {
    Archive, Banknote, BookOpen, Bookmark, Briefcase, Building2, Calendar, ClipboardList, Code, Cog, Database, FileText, Flag, FolderOpen, Globe, GraduationCap, Handshake, Heart, House, Inbox,
    Lightbulb, LifeBuoy, ListChecks, Lock, Mail, Megaphone, MessagesSquare, Palmtree, Pencil, Rocket, Scale, Shield, Siren, Sparkles, Star, Target, Terminal, Ticket, Users, Wrench, Ship, Repeat, Keyboard, Blocks, ShieldCheck, PenLine, BookMarked, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Icons of pages, spaces and templates — Lucide, like the rest of the app. The stored value is the icon name. */
export const DOC_ICONS: Record<string, LucideIcon> = {
    "file-text": FileText, "book-open": BookOpen, "book-marked": BookMarked, bookmark: Bookmark, "clipboard-list": ClipboardList, "list-checks": ListChecks, "pen-line": PenLine, pencil: Pencil,
    house: House, "building-2": Building2, briefcase: Briefcase, users: Users, handshake: Handshake, target: Target, flag: Flag, rocket: Rocket, ship: Ship, sparkles: Sparkles, lightbulb: Lightbulb, star: Star, heart: Heart,
    calendar: Calendar, repeat: Repeat, mail: Mail, inbox: Inbox, megaphone: Megaphone, "messages-square": MessagesSquare, ticket: Ticket, "life-buoy": LifeBuoy, siren: Siren,
    code: Code, terminal: Terminal, database: Database, wrench: Wrench, cog: Cog, blocks: Blocks, keyboard: Keyboard, globe: Globe,
    lock: Lock, shield: Shield, "shield-check": ShieldCheck, scale: Scale, banknote: Banknote, "graduation-cap": GraduationCap, palmtree: Palmtree, archive: Archive, "folder-open": FolderOpen,
};

/** Page / space / template icon: a Lucide icon by name, falling back to a document glyph. */
export function DocIcon({ icon, className }: { icon: string | null | undefined; className?: string }) {
    const Icon = (icon && DOC_ICONS[icon]) || FileText;
    return <Icon className={cn("size-4 shrink-0 text-muted-foreground", className)} aria-hidden />;
}

/** Notion-style icon button: click to open a grid of icons; "Remove" clears it. Works as a react-hook-form field (`value` / `onChange`). */
export function DocIconPicker({ value, onChange, className, size = "md" }: { value: string | undefined; onChange: (v: string) => void; className?: string; size?: "md" | "lg" }) {
    const [open, setOpen] = useState(false);
    const pick = (v: string) => { onChange(v); setOpen(false); };
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" aria-label="Choose an icon" className={cn(size === "lg" ? "size-14" : "size-9", "p-0", className)}>
                    <DocIcon icon={value} className={size === "lg" ? "size-8 text-foreground" : "size-5"} />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-2">
                <div className="mb-1 flex items-center justify-between px-1"><span className="text-xs font-medium text-muted-foreground">Icon</span><Button type="button" variant="ghost" size="sm" onClick={() => pick("")}>Remove</Button></div>
                <div role="listbox" aria-label="Icons" className="grid grid-cols-8 gap-0.5">
                    {Object.entries(DOC_ICONS).map(([name, Icon]) => (
                        <button key={name} type="button" role="option" aria-selected={value === name} aria-label={name.replace(/-/g, " ")} title={name.replace(/-/g, " ")} onClick={() => pick(name)}
                            className={cn("flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground", value === name && "bg-accent text-foreground")}>
                            <Icon className="size-4" />
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
