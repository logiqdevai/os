import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Page, PageHeader } from "@/components/ui/page";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCandidates, useCreateEmployee, useEmployees } from "@/features/people/employees/hooks/use-employees";
import { employeeFormSchema, type EmployeeFormValues } from "@/features/people/employees/validation-schemas/employees.schema";
import type { CreateEmployeeDto, SeniorityLevel } from "@/features/people/employees/interfaces/employees.interfaces";
import {
    EmploymentStatusFormOptions, EmploymentTypeFormOptions, SeniorityFormOptions, WorkLocationFormOptions,
} from "@/config/constants/dropdowns/people/employee-form.options";
import { useSessionData } from "@/features/session/hooks/use-session";
import { personName } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { Panel } from "../../components/person";
import { PeoplePaths } from "../../paths";

const NONE = "__none";

/**
 * /people/new — create an HR record for an existing member or a new hire (pending member, invite from Admin).
 * @perm employees.employees.create · @api POST /people/employees · GET /people/employees/candidates
 */
export default function NewEmployeePage() {
    const navigate = useNavigate();
    const session = useSessionData();
    const [memberSearch] = useState("");
    const candidates = useCandidates(memberSearch);
    const managers = useEmployees({ limit: 200, status: "ACTIVE,ONBOARDING,ON_LEAVE", order_by: "employee_number", order_direction: "asc" });
    const create = useCreateEmployee();
    const form = useForm<EmployeeFormValues>({
        resolver: zodResolver(employeeFormSchema),
        defaultValues: {
            source: "member", membership_id: "", email: "", first_name: "", last_name: "", job_title: "", seniority_level: NONE, employment_type: "FULL_TIME",
            employment_status: "ONBOARDING", work_location: "OFFICE", hire_date: new Date().toISOString().slice(0, 10), probation_end_date: "", manager_employee_id: NONE,
            primary_branch_id: session?.active_organization?.default_branch_id ?? NONE, work_email: "", work_phone: "", weekly_capacity_hours: "40",
        },
    });
    const source = form.watch("source");

    const submit = form.handleSubmit((v) => {
        const opt = (s?: string) => (s && s !== NONE ? s : undefined);
        const dto: CreateEmployeeDto = {
            ...(v.source === "member" ? { membership_id: v.membership_id } : { new_hire: { email: v.email!, first_name: v.first_name!, last_name: v.last_name! } }),
            job_title: v.job_title, seniority_level: opt(v.seniority_level) as SeniorityLevel | undefined, employment_type: v.employment_type, employment_status: v.employment_status,
            work_location: v.work_location, hire_date: opt(v.hire_date), probation_end_date: opt(v.probation_end_date), manager_employee_id: opt(v.manager_employee_id),
            primary_branch_id: opt(v.primary_branch_id), work_email: opt(v.work_email), work_phone: opt(v.work_phone),
            weekly_capacity_hours: v.weekly_capacity_hours ? Number(v.weekly_capacity_hours) : undefined,
        };
        create.mutate(dto, {
            onSuccess: (e) => { toast({ title: "Employee created", description: `${e.name} · ${e.employee_number}` }); navigate(PeoplePaths.employee(e.id)); },
            onError: (e) => toast({ variant: "destructive", title: "Could not create employee", description: getApiErrorMessage(e) }),
        });
    });

    const select = (name: keyof EmployeeFormValues, label: string, options: { id: string; label: string }[], allowNone?: string) => (
        <FormField control={form.control} name={name} render={({ field }) => (
            <FormItem>
                <FormLabel>{label}</FormLabel>
                <Select value={(field.value as string) ?? ""} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger aria-label={label}><SelectValue placeholder="Select…" /></SelectTrigger></FormControl>
                    <SelectContent>
                        {allowNone && <SelectItem value={NONE}>{allowNone}</SelectItem>}
                        {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                    </SelectContent>
                </Select>
                <FormMessage />
            </FormItem>
        )} />
    );
    const text = (name: keyof EmployeeFormValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
        <FormField control={form.control} name={name} render={({ field }) => (
            <FormItem>
                <FormLabel>{label}</FormLabel>
                <FormControl><Input {...props} {...field} value={(field.value as string) ?? ""} /></FormControl>
                <FormMessage />
            </FormItem>
        )} />
    );

    return (
        <Page width="narrow">
            <PageHeader title="Add employee" description="Create the HR record. The employee number is allocated automatically." back={{ to: PeoplePaths.root, label: "Employees" }} />
            <Form {...form}>
                <form onSubmit={submit} className="space-y-4">
                    <Panel title="Person">
                        <Tabs value={source} onValueChange={(v) => form.setValue("source", v as "member" | "new")} className="mb-4">
                            <TabsList>
                                <TabsTrigger value="member">Existing member</TabsTrigger>
                                <TabsTrigger value="new">New hire</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        {source === "member" ? (
                            <FormField control={form.control} name="membership_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Member</FormLabel>
                                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Member"><SelectValue placeholder={candidates.isLoading ? "Loading…" : candidates.data?.length ? "Pick a member without an HR record" : "Every member already has a record"} /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {candidates.data?.map((m) => <SelectItem key={m.id} value={m.id}>{personName(m.user)} · {m.user.email}{m.status === "INVITED" ? " (invited)" : ""}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2">
                                {text("first_name", "First name")}
                                {text("last_name", "Last name")}
                                <div className="sm:col-span-2">{text("email", "Email", { type: "email", placeholder: "name@company.com" })}</div>
                                <p className="text-xs text-muted-foreground sm:col-span-2">A pending member is created. Send the invitation from Admin → Members when they should get access.</p>
                            </div>
                        )}
                    </Panel>
                    <Panel title="Job">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">{text("job_title", "Job title", { placeholder: "Senior Developer" })}</div>
                            {select("seniority_level", "Seniority", SeniorityFormOptions, "Not set")}
                            {select("employment_type", "Employment type", EmploymentTypeFormOptions)}
                            {select("employment_status", "Status", EmploymentStatusFormOptions)}
                            {select("work_location", "Work location", WorkLocationFormOptions)}
                            {select("manager_employee_id", "Manager", (managers.data?.data ?? []).map((m) => ({ id: m.id, label: `${m.name}${m.job_title ? ` · ${m.job_title}` : ""}` })), "No manager")}
                            {select("primary_branch_id", "Branch", (session?.branches ?? []).map((b) => ({ id: b.id, label: b.name })), "No branch")}
                            {text("hire_date", "Hire date", { type: "date" })}
                            {text("probation_end_date", "Probation ends", { type: "date" })}
                        </div>
                    </Panel>
                    <Panel title="Work contact & capacity">
                        <div className="grid gap-4 sm:grid-cols-2">
                            {text("work_email", "Work email", { type: "email" })}
                            {text("work_phone", "Work phone")}
                            {text("weekly_capacity_hours", "Weekly hours", { type: "number", min: 0, max: 80, step: 0.5 })}
                        </div>
                    </Panel>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="ghost" onClick={() => navigate(PeoplePaths.root)} disabled={create.isPending}>Cancel</Button>
                        <Button type="submit" loading={create.isPending}>Create employee</Button>
                    </div>
                </form>
            </Form>
        </Page>
    );
}
