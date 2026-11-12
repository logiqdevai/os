import { useEffect, useRef } from "react";
import { sendPublicEngagement } from "../services/proposals.services";

const INTERVAL_MS = 15_000;

/**
 * Tracking beacon for the public proposal page (03 "Proposal Tracking"): every 15 s while the tab is visible it reports
 * the seconds on page and the seconds each section was on screen (sections need `id="section-<id>"`). Also flushes when
 * the tab is hidden. Failures are silent: tracking must never disturb the customer.
 */
export function useEngagementBeacon(token: string, access: string | null, sectionIds: string[], enabled: boolean) {
    const visible = useRef(new Set<string>());
    const pending = useRef({ seconds: 0, sections: new Map<string, number>() });
    const session = useRef<string>("");
    const key = sectionIds.join(",");

    useEffect(() => {
        if (!enabled || !token) return;
        if (!session.current) session.current = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const observer = typeof IntersectionObserver !== "undefined"
            ? new IntersectionObserver((entries) => {
                for (const e of entries) {
                    const id = (e.target as HTMLElement).id.replace(/^section-/, "");
                    if (e.isIntersecting) visible.current.add(id);
                    else visible.current.delete(id);
                }
            }, { threshold: 0.35 })
            : null;
        for (const id of key ? key.split(",") : []) {
            const el = document.getElementById(`section-${id}`);
            if (el && observer) observer.observe(el);
        }

        let last = Date.now();
        const tick = () => {
            const now = Date.now();
            const secs = Math.min(120, Math.round((now - last) / 1000));
            last = now;
            if (document.visibilityState !== "visible" || secs <= 0) return;
            pending.current.seconds += secs;
            for (const id of visible.current) pending.current.sections.set(id, (pending.current.sections.get(id) ?? 0) + secs);
        };
        const flush = () => {
            tick();
            const { seconds, sections } = pending.current;
            if (seconds <= 0) return;
            pending.current = { seconds: 0, sections: new Map() };
            void sendPublicEngagement({
                token, access, seconds: Math.min(120, seconds), session_id: session.current,
                sections: [...sections.entries()].slice(0, 60).map(([id, s]) => ({ id, seconds: Math.min(120, s) })),
            }).catch(() => undefined);
        };
        const timer = window.setInterval(flush, INTERVAL_MS);
        const onVisibility = () => {
            if (document.visibilityState === "hidden") flush();
            else last = Date.now();
        };
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            flush();
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisibility);
            observer?.disconnect();
        };
    }, [token, access, key, enabled]);
}
