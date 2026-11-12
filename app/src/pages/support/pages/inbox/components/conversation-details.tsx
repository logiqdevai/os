import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Mail, Plus, Sparkles, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/page";
import { Markdown } from "@/components/ui/markdown";
import { Can } from "@/components/access/can";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate, formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { SupportChannelTypeOptions } from "@/config/constants/dropdowns/support/support.options";
import { useSummarizeConversation } from "@/features/support/hooks/use-support";
import type { ConversationDetail } from "@/features/support/interfaces/support.interfaces";
import { ConversationStatusBadge, SlaChip, TicketStatusBadge } from "../../../components/support-badges";
import { SUPPORT_PATHS } from "../../../support-paths";

/** Right pane of the inbox (and a sheet on smaller screens): customer, linked tickets, history, AI summary. */
export function ConversationDetails({ conversation: c }: { conversation: ConversationDetail }) {
    const navigate = useNavigate();
    const canAi = usePermission("support.ai.use");
    const summarize = useSummarizeConversation();
    const [summary, setSummary] = useState<string | null>(c.ai_summary);
    const tickets = [...c.primary_tickets, ...c.ticket_links.map((l) => ({ ...l.ticket, sla_breached: false, sla_at_risk: false, resolution_due_at: null, first_response_due_at: null, priority: "NORMAL" as const }))];

    return (
        <div className="space-y-6 p-4">
            <Section title="Customer">
                <div className="space-y-1.5 text-[13px]">
                    <div className="font-medium text-foreground">{c.customer_name || c.contact?.first_name || c.customer_email || "Unknown"}</div>
                    {c.customer_email && <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="size-3.5" /> <span className="truncate">{c.customer_email}</span></div>}
                    {c.company && (
                        <Link to={`/crm/companies/${c.company.id}`} className="flex items-center gap-1.5 text-info hover:underline"><Building2 className="size-3.5" /> {c.company.name}</Link>
                    )}
                    <div className="text-xs text-muted-foreground">
                        {getDropdownOptionLabel(SupportChannelTypeOptions, c.channel_type)}{c.inbox ? ` · ${c.inbox.name}` : ""} · started {formatDate(c.created_at)}
                    </div>
                </div>
            </Section>

            <Section
                title="Tickets"
                actions={
                    <Can permission="support.tickets.create">
                        <Button size="sm" variant="outline" onClick={() => navigate(`${SUPPORT_PATHS.newTicket}?conversation=${c.id}`)}>
                            <Plus /> Ticket
                        </Button>
                    </Can>
                }
            >
                {tickets.length ? (
                    <ul className="space-y-2">
                        {tickets.map((t) => (
                            <li key={t.id}>
                                <Link to={SUPPORT_PATHS.ticket(t.reference)} className="block rounded-md border border-border p-2 transition-colors hover:bg-secondary/60">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Ticket className="size-3.5" /> {t.reference}
                                        <span className="ml-auto"><TicketStatusBadge status={t.status} /></span>
                                    </div>
                                    <div className="mt-1 truncate text-[13px] text-foreground">{t.subject}</div>
                                    {(t.sla_breached || t.sla_at_risk || t.resolution_due_at) && <div className="mt-1"><SlaChip breached={t.sla_breached} atRisk={t.sla_at_risk} due={t.first_response_due_at ?? t.resolution_due_at} /></div>}
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-xs text-muted-foreground">No ticket yet. Create one to track SLA and work.</p>
                )}
            </Section>

            {canAi && (
                <Section
                    title="Summary"
                    actions={
                        <Button
                            size="sm"
                            variant="ghost"
                            loading={summarize.isPending}
                            onClick={() =>
                                summarize.mutate(c.id, {
                                    onSuccess: (r) => {
                                        if (r.available) setSummary(r.summary);
                                        else toast({ title: r.reason === "ai_not_configured" ? "Connect an AI provider in Admin → Integrations to use summaries" : "The AI provider did not respond" });
                                    },
                                    onError: (e) => toast({ variant: "destructive", title: "Could not summarize", description: getApiErrorMessage(e) }),
                                })
                            }
                        >
                            <Sparkles /> {summary ? "Refresh" : "Summarize"}
                        </Button>
                    }
                >
                    {summary ? <Markdown source={summary} className="space-y-1.5 text-[13px]" /> : <p className="text-xs text-muted-foreground">No summary yet.</p>}
                </Section>
            )}

            {c.csat_ratings.some((r) => r.submitted_at) && (
                <Section title="Satisfaction">
                    {c.csat_ratings.filter((r) => r.submitted_at).map((r) => (
                        <div key={r.id} className="text-[13px]">
                            <span className="font-medium tabular">{r.rating}/5</span>
                            {r.comment && <span className="text-muted-foreground"> — “{r.comment}”</span>}
                        </div>
                    ))}
                </Section>
            )}

            <Section title="Previous conversations">
                {c.customer_history.length ? (
                    <ul className="space-y-1.5">
                        {c.customer_history.map((h) => (
                            <li key={h.id}>
                                <Link to={SUPPORT_PATHS.conversation(h.id)} className="flex items-center gap-2 text-[13px] hover:underline">
                                    <span className="min-w-0 flex-1 truncate">{h.subject || "No subject"}</span>
                                    <ConversationStatusBadge status={h.status} />
                                </Link>
                                <div className="text-[11px] text-muted-foreground">{formatRelative(h.created_at)}</div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-xs text-muted-foreground">First conversation with this customer.</p>
                )}
            </Section>
        </div>
    );
}
