import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Archive, Pencil, Plus, Timer } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { usePermission } from "@/hooks/use-permission";
import { SaveStatus } from "@/components/ui/save-status";
import { useAutosave } from "@/hooks/use-autosave";
import { formatMinutes } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { TicketPriorityFormOptions } from "@/config/constants/dropdowns/support/support.options";
import { useArchiveSlaPolicy, useCreateSlaPolicy, useSlaPolicies, useUpdateSlaPolicy } from "@/features/support/hooks/use-support";
import { slaFormSchema, type SlaFormValues } from "@/features/support/validation-schemas/support.schema";
import type { SlaPolicy, SlaPolicyDto, TicketPriority } from "@/features/support/interfaces/support.interfaces";
import { PriorityBadge } from "../../components/support-badges";

const PRIORITIES: TicketPriority[] = ["URGENT", "HIGH", "NORMAL", "LOW"];

/**
 * SLA policies — /support/sla (mockup 13-support `sla`, `sla-edit`).
 * @perm VIEW support.tickets.read · create/edit/archive support.sla_policies.manage
 */
export default function SlaPage() {
    const policies = useSlaPolicies();
    const archive = useArchiveSlaPolicy();
    const canManage = usePermission("support.sla_policies.manage");
    const [editing, setEditing] = useState<SlaPolicy | null>(null);
    const [open, setOpen] = useState(false);
    const [archiving, setArchiving] = useState<SlaPolicy | null>(null);

    return (
        <Page width="wide">
            <PageHeader
                title="SLA policies"
                description="Response and resolution targets per priority. Timers start when a ticket is created and pause while it waits on the customer."
                actions={<Can permission="support.sla_policies.manage"><Button onClick={() => { setEditing(null); setOpen(true); }}><Plus /> New policy</Button></Can>}
            />
            {policies.isLoading ? (
                <ListSkeleton />
            ) : policies.error ? (
                <ErrorState error={policies.error} onRetry={() => policies.refetch()} />
            ) : !policies.data?.length ? (
                <EmptyState icon={Timer} title="Create your first SLA policy" description="Policies apply targets to tickets by priority." />
            ) : (
                <div className="space-y-4">
                    {policies.data.map((p) => (
                        <div key={p.id} className="rounded-lg border border-border bg-card">
                            <div className="flex flex-wrap items-start gap-2 border-b border-border-soft p-4">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="text-[15px] font-medium text-foreground">{p.name}</h2>
                                        {p.is_default && <Badge variant="info">Default</Badge>}
                                        <Badge variant="neutral">{p.use_business_hours ? "Business hours" : "Calendar hours"}</Badge>
                                    </div>
                                    {p.description && <p className="mt-0.5 text-[13px] text-muted-foreground">{p.description}</p>}
                                    <p className="mt-0.5 text-xs text-muted-foreground">At risk at {Number(p.at_risk_threshold_percent)}% of the target · {p._count?.tickets ?? 0} open tickets</p>
                                </div>
                                {canManage && (
                                    <div className="flex gap-1">
                                        <Button variant="outline" size="sm" onClick={() => { setEditing(p); setOpen(true); }}><Pencil /> Edit</Button>
                                        {!p.is_default && <Button variant="ghost" size="icon-sm" aria-label={`Archive ${p.name}`} onClick={() => setArchiving(p)}><Archive /></Button>}
                                    </div>
                                )}
                            </div>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="h-9 text-xs">Priority</TableHead>
                                            <TableHead className="h-9 text-xs">First response</TableHead>
                                            <TableHead className="h-9 text-xs">Next response</TableHead>
                                            <TableHead className="h-9 text-xs">Resolution</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {PRIORITIES.map((pr) => {
                                            const t = p.targets.find((x) => x.priority === pr);
                                            return (
                                                <TableRow key={pr} className="border-border-soft">
                                                    <TableCell className="py-2"><PriorityBadge priority={pr} /></TableCell>
                                                    <TableCell className="py-2 tabular text-[13px]">{t?.first_response_minutes ? formatMinutes(t.first_response_minutes) : "—"}</TableCell>
                                                    <TableCell className="py-2 tabular text-[13px]">{t?.next_response_minutes ? formatMinutes(t.next_response_minutes) : "—"}</TableCell>
                                                    <TableCell className="py-2 tabular text-[13px]">{t?.resolution_minutes ? formatMinutes(t.resolution_minutes) : "—"}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <SlaPolicyDialog open={open} onOpenChange={setOpen} policy={editing} />
            <ConfirmationDialog
                isOpen={!!archiving}
                onClose={() => setArchiving(null)}
                title={`Archive ${archiving?.name}?`}
                description="New tickets stop using this policy. Running timers keep their targets."
                confirmText="Archive"
                variant="destructive"
                onConfirm={() => { if (!archiving) return; archive.mutate(archiving.id); setArchiving(null); }}
            />
        </Page>
    );
}

const toNum = (v: unknown) => (v === "" || v === undefined || v === null ? null : Number(v));

/** Form values → API body, or the first problem to show inline. */
function toDto(raw: SlaFormValues): { dto?: SlaPolicyDto; error?: string } {
    const parsed = slaFormSchema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Some values are invalid" };
    const v = parsed.data;
    for (const t of v.targets) {
        const fr = toNum(t.first_response_minutes);
        const res = toNum(t.resolution_minutes);
        if (fr && res && res < fr) return { error: `Resolution must be at least the first response (${getDropdownOptionLabel(TicketPriorityFormOptions, t.priority)})` };
    }
    return {
        dto: {
            name: v.name,
            description: v.description || undefined,
            is_default: v.is_default,
            use_business_hours: v.use_business_hours,
            at_risk_threshold_percent: v.at_risk_threshold_percent,
            targets: v.targets.map((t) => ({ priority: t.priority, first_response_minutes: toNum(t.first_response_minutes), next_response_minutes: toNum(t.next_response_minutes), resolution_minutes: toNum(t.resolution_minutes) })),
        } as SlaPolicyDto,
    };
}

/** New policy: explicit Create. Existing policy: every valid change is saved as you edit (no Save button). */
function SlaPolicyDialog({ open, onOpenChange, policy }: { open: boolean; onOpenChange: (o: boolean) => void; policy: SlaPolicy | null }) {
    const create = useCreateSlaPolicy();
    const update = useUpdateSlaPolicy();
    const form = useForm<SlaFormValues>();
    const targets = useFieldArray({ control: form.control, name: "targets" });
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (!open) return;
        setSubmitted(false);
        form.reset({
            name: policy?.name ?? "",
            description: policy?.description ?? "",
            is_default: policy?.is_default ?? false,
            use_business_hours: policy?.use_business_hours ?? false,
            at_risk_threshold_percent: Number(policy?.at_risk_threshold_percent ?? 80),
            targets: PRIORITIES.map((pr) => {
                const t = policy?.targets.find((x) => x.priority === pr);
                return { priority: pr, first_response_minutes: t?.first_response_minutes ?? "", next_response_minutes: t?.next_response_minutes ?? "", resolution_minutes: t?.resolution_minutes ?? "" };
            }),
        });
        // Only when the dialog opens or switches policy: a background refresh after an autosave must not reset typing.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, policy?.id, form]);

    const json = JSON.stringify(form.watch());
    const result = useMemo(() => toDto(JSON.parse(json) as SlaFormValues), [json]);
    const autosave = useAutosave({
        value: result.dto ?? null,
        enabled: open && !!policy && !!result.dto && form.formState.isDirty,
        save: (dto) => update.mutateAsync({ id: (policy as SlaPolicy).id, ...(dto as SlaPolicyDto) }),
    });
    const showError = result.error && (submitted || (!!policy && form.formState.isDirty));
    const close = () => { autosave.flush(); onOpenChange(false); };

    const submit = form.handleSubmit(() => {
        setSubmitted(true);
        if (policy) return close();
        if (result.dto) create.mutate(result.dto, { onSuccess: () => onOpenChange(false) });
    });

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : !create.isPending && close())}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle className="flex flex-wrap items-center gap-2">{policy ? "Edit SLA policy" : "New SLA policy"}{policy && <SaveStatus state={autosave} className="font-normal" />}</DialogTitle>
                            <DialogDescription>Targets in minutes (60 = 1 hour, 1440 = 1 day). Leave empty to not track a metric.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
                        <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full min-w-[480px] text-[13px]">
                                <thead>
                                    <tr className="border-b border-border text-xs text-muted-foreground">
                                        <th className="p-2 text-left font-medium">Priority</th>
                                        <th className="p-2 text-left font-medium">First response</th>
                                        <th className="p-2 text-left font-medium">Next response</th>
                                        <th className="p-2 text-left font-medium">Resolution</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {targets.fields.map((f, i) => (
                                        <tr key={f.id} className="border-b border-border-soft last:border-0">
                                            <td className="p-2"><PriorityBadge priority={f.priority} /></td>
                                            {(["first_response_minutes", "next_response_minutes", "resolution_minutes"] as const).map((m) => (
                                                <td key={m} className="p-2">
                                                    <Input type="number" min={1} className="h-8" aria-label={`${f.priority} ${m.replace(/_/g, " ")}`} {...form.register(`targets.${i}.${m}` as const)} />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <FormField control={form.control} name="at_risk_threshold_percent" render={({ field }) => (
                                <FormItem><FormLabel>At risk at (%)</FormLabel><FormControl><Input type="number" min={1} max={100} {...field} value={field.value as number | string} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="use_business_hours" render={({ field }) => (
                                <FormItem><FormLabel>Business hours only</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormDescription>Uses the organization's hours.</FormDescription></FormItem>
                            )} />
                            <FormField control={form.control} name="is_default" render={({ field }) => (
                                <FormItem><FormLabel>Default policy</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormDescription>Applies when nothing else matches.</FormDescription></FormItem>
                            )} />
                        </div>
                        {showError && <p role="alert" className="text-[13px] text-danger">{result.error}</p>}
                        <DialogFooter>
                            {policy ? (
                                <Button type="button" onClick={close}>Done</Button>
                            ) : (
                                <>
                                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                                    <Button type="submit" loading={create.isPending}>Create policy</Button>
                                </>
                            )}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
