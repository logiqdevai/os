import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { CallMediaError, CallMediaErrorCode, CallMediaJoinAck, CallMediaStatus, CallPeer } from "../interfaces/messaging-admin.interfaces";

/** Used until the server's ack arrives; the server sends the same list (public STUN only — no TURN is configured). */
const DEFAULT_ICE: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const SPEAKING_LEVEL = 0.035;
const SPEAKING_POLL_MS = 150;

interface PeerEntry {
    pc: RTCPeerConnection;
    info: CallPeer;
    pendingCandidates: RTCIceCandidateInit[];
    audio: HTMLAudioElement;
}

export interface CallMediaState {
    callId: string | null;
    status: CallMediaStatus;
    error: CallMediaError | null;
    muted: boolean;
    camera: boolean;
    localStream: MediaStream | null;
    peers: CallPeer[];
    /** peer_id (or "me") → currently speaking. */
    speaking: Record<string, boolean>;
    /** Start media for a call the member already joined over REST (start / join). */
    connect: (callId: string, options?: { camera?: boolean }) => Promise<void>;
    /** Stop media in this tab (the caller also leaves the call over REST). */
    disconnect: () => void;
    toggleMute: () => void;
    toggleCamera: () => Promise<void>;
}

const mediaError = (code: CallMediaErrorCode, message: string): CallMediaError => ({ code, message });

function describeGetUserMediaError(e: unknown): CallMediaError {
    const name = (e as { name?: string })?.name ?? "";
    if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
        return mediaError("permission_denied", "Microphone access is blocked. Allow it in your browser's site settings, then rejoin. You can still listen.");
    }
    if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") return mediaError("no_device", "No microphone was found. You can still listen to the others.");
    if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return mediaError("device_busy", "Your microphone is used by another app. Close it and rejoin. You can still listen.");
    return mediaError("no_device", "Could not start your microphone. You can still listen to the others.");
}

/**
 * In-app audio (+ optional camera) for huddles and calls (12 §44): a WebRTC mesh between up to `max_peers` members,
 * signaled over the `/messaging` socket (`call.media.*`, `call.signal`). The newcomer sends one offer to every peer already
 * in the call; every connection has fixed audio + video transceivers, so muting and the camera never need renegotiation.
 *
 * Degrades instead of failing: no microphone / permission denied → listen only; call full, no WebRTC, insecure page or
 * socket problems → "presence only" (the member stays listed in the call through the REST participant row).
 */
export function useCallMedia(socket: Socket | null): CallMediaState {
    const [callId, setCallId] = useState<string | null>(null);
    const [status, setStatus] = useState<CallMediaStatus>("idle");
    const [error, setError] = useState<CallMediaError | null>(null);
    const [muted, setMuted] = useState(false);
    const [camera, setCamera] = useState(false);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [peers, setPeers] = useState<CallPeer[]>([]);
    const [speaking, setSpeaking] = useState<Record<string, boolean>>({});

    const callRef = useRef<string | null>(null);
    const localRef = useRef<MediaStream | null>(null);
    const peersRef = useRef(new Map<string, PeerEntry>());
    const iceRef = useRef<RTCIceServer[]>(DEFAULT_ICE);
    const mutedRef = useRef(false);
    const cameraRef = useRef(false);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analysersRef = useRef(new Map<string, { analyser: AnalyserNode; source: MediaStreamAudioSourceNode; data: Float32Array<ArrayBuffer> }>());
    const socketRef = useRef<Socket | null>(socket);

    const publishPeers = useCallback(() => setPeers([...peersRef.current.values()].map((p) => ({ ...p.info }))), []);

    // --- speaking indicator (local + remote audio levels) ------------------------------------------------
    const watchLevel = useCallback((key: string, stream: MediaStream | null) => {
        const old = analysersRef.current.get(key);
        if (old) {
            old.source.disconnect();
            analysersRef.current.delete(key);
        }
        if (!stream || !stream.getAudioTracks().length || typeof window === "undefined" || !("AudioContext" in window)) return;
        try {
            audioCtxRef.current ??= new AudioContext();
            const ctx = audioCtxRef.current;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            source.connect(analyser);
            analysersRef.current.set(key, { analyser, source, data: new Float32Array(new ArrayBuffer(analyser.fftSize * 4)) });
        } catch {
            /* the indicator is optional */
        }
    }, []);

    useEffect(() => {
        if (!callId) return;
        const timer = setInterval(() => {
            const next: Record<string, boolean> = {};
            for (const [key, a] of analysersRef.current) {
                a.analyser.getFloatTimeDomainData(a.data);
                let sum = 0;
                for (let i = 0; i < a.data.length; i++) sum += a.data[i] * a.data[i];
                next[key] = Math.sqrt(sum / a.data.length) > SPEAKING_LEVEL && !(key === "me" && mutedRef.current);
            }
            setSpeaking((prev) => {
                const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
                for (const k of keys) if (!!prev[k] !== !!next[k]) return next;
                return prev;
            });
        }, SPEAKING_POLL_MS);
        return () => clearInterval(timer);
    }, [callId]);

    // --- peer connections ---------------------------------------------------------------------------------
    const closePeer = useCallback((peerId: string) => {
        const entry = peersRef.current.get(peerId);
        if (!entry) return;
        entry.pc.onicecandidate = null;
        entry.pc.ontrack = null;
        entry.pc.onconnectionstatechange = null;
        entry.pc.close();
        entry.audio.srcObject = null;
        entry.audio.remove();
        peersRef.current.delete(peerId);
        watchLevel(peerId, null);
    }, [watchLevel]);

    /** Attach local tracks (or nothing = silence / no video) to the fixed transceivers. */
    const attachLocalTracks = useCallback((pc: RTCPeerConnection) => {
        const stream = localRef.current;
        for (const t of pc.getTransceivers()) {
            const kind = t.receiver.track?.kind;
            if (!kind) continue;
            t.direction = "sendrecv";
            const track = kind === "audio" ? stream?.getAudioTracks()[0] ?? null : cameraRef.current ? stream?.getVideoTracks()[0] ?? null : null;
            void t.sender.replaceTrack(track).catch(() => undefined);
        }
    }, []);

    const createPeer = useCallback((peerId: string, info: Omit<CallPeer, "stream" | "connection">) => {
        closePeer(peerId);
        const pc = new RTCPeerConnection({ iceServers: iceRef.current });
        const audio = document.createElement("audio");
        audio.autoplay = true;
        audio.setAttribute("playsinline", "");
        audio.dataset.callPeer = peerId;
        audio.style.display = "none";
        document.body.appendChild(audio);
        const entry: PeerEntry = { pc, audio, pendingCandidates: [], info: { ...info, stream: null, connection: "new" } };
        peersRef.current.set(peerId, entry);
        pc.onicecandidate = (e) => {
            if (e.candidate && callRef.current) socketRef.current?.emit("call.signal", { call_id: callRef.current, to: peerId, candidate: e.candidate.toJSON() });
        };
        pc.ontrack = (e) => {
            const stream = entry.info.stream ?? new MediaStream();
            if (!stream.getTracks().includes(e.track)) stream.addTrack(e.track);
            entry.info = { ...entry.info, stream };
            if (e.track.kind === "audio") {
                // A fresh MediaStream reference makes the <audio> element pick up the new track.
                entry.audio.srcObject = new MediaStream(stream.getAudioTracks());
                void entry.audio.play().catch(() => undefined);
                watchLevel(peerId, entry.audio.srcObject as MediaStream);
            }
            e.track.onunmute = () => publishPeers();
            publishPeers();
        };
        pc.onconnectionstatechange = () => {
            entry.info = { ...entry.info, connection: pc.connectionState };
            publishPeers();
        };
        publishPeers();
        return entry;
    }, [closePeer, publishPeers, watchLevel]);

    const offerTo = useCallback(async (peer: { peer_id: string; membership_id: string; name: string; media: { muted: boolean; camera: boolean } }) => {
        const entry = createPeer(peer.peer_id, { peer_id: peer.peer_id, membership_id: peer.membership_id, name: peer.name, muted: peer.media.muted, camera: peer.media.camera });
        entry.pc.addTransceiver("audio", { direction: "sendrecv" });
        entry.pc.addTransceiver("video", { direction: "sendrecv" });
        attachLocalTracks(entry.pc);
        const offer = await entry.pc.createOffer();
        await entry.pc.setLocalDescription(offer);
        socketRef.current?.emit("call.signal", { call_id: callRef.current, to: peer.peer_id, description: entry.pc.localDescription?.toJSON() });
    }, [attachLocalTracks, createPeer]);

    const teardown = useCallback(() => {
        for (const id of [...peersRef.current.keys()]) closePeer(id);
        localRef.current?.getTracks().forEach((t) => t.stop());
        localRef.current = null;
        for (const a of analysersRef.current.values()) a.source.disconnect();
        analysersRef.current.clear();
        void audioCtxRef.current?.close().catch(() => undefined);
        audioCtxRef.current = null;
        callRef.current = null;
        cameraRef.current = false;
        setLocalStream(null);
        setPeers([]);
        setSpeaking({});
        setCamera(false);
        setCallId(null);
        setStatus("idle");
    }, [closePeer]);

    // --- signaling events ---------------------------------------------------------------------------------
    useEffect(() => {
        socketRef.current = socket;
        if (!socket) return;
        const onSignal = async (m: { call_id: string; from: string; membership_id: string; description: RTCSessionDescriptionInit | null; candidate: RTCIceCandidateInit | null }) => {
            if (m.call_id !== callRef.current) return;
            try {
                if (m.description?.type === "offer") {
                    const known = peersRef.current.get(m.from)?.info;
                    const entry = createPeer(m.from, known ?? { peer_id: m.from, membership_id: m.membership_id, name: "", muted: false, camera: false });
                    await entry.pc.setRemoteDescription(m.description);
                    attachLocalTracks(entry.pc);
                    const answer = await entry.pc.createAnswer();
                    await entry.pc.setLocalDescription(answer);
                    socket.emit("call.signal", { call_id: m.call_id, to: m.from, description: entry.pc.localDescription?.toJSON() });
                    for (const c of entry.pendingCandidates.splice(0)) await entry.pc.addIceCandidate(c).catch(() => undefined);
                } else if (m.description?.type === "answer") {
                    const entry = peersRef.current.get(m.from);
                    if (!entry) return;
                    await entry.pc.setRemoteDescription(m.description);
                    for (const c of entry.pendingCandidates.splice(0)) await entry.pc.addIceCandidate(c).catch(() => undefined);
                } else if (m.candidate) {
                    const entry = peersRef.current.get(m.from);
                    if (!entry) return;
                    if (entry.pc.remoteDescription) await entry.pc.addIceCandidate(m.candidate).catch(() => undefined);
                    else entry.pendingCandidates.push(m.candidate);
                }
            } catch {
                const entry = peersRef.current.get(m.from);
                if (entry) {
                    entry.info = { ...entry.info, connection: "failed" };
                    publishPeers();
                }
            }
        };
        const onJoined = (p: { call_id: string; peer_id: string; membership_id: string; name: string; media: { muted: boolean; camera: boolean } }) => {
            if (p.call_id !== callRef.current) return;
            // The newcomer sends the offer; keep its name until then.
            createPeer(p.peer_id, { peer_id: p.peer_id, membership_id: p.membership_id, name: p.name, muted: p.media.muted, camera: p.media.camera });
        };
        const onLeft = (p: { call_id: string; peer_id: string | null; membership_id: string }) => {
            if (p.call_id !== callRef.current) return;
            for (const [id, entry] of peersRef.current) if (id === p.peer_id || (!p.peer_id && entry.info.membership_id === p.membership_id)) closePeer(id);
            publishPeers();
        };
        const onState = (p: { call_id: string; peer_id: string; muted: boolean; camera: boolean }) => {
            const entry = peersRef.current.get(p.peer_id);
            if (p.call_id !== callRef.current || !entry) return;
            entry.info = { ...entry.info, muted: p.muted, camera: p.camera };
            publishPeers();
        };
        const onEnded = (p: { call_id: string }) => {
            if (p.call_id === callRef.current) teardown();
        };
        const onDisconnect = () => {
            if (!callRef.current) return;
            for (const id of [...peersRef.current.keys()]) closePeer(id);
            publishPeers();
            setError(mediaError("disconnected", "Connection lost. Reconnecting…"));
            setStatus("connecting");
        };
        const onReconnect = () => {
            const id = callRef.current;
            if (!id) return;
            // The server dropped this socket from the call; join again (the call may have ended meanwhile).
            socket.emit("call.media.join", { call_id: id, muted: mutedRef.current, camera: cameraRef.current }, (ack: CallMediaJoinAck) => {
                if (!ack.ok) {
                    teardown();
                    return;
                }
                setError(null);
                setStatus(localRef.current?.getAudioTracks().length ? "connected" : "listen_only");
                ack.peers.forEach((p) => void offerTo(p).catch(() => undefined));
            });
        };
        socket.on("call.signal", onSignal);
        socket.on("call.peer.joined", onJoined);
        socket.on("call.peer.left", onLeft);
        socket.on("call.peer.state", onState);
        socket.on("call.ended", onEnded);
        socket.on("disconnect", onDisconnect);
        socket.on("connect", onReconnect);
        return () => {
            socket.off("call.signal", onSignal);
            socket.off("call.peer.joined", onJoined);
            socket.off("call.peer.left", onLeft);
            socket.off("call.peer.state", onState);
            socket.off("call.ended", onEnded);
            socket.off("disconnect", onDisconnect);
            socket.off("connect", onReconnect);
        };
    }, [socket, attachLocalTracks, closePeer, createPeer, offerTo, publishPeers, teardown]);

    // Leaving the Messages app (unmount) stops media; the socket disconnect closes the participant row server-side.
    useEffect(() => () => {
        if (callRef.current) socketRef.current?.emit("call.media.leave", { call_id: callRef.current });
        for (const entry of peersRef.current.values()) {
            entry.pc.close();
            entry.audio.remove();
        }
        peersRef.current.clear();
        localRef.current?.getTracks().forEach((t) => t.stop());
        void audioCtxRef.current?.close().catch(() => undefined);
    }, []);

    // --- actions --------------------------------------------------------------------------------------------
    const connect = useCallback(async (id: string, options?: { camera?: boolean }) => {
        if (callRef.current === id) return;
        if (callRef.current) {
            socketRef.current?.emit("call.media.leave", { call_id: callRef.current });
            teardown();
        }
        setError(null);
        setCallId(id);
        callRef.current = id;
        setStatus("connecting");
        mutedRef.current = false;
        setMuted(false);

        if (typeof window === "undefined" || !("RTCPeerConnection" in window)) {
            setError(mediaError("unsupported", "This browser cannot do in-app calls. You are listed in the call; use a meeting link for audio."));
            setStatus("presence_only");
            return;
        }
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
            setError(mediaError("insecure_context", "Audio needs a secure (https) page. You are listed in the call."));
            setStatus("presence_only");
            return;
        }
        const s = socketRef.current;
        if (!s?.connected) {
            setError(mediaError("disconnected", "Live connection is offline, so audio cannot start. You are listed in the call."));
            setStatus("presence_only");
            return;
        }

        let stream: MediaStream | null = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: options?.camera ? { width: { ideal: 640 }, height: { ideal: 360 } } : false });
        } catch (e) {
            if (options?.camera) {
                // Camera problems should not cost the audio: retry audio only.
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                } catch (e2) {
                    setError(describeGetUserMediaError(e2));
                }
            } else {
                setError(describeGetUserMediaError(e));
            }
        }
        if (callRef.current !== id) {
            stream?.getTracks().forEach((t) => t.stop());
            return;
        }
        localRef.current = stream;
        cameraRef.current = !!stream?.getVideoTracks().length;
        setCamera(cameraRef.current);
        setLocalStream(stream);
        watchLevel("me", stream);

        const ack = await new Promise<CallMediaJoinAck>((resolve) => {
            const timer = setTimeout(() => resolve({ ok: false, code: "join_failed", message: "The server did not answer. You are listed in the call." }), 10_000);
            s.emit("call.media.join", { call_id: id, muted: false, camera: cameraRef.current }, (a: CallMediaJoinAck) => {
                clearTimeout(timer);
                resolve(a);
            });
        });
        if (callRef.current !== id) return;
        if (!ack.ok) {
            localRef.current?.getTracks().forEach((t) => t.stop());
            localRef.current = null;
            setLocalStream(null);
            watchLevel("me", null);
            setError(mediaError(ack.code === "call_full" ? "call_full" : "join_failed", ack.message));
            setStatus("presence_only");
            return;
        }
        iceRef.current = ack.ice_servers?.length ? ack.ice_servers : DEFAULT_ICE;
        setStatus(stream?.getAudioTracks().length ? "connected" : "listen_only");
        for (const p of ack.peers) await offerTo(p).catch(() => undefined);
    }, [offerTo, teardown, watchLevel]);

    const disconnect = useCallback(() => {
        if (callRef.current) socketRef.current?.emit("call.media.leave", { call_id: callRef.current });
        teardown();
        setError(null);
    }, [teardown]);

    const toggleMute = useCallback(() => {
        const track = localRef.current?.getAudioTracks()[0];
        if (!track || !callRef.current) return;
        const next = !mutedRef.current;
        track.enabled = !next;
        mutedRef.current = next;
        setMuted(next);
        socketRef.current?.emit("call.media.state", { call_id: callRef.current, muted: next, camera: cameraRef.current });
    }, []);

    const toggleCamera = useCallback(async () => {
        const id = callRef.current;
        if (!id) return;
        if (cameraRef.current) {
            localRef.current?.getVideoTracks().forEach((t) => {
                t.stop();
                localRef.current?.removeTrack(t);
            });
            cameraRef.current = false;
        } else {
            let track: MediaStreamTrack | undefined;
            try {
                track = (await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 360 } } })).getVideoTracks()[0];
            } catch (e) {
                const err = describeGetUserMediaError(e);
                setError({ code: err.code, message: err.code === "permission_denied" ? "Camera access is blocked. Allow it in your browser's site settings." : err.code === "no_device" ? "No camera was found." : "Your camera is used by another app." });
                return;
            }
            if (!track || callRef.current !== id) {
                track?.stop();
                return;
            }
            localRef.current ??= new MediaStream();
            localRef.current.addTrack(track);
            cameraRef.current = true;
        }
        for (const entry of peersRef.current.values()) attachLocalTracks(entry.pc);
        setCamera(cameraRef.current);
        setLocalStream(localRef.current ? new MediaStream(localRef.current.getTracks()) : null);
        socketRef.current?.emit("call.media.state", { call_id: id, muted: mutedRef.current, camera: cameraRef.current });
    }, [attachLocalTracks]);

    return useMemo(
        () => ({ callId, status, error, muted, camera, localStream, peers, speaking, connect, disconnect, toggleMute, toggleCamera }),
        [callId, status, error, muted, camera, localStream, peers, speaking, connect, disconnect, toggleMute, toggleCamera],
    );
}
