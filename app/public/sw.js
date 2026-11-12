/*
 * Logiqdev OS service worker — Web Push for notifications (14 §5).
 * The API sends an encrypted JSON payload { title, body, url, tag, organization_id, require_interaction } through the browser's
 * push service (VAPID). We show it and open / focus the app at `url` on click. No caching or offline logic lives here.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { title: event.data ? event.data.text() : "New notification" };
    }
    const title = data.title || "New notification";
    const options = {
        body: data.body || undefined,
        tag: data.tag || undefined,
        renotify: !!data.tag,
        icon: data.icon || "/favicon.svg",
        badge: "/favicon.svg",
        requireInteraction: !!data.require_interaction,
        silent: !!data.silent,
        data: { url: data.url || "/notifications", organization_id: data.organization_id || null },
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const raw = (event.notification.data && event.notification.data.url) || "/notifications";
    const target = new URL(raw, self.location.origin);
    // Only open pages of this app (never an arbitrary origin from a payload).
    const url = target.origin === self.location.origin ? target.href : new URL("/notifications", self.location.origin).href;
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
            for (const win of wins) {
                if (new URL(win.url).origin === self.location.origin && "focus" in win) {
                    return win.focus().then((w) => (w && "navigate" in w ? w.navigate(url) : undefined));
                }
            }
            return self.clients.openWindow ? self.clients.openWindow(url) : undefined;
        }),
    );
});

// The browser rotated the subscription: the app re-registers on its next load (GET push-config + POST /notifications/devices).
self.addEventListener("pushsubscriptionchange", () => undefined);
