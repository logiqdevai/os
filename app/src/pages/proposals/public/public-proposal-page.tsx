import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Clock, FileX2, MailCheck, MessageSquare, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-error";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { renderMarkdown, markdownClass } from "@/lib/markdown";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { cn } from "@/lib/utils";
import { BillingFrequencyFormOptions, ProposalPaymentTriggerFormOptions } from "@/config/constants/dropdowns/proposals/proposal-content.options";
import {
    useCommentPublicProposal, useDecidePublicProposal, usePublicProposal, useQuotePublicSelection, useSendPublicCode, useVerifyPublicCode,
} from "@/features/proposals/hooks/use-proposals";
import { publicDecisionSchema, type PublicDecisionFormValues } from "@/features/proposals/validation-schemas/proposals.schema";
import type { ProposalCustomerDecision, PublicProposal, PublicTotals } from "@/features/proposals/interfaces/proposals.interfaces";

const ACCESS_KEY = (token: string) => `lq-proposal-access:${token.slice(0, 16)}`;
const readAccess = (token: string) => {
    try { return sessionStorage.getItem(ACCESS_KEY(token)); } catch { return null; }
};

/**
 * /p/:token — customer view of a SENT proposal (no login). Token = read access to the sent version only.
 * @api GET /public/proposals/:token · POST …/selection · …/decision · …/comments · …/send-code · …/verify
 * @states loading · invalid link · cancelled · expired (read only) · verification required · decided · active
 */
export default function PublicProposalPage() {
    const { token = "" } = useParams();
    const [access, setAccess] = useState<string | null>(() => readAccess(token));
    const q = usePublicProposal(token, access);
    usePageMetadata({ title: q.data ? `${q.data.proposal.title} · ${q.data.organization.name}` : "Proposal" });

    useEffect(() => {
        const meta = document.createElement("meta");
        meta.name = "robots";
        meta.content = "noindex, nofollow";
        document.head.appendChild(meta);
        return () => { document.head.removeChild(meta); };
    }, []);

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="border-b border-border bg-card">
                <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
                    {q.data?.organization.logo_url ? (
                        <img src={q.data.organization.logo_url} alt="" className="size-8 rounded-md object-contain" />
                    ) : (
                        <span className="grid size-8 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">{(q.data?.organization.name ?? "·").slice(0, 2).toUpperCase()}</span>
                    )}
                    <span className="truncate text-sm font-medium">{q.data?.organization.name ?? ""}</span>
                    {q.data && <span className="ml-auto font-mono text-xs text-muted-foreground">{q.data.proposal.number}</span>}
                </div>
            </header>
            <main className="mx-auto max-w-5xl px-4 py-6 md:py-8">
                {q.isPending ? (
                    <div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40" /><Skeleton className="h-64" /></div>
                ) : q.error ? (
                    <Notice icon={FileX2} title={getApiErrorStatus(q.error) === 404 ? "This link is not valid" : "We couldn't load this proposal"} text={getApiErrorStatus(q.error) === 404 ? "Ask the sender for a new link." : getApiErrorMessage(q.error)} />
                ) : q.data.state === "CANCELLED" ? (
                    <Notice icon={XCircle} title="This proposal was withdrawn" text={`${q.data.organization.name} cancelled “${q.data.proposal.title}”. Contact them if you have questions.`} />
                ) : q.data.state === "VERIFICATION_REQUIRED" ? (
                    <VerifyStep token={token} data={q.data} onVerified={(a) => { try { sessionStorage.setItem(ACCESS_KEY(token), a); } catch { /* private mode */ } setAccess(a); }} />
                ) : (
                    <ProposalBody token={token} access={access} data={q.data} />
                )}
            </main>
            <footer className="px-4 pb-8 text-center text-xs text-muted-foreground">Powered by Logiqdev OS · this page is private to its recipients</footer>
        </div>
    );
}

function Notice({ icon: Icon, title, text }: { icon: typeof FileX2; title: string; text: string }) {
    return (
        <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 text-center">
            <Icon className="mx-auto mb-3 size-8 text-muted-foreground" />
            <h1 className="text-lg font-medium">{title}</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">{text}</p>
        </div>
    );
}

function VerifyStep({ token, data, onVerified }: { token: string; data: PublicProposal; onVerified: (access: string) => void }) {
    const send = useSendPublicCode();
    const verify = useVerifyPublicCode();
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [sent, setSent] = useState(false);
    return (
        <div className="mx-auto max-w-md space-y-4 rounded-lg border border-border bg-card p-5">
            <MailCheck className="size-7 text-info" />
            <div>
                <h1 className="text-lg font-medium">Confirm it's you</h1>
                <p className="mt-1 text-[13px] text-muted-foreground">“{data.proposal.title}” is shared with specific people. Enter your email{data.hint ? ` (${data.hint})` : ""} and we'll send you a code.</p>
            </div>
            {!sent ? (
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); send.mutate({ token, email }, { onSuccess: (r) => { setSent(true); if (r.dev_code) toast({ title: "Development code", description: r.dev_code }); }, onError: (e2) => toast({ variant: "destructive", title: "Could not send the code", description: getApiErrorMessage(e2) }) }); }}>
                    <div className="space-y-1.5"><Label htmlFor="v-email">Email</Label><Input id="v-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                    <Button type="submit" className="w-full" loading={send.isPending}>Send code</Button>
                </form>
            ) : (
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); verify.mutate({ token, code }, { onSuccess: (r) => onVerified(r.access), onError: (e2) => toast({ variant: "destructive", title: "Code not accepted", description: getApiErrorMessage(e2) }) }); }}>
                    <p className="text-[13px] text-muted-foreground">If {email} is a recipient, a 6-digit code is on its way. It expires in 10 minutes.</p>
                    <div className="space-y-1.5"><Label htmlFor="v-code">Code</Label><Input id="v-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required /></div>
                    <Button type="submit" className="w-full" loading={verify.isPending} disabled={code.length < 6}>Open proposal</Button>
                    <Button type="button" variant="ghost" className="w-full" onClick={() => { setSent(false); setCode(""); }}>Use another email</Button>
                </form>
            )}
        </div>
    );
}

function ProposalBody({ token, access, data }: { token: string; access: string | null; data: PublicProposal }) {
    const v = data.version!;
    const c = data.proposal.currency;
    const active = data.state === "ACTIVE";
    const quote = useQuotePublicSelection();
    const initialSelected = data.decision?.selected_optional_item_ids ?? v.line_items.filter((l) => l.is_optional && l.selected_by_customer).map((l) => l.id);
    const [selected, setSelected] = useState<string[]>(initialSelected);
    const [totals, setTotals] = useState<PublicTotals>(v.totals);
    useEffect(() => setTotals(v.totals), [v.totals]);

    const toggle = (id: string, on: boolean) => {
        const next = on ? [...selected, id] : selected.filter((x) => x !== id);
        setSelected(next);
        quote.mutate({ token, access, ids: next }, { onSuccess: (r) => setTotals(r.totals), onError: (e) => toast({ variant: "destructive", title: "Could not update the total", description: getApiErrorMessage(e) }) });
    };

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <h1 className="text-2xl font-medium tracking-tight">{data.proposal.title}</h1>
                <p className="text-[13px] text-muted-foreground">
                    {[data.recipient?.contact && `Prepared for ${data.recipient.contact}`, data.recipient?.company, data.proposal.valid_until && `valid until ${formatDate(data.proposal.valid_until)}`].filter(Boolean).join(" · ")}
                </p>
            </div>
            {data.state === "EXPIRED" && <div className="flex items-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning"><Clock className="size-4" /> This proposal expired. You can still read it; ask {data.organization.name} for an updated one.</div>}
            {data.decision && data.state === "DECIDED" && (
                <div className={cn("flex items-start gap-2 rounded-md px-3 py-2 text-[13px]", data.decision.decision === "ACCEPTED" ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
                    {data.decision.decision === "ACCEPTED" ? <CheckCircle2 className="mt-0.5 size-4" /> : <XCircle className="mt-0.5 size-4" />}
                    <span>{data.decision.decision === "ACCEPTED" ? "Accepted" : "Declined"} by {data.decision.signer_name} on {formatDateTime(data.decision.created_at)}.</span>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0 space-y-6">
                    {v.sections.map((s) => (
                        <section key={s.id} className="rounded-lg border border-border bg-card p-4 md:p-5">
                            <h2 className="mb-2 text-base font-medium">{s.title}</h2>
                            {s.body?.trim() ? <div className={markdownClass} dangerouslySetInnerHTML={{ __html: renderMarkdown(s.body) }} /> : null}
                        </section>
                    ))}

                    {v.line_items.length > 0 && (
                        <section className="rounded-lg border border-border bg-card">
                            <h2 className="border-b border-border px-4 py-3 text-base font-medium">Investment</h2>
                            <ul className="divide-y divide-border">
                                {v.line_items.map((l) => (
                                    <li key={l.id} className={cn("flex items-start gap-3 px-4 py-3", l.is_optional && "bg-secondary/50")}>
                                        {l.is_optional && (
                                            <Checkbox className="mt-0.5" aria-label={`Include ${l.name}`} checked={selected.includes(l.id)} disabled={!active || quote.isPending} onCheckedChange={(on) => toggle(l.id, on === true)} />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[13.5px] text-foreground">{l.is_optional && <Badge variant="outline" className="mr-1.5">Optional</Badge>}{l.name}</div>
                                            {l.description && <div className="text-xs text-muted-foreground">{l.description}</div>}
                                            <div className="text-xs text-muted-foreground">
                                                {Number(l.quantity)} {l.unit ?? "×"} · {formatMoney(l.unit_price, c)}
                                                {Number(l.discount_amount) > 0 ? ` · discount ${formatMoney(l.discount_amount, c)}` : ""}
                                                {l.is_recurring ? ` · billed ${getDropdownOptionLabel(BillingFrequencyFormOptions, l.billing_frequency ?? "monthly").toLowerCase()}` : ""}
                                            </div>
                                        </div>
                                        <span className="tabular text-[13.5px]">{formatMoney(l.net_amount, c)}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {(v.payment_schedule.length > 0 || v.payment_terms) && (
                        <section className="rounded-lg border border-border bg-card p-4">
                            <h2 className="mb-2 text-base font-medium">Payment</h2>
                            {v.payment_schedule.length > 0 && (
                                <ul className="mb-2 divide-y divide-border">
                                    {v.payment_schedule.map((s, i) => (
                                        <li key={i} className="flex flex-wrap justify-between gap-2 py-2 text-[13px]">
                                            <span>{s.name} <span className="text-muted-foreground">· {getDropdownOptionLabel(ProposalPaymentTriggerFormOptions, s.trigger).toLowerCase()}{s.milestone_name ? ` (${s.milestone_name})` : ""}{s.due_date ? ` · ${formatDate(s.due_date)}` : ""}</span></span>
                                            <span className="tabular">{s.percentage !== null ? `${Number(s.percentage)}%` : formatMoney(s.amount, c)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {v.payment_terms && <p className="whitespace-pre-wrap text-[13px] text-muted-foreground">{v.payment_terms}</p>}
                        </section>
                    )}

                    <Comments token={token} access={access} data={data} />
                </div>

                <aside className="space-y-4 lg:sticky lg:top-4 lg:h-fit">
                    <div className="rounded-lg border border-border bg-card p-4">
                        <Row label="Subtotal" value={formatMoney(totals.net_total, c)} />
                        {totals.tax_total > 0 && <Row label="Tax" value={formatMoney(totals.tax_total, c)} />}
                        <div className="my-2 border-t border-border" />
                        <Row label="Total" value={formatMoney(totals.gross_total, c)} strong />
                        {totals.recurring_monthly > 0 && <Row label="Recurring" value={`${formatMoney(totals.recurring_monthly, c)} / month`} />}
                        {totals.optional_total > 0 && <Row label="Optional, not selected" value={formatMoney(totals.optional_total, c)} />}
                    </div>
                    {active && <DecisionCard token={token} access={access} data={data} selected={selected} />}
                </aside>
            </div>
        </div>
    );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
    return (
        <div className="flex items-center justify-between gap-2 py-0.5 text-[13px]">
            <span className="text-muted-foreground">{label}</span>
            <span className={cn("tabular", strong && "text-base font-medium")}>{value}</span>
        </div>
    );
}

function DecisionCard({ token, access, data, selected }: { token: string; access: string | null; data: PublicProposal; selected: string[] }) {
    const decide = useDecidePublicProposal();
    const [mode, setMode] = useState<ProposalCustomerDecision | null>(null);
    const [done, setDone] = useState<ProposalCustomerDecision | null>(null);
    const form = useForm<PublicDecisionFormValues>({
        resolver: zodResolver(publicDecisionSchema),
        defaultValues: { signer_name: data.recipient?.contact ?? "", signer_email: data.recipient?.email ?? "", signer_title: "", terms_accepted: false, feedback: "" },
    });

    if (done) {
        return (
            <div className="rounded-lg border border-border bg-card p-4 text-center">
                <CheckCircle2 className="mx-auto mb-2 size-7 text-success" />
                <p className="text-sm font-medium">{done === "ACCEPTED" ? "Thank you! Your acceptance is recorded." : done === "REJECTED" ? "Your answer is recorded." : "Thanks, we'll come back with changes."}</p>
                <p className="mt-1 text-xs text-muted-foreground">{data.organization.name} has been notified.</p>
            </div>
        );
    }

    const submit = form.handleSubmit((values) => {
        if (!mode) return;
        if (mode === "ACCEPTED" && !values.terms_accepted) {
            form.setError("terms_accepted", { message: "Please confirm the terms" });
            return;
        }
        if (mode !== "ACCEPTED" && !values.feedback?.trim()) {
            form.setError("feedback", { message: mode === "REJECTED" ? "Tell us briefly why" : "Describe the changes you need" });
            return;
        }
        decide.mutate(
            { token, access, decision: mode, signer_name: values.signer_name, signer_email: values.signer_email, signer_title: values.signer_title || undefined, terms_accepted: values.terms_accepted, feedback: values.feedback || undefined, selected_optional_item_ids: selected },
            { onSuccess: () => setDone(mode), onError: (e) => toast({ variant: "destructive", title: "Could not record your decision", description: getApiErrorMessage(e) }) }
        );
    });

    return (
        <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-medium">Your decision</h2>
            {!mode ? (
                <div className="space-y-2">
                    <Button className="w-full" onClick={() => setMode("ACCEPTED")}><CheckCircle2 /> Accept proposal</Button>
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" onClick={() => setMode("CHANGES_REQUESTED")}>Request changes</Button>
                        <Button variant="outline" onClick={() => setMode("REJECTED")}>Decline</Button>
                    </div>
                </div>
            ) : (
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-3">
                        <FormField control={form.control} name="signer_name" render={({ field }) => (<FormItem><FormLabel>Full name</FormLabel><FormControl><Input autoComplete="name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="signer_email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" autoComplete="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        {mode === "ACCEPTED" ? (
                            <>
                                <FormField control={form.control} name="signer_title" render={({ field }) => (<FormItem><FormLabel>Title (optional)</FormLabel><FormControl><Input autoComplete="organization-title" {...field} /></FormControl></FormItem>)} />
                                <FormField control={form.control} name="terms_accepted" render={({ field }) => (
                                    <FormItem>
                                        <label className="flex items-start gap-2 text-[13px]">
                                            <FormControl><Checkbox className="mt-0.5" checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} /></FormControl>
                                            I accept this proposal and its terms. Typing my name above counts as my signature.
                                        </label>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </>
                        ) : (
                            <FormField control={form.control} name="feedback" render={({ field }) => (<FormItem><FormLabel>{mode === "REJECTED" ? "Reason" : "What should change?"}</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>)} />
                        )}
                        <Button type="submit" className="w-full" variant={mode === "REJECTED" ? "destructive" : "default"} loading={decide.isPending}>
                            {mode === "ACCEPTED" ? "Accept and sign" : mode === "REJECTED" ? "Decline proposal" : "Send change request"}
                        </Button>
                        <Button type="button" variant="ghost" className="w-full" onClick={() => setMode(null)} disabled={decide.isPending}>Back</Button>
                    </form>
                </Form>
            )}
        </div>
    );
}

function Comments({ token, access, data }: { token: string; access: string | null; data: PublicProposal }) {
    const post = useCommentPublicProposal();
    const [body, setBody] = useState("");
    const [name, setName] = useState(data.recipient?.contact ?? "");
    const comments = data.comments ?? [];
    if (data.state !== "ACTIVE" && !comments.length) return null;
    return (
        <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-2 flex items-center gap-2 text-base font-medium"><MessageSquare className="size-4" /> Questions & comments</h2>
            {comments.length > 0 && (
                <ul className="mb-3 space-y-2">
                    {comments.map((cm) => (
                        <li key={cm.id} className={cn("rounded-md px-3 py-2 text-[13px]", cm.from === "agency" ? "bg-info-soft" : "bg-secondary")}>
                            <div className="mb-0.5 text-xs text-muted-foreground">{cm.from === "agency" ? data.organization.name : cm.author_name || "You"} · {formatDateTime(cm.created_at)}</div>
                            <p className="whitespace-pre-wrap">{cm.body}</p>
                        </li>
                    ))}
                </ul>
            )}
            {data.state === "ACTIVE" && (
                <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); post.mutate({ token, access, body, author_name: name }, { onSuccess: () => { setBody(""); toast({ title: "Comment sent" }); }, onError: (e2) => toast({ variant: "destructive", title: "Could not send", description: getApiErrorMessage(e2) }) }); }}>
                    <Textarea aria-label="Your question" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Ask a question about this proposal" />
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Input aria-label="Your name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                        <Button type="submit" loading={post.isPending} disabled={!body.trim() || name.trim().length < 2}>Send</Button>
                    </div>
                </form>
            )}
        </section>
    );
}
