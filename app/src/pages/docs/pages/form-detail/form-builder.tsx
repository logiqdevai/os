import { useEffect, useState, type DragEvent, type ReactNode } from "react";
import {
    AlignLeft, ArrowDown, ArrowUp, Calendar, Check, CircleDot, Copy, FileUp, Hash, ListChecks, Mail, PenLine, Plus, SlidersHorizontal, SquareCheck, ToggleLeft, Trash2, Type,
    type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomFormFieldTypeOptions } from "@/config/constants/dropdowns/docs/docs.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import type { CustomFormFieldType, FormField } from "@/features/docs/interfaces/docs.interfaces";

export const CHOICE: CustomFormFieldType[] = ["SINGLE_CHOICE", "MULTI_CHOICE"];
export type Opts = NonNullable<FormField["options"]>;

/** One option: its own input with Save (commit the text) and Delete. Unsaved text stays local until Save, so a half-typed option never reaches the form. */
function OptionRow({ label, index, taken, canEdit, canDelete, autoFocus, onSave, onDelete }: {
    label: string; index: number; taken: string[]; canEdit: boolean; canDelete: boolean; autoFocus?: boolean; onSave: (label: string) => void; onDelete: () => void;
}) {
    const [draft, setDraft] = useState(label);
    useEffect(() => setDraft(label), [label]);
    const text = draft.trim();
    const duplicate = !!text && taken.some((t) => t.trim().toLowerCase() === text.toLowerCase());
    const dirty = text !== label;
    const canSave = canEdit && dirty && !!text && !duplicate;
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-1">
                <Input
                    value={draft} autoFocus={autoFocus} placeholder={`Option ${index + 1}`} aria-label={`Option ${index + 1}`} disabled={!canEdit} aria-invalid={duplicate || undefined}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (canSave) onSave(text); } if (e.key === "Escape") { setDraft(label); if (!label) onDelete(); } }}
                />
                {canEdit && <Button type="button" variant="outline" size="icon-sm" aria-label="Save option" disabled={!canSave} onClick={() => onSave(text)}><Check /></Button>}
                {canEdit && <Button type="button" variant="ghost" size="icon-sm" aria-label="Delete option" disabled={!canDelete} onClick={onDelete}><Trash2 /></Button>}
            </div>
            {duplicate && <p className="text-xs text-warning">Another option already has this text</p>}
        </div>
    );
}

/** Choice options, one input per option. Added options live in a pending row until saved. */
function ChoiceOptions({ options, canEdit, onChange }: { options: Opts; canEdit: boolean; onChange: (o: Opts) => void }) {
    const [adding, setAdding] = useState(false);
    const nextValue = () => { let n = options.length + 1; while (options.some((x) => x.value === `option_${n}`)) n++; return `option_${n}`; };
    return (
        <div className="space-y-1.5">
            <Label className="text-xs">Options</Label>
            {options.map((o, oi) => (
                <OptionRow key={o.value} label={o.label} index={oi} canEdit={canEdit} canDelete={options.length > 1}
                    taken={options.filter((_, xi) => xi !== oi).map((x) => x.label)}
                    onSave={(label) => onChange(options.map((x, xi) => (xi === oi ? { ...x, label } : x)))}
                    onDelete={() => onChange(options.filter((_, xi) => xi !== oi))} />
            ))}
            {adding && (
                <OptionRow key={`new-${options.length}`} label="" index={options.length} canEdit={canEdit} canDelete autoFocus taken={options.map((x) => x.label)}
                    onSave={(label) => { onChange([...options, { value: nextValue(), label }]); }}
                    onDelete={() => setAdding(false)} />
            )}
            {canEdit && !adding && <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(true)}><Plus /> Add option</Button>}
        </div>
    );
}

const ICONS: Record<CustomFormFieldType, LucideIcon> = {
    SHORT_TEXT: Type, LONG_TEXT: AlignLeft, NUMBER: Hash, EMAIL: Mail, DATE: Calendar, SINGLE_CHOICE: CircleDot, MULTI_CHOICE: ListChecks,
    CHECKBOX: ToggleLeft, SCALE: SlidersHorizontal, FILE_UPLOAD: FileUp, SIGNATURE: PenLine, SECTION: SquareCheck,
};
const PALETTE: { title: string; types: CustomFormFieldType[] }[] = [
    { title: "Questions", types: ["SHORT_TEXT", "LONG_TEXT", "NUMBER", "EMAIL", "DATE", "SINGLE_CHOICE", "MULTI_CHOICE", "CHECKBOX", "SCALE"] },
    { title: "Documents", types: ["FILE_UPLOAD", "SIGNATURE"] },
];
const DRAG_TYPE = "application/x-form-field-type";

type Group = { head: number | null; items: number[] };
/** The flat schema read as sections: a SECTION entry starts a group, the questions after it belong to it. */
function groupFields(fields: FormField[]): Group[] {
    const groups: Group[] = [{ head: null, items: [] }];
    fields.forEach((f, i) => {
        if (f.type === "SECTION") groups.push({ head: i, items: [] });
        else groups[groups.length - 1].items.push(i);
    });
    return groups.length > 1 && !groups[0].items.length ? groups.slice(1) : groups;
}
const flatten = (fields: FormField[], groups: Group[]): FormField[] => groups.flatMap((g) => [...(g.head !== null ? [fields[g.head]] : []), ...g.items.map((i) => fields[i])]);

/** Read-only look of a question, so the canvas shows what respondents will get. */
function QuestionPreview({ field }: { field: FormField }) {
    const ph = getDropdownOptionLabel(CustomFormFieldTypeOptions, field.type);
    if (CHOICE.includes(field.type)) {
        return (
            <ul className="space-y-1 text-[13px] text-muted-foreground">
                {(field.options ?? []).map((o) => <li key={o.value} className="flex items-center gap-2"><span className={`size-3.5 border border-border ${field.type === "SINGLE_CHOICE" ? "rounded-full" : "rounded-[3px]"}`} />{o.label}</li>)}
            </ul>
        );
    }
    if (field.type === "SCALE") return <div className="text-[13px] text-muted-foreground">{field.scale?.min ?? 1} – {field.scale?.max ?? 5}{field.scale?.min_label || field.scale?.max_label ? ` (${field.scale?.min_label ?? ""} … ${field.scale?.max_label ?? ""})` : ""}</div>;
    if (field.type === "CHECKBOX") return <div className="flex items-center gap-2 text-[13px] text-muted-foreground"><Switch checked={false} disabled aria-hidden /> Yes / No</div>;
    return <Input disabled tabIndex={-1} placeholder={ph} aria-hidden className="bg-muted/50" />;
}

/** Settings of the selected question: label, type, required, options, scale. */
function FieldSettings({ field, index, canEdit, editField, settleKey }: { field: FormField; index: number; canEdit: boolean; editField: (i: number, p: Partial<FormField>) => void; settleKey: (i: number) => void }) {
    return (
        <div className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="field-label">Question</Label><Input id="field-label" value={field.label} disabled={!canEdit} onChange={(e) => editField(index, { label: e.target.value })} onBlur={() => settleKey(index)} /></div>
            <div className="space-y-1.5"><Label htmlFor="field-help">Help text</Label><Textarea id="field-help" rows={2} value={field.description ?? ""} disabled={!canEdit} onChange={(e) => editField(index, { description: e.target.value || undefined })} /></div>
            <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={field.type} disabled={!canEdit} onValueChange={(v) => editField(index, { type: v as CustomFormFieldType, ...(CHOICE.includes(v as CustomFormFieldType) && !field.options?.length ? { options: [{ value: "option_1", label: "Option 1" }] } : {}), ...(v === "SCALE" ? { scale: { min: 1, max: 5 } } : {}) })}>
                    <SelectTrigger aria-label="Question type"><SelectValue /></SelectTrigger>
                    <SelectContent>{CustomFormFieldTypeOptions.filter((o) => o.id !== "SECTION").map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <label className="flex items-center justify-between gap-3 text-[13px]">Required<Switch checked={field.required} onCheckedChange={(v) => editField(index, { required: v })} disabled={!canEdit} aria-label="Required" /></label>
            <label className="flex items-center justify-between gap-3 text-[13px]">Visible to respondents<Switch checked={field.visible !== false} onCheckedChange={(v) => editField(index, { visible: v })} disabled={!canEdit} aria-label="Visible" /></label>
            {CHOICE.includes(field.type) && <ChoiceOptions options={field.options ?? []} canEdit={canEdit} onChange={(options) => editField(index, { options })} />}
            {field.type === "SCALE" && (
                <div className="grid grid-cols-2 gap-2">
                    <Input type="number" aria-label="Minimum" value={field.scale?.min ?? 1} onChange={(e) => editField(index, { scale: { ...(field.scale ?? { min: 1, max: 5 }), min: Number(e.target.value) } })} disabled={!canEdit} />
                    <Input type="number" aria-label="Maximum" value={field.scale?.max ?? 5} onChange={(e) => editField(index, { scale: { ...(field.scale ?? { min: 1, max: 5 }), max: Number(e.target.value) } })} disabled={!canEdit} />
                    <Input aria-label="Low label" placeholder="Low label" value={field.scale?.min_label ?? ""} onChange={(e) => editField(index, { scale: { ...(field.scale ?? { min: 1, max: 5 }), min_label: e.target.value } })} disabled={!canEdit} />
                    <Input aria-label="High label" placeholder="High label" value={field.scale?.max_label ?? ""} onChange={(e) => editField(index, { scale: { ...(field.scale ?? { min: 1, max: 5 }), max_label: e.target.value } })} disabled={!canEdit} />
                </div>
            )}
            <div className="font-mono text-xs text-muted-foreground">{field.key}</div>
        </div>
    );
}

export interface FormBuilderProps {
    fields: FormField[];
    setFields: (u: (l: FormField[]) => FormField[]) => void;
    canEdit: boolean;
    name: string; setName: (v: string) => void;
    description: string; setDescription: (v: string) => void;
    selected: string | null; setSelected: (k: string | null) => void;
    onRemoveQuestion: (i: number) => void;
    settleKey: (i: number) => void;
    /** Form-level settings (kind, confirmation message, toggles), shown in the right panel's "Form" tab. */
    settings: ReactNode;
}

/** Three-column builder: field palette · canvas of sections and questions · settings of the selected question. */
export function FormBuilder({ fields, setFields, canEdit, name, setName, description, setDescription, selected, setSelected, onRemoveQuestion, settleKey, settings }: FormBuilderProps) {
    const [panel, setPanel] = useState("field");
    const groups = groupFields(fields);
    const selectedIdx = fields.findIndex((f) => f.key === selected && f.type !== "SECTION");
    const editField = (i: number, patch: Partial<FormField>) => setFields((list) => list.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

    const nextKey = (prefix: string) => {
        const taken = fields.map((x) => x.key);
        let n = fields.length + 1;
        while (taken.includes(`${prefix}_${n}`)) n++;
        return `${prefix}_${n}`;
    };
    /** Index where a new item lands: the end of the section that starts at `head`. */
    const endOf = (head: number | null) => {
        let p = head === null ? 0 : head + 1;
        while (p < fields.length && fields[p].type !== "SECTION") p++;
        return p;
    };
    const defaultHead = () => {
        const g = selectedIdx >= 0 ? groups.find((x) => x.items.includes(selectedIdx)) : undefined;
        return (g ?? groups[groups.length - 1]).head;
    };
    const addField = (type: CustomFormFieldType, head: number | null | undefined = undefined) => {
        if (!canEdit) return;
        const key = nextKey("question");
        const field: FormField = {
            key, type, label: "New question", required: false,
            ...(CHOICE.includes(type) ? { options: [{ value: "option_1", label: "Option 1" }] } : {}),
            ...(type === "SCALE" ? { scale: { min: 1, max: 5 } } : {}),
        };
        const at = endOf(head === undefined ? defaultHead() : head);
        setFields((l) => [...l.slice(0, at), field, ...l.slice(at)]);
        setSelected(key); setPanel("field");
    };
    const addSection = () => {
        const n = fields.filter((f) => f.type === "SECTION").length + 1;
        setFields((l) => [...l, { key: nextKey("section"), type: "SECTION", label: `Section ${n}`, required: false }]);
    };
    const duplicate = (i: number) => {
        const key = nextKey("question");
        setFields((l) => [...l.slice(0, i + 1), { ...l[i], key, options: l[i].options?.map((o) => ({ ...o })) }, ...l.slice(i + 1)]);
        setSelected(key);
    };
    const moveQuestion = (i: number, dir: -1 | 1) => setFields((l) => {
        const j = i + dir;
        if (j < 0 || j >= l.length) return l;
        const n = [...l]; [n[i], n[j]] = [n[j], n[i]];
        return n;
    });
    const moveSection = (gi: number, dir: -1 | 1) => setFields((l) => {
        const gs = groupFields(l), j = gi + dir;
        if (j < 0 || j >= gs.length) return l;
        const n = [...gs]; [n[gi], n[j]] = [n[j], n[gi]];
        return flatten(l, n);
    });
    /** Removing a section keeps its questions: they fall into the section above. */
    const removeSection = (head: number) => setFields((l) => l.filter((_, i) => i !== head));

    const onDrop = (e: DragEvent, head: number | null) => {
        e.preventDefault();
        const t = e.dataTransfer.getData(DRAG_TYPE) as CustomFormFieldType;
        if (t) addField(t, head);
    };
    const dropProps = (head: number | null) => canEdit ? { onDragOver: (e: DragEvent) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) e.preventDefault(); }, onDrop: (e: DragEvent) => onDrop(e, head) } : {};
    const selField = selectedIdx >= 0 ? fields[selectedIdx] : null;

    return (
        <div className="grid items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
            {/* Palette */}
            <aside className="rounded-lg border border-border bg-card p-3 lg:sticky lg:top-4">
                {PALETTE.map((g) => (
                    <div key={g.title} className="mb-3 last:mb-0">
                        <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{g.title}</div>
                        <div className="grid grid-cols-2 gap-0.5 sm:grid-cols-3 lg:grid-cols-1">
                            {g.types.map((t) => {
                                const Icon = ICONS[t];
                                return (
                                    <button key={t} type="button" disabled={!canEdit} draggable={canEdit} onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, t)} onClick={() => addField(t)}
                                        className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-muted disabled:opacity-50">
                                        <Icon className="size-4 shrink-0 text-muted-foreground" />{getDropdownOptionLabel(CustomFormFieldTypeOptions, t)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </aside>

            {/* Canvas */}
            <div className="min-w-0 space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6">
                <div className="space-y-1">
                    <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} placeholder="Untitled form" aria-label="Form name"
                        className="h-auto border-0 bg-transparent px-0 text-2xl font-medium shadow-none focus-visible:ring-0" />
                    <Input value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} placeholder="Describe what this form is used for" aria-label="Form description"
                        className="h-auto border-0 bg-transparent px-0 text-[13px] shadow-none focus-visible:ring-0" />
                </div>
                {groups.map((g, gi) => (
                    <div key={g.head ?? "lead"} className="space-y-2" {...dropProps(g.head)}>
                        {g.head !== null && (
                            <div className="flex items-center gap-1 rounded-md bg-secondary px-3 py-1.5">
                                <Input value={fields[g.head].label} aria-label="Section title" disabled={!canEdit} onChange={(e) => editField(g.head as number, { label: e.target.value })}
                                    className="h-7 border-0 bg-transparent px-0 text-[13px] font-medium shadow-none focus-visible:ring-0" />
                                {canEdit && (
                                    <>
                                        <Button variant="ghost" size="icon-sm" aria-label="Move section up" disabled={gi === 0} onClick={() => moveSection(gi, -1)}><ArrowUp /></Button>
                                        <Button variant="ghost" size="icon-sm" aria-label="Move section down" disabled={gi === groups.length - 1} onClick={() => moveSection(gi, 1)}><ArrowDown /></Button>
                                        <Button variant="ghost" size="icon-sm" aria-label="Remove section" onClick={() => removeSection(g.head as number)}><Trash2 /></Button>
                                    </>
                                )}
                            </div>
                        )}
                        {g.items.map((i) => {
                            const fl = fields[i];
                            const isSel = fl.key === selected;
                            return (
                                <div key={fl.key} role="button" tabIndex={0} onClick={() => { setSelected(fl.key); setPanel("field"); }} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setSelected(fl.key); setPanel("field"); } }}
                                    className={`flex cursor-pointer items-start gap-2 rounded-lg border bg-card p-3 transition-colors ${isSel ? "border-primary ring-1 ring-primary" : "border-border hover:border-muted-foreground/40"} ${fl.visible === false ? "border-dashed opacity-70" : ""}`}>
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <div className="text-[13px] font-medium text-foreground">{fl.label || "Untitled question"}{fl.required && <span className="text-destructive"> *</span>}{fl.visible === false && <span className="ml-2 text-xs font-normal text-muted-foreground">Hidden</span>}</div>
                                        <QuestionPreview field={fl} />
                                    </div>
                                    {canEdit && (
                                        <div className="flex shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => moveQuestion(i, -1)}><ArrowUp /></Button>
                                            <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === fields.length - 1} onClick={() => moveQuestion(i, 1)}><ArrowDown /></Button>
                                            <Button variant="ghost" size="icon-sm" aria-label="Duplicate question" onClick={() => duplicate(i)}><Copy /></Button>
                                            <Button variant="ghost" size="icon-sm" aria-label="Remove question" onClick={() => onRemoveQuestion(i)}><Trash2 /></Button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {!g.items.length && (
                            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">Add fields from the left or drag one here.</div>
                        )}
                    </div>
                ))}
                {canEdit && <Button variant="outline" size="sm" onClick={addSection}><Plus /> Add section</Button>}
            </div>

            {/* Settings */}
            <aside className="rounded-lg border border-border bg-card lg:sticky lg:top-4">
                <Tabs value={panel} onValueChange={setPanel}>
                    <TabsList className="m-2"><TabsTrigger value="field">Field</TabsTrigger><TabsTrigger value="form">Form</TabsTrigger></TabsList>
                    <TabsContent value="field" className="p-4 pt-2">
                        {selField ? <FieldSettings field={selField} index={selectedIdx} canEdit={canEdit} editField={editField} settleKey={settleKey} />
                            : <p className="py-6 text-center text-[13px] text-muted-foreground">Select a question to edit its settings.</p>}
                    </TabsContent>
                    <TabsContent value="form" className="space-y-4 p-4 pt-2">{settings}</TabsContent>
                </Tabs>
            </aside>
        </div>
    );
}
