import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { AvailabilityFormOptions, AvailabilityTone, EmploymentStatusFormOptions, EmploymentStatusTone } from "@/config/constants/dropdowns/people/employee-form.options";
import type { AvailabilityStatus, EmploymentStatus } from "@/features/people/employees/interfaces/employees.interfaces";

/** Avatar + name (+ optional subtitle), optionally linking to the profile. */
export function PersonCell({ name, photoUrl, subtitle, to, size = "sm", className }: { name: string; photoUrl?: string | null; subtitle?: ReactNode; to?: string; size?: "sm" | "md" | "lg"; className?: string }) {
    const box = size === "lg" ? "size-14" : size === "md" ? "size-9" : "size-7";
    const body = (
        <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
            <Avatar className={box}>
                {photoUrl && <AvatarImage src={photoUrl} alt="" />}
                <AvatarFallback className={cn("bg-secondary text-muted-foreground", size === "lg" ? "text-base" : "text-[11px]")}>{initials(name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
                <div className={cn("truncate font-medium text-foreground", size === "lg" && "text-lg")}>{name}</div>
                {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
            </div>
        </div>
    );
    return to ? <Link to={to} className="block min-w-0 hover:opacity-90" onClick={(e) => e.stopPropagation()}>{body}</Link> : body;
}

export function EmploymentStatusBadge({ status }: { status: EmploymentStatus }) {
    return <Badge variant={EmploymentStatusTone[status]} dot>{getDropdownOptionLabel(EmploymentStatusFormOptions, status)}</Badge>;
}

export function AvailabilityBadge({ status }: { status: AvailabilityStatus }) {
    return <Badge variant={AvailabilityTone[status]}>{getDropdownOptionLabel(AvailabilityFormOptions, status)}</Badge>;
}

/** Field-level restriction (01 §60): the section exists but the caller may not read it. */
export function RestrictedCard({ title, permission }: { title: string; permission: string }) {
    return (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-card p-4">
            <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
                <div className="text-[13px] font-medium text-foreground">{title} is restricted</div>
                <div className="text-xs text-muted-foreground">Needs the <code className="text-[11px]">{permission}</code> permission.</div>
            </div>
        </div>
    );
}

/** Bordered panel used across People pages. */
export function Panel({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <div className={cn("rounded-lg border border-border bg-card", className)}>
            {(title || actions) && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                    <div className="text-[13px] font-medium text-foreground">{title}</div>
                    {actions}
                </div>
            )}
            <div className="p-4">{children}</div>
        </div>
    );
}
