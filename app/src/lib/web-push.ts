/**
 * Browser side of Web Push (14 §5): service worker `public/sw.js`, permission prompt and PushManager subscription.
 * The API owns the VAPID key pair (GET /notifications/devices/push-config) and stores the subscription per user device.
 */

export type BrowserPushState = "unsupported" | "insecure" | "denied" | "default" | "granted";

export function browserPushSupported() {
    return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Permission state, or why push cannot work in this browser / on this origin. */
export function browserPushState(): BrowserPushState {
    if (!browserPushSupported()) return "unsupported";
    if (!window.isSecureContext) return "insecure";
    return Notification.permission as BrowserPushState;
}

function urlBase64ToUint8Array(base64: string) {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
}

async function registration() {
    const existing = await navigator.serviceWorker.getRegistration("/");
    const reg = existing ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
    await navigator.serviceWorker.ready;
    return reg;
}

/** The current subscription of this browser, if any (no prompt). */
export async function currentPushSubscription() {
    if (!browserPushSupported()) return null;
    const reg = await navigator.serviceWorker.getRegistration("/");
    return reg ? reg.pushManager.getSubscription() : null;
}

/**
 * Ask for permission (must run from a click) and subscribe with the deployment's public key. A subscription made with
 * another key (key rotated) is replaced. Returns the subscription JSON to register with the API.
 */
export async function subscribeBrowserPush(publicKey: string): Promise<PushSubscriptionJSON> {
    if (!browserPushSupported()) throw new Error("This browser does not support push notifications.");
    if (!window.isSecureContext) throw new Error("Push notifications need a secure (https) address.");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error(permission === "denied" ? "Notifications are blocked for this site. Allow them in the browser's site settings." : "Permission was not granted.");
    const reg = await registration();
    const key = urlBase64ToUint8Array(publicKey);
    let sub = await reg.pushManager.getSubscription();
    if (sub) {
        const current = sub.options.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
        const same = !!current && current.length === key.length && current.every((b, i) => b === key[i]);
        if (!same) {
            await sub.unsubscribe();
            sub = null;
        }
    }
    sub = sub ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
    return sub.toJSON();
}

/** Stop push in this browser (the API row is removed separately). */
export async function unsubscribeBrowserPush() {
    const sub = await currentPushSubscription();
    if (sub) await sub.unsubscribe();
}
