import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Pencil, Plus, RotateCcw, ShieldAlert } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EntityPicker } from "@/components/ui/entity-picker";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { DeliveryModeFormOptions, DigestFrequencyFormOptions, ModuleLabelOptions } from "@/config/constants/dropdowns/notifications/notification.options";
import { useAdminDefaults, useAdminEventTypes, useRemoveDefault } from "@/features/notifications/hooks/use-notification-admin";
import type { OrgDefault } from "@/features/notifications/interfaces/notification-admin.interfaces";
import { ChannelBadges } from "../components/admin-ui";
import { DefaultDialog, type DefaultTarget } from "../components/default-dialog";

interface ModuleRow {
    module: string;
    row: OrgDefault | null;
}

function modeLabel(d: OrgDefault) {
    return d.delivery_mode === "DIGEST" ? getDropdownOptionLabel(DigestFrequencyFormOptions, d.digest_frequency) : getDropdownOptionLabel(DeliveryModeFormOptions, d.delivery_mode);
}

/**
 * /notifications/admin/defaults — organization defaults per module and event overrides, plus mandatory events (14 §6 layer 4).
 * @perm notifications.defaults.manage · @api GET/PUT /notification-defaults · DELETE /notification-defaults/:id
 * @states loading · error / no-access · empty (platform defaults apply)
 */
export default function OrgDefaultsPage() {
    const q = useAdminDefaults();
    const types = useAdminEventTypes({ limit: 200, active: "true" });
    const remove = useRemoveDefault();
    const [target, setTarget] = useState<{ t: DefaultTarget; existing: OrgDefault | null } | null>(null);
    const [resetting, setResetting] = useState<OrgDefault | null>(null);

    const modules = useMemo<ModuleRow[]>(() => {
        const avail = q.data?.available_modules ?? [];
        const known = ModuleLabelOptions.map((o) => o.id).filter((m) => avail.includes(m));
        return known.map((module) => ({ module, row: q.data?.modules.find((r) => r.module === module) ?? null }));
    }, [q.data]);

    const moduleColumns: DataTableColumn<ModuleRow>[] = [
        { key: "module", header: "Module", cell: (r) => <span className="font-medium text-foreground">{getDropdownOptionLabel(ModuleLabelOptions, r.module)}</span> },
        { key: "channels", header: "Channels", cell: (r) => (r.row ? (r.row.enabled ? <ChannelBadges channels={r.row.channels} /> : <Badge variant="warning">Off</Badge>) : <span className="text-xs text-muted-foreground">Platform default</span>) },
        { key: "mode", header: "Email", cell: (r) => (r.row ? modeLabel(r.row) : "—"), hideBelow: "sm" },
        { key: "mandatory", header: "Mandatory", cell: (r) => (r.row?.is_mandatory ? <Lock className="size-3.5 text-muted-foreground" aria-label="Mandatory" /> : null), hideBelow: "md" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-24 text-right",
            cell: (r) => (
                <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${r.module}`} onClick={() => setTarget({ t: { module: r.module, label: getDropdownOptionLabel(ModuleLabelOptions, r.module) }, existing: r.row })}><Pencil /></Button>
                    {r.row && <Button variant="ghost" size="icon-sm" aria-label={`Reset ${r.module}`} onClick={() => setResetting(r.row)}><RotateCcw /></Button>}
                </div>
            ),
        },
    ];

    const eventColumns: DataTableColumn<OrgDefault>[] = [
        {
            key: "event",
            header: "Event",
            cell: (d) => (
                <div className="min-w-0">
                    <Link to={`/notifications/admin/events/${d.event_type_id}`} className="truncate font-medium text-foreground hover:underline">{d.event_type?.name ?? "Event"}</Link>
                    <code className="block truncate text-xs text-muted-foreground">{d.event_type?.key}</code>
                </div>
            ),
        },
        { key: "channels", header: "Channels", cell: (d) => (d.enabled ? <ChannelBadges channels={d.channels} /> : <Badge variant="warning">Off</Badge>) },
        { key: "mode", header: "Email", cell: modeLabel, hideBelow: "sm" },
        { key: "mandatory", header: "Mandatory", cell: (d) => (d.is_mandatory ? <Badge variant="danger"><Lock className="size-3" /> Mandatory</Badge> : null), hideBelow: "md" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-24 text-right",
            cell: (d) => (
                <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label="Edit override" onClick={() => setTarget({ t: { event_type_id: d.event_type_id as string, label: d.event_type?.name ?? "event" }, existing: d })}><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Remove override" onClick={() => setResetting(d)}><RotateCcw /></Button>
                </div>
            ),
        },
    ];

    const pickEvent = (id: string | null) => {
        const t = types.data?.data.find((x) => x.id === id);
        if (!t) return;
        setTarget({ t: { event_type_id: t.id, label: t.name, platformChannels: t.default_channels }, existing: q.data?.events.find((e) => e.event_type_id === t.id) ?? null });
    };

    return (
        <Page>
            <PageHeader title="Organization defaults" description="What members get unless they choose otherwise, and which events nobody can mute." />
            <div className="mb-5 flex items-start gap-2 rounded-lg border border-border bg-warning-soft px-4 py-3 text-[13px] text-warning">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                Mandatory events ignore personal settings (security alerts, SLA breaches, legal notices). Every change is audited.
            </div>
            {q.isLoading ? (
                <div className="rounded-lg border border-border bg-card"><ListSkeleton rows={8} /></div>
            ) : q.error ? (
                <ErrorState error={q.error} onRetry={() => q.refetch()} />
            ) : (
                <div className="space-y-8">
                    <Section title="Module defaults" description="Apply to every event of the module without its own override.">
                        <DataTable columns={moduleColumns} data={modules} rowKey={(r) => r.module} />
                    </Section>
                    <Section
                        title="Event overrides and mandatory events"
                        actions={
                            <div className="w-full sm:w-72">
                                <EntityPicker
                                    items={(types.data?.data ?? []).map((t) => ({ id: t.id, label: t.name, keywords: t.key, hint: <code className="text-xs">{t.key}</code> }))}
                                    value={null}
                                    onChange={pickEvent}
                                    loading={types.isLoading}
                                    placeholder="Add an event override"
                                    searchPlaceholder="Search events…"
                                    ariaLabel="Add an event override"
                                    trigger={<Button size="sm" variant="outline"><Plus /> Add override</Button>}
                                />
                            </div>
                        }
                    >
                        <DataTable
                            columns={eventColumns}
                            data={q.data?.events}
                            rowKey={(d) => d.id}
                            empty={{ icon: Lock, title: "No event overrides", description: "Module and platform defaults apply to every event." }}
                        />
                    </Section>
                </div>
            )}
            <DefaultDialog target={target?.t ?? null} existing={target?.existing} enabledChannels={q.data?.enabled_channels ?? ["IN_APP", "EMAIL"]} onClose={() => setTarget(null)} />
            <ConfirmationDialog
                isOpen={!!resetting}
                onClose={() => setResetting(null)}
                title="Reset to the default?"
                description={resetting?.event_type_id ? "The module default (or the platform default) applies to this event again." : "The platform defaults apply to this module again."}
                confirmText="Reset"
                onConfirm={() => { if (resetting) remove.mutate(resetting.id); setResetting(null); }}
            />
        </Page>
    );
}
