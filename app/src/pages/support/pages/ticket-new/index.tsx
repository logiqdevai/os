import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MessagesSquare } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityPicker } from "@/components/ui/entity-picker";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { personName } from "@/lib/format";
import { TicketPriorityFormOptions, TicketTypeFormOptions } from "@/config/constants/dropdowns/support/support.options";
import { useAgents, useCreateTicket, useInboxes, useTicketCategories } from "@/features/support/hooks/use-support";
import { ticketFormSchema, type TicketFormValues } from "@/features/support/validation-schemas/support.schema";
import { useCompanyLookup } from "@/features/crm/companies/hooks/use-companies";
import { useProjectLookup } from "@/features/projects/hooks/use-projects";
import { SUPPORT_PATHS } from "../../support-paths";

const NONE = "__none";

/**
 * New ticket — /support/tickets/new?conversation=<id> (mockup 13-support `ticket-create`).
 * @perm support.tickets.create · assign others support.tickets.assign
 */
export default function NewTicketPage() {
    const [sp] = useSearchParams();
    const conversationId = sp.get("conversation") ?? undefined;
    const navigate = useNavigate();
    const create = useCreateTicket();
    const canAssign = usePermission("support.tickets.assign");
    const inboxes = useInboxes();
    const categories = useTicketCategories();
    const agents = useAgents();
    const [companySearch, setCompanySearch] = useState("");
    const [projectSearch, setProjectSearch] = useState("");
    const companies = useCompanyLookup(companySearch, !conversationId);
    const form = useForm<TicketFormValues>({
        resolver: zodResolver(ticketFormSchema),
        defaultValues: { subject: "", description: "", type: "QUESTION", priority: "NORMAL", category_id: NONE, inbox_id: NONE, assignee_membership_id: null, company_id: null, project_id: null, requester_email: "", requester_name: "" },
    });
    const companyId = form.watch("company_id");
    const projects = useProjectLookup({ search: projectSearch || undefined, limit: 20, ...(companyId ? { company_id: companyId } : {}) });

    const submit = form.handleSubmit((v) => {
        create.mutate(
            {
                subject: v.subject,
                description: v.description || undefined,
                type: v.type,
                priority: v.priority,
                category_id: v.category_id && v.category_id !== NONE ? v.category_id : undefined,
                inbox_id: v.inbox_id && v.inbox_id !== NONE ? v.inbox_id : undefined,
                assignee_membership_id: v.assignee_membership_id ?? undefined,
                company_id: v.company_id ?? undefined,
                project_id: v.project_id ?? undefined,
                requester_email: v.requester_email || undefined,
                requester_name: v.requester_name || undefined,
                conversation_id: conversationId,
            },
            {
                onSuccess: (t) => {
                    toast({ title: `Ticket ${t.reference} created` });
                    navigate(SUPPORT_PATHS.ticket(t.reference));
                },
                onError: (e) => toast({ variant: "destructive", title: "Could not create ticket", description: getApiErrorMessage(e) }),
            },
        );
    });

    return (
        <Page width="narrow">
            <PageHeader back={{ to: SUPPORT_PATHS.tickets, label: "Tickets" }} title="New ticket" description="SLA timers start as soon as the ticket is created." />
            {conversationId && (
                <div className="mb-4 flex items-center gap-2 rounded-md border border-info/30 bg-info-soft px-3 py-2 text-[13px] text-foreground">
                    <MessagesSquare className="size-4 text-info" /> The ticket is linked to the conversation; requester and customer come from it.
                </div>
            )}
            <Form {...form}>
                <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-4 md:p-5">
                    <FormField control={form.control} name="subject" render={({ field }) => (
                        <FormItem><FormLabel>Subject</FormLabel><FormControl><Input autoFocus placeholder="Checkout page returns an error" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="description" render={({ field }) => (
                        <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={6} placeholder="What happened, steps to reproduce, impact…" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField control={form.control} name="type" render={({ field }) => (
                            <FormItem><FormLabel>Type</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>{TicketTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                                <FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="priority" render={({ field }) => (
                            <FormItem><FormLabel>Priority</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>{TicketPriorityFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                                <FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="category_id" render={({ field }) => (
                            <FormItem><FormLabel>Category</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent><SelectItem value={NONE}>No category</SelectItem>{categories.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
                                <FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="inbox_id" render={({ field }) => (
                            <FormItem><FormLabel>Inbox</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Inbox"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent><SelectItem value={NONE}>Default inbox</SelectItem>{inboxes.data?.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select>
                                <FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="assignee_membership_id" render={({ field }) => (
                            <FormItem><FormLabel>Assignee</FormLabel>
                                <EntityPicker items={(agents.data ?? []).map((a) => ({ id: a.id, label: personName(a.user), keywords: a.user.email ?? "" }))} value={field.value ?? null} onChange={field.onChange} noneLabel="Unassigned" placeholder="Unassigned" disabled={!canAssign} ariaLabel="Assignee" />
                                <FormMessage /></FormItem>
                        )} />
                        {!conversationId && (
                            <FormField control={form.control} name="company_id" render={({ field }) => (
                                <FormItem><FormLabel>Customer</FormLabel>
                                    <EntityPicker items={(companies.data ?? []).map((c) => ({ id: c.id, label: c.name }))} value={field.value ?? null} onChange={(v) => { field.onChange(v); form.setValue("project_id", null); }} onSearch={setCompanySearch} loading={companies.isFetching} noneLabel="No customer" placeholder="No customer" ariaLabel="Customer" />
                                    <FormMessage /></FormItem>
                            )} />
                        )}
                        <FormField control={form.control} name="project_id" render={({ field }) => (
                            <FormItem><FormLabel>Project</FormLabel>
                                <EntityPicker items={(projects.data ?? []).map((p) => ({ id: p.id, label: p.name, hint: p.code ?? undefined }))} value={field.value ?? null} onChange={field.onChange} onSearch={setProjectSearch} loading={projects.isFetching} noneLabel="No project" placeholder="No project" ariaLabel="Project" />
                                <FormMessage /></FormItem>
                        )} />
                    </div>
                    {!conversationId && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="requester_name" render={({ field }) => (
                                <FormItem><FormLabel>Requester name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="requester_email" render={({ field }) => (
                                <FormItem><FormLabel>Requester email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={create.isPending}>Cancel</Button>
                        <Button type="submit" loading={create.isPending}>Create ticket</Button>
                    </div>
                </form>
            </Form>
        </Page>
    );
}
