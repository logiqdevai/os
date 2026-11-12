import { useState } from "react";
import { Monitor, MonitorSmartphone, Smartphone } from "lucide-react";
import { Section } from "@/components/ui/page";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useMySessions, useRevokeMySession } from "@/features/session/hooks/use-session";
import type { UserSessionRow } from "@/features/session/interfaces/session.interfaces";
import { formatDateTime, formatRelative } from "@/lib/format";

/** Best-effort browser + OS from the user agent (display only). */
function describe(s: UserSessionRow) {
    const ua = s.user_agent ?? "";
    const browser = s.browser ?? (/Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser");
    const os = s.device ?? (/iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Unknown device");
    return { label: `${browser} on ${os}`, mobile: /iPhone|Android|Mobile/.test(ua) };
}

/**
 * Sessions — /settings/sessions
 * @api GET /auth/sessions · DELETE /auth/sessions/:id (own sessions only; audited as session.revoked)
 */
export default function SessionsSettingsPage() {
    const sessions = useMySessions();
    const revoke = useRevokeMySession();
    const [revoking, setRevoking] = useState<UserSessionRow | "others" | null>(null);
    const others = (sessions.data ?? []).filter((s) => !s.current);

    /** Optimistic: the rows disappear as soon as you confirm; a refused revoke puts its row back (error toasted globally). */
    const confirm = () => {
        if (!revoking) return;
        for (const s of revoking === "others" ? others : [revoking]) revoke.mutate(s.id);
        setRevoking(null);
    };

    return (
        <Section
            title="Sessions"
            description="Devices where you are signed in. End any session you do not recognise."
            actions={others.length > 0 && <Button variant="outline" size="sm" onClick={() => setRevoking("others")}>Sign out other sessions</Button>}
        >
            <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                {sessions.isPending && <ListSkeleton rows={3} />}
                {sessions.error && <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} />}
                {sessions.data?.length === 0 && <EmptyState compact icon={MonitorSmartphone} title="No active sessions" />}
                {sessions.data?.map((s) => {
                    const d = describe(s);
                    const Icon = d.mobile ? Smartphone : Monitor;
                    return (
                        <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <Icon className="size-5 flex-none text-muted-foreground" />
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">{d.label}{s.current && <Badge variant="success">This device</Badge>}</div>
                                    <div className="truncate text-xs text-muted-foreground" title={formatDateTime(s.created_at)}>{s.ip_address ?? "Unknown IP"} · active {formatRelative(s.last_activity_at)}</div>
                                </div>
                            </div>
                            {!s.current && <Button variant="ghost" size="sm" onClick={() => setRevoking(s)}>Sign out</Button>}
                        </div>
                    );
                })}
            </div>
            <ConfirmationDialog
                isOpen={!!revoking}
                onClose={() => setRevoking(null)}
                title={revoking === "others" ? "Sign out all other sessions?" : "Sign out this session?"}
                description="That device will need to sign in again."
                confirmText="Sign out"
                variant="destructive"
                onConfirm={confirm}
            />
        </Section>
    );
}
