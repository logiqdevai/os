import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCheck, ChevronRight, Copy, Download, ExternalLink, Link2, Lock, RotateCcw, Share2, Star, Trash2, Unlock, Upload } from "lucide-react";
import { Page, PageHeader, KeyValueList, Section } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, ListSkeleton, PageSkeleton } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate, formatDateTime, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { SharePermissionOptions, ShareSubjectTypeOptions } from "@/config/constants/dropdowns/files/files.options";
import * as service from "@/features/files/services/files.services";
import {
    useCreateShare, useDeleteDocument, useDocument, useDocumentVersions, useFileApprovals, useRequestApproval, useRestoreDocumentVersion, useRevokeShare, useSetDocumentFavorite, useSetLegalHold, useShares,
} from "@/features/files/hooks/use-files";
import type { DocumentDetail, ShareSubjectType } from "@/features/files/interfaces/files.interfaces";
import { FileIcon, FilesMemberPicker, FilesStatusBadge, UploadDialog, apiUrl, formatBytes, openDocument } from "../../components/files-ui";

/**
 * /files/documents/:id?tab=versions|shares|approvals — preview, metadata, versions, shares, approvals, legal hold (17 §4–10)
 * @perm VIEW documents.documents.read · new version documents.documents.update · share documents.documents.share · approval documents.documents.approve · hold documents.legal_hold.manage
 * @api GET /files/documents/:id · /versions · GET /files/documents/:id/download-url · GET/POST /files/shares · POST /files/approvals
 */
export default function DocumentDetailPage() {
    const { id = "" } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const p = usePermissions();
    const doc = useDocument(id);
    const favorite = useSetDocumentFavorite();
    const hold = useSetLegalHold();
    const trash = useDeleteDocument();
    const [tab, setTab] = useState("versions");
    const [uploadOpen, setUploadOpen] = useState(false);
    const [trashing, setTrashing] = useState(false);
    const [holdOpen, setHoldOpen] = useState(false);
    const [holdReason, setHoldReason] = useState("");

    if (doc.isPending) return <PageSkeleton />;
    if (doc.error) return <Page><ErrorState error={doc.error} onRetry={() => doc.refetch()} /></Page>;
    const d = doc.data;
    const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });

    return (
        <Page width="wide">
            <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                <Link to="/files" className="hover:text-foreground">All files</Link>
                {d.breadcrumbs.map((b) => <span key={b.id} className="flex items-center gap-1"><ChevronRight className="size-3" /><Link to={`/files?folder=${b.id}`} className="hover:text-foreground">{b.name}</Link></span>)}
            </nav>
            <PageHeader
                title={<span className="flex min-w-0 items-center gap-2"><FileIcon type={d.type_group} className="size-5" /><span className="truncate">{d.title}</span></span>}
                documentTitle={d.title}
                meta={<>{d.status !== "ACTIVE" && <FilesStatusBadge status={d.deleted_at ? "DELETED" : d.status} />}{d.effective_legal_hold && <Badge variant="danger"><Lock className="size-3" /> Legal hold</Badge>}{d.is_sensitive && <Badge variant="warning">Sensitive</Badge>}</>}
                actions={
                    <>
                        <Button variant="outline" size="icon" aria-label={d.is_favorite ? "Remove from favorites" : "Add to favorites"} onClick={() => favorite.mutate({ id, on: !d.is_favorite }, { onError: fail("Could not update favorites") })}><Star className={d.is_favorite ? "fill-warning text-warning" : ""} /></Button>
                        <Button variant="outline" onClick={() => openDocument(id, "inline")}><ExternalLink /> Open</Button>
                        <Button onClick={() => openDocument(id, "attachment")}><Download /> Download</Button>
                    </>
                }
            />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0 space-y-6">
                    <Preview doc={d} />
                    <Tabs value={tab} onValueChange={setTab}>
                        <TabsList className="mb-3">
                            <TabsTrigger value="versions">Versions ({d._count.versions})</TabsTrigger>
                            <TabsTrigger value="shares">Shares ({d._count.shares})</TabsTrigger>
                            <TabsTrigger value="approvals">Approvals</TabsTrigger>
                        </TabsList>
                        <TabsContent value="versions"><VersionsTab doc={d} onUpload={() => setUploadOpen(true)} /></TabsContent>
                        <TabsContent value="shares"><SharesTab doc={d} /></TabsContent>
                        <TabsContent value="approvals"><ApprovalsTab doc={d} /></TabsContent>
                    </Tabs>
                </div>
                <Section title="Details">
                    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                        <KeyValueList
                            columns={1}
                            items={[
                                { label: "File name", value: <span className="break-all">{d.filename}</span> },
                                { label: "Size", value: formatBytes(d.size) },
                                { label: "Type", value: d.mimetype },
                                { label: "Version", value: d.current_version ? `v${d.current_version.version_number} · ${formatDateTime(d.current_version.created_at)}` : null },
                                { label: "Owner", value: d.owner ? personName(d.owner.user) : null },
                                { label: "Folder", value: d.folder ? <Link className="text-info hover:underline" to={`/files?folder=${d.folder.id}`}>{d.folder.name}</Link> : "No folder" },
                                { label: "Project", value: d.project?.name },
                                { label: "Customer", value: d.company?.name },
                                { label: "Retention", value: d.retention_policy ? `${d.retention_policy.name} (${d.retention_policy.retain_days} days)` : null },
                                { label: "Linked to", value: d.attachments.length ? d.attachments.map((a) => `${a.entity_type.toLowerCase()}${a.role ? ` (${a.role})` : ""}`).join(", ") : null },
                            ]}
                        />
                        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                            {p.can("documents.legal_hold.manage") && (d.legal_hold
                                ? <Button size="sm" variant="outline" onClick={() => hold.mutate({ id, on: false }, { onSuccess: () => toast({ title: "Legal hold released" }), onError: fail("Could not release the hold") })}><Unlock /> Release hold</Button>
                                : <Button size="sm" variant="outline" onClick={() => { setHoldReason(""); setHoldOpen(true); }}><Lock /> Legal hold</Button>)}
                            {p.can("documents.documents.delete") && !d.deleted_at && <Button size="sm" variant="outline" className="text-danger" disabled={d.effective_legal_hold} onClick={() => setTrashing(true)}><Trash2 /> Move to trash</Button>}
                        </div>
                    </div>
                </Section>
            </div>

            <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} documentId={id} />
            <ConfirmationDialog isOpen={trashing} onClose={() => setTrashing(false)} title={`Move “${d.title}” to trash?`} description="Shares stop working while it is in the trash." confirmText="Move to trash" variant="destructive" isLoading={trash.isPending} onConfirm={() => trash.mutate(id, { onSuccess: () => { toast({ title: "Moved to trash" }); navigate(d.folder ? `/files?folder=${d.folder.id}` : "/files"); }, onError: fail("Could not delete") })} />
            <Dialog open={holdOpen} onOpenChange={(o) => !hold.isPending && setHoldOpen(o)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Place a legal hold</DialogTitle><DialogDescription>The file cannot be deleted or changed by retention while the hold is active.</DialogDescription></DialogHeader>
                    <div className="space-y-1.5"><Label htmlFor="hold-reason">Reason</Label><Textarea id="hold-reason" rows={3} value={holdReason} onChange={(e) => setHoldReason(e.target.value)} placeholder="Dispute with client, case #2026-14" /></div>
                    <DialogFooter><Button variant="ghost" onClick={() => setHoldOpen(false)} disabled={hold.isPending}>Cancel</Button><Button disabled={!holdReason.trim()} loading={hold.isPending} onClick={() => hold.mutate({ id, on: true, reason: holdReason.trim() }, { onSuccess: () => { toast({ title: "Legal hold placed" }); setHoldOpen(false); }, onError: fail("Could not place the hold") })}>Place hold</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </Page>
    );
}

/** Inline preview for images and PDFs through a short-lived signed URL. */
function Preview({ doc }: { doc: DocumentDetail }) {
    const [src, setSrc] = useState<string | null>(null);
    const [error, setError] = useState(false);
    const previewable = doc.type_group === "image" || doc.type_group === "pdf";
    useEffect(() => {
        let cancelled = false;
        setSrc(null);
        if (previewable && doc.current_version) {
            service.getDownloadUrl(doc.id, { disposition: "inline" }).then((u) => !cancelled && setSrc(apiUrl(u.path))).catch(() => !cancelled && setError(true));
        }
        return () => { cancelled = true; };
    }, [doc.id, doc.current_version?.id, previewable, doc.current_version]);
    if (!previewable) return <div className="flex items-center justify-center gap-3 rounded-lg border border-border bg-card p-10 text-[13px] text-muted-foreground"><FileIcon type={doc.type_group} className="size-8" /> No preview for this file type — open or download it.</div>;
    if (error) return <div className="rounded-lg border border-border bg-card"><EmptyState compact title="Preview not available" /></div>;
    if (!src) return <ListSkeleton rows={4} />;
    return doc.type_group === "image"
        ? <div className="flex justify-center rounded-lg border border-border bg-secondary p-2"><img src={src} alt={doc.title} className="max-h-[60vh] max-w-full rounded object-contain" /></div>
        : <iframe src={src} title={doc.title} className="h-[70vh] w-full rounded-lg border border-border bg-card" />;
}

function VersionsTab({ doc, onUpload }: { doc: DocumentDetail; onUpload: () => void }) {
    const versions = useDocumentVersions(doc.id);
    const restore = useRestoreDocumentVersion();
    const canUpdate = usePermissions().can("documents.documents.update");
    return (
        <div className="space-y-3">
            {canUpdate && !doc.deleted_at && <Button size="sm" variant="outline" onClick={onUpload}><Upload /> Upload new version</Button>}
            {versions.isPending ? <ListSkeleton rows={3} /> : versions.error ? <ErrorState error={versions.error} /> : (
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                    {versions.data.map((v) => (
                        <li key={v.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">v{v.version_number}{doc.current_version?.id === v.id && <Badge variant="success">Current</Badge>}{v.scan_status === "INFECTED" && <Badge variant="danger">Infected</Badge>}</div>
                                <div className="truncate text-xs text-muted-foreground">{v.filename} · {formatBytes(v.size_bytes)} · {v.author ? personName(v.author.user) : "—"} · {formatDateTime(v.created_at)}{v.change_note ? ` · ${v.change_note}` : ""}</div>
                            </div>
                            <div className="flex gap-1.5">
                                <Button size="sm" variant="ghost" onClick={() => openDocument(doc.id, "attachment", v.id)}><Download /> Download</Button>
                                {canUpdate && doc.current_version?.id !== v.id && <Button size="sm" variant="outline" loading={restore.isPending} onClick={() => restore.mutate({ id: doc.id, versionId: v.id }, { onSuccess: () => toast({ title: `Version ${v.version_number} restored as the current version` }), onError: (e) => toast({ variant: "destructive", title: "Could not restore", description: getApiErrorMessage(e) }) })}><RotateCcw /> Restore</Button>}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function SharesTab({ doc }: { doc: DocumentDetail }) {
    const shares = useShares({ document_id: doc.id, limit: 50 });
    const create = useCreateShare();
    const revoke = useRevokeShare();
    const canShare = usePermissions().can("documents.documents.share");
    const [open, setOpen] = useState(false);
    const [subject, setSubject] = useState<ShareSubjectType>("PUBLIC_LINK");
    const [member, setMember] = useState<string[]>([]);
    const [email, setEmail] = useState("");
    const [permission, setPermission] = useState("VIEW");
    const [expires, setExpires] = useState("");
    const [password, setPassword] = useState("");
    const [allowDownload, setAllowDownload] = useState(true);
    const [created, setCreated] = useState<string | null>(null);
    const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });
    const reset = () => { setSubject("PUBLIC_LINK"); setMember([]); setEmail(""); setPermission("VIEW"); setExpires(""); setPassword(""); setAllowDownload(true); setCreated(null); };

    const submit = () => {
        if (subject === "MEMBERSHIP" && !member.length) return toast({ variant: "destructive", title: "Choose a member" });
        if (subject === "EXTERNAL_EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast({ variant: "destructive", title: "Enter a valid email" });
        if (password && password.length < 6) return toast({ variant: "destructive", title: "The password needs at least 6 characters" });
        create.mutate(
            { document_id: doc.id, subject_type: subject, membership_id: subject === "MEMBERSHIP" ? member[0] : undefined, external_email: subject === "EXTERNAL_EMAIL" ? email : undefined, permission: permission as "VIEW", allow_download: allowDownload, expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : undefined, password: password || undefined },
            { onSuccess: (s) => { toast({ title: "Shared" }); if (s.share_url) setCreated(s.share_url); else setOpen(false); }, onError: fail("Could not share") },
        );
    };

    return (
        <div className="space-y-3">
            {canShare && !doc.deleted_at && <Button size="sm" variant="outline" onClick={() => { reset(); setOpen(true); }}><Share2 /> Share</Button>}
            {shares.isPending ? <ListSkeleton rows={2} /> : shares.error ? <ErrorState error={shares.error} /> : !shares.data.data.length ? <div className="rounded-lg border border-border bg-card"><EmptyState compact icon={Link2} title="Not shared" description="Share with a member, a team or by link with an expiry and optional password." /></div> : (
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                    {shares.data.data.map((s) => (
                        <li key={s.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
                            <div className="min-w-0 flex-1">
                                <div className="text-[13px] font-medium text-foreground">{s.membership ? personName(s.membership.user) : s.team?.name ?? s.external_email ?? getDropdownOptionLabel(ShareSubjectTypeOptions, s.subject_type)}{s.link_token_last4 && <span className="ml-1 font-mono text-xs text-muted-foreground">…{s.link_token_last4}</span>}</div>
                                <div className="text-xs text-muted-foreground">{getDropdownOptionLabel(SharePermissionOptions, s.permission)} · {s.access_count} opens{s.expires_at ? ` · expires ${formatDate(s.expires_at)}` : ""}</div>
                            </div>
                            <FilesStatusBadge status={s.status} />
                            {canShare && s.status === "ACTIVE" && <Button size="sm" variant="ghost" className="text-danger" onClick={() => revoke.mutate(s.id, { onSuccess: () => toast({ title: "Share revoked" }), onError: fail("Could not revoke") })}>Revoke</Button>}
                        </li>
                    ))}
                </ul>
            )}
            <Dialog open={open} onOpenChange={(o) => !create.isPending && setOpen(o)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Share “{doc.title}”</DialogTitle><DialogDescription>Links are signed; each open is counted and audited.</DialogDescription></DialogHeader>
                    {created ? (
                        <div className="space-y-2">
                            <p className="text-[13px] text-foreground">Copy the link now — it is shown only once.</p>
                            <div className="flex items-center gap-2 rounded-md border border-border bg-secondary p-2"><code className="min-w-0 flex-1 break-all font-mono text-xs">{created}</code><Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(created).then(() => toast({ title: "Link copied" }))}><Copy /> Copy</Button></div>
                            <DialogFooter><Button onClick={() => setOpen(false)}>Done</Button></DialogFooter>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3">
                                <div className="space-y-1.5"><Label>Share with</Label>
                                    <Select value={subject} onValueChange={(v) => setSubject(v as ShareSubjectType)}>
                                        <SelectTrigger aria-label="Share with"><SelectValue /></SelectTrigger>
                                        <SelectContent>{ShareSubjectTypeOptions.filter((o) => o.id !== "TEAM" && o.id !== "PORTAL_USER").map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                {subject === "MEMBERSHIP" && <div className="space-y-1.5"><Label>Member</Label><FilesMemberPicker value={member} onChange={setMember} /></div>}
                                {subject === "EXTERNAL_EMAIL" && <div className="space-y-1.5"><Label htmlFor="share-email">Email</Label><Input id="share-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>}
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-1.5"><Label>Permission</Label>
                                        <Select value={permission} onValueChange={setPermission}>
                                            <SelectTrigger aria-label="Permission"><SelectValue /></SelectTrigger>
                                            <SelectContent>{SharePermissionOptions.filter((o) => o.id === "VIEW" || subject === "MEMBERSHIP").map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5"><Label htmlFor="share-exp">Expires</Label><Input id="share-exp" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></div>
                                </div>
                                {(subject === "PUBLIC_LINK" || subject === "EXTERNAL_EMAIL") && <div className="space-y-1.5"><Label htmlFor="share-pw">Password (optional)</Label><Input id="share-pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>}
                                <label className="flex items-center justify-between gap-3 text-[13px]">Allow download<Switch checked={allowDownload} onCheckedChange={setAllowDownload} aria-label="Allow download" /></label>
                            </div>
                            <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)} disabled={create.isPending}>Cancel</Button><Button onClick={submit} loading={create.isPending}>Share</Button></DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function ApprovalsTab({ doc }: { doc: DocumentDetail }) {
    const approvals = useFileApprovals({ document_id: doc.id, limit: 20 });
    const request = useRequestApproval();
    const canApprove = usePermissions().can("documents.documents.approve");
    const [open, setOpen] = useState(false);
    const [approvers, setApprovers] = useState<string[]>([]);
    const [message, setMessage] = useState("");
    return (
        <div className="space-y-3">
            {canApprove && !doc.deleted_at && <Button size="sm" variant="outline" onClick={() => { setApprovers([]); setMessage(""); setOpen(true); }}><CheckCheck /> Request approval</Button>}
            {approvals.isPending ? <ListSkeleton rows={2} /> : approvals.error ? <ErrorState error={approvals.error} /> : !approvals.data.data.length ? <div className="rounded-lg border border-border bg-card"><EmptyState compact icon={CheckCheck} title="No approvals" description="Ask colleagues to approve this exact version." /></div> : (
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                    {approvals.data.data.map((a) => (
                        <li key={a.id} className="px-3 py-2.5">
                            <div className="flex items-center justify-between gap-2"><span className="text-[13px] font-medium text-foreground">{a.title ?? "Approval"} · v{a.version?.version_number}</span><FilesStatusBadge status={a.status} /></div>
                            <div className="mt-1 text-xs text-muted-foreground">{a.approvers.map((x) => `${x.membership ? personName(x.membership.user) : "—"}: ${x.decision?.toLowerCase().replace("_", " ") ?? "pending"}`).join(" · ")}</div>
                            {a.can_decide && <Button size="sm" className="mt-2" asChild><Link to="/files/approvals">Decide</Link></Button>}
                        </li>
                    ))}
                </ul>
            )}
            <Dialog open={open} onOpenChange={(o) => !request.isPending && setOpen(o)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Request approval</DialogTitle><DialogDescription>Approvers decide on version v{doc.current_version?.version_number}. A newer upload supersedes the request.</DialogDescription></DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1.5"><Label>Approvers</Label><FilesMemberPicker multiple value={approvers} onChange={setApprovers} placeholder="Choose approvers" /></div>
                        <div className="space-y-1.5"><Label htmlFor="appr-msg">Message</Label><Textarea id="appr-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
                    </div>
                    <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)} disabled={request.isPending}>Cancel</Button><Button disabled={!approvers.length} loading={request.isPending} onClick={() => request.mutate({ document_id: doc.id, approver_membership_ids: approvers, message: message || undefined }, { onSuccess: () => { toast({ title: "Approval requested" }); setOpen(false); }, onError: (e) => toast({ variant: "destructive", title: "Could not request", description: getApiErrorMessage(e) }) })}>Request</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
