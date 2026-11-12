import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, MailX, UserMinus, UserRoundPlus } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { TableToolbar } from "@/components/ui/data-table";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermission } from "@/hooks/use-permission";
import { formatDate, formatRelative } from "@/lib/format";
import { useGuests, useRemoveGuest, useRevokeInvitation, useUpdateGuest } from "@/features/messaging/hooks/use-messaging-admin";
import type { GuestPerson } from "@/features/messaging/interfaces/messaging-admin.interfaces";
import { MessagesPaths } from "../../messages-paths";
import { AdminNav } from "./admin-nav";

type Membership = GuestPerson["memberships"][number];

/**
 * /messages/admin/guests — guests and external participants per person, with their channels and access expiry.
 * @perm messaging.external_users.manage (sensitive) · portal users themselves are managed in 07 Client portal
 * @api GET /messaging/guests · PATCH/DELETE /messaging/guests/:memberId · POST /messaging/invitations/:id/revoke
 */
export default function GuestsPage() {
    const [search, setSearch] = useState("");
    const [expiring, setExpiring] = useState<string>("all");
    const guests = useGuests({ search: search || undefined, expiring_days: expiring === "all" ? undefined : Number(expiring) });
    const update = useUpdateGuest();
    const remove = useRemoveGuest();
    const revoke = useRevokeInvitation();
    const canSettings = usePermission("messaging.settings.manage");
    const [extending, setExtending] = useState<Membership | null>(null);
    const [until, setUntil] = useState("");
    const [removing, setRemoving] = useState<{ person: GuestPerson; m: Membership } | null>(null);
    const g = guests.data;

    return (
        <Page>
            <PageHeader title="Guests & external" description="Everyone outside your organization who can see channels, and until when." />
            <AdminNav />
            {g && !g.guest_access_enabled && !g.external_access_enabled && (
                <div className="mb-4 rounded-lg border border-warning/40 bg-warning-soft p-3 text-[13px] text-warning">
                    Guests and external participants are turned off.{canSettings && <> <Link to={MessagesPaths.adminSettings} className="font-medium underline">Change in settings</Link>.</>}
                </div>
            )}
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search name, email or company…">
                <Select value={expiring} onValueChange={setExpiring}>
                    <SelectTrigger className="h-8 w-full sm:w-48" aria-label="Expiring"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All guests</SelectItem>
                        <SelectItem value="7">Expiring within 7 days</SelectItem>
                        <SelectItem value="30">Expiring within 30 days</SelectItem>
                    </SelectContent>
                </Select>
            </TableToolbar>
            {guests.isPending ? <ListSkeleton rows={4} /> : guests.error ? <ErrorState error={guests.error} onRetry={() => guests.refetch()} /> : !g?.data.length ? (
                <EmptyState icon={UserRoundPlus} title="No external users" description="Guests and customer participants added to channels appear here." />
            ) : (
                <ul className="space-y-3">
                    {g.data.map((p) => (
                        <li key={p.key} className="rounded-lg border border-border bg-card">
                            <div className="flex flex-wrap items-center gap-2 border-b border-border-soft px-3 py-2.5">
                                <span className="text-[13px] font-medium text-foreground">{p.name}</span>
                                {p.email && <span className="text-xs text-muted-foreground">{p.email}</span>}
                                {p.label && <Badge variant="violet">{p.label}</Badge>}
                                <Badge variant="neutral">{p.external ? "External" : "Guest"}</Badge>
                            </div>
                            <ul className="divide-y divide-border-soft">
                                {p.memberships.map((m) => {
                                    const expired = m.access_expires_at && new Date(m.access_expires_at) < new Date();
                                    return (
                                        <li key={m.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[13px]">
                                            <Link to={MessagesPaths.channel(m.channel.id)} className="min-w-0 flex-1 truncate text-foreground hover:underline">#{m.channel.name ?? "conversation"}</Link>
                                            <span className={expired ? "text-xs text-danger" : "text-xs text-muted-foreground"}>
                                                {m.access_expires_at ? `${expired ? "Expired" : "Until"} ${formatDate(m.access_expires_at)}` : "No expiry"} · {m.last_viewed_at ? `seen ${formatRelative(m.last_viewed_at)}` : "never opened"}
                                            </span>
                                            <Button size="sm" variant="ghost" onClick={() => { setExtending(m); setUntil(m.access_expires_at?.slice(0, 10) ?? ""); }}><CalendarClock /> Expiry</Button>
                                            <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRemoving({ person: p, m })}><UserMinus /> Remove</Button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </li>
                    ))}
                </ul>
            )}
            {g && g.invitations.length > 0 && (
                <Section title="Pending invitations" className="mt-6">
                    <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                        {g.invitations.map((i) => (
                            <li key={i.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[13px]">
                                <span className="min-w-0 flex-1 truncate text-foreground">{i.name ? `${i.name} · ` : ""}{i.email}</span>
                                <span className="text-xs text-muted-foreground">#{i.channel.name} · link expires {formatDate(i.expires_at)}</span>
                                <Button size="sm" variant="ghost" onClick={() => revoke.mutate(i.id)}><MailX /> Revoke</Button>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}
            <Dialog open={!!extending} onOpenChange={(o) => !o && setExtending(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Access expiry</DialogTitle>
                        <DialogDescription>#{extending?.channel.name}. Leave empty for no expiry.</DialogDescription>
                    </DialogHeader>
                    {/* Saves as soon as a date is picked or cleared (no Save button). */}
                    <Input
                        type="date"
                        value={until}
                        onChange={(e) => {
                            setUntil(e.target.value);
                            if (extending) update.mutate({ memberId: extending.id, access_expires_at: e.target.value ? new Date(`${e.target.value}T23:59:59`).toISOString() : null });
                        }}
                        aria-label="Access until"
                    />
                    <DialogFooter>
                        <Button onClick={() => setExtending(null)}>Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ConfirmationDialog
                isOpen={!!removing}
                onClose={() => setRemoving(null)}
                title={`Remove ${removing?.person.name} from #${removing?.m.channel.name}?`}
                description="They lose access to the channel at once. Their earlier messages stay."
                confirmText="Remove"
                variant="destructive"
                onConfirm={() => { if (!removing) return; remove.mutate(removing.m.id); setRemoving(null); }}
            />
        </Page>
    );
}
