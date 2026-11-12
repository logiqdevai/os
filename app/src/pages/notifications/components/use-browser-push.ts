import { useCallback, useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { browserPushState, currentPushSubscription, subscribeBrowserPush, unsubscribeBrowserPush, type BrowserPushState } from "@/lib/web-push";
import { usePushConfig, useRegisterPushDevice, useRemovePushDevice } from "@/features/notifications/hooks/use-notifications";

/**
 * "Enable browser notifications" (14 §5): permission prompt → PushManager subscription with the deployment's VAPID key →
 * POST /notifications/devices. When this browser already has a granted subscription it is re-registered silently on mount
 * (idempotent; refreshes last_seen and picks up a rotated subscription), which also tells us which row is "this browser".
 */
export function useBrowserPush() {
    const config = usePushConfig();
    const register = useRegisterPushDevice();
    const remove = useRemovePushDevice();
    const [state, setState] = useState<BrowserPushState>(() => browserPushState());
    const [thisDeviceId, setThisDeviceId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const { mutateAsync: registerAsync } = register;

    useEffect(() => {
        let cancelled = false;
        if (state !== "granted" || !config.data) return;
        (async () => {
            const sub = await currentPushSubscription().catch(() => null);
            if (!sub || cancelled) return;
            const row = await registerAsync({ platform: "WEB", subscription: sub.toJSON(), locale: navigator.language }).catch(() => null);
            if (row && !cancelled) setThisDeviceId(row.id);
        })();
        return () => {
            cancelled = true;
        };
    }, [state, config.data, registerAsync]);

    const enable = useCallback(async () => {
        if (!config.data) return;
        setBusy(true);
        try {
            const subscription = await subscribeBrowserPush(config.data.public_key);
            const row = await registerAsync({ platform: "WEB", subscription, locale: navigator.language });
            setThisDeviceId(row.id);
            toast({ title: "Browser notifications are on", description: "This browser will show notifications even when the app is closed." });
        } catch (e) {
            toast({ variant: "destructive", title: "Could not turn on browser notifications", description: getApiErrorMessage(e) });
        } finally {
            setState(browserPushState());
            setBusy(false);
        }
    }, [config.data, registerAsync]);

    /** Removes a device; when it is this browser the PushManager subscription is dropped too. */
    const removeDevice = useCallback(async (id: string) => {
        await remove.mutateAsync(id);
        if (id === thisDeviceId) {
            await unsubscribeBrowserPush().catch(() => undefined);
            setThisDeviceId(null);
        }
    }, [remove, thisDeviceId]);

    return { config, state, thisDeviceId, enable, busy: busy || register.isPending, removeDevice, removing: remove.isPending };
}
