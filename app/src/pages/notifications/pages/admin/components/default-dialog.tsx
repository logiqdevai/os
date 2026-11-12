import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SaveStatus } from "@/components/ui/save-status";
import { useAutosave } from "@/hooks/use-autosave";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeliveryModeFormOptions, DigestFrequencyFormOptions } from "@/config/constants/dropdowns/notifications/notification.options";
import { useSetDefault } from "@/features/notifications/hooks/use-notification-admin";
import type { DeliveryMode, OrgDefault } from "@/features/notifications/interfaces/notification-admin.interfaces";
import type { DigestFrequency, NotificationChannel } from "@/features/notifications/interfaces/notifications.interfaces";
import { ChannelChecks } from "./admin-ui";

export interface DefaultTarget {
    module?: string;
    event_type_id?: string;
    label: string;
    /** Platform default channels shown as the starting point for a new override. */
    platformChannels?: NotificationChannel[];
}

/**
 * Edit one organization default (module or event override): channels, delivery mode, digest, mandatory (14 §6 layer 4).
 * An existing default autosaves on every change (<SaveStatus /> in the footer, "Done" closes); a new one is created with "Create".
 */
export function DefaultDialog({ target, existing, enabledChannels, onClose }: { target: DefaultTarget | null; existing?: OrgDefault | null; enabledChannels: NotificationChannel[]; onClose: () => void }) {
    const isNew = !existing;
    const save = useSetDefault(!isNew);
    const [enabled, setEnabledState] = useState(true);
    const [channels, setChannelsState] = useState<NotificationChannel[]>(["IN_APP"]);
    const [mode, setModeState] = useState<DeliveryMode>("IMMEDIATE");
    const [digest, setDigestState] = useState<DigestFrequency>("DAILY");
    const [mandatory, setMandatoryState] = useState(false);
    // Only edits made by the user are autosaved, never the values loaded when the dialog opens.
    const [touched, setTouched] = useState(false);
    const touch = <T,>(set: (v: T) => void) => (v: T) => { setTouched(true); set(v); };
    const setEnabled = touch(setEnabledState);
    const setChannels = touch(setChannelsState);
    const setMode = touch(setModeState);
    const setDigest = touch(setDigestState);
    const setMandatory = touch(setMandatoryState);

    useEffect(() => {
        if (!target) return;
        setTouched(false);
        setEnabledState(existing?.enabled ?? true);
        setChannelsState(existing?.channels ?? target.platformChannels ?? ["IN_APP"]);
        setModeState(existing?.delivery_mode ?? "IMMEDIATE");
        setDigestState(existing?.digest_frequency ?? "DAILY");
        setMandatoryState(existing?.is_mandatory ?? false);
    }, [target, existing]);

    const dto = { module: target?.module ?? null, event_type_id: target?.event_type_id ?? null, enabled, channels, delivery_mode: mode, digest_frequency: digest, is_mandatory: mandatory };
    const autosave = useAutosave({ value: dto, enabled: !!target && !isNew && touched, save: (v) => save.mutateAsync(v) });
    const create = () => target && save.mutate(dto, { onSuccess: onClose });
    const close = () => { if (!isNew) autosave.flush(); onClose(); };

    return (
        <Dialog open={!!target} onOpenChange={(o) => !o && !(isNew && save.isPending) && close()}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Default for {target?.label}</DialogTitle>
                    <DialogDescription>What members get unless they choose otherwise. An event override wins over its module.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="def-enabled" className="text-[13px]">Notify members</Label>
                        <Switch id="def-enabled" checked={enabled} onCheckedChange={setEnabled} />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[13px]">Channels</Label>
                        <ChannelChecks value={channels} onChange={setChannels} allowed={enabledChannels} disabled={!enabled} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label className="text-[13px]">Email delivery</Label>
                            <Select value={mode} onValueChange={(v) => setMode(v as DeliveryMode)} disabled={!enabled}>
                                <SelectTrigger aria-label="Delivery mode"><SelectValue /></SelectTrigger>
                                <SelectContent>{DeliveryModeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        {mode === "DIGEST" && (
                            <div className="space-y-1.5">
                                <Label className="text-[13px]">Digest</Label>
                                <Select value={digest} onValueChange={(v) => setDigest(v as DigestFrequency)}>
                                    <SelectTrigger aria-label="Digest frequency"><SelectValue /></SelectTrigger>
                                    <SelectContent>{DigestFrequencyFormOptions.filter((o) => o.id !== "IMMEDIATE").map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <div className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                        <div>
                            <Label htmlFor="def-mandatory" className="text-[13px]">Mandatory</Label>
                            <p className="text-xs text-muted-foreground">Members cannot mute it; their own settings are ignored.</p>
                        </div>
                        <Switch id="def-mandatory" checked={mandatory} onCheckedChange={setMandatory} />
                    </div>
                    {mandatory && !existing?.is_mandatory && (
                        <p className="flex items-start gap-1.5 text-xs text-warning"><ShieldAlert className="mt-0.5 size-3.5 shrink-0" /> Use for security alerts, SLA breaches and legal notices. The change is audited.</p>
                    )}
                </div>
                <DialogFooter className="sm:items-center">
                    {isNew ? (
                        <>
                            <Button variant="ghost" onClick={onClose} disabled={save.isPending}>Cancel</Button>
                            <Button onClick={create} loading={save.isPending}>Create</Button>
                        </>
                    ) : (
                        <>
                            <SaveStatus state={autosave} className="mr-auto" />
                            <Button variant="outline" onClick={close}>Done</Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
