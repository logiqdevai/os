import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Clock, FileX2, MailCheck, PenLine, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { renderMarkdown, markdownClass } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import { useDeclineSigning, usePublicCertificate, useSendSigningCode, useSignDocument, useSigningState, useVerifySigningCode } from "@/features/contracts/hooks/use-contracts";
import type { PublicSigningState } from "@/features/contracts/interfaces/contracts.interfaces";
import { CertificateBody } from "../pages/detail/components/signatures-tab";

/**
 * /sign/:token — in-house e-signature: 1 verify identity (emailed one-time code) → 2 review the locked document and sign (typed or drawn) → 3 done.
 * @api GET /public/sign/:token · POST …/send-code · …/verify · …/sign · …/decline · GET …/certificate
 */
export default function SignPage() {
    const { token = "" } = useParams();
    const q = useSigningState(token);
    usePageMetadata({ title: q.data ? `Sign · ${q.data.contract.title}` : "Sign document" });
    useEffect(() => {
        const meta = document.createElement("meta");
        meta.name = "robots";
        meta.content = "noindex, nofollow";
        document.head.appendChild(meta);
        return () => { document.head.removeChild(meta); };
    }, []);
    const s = q.data;
    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="border-b border-border bg-card">
                <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
                    {s?.organization.logo_url ? <img src={s.organization.logo_url} alt="" className="size-8 rounded-md object-contain" /> : <span className="grid size-8 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">{(s?.organization.name ?? "·").slice(0, 2).toUpperCase()}</span>}
                    <span className="truncate text-sm font-medium">{s?.organization.name ?? ""}</span>
                    {s && <span className="ml-auto font-mono text-xs text-muted-foreground">{s.contract.number} · {s.version.label}</span>}
                </div>
            </header>
            <main className="mx-auto max-w-4xl px-4 py-6 md:py-8">
                {q.isPending ? (
                    <div className="space-y-3"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-64" /></div>
                ) : q.error || !s ? (
                    <Notice icon={FileX2} title={getApiErrorStatus(q.error) === 404 ? "This signing link is not valid" : "We couldn't load this document"} text={getApiErrorStatus(q.error) === 404 ? "It may have been replaced by a newer link. Ask the sender to send it again." : getApiErrorMessage(q.error)} />
                ) : (
                    <Flow token={token} s={s} />
                )}
            </main>
            <footer className="px-4 pb-8 text-center text-xs text-muted-foreground">Secured signing by Logiqdev OS · every step is recorded in the audit trail</footer>
        </div>
    );
}

function Notice({ icon: Icon, title, text, children }: { icon: typeof FileX2; title: string; text: string; children?: React.ReactNode }) {
    return (
        <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 text-center">
            <Icon className="mx-auto mb-3 size-8 text-muted-foreground" />
            <h1 className="text-lg font-medium">{title}</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">{text}</p>
            {children}
        </div>
    );
}

function Steps({ step }: { step: 1 | 2 | 3 }) {
    const items = ["Verify", "Review & sign", "Done"];
    return (
        <ol className="mb-5 flex items-center gap-2 text-[12.5px]">
            {items.map((label, i) => (
                <li key={label} className="flex items-center gap-2">
                    <span className={cn("grid size-6 place-items-center rounded-full border text-xs", i + 1 < step ? "border-success bg-success-soft text-success" : i + 1 === step ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>{i + 1 < step ? "✓" : i + 1}</span>
                    <span className={i + 1 === step ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</span>
                    {i < items.length - 1 && <span className="h-px w-4 bg-border sm:w-8" />}
                </li>
            ))}
        </ol>
    );
}

function Flow({ token, s }: { token: string; s: PublicSigningState }) {
    const [showCert, setShowCert] = useState(false);
    if (s.state === "CANCELLED") return <Notice icon={XCircle} title="This signature request was cancelled" text={`${s.organization.name} withdrew the request. Nothing to do.`} />;
    if (s.state === "EXPIRED") return <Notice icon={Clock} title="This signing link expired" text={`Ask ${s.organization.name} to send the document again.`} />;
    if (s.state === "DECLINED") return <Notice icon={XCircle} title="Signing was declined" text="This request was declined, so it can no longer be signed." />;
    if (s.state === "WAITING") return <Notice icon={Clock} title="Not your turn yet" text="Others sign before you. You'll get an email when it's your turn." />;
    if (s.state === "SIGNED" || s.state === "COMPLETED") {
        return (
            <div className="space-y-4">
                <Steps step={3} />
                <Notice icon={CheckCircle2} title={s.state === "COMPLETED" ? "Everyone has signed" : "You signed this document"} text={s.state === "COMPLETED" ? "The agreement is complete. Everyone receives the completion certificate." : `Signed ${formatDateTime(s.signer.signed_at)}. We'll let you know when everyone has signed.`}>
                    {s.state === "COMPLETED" && <Button className="mt-4" variant="outline" onClick={() => setShowCert((v) => !v)}><ShieldCheck /> {showCert ? "Hide" : "View"} certificate</Button>}
                </Notice>
                {showCert && <Certificate token={token} />}
                <SignerList s={s} />
            </div>
        );
    }
    if (!s.signer.identity_verified || !s.sections) return <><Steps step={1} /><Verify token={token} s={s} /></>;
    return <><Steps step={2} /><Review token={token} s={s} /></>;
}

function Certificate({ token }: { token: string }) {
    const q = usePublicCertificate(token, true);
    if (q.isPending) return <Skeleton className="h-48" />;
    if (q.error || !q.data) return <p className="text-center text-[13px] text-muted-foreground">{getApiErrorMessage(q.error)}</p>;
    return <div className="rounded-lg border border-border bg-card p-4"><CertificateBody certificate={q.data} /></div>;
}

function SignerList({ s }: { s: PublicSigningState }) {
    return (
        <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Signers</div>
            <ul className="space-y-1.5">
                {s.signers.map((x, i) => (
                    <li key={i} className="flex items-center gap-2 text-[13px]">
                        <span className="w-4 text-xs text-muted-foreground">{x.order}</span>
                        <span className="min-w-0 flex-1 truncate">{x.name}{x.is_you ? " (you)" : ""}</span>
                        <Badge variant={x.status === "SIGNED" ? "success" : x.status === "DECLINED" ? "danger" : "neutral"}>{x.status === "SIGNED" ? "Signed" : x.status === "DECLINED" ? "Declined" : "Pending"}</Badge>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function Verify({ token, s }: { token: string; s: PublicSigningState }) {
    const send = useSendSigningCode();
    const verify = useVerifySigningCode();
    const [sent, setSent] = useState(false);
    const [code, setCode] = useState("");
    return (
        <div className="mx-auto max-w-md space-y-4 rounded-lg border border-border bg-card p-5">
            <MailCheck className="size-7 text-info" />
            <div>
                <h1 className="text-lg font-medium">{s.contract.title}</h1>
                <p className="mt-1 text-[13px] text-muted-foreground">Hi {s.signer.name}, {s.organization.name} asked you to sign this document. First we confirm it's you with a code sent to {s.signer.email_masked}.</p>
            </div>
            {s.message && <p className="whitespace-pre-wrap rounded-md bg-secondary px-3 py-2 text-[13px]">{s.message}</p>}
            {!sent ? (
                <Button className="w-full" loading={send.isPending} onClick={() => send.mutate(token, { onSuccess: (r) => { setSent(true); if (r.dev_code) toast({ title: "Development code", description: r.dev_code }); }, onError: (e) => toast({ variant: "destructive", title: "Could not send the code", description: getApiErrorMessage(e) }) })}>Email me a code</Button>
            ) : (
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); verify.mutate({ token, code }, { onError: (e2) => toast({ variant: "destructive", title: "Code not accepted", description: getApiErrorMessage(e2) }) }); }}>
                    <div className="space-y-1.5"><Label htmlFor="sign-code">6-digit code</Label><Input id="sign-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></div>
                    <Button type="submit" className="w-full" loading={verify.isPending} disabled={code.length < 6}>Verify</Button>
                    <Button type="button" variant="ghost" className="w-full" disabled={send.isPending} onClick={() => send.mutate(token, { onSuccess: (r) => { toast({ title: "New code sent" }); if (r.dev_code) toast({ title: "Development code", description: r.dev_code }); }, onError: (e) => toast({ variant: "destructive", title: "Could not send", description: getApiErrorMessage(e) }) })}>Send a new code</Button>
                </form>
            )}
        </div>
    );
}

function Review({ token, s }: { token: string; s: PublicSigningState }) {
    const sign = useSignDocument();
    const decline = useDeclineSigning();
    const [method, setMethod] = useState<"TYPED" | "DRAWN">("TYPED");
    const [typed, setTyped] = useState(s.signer.name);
    const [drawn, setDrawn] = useState<string | null>(null);
    const [consent, setConsent] = useState(false);
    const [declineOpen, setDeclineOpen] = useState(false);
    const [reason, setReason] = useState("");
    const ready = consent && (method === "TYPED" ? typed.trim().length >= 2 : !!drawn);

    return (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <article className="min-w-0 space-y-5 rounded-lg border border-border bg-card p-4 md:p-6">
                <header className="border-b border-border pb-3">
                    <h1 className="text-xl font-medium">{s.contract.title}</h1>
                    <p className="text-xs text-muted-foreground">{s.parties.map((p) => p.legal_name).join(" · ")}</p>
                    {s.version.content_hash && <p className="mt-1 break-all font-mono text-[10.5px] text-muted-foreground">Document fingerprint sha256 {s.version.content_hash}</p>}
                </header>
                {(s.sections ?? []).map((sec, i) => (
                    <section key={sec.key} className="space-y-1.5">
                        <h2 className="text-[15px] font-medium">{sec.is_appendix ? "Appendix · " : `${i + 1}. `}{sec.title}</h2>
                        {sec.body?.trim() && <div className={markdownClass} dangerouslySetInnerHTML={{ __html: renderMarkdown(sec.body) }} />}
                    </section>
                ))}
            </article>
            <aside className="space-y-4 lg:sticky lg:top-4 lg:h-fit">
                <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                    <h2 className="flex items-center gap-2 text-sm font-medium"><PenLine className="size-4" /> Your signature</h2>
                    <div className="grid grid-cols-2 gap-1 rounded-md bg-secondary p-1" role="tablist" aria-label="Signature method">
                        {(["TYPED", "DRAWN"] as const).map((m) => (
                            <button key={m} type="button" role="tab" aria-selected={method === m} onClick={() => setMethod(m)} className={cn("h-7 rounded text-[12.5px]", method === m ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground")}>{m === "TYPED" ? "Type" : "Draw"}</button>
                        ))}
                    </div>
                    {method === "TYPED" ? (
                        <div className="space-y-1.5">
                            <Label htmlFor="typed-name">Full name</Label>
                            <Input id="typed-name" value={typed} onChange={(e) => setTyped(e.target.value)} />
                            <div className="rounded-md border border-dashed border-border px-3 py-3 text-center font-serif text-2xl italic text-foreground">{typed || " "}</div>
                        </div>
                    ) : (
                        <SignaturePad onChange={setDrawn} />
                    )}
                    <label className="flex items-start gap-2 text-[12.5px] leading-snug">
                        <Checkbox className="mt-0.5" checked={consent} onCheckedChange={(c) => setConsent(c === true)} />
                        <span className="whitespace-pre-wrap text-muted-foreground">{s.consent_text.body}</span>
                    </label>
                    <Button className="w-full" disabled={!ready} loading={sign.isPending} onClick={() => sign.mutate(
                        { token, signature_type: method, typed_name: method === "TYPED" ? typed.trim() : undefined, signature_data_url: method === "DRAWN" ? drawn ?? undefined : undefined, consent_accepted: consent, consent_text_id: s.consent_text.id },
                        { onSuccess: () => toast({ title: "Signed" }), onError: (e) => toast({ variant: "destructive", title: "Could not sign", description: getApiErrorMessage(e) }) }
                    )}>Sign document</Button>
                    <Button variant="ghost" className="w-full" onClick={() => setDeclineOpen(true)}>Decline to sign</Button>
                </div>
                <SignerList s={s} />
            </aside>
            <Dialog open={declineOpen} onOpenChange={(o) => !decline.isPending && setDeclineOpen(o)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Decline to sign?</DialogTitle><DialogDescription>The request ends for everyone and {s.organization.name} is told your reason.</DialogDescription></DialogHeader>
                    <Textarea aria-label="Reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you declining?" />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDeclineOpen(false)}>Back</Button>
                        <Button variant="destructive" loading={decline.isPending} disabled={reason.trim().length < 3} onClick={() => decline.mutate({ token, reason: reason.trim() }, { onSuccess: () => setDeclineOpen(false), onError: (e) => toast({ variant: "destructive", title: "Could not decline", description: getApiErrorMessage(e) }) })}>Decline</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/** Pointer-based drawing pad (mouse, pen, touch). Strokes use the current text colour so they read in light and dark. */
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const [empty, setEmpty] = useState(true);

    useEffect(() => {
        const c = canvas.current;
        if (!c) return;
        const ratio = window.devicePixelRatio || 1;
        c.width = c.offsetWidth * ratio;
        c.height = c.offsetHeight * ratio;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.scale(ratio, ratio);
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = getComputedStyle(c).color;
    }, []);

    const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const ctx = e.currentTarget.getContext("2d");
        if (!ctx) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = true;
        const p = pos(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
    };
    const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawing.current) return;
        const ctx = e.currentTarget.getContext("2d");
        if (!ctx) return;
        const p = pos(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    };
    const end = () => {
        if (!drawing.current || !canvas.current) return;
        drawing.current = false;
        setEmpty(false);
        onChange(canvas.current.toDataURL("image/png"));
    };
    const clear = () => {
        const c = canvas.current;
        c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
        setEmpty(true);
        onChange(null);
    };
    return (
        <div className="space-y-1.5">
            <canvas
                ref={canvas}
                aria-label="Draw your signature"
                className="h-32 w-full touch-none rounded-md border border-dashed border-border bg-background text-foreground"
                onPointerDown={start}
                onPointerMove={move}
                onPointerUp={end}
                onPointerLeave={end}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{empty ? "Sign with your finger, pen or mouse" : "Looks good"}</span>
                <Button size="sm" variant="ghost" onClick={clear} disabled={empty}>Clear</Button>
            </div>
        </div>
    );
}
