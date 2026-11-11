import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Page, PageHeader } from "@/components/ui/page";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useCreateProposal, useProposalTemplates } from "@/features/proposals/hooks/use-proposals";
import { proposalFormSchema, type ProposalFormValues } from "@/features/proposals/validation-schemas/proposals.schema";
import { CurrencyOptions, LanguageOptions } from "@/config/constants/dropdowns/proposals/proposal-content.options";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { LookupPicker } from "../../components/lookup-picker";

const NONE = "__none";

/**
 * /proposals/new?deal=<id>&company=<id> — create a draft; the number is allocated by the API, totals are server-side.
 * @perm proposals.proposals.create · other owner needs proposals.proposals.update
 * @api POST /proposals · GET /proposal-templates · GET /proposals/lookups
 */
export default function NewProposalPage() {
    const navigate = useNavigate();
    const [sp] = useSearchParams();
    const session = useSessionData();
    const canAssign = usePermission("proposals.proposals.update");
    const templates = useProposalTemplates({ limit: 100 });
    const create = useCreateProposal();
    const form = useForm<ProposalFormValues>({
        resolver: zodResolver(proposalFormSchema),
        defaultValues: {
            title: "",
            company_id: sp.get("company"),
            contact_id: null,
            deal_id: sp.get("deal"),
            project_id: sp.get("project"),
            owner_membership_id: session?.active_organization?.membership_id ?? null,
            branch_id: NONE,
            template_id: NONE,
            currency: session?.active_organization?.default_currency ?? "EUR",
            language: "en",
            requires_contract: false,
        },
    });
    const companyId = form.watch("company_id");

    // Preselect the organization default template.
    useEffect(() => {
        const def = templates.data?.data.find((t) => t.is_default);
        if (def && form.getValues("template_id") === NONE) form.setValue("template_id", def.id);
    }, [templates.data, form]);

    const submit = form.handleSubmit((v) =>
        create.mutate(
            {
                title: v.title,
                company_id: v.company_id ?? null,
                contact_id: v.contact_id ?? null,
                deal_id: v.deal_id ?? null,
                project_id: v.project_id ?? null,
                owner_membership_id: v.owner_membership_id ?? null,
                branch_id: v.branch_id && v.branch_id !== NONE ? v.branch_id : null,
                template_id: v.template_id && v.template_id !== NONE ? v.template_id : null,
                currency: v.currency,
                language: v.language,
                requires_contract: v.requires_contract,
            },
            {
                onSuccess: (p) => {
                    toast({ title: `Proposal ${p.number} created` });
                    navigate(`/proposals/${p.id}`);
                },
                onError: (e) => toast({ variant: "destructive", title: "Could not create the proposal", description: getApiErrorMessage(e) }),
            }
        )
    );

    return (
        <Page width="narrow">
            <PageHeader back={{ to: "/proposals", label: "Proposals" }} title="New proposal" description="Create a draft. The number is assigned when you save; you add content and pricing in the editor." />
            <Form {...form}>
                <form onSubmit={submit} className="space-y-5 rounded-lg border border-border bg-card p-4 md:p-5">
                    <FormField control={form.control} name="title" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl><Input autoFocus placeholder="Website redesign and care plan" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField control={form.control} name="company_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Customer</FormLabel>
                                <LookupPicker kind="companies" ariaLabel="Customer" value={field.value} placeholder="Choose a company" onChange={(id, o) => {
                                    field.onChange(id);
                                    form.setValue("contact_id", null);
                                    if (o?.currency) form.setValue("currency", o.currency);
                                }} />
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="contact_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Primary contact</FormLabel>
                                <LookupPicker kind="contacts" ariaLabel="Primary contact" value={field.value} companyId={companyId} placeholder="Who receives it" onChange={(id) => field.onChange(id)} />
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="deal_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Deal</FormLabel>
                                <LookupPicker kind="deals" ariaLabel="Deal" value={field.value} companyId={companyId} placeholder="Optional" onChange={(id, o) => {
                                    field.onChange(id);
                                    if (o?.company_id && !form.getValues("company_id")) form.setValue("company_id", o.company_id);
                                    if (o?.currency) form.setValue("currency", o.currency);
                                    if (o?.name && !form.getValues("title")) form.setValue("title", o.name);
                                }} />
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="project_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Linked project</FormLabel>
                                <LookupPicker kind="projects" ariaLabel="Linked project" value={field.value} companyId={companyId} placeholder="None (new work)" onChange={(id) => field.onChange(id)} />
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="owner_membership_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Owner</FormLabel>
                                <LookupPicker kind="members" ariaLabel="Owner" value={field.value} clearable={false} disabled={!canAssign} valueLabel={field.value === session?.active_organization?.membership_id ? "You" : undefined} onChange={(id) => field.onChange(id)} />
                                {!canAssign && <FormDescription>Assigning another owner needs edit rights.</FormDescription>}
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="branch_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Branch</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl><SelectTrigger aria-label="Branch"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value={NONE}>Whole organization</SelectItem>
                                        {session?.branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <FormField control={form.control} name="template_id" render={({ field }) => (
                            <FormItem className="sm:col-span-3">
                                <FormLabel>Template</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl><SelectTrigger aria-label="Template"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value={NONE}>Standard sections</SelectItem>
                                        {templates.data?.data.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{t.is_default ? " · default" : ""}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormDescription>Copies the template sections, payment terms and validity. Later template edits never change this proposal.</FormDescription>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="currency" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Currency</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl><SelectTrigger aria-label="Currency"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>{CurrencyOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="language" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Language</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl><SelectTrigger aria-label="Language"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>{LanguageOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="requires_contract" render={({ field }) => (
                            <FormItem className="flex flex-col justify-end">
                                <div className="flex h-9 items-center justify-between gap-2 rounded-md border border-border px-3">
                                    <FormLabel className="m-0 text-[13px] font-normal">Needs a contract</FormLabel>
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                </div>
                            </FormItem>
                        )} />
                    </div>
                    <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                        <Button type="button" variant="ghost" onClick={() => navigate("/proposals")} disabled={create.isPending}>Cancel</Button>
                        <Button type="submit" loading={create.isPending}>Create and open editor</Button>
                    </div>
                </form>
            </Form>
        </Page>
    );
}
