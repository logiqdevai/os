import { useEffect, useRef } from "react";
import { Link, useMatch } from "react-router-dom";
import { Headphones, Mic, MicOff, PhoneOff, Video, VideoOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { formatRelative, personName } from "@/lib/format";
import { useCallAction, useCalls, useStartCall } from "@/features/messaging/hooks/use-messaging-admin";
import type { ChannelCall } from "@/features/messaging/interfaces/messaging-admin.interfaces";
import { PersonAvatar } from "./person-avatar";
import { useMessaging } from "./messaging-context";
import { MessagesPaths } from "../messages-paths";

/**
 * "Start huddle" button for the conversation header. Starting also connects your microphone (WebRTC mesh).
 * @perm messaging.calls.start + channel member + MessagingSettings.calls_enabled (the API answers 403 calls_disabled otherwise)
 * @api POST /messaging/channels/:id/calls · socket call.media.join
 */
export function StartHuddleButton({ channelId, disabled }: { channelId: string; disabled?: boolean }) {
    const canStart = usePermission("messaging.calls.start");
    const calls = useCalls({ status: "active", channel_id: channelId }, canStart);
    const start = useStartCall();
    const { call: media } = useMessaging();
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
                        onClick={() =>
                            start.mutate(
                                { channelId, kind: "HUDDLE" },
                                { onSuccess: (c) => void media.connect(c.id), onError: (e) => toast({ variant: "destructive", title: "Could not start the huddle", description: getApiErrorMessage(e) }) },
                            )
                        }
                    >
                        <Headphones />
                    </Button>
                </span>
            </TooltipTrigger>
            <TooltipContent>{off ? "Calls are turned off by an administrator" : "Start a huddle"}</TooltipContent>
        </Tooltip>
    );
}

/** Join / leave that also starts or stops in-app audio. Used by the call bar and the calls page. */
export function useCallControls(call: ChannelCall | undefined) {
    const action = useCallAction();
    const { call: media, myMembershipId } = useMessaging();
    const inCall = !!call && !!myMembershipId && call.active_participant_ids.includes(myMembershipId);
    const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });
    return {
        pending: action.isPending,
        inCall,
        mediaHere: !!call && media.callId === call.id,
        join: () => call && action.mutate({ id: call.id, action: "join" }, { onSuccess: () => void media.connect(call.id), onError: fail("Could not join the call") }),
        leave: () => {
            if (!call) return;
            if (media.callId === call.id) media.disconnect();
            action.mutate({ id: call.id, action: "leave" }, { onError: fail("Could not leave the call") });
        },
        end: () => {
            if (!call) return;
            if (media.callId === call.id) media.disconnect();
            action.mutate({ id: call.id, action: "end" }, { onError: fail("Could not end the call") });
        },
        connectAudio: () => call && void media.connect(call.id),
    };
}

/**
 * Banner of the running huddle / call of a channel: who is in it (speaking ring), join / leave / end, mute, camera and a
 * video grid while anyone shares a camera. Media is peer-to-peer WebRTC for up to 6 people; when it cannot start the
 * member stays listed in the call and the reason is shown (permission denied, no microphone, call full, offline …).
 */
export function ActiveCallBar({ channelId, myMembershipId }: { channelId: string; myMembershipId: string | null }) {
    const calls = useCalls({ status: "active", channel_id: channelId });
    const canStart = usePermission("messaging.calls.start");
    const { call: media } = useMessaging();
    const call: ChannelCall | undefined = calls.data?.data.find((c) => c.live);
    const controls = useCallControls(call);
    if (!call) return null;
    const active = call.participants.filter((p) => p.joined_at && !p.left_at);
    const here = controls.mediaHere;
    const speakingMembers = new Set<string>();
    if (here) {
        for (const p of media.peers) if (media.speaking[p.peer_id] && !p.muted) speakingMembers.add(p.membership_id);
        if (media.speaking.me && myMembershipId) speakingMembers.add(myMembershipId);
    }
    const showVideo = here && (media.camera || media.peers.some((p) => p.camera && p.stream?.getVideoTracks().length));
    return (
        <div className="border-b border-border bg-success-soft" role="region" aria-label="Huddle">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-[13px] md:px-4">
                {call.kind === "VIDEO" ? <Video className="size-4 text-success" /> : <Headphones className="size-4 text-success" />}
                <span className="font-medium text-foreground">{call.title ?? (call.kind === "HUDDLE" ? "Huddle" : "Call")}</span>
                <span className="hidden text-xs text-muted-foreground sm:inline">started {formatRelative(call.started_at)}</span>
                <div className="flex -space-x-1.5" aria-label={`${active.length} in the call`}>
                    {active.slice(0, 6).map((p) => {
                        const talking = !!p.membership_id && speakingMembers.has(p.membership_id);
                        return (
                            <span key={p.id} title={`${personName(p.membership?.user)}${talking ? " (speaking)" : ""}`} className={cn("rounded-full ring-2 transition-shadow", talking ? "ring-success" : "ring-background")}>
                                <PersonAvatar size="sm" name={personName(p.membership?.user)} src={p.membership?.user.profile_photo_url ?? null} />
                            </span>
                        );
                    })}
                </div>
                <span className="text-xs text-muted-foreground">{active.length} in the call</span>
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                    {call.meeting_url && <Button asChild size="sm" variant="outline"><a href={call.meeting_url} target="_blank" rel="noreferrer">Open meeting</a></Button>}
                    {controls.inCall && here && <MediaButtons />}
                    {controls.inCall && !here && <Button size="sm" variant="outline" onClick={controls.connectAudio}><Mic /> Connect audio</Button>}
                    {controls.inCall ? (
                        <Button size="sm" variant="outline" onClick={controls.leave} loading={controls.pending}><PhoneOff /> Leave</Button>
                    ) : (
                        canStart && <Button size="sm" onClick={controls.join} loading={controls.pending}><Headphones /> Join</Button>
                    )}
                    {controls.inCall && (
                        <Button size="icon-sm" variant="ghost" aria-label="End for everyone" title="End for everyone" onClick={controls.end}><PhoneOff className="text-danger" /></Button>
                    )}
                </div>
            </div>
            {here && <MediaStatusLine />}
            {showVideo && <VideoGrid />}
        </div>
    );
}

/** Mute + camera toggles for the call whose media runs in this tab. */
function MediaButtons() {
    const { call: media } = useMessaging();
    const hasMic = !!media.localStream?.getAudioTracks().length;
    return (
        <>
            <Button size="icon-sm" variant={media.muted ? "destructive" : "outline"} disabled={!hasMic} onClick={media.toggleMute} aria-pressed={media.muted} aria-label={media.muted ? "Unmute" : "Mute"} title={hasMic ? (media.muted ? "Unmute" : "Mute") : "No microphone"}>
                {media.muted || !hasMic ? <MicOff /> : <Mic />}
            </Button>
            <Button size="icon-sm" variant="outline" disabled={media.status === "presence_only"} onClick={() => void media.toggleCamera()} aria-pressed={media.camera} aria-label={media.camera ? "Turn camera off" : "Turn camera on"} title={media.camera ? "Turn camera off" : "Turn camera on"}>
                {media.camera ? <Video /> : <VideoOff />}
            </Button>
        </>
    );
}

function MediaStatusLine() {
    const { call: media } = useMessaging();
    const failed = media.peers.filter((p) => p.connection === "failed");
    if (media.status === "connecting" && !media.error) return <p className="px-3 pb-2 text-xs text-muted-foreground md:px-4">Connecting audio…</p>;
    if (!media.error && media.status === "connected" && !failed.length) return null;
    return (
        <p className="flex items-start gap-1.5 px-3 pb-2 text-xs text-warning md:px-4" role="status">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
                {media.error?.message ?? (media.status === "listen_only" ? "Listening only — your microphone is not connected." : "")}
                {failed.length > 0 && ` Could not reach ${failed.map((p) => p.name || "a participant").join(", ")} (network blocks peer-to-peer audio).`}
            </span>
        </p>
    );
}

function VideoTile({ stream, label, muted, mirrored }: { stream: MediaStream | null; label: string; muted?: boolean; mirrored?: boolean }) {
    const ref = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
    }, [stream]);
    const hasVideo = !!stream?.getVideoTracks().some((t) => t.readyState === "live");
    return (
        <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-card">
            {hasVideo ? (
                <video ref={ref} autoPlay playsInline muted className={cn("size-full object-cover", mirrored && "-scale-x-100")} />
            ) : (
                <div className="grid size-full place-items-center"><PersonAvatar name={label} size="md" src={null} /></div>
            )}
            <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-background/80 px-1.5 py-0.5 text-[11px] text-foreground">
                {muted && <MicOff className="size-3" />} {label}
            </span>
        </div>
    );
}

/** Camera tiles (you + peers); audio plays through hidden <audio> elements owned by the media hook. */
function VideoGrid() {
    const { call: media } = useMessaging();
    return (
        <div className="grid grid-cols-2 gap-2 px-3 pb-3 sm:grid-cols-3 md:px-4 lg:grid-cols-4">
            <VideoTile stream={media.camera ? media.localStream : null} label="You" muted={media.muted} mirrored />
            {media.peers.map((p) => <VideoTile key={p.peer_id} stream={p.camera ? p.stream : null} label={p.name || "Participant"} muted={p.muted} />)}
        </div>
    );
}

/**
 * Floating "you are in a huddle" pill shown everywhere in Messages (except the call's own channel) while your media runs,
 * so you can mute or leave after navigating elsewhere.
 */
export function OngoingCallStrip() {
    const { call: media } = useMessaging();
    const currentChannelId = useMatch(`${MessagesPaths.root}/c/:channelId`)?.params.channelId ?? null;
    const calls = useCalls({ status: "active" }, !!media.callId);
    const call = calls.data?.data.find((c) => c.id === media.callId);
    const controls = useCallControls(call);
    if (!media.callId || !call || call.channel_id === currentChannelId) return null;
    return (
        <div className="fixed bottom-20 left-4 right-4 z-40 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px] shadow-lg sm:left-auto sm:max-w-md" role="region" aria-label="Ongoing huddle">
            <Headphones className="size-4 text-success" />
            <Link to={MessagesPaths.channel(call.channel_id)} className="min-w-0 truncate font-medium text-foreground hover:underline">
                In a huddle · {call.channel.name ? `#${call.channel.name}` : "Direct message"}
            </Link>
            <div className="ml-auto flex items-center gap-1.5">
                <MediaButtons />
                <Button size="sm" variant="outline" onClick={controls.leave} loading={controls.pending}><PhoneOff /> Leave</Button>
            </div>
        </div>
    );
}
