import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BellRing, Copy, Download, FileCheck2, Link2, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { SignatureEventTypeOptions, SigningOrderOptions } from "@/config/constants/dropdowns/contracts/signature.options";
import { useCancelSignature, useDownloadCertificatePdf, useReissueLink, useRemindSignature, useSendForSignature, useSignatureCertificate, useSignatureRequests } from "@/features/contracts/hooks/use-contracts";
import type { ContractDetail, ContractVersionDetail, SignatureRequest, SigningLink, SigningOrder } from "@/features/contracts/interfaces/contracts.interfaces";
import { SignatureStatusBadge, SignerStatusBadge } from "../../../components/contract-badges";

const ACTIVE = ["NOT_SENT", "SENT", "DELIVERED", "VIEWED", "PARTIALLY_SIGNED"];

async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast({ title: "Link copied" }); } catch { toast({ variant: "destructive", title: "Copy failed", description: text }); }
}

export function LinksList({ links }: { links: SigningLink[] }) {
    return (
        <ul className="space-y-2">
            {links.map((l) => (
                <li key={l.signer_id} className="space-y-1 rounded-md border border-border p-2">
                    <div className="text-[13px] text-foreground">{l.name} <span className="text-xs text-muted-foreground">{l.email}{l.active === false ? " · waits for earlier signers" : ""}</span></div>
                    <div className="flex gap-2"><Input readOnly value={l.url} aria-label={`Signing link for ${l.name}`} onFocus={(e) => e.currentTarget.select()} className="h-8 text-xs" /><Button size="sm" variant="outline" onClick={() => copy(l.url)}><Copy /></Button></div>
                </li>
            ))}
        </ul>
    );
}

/** Signature requests of this contract + "Send for signature" (locks the approved version). */
export function SignaturesTab({ contract, version }: { contract: ContractDetail; version: ContractVersionDetail | undefined }) {
    const p = usePermissions();
    const list = useSignatureRequests({ contract_id: contract.id, limit: 50 });
    const remind = useRemindSignature();
    const reissue = useReissueLink();
    const cancel = useCancelSignature();
    const [sendOpen, setSendOpen] = useState(false);
    const [links, setLinks] = useState<{ title: string; links: SigningLink[]; note?: string } | null>(null);
    const [cancelling, setCancelling] = useState<SignatureRequest | null>(null);
    const [certificate, setCertificate] = useState<string | null>(null);
    const canSend = p.can("contracts.signatures.send") && !!version && version.id === contract.current_version_id && version.status === "APPROVED";
    const active = list.data?.data.some((r) => ACTIVE.includes(r.status));
    const [sp, setSp] = useSearchParams();

    // The header's "Send for signature" links here with ?send=1: open the dialog once the version is loaded.
    useEffect(() => {
        if (sp.get("send") !== "1" || !version || list.isPending) return;
        if (canSend && !active) setSendOpen(true);
        setSp((prev) => { const n = new URLSearchParams(prev); n.delete("send"); return n; }, { replace: true });
    }, [sp, setSp, version, canSend, active, list.isPending]);

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[15px] font-medium text-foreground">Signature requests</h2>
                {p.can("contracts.signatures.send") && (
                    <Button size="sm" disabled={!canSend || active} title={!canSend ? "Approve the current version first" : active ? "A request is already in progress" : undefined} onClick={() => setSendOpen(true)}><Send /> Send for signature</Button>
                )}
            </div>
            {version && version.status !== "APPROVED" && !active && version.id === contract.current_version_id && p.can("contracts.signatures.send") && (
                <p className="rounded-md bg-info-soft px-3 py-2 text-[13px] text-info">{version.label} is {version.status.toLowerCase().replace(/_/g, " ")}. Submit it for approval on the Document tab; approved versions can be sent for signature.</p>
            )}
            {list.isPending ? <Skeleton className="h-32" /> : list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : !list.data?.data.length ? (
                <div className="rounded-lg border border-border bg-card"><EmptyState compact icon={Send} title="No signature requests" description="Send the approved version to the signatories. Each signer verifies their email and signs online." /></div>
            ) : (
                list.data.data.map((r) => (
                    <div key={r.id} className="rounded-lg border border-border bg-card">
                        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                            <SignatureStatusBadge status={r.status} />
                            <span className="text-[13px] text-foreground">{r.contract_version?.label ?? ""} · {getDropdownOptionLabel(SigningOrderOptions, r.signing_order)}</span>
                            <span className="text-xs text-muted-foreground">sent {formatDateTime(r.sent_at ?? r.created_at)}{r.expires_at ? ` · expires ${formatDateTime(r.expires_at)}` : ""}</span>
                            <div className="ml-auto flex flex-wrap gap-1">
                                {r.status === "FULLY_SIGNED" && <Button size="sm" variant="ghost" onClick={() => setCertificate(r.id)}><FileCheck2 /> Certificate</Button>}
                                {ACTIVE.includes(r.status) && p.can("contracts.signatures.send") && (
                                    <Button size="sm" variant="ghost" loading={remind.isPending} onClick={() => remind.mutate(r.id, { onSuccess: (res) => { if (res.email_sent) toast({ title: "Reminder sent" }); else setLinks({ title: "Share these links", links: res.links, note: "Email is not configured; share the links yourself." }); }, onError: (e) => toast({ variant: "destructive", title: "Could not remind", description: getApiErrorMessage(e) }) })}><BellRing /> Remind</Button>
                                )}
                                {ACTIVE.includes(r.status) && p.can("contracts.signatures.cancel") && <Button size="sm" variant="ghost" onClick={() => setCancelling(r)}><XCircle /> Cancel</Button>}
                            </div>
                        </div>
                        <ul className="divide-y divide-border">
                            {r.signers.map((s) => (
                                <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[13px]">
                                    <span className="w-5 text-xs text-muted-foreground tabular">{s.order}</span>
                                    <span className="min-w-0 flex-1 truncate text-foreground">{s.name} <span className="text-xs text-muted-foreground">{s.email}</span></span>
                                    <SignerStatusBadge status={s.status} />
                                    <span className="text-xs text-muted-foreground">{s.signed_at ? `signed ${formatDateTime(s.signed_at)}` : s.declined_at ? `declined: ${s.decline_reason ?? ""}` : s.viewed_at ? `viewed ${formatDateTime(s.viewed_at)}` : ""}</span>
                                    {ACTIVE.includes(r.status) && !["SIGNED", "DECLINED"].includes(s.status) && p.can("contracts.signatures.send") && (
                                        <Button size="sm" variant="ghost" onClick={() => reissue.mutate({ id: r.id, signerId: s.id }, { onSuccess: (l) => setLinks({ title: `New link for ${s.name}`, links: [l], note: l.emailed ? "The new link was also emailed." : "The previous link no longer works." }), onError: (e) => toast({ variant: "destructive", title: "Could not create a link", description: getApiErrorMessage(e) }) })}><Link2 /> New link</Button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))
            )}
            {version && <SendDialog contract={contract} version={version} open={sendOpen} onOpenChange={setSendOpen} onSent={(res) => setLinks({ title: "Signing links", links: res.links, note: res.email_sent ? "Signers were emailed. You can also share the links." : "Email is not configured; share these links with each signer." })} />}
            <Dialog open={!!links} onOpenChange={(o) => !o && setLinks(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader><DialogTitle>{links?.title}</DialogTitle><DialogDescription>{links?.note}</DialogDescription></DialogHeader>
                    {links && <LinksList links={links.links} />}
                    <DialogFooter><Button onClick={() => setLinks(null)}>Done</Button></DialogFooter>
                </DialogContent>
            </Dialog>
            <ConfirmationDialog
                isOpen={!!cancelling}
                onClose={() => setCancelling(null)}
                title="Cancel this signature request?"
                description="Signing links stop working and the version is unlocked for changes."
                confirmText="Cancel request"
                variant="destructive"
                isLoading={cancel.isPending}
                onConfirm={() => cancelling && cancel.mutate({ id: cancelling.id }, { onSuccess: () => { toast({ title: "Request cancelled" }); setCancelling(null); }, onError: (e) => toast({ variant: "destructive", title: "Could not cancel", description: getApiErrorMessage(e) }) })}
            />
            <CertificateSheet requestId={certificate} onClose={() => setCertificate(null)} />
        </div>
    );
}

function SendDialog({ contract, version, open, onOpenChange, onSent }: { contract: ContractDetail; version: ContractVersionDetail; open: boolean; onOpenChange: (o: boolean) => void; onSent: (r: { links: SigningLink[]; email_sent: boolean }) => void }) {
    const send = useSendForSignature();
    const signatories = contract.parties.flatMap((p) => p.signatories.filter((s) => s.is_required).map((s) => ({ ...s, party: p.legal_name, agency: p.party_type === "AGENCY" })));
    const [order, setOrder] = useState<SigningOrder>("SEQUENTIAL");
    const [message, setMessage] = useState("");
    const [days, setDays] = useState("30");
    useEffect(() => { if (open) { setMessage(""); setDays("30"); } }, [open]);
    // Customer signs first, the agency countersigns.
    const ordered = [...signatories].sort((a, b) => Number(a.agency) - Number(b.agency));
    return (
        <Dialog open={open} onOpenChange={(o) => !send.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>Send {version.label} for signature</DialogTitle><DialogDescription>The version is locked (content hash recorded). Each signer verifies their email with a code and signs online.</DialogDescription></DialogHeader>
                {!ordered.length ? (
                    <p className="rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning">Add required signatories on the Parties tab first.</p>
                ) : (
                    <div className="space-y-3">
                        <ol className="space-y-1 rounded-md border border-border p-2">
                            {ordered.map((s, i) => <li key={s.id} className="text-[13px] text-foreground">{order === "SEQUENTIAL" ? `${i + 1}. ` : "• "}{s.name} <span className="text-xs text-muted-foreground">{s.email} · {s.party}</span></li>)}
                        </ol>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5"><Label>Signing order</Label>
                                <Select value={order} onValueChange={(v) => setOrder(v as SigningOrder)}><SelectTrigger aria-label="Signing order"><SelectValue /></SelectTrigger><SelectContent>{SigningOrderOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                            </div>
                            <div className="space-y-1.5"><Label htmlFor="sig-days">Expires after (days)</Label><Input id="sig-days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} /></div>
                        </div>
                        <div className="space-y-1.5"><Label htmlFor="sig-message">Message to signers</Label><Textarea id="sig-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
                    </div>
                )}
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={send.isPending}>Cancel</Button>
                    <Button
                        loading={send.isPending}
                        disabled={!ordered.length || !Number(days)}
                        onClick={() => send.mutate(
                            { id: contract.id, vid: version.id, signing_order: order, message: message || undefined, expires_in_days: Math.min(180, Number(days)), signers: ordered.map((s, i) => ({ signatory_id: s.id, name: s.name, email: s.email, title: s.title ?? undefined, order: order === "SEQUENTIAL" ? i + 1 : 1 })) },
                            { onSuccess: (r) => { toast({ title: "Sent for signature" }); onOpenChange(false); onSent(r); }, onError: (e) => toast({ variant: "destructive", title: "Could not send", description: getApiErrorMessage(e) }) }
                        )}
                    >
                        Lock and send
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function CertificateSheet({ requestId, onClose }: { requestId: string | null; onClose: () => void }) {
    const q = useSignatureCertificate(requestId ?? undefined);
    const pdf = useDownloadCertificatePdf();
    const c = q.data;
    return (
        <Sheet open={!!requestId} onOpenChange={(o) => !o && onClose()}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
                <SheetHeader><SheetTitle>Completion certificate</SheetTitle><SheetDescription>Signer identity, consent and the event trail for this request.</SheetDescription></SheetHeader>
                {requestId && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 w-fit"
                        loading={pdf.isPending}
                        onClick={() => pdf.mutate(requestId, { onSuccess: (name) => toast({ title: "PDF downloaded", description: name }), onError: (e) => toast({ variant: "destructive", title: "Could not create the PDF", description: getApiErrorMessage(e) }) })}
                    >
                        <Download /> Download PDF
                    </Button>
                )}
                {q.isPending ? <Skeleton className="mt-4 h-64" /> : q.error ? <ErrorState error={q.error} /> : c ? <CertificateBody certificate={c} /> : null}
            </SheetContent>
        </Sheet>
    );
}

export function CertificateBody({ certificate: c }: { certificate: NonNullable<ReturnType<typeof useSignatureCertificate>["data"]> }) {
    return (
        <div className="mt-4 space-y-4 text-[13px]">
            <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-1">
                <dt className="text-muted-foreground">Certificate</dt><dd className="truncate font-mono text-xs">{c.certificate_id}</dd>
                <dt className="text-muted-foreground">Document</dt><dd>{c.document.number} · {c.document.title} · {c.document.version}</dd>
                <dt className="text-muted-foreground">Content hash</dt><dd className="break-all font-mono text-[11px]">{c.document.content_hash ?? "—"}</dd>
                <dt className="text-muted-foreground">Completed</dt><dd>{formatDateTime(c.completed_at)}</dd>
                <dt className="text-muted-foreground">Issued by</dt><dd>{c.issued_by}</dd>
            </dl>
            <div className="space-y-2">
                {c.signers.map((s, i) => (
                    <div key={i} className="rounded-md border border-border p-2">
                        <div className="font-medium text-foreground">{s.name}{s.title ? `, ${s.title}` : ""}</div>
                        <div className="text-xs text-muted-foreground">{s.email} · verified {formatDateTime(s.identity_verified_at)} by {s.auth_method ?? "email code"}</div>
                        <div className="text-xs text-muted-foreground">Signed {formatDateTime(s.signed_at)} ({s.signature_type?.toLowerCase() ?? "—"}) · consent {s.consent_version ?? "—"} · IP {s.ip_address ?? "—"}</div>
                    </div>
                ))}
            </div>
            <ol className="space-y-1 border-l border-border pl-3">
                {c.events.map((e, i) => <li key={i} className="text-xs"><span className="text-foreground">{getDropdownOptionLabel(SignatureEventTypeOptions, e.type)}</span> <span className="text-muted-foreground">{e.signer ? `· ${e.signer} ` : ""}· {formatDateTime(e.occurred_at)}{e.ip_address ? ` · ${e.ip_address}` : ""}</span></li>)}
            </ol>
        </div>
    );
}
