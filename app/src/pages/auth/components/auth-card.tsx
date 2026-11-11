import type { ReactNode } from "react";

export function AuthCard({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
    return (
        <div className="space-y-6">
            <div className="space-y-1.5">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
                {description && <p className="text-[13.5px] text-muted-foreground">{description}</p>}
            </div>
            <div className="rounded-lg border border-border bg-card p-5">{children}</div>
            {footer && <div className="text-center text-[13px] text-muted-foreground">{footer}</div>}
        </div>
    );
}

export function FieldError({ message }: { message?: string }) {
    if (!message) return null;
    return <p className="text-xs text-danger">{message}</p>;
}
