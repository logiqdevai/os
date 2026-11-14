import { useEffect, useState } from "react";
import { CurrencySelect } from "@/components/ui/currency-select";
import { ColorPicker } from "@/components/ui/color-picker";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ArrowDown, ArrowUp, Layers, MoreHorizontal, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { InlineText } from "@/components/ui/inline-edit";
import { useArchivePipeline, useCreatePipeline, usePipelines, useReplaceStages, useUpdatePipeline } from "@/features/crm/pipelines/hooks/use-pipelines";
import type { Pipeline } from "@/features/crm/pipelines/interfaces/pipelines.interfaces";
import { pipelineFormSchema, stagesFormSchema, type PipelineFormValues, type StagesFormValues } from "@/features/crm/pipelines/validation-schemas/pipelines.schema";
import { Panel, ToneDot } from "../../components/crm-ui";

/**
 * Pipelines & stages (mockup `pipelines`).
 * @route /crm/pipelines
 * @perm crm.pipelines.manage (route gate)
 * @api GET/POST/PATCH /crm/pipelines · PUT /crm/pipelines/:id/stages · POST /crm/pipelines/:id/archive
 */
export default function PipelinesPage() {
    const pipelines = usePipelines();
    const update = useUpdatePipeline();
    const archive = useArchivePipeline();
    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState<Pipeline | null>(null);
    const [stagesOf, setStagesOf] = useState<Pipeline | null>(null);
    const [archiving, setArchiving] = useState<Pipeline | null>(null);

    return (
        <Page width="wide">
            <PageHeader
                title="Pipelines & stages"
                description="Each pipeline has its own ordered stages with a default win probability. Exactly one stage is won and one is lost."
                actions={<Button onClick={() => setCreating(true)}><Plus /> New pipeline</Button>}
            />
            {pipelines.isPending ? <ListSkeleton rows={4} className="p-0" />
                : pipelines.error ? <ErrorState error={pipelines.error} onRetry={() => pipelines.refetch()} />
                    : !pipelines.data.length ? <EmptyState icon={Layers} title="No pipelines" action={<Button size="sm" onClick={() => setCreating(true)}><Plus /> New pipeline</Button>} />
                        : (
                            <div className="space-y-4">
                                {pipelines.data.map((p) => (
                                    <Panel
                                        key={p.id}
                                        title={<span className="flex items-center gap-2"><InlineText value={p.name} aria-label={`Name of ${p.name}`} className="max-w-64" onSave={(name) => update.mutate({ id: p.id, name })} />{p.is_default && <Badge variant="info">Default</Badge>}<span className="text-xs font-normal text-muted-foreground">{p._count?.deals ?? 0} open deals · {p.currency}</span></span>}
                                        actions={
                                            <div className="flex items-center gap-1">
                                                <Button size="sm" variant="outline" onClick={() => setStagesOf(p)}><Pencil /> Stages</Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onSelect={() => setEditing(p)}><Pencil /> Edit details…</DropdownMenuItem>
                                                        {!p.is_default && <DropdownMenuItem onSelect={() => update.mutate({ id: p.id, is_default: true })}><Star /> Make default</DropdownMenuItem>}
                                                        {!p.is_default && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setArchiving(p)}><Archive /> Archive</DropdownMenuItem>}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        }
                                    >
                                        <ol className="flex flex-wrap gap-2">
                                            {p.stages.map((s) => (
                                                <li key={s.id} className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-1 text-xs">
                                                    <ToneDot tone={s.color} />
                                                    <span className="text-foreground">{s.name}</span>
                                                    <span className="text-muted-foreground tabular">{s.probability}%</span>
                                                </li>
                                            ))}
                                        </ol>
                                        {p.description && <p className="mt-2 text-[13px] text-muted-foreground">{p.description}</p>}
                                    </Panel>
                                ))}
                            </div>
                        )}
            <PipelineDialog open={creating || !!editing} pipeline={editing} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }} />
            <StagesDialog pipeline={stagesOf} onClose={() => setStagesOf(null)} />
            <ConfirmationDialog
                isOpen={!!archiving}
                onClose={() => setArchiving(null)}
                title={`Archive ${archiving?.name}?`}
                description="Pipelines with open deals cannot be archived. Closed deals keep their history."
                confirmText="Archive"
                variant="destructive"
                onConfirm={() => { if (archiving) archive.mutate(archiving.id); setArchiving(null); }}
            />
        </Page>
    );
}

function PipelineDialog({ open, pipeline, onOpenChange }: { open: boolean; pipeline: Pipeline | null; onOpenChange: (o: boolean) => void }) {
    const create = useCreatePipeline();
    const update = useUpdatePipeline();
    const form = useForm<PipelineFormValues>({ resolver: zodResolver(pipelineFormSchema), defaultValues: { name: "", is_default: false } });
    useEffect(() => {
        if (open) form.reset({ name: pipeline?.name ?? "", description: pipeline?.description ?? "", currency: pipeline?.currency ?? "", is_default: pipeline?.is_default ?? false });
    }, [open, pipeline, form]);
    const pending = create.isPending || update.isPending;
    const submit = form.handleSubmit((v) => {
        const dto = { name: v.name, description: v.description || undefined, currency: v.currency ? v.currency.toUpperCase() : undefined, is_default: v.is_default };
        // Edit is optimistic, so the dialog closes at once; create closes when the pipeline exists. Failures toast globally.
        if (pipeline) { update.mutate({ id: pipeline.id, ...dto }); onOpenChange(false); }
        else create.mutate(dto, { onSuccess: () => onOpenChange(false) });
    });
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{pipeline ? "Edit pipeline" : "New pipeline"}</DialogTitle>
                            <DialogDescription>{pipeline ? "Change the pipeline's currency, description or default." : "Starts with the standard stages; edit them afterwards."}</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus placeholder="Retainers" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="currency" render={({ field }) => (<FormItem><FormLabel>Currency</FormLabel><FormControl><CurrencySelect value={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="is_default" render={({ field }) => (
                            <FormItem className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                                <div><FormLabel>Default pipeline</FormLabel><FormDescription>Used when a deal is created without a pipeline.</FormDescription></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Default pipeline" /></FormControl>
                            </FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{pipeline ? "Save" : "Create pipeline"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function StagesDialog({ pipeline, onClose }: { pipeline: Pipeline | null; onClose: () => void }) {
    const save = useReplaceStages();
    const form = useForm<StagesFormValues>({ resolver: zodResolver(stagesFormSchema), defaultValues: { stages: [] } });
    const stages = useFieldArray({ control: form.control, name: "stages" });
    useEffect(() => {
        if (!pipeline) return;
        form.reset({ stages: pipeline.stages.map((s) => ({ id: s.id, name: s.name, probability: String(s.probability), is_won: s.is_won, is_lost: s.is_lost, stale_after_days: s.stale_after_days ? String(s.stale_after_days) : "", color: s.color ?? "neutral" })) });
    }, [pipeline, form]);

    const values = form.watch("stages");
    const openCount = values.filter((s) => !s.is_won && !s.is_lost).length;
    const submit = form.handleSubmit((v) => {
        if (!pipeline) return;
        // Open stages first in their order, then won, then lost.
        const ordered = [...v.stages.filter((s) => !s.is_won && !s.is_lost), ...v.stages.filter((s) => s.is_won), ...v.stages.filter((s) => s.is_lost)];
        save.mutate({
            id: pipeline.id,
            stages: ordered.map((s) => ({ id: s.id, name: s.name, probability: Number(s.probability), is_won: s.is_won, is_lost: s.is_lost, stale_after_days: s.stale_after_days ? Number(s.stale_after_days) : undefined, color: s.color })),
        }, { onSuccess: onClose });
    });

    return (
        <Dialog open={!!pipeline} onOpenChange={(o) => !o && !save.isPending && onClose()}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Stages of {pipeline?.name}</DialogTitle>
                            <DialogDescription>Order the open stages. Probability is applied to deals entering the stage; “stale after” flags deals that sit too long.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2">
                            {stages.fields.map((f, i) => {
                                const closed = values[i]?.is_won || values[i]?.is_lost;
                                return (
                                    <div key={f.id} className="grid grid-cols-[1fr_4.5rem] gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_4.5rem_5rem_7rem_auto] sm:items-end">
                                        <FormField control={form.control} name={`stages.${i}.name`} render={({ field }) => (
                                            <FormItem><FormLabel className="text-xs">{values[i]?.is_won ? "Won stage" : values[i]?.is_lost ? "Lost stage" : `Stage ${i + 1}`}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name={`stages.${i}.probability`} render={({ field }) => (
                                            <FormItem><FormLabel className="text-xs">Prob. %</FormLabel><FormControl><Input inputMode="numeric" disabled={closed} {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name={`stages.${i}.stale_after_days`} render={({ field }) => (
                                            <FormItem><FormLabel className="text-xs">Stale (days)</FormLabel><FormControl><Input inputMode="numeric" disabled={closed} {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name={`stages.${i}.color`} render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Color</FormLabel>
                                                <FormControl><ColorPicker label="Stage color" value={field.value} onChange={field.onChange} /></FormControl>
                                            </FormItem>
                                        )} />
                                        <div className="col-span-2 flex justify-end gap-1 sm:col-span-1">
                                            {!closed && (
                                                <>
                                                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => stages.move(i, i - 1)}><ArrowUp /></Button>
                                                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Move down" disabled={i >= openCount - 1} onClick={() => stages.move(i, i + 1)}><ArrowDown /></Button>
                                                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove stage" disabled={openCount <= 1} onClick={() => stages.remove(i)}><Trash2 /></Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {form.formState.errors.stages?.root?.message && <p className="text-[13px] text-danger">{form.formState.errors.stages.root.message}</p>}
                        <Button type="button" variant="outline" size="sm" onClick={() => stages.insert(openCount, { name: "", probability: "50", is_won: false, is_lost: false, stale_after_days: "21", color: "neutral" })}><Plus /> Add stage</Button>
                        <p className="text-xs text-muted-foreground">Stages that still hold deals cannot be removed; move their deals first.</p>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={onClose} disabled={save.isPending}>Cancel</Button>
                            <Button type="submit" loading={save.isPending}>Save stages</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
