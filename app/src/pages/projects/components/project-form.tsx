import { useEffect } from "react";
import { CurrencySelect } from "@/components/ui/currency-select";
import { useFormAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "@/components/ui/save-status";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermission } from "@/hooks/use-permission";
import { useProjectTypes } from "@/features/projects/hooks/use-projects";
import { useWorkflows } from "@/features/tasks/hooks/use-tasks";
import { projectFormSchema, type ProjectFormValues } from "@/features/projects/validation-schemas/projects.schema";
import type { CreateProjectDto, MemberRef } from "@/features/projects/interfaces/projects.interfaces";
import { ProjectPriorityFormOptions, ProjectVisibilityFormOptions } from "@/config/constants/dropdowns/projects/project-form.options";
import { CustomerPicker, PersonPicker } from "./project-pickers";

const NONE = "__none";

interface ProjectFormProps {
    defaults?: Partial<ProjectFormValues>;
    /**
     * Edit mode (project Settings): every valid change saves automatically, no Save / Cancel buttons; a quiet
     * "Saving… / Saved" status shows above the fields. `resetKey` (the project id) reloads the form only when it changes,
     * so refreshed data never overwrites what the user is typing.
     */
    autosave?: { onSave: (dto: CreateProjectDto) => Promise<unknown>; resetKey: string };
    /** Current customer name / owner so the pickers render before their lists load. */
    customerName?: string | null;
    owner?: MemberRef | null;
    pending?: boolean;
    submitLabel?: string;
    onSubmit?: (dto: CreateProjectDto) => void;
    onCancel?: () => void;
    /** Template id chosen outside the form (new project page). */
    templateId?: string | null;
}

const empty: ProjectFormValues = {
    name: "", code: "", description: "", type_id: NONE, company_id: "", owner_membership_id: "", team_id: NONE, priority: "MEDIUM", visibility: "INTERNAL",
    planned_start: "", target_completion: "", budget_hours: "", budget_amount: "", currency: "EUR",
};

/** Project fields shared by "New project" and the project Settings tab. Budget fields need projects.projects.manage_budgets. */
export function ProjectForm({ defaults, autosave, customerName, owner, pending, submitLabel = "Save", onSubmit, onCancel, templateId }: ProjectFormProps) {
    const canBudget = usePermission("projects.projects.manage_budgets");
    const canSeeMoney = usePermission("projects.finance.read");
    const canTeams = usePermission("tasks.tasks.read");
    const types = useProjectTypes();
    const workflows = useWorkflows(canTeams);
    const form = useForm<ProjectFormValues>({ resolver: zodResolver(projectFormSchema), defaultValues: { ...empty, ...defaults } });

    useEffect(() => {
        form.reset({ ...empty, ...defaults });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autosave ? autosave.resetKey : JSON.stringify(defaults)]);

    const toDto = (v: ProjectFormValues): CreateProjectDto => {
        const num = (s?: string) => (s ? Number(s) : undefined);
        const dto: CreateProjectDto = {
            name: v.name,
            code: v.code || undefined,
            description: v.description || undefined,
            type_id: v.type_id && v.type_id !== NONE ? v.type_id : undefined,
            company_id: v.company_id || undefined,
            owner_membership_id: v.owner_membership_id || undefined,
            team_id: v.team_id && v.team_id !== NONE ? v.team_id : undefined,
            priority: v.priority,
            visibility: v.visibility,
            planned_start: v.planned_start || undefined,
            target_completion: v.target_completion || undefined,
            template_id: templateId || undefined,
        };
        if (canBudget) {
            dto.budget_hours = num(v.budget_hours);
            if (canSeeMoney) {
                dto.budget_amount = num(v.budget_amount);
                dto.currency = v.currency ? v.currency.toUpperCase() : undefined;
            }
        }
        return dto;
    };
    const submit = form.handleSubmit((v) => onSubmit?.(toDto(v)));
    const saveState = useFormAutosave(form, (v) => autosave!.onSave(toDto(v)), { enabled: !!autosave });

    const teams = (workflows.data ?? []).filter((w) => w.team).map((w) => w.team!);

    return (
        <Form {...form}>
            <form onSubmit={autosave ? (e) => e.preventDefault() : submit} className="space-y-5">
                {autosave && <div className="flex min-h-4 justify-end"><SaveStatus state={saveState} /></div>}
                <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
                    <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Project name</FormLabel>
                            <FormControl><Input autoFocus={!autosave} placeholder="Acme website relaunch" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="code" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Code</FormLabel>
                            <FormControl><Input placeholder="ACME-WEB" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField control={form.control} name="company_id" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Customer</FormLabel>
                            <CustomerPicker value={field.value || null} onChange={(v) => field.onChange(v ?? "")} currentName={customerName} />
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="owner_membership_id" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Project manager</FormLabel>
                            <PersonPicker value={field.value || null} onChange={(v) => field.onChange(v ?? "")} placeholder="You (default)" selected={owner} />
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="type_id" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value={NONE}>No type</SelectItem>
                                    {types.data?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                    {canTeams && (
                        <FormField control={form.control} name="team_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Delivery team</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl><SelectTrigger aria-label="Delivery team"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value={NONE}>No team</SelectItem>
                                        {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{t.task_key ? ` (${t.task_key})` : ""}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormDescription>Tasks get this team's key and workflow.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                    )}
                    <FormField control={form.control} name="priority" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl><SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>{ProjectPriorityFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="visibility" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Visibility</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl><SelectTrigger aria-label="Visibility"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>{ProjectVisibilityFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="planned_start" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Planned start</FormLabel>
                            <FormControl><Input type="date" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="target_completion" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Target completion</FormLabel>
                            <FormControl><Input type="date" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>

                {canBudget && (
                    <div className="grid gap-4 sm:grid-cols-3">
                        <FormField control={form.control} name="budget_hours" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Budget (hours)</FormLabel>
                                <FormControl><Input inputMode="decimal" placeholder="240" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        {canSeeMoney && (
                            <>
                                <FormField control={form.control} name="budget_amount" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Budget (amount)</FormLabel>
                                        <FormControl><Input inputMode="decimal" placeholder="24000" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="currency" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Currency</FormLabel>
                                        <FormControl><CurrencySelect value={field.value} onChange={field.onChange} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </>
                        )}
                    </div>
                )}

                <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl><Textarea rows={4} placeholder="Goals, scope and anything the team should know." {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                {!autosave && (
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        {onCancel && <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>}
                        <Button type="submit" loading={pending}>{submitLabel}</Button>
                    </div>
                )}
            </form>
        </Form>
    );
}
