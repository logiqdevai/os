import { useState } from "react";
import { Link } from "react-router-dom";
import { Headphones, Info, PhoneOff, Video } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { usePermission } from "@/hooks/use-permission";
import { formatDateTime, formatRelative, personName } from "@/lib/format";
import { useCalls } from "@/features/messaging/hooks/use-messaging-admin";
import type { ChannelCall } from "@/features/messaging/interfaces/messaging-admin.interfaces";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ChannelCallKindOptions } from "@/config/constants/dropdowns/messaging/messaging-admin.options";
import { PersonAvatar } from "../components/person-avatar";
import { useCallControls } from "../components/call-bar";
import { MessagesPaths } from "../messages-paths";

const duration = (s: number | null) => (s === null ? "—" : s < 60 ? `${s}s` : `${Math.round(s / 60)} min`);

function CallRow({ call }: { call: ChannelCall }) {
    const controls = useCallControls(call.live ? call : undefined);
    const canStart = usePermission("messaging.calls.start");
    const active = call.participants.filter((p) => p.joined_at && !p.left_at);
    const shown = call.live ? active : call.participants.filter((p) => p.joined_at);
    const inCall = controls.inCall;
    const Icon = call.kind === "VIDEO" ? Video : Headphones;
    return (
        <li className="flex flex-wrap items-center gap-3 px-3 py-3">
            <span className={call.live ? "grid size-8 place-items-center rounded-md bg-success-soft text-success" : "grid size-8 place-items-center rounded-md bg-secondary text-muted-foreground"}><Icon className="size-4" /></span>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-foreground">
                    <Link to={MessagesPaths.channel(call.channel_id)} className="hover:underline">{call.channel.name ? `#${call.channel.name}` : "Direct message"}</Link>
                    <Badge variant={call.live ? "success" : "neutral"}>{call.live ? "Live" : getDropdownOptionLabel(ChannelCallKindOptions, call.kind)}</Badge>
                    {call.title && <span className="truncate text-muted-foreground">{call.title}</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                    {call.started_by ? `${personName(call.started_by.user)} · ` : ""}
                    {call.live ? `started ${formatRelative(call.started_at)}` : `${formatDateTime(call.started_at)} · ${duration(call.duration_seconds)} · ${call.participant_count} joined`}
                </div>
            </div>
            <div className="flex -space-x-1.5">
                {shown.slice(0, 5).map((p) => (
                    <span key={p.id} className="rounded-full ring-2 ring-background" title={personName(p.membership?.user)}>
                        <PersonAvatar size="sm" name={personName(p.membership?.user)} src={p.membership?.user.profile_photo_url ?? null} />
                    </span>
                ))}
            </div>
            {call.live && (
                <div className="flex gap-1.5">
                    {inCall && !controls.mediaHere && <Button size="sm" variant="outline" onClick={controls.connectAudio}>Connect audio</Button>}
                    {inCall ? <Button size="sm" variant="outline" onClick={controls.leave} loading={controls.pending}>Leave</Button> : canStart && <Button size="sm" onClick={controls.join} loading={controls.pending}>Join</Button>}
                    {inCall && <Button size="icon-sm" variant="ghost" aria-label="End for everyone" onClick={controls.end}><PhoneOff className="text-danger" /></Button>}
                </div>
            )}
        </li>
    );
}

/**
 * /messages/calls — live huddles and call history.
 * Audio (+ optional camera) is peer-to-peer WebRTC for up to 6 people (signaled over the /messaging socket); larger groups
 * or blocked networks fall back to "who is in the call", and calls with a meeting link open it.
 * @perm messaging.channels.read (list) · join / start messaging.calls.start
 * @api GET /messaging/calls?status=active|recent · POST /messaging/calls/:id/join|leave|end · socket call.media.join / call.signal
 */
export default function CallsPage() {
    const [tab, setTab] = useState<"active" | "recent">("active");
    const calls = useCalls({ status: tab });
    const canSettings = usePermission("messaging.settings.manage");
    return (
        <Page>
            <PageHeader title="Huddles & calls" description="See who is talking now and join with one click. Start a huddle from any channel header." />
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-info-soft p-3 text-[13px] text-info">
                <Info className="mt-0.5 size-4 shrink-0" />
                <span>Huddles have built-in audio and an optional camera for up to {calls.data?.media?.max_peers ?? 6} people. Your browser asks for the microphone when you join. For bigger meetings use a meeting link (Meet, Zoom, Teams).</span>
            </div>
            {calls.data && !calls.data.calls_enabled && (
                <div className="mb-4 rounded-lg border border-warning/40 bg-warning-soft p-3 text-[13px] text-warning">
                    Calls are turned off for your organization.{canSettings && <> <Link to={MessagesPaths.adminSettings} className="font-medium underline">Turn them on in settings</Link>.</>}
                </div>
            )}
            <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "recent")}>
                <TabsList><TabsTrigger value="active">Live now</TabsTrigger><TabsTrigger value="recent">History</TabsTrigger></TabsList>
            </Tabs>
            <Section className="mt-3">
                {calls.isPending ? <ListSkeleton rows={3} /> : calls.error ? <ErrorState error={calls.error} onRetry={() => calls.refetch()} /> : !calls.data.data.length ? (
                    <EmptyState icon={Headphones} title={tab === "active" ? "Nobody is in a call" : "No calls yet"} description={tab === "active" ? "Start a huddle from the header of a channel or direct message." : "Ended huddles and calls appear here."} />
                ) : (
                    <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                        {calls.data.data.map((c) => <CallRow key={c.id} call={c} />)}
                    </ul>
                )}
            </Section>
        </Page>
    );
}
