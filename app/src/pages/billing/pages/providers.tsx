import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plug, Plus, RefreshCw, Unplug } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { useConnectProvider, useProviderAction, useProviders } from "@/features/billing/hooks/use-billing";
import type { ProviderConnection } from "@/features/billing/interfaces/billing.interfaces";
import { connectProviderSchema, type ConnectProviderFormValues } from "@/features/billing/validation-schemas/billing.schema";
import { formatDateTime, formatMoney } from "@/lib/format";
import { ProviderStatusBadge } from "../components/billing-badges";
import { CopyButton } from "../components/copy-button";

/**
 * /billing/providers — payment provider connections (BYOK: the organization's own Stripe keys, stored encrypted, never shown again).
 * @perm finance.payment_providers.manage (whole screen)
 * @api GET/POST /finance/payment-providers · POST /:id/verify · POST /:id/disconnect
 */
export default function ProvidersPage() {
    const list = useProviders();
    const act = useProviderAction();
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState<ProviderConnection | null>(null);
    return (
        <Page width="wide">
            <PageHeader title="Payment providers" description="Collect card payments with your own Stripe account. Several accounts can be routed by currency." actions={<Can permission="finance.payment_providers.manage"><Button onClick={() => setConnecting(true)}><Plus /> Connect Stripe</Button></Can>} />
            {list.isPending ? <ListSkeleton /> : list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : !list.data?.length ? (
                <EmptyState icon={Plug} title="No payment provider connected" description="Without a provider, customers pay by bank transfer and you record payments by hand." action={<Button size="sm" onClick={() => setConnecting(true)}><Plus /> Connect Stripe</Button>} />
            ) : (
                <div className="grid gap-3 md:grid-cols-2">
                    {list.data.map((c) => (
                        <div key={c.id} className="space-y-3 rounded-lg border border-border bg-card p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-foreground">{c.display_name}</span>{c.is_default && <Badge variant="info">Default</Badge>}<Badge variant={c.mode === "test" ? "warning" : "neutral"}>{c.mode}</Badge></div>
                                    <div className="text-xs text-muted-foreground">{c.provider === "STRIPE" ? "Stripe" : "Viva Wallet"}{c.provider_account_id ? ` · ${c.provider_account_id}` : ""}{c.config?.account_name ? ` · ${c.config.account_name}` : ""}</div>
                                </div>
                                <ProviderStatusBadge status={c.status} />
                            </div>
                            {c.last_error && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{c.last_error}</p>}
                            <dl className="grid grid-cols-2 gap-2 text-xs">
                                <div><dt className="text-muted-foreground">Currencies</dt><dd className="text-foreground">{c.currencies.length ? c.currencies.join(", ") : "All"}</dd></div>
                                <div><dt className="text-muted-foreground">Volume</dt><dd className="tabular text-foreground">{formatMoney(c.volume ?? 0, c.currencies[0] ?? "EUR")} · {c.payments ?? 0} payments</dd></div>
                                <div><dt className="text-muted-foreground">Secret key</dt><dd className="text-foreground">{c.integration_connection?.secret_hints?.secret_key ?? "—"}</dd></div>
                                <div><dt className="text-muted-foreground">Last check</dt><dd className="text-foreground">{c.last_checked_at ? formatDateTime(c.last_checked_at) : "—"}</dd></div>
                            </dl>
                            <div className="rounded-md border border-border bg-secondary p-2">
                                <div className="text-xs text-muted-foreground">Webhook endpoint (add in Stripe → Developers → Webhooks)</div>
                                <div className="mt-1 flex items-center gap-2"><code className="min-w-0 flex-1 truncate text-xs">{c.webhook_url}</code><CopyButton text={c.webhook_url} iconOnly variant="ghost" size="icon-sm" aria-label="Copy webhook URL" /></div>
                            </div>
                            {c.status !== "DISCONNECTED" && (
                                <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant="outline" loading={act.isPending && act.variables?.id === c.id && act.variables.action === "verify"} onClick={() => act.mutate({ id: c.id, action: "verify" })}><RefreshCw /> Test connection</Button>
                                    <Button size="sm" variant="destructive" onClick={() => setDisconnecting(c)}><Unplug /> Disconnect</Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            <ConnectDialog open={connecting} onOpenChange={setConnecting} />
            <ConfirmationDialog
                isOpen={!!disconnecting}
                onClose={() => setDisconnecting(null)}
                title={`Disconnect ${disconnecting?.display_name}?`}
                description="Past payments stay linked. Active subscriptions or saved cards on this account block disconnecting."
                confirmText="Disconnect"
                variant="destructive"
                onConfirm={() => { if (disconnecting) act.mutate({ id: disconnecting.id, action: "disconnect" }); setDisconnecting(null); }}
            />
        </Page>
    );
}

function ConnectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const connect = useConnectProvider();
    const form = useForm<ConnectProviderFormValues>({ resolver: zodResolver(connectProviderSchema), defaultValues: { display_name: "Stripe", secret_key: "", webhook_signing_secret: "", publishable_key: "", currencies: "", is_default: true } });
    useEffect(() => { if (open) form.reset(); }, [open, form]);
    const submit = form.handleSubmit((v) =>
        connect.mutate(
            {
                provider: "STRIPE", display_name: v.display_name, is_default: v.is_default,
                currencies: v.currencies ? v.currencies.split(/[,\s]+/).filter(Boolean).map((c) => c.toUpperCase()) : [],
                credentials: { secret_key: v.secret_key, webhook_signing_secret: v.webhook_signing_secret || undefined, publishable_key: v.publishable_key || undefined },
            },
            { onSuccess: () => onOpenChange(false) },
        ),
    );
    return (
        <Dialog open={open} onOpenChange={(o) => !connect.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4" autoComplete="off">
                        <DialogHeader><DialogTitle>Connect Stripe</DialogTitle><DialogDescription>Keys are verified with Stripe, stored encrypted and never shown again. Test keys (sk_test_…) create a test-mode connection.</DialogDescription></DialogHeader>
                        <FormField control={form.control} name="display_name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="secret_key" render={({ field }) => (<FormItem><FormLabel>Secret key</FormLabel><FormControl><Input type="password" placeholder="sk_live_…" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="webhook_signing_secret" render={({ field }) => (<FormItem><FormLabel>Webhook signing secret</FormLabel><FormControl><Input type="password" placeholder="whsec_…" {...field} /></FormControl><FormDescription>Needed to mark invoices paid automatically. Add it after creating the webhook in Stripe.</FormDescription></FormItem>)} />
                        <FormField control={form.control} name="publishable_key" render={({ field }) => (<FormItem><FormLabel>Publishable key</FormLabel><FormControl><Input placeholder="pk_live_…" {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="currencies" render={({ field }) => (<FormItem><FormLabel>Currencies</FormLabel><FormControl><Input placeholder="EUR, USD (empty = all)" {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="is_default" render={({ field }) => (<FormItem className="flex items-center justify-between rounded-md border border-border p-3"><FormLabel>Default connection</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                        <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={connect.isPending}>Cancel</Button><Button type="submit" loading={connect.isPending}>Verify and connect</Button></DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
