import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ActionEntry, ActionField, CatalogField, ConditionGroup, OutboundWebhook, RuleStep } from "@/features/automation/interfaces/automation.interfaces";
import { MemberPicker } from "../../../components/automation-ui";
import { useApprovalPolicies } from "@/features/automation/hooks/use-automation";
import { ConditionsEditor } from "./conditions-editor";

interface Props {
    index: number;
    total: number;
    step: RuleStep;
    action: ActionEntry | undefined;
    webhooks: OutboundWebhook[];
    triggerFields: CatalogField[];
    disabled?: boolean;
    onChange: (step: RuleStep) => void;
    onMove: (dir: -1 | 1) => void;
    onRemove: () => void;
}

/** One ordered step: inputs rendered from the action's field list. Text inputs accept `{{event.payload.x}}` templates. */
export function StepCard({ index, total, step, action, webhooks, triggerFields, disabled, onChange, onMove, onRemove }: Props) {
    const setInput = (key: string, value: unknown) => onChange({ ...step, inputs: { ...step.inputs, [key]: value } });

    return (
        <div className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                <span className="grid size-6 place-items-center rounded-full bg-secondary text-xs font-medium text-foreground tabular">{index + 1}</span>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-foreground">{action?.name ?? step.action_key}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground">{step.key}</div>
                </div>
                {action && !action.available && <Badge variant="warning">Not available yet</Badge>}
                {action?.is_destructive && <Badge variant="danger"><AlertTriangle className="size-3" /> Destructive</Badge>}
                {action && !action.can_use && <Badge variant="neutral" title={action.required_permissions.join(", ")}>Needs permission</Badge>}
                <div className="flex items-center">
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" disabled={disabled || index === 0} onClick={() => onMove(-1)}><ArrowUp /></Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Move down" disabled={disabled || index === total - 1} onClick={() => onMove(1)}><ArrowDown /></Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove step" disabled={disabled} onClick={onRemove}><Trash2 /></Button>
                </div>
            </div>
            <div className="space-y-4 p-3">
                {!action && <p className="text-[13px] text-danger">Unknown action “{step.action_key}”. Remove this step.</p>}
                {action?.description && <p className="text-xs text-muted-foreground">{action.description}</p>}
                {action?.fields.map((f) => (
                    <FieldInput
                        key={f.key}
                        id={`${step.key}-${f.key}`}
                        field={f}
                        value={step.inputs[f.key]}
                        onChange={(v) => setInput(f.key, v)}
                        webhooks={webhooks}
                        triggerFields={triggerFields}
                        disabled={disabled}
                    />
                ))}
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor={`${step.key}-key`}>Step key</Label>
                        <Input id={`${step.key}-key`} value={step.key} disabled={disabled} className="font-mono text-xs" onChange={(e) => onChange({ ...step, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40) })} />
                        <p className="text-xs text-muted-foreground">Later steps use <code>{`{{steps.${step.key}.output}}`}</code>.</p>
                    </div>
                    <div className="space-y-1.5">
                        <Label>If this step fails</Label>
                        <Select value={step.on_error ?? "stop"} onValueChange={(v) => onChange({ ...step, on_error: v as "stop" | "continue" })} disabled={disabled}>
                            <SelectTrigger aria-label="If this step fails"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="stop">Stop the run (retry, then dead-letter)</SelectItem>
                                <SelectItem value="continue">Continue with the next step</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FieldInput({ id, field, value, onChange, webhooks, triggerFields, disabled }: { id: string; field: ActionField; value: unknown; onChange: (v: unknown) => void; webhooks: OutboundWebhook[]; triggerFields: CatalogField[]; disabled?: boolean }) {
    const label = (
        <Label htmlFor={id}>
            {field.label}
            {field.required && <span className="text-danger"> *</span>}
        </Label>
    );
    const help = field.help && <p className="text-xs text-muted-foreground">{field.help}</p>;
    const str = value === undefined || value === null ? "" : String(value);

    switch (field.type) {
        case "textarea":
            return <div className="space-y-1.5">{label}<Textarea id={id} rows={3} value={str} placeholder={field.placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} />{help}</div>;
        case "number":
            return <div className="space-y-1.5">{label}<Input id={id} type="number" inputMode="numeric" value={str} disabled={disabled} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />{help}</div>;
        case "boolean":
            return <div className="flex items-center justify-between gap-3">{label}<Switch id={id} checked={!!value} disabled={disabled} onCheckedChange={onChange} /></div>;
        case "select":
            return (
                <div className="space-y-1.5">
                    {label}
                    <Select value={str || "__none"} onValueChange={(v) => onChange(v === "__none" ? undefined : v)} disabled={disabled}>
                        <SelectTrigger id={id}><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none">Not set</SelectItem>
                            {field.options?.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {help}
                </div>
            );
        case "member":
            return <div className="space-y-1.5">{label}<MemberPicker id={id} value={str ? [str] : []} onChange={(ids) => onChange(ids[0])} disabled={disabled} />{help}</div>;
        case "members":
            return <div className="space-y-1.5">{label}<MemberPicker id={id} multiple value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} placeholder="Choose members" disabled={disabled} />{help}</div>;
        case "webhook":
            return (
                <div className="space-y-1.5">
                    {label}
                    <Select value={str || "__none"} onValueChange={(v) => onChange(v === "__none" ? "" : v)} disabled={disabled}>
                        <SelectTrigger id={id}><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none">Choose an endpoint</SelectItem>
                            {webhooks.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {!webhooks.length && <p className="text-xs text-muted-foreground">No outbound endpoints yet — add one under Webhooks.</p>}
                    {help}
                </div>
            );
        case "json":
            return <JsonInput id={id} label={label} help={help} value={value} onChange={onChange} placeholder={field.placeholder} disabled={disabled} />;
        case "approval_policy":
            return <div className="space-y-1.5">{label}<PolicySelect id={id} value={str} onChange={onChange} disabled={disabled} />{help}</div>;
        case "conditions":
            return <div className="space-y-1.5">{label}<ConditionsEditor value={(value as ConditionGroup) ?? { all: [] }} onChange={onChange} fields={triggerFields} disabled={disabled} /></div>;
        default:
            return <div className="space-y-1.5">{label}<Input id={id} value={str} placeholder={field.placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} />{help}</div>;
    }
}

/** Reusable approval policy (20 §4); "none" falls back to the single approver field. */
function PolicySelect({ id, value, onChange, disabled }: { id: string; value: string; onChange: (v: unknown) => void; disabled?: boolean }) {
    const policies = useApprovalPolicies({ limit: 200 });
    const rows = policies.data?.data ?? [];
    return (
        <>
            <Select value={value || "__none"} onValueChange={(v) => onChange(v === "__none" ? undefined : v)} disabled={disabled}>
                <SelectTrigger id={id}><SelectValue placeholder={policies.isPending ? "Loading…" : undefined} /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="__none">No policy — one approver</SelectItem>
                    {rows.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
            </Select>
            {policies.isError && <p className="text-xs text-danger">Policies could not be loaded.</p>}
            {!policies.isPending && !rows.length && <p className="text-xs text-muted-foreground">No approval policies yet — create one under Automation → Approval policies.</p>}
        </>
    );
}

/** JSON text area that only emits parsed objects (keeps the text while it is invalid). */
function JsonInput({ id, label, help, value, onChange, placeholder, disabled }: { id: string; label: React.ReactNode; help: React.ReactNode; value: unknown; onChange: (v: unknown) => void; placeholder?: string; disabled?: boolean }) {
    const [text, setText] = useState(() => (value === undefined || value === null ? "" : JSON.stringify(value, null, 2)));
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        // External resets (template load) replace the text.
        if (value !== undefined && value !== null) {
            try {
                if (JSON.stringify(JSON.parse(text || "null")) !== JSON.stringify(value)) setText(JSON.stringify(value, null, 2));
            } catch {
                /* keep the user's invalid draft */
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);
    return (
        <div className="space-y-1.5">
            {label}
            <Textarea
                id={id}
                rows={4}
                className="font-mono text-xs"
                value={text}
                placeholder={placeholder}
                disabled={disabled}
                onChange={(e) => {
                    setText(e.target.value);
                    if (!e.target.value.trim()) { setError(null); onChange(undefined); return; }
                    try {
                        onChange(JSON.parse(e.target.value));
                        setError(null);
                    } catch {
                        setError("Not valid JSON yet");
                    }
                }}
            />
            {error ? <p className="text-xs text-danger">{error}</p> : help}
        </div>
    );
}
