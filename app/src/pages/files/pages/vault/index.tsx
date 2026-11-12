import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Copy, Eye, EyeOff, KeyRound, MoreHorizontal, Plus, Trash2, Users } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { VaultEntryTypeFilterOptions, VaultEntryTypeOptions } from "@/config/constants/dropdowns/files/files.options";
import * as service from "@/features/files/services/files.services";
import { useCreateVaultEntry, useDeleteVaultEntry, useRevealVaultEntry, useVaultEntries } from "@/features/files/hooks/use-files";
import type { VaultEntry, VaultEntryType } from "@/features/files/interfaces/files.interfaces";
import { VaultGrantsDialog } from "./components/vault-grants-dialog";

/**
 * /files/vault — encrypted credentials (17 §12). Secrets are never in lists; reveal is confirmed, audited (VaultAccessLog) and auto-hidden.
 * @perm VIEW documents.vault.read · reveal documents.vault.read (+ grant/scope) · create/delete documents.vault.manage
 * @api GET /files/vault/entries · POST /files/vault/entries · POST /files/vault/entries/:id/reveal|copy · DELETE /files/vault/entries/:id · grants: POST|DELETE /files/vault/entries/:id/grants (documents.vault.manage)
 */
export default function VaultPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const entries = useVaultEntries(params);
    const p = usePermissions();
    const canManage = p.can("documents.vault.manage");
    const remove = useDeleteVaultEntry();
    const [formOpen, setFormOpen] = useState(false);
    const [confirmReveal, setConfirmReveal] = useState<VaultEntry | null>(null);
    const [revealed, setRevealed] = useState<{ entry: VaultEntry; secret: string; hideAt: number } | null>(null);
    const [deleting, setDeleting] = useState<VaultEntry | null>(null);
    const [granting, setGranting] = useState<VaultEntry | null>(null);
    const reveal = useRevealVaultEntry();

    const columns: DataTableColumn<VaultEntry>[] = [
        {
            key: "name",
            header: "Credential",
            cell: (e) => (
                <div className="flex min-w-0 items-center gap-2">
                    <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{e.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{e.username ?? e.url ?? getDropdownOptionLabel(VaultEntryTypeOptions, e.type)}</div>
                    </div>
                </div>
            ),
        },
        { key: "type", header: "Type", cell: (e) => <Badge variant="outline">{getDropdownOptionLabel(VaultEntryTypeOptions, e.type)}</Badge>, hideBelow: "sm" },
        { key: "for", header: "For", cell: (e) => e.company?.name ?? e.project?.name ?? "Organization", hideBelow: "lg" },
        { key: "secret", header: "Secret", cell: (e) => <code className="font-mono text-xs text-muted-foreground">{e.secret_hint ? `••••${e.secret_hint.slice(-4)}` : "—"}</code>, hideBelow: "md" },
        { key: "expires", header: "Expires", cell: (e) => (e.is_expired ? <Badge variant="danger">Expired</Badge> : e.expiring_soon ? <Badge variant="warning">{formatDate(e.expires_at)}</Badge> : e.expires_at ? formatDate(e.expires_at) : "—"), hideBelow: "lg" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-28",
            cell: (e) => (
                <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => setConfirmReveal(e)} disabled={!e.secret_hint}><Eye /> Reveal</Button>
                    {canManage && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${e.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setGranting(e)}><Users /> Access{e._count?.grants ? ` (${e._count.grants})` : ""}</DropdownMenuItem><DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(e)}><Trash2 /> Delete</DropdownMenuItem></DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            ),
        },
    ];

    return (
        <Page>
            <PageHeader title="Vault" description="Client and internal credentials, encrypted at rest. Every reveal and copy is logged." actions={canManage && <Button onClick={() => setFormOpen(true)}><Plus /> New credential</Button>} />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search credentials…">
                <Select value={filters.type ?? "all"} onValueChange={(v) => setFilter("type", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by type"><SelectValue /></SelectTrigger>
                    <SelectContent>{VaultEntryTypeFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable columns={columns} data={entries.data?.data} rowKey={(e) => e.id} loading={entries.isFetching} error={entries.error} onRetry={() => entries.refetch()} pagination={entries.data?.pagination} onPageChange={setPage} empty={{ icon: KeyRound, title: search ? "No credentials match" : "The vault is empty", description: "Store hosting logins, API keys and SSH keys here instead of in chats.", action: canManage && !search ? <Button size="sm" onClick={() => setFormOpen(true)}><Plus /> New credential</Button> : undefined }} />

            <ConfirmationDialog
                isOpen={!!confirmReveal}
                onClose={() => setConfirmReveal(null)}
                title={`Reveal the secret of “${confirmReveal?.name}”?`}
                description="This is recorded in the vault access log with your name and time. The secret hides itself after a short time."
                confirmText="Reveal"
                isLoading={reveal.isPending}
                onConfirm={() => confirmReveal && reveal.mutate({ id: confirmReveal.id }, {
                    onSuccess: (r) => { setRevealed({ entry: confirmReveal, secret: r.secret, hideAt: Date.now() + (r.hide_after_seconds || 30) * 1000 }); setConfirmReveal(null); },
                    onError: (e) => { toast({ variant: "destructive", title: "Could not reveal", description: getApiErrorMessage(e) }); setConfirmReveal(null); },
                })}
            />
            <RevealDialog revealed={revealed} onClose={() => setRevealed(null)} />
            <VaultFormDialog open={formOpen} onOpenChange={setFormOpen} />
            <VaultGrantsDialog entry={granting} onClose={() => setGranting(null)} />
            <ConfirmationDialog isOpen={!!deleting} onClose={() => setDeleting(null)} title={`Delete “${deleting?.name}”?`} description="The encrypted secret is destroyed. The access log is kept." confirmText="Delete" variant="destructive" isLoading={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => { toast({ title: "Credential deleted" }); setDeleting(null); }, onError: (e) => toast({ variant: "destructive", title: "Could not delete", description: getApiErrorMessage(e) }) })} />
        </Page>
    );
}

/** Shows the secret with a countdown; it is wiped from memory when the dialog closes or the timer ends. */
function RevealDialog({ revealed, onClose }: { revealed: { entry: VaultEntry; secret: string; hideAt: number } | null; onClose: () => void }) {
    const [visible, setVisible] = useState(true);
    const [left, setLeft] = useState(0);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
        if (!revealed) return;
        setVisible(true);
        const tick = () => {
            const s = Math.max(0, Math.ceil((revealed.hideAt - Date.now()) / 1000));
            setLeft(s);
            if (s === 0) closeRef.current();
        };
        tick();
        const t = setInterval(tick, 500);
        return () => clearInterval(t);
    }, [revealed]);
    if (!revealed) return null;
    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{revealed.entry.name}</DialogTitle>
                    <DialogDescription>Hides in {left}s{revealed.entry.username ? ` · user ${revealed.entry.username}` : ""}</DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2 rounded-md border border-border bg-secondary p-2">
                    <code className="min-w-0 flex-1 break-all font-mono text-sm text-foreground">{visible ? revealed.secret : "•".repeat(Math.min(24, revealed.secret.length))}</code>
                    <Button size="icon-sm" variant="ghost" aria-label={visible ? "Hide" : "Show"} onClick={() => setVisible((v) => !v)}>{visible ? <EyeOff /> : <Eye />}</Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigator.clipboard.writeText(revealed.secret).then(() => { toast({ title: "Copied — clear your clipboard after use" }); service.logVaultCopy(revealed.entry.id).catch(() => undefined); })}
                    >
                        <Copy /> Copy
                    </Button>
                </div>
                {revealed.entry.url && <p className="break-all text-xs text-muted-foreground">{revealed.entry.url}</p>}
                <DialogFooter><Button onClick={onClose}>Hide now</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

const schema = z.object({
    name: z.string().trim().min(1, "Required").max(160),
    type: z.enum(["PASSWORD", "API_KEY", "SSH_KEY", "NOTE", "FILE"]),
    username: z.string().max(255).optional(),
    secret: z.string().min(1, "Enter the secret").max(20000),
    url: z.string().max(2000).optional(),
    notes: z.string().max(5000).optional(),
    expires_at: z.string().optional(),
});
type Values = z.infer<typeof schema>;

function VaultFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const create = useCreateVaultEntry();
    const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", type: "PASSWORD", username: "", secret: "", url: "", notes: "", expires_at: "" } });
    useEffect(() => { if (open) form.reset(); }, [open, form]);
    const submit = form.handleSubmit((v) => create.mutate(
        { name: v.name, type: v.type as VaultEntryType, username: v.username || undefined, secret: v.secret, url: v.url || undefined, notes: v.notes || undefined, expires_at: v.expires_at ? new Date(`${v.expires_at}T23:59:59`).toISOString() : undefined },
        { onSuccess: () => { toast({ title: "Credential saved" }); onOpenChange(false); }, onError: (e) => toast({ variant: "destructive", title: "Could not save", description: getApiErrorMessage(e) }) },
    ));
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4" autoComplete="off">
                        <DialogHeader><DialogTitle>New credential</DialogTitle><DialogDescription>The secret is encrypted before it is stored and is never shown in lists.</DialogDescription></DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus placeholder="Acme — production hosting" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="type" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Type</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{VaultEntryTypeOptions.filter((o) => o.id !== "FILE").map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="username" render={({ field }) => (<FormItem><FormLabel>Username</FormLabel><FormControl><Input autoComplete="off" {...field} /></FormControl></FormItem>)} />
                        </div>
                        <FormField control={form.control} name="secret" render={({ field }) => (<FormItem><FormLabel>Secret</FormLabel><FormControl>{form.watch("type") === "SSH_KEY" || form.watch("type") === "NOTE" ? <Textarea rows={4} className="font-mono text-xs" {...field} /> : <PasswordInput autoComplete="new-password" {...field} />}</FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="url" render={({ field }) => (<FormItem><FormLabel>URL</FormLabel><FormControl><Input placeholder="https://" {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="expires_at" render={({ field }) => (<FormItem><FormLabel>Expires</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormDescription>You get a warning 30 days before.</FormDescription></FormItem>)} />
                        <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
                        <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button><Button type="submit" loading={create.isPending}>Save credential</Button></DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

