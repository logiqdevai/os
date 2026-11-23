import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Check, Copy, Lock, Rocket, Save, Trash2, Unlock } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ErrorState, ListSkeleton, NoAccessState, PageSkeleton } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermissions } from "@/hooks/use-permission";
import { SaveStatus } from "@/components/ui/save-status";
import { useAutosave } from "@/hooks/use-autosave";
import { formatDate, formatDateTime, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { CustomFormFieldTypeOptions, CustomFormKindFormOptions, FormSubmissionStatusOptions } from "@/config/constants/dropdowns/docs/docs.options";
import { useCreateForm, useCreateFormAssignment, useDeleteForm, useForm, useFormAction, useFormAssignments, useFormResponses, useFormSummary, useReviewResponse, useUpdateForm } from "@/features/docs/hooks/use-docs";
import type { CustomFormKind, FormField, FormSubmission } from "@/features/docs/interfaces/docs.interfaces";
import { DocsMemberPicker, DocsStatusBadge } from "../../components/docs-ui";
import { FormRenderer } from "../../components/form-renderer";
import { CHOICE, FormBuilder } from "./form-builder";

type FormDto = { name: string; description?: string; kind: CustomFormKind; is_anonymous: boolean; allow_multiple_submissions: boolean; requires_review: boolean; confirmation_message?: string; fields_schema: FormField[] };
/** First problem that blocks saving, shown inline (no toast). */
const formProblem = (d: FormDto): string | null => {
    if (!d.name) return "Give the form a name";
    const keys = d.fields_schema.map((x) => x.key);
    if (new Set(keys).size !== keys.length) return "Two questions have the same key";
    if (d.fields_schema.some((x) => !x.label.trim())) return "Every question needs a label";
    if (d.fields_schema.some((x) => CHOICE.includes(x.type) && !(x.options?.length))) return "Choice questions need options";
    if (d.fields_schema.some((x) => CHOICE.includes(x.type) && (x.options ?? []).some((o) => !o.label.trim()))) return "Choice options can't be empty";
    if (d.fields_schema.some((x) => CHOICE.includes(x.type) && new Set((x.options ?? []).map((o) => o.label.trim().toLowerCase())).size !== (x.options ?? []).length)) return "Two options of a question have the same text";
    if (d.fields_schema.some((x) => x.type === "SCALE" && !(Number.isInteger(x.scale?.min) && Number.isInteger(x.scale?.max) && (x.scale?.min as number) < (x.scale?.max as number)))) return "A scale needs whole numbers with the minimum below the maximum";
    return null;
};
const uniqueKey = (base: string, taken: string[]) => { let k = base, n = 2; while (taken.includes(k)) k = `${base}_${n++}`; return k; };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "f_$1").slice(0, 60) || "field";

/**
 * /docs/forms/new · /docs/forms/:id?tab=build|responses|share — form builder, responses, assignment and public link (15 §8)
 * New: explicit "Create form". Existing: the builder autosaves every valid change (<SaveStatus />); Publish stays explicit.
 * @perm read docs.forms.read · build docs.forms.create/update · assign docs.forms.assign · review docs.forms.review · delete docs.forms.delete
 * @api POST/PATCH /docs/forms · POST publish|close|reopen · GET responses|summary · POST assignments · PATCH responses/:id
 */
export default function FormDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const p = usePermissions();
    const [sp, setSp] = useSearchParams();
    const tab = sp.get("tab") ?? "build";
    const form = useForm(id);
    const create = useCreateForm();
    const update = useUpdateForm();
    const action = useFormAction();
    const remove = useDeleteForm();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [kind, setKind] = useState<CustomFormKind>("CUSTOM");
    const [anonymous, setAnonymous] = useState(false);
    const [multiple, setMultiple] = useState(false);
    const [review, setReview] = useState(false);
    const [confirmation, setConfirmation] = useState("");
    const [fields, setFields] = useState<FormField[]>([]);
    const [deleting, setDeleting] = useState(false);
    const [removeIdx, setRemoveIdx] = useState<number | null>(null);
    const [selected, setSelected] = useState<string | null>(null);

    // Load the form once per id: refetches after an autosave must not overwrite what is being edited.
    const loadedId = useRef<string | null>(null);
    useEffect(() => {
        if (form.data && loadedId.current !== form.data.id) {
            loadedId.current = form.data.id;
            const f = form.data;
            setName(f.name); setDescription(f.description ?? ""); setKind(f.kind); setAnonymous(f.is_anonymous); setMultiple(f.allow_multiple_submissions);
            setReview(f.requires_review); setConfirmation(f.confirmation_message ?? ""); setFields(f.fields_schema ?? []);
        }
    }, [form.data]);
    const [showProblem, setShowProblem] = useState(false);

    const dto: FormDto = useMemo(() => ({ name: name.trim(), description: description || undefined, kind, is_anonymous: anonymous, allow_multiple_submissions: multiple, requires_review: review, confirmation_message: confirmation || undefined, fields_schema: fields }), [name, description, kind, anonymous, multiple, review, confirmation, fields]);
    // What the server has, in the same shape: autosave only runs when the builder differs from it.
    const serverDto: FormDto | null = useMemo(() => {
        const s = form.data;
        return s ? { name: s.name.trim(), description: s.description || undefined, kind: s.kind, is_anonymous: s.is_anonymous, allow_multiple_submissions: s.allow_multiple_submissions, requires_review: s.requires_review, confirmation_message: s.confirmation_message || undefined, fields_schema: s.fields_schema ?? [] } : null;
    }, [form.data]);
    const problem = formProblem(dto);
    const changed = !!serverDto && loadedId.current === id && !same(dto, serverDto);
    const autosave = useAutosave({ value: dto, enabled: !!id && p.can("docs.forms.update") && changed && !problem, save: (v) => update.mutateAsync({ id: id as string, ...v }) });

    if (!(id ? p.can("docs.forms.read") : p.can("docs.forms.create"))) return <Page><NoAccessState /></Page>;
    if (id && form.isPending) return <PageSkeleton />;
    if (form.error) return <Page><ErrorState error={form.error} onRetry={() => form.refetch()} /></Page>;
    const f = form.data;
    const canEdit = id ? p.can("docs.forms.update") : true;
    const persistedKeys = new Set((serverDto?.fields_schema ?? []).map((x) => x.key));
    const hasResponses = (f?._count?.submissions ?? 0) > 0;
    /** The key follows the label until the question is saved; a saved key never changes, so collected answers keep matching. */
    const settleKey = (i: number) => {
        const x = fields[i];
        if (!x || persistedKeys.has(x.key) || !/^question_d+$/.test(x.key) || !x.label.trim()) return;
        const key = uniqueKey(slug(x.label), fields.filter((_, j) => j !== i).map((y) => y.key));
        setFields((list) => list.map((y, idx) => (idx === i ? { ...y, key } : y)));
        if (selected === x.key) setSelected(key);
    };
    const removeQuestion = (i: number) => { setFields((l) => l.filter((_, idx) => idx !== i)); setRemoveIdx(null); };

    const questionCount = fields.filter((x) => x.type !== "SECTION").length;
    const createForm = () => {
        setShowProblem(true);
        if (problem) return;
        create.mutate(dto, { onSuccess: (c) => navigate(`/docs/forms/${c.id}`) });
    };
    /** Publish is explicit (outward): save any unsaved change first, then publish it as a new version. */
    const publish = async () => {
        setShowProblem(true);
        if (problem || !id) return;
        try {
            if (changed) await update.mutateAsync({ id, ...dto });
        } catch {
            return; // shown by <SaveStatus /> on the next autosave attempt
        }
        action.mutate({ id, action: "publish" });
    };
    const publicUrl = id ? `${window.location.origin}/f/${id}` : "";

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: "/docs/forms", label: "Forms" }}
                title={name.trim() || (id ? f?.name : "") || "Untitled form"}
                meta={<>{f ? <DocsStatusBadge status={f.status} /> : <Badge variant="outline">Draft</Badge>}{f && f.current_version_number > 0 && <Badge variant="outline">v{f.current_version_number}</Badge>}<span className="text-xs text-muted-foreground">{questionCount} {questionCount === 1 ? "question" : "questions"} · {f?._count?.submissions ?? 0} responses</span></>}
                actions={!f ? (canEdit && <Button onClick={createForm} loading={create.isPending}><Save /> Create form</Button>) : (
                    <>
                        {p.can("docs.forms.update") && <SaveStatus state={autosave} />}
                        {p.can("docs.forms.update") && f.status === "PUBLISHED" && <Button variant="outline" onClick={() => action.mutate({ id: f.id, action: "close" })}><Lock /> Close</Button>}
                        {p.can("docs.forms.update") && f.status === "CLOSED" && <Button variant="outline" onClick={() => action.mutate({ id: f.id, action: "reopen" })}><Unlock /> Reopen</Button>}
                        {p.can("docs.forms.update") && f.status !== "ARCHIVED" && <Button onClick={() => void publish()} loading={action.isPending && action.variables?.action === "publish"}><Rocket /> Publish</Button>}
                        {p.can("docs.forms.delete") && <Button variant="outline" size="icon" aria-label="Delete form" onClick={() => setDeleting(true)}><Trash2 /></Button>}
                    </>
                )}
            />
            <Tabs value={tab} onValueChange={(v) => setSp(() => new URLSearchParams({ tab: v }), { replace: true })}>
                <TabsList className="mb-4">
                    <TabsTrigger value="build">Edit</TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                    {id && <TabsTrigger value="responses">Responses ({f?._count?.submissions ?? 0})</TabsTrigger>}
                    {id && <TabsTrigger value="share">Share</TabsTrigger>}
                </TabsList>
                <TabsContent value="build" className="space-y-3">
                    <FormBuilder
                        fields={fields} setFields={setFields} canEdit={canEdit} name={name} setName={setName} description={description} setDescription={setDescription}
                        selected={selected} setSelected={setSelected} settleKey={settleKey}
                        onRemoveQuestion={(i) => (hasResponses && persistedKeys.has(fields[i].key) ? setRemoveIdx(i) : removeQuestion(i))}
                        settings={(
                            <>
                                <div className="space-y-1.5">
                                    <Label>Kind</Label>
                                    <Select value={kind} onValueChange={(v) => setKind(v as CustomFormKind)} disabled={!canEdit}>
                                        <SelectTrigger aria-label="Kind"><SelectValue /></SelectTrigger>
                                        <SelectContent>{CustomFormKindFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5"><Label htmlFor="form-confirm">Confirmation message</Label><Input id="form-confirm" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} disabled={!canEdit} placeholder="Thanks — we got it." /></div>
                                <Toggle label="Anonymous / public link" hint="Responses are not linked to a person; the published form gets a public URL." checked={anonymous} onChange={setAnonymous} disabled={!canEdit} />
                                <Toggle label="Allow several responses per person" checked={multiple} onChange={setMultiple} disabled={!canEdit} />
                                <Toggle label="Responses need review" checked={review} onChange={setReview} disabled={!canEdit} />
                            </>
                        )}
                    />
                    <ConfirmationDialog
                        isOpen={removeIdx !== null}
                        onClose={() => setRemoveIdx(null)}
                        title="Remove this question?"
                        description="This form already has responses. Answers to this question stay in the saved responses but are no longer shown in the form."
                        confirmText="Remove"
                        variant="destructive"
                        onConfirm={() => removeIdx !== null && removeQuestion(removeIdx)}
                    />
                    {canEdit && problem && (showProblem || !!id) && <p role="alert" className="text-xs text-warning">{problem}{id ? " — changes are saved once this is fixed." : ""}</p>}
                </TabsContent>
                <TabsContent value="preview">
                    <div className="mx-auto max-w-2xl space-y-4 rounded-lg border border-border bg-card p-6">
                        <div><h2 className="text-xl font-medium text-foreground">{name || "Untitled form"}</h2>{description && <p className="text-[13px] text-muted-foreground">{description}</p>}</div>
                        <FormRenderer fields={fields} onSubmit={() => undefined} submitLabel="Submit (preview)" />
                    </div>
                </TabsContent>
                {id && <TabsContent value="responses"><ResponsesTab formId={id} /></TabsContent>}
                {id && f && (
                    <TabsContent value="share" className="space-y-6">
                        <Section title="Public link" description="Anonymous forms that are published can be filled by anyone with the link.">
                            {f.public_link_enabled ? (
                                <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
                                    <code className="min-w-0 flex-1 break-all font-mono text-xs">{publicUrl}</code>
                                    <CopyLinkButton url={publicUrl} />
                                </div>
                            ) : <p className="text-[13px] text-muted-foreground">Make the form anonymous and publish it to get a public link.</p>}
                        </Section>
                        {p.can("docs.forms.assign") && <AssignSection formId={id} published={f.status === "PUBLISHED"} />}
                    </TabsContent>
                )}
            </Tabs>
            <ConfirmationDialog isOpen={deleting} onClose={() => setDeleting(false)} title="Delete this form?" description="The form, its versions and all responses are deleted permanently." confirmText="Delete" variant="destructive" onConfirm={() => { if (id) remove.mutate(id); navigate("/docs/forms"); }} />
        </Page>
    );
}

function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <div className="flex items-start justify-between gap-4 sm:col-span-2">
            <div><div className="text-[13px] text-foreground">{label}</div>{hint && <div className="text-xs text-muted-foreground">{hint}</div>}</div>
            <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />
        </div>
    );
}

function ResponsesTab({ formId }: { formId: string }) {
    const [page, setPage] = useState(1);
    const responses = useFormResponses(formId, { page, limit: 20 });
    const summary = useFormSummary(formId);
    const reviewMut = useReviewResponse();
    const canReview = usePermissions().can("docs.forms.review");
    const columns: DataTableColumn<FormSubmission>[] = [
        { key: "who", header: "Respondent", cell: (s) => (s.is_anonymous || !s.respondent ? <span className="text-muted-foreground">Anonymous</span> : personName(s.respondent.user)) },
        { key: "when", header: "Submitted", cell: (s) => formatDateTime(s.submitted_at), hideBelow: "sm" },
        { key: "answers", header: "Answers", cell: (s) => <span className="line-clamp-2 text-xs text-muted-foreground">{Object.entries(s.answers).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join(" · ")}</span> },
        { key: "status", header: "Status", cell: (s) => <DocsStatusBadge status={s.status} />, hideBelow: "md" },
        {
            key: "review",
            header: <span className="sr-only">Review</span>,
            cell: (s) => canReview && s.status !== "REVIEWED" && (
                <Select value="" onValueChange={(v) => reviewMut.mutate({ id: formId, submissionId: s.id, status: v })}>
                    <SelectTrigger className="h-8 w-28" aria-label="Review response"><SelectValue placeholder="Review" /></SelectTrigger>
                    <SelectContent>{FormSubmissionStatusOptions.filter((o) => ["UNDER_REVIEW", "REVIEWED", "REJECTED"].includes(o.id)).map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            ),
        },
    ];
    return (
        <div className="space-y-6">
            {summary.isPending ? <ListSkeleton rows={2} /> : summary.data && summary.data.questions.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                    {summary.data.questions.map((q) => (
                        <div key={q.key} className="rounded-lg border border-border bg-card p-3">
                            <div className="text-[13px] font-medium text-foreground">{q.label}</div>
                            <div className="mb-2 text-xs text-muted-foreground">{q.responses} responses · {getDropdownOptionLabel(CustomFormFieldTypeOptions, q.type)}</div>
                            {q.options && (
                                <ul className="space-y-1">
                                    {q.options.map((o) => (
                                        <li key={o.value} className="grid grid-cols-[minmax(0,1fr)_80px_32px] items-center gap-2 text-xs">
                                            <span className="truncate">{o.label}</span>
                                            <span className="h-1.5 rounded-full bg-secondary"><span className="block h-1.5 rounded-full bg-info" style={{ width: `${q.responses ? (o.count / q.responses) * 100 : 0}%` }} /></span>
                                            <span className="text-right tabular">{o.count}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {q.average !== undefined && q.average !== null && <div className="text-xl font-medium tabular text-foreground">{q.average.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">average</span></div>}
                            {q.yes !== undefined && <div className="text-xs text-muted-foreground">{q.yes} checked</div>}
                            {q.latest && <ul className="space-y-1 text-xs text-muted-foreground">{q.latest.slice(0, 3).map((l, i) => <li key={i} className="line-clamp-2">“{l}”</li>)}</ul>}
                        </div>
                    ))}
                </div>
            )}
            <DataTable columns={columns} data={responses.data?.data} rowKey={(s) => s.id} loading={responses.isFetching} error={responses.error} onRetry={() => responses.refetch()} pagination={responses.data?.pagination} onPageChange={setPage} empty={{ title: "No responses yet", description: "Assign the form or share its public link." }} />
        </div>
    );
}

function AssignSection({ formId, published }: { formId: string; published: boolean }) {
    const assignments = useFormAssignments(formId);
    const create = useCreateFormAssignment();
    const [target, setTarget] = useState<"ORGANIZATION" | "MEMBERSHIP">("ORGANIZATION");
    const [member, setMember] = useState<string | undefined>();
    const [due, setDue] = useState("");
    const [message, setMessage] = useState("");
    return (
        <Section title="Assign" description="Assigned people get a notification and see the form under “Waiting for you”.">
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                {!published && <p className="text-[13px] text-warning">Publish the form before assigning it.</p>}
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Who</Label>
                        <Select value={target} onValueChange={(v) => setTarget(v as typeof target)}>
                            <SelectTrigger aria-label="Assign to"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="ORGANIZATION">Everyone in the organization</SelectItem><SelectItem value="MEMBERSHIP">One member</SelectItem></SelectContent>
                        </Select>
                    </div>
                    {target === "MEMBERSHIP" && <div className="space-y-1.5"><Label>Member</Label><DocsMemberPicker value={member} onChange={setMember} /></div>}
                    <div className="space-y-1.5"><Label htmlFor="assign-due">Due</Label><Input id="assign-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="assign-msg">Message</Label><Input id="assign-msg" value={message} onChange={(e) => setMessage(e.target.value)} /></div>
                </div>
                <Button
                    disabled={!published || (target === "MEMBERSHIP" && !member)}
                    loading={create.isPending}
                    onClick={() => create.mutate({ id: formId, target_type: target, target_id: target === "MEMBERSHIP" ? member : undefined, due_at: due ? new Date(due).toISOString() : undefined, message: message || undefined }, { onSuccess: () => { setMessage(""); setDue(""); } })}
                >
                    Assign
                </Button>
                {create.data && <p role="status" className="text-xs text-muted-foreground">Assigned to {create.data.recipient_count} people.</p>}
                {!!assignments.data?.length && (
                    <ul className="divide-y divide-border rounded-md border border-border text-[13px]">
                        {assignments.data.map((a) => <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"><span>{a.target_type === "ORGANIZATION" ? "Everyone" : a.target_type.toLowerCase()} · {a.submitted_count}/{a.recipient_count} submitted</span><span className="text-xs text-muted-foreground">{a.due_at ? `due ${formatDate(a.due_at)}` : ""}{a.cancelled_at ? " · cancelled" : ""}</span></li>)}
                    </ul>
                )}
            </div>
        </Section>
    );
}

/** Copies the public link; the button shows "Copied" for a moment instead of a toast. */
function CopyLinkButton({ url }: { url: string }) {
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (!copied) return;
        const t = setTimeout(() => setCopied(false), 1600);
        return () => clearTimeout(t);
    }, [copied]);
    return (
        <Button size="sm" variant="outline" aria-label={copied ? "Copied" : "Copy link"} onClick={() => void navigator.clipboard.writeText(url).then(() => setCopied(true))}>
            {copied ? <><Check /> Copied</> : <><Copy /> Copy</>}
        </Button>
    );
}
