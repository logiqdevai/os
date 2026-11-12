import { Headphones, PhoneOff, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatRelative, personName } from "@/lib/format";
import { useCallAction, useCalls, useStartCall } from "@/features/messaging/hooks/use-messaging-admin";
import type { ChannelCall } from "@/features/messaging/interfaces/messaging-admin.interfaces";
import { PersonAvatar } from "./person-avatar";

/**
 * "Start huddle" button for the conversation header.
 * @perm messaging.calls.start + channel member + MessagingSettings.calls_enabled (the API answers 403 calls_disabled otherwise)
 * @api POST /messaging/channels/:id/calls
 */
export function StartHuddleButton({ channelId, disabled }: { channelId: string; disabled?: boolean }) {
    const canStart = usePermission("messaging.calls.start");
    const calls = useCalls({ status: "active", channel_id: channelId }, canStart);
    const start = useStartCall();
    if (!canStart || calls.data?.data.some((c) => c.live)) return null;
    const off = calls.data && !calls.data.calls_enabled;
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Start a huddle"
                        disabled={disabled || off || start.isPending}
                        onClick={() => start.mutate({ channelId, kind: "HUDDLE" }, { onError: (e) => toast({ variant: "destructive", title: "Could not start the huddle", description: getApiErrorMessage(e) }) })}
                    >
                        <Headphones />
                    </Button>
                </span>
            </TooltipTrigger>
            <TooltipContent>{off ? "Calls are turned off by an administrator" : "Start a huddle"}</TooltipContent>
        </Tooltip>
    );
}

/**
 * Banner of the running huddle / call of a channel: who is in it, join / leave / end. Media is not hosted by the platform;
 * an external meeting link opens in a new tab when the call has one.
 */
export function ActiveCallBar({ channelId, myMembershipId }: { channelId: string; myMembershipId: string | null }) {
    const calls = useCalls({ status: "active", channel_id: channelId });
    const action = useCallAction();
    const canStart = usePermission("messaging.calls.start");
    const call: ChannelCall | undefined = calls.data?.data.find((c) => c.live);
    if (!call) return null;
    const active = call.participants.filter((p) => p.joined_at && !p.left_at);
    const inCall = !!myMembershipId && call.active_participant_ids.includes(myMembershipId);
    const run = (a: "join" | "leave" | "end") =>
        action.mutate({ id: call.id, action: a }, { onError: (e) => toast({ variant: "destructive", title: "Could not update the call", description: getApiErrorMessage(e) }) });
    return (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-success-soft px-3 py-2 text-[13px] md:px-4" role="status">
            {call.kind === "VIDEO" ? <Video className="size-4 text-success" /> : <Headphones className="size-4 text-success" />}
            <span className="font-medium text-foreground">{call.title ?? (call.kind === "HUDDLE" ? "Huddle" : "Call")}</span>
            <span className="text-xs text-muted-foreground">started {formatRelative(call.started_at)}</span>
            <div className="flex -space-x-1.5" aria-label={`${active.length} in the call`}>
                {active.slice(0, 6).map((p) => (
                    <span key={p.id} title={personName(p.membership?.user)} className="rounded-full ring-2 ring-background">
                        <PersonAvatar size="sm" name={personName(p.membership?.user)} src={p.membership?.user.profile_photo_url ?? null} />
                    </span>
                ))}
            </div>
            <span className="text-xs text-muted-foreground">{active.length} in the call</span>
            <div className="ml-auto flex items-center gap-1.5">
                {call.meeting_url && <Button asChild size="sm" variant="outline"><a href={call.meeting_url} target="_blank" rel="noreferrer">Open meeting</a></Button>}
                {inCall ? (
                    <Button size="sm" variant="outline" onClick={() => run("leave")} loading={action.isPending}>Leave</Button>
                ) : (
                    canStart && <Button size="sm" onClick={() => run("join")} loading={action.isPending}>Join</Button>
                )}
                {inCall && (
                    <Button size="icon-sm" variant="ghost" aria-label="End for everyone" title="End for everyone" onClick={() => run("end")}><PhoneOff className="text-danger" /></Button>
                )}
            </div>
        </div>
    );
}
