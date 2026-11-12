import { useState } from "react";
import { LogOut, Monitor, MonitorSmartphone, MoreHorizontal, Smartphone, X } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useAdminSessions, useRevokeAllSessions, useRevokeSession } from "@/features/admin/sessions/hooks/use-admin-sessions";
import type { AdminSessionRow } from "@/features/admin/sessions/interfaces/sessions.interfaces";
import { formatDate, formatDateTime, formatRelative, personName } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { MemberPicker } from "../../components/member-picker";
import { PersonCell } from "../../components/person-cell";

/** Best-effort browser + OS label from the stored columns or the user agent (display only). */
function describe(s: AdminSessionRow) {
    const ua = s.user_agent ?? "";
    const browser = s.browser ?? (/Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser");
    const os = s.device ?? (/iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Unknown device");
    return { label: `${browser} on ${os}`, mobile: /iPhone|Android|Mobile/.test(ua) };
}

type RevokeTarget = { kind: "one"; session: AdminSessionRow } | { kind: "member"; memberId: string; name: string } | { kind: "all" };

/**
 * Sessions — /admin/sessions?member=&q=   (mockup 01-admin `sessions`, spec §72)
 * @perm VIEW users.sessions.read · revoke users.sessions.revoke
 * @api GET /sessions · POST /sessions/:id/revoke {reason} · POST /sessions/revoke-all {member_id?, reason}
 * @states loading · empty · error · no-access (route gate + ErrorState on 403)
 */
export default function AdminSessionsPage() {
    const session = useSessionData();
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const { member: memberFilter, member_label: memberLabel, ...rest } = params as Record<string, string | number>;
    const sessions = useAdminSessions({ ...rest, ...(memberFilter && { member_id: memberFilter }) });
    const canRevoke = usePermission("users.sessions.revoke");
    const [target, setTarget] = useState<RevokeTarget | null>(null);
    const branchName = new Map((session?.branches ?? []).map((b) => [b.id, b.name]));

    const columns: DataTableColumn<AdminSessionRow>[] = [
        {
            key: "member",
            header: "Member",
            cell: (s) => (
                <div className="flex min-w-0 items-center gap-2">
                    <PersonCell user={s.member?.user} />
                    {s.current && <Badge variant="success" className="flex-none">This device</Badge>}
                </div>
            ),
        },
        {
            key: "device",
            header: "Device · browser",
            cell: (s) => {
                const d = describe(s);
                const Icon = d.mobile ? Smartphone : Monitor;
                return (
                    <div className="flex min-w-0 items-center gap-2">
                        <Icon className="size-4 flex-none text-muted-foreground" />
                        <span className="truncate">{d.label}</span>
                    </div>
                );
            },
            hideBelow: "sm",
        },
        {
            key: "ip",
            header: "IP · location",
            cell: (s) => (
                <div className="min-w-0">
                    <div className="truncate font-mono text-xs">{s.ip_address ?? "Unknown IP"}</div>
                    {s.location_approx && <div className="truncate text-xs text-muted-foreground" title="Approximate location (GeoIP)">≈ {s.location_approx}</div>}
                </div>
            ),
            hideBelow: "md",
        },
        {
            key: "branches",
            header: "Active branches",
            cell: (s) =>
                !s.in_this_organization ? (
                    <span className="text-xs text-muted-foreground">Other organization</span>
                ) : s.active_branch_ids.length === 0 ? (
                    <span className="text-muted-foreground">All</span>
                ) : (
                    <span className="truncate">{s.active_branch_ids.map((id) => branchName.get(id) ?? "Branch").join(", ")}</span>
                ),
            hideBelow: "lg",
        },
        { key: "activity", header: "Last activity", cell: (s) => <span className="text-xs text-muted-foreground" title={formatDateTime(s.last_activity_at)}>{formatRelative(s.last_activity_at)}</span> },
        { key: "expires", header: "Expires", cell: (s) => <span className="text-xs text-muted-foreground">{formatDate(s.expires_at)}</span>, hideBelow: "lg" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (s) =>
                canRevoke && !s.current && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${personName(s.member?.user)}`}>
                                <MoreHorizontal />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setTarget({ kind: "one", session: s })}>
                                <LogOut /> Revoke this session
                            </DropdownMenuItem>
                            {s.member && (
                                <DropdownMenuItem onSelect={() => setTarget({ kind: "member", memberId: s.member!.id, name: personName(s.member!.user) })}>
                                    <X /> Revoke all of {personName(s.member.user)}'s sessions
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Sessions"
                description="Devices where members of this organization are signed in. Revoking signs the device out immediately."
                actions={
                    <Can permission="users.sessions.revoke">
                        <Button variant="outline" onClick={() => setTarget(memberFilter ? { kind: "member", memberId: String(memberFilter), name: String(memberLabel ?? "this member") } : { kind: "all" })}>
                            <LogOut /> {memberFilter ? "Revoke all for this member" : "Revoke all except mine"}
                        </Button>
                    </Can>
                }
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search IP, browser, name…">
                <div className="flex w-full items-center gap-1 sm:w-64">
                    <MemberPicker
                        value={filters.member}
                        valueLabel={filters.member_label}
                        placeholder="All members"
                        className="h-8"
                        onChange={(id, label) => { setFilter("member_label", label); setFilter("member", id); }}
                    />
                    {filters.member && (
                        <Button variant="ghost" size="icon-sm" aria-label="Clear member filter" onClick={() => { setFilter("member", null); setFilter("member_label", null); }}>
                            <X />
                        </Button>
                    )}
                </div>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={sessions.data?.data}
                rowKey={(s) => s.id}
                loading={sessions.isFetching}
                error={sessions.error}
                onRetry={() => sessions.refetch()}
                pagination={sessions.data?.pagination}
                onPageChange={setPage}
                empty={{ icon: MonitorSmartphone, title: search || filters.member ? "No sessions match" : "No active sessions", description: "Sessions appear here when members sign in." }}
            />
            <RevokeDialog target={target} onClose={() => setTarget(null)} />
        </Page>
    );
}

function RevokeDialog({ target, onClose }: { target: RevokeTarget | null; onClose: () => void }) {
    const revoke = useRevokeSession();
    const revokeAll = useRevokeAllSessions();
    const [reason, setReason] = useState("");
    const pending = revoke.isPending || revokeAll.isPending;
    const close = () => { if (!pending) { setReason(""); onClose(); } };
    const fail = (e: unknown) => toast({ variant: "destructive", title: "Could not revoke", description: getApiErrorMessage(e) });

    const confirm = () => {
        if (!target) return;
        const r = reason.trim() || undefined;
        if (target.kind === "one") {
            revoke.mutate({ id: target.session.id, reason: r }, { onSuccess: () => { toast({ title: "Session revoked" }); setReason(""); onClose(); }, onError: fail });
        } else {
            revokeAll.mutate(
                { member_id: target.kind === "member" ? target.memberId : undefined, reason: r },
                { onSuccess: (res) => { toast({ title: `${res.revoked} session${res.revoked === 1 ? "" : "s"} revoked` }); setReason(""); onClose(); }, onError: fail }
            );
        }
    };

    const title = target?.kind === "one" ? `Revoke ${personName(target.session.member?.user)}'s session?` : target?.kind === "member" ? `Revoke all sessions of ${target.name}?` : "Revoke every session except yours?";
    const description =
        target?.kind === "all"
            ? "Every member in your scope is signed out on every device and must sign in again. Your current session stays signed in."
            : "The device is signed out immediately and must sign in again.";

    return (
        <Dialog open={!!target} onOpenChange={(o) => !o && close()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-1.5">
                    <Label htmlFor="revoke-reason">Reason (optional, kept in the audit log)</Label>
                    <Input id="revoke-reason" value={reason} maxLength={200} placeholder="e.g. Lost laptop" onChange={(e) => setReason(e.target.value)} />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={close} disabled={pending}>Cancel</Button>
                    <Button variant="destructive" onClick={confirm} loading={pending}>Revoke</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
