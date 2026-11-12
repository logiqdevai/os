import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Filter, Plus, Users } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { usePermission } from "@/hooks/use-permission";
import { useListParams } from "@/hooks/use-list-params";
import { SaveStatus } from "@/components/ui/save-status";
import { useAutosave } from "@/hooks/use-autosave";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatNumber } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { useCreateSegment, useSegment, useSegmentFields, useSegmentMembers, useSegmentPreview, useUpdateSegment } from "@/features/communications/hooks/use-communications";
import type { AudienceMember, CommChannel, SegmentDefinition, SegmentRule } from "@/features/communications/interfaces/communications.interfaces";
import { segmentFormSchema, type SegmentFormValues } from "@/features/communications/validation-schemas/communications.schema";
import { SegmentEntityTypeFormOptions } from "@/config/constants/dropdowns/communications/comm-compliance.options";
import { CommChannelFormOptions } from "@/config/constants/dropdowns/communications/comm-channel-form.options";
import { CampaignStatusBadge } from "../../components/comm-badges";
import { CampaignPaths } from "../../campaign-paths";
import { RuleRow } from "./components/rule-row";

const isRule = (n: unknown): n is SegmentRule => !!n && typeof n === "object" && "field" in (n as object);

function MembersTable({ id }: { id: string }) {
    const { params, setPage } = useListParams({ limit: 25 });
    const members = useSegmentMembers(id, params);
    const columns: DataTableColumn<AudienceMember>[] = [
        { key: "name", header: "Name", cell: (m) => <span className="font-medium text-foreground">{m.name ?? "—"}</span> },
        { key: "address", header: "Address", cell: (m) => <span className="text-muted-foreground">{m.address ?? "No address"}</span> },
    ];
    return (
        <DataTable
            columns={columns}
            data={members.data?.data}
            rowKey={(m) => m.contact_id ?? m.membership_id ?? m.address ?? ""}
            loading={members.isFetching}
            error={members.error}
            onRetry={() => members.refetch()}
            pagination={members.data?.pagination}
            onPageChange={setPage}
            empty={{ icon: Users, title: "Nobody matches right now" }}
        />
    );
}

/**
 * /campaigns/segments/new and /campaigns/segments/:id — rule builder with a live count.
 * @perm communications.segments.read · create · update
 * @api GET /communications/segments/fields · POST /segments/preview · POST /segments · PATCH /segments/:id · GET /segments/:id/members
 */
export default function SegmentBuilderPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const canEdit = usePermission(id ? "communications.segments.update" : "communications.segments.create");
    const segment = useSegment(id);
    const fields = useSegmentFields();
    const create = useCreateSegment();
    const update = useUpdateSegment();
    const form = useForm<SegmentFormValues>({ resolver: zodResolver(segmentFormSchema), defaultValues: { name: "", description: "", entity_type: "CRM_CONTACT", channel: "EMAIL", require_consent: true } });
    const [match, setMatch] = useState<"and" | "or">("and");
    const [rules, setRules] = useState<SegmentRule[]>([]);
    const [nested, setNested] = useState(false);
    /** Rules / match changed by the user (form fields track their own dirty state). */
    const [touched, setTouched] = useState(false);
    const editRules: typeof setRules = (v) => { setTouched(true); setRules(v); };
    const editMatch = (m: "and" | "or") => { setTouched(true); setMatch(m); };

    useEffect(() => {
        const s = segment.data;
        if (!s) return;
        form.reset({ name: s.name, description: s.description ?? "", entity_type: s.entity_type, channel: s.channel ?? "ANY", require_consent: s.require_consent });
        const m = s.definition.or ? "or" : "and";
        const nodes = s.definition[m] ?? [];
        setMatch(m);
        setRules(nodes.filter(isRule));
        setNested(nodes.some((n) => !isRule(n)));
        setTouched(false);
        // Load once per segment: the refresh after each autosave must not reset what is being edited.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [segment.data?.id, form]);

    const entity = form.watch("entity_type");
    const channel = form.watch("channel");
    const requireConsent = form.watch("require_consent");
    const entityFields = fields.data?.[entity] ?? [];
    const definition: SegmentDefinition = useMemo(() => ({ [match]: rules }), [match, rules]);
    const [debounced, setDebounced] = useState(definition);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(definition), 400);
        return () => clearTimeout(t);
    }, [definition]);
    // Existing segments save as you edit (no Save button); a new segment keeps its Create button.
    const json = JSON.stringify({ v: form.watch(), match, rules });
    const draft = useMemo(() => {
        const { v } = JSON.parse(json) as { v: SegmentFormValues };
        const def: SegmentDefinition = nested && segment.data ? { [match]: [...(segment.data.definition[match] ?? []).filter((n) => !isRule(n)), ...rules] } : { [match]: rules };
        return { valid: segmentFormSchema.safeParse(v).success, dto: { name: v.name, description: v.description || undefined, entity_type: v.entity_type, channel: v.channel === "ANY" ? undefined : (v.channel as CommChannel), require_consent: v.require_consent, definition: def } };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [json, nested, segment.data?.id]);
    const autosave = useAutosave({ value: draft.dto, enabled: !!id && canEdit && draft.valid && (form.formState.isDirty || touched), save: (dto) => update.mutateAsync({ id: id as string, ...dto }) });
    const preview = useSegmentPreview({ entity_type: entity, definition: debounced, channel: channel === "ANY" ? undefined : (channel as CommChannel), require_consent: requireConsent }, !!fields.data);

    if (id && segment.isPending) return <PageSkeleton />;
    if (id && segment.error) return <Page><ErrorState error={segment.error} onRetry={() => segment.refetch()} /></Page>;

    const addRule = () => {
        const f = entityFields[0];
        if (f) editRules((r) => [...r, { field: f.key, op: f.ops[0], value: f.options?.[0] ?? "" }]);
    };

    const submit = form.handleSubmit(() => {
        if (id) return autosave.flush();
        create.mutate(draft.dto, { onSuccess: (s) => navigate(CampaignPaths.segment(s.id), { replace: true }) });
    });

    const p = preview.data;
    return (
        <Page width="wide">
            <PageHeader back={{ to: CampaignPaths.segments, label: "Segments" }} title={id ? segment.data?.name ?? "Segment" : "New segment"} meta={id ? <SaveStatus state={autosave} /> : undefined} description="People are matched again every time a campaign that uses this segment sends." />
            <Form {...form}>
                <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
                    <div className="min-w-0 space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Name</FormLabel><FormControl><Input disabled={!canEdit} placeholder="Active customers" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="entity_type" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Who</FormLabel>
                                    <Select value={field.value} onValueChange={(v) => { field.onChange(v); editRules([]); }} disabled={!canEdit}>
                                        <FormControl><SelectTrigger aria-label="Who"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{SegmentEntityTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} disabled={!canEdit} {...field} value={field.value ?? ""} /></FormControl></FormItem>
                        )} />

                        <Section
                            title="Conditions"
                            actions={
                                <Select value={match} onValueChange={(v) => editMatch(v as "and" | "or")} disabled={!canEdit}>
                                    <SelectTrigger className="h-8 w-44" aria-label="Match"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="and">Match all conditions</SelectItem>
                                        <SelectItem value="or">Match any condition</SelectItem>
                                    </SelectContent>
                                </Select>
                            }
                        >
                            {fields.isPending ? (
                                <Skeleton className="h-12 w-full" />
                            ) : fields.error ? (
                                <ErrorState error={fields.error} onRetry={() => fields.refetch()} />
                            ) : (
                                <div className="space-y-2">
                                    {nested && <p className="text-xs text-muted-foreground">This segment also has nested groups created through the API; they are kept unchanged.</p>}
                                    {rules.length === 0 && <EmptyState compact icon={Filter} title="No conditions" description="Without conditions every record matches." />}
                                    {rules.map((r, i) => (
                                        <RuleRow key={i} rule={r} fields={entityFields} disabled={!canEdit} onChange={(n) => editRules((all) => all.map((x, j) => (j === i ? n : x)))} onRemove={() => editRules((all) => all.filter((_, j) => j !== i))} />
                                    ))}
                                    {canEdit && <Button type="button" variant="outline" size="sm" onClick={addRule}><Plus /> Add condition</Button>}
                                </div>
                            )}
                        </Section>
                    </div>

                    <div className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
                        <div className="rounded-lg border border-border bg-card p-4">
                            <div className="text-xs text-muted-foreground">Matching now</div>
                            {preview.isPending ? <Skeleton className="mt-1 h-8 w-24" /> : preview.error ? (
                                <p className="mt-1 text-[13px] text-danger">{getApiErrorMessage(preview.error)}</p>
                            ) : (
                                <>
                                    <div className="mt-1 text-2xl font-medium text-foreground tabular">{formatNumber(p?.count ?? 0)}</div>
                                    {p && entity !== "MEMBERSHIP" && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {p.excluded.no_address > 0 && <Badge variant="neutral">{formatNumber(p.excluded.no_address)} without address</Badge>}
                                            {requireConsent && p.excluded.no_consent > 0 && <Badge variant="warning">{formatNumber(p.excluded.no_consent)} without opt-in</Badge>}
                                            {p.excluded.suppressed > 0 && <Badge variant="danger">{formatNumber(p.excluded.suppressed)} suppressed</Badge>}
                                        </div>
                                    )}
                                    {p && p.sample.length > 0 && (
                                        <ul className="mt-3 space-y-1 border-t border-border pt-3">
                                            {p.sample.slice(0, 6).map((m, i) => (
                                                <li key={i} className="truncate text-xs text-muted-foreground"><span className="text-foreground">{m.name ?? "—"}</span> {m.address && `· ${m.address}`}</li>
                                            ))}
                                        </ul>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                            <FormField control={form.control} name="channel" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Channel</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange} disabled={!canEdit}>
                                        <FormControl><SelectTrigger aria-label="Channel"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="ANY">Email and SMS</SelectItem>
                                            {CommChannelFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="require_consent" render={({ field }) => (
                                <FormItem className="flex items-start justify-between gap-3">
                                    <div className="space-y-0.5">
                                        <FormLabel>Opted-in only</FormLabel>
                                        <FormDescription>Skip contacts without consent on the campaign channel.</FormDescription>
                                    </div>
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit} aria-label="Opted-in only" /></FormControl>
                                </FormItem>
                            )} />
                            {canEdit && !id && <Button type="submit" className="w-full" loading={create.isPending}>Create segment</Button>}
                        </div>
                        {segment.data && segment.data.audiences.length > 0 && (
                            <div className="rounded-lg border border-border bg-card p-4">
                                <div className="mb-2 text-xs text-muted-foreground">Used by</div>
                                <ul className="space-y-1.5">
                                    {segment.data.audiences.map((a) => (
                                        <li key={a.id} className="flex items-center justify-between gap-2 text-[13px]">
                                            <button type="button" className="truncate text-left text-foreground hover:underline" onClick={() => navigate(CampaignPaths.detail(a.campaign.id))}>{a.campaign.name}</button>
                                            <CampaignStatusBadge status={a.campaign.status} />
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </form>
            </Form>
            {id && (
                <Section title="Members" description={`${getDropdownOptionLabel(SegmentEntityTypeFormOptions, entity)} matching the saved conditions`} className="mt-8">
                    <MembersTable id={id} />
                </Section>
            )}
        </Page>
    );
}
