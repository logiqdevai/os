import { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { AlertTriangle, BellRing, Check, Globe, Laptop, Send, Smartphone, Trash2 } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { formatRelative } from "@/lib/format";
import { usePushDevices, useTestPushDevice } from "@/features/notifications/hooks/use-notifications";
import type { PushDevice } from "@/features/notifications/interfaces/notifications.interfaces";
import { useBrowserPush } from "../../components/use-browser-push";

const PLATFORM_ICON = { WEB: Globe, IOS: Smartphone, ANDROID: Smartphone, DESKTOP: Laptop } as const;

/** Explains the browser permission state (mockup 14 "Devices" → Browser permission). */
function PermissionNote({ state }: { state: ReturnType<typeof useBrowserPush>["state"] }) {
    const text = {
        granted: "Notifications are allowed for this site. Pushes arrive even when the app is closed.",
        default: "This browser has not been asked yet. Turn on browser notifications to allow them.",
        denied: "Notifications are blocked for this site. Open the site settings of your browser (the icon left of the address), allow notifications, then reload.",
        unsupported: "This browser does not support push notifications. On iPhone and iPad, add the app to the home screen first.",
        insecure: "Push notifications need a secure (https) address.",
    }[state];
    const warn = state === "denied" || state === "unsupported" || state === "insecure";
    return (
        <div className={warn ? "flex gap-2 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-[13px] text-warning" : "flex gap-2 rounded-lg border border-border bg-card px-4 py-3 text-[13px] text-body"}>
            {warn ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <BellRing className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
            <p>{text}</p>
        </div>
    );
}

/**
 * /notifications/preferences/devices — where push notifications can reach me (mockup 14 "Devices", spec §5).
 * @perm notifications.preferences.manage_own (own devices only; tokens are never shown)
 * @api GET /notifications/devices/push-config · GET/POST /notifications/devices · DELETE /notifications/devices/:id · POST /notifications/devices/:id/test
 * @states loading · empty + enable prompt · permission denied / unsupported · error · disabled device ("Needs re-registration")
 * @audit notification.device_registered · notification.device_removed · notification.device_tested
 */
export default function PushDevicesPage() {
    const devices = usePushDevices();
    const test = useTestPushDevice();
    // A refused push (expired subscription…) is an answer, not a request failure: report it like an error.
    useEffect(() => {
        if (test.data && !test.data.ok) toast({ variant: "destructive", title: "Test failed", description: test.data.error ?? undefined });
    }, [test.data]);
    const push = useBrowserPush();
    const [removing, setRemoving] = useState<PushDevice | null>(null);
    const canEnable = push.state === "default" || push.state === "granted";
    const orgOff = push.config.data && !push.config.data.organization_enabled;
    const enableLabel = push.thisDeviceId ? "Browser registered" : "Enable browser notifications";

    return (
        <Page width="narrow">
            <PageHeader
                title="Devices"
                description="Where push notifications can reach you."
                back={{ to: "/notifications/preferences", label: "Preferences" }}
                actions={
                    <Button onClick={() => void push.enable()} loading={push.busy} disabled={!canEnable || !push.config.data || !!push.thisDeviceId}>
                        <BellRing /> {enableLabel}
                    </Button>
                }
            />
            <div className="space-y-6">
                {orgOff && (
                    <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-[13px] text-warning">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        <p>Push is turned off for your organization. You can register this browser now; notifications start once an administrator turns push on.</p>
                    </div>
                )}
                {push.config.error && <ErrorState error={push.config.error} onRetry={() => push.config.refetch()} />}
                <PermissionNote state={push.state} />

                <Section title="Registered devices">
                    <div className="overflow-hidden rounded-lg border border-border bg-card">
                        {devices.isLoading ? (
                            <ListSkeleton rows={3} />
                        ) : devices.error ? (
                            <ErrorState error={devices.error} onRetry={() => devices.refetch()} />
                        ) : !devices.data?.length ? (
                            <EmptyState
                                compact
                                icon={BellRing}
                                title="No devices registered"
                                description="Turn on browser notifications to get pushes on this computer or phone."
                                action={canEnable && push.config.data ? <Button size="sm" onClick={() => void push.enable()} loading={push.busy}>Enable browser notifications</Button> : undefined}
                            />
                        ) : (
                            devices.data.map((d) => {
                                const Icon = PLATFORM_ICON[d.platform] ?? Globe;
                                const disabled = !!d.disabled_at;
                                return (
                                    <div key={d.id} className="flex flex-col gap-3 border-b border-border-soft px-4 py-3 last:border-b-0 sm:flex-row sm:items-center">
                                        <div className="flex min-w-0 flex-1 items-start gap-3">
                                            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground"><Icon className="size-4" /></span>
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <p className="truncate text-[13px] font-medium text-foreground">{d.device_name ?? "Browser"}</p>
                                                    {d.id === push.thisDeviceId && <Badge variant="info">This browser</Badge>}
                                                    {disabled ? <Badge variant="danger">Needs re-registration</Badge> : <Badge variant="success">Active</Badge>}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {d.platform === "WEB" ? "Web Push" : d.app_version ?? d.platform} · last used {formatRelative(d.last_seen_at ?? d.created_at)}
                                                    {d.failure_count > 0 && ` · ${d.failure_count} failed attempt${d.failure_count === 1 ? "" : "s"}`}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 gap-2">
                                            <Button size="sm" variant="outline" onClick={() => test.mutate(d.id)} loading={test.isPending && test.variables === d.id} disabled={d.platform !== "WEB"}>
                                                {test.isSuccess && test.variables === d.id && test.data?.ok ? <><Check /> Sent</> : <><Send /> Send test</>}
                                            </Button>
                                            <Button size="icon-sm" variant="ghost" aria-label={`Remove ${d.device_name ?? "device"}`} onClick={() => setRemoving(d)}>
                                                <Trash2 />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </Section>
                <p className="text-xs text-muted-foreground">
                    Which notifications are pushed follows your <Link to="/notifications/preferences" className="underline">preferences</Link> (Push column, quiet hours and previews).
                    Lock-screen previews are hidden when “Show message previews” is off.
                </p>
            </div>
            <ConfirmationDialog
                isOpen={!!removing}
                onClose={() => setRemoving(null)}
                onConfirm={() => {
                    if (removing) void push.removeDevice(removing.id).catch(() => undefined); // optimistic: the row leaves at once
                    setRemoving(null);
                }}
                title="Remove this device?"
                description={`${removing?.device_name ?? "This device"} will stop receiving push notifications.`}
                confirmText="Remove"
                variant="destructive"
            />
        </Page>
    );
}
