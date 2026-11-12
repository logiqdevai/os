import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { KeyValueList } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Can } from "@/components/access/can";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { useCustomFields } from "@/features/crm/custom-fields/hooks/use-custom-fields";
import { useCrmMembers } from "@/features/crm/settings/hooks/use-crm-settings";
import type { CustomFieldDefinition, CustomFieldEntity, CustomFieldValues } from "@/features/crm/custom-fields/interfaces/custom-fields.interfaces";
import { CrmPaths } from "../crm-paths";
import { memberLabel, Panel } from "./crm-ui";

const NONE = "__none";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isEmpty = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

/**
 * Form state for custom fields inside a record dialog. `record` null/undefined = create (field defaults apply);
 * a record with `custom_fields` = edit (only changed keys are sent); a record loaded without values (list rows)
 * = off, so the dialog never overwrites values it did not load.
 */
export function useCustomFieldValues(entityType: CustomFieldEntity, open: boolean, record: { custom_fields?: CustomFieldValues } | null | undefined) {
    const mode = !record ? "create" : record.custom_fields ? "edit" : "off";
    const initial = mode === "edit" ? record!.custom_fields! : null;
    const defs = useCustomFields(entityType, open && mode !== "off");
    const [values, setValues] = useState<CustomFieldValues>({});
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setError(null);
        if (initial) setValues({ ...initial });
        else setValues(Object.fromEntries((defs.data ?? []).filter((d) => !isEmpty(d.default_value)).map((d) => [d.key, d.default_value])));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initial, defs.data]);

    const definitions = useMemo(() => (mode === "off" ? [] : defs.data ?? []), [defs.data, mode]);

    /** Client-side check (the API validates again). Returns false and sets `error` when invalid. */
    const validate = () => {
        const msg = validateCustomFieldValues(definitions, values);
        setError(msg);
        return !msg;
    };

    const payload = (): CustomFieldValues | undefined => {
        if (!definitions.length) return undefined;
        const out: CustomFieldValues = {};
        for (const d of definitions) {
            const v = values[d.key];
            if (initial && JSON.stringify(v ?? null) === JSON.stringify(initial[d.key] ?? null)) continue;
            if (!initial && isEmpty(v)) continue;
            out[d.key] = isEmpty(v) ? null : v;
        }
        return Object.keys(out).length ? out : undefined;
    };

    return { definitions, values, setValue: (key: string, v: unknown) => setValues((p) => ({ ...p, [key]: v })), error, setError, validate, payload };
}

export function validateCustomFieldValues(defs: CustomFieldDefinition[], values: CustomFieldValues): string | null {
    for (const d of defs) {
        const v = values[d.key];
        if (isEmpty(v)) {
            if (d.is_required) return `${d.label} is required`;
            continue;
        }
        if (["NUMBER", "DECIMAL", "CURRENCY", "PERCENTAGE"].includes(d.type)) {
            const n = Number(v);
            if (!Number.isFinite(n)) return `${d.label} must be a number`;
            if (d.type === "NUMBER" && !Number.isInteger(n)) return `${d.label} must be a whole number`;
            if (d.validation?.min !== undefined && n < d.validation.min) return `${d.label} must be at least ${d.validation.min}`;
            if (d.validation?.max !== undefined && n > d.validation.max) return `${d.label} must be at most ${d.validation.max}`;
        }
        if (d.type === "EMAIL" && !EMAIL.test(String(v))) return `${d.label} must be an email address`;
        if (d.type === "URL") {
            try {
                const s = String(v);
                new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
            } catch {
                return `${d.label} must be a valid link`;
            }
        }
    }
    return null;
}

/** Group definitions by their field group (ungrouped first). */
function grouped(defs: CustomFieldDefinition[]) {
    const out: { name: string | null; fields: CustomFieldDefinition[] }[] = [];
    for (const d of defs) {
        const name = d.group?.name ?? null;
        const g = out.find((x) => x.name === name);
        if (g) g.fields.push(d);
        else out.push({ name, fields: [d] });
    }
    return out.sort((a, b) => (a.name === null ? -1 : b.name === null ? 1 : 0));
}

/**
 * Inputs for every active custom field of a record type (02 §24) — rendered at the end of a record form.
 * @api GET /custom-fields?entity_type= · values go in `custom_fields` of the create/update body
 */
export function CustomFieldInputs({ state, disabled }: { state: ReturnType<typeof useCustomFieldValues>; disabled?: boolean }) {
    const { definitions, values, setValue, error } = state;
    if (!definitions.length) return null;
    return (
        <div className="space-y-3 sm:col-span-2">
            {grouped(definitions).map((g) => (
                <fieldset key={g.name ?? "_"} className="space-y-3 rounded-md border border-border p-3">
                    <legend className="px-1 text-xs font-medium text-muted-foreground">{g.name ?? "Custom fields"}</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {g.fields.map((d) => (
                            <div key={d.id} className={d.type === "LONG_TEXT" || d.type === "MULTI_SELECT" ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
                                {d.type !== "BOOLEAN" && <Label htmlFor={`cf-${d.key}`}>{d.label}{d.is_required && <span className="text-danger"> *</span>}</Label>}
                                <FieldInput def={d} value={values[d.key]} onChange={(v) => setValue(d.key, v)} disabled={disabled} />
                                {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                            </div>
                        ))}
                    </div>
                </fieldset>
            ))}
            {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
        </div>
    );
}

function FieldInput({ def, value, onChange, disabled }: { def: CustomFieldDefinition; value: unknown; onChange: (v: unknown) => void; disabled?: boolean }) {
    const id = `cf-${def.key}`;
    const str = value === undefined || value === null ? "" : String(value);
    switch (def.type) {
        case "LONG_TEXT":
            return <Textarea id={id} rows={3} value={str} onChange={(e) => onChange(e.target.value)} disabled={disabled} />;
        case "NUMBER": case "DECIMAL": case "CURRENCY": case "PERCENTAGE":
            return <Input id={id} inputMode="decimal" value={str} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value.replace(",", ".") as unknown)} onBlur={() => { if (str !== "" && Number.isFinite(Number(str))) onChange(Number(str)); }} disabled={disabled} />;
        case "BOOLEAN":
            return (
                <div className="flex items-center gap-2 pt-1">
                    <Switch id={id} checked={value === true} onCheckedChange={(c) => onChange(c)} disabled={disabled} />
                    <Label htmlFor={id}>{def.label}</Label>
                </div>
            );
        case "DATE":
            return <Input id={id} type="date" value={str.slice(0, 10)} onChange={(e) => onChange(e.target.value || null)} disabled={disabled} />;
        case "DATETIME":
            return <Input id={id} type="datetime-local" value={str ? toLocalInput(str) : ""} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} disabled={disabled} />;
        case "EMAIL":
            return <Input id={id} type="email" value={str} onChange={(e) => onChange(e.target.value)} disabled={disabled} />;
        case "URL":
            return <Input id={id} inputMode="url" placeholder="https://" value={str} onChange={(e) => onChange(e.target.value)} disabled={disabled} />;
        case "DROPDOWN": case "RADIO":
            return (
                <Select value={str || NONE} onValueChange={(v) => onChange(v === NONE ? null : v)} disabled={disabled}>
                    <SelectTrigger id={id} aria-label={def.label}><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {(def.options ?? []).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            );
        case "MULTI_SELECT": {
            const list = Array.isArray(value) ? (value as string[]) : [];
            return (
                <div id={id} className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-border p-2">
                    {(def.options ?? []).map((o) => (
                        <label key={o.value} className="flex items-center gap-1.5 text-[13px]">
                            <Checkbox checked={list.includes(o.value)} disabled={disabled} onCheckedChange={(c) => onChange(c ? [...list, o.value] : list.filter((x) => x !== o.value))} />
                            {o.label}
                        </label>
                    ))}
                </div>
            );
        }
        case "USER":
            return <MemberField id={id} value={str} onChange={onChange} disabled={disabled} label={def.label} />;
        default:
            return <Input id={id} value={str} onChange={(e) => onChange(e.target.value)} disabled={disabled} />;
    }
}

function MemberField({ id, value, onChange, disabled, label }: { id: string; value: string; onChange: (v: unknown) => void; disabled?: boolean; label: string }) {
    const members = useCrmMembers();
    return (
        <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? null : v)} disabled={disabled}>
            <SelectTrigger id={id} aria-label={label}><SelectValue /></SelectTrigger>
            <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {members.data?.map((m) => <SelectItem key={m.id} value={m.id}>{memberLabel(m)}</SelectItem>)}
            </SelectContent>
        </Select>
    );
}

const toLocalInput = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Read-only display of one value. */
export function CustomFieldValue({ def, value }: { def: CustomFieldDefinition; value: unknown }) {
    const members = useCrmMembers(def.type === "USER");
    if (isEmpty(value)) return null;
    const label = (v: unknown) => def.options?.find((o) => o.value === v)?.label ?? String(v);
    switch (def.type) {
        case "BOOLEAN": return <>{value ? "Yes" : "No"}</>;
        case "DATE": return <>{formatDate(String(value))}</>;
        case "DATETIME": return <>{formatDateTime(String(value))}</>;
        case "NUMBER": case "DECIMAL": return <span className="tabular">{formatNumber(Number(value), def.type === "DECIMAL" ? 2 : 0)}</span>;
        case "CURRENCY": return <span className="tabular">{formatNumber(Number(value), 2)}</span>;
        case "PERCENTAGE": return <span className="tabular">{formatNumber(Number(value), 2)}%</span>;
        case "URL": return <a href={String(value)} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline underline-offset-2">{String(value).replace(/^https?:\/\//, "").slice(0, 40)}<ExternalLink className="size-3" /></a>;
        case "EMAIL": return <a href={`mailto:${String(value)}`} className="underline underline-offset-2">{String(value)}</a>;
        case "DROPDOWN": case "RADIO": return <Badge>{label(value)}</Badge>;
        case "MULTI_SELECT": return <span className="flex flex-wrap gap-1">{(value as string[]).map((v) => <Badge key={v}>{label(v)}</Badge>)}</span>;
        case "USER": { const m = members.data?.find((x) => x.id === value); return <>{m ? memberLabel(m) : "Member"}</>; }
        default: return <span className="whitespace-pre-wrap">{String(value)}</span>;
    }
}

/** Detail-page panel listing the record's custom field values (hidden when the org has no fields). */
export function CustomFieldsPanel({ entityType, values }: { entityType: CustomFieldEntity; values: CustomFieldValues | undefined }) {
    const defs = useCustomFields(entityType);
    if (!defs.data?.length) return null;
    return (
        <>
            {grouped(defs.data).map((g) => (
                <Panel
                    key={g.name ?? "_"}
                    title={g.name ?? "Custom fields"}
                    actions={g.name === null ? <Can permission="platform.custom_fields.manage"><Link to={CrmPaths.custom_fields} className="text-xs text-muted-foreground hover:text-foreground hover:underline">Manage</Link></Can> : undefined}
                >
                    <KeyValueList columns={1} items={g.fields.map((d) => ({ label: d.label, value: isEmpty(values?.[d.key]) ? null : <CustomFieldValue def={d} value={values?.[d.key]} /> }))} />
                </Panel>
            ))}
        </>
    );
}
