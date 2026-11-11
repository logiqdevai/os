import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Archive, Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState, ListSkeleton, PageSkeleton } from "@/components/ui/states";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { TicketPriorityFormOptions, TicketStatusCategoryOptions } from "@/config/constants/dropdowns/support/support.options";
import {
    useArchiveTicketCategory,
    useArchiveTicketStatus,
    useCreateTicketCategory,
    useCreateTicketStatus,
    useInboxes,
    useSlaPolicies,
    useSupportSettings,
    useTicketCategories,
    useTicketStatuses,
    useUpdateSupportSettings,
    useUpdateTicketStatus,
} from "@/features/support/hooks/use-support";
import type { SupportSettings, TicketStatusCategory, TicketStatusRow } from "@/features/support/interfaces/support.interfaces";
import { TicketStatusBadge } from "../../components/support-badges";

const NONE = "__none";
const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });

/**
 * Support settings — /support/settings?tab=general|csat|statuses|categories (mockup 13-support `settings`, `setup`).
 * @perm support.settings.manage
 */
export default function SupportSettingsPage() {
    const [sp, setSp] = useSearchParams();
    const tab = sp.get("tab") ?? "general";
    const settings = useSupportSettings();
    return (
        <Page width="narrow">
            <PageHeader title="Support settings" description="Ticket numbering, lifecycle, satisfaction surveys and ticket setup." />
            <Tabs value={tab} onValueChange={(v) => setSp({ tab: v }, { replace: true })}>
                <TabsList className="max-w-full overflow-x-auto">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="csat">Satisfaction</TabsTrigger>
                    <TabsTrigger value="statuses">Statuses</TabsTrigger>
                    <TabsTrigger value="categories">Categories</TabsTrigger>
                </TabsList>
                <TabsContent value="general" className="mt-4">{settings.isLoading ? <PageSkeleton /> : settings.error || !settings.data ? <ErrorState error={settings.error} onRetry={() => settings.refetch()} /> : <GeneralTab s={settings.data} />}</TabsContent>
                <TabsContent value="csat" className="mt-4">{settings.data ? <CsatTab s={settings.data} /> : <ListSkeleton />}</TabsContent>
                <TabsContent value="statuses" className="mt-4"><StatusesTab /></TabsContent>
                <TabsContent value="categories" className="mt-4"><CategoriesTab /></TabsContent>
            </Tabs>
        </Page>
    );
}

function Card({ children }: { children: ReactNode }) {
    return <div className="space-y-4 rounded-lg border border-border bg-card p-4 md:p-5">{children}</div>;
}

const num = (v: string) => (v.trim() === "" ? null : Number(v));

function GeneralTab({ s }: { s: SupportSettings }) {
    const update = useUpdateSupportSettings();
    const inboxes = useInboxes();
    const policies = useSlaPolicies();
    const [form, setForm] = useState({ prefix: s.ticket_prefix, inbox: s.default_inbox_id ?? NONE, sla: s.default_sla_policy_id ?? NONE, autoClose: String(s.auto_close_after_days ?? ""), reopen: String(s.reopen_window_days ?? ""), signature: s.default_signature ?? "" });
    useEffect(() => setForm({ prefix: s.ticket_prefix, inbox: s.default_inbox_id ?? NONE, sla: s.default_sla_policy_id ?? NONE, autoClose: String(s.auto_close_after_days ?? ""), reopen: String(s.reopen_window_days ?? ""), signature: s.default_signature ?? "" }), [s]);
    const save = () => {
        if (!/^[A-Z]{2,6}$/.test(form.prefix)) return toast({ variant: "destructive", title: "Ticket prefix must be 2–6 uppercase letters" });
        update.mutate(
            {
                ticket_prefix: form.prefix,
                ...(form.inbox !== NONE && { default_inbox_id: form.inbox }),
                ...(form.sla !== NONE && { default_sla_policy_id: form.sla }),
                auto_close_after_days: num(form.autoClose),
                reopen_window_days: num(form.reopen),
                default_signature: form.signature || null,
            },
            { onSuccess: () => toast({ title: "Settings saved" }), onError: fail("Could not save settings") },
        );
    };
    return (
        <Card>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="prefix">Ticket prefix</Label><Input id="prefix" value={form.prefix} maxLength={6} onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase() })} /><p className="text-xs text-muted-foreground">New tickets: {form.prefix || "SUP"}-1042</p></div>
                <div className="space-y-1.5"><Label>Default inbox</Label>
                    <Select value={form.inbox} onValueChange={(v) => setForm({ ...form, inbox: v })}><SelectTrigger aria-label="Default inbox"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>Not set</SelectItem>{inboxes.data?.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1.5"><Label>Default SLA policy</Label>
                    <Select value={form.sla} onValueChange={(v) => setForm({ ...form, sla: v })}><SelectTrigger aria-label="Default SLA policy"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>Not set</SelectItem>{policies.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1.5"><Label htmlFor="autoclose">Close resolved tickets after (days)</Label><Input id="autoclose" type="number" min={1} max={365} value={form.autoClose} onChange={(e) => setForm({ ...form, autoClose: e.target.value })} placeholder="Never" /></div>
                <div className="space-y-1.5"><Label htmlFor="reopen">Clients may reopen within (days)</Label><Input id="reopen" type="number" min={1} max={365} value={form.reopen} onChange={(e) => setForm({ ...form, reopen: e.target.value })} placeholder="Always" /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="signature">Default signature</Label><Textarea id="signature" rows={3} value={form.signature} onChange={(e) => setForm({ ...form, signature: e.target.value })} /></div>
            <div className="flex justify-end"><Button loading={update.isPending} onClick={save}>Save</Button></div>
        </Card>
    );
}

function CsatTab({ s }: { s: SupportSettings }) {
    const update = useUpdateSupportSettings();
    const [form, setForm] = useState({ enabled: s.csat_enabled, delay: String(s.csat_delay_minutes), scale: s.csat_scale, question: s.csat_question ?? "", thanks: s.csat_thank_you ?? "", threshold: String(s.csat_follow_up_threshold ?? "") });
    const save = () =>
        update.mutate(
            { csat_enabled: form.enabled, csat_delay_minutes: Number(form.delay || 0), csat_scale: form.scale, csat_question: form.question || null, csat_thank_you: form.thanks || null, csat_follow_up_threshold: num(form.threshold) },
            { onSuccess: () => toast({ title: "Survey settings saved" }), onError: fail("Could not save") },
        );
    return (
        <Card>
            <label className="flex items-center justify-between gap-3 text-[13px]"><span>Ask clients to rate resolved tickets and conversations</span><Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} aria-label="CSAT enabled" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Scale</Label>
                    <Select value={form.scale} onValueChange={(v) => setForm({ ...form, scale: v as SupportSettings["csat_scale"] })}><SelectTrigger aria-label="Scale"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="STARS_5">1–5 stars</SelectItem><SelectItem value="THUMBS">Thumbs up / down</SelectItem></SelectContent></Select></div>
                <div className="space-y-1.5"><Label htmlFor="delay">Send after (minutes)</Label><Input id="delay" type="number" min={0} value={form.delay} onChange={(e) => setForm({ ...form, delay: e.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="threshold">Follow up at or below</Label><Input id="threshold" type="number" min={1} max={5} value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} placeholder="Off" /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="question">Question</Label><Input id="question" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="How would you rate the support you received?" /></div>
            <div className="space-y-1.5"><Label htmlFor="thanks">Thank-you message</Label><Input id="thanks" value={form.thanks} onChange={(e) => setForm({ ...form, thanks: e.target.value })} placeholder="Thank you for your feedback." /></div>
            <div className="flex justify-end"><Button loading={update.isPending} onClick={save}>Save</Button></div>
        </Card>
    );
}

function StatusesTab() {
    const statuses = useTicketStatuses();
    const create = useCreateTicketStatus();
    const update = useUpdateTicketStatus();
    const archive = useArchiveTicketStatus();
    const [name, setName] = useState("");
    const [category, setCategory] = useState<TicketStatusCategory>("OPEN");
    const [archiving, setArchiving] = useState<TicketStatusRow | null>(null);
    const [replacement, setReplacement] = useState<string>(NONE);
    if (statuses.isLoading) return <ListSkeleton />;
    if (statuses.error) return <ErrorState error={statuses.error} onRetry={() => statuses.refetch()} />;
    return (
        <Card>
            <ul className="divide-y divide-border-soft">
                {statuses.data?.map((st) => (
                    <li key={st.id} className="flex flex-wrap items-center gap-2 py-2.5">
                        <TicketStatusBadge status={st} />
                        <span className="text-xs text-muted-foreground">{getDropdownOptionLabel(TicketStatusCategoryOptions, st.category)}{st.is_default ? " · default" : ""} · {st._count?.tickets ?? 0} tickets</span>
                        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">Pauses SLA <Switch checked={!!st.pauses_sla} onCheckedChange={(v) => update.mutate({ id: st.id, pauses_sla: v }, { onError: fail("Could not update status") })} aria-label={`${st.name} pauses SLA`} /></label>
                        {!st.is_default && <Button variant="ghost" size="icon-sm" aria-label={`Archive ${st.name}`} onClick={() => { setArchiving(st); setReplacement(NONE); }}><Archive /></Button>}
                    </li>
                ))}
            </ul>
            <div className="flex flex-col gap-2 border-t border-border-soft pt-4 sm:flex-row">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New status name" aria-label="New status name" />
                <Select value={category} onValueChange={(v) => setCategory(v as TicketStatusCategory)}><SelectTrigger className="sm:w-52" aria-label="Category"><SelectValue /></SelectTrigger><SelectContent>{TicketStatusCategoryOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                <Button loading={create.isPending} disabled={!name.trim()} onClick={() => create.mutate({ name: name.trim(), category }, { onSuccess: () => { toast({ title: "Status added" }); setName(""); }, onError: fail("Could not add status") })}><Plus /> Add</Button>
            </div>
            <Dialog open={!!archiving} onOpenChange={(o) => !o && !archive.isPending && setArchiving(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Archive "{archiving?.name}"?</DialogTitle>
                        <DialogDescription>{archiving?._count?.tickets ? `${archiving._count.tickets} tickets use this status. Move them to another status first.` : "No tickets use this status."}</DialogDescription>
                    </DialogHeader>
                    {!!archiving?._count?.tickets && (
                        <Select value={replacement} onValueChange={setReplacement}><SelectTrigger aria-label="Replacement status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>Pick a status</SelectItem>{statuses.data?.filter((x) => x.id !== archiving.id).map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent></Select>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setArchiving(null)} disabled={archive.isPending}>Cancel</Button>
                        <Button variant="destructive" loading={archive.isPending} disabled={!!archiving?._count?.tickets && replacement === NONE} onClick={() => archiving && archive.mutate({ id: archiving.id, replacement_status_id: replacement !== NONE ? replacement : undefined }, { onSuccess: () => { toast({ title: "Status archived" }); setArchiving(null); }, onError: fail("Could not archive") })}>Archive</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

function CategoriesTab() {
    const categories = useTicketCategories();
    const create = useCreateTicketCategory();
    const archive = useArchiveTicketCategory();
    const [name, setName] = useState("");
    const [priority, setPriority] = useState<string>(NONE);
    if (categories.isLoading) return <ListSkeleton />;
    if (categories.error) return <ErrorState error={categories.error} onRetry={() => categories.refetch()} />;
    return (
        <Card>
            {categories.data?.length ? (
                <ul className="divide-y divide-border-soft">
                    {categories.data.map((c) => (
                        <li key={c.id} className="flex items-center gap-2 py-2.5 text-[13px]">
                            <span className="font-medium text-foreground">{c.name}</span>
                            {c.default_priority && <Badge variant="neutral">{getDropdownOptionLabel(TicketPriorityFormOptions, c.default_priority)}</Badge>}
                            <span className="text-xs text-muted-foreground">{c._count?.tickets ?? 0} tickets</span>
                            <Button className="ml-auto" variant="ghost" size="icon-sm" aria-label={`Archive ${c.name}`} onClick={() => archive.mutate(c.id, { onSuccess: () => toast({ title: "Category archived" }), onError: fail("Could not archive") })}><Archive /></Button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-[13px] text-muted-foreground">No categories yet. Categories route tickets and power reports.</p>
            )}
            <div className="flex flex-col gap-2 border-t border-border-soft pt-4 sm:flex-row">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" aria-label="New category name" />
                <Select value={priority} onValueChange={setPriority}><SelectTrigger className="sm:w-44" aria-label="Default priority"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>No default priority</SelectItem>{TicketPriorityFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                <Button loading={create.isPending} disabled={!name.trim()} onClick={() => create.mutate({ name: name.trim(), ...(priority !== NONE && { default_priority: priority }) }, { onSuccess: () => { toast({ title: "Category added" }); setName(""); }, onError: fail("Could not add category") })}><Plus /> Add</Button>
            </div>
        </Card>
    );
}
