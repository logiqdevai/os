import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { FormField } from "@/features/docs/interfaces/docs.interfaces";

export type Answers = Record<string, unknown>;

/** Validates answers against the field list (required, email, number, scale). Returns field-key → message. */
export function validateAnswers(fields: FormField[], answers: Answers) {
    const errors: Record<string, string> = {};
    for (const f of fields) {
        if (f.type === "SECTION" || f.type === "FILE_UPLOAD" || f.type === "SIGNATURE") continue;
        const v = answers[f.key];
        const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length) || (f.type === "CHECKBOX" && v !== true && f.required);
        if (f.required && empty) { errors[f.key] = "Required"; continue; }
        if (empty) continue;
        if (f.type === "EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) errors[f.key] = "Enter a valid email";
        if (f.type === "NUMBER" && Number.isNaN(Number(v))) errors[f.key] = "Enter a number";
    }
    return errors;
}

/** Renders a custom form (internal fill page and the public form). File and signature fields are not supported yet. */
export function FormRenderer({ fields, onSubmit, pending, submitLabel = "Submit" }: { fields: FormField[]; onSubmit: (answers: Answers) => void; pending?: boolean; submitLabel?: string }) {
    const [answers, setAnswers] = useState<Answers>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const set = (key: string, v: unknown) => { setAnswers((a) => ({ ...a, [key]: v })); setErrors((e) => { const n = { ...e }; delete n[key]; return n; }); };

    return (
        <form
            className="space-y-6"
            onSubmit={(e) => {
                e.preventDefault();
                const errs = validateAnswers(fields, answers);
                setErrors(errs);
                if (!Object.keys(errs).length) onSubmit(answers);
            }}
            noValidate
        >
            {fields.map((f) => {
                const id = `field-${f.key}`;
                const err = errors[f.key];
                if (f.type === "SECTION") return <div key={f.key} className="border-b border-border pb-1 pt-2"><h2 className="text-[15px] font-medium text-foreground">{f.label}</h2>{f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}</div>;
                const label = <Label htmlFor={id} className="text-[13px]">{f.label}{f.required && <span className="text-danger"> *</span>}</Label>;
                const help = f.description && <p className="text-xs text-muted-foreground">{f.description}</p>;
                const v = answers[f.key];
                let control: React.ReactNode;
                switch (f.type) {
                    case "LONG_TEXT":
                        control = <Textarea id={id} rows={4} value={String(v ?? "")} onChange={(e) => set(f.key, e.target.value)} aria-invalid={!!err} />;
                        break;
                    case "NUMBER":
                        control = <Input id={id} inputMode="decimal" value={String(v ?? "")} onChange={(e) => set(f.key, e.target.value === "" ? undefined : e.target.value)} aria-invalid={!!err} />;
                        break;
                    case "EMAIL":
                        control = <Input id={id} type="email" value={String(v ?? "")} onChange={(e) => set(f.key, e.target.value)} aria-invalid={!!err} />;
                        break;
                    case "DATE":
                        control = <Input id={id} type="date" value={String(v ?? "")} onChange={(e) => set(f.key, e.target.value)} aria-invalid={!!err} />;
                        break;
                    case "SINGLE_CHOICE":
                        control = (
                            <RadioGroup id={id} value={String(v ?? "")} onValueChange={(x) => set(f.key, x)} className="space-y-1">
                                {f.options?.map((o) => <label key={o.value} className="flex items-center gap-2 text-[13px]"><RadioGroupItem value={o.value} /> {o.label}</label>)}
                            </RadioGroup>
                        );
                        break;
                    case "MULTI_CHOICE": {
                        const list = Array.isArray(v) ? (v as string[]) : [];
                        control = (
                            <div id={id} className="space-y-1">
                                {f.options?.map((o) => (
                                    <label key={o.value} className="flex items-center gap-2 text-[13px]">
                                        <Checkbox checked={list.includes(o.value)} onCheckedChange={(c) => set(f.key, c ? [...list, o.value] : list.filter((x) => x !== o.value))} /> {o.label}
                                    </label>
                                ))}
                            </div>
                        );
                        break;
                    }
                    case "CHECKBOX":
                        return (
                            <div key={f.key} className="space-y-1">
                                <label className="flex items-start gap-2 text-[13px]"><Checkbox id={id} checked={v === true} onCheckedChange={(c) => set(f.key, c === true)} className="mt-0.5" /> <span>{f.label}{f.required && <span className="text-danger"> *</span>}</span></label>
                                {help}
                                {err && <p className="text-xs text-danger">{err}</p>}
                            </div>
                        );
                    case "SCALE": {
                        const min = f.scale?.min ?? 1;
                        const max = f.scale?.max ?? 5;
                        control = (
                            <div id={id} className="space-y-1">
                                <div className="flex flex-wrap gap-1.5">
                                    {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
                                        <Button key={n} type="button" size="sm" variant={v === n ? "default" : "outline"} className="min-w-9" onClick={() => set(f.key, n)} aria-pressed={v === n}>{n}</Button>
                                    ))}
                                </div>
                                {(f.scale?.min_label || f.scale?.max_label) && <div className="flex justify-between text-xs text-muted-foreground"><span>{f.scale?.min_label}</span><span>{f.scale?.max_label}</span></div>}
                            </div>
                        );
                        break;
                    }
                    case "FILE_UPLOAD":
                    case "SIGNATURE":
                        control = <p className="text-xs text-muted-foreground">This field type cannot be filled here yet.</p>;
                        break;
                    default:
                        control = <Input id={id} value={String(v ?? "")} onChange={(e) => set(f.key, e.target.value)} aria-invalid={!!err} />;
                }
                return (
                    <div key={f.key} className={cn("space-y-1.5")}>
                        {label}
                        {help}
                        {control}
                        {err && <p className="text-xs text-danger">{err}</p>}
                    </div>
                );
            })}
            <Button type="submit" loading={pending} className="w-full sm:w-auto">{submitLabel}</Button>
        </form>
    );
}
