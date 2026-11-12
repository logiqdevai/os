/**
 * Tracks real user interaction for the organization's idle timeout (01 §73). Requests made while the person is not
 * interacting (polling, focus refetches) are sent with `X-Client-Active: 0` so they do not keep the session alive.
 */
const ACTIVE_WINDOW_MS = 60_000;
let lastInteraction = Date.now();
let started = false;

function mark() {
    lastInteraction = Date.now();
}

export function startUserActivityTracking() {
    if (started || typeof window === "undefined") return;
    started = true;
    for (const event of ["pointerdown", "keydown", "wheel", "touchstart"] as const) {
        window.addEventListener(event, mark, { passive: true, capture: true });
    }
}

/** True when the person clicked, typed or scrolled within the last minute. */
export const isUserActive = () => Date.now() - lastInteraction < ACTIVE_WINDOW_MS;
