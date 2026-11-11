import type { LucideIcon } from "lucide-react";
import {
    AlarmClock, Archive, ArchiveRestore, AtSign, Bell, CalendarClock, CheckCheck, CircleAlert, Clock, CreditCard, Gauge, Mail, MailOpen, Megaphone, MessageSquare,
    MoreHorizontal, RefreshCw, Reply, Share2, ShieldAlert, SmilePlus, UserPlus, UserRoundCheck,
} from "lucide-react";
import { addDays, addHours, setHours, setMinutes, startOfTomorrow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatRelative, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ModuleLabelOptions } from "@/config/constants/dropdowns/notifications/notification.options";
import type { NotificationCategory, NotificationItem } from "@/features/notifications/interfaces/notifications.interfaces";

/** Visual map only (icons), labels live in config/constants/dropdowns/notifications. */
export const CATEGORY_ICON: Record<NotificationCategory, LucideIcon> = {
    GENERAL: Bell,
    MENTION: AtSign,
    DIRECT_MESSAGE: MessageSquare,
    REPLY: Reply,
    REACTION: SmilePlus,
    ASSIGNMENT: UserPlus,
    APPROVAL: UserRoundCheck,
    STATUS_CHANGE: RefreshCw,
    REMINDER: AlarmClock,
    DUE_DATE: Clock,
    INVITATION: CalendarClock,
    SHARE: Share2,
    SLA: Gauge,
    SECURITY: ShieldAlert,
    BILLING: CreditCard,
    ANNOUNCEMENT: Megaphone,
    SYSTEM: CircleAlert,
};

const CATEGORY_TONE: Partial<Record<NotificationCategory, string>> = {
    MENTION: "bg-info-soft text-info",
    APPROVAL: "bg-warning-soft text-warning",
    ASSIGNMENT: "bg-violet-soft text-violet",
    SECURITY: "bg-danger-soft text-danger",
    SLA: "bg-danger-soft text-danger",
    ANNOUNCEMENT: "bg-success-soft text-success",
    INVITATION: "bg-info-soft text-info",
};

interface NotificationRowProps {
    n: NotificationItem;
    onOpen: (n: NotificationItem) => void;
    onUpdate: (dto: { id: string; read?: boolean; archived?: boolean; snoozed_until?: string | null }) => void;
    onAction?: (n: NotificationItem, action: string) => void;
    actionPending?: boolean;
    compact?: boolean;
}

/** One inbox row: unread dot, category icon, title, preview, module · time · actor, inline actions and a row menu. */
export function NotificationRow({ n, onOpen, onUpdate, onAction, actionPending, compact }: NotificationRowProps) {
    const Icon = CATEGORY_ICON[n.category] ?? Bell;
    const unread = !n.read_at;
    const actions = Array.isArray(n.actions) && n.requires_action && !n.action_taken ? n.actions : [];
    const tomorrow9 = setMinutes(setHours(startOfTomorrow(), 9), 0);

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
                if ((e.target as HTMLElement).closest("button,a,[role=menuitem]")) return;
                onOpen(n);
            }}
            onKeyDown={(e) => e.key === "Enter" && onOpen(n)}
            className={cn(
                "group flex cursor-pointer gap-3 border-b border-border-soft px-3 py-3 transition-colors last:border-b-0 hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none sm:px-4",
                unread && "bg-info-soft/30",
            )}
        >
            <div className="relative shrink-0">
                <div className={cn("grid size-8 place-items-center rounded-md border border-border bg-secondary text-muted-foreground", CATEGORY_TONE[n.category])}>
                    <Icon className="size-4" />
                </div>
                {unread && <span className="absolute -left-1 -top-1 size-2 rounded-full bg-info" aria-label="Unread" />}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                    <p className={cn("min-w-0 flex-1 text-[13px] leading-snug text-foreground", unread ? "font-medium" : "font-normal text-body")}>{n.title}</p>
                    <span className="shrink-0 text-xs text-muted-foreground tabular">{formatRelative(n.last_event_at ?? n.created_at)}</span>
                </div>
                {n.body && !compact && <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">{n.body}</p>}
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>{getDropdownOptionLabel(ModuleLabelOptions, n.module)}</span>
                    {n.entity_label && <span className="truncate">· {n.entity_label}</span>}
                    {n.actor && <span className="hidden sm:inline">· {personName(n.actor.user)}</span>}
                    {(n.priority === "IMPORTANT" || n.priority === "CRITICAL") && <Badge variant={n.priority === "CRITICAL" ? "danger" : "warning"}>{n.priority === "CRITICAL" ? "Critical" : "Important"}</Badge>}
                    {n.is_mandatory && <Badge variant="neutral">Required</Badge>}
                    {n.action_taken && <Badge variant="success"><CheckCheck className="size-3" /> Done</Badge>}
                    {n.snoozed_until && new Date(n.snoozed_until) > new Date() && <Badge variant="neutral"><Clock className="size-3" /> Snoozed</Badge>}
                </div>
                {actions.length > 0 && onAction && (
                    <div className="mt-2 flex flex-wrap gap-2">
                        {actions.map((a) => (
                            <Button key={a.key} size="sm" variant={a.style === "primary" ? "default" : a.style === "danger" ? "destructive" : "outline"} loading={actionPending} onClick={() => onAction(n, a.key)}>
                                {a.label}
                            </Button>
                        ))}
                    </div>
                )}
            </div>
            <div className="shrink-0 self-start">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${n.title}`} className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 sm:data-[state=open]:opacity-100">
                            <MoreHorizontal />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {unread ? (
                            <DropdownMenuItem onSelect={() => onUpdate({ id: n.id, read: true })}><MailOpen /> Mark read</DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem onSelect={() => onUpdate({ id: n.id, read: false })}><Mail /> Mark unread</DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => onUpdate({ id: n.id, snoozed_until: addHours(new Date(), 1).toISOString() })}><Clock /> Snooze 1 hour</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onUpdate({ id: n.id, snoozed_until: tomorrow9.toISOString() })}><Clock /> Snooze until tomorrow</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onUpdate({ id: n.id, snoozed_until: addDays(tomorrow9, 6).toISOString() })}><Clock /> Snooze 1 week</DropdownMenuItem>
                        {n.snoozed_until && <DropdownMenuItem onSelect={() => onUpdate({ id: n.id, snoozed_until: null })}><Clock /> Unsnooze</DropdownMenuItem>}
                        <DropdownMenuSeparator />
                        {n.archived_at ? (
                            <DropdownMenuItem onSelect={() => onUpdate({ id: n.id, archived: false })}><ArchiveRestore /> Move to inbox</DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem onSelect={() => onUpdate({ id: n.id, archived: true })}><Archive /> Archive</DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
