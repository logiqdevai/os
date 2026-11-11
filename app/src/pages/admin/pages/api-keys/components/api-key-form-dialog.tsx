import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermission } from "@/hooks/use-permission";
import { useCreateApiKey } from "@/features/admin/api-keys/hooks/use-api-keys";
import { useServiceAccounts } from "@/features/admin/service-accounts/hooks/use-service-accounts";
import { apiKeyFormSchema, parseList, type ApiKeyFormValues } from "@/features/admin/api-keys/validation-schemas/api-keys.schema";
import { ApiKeyExpiryOptions } from "@/config/constants/dropdowns/admin/developer-form.options";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { PermissionPicker } from "../../../components/permission-picker";

const ME = "__me";

interface ApiKeyFormDialogProps {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    onCreated: (secret: string) => void;
    /** Pre-select a service account owner. */
    serviceAccountId?: string;
}

/** New API key: owner (you or a service account), optional scopes that narrow the owner, expiry and IP allow-list. */
export function ApiKeyFormDialog({ open, onOpenChange, onCreated, serviceAccountId }: ApiKeyFormDialogProps) {
    const canSa = usePermission("organizations.service_accounts.manage");
    const accounts = useServiceAccounts({ status: "ACTIVE", limit: 100 }, open && canSa);
    const create = useCreateApiKey();
    const [scopes, setScopes] = useState<string[]>([]);
    const form = useForm<ApiKeyFormValues>({ resolver: zodResolver(apiKeyFormSchema), defaultValues: { name: "", owner: ME, expiry: "90", allowed_ip_ranges: "" } });

    useEffect(() => {
        if (open) {
            form.reset({ name: "", owner: serviceAccountId ?? ME, expiry: "90", allowed_ip_ranges: "" });
            setScopes([]);
        }
    }, [open, serviceAccountId, form]);

    const submit = form.handleSubmit((v) =>
        create.mutate(
            {
                name: v.name,
                ...(v.owner !== ME && { service_account_id: v.owner }),
                scopes,
                ...(v.expiry !== "never" && { expires_at: new Date(Date.now() + Number(v.expiry) * 86400000).toISOString() }),
                allowed_ip_ranges: parseList(v.allowed_ip_ranges),
            },
            { onSuccess: (key) => { onOpenChange(false); onCreated(key.secret); }, onError: (e) => toast({ variant: "destructive", title: "Could not create the key", description: getApiErrorMessage(e) }) }
        )
    );

    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>New API key</DialogTitle>
                            <DialogDescription>A key never has more access than its owner. Scopes narrow it further.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus placeholder="Zapier sync" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="owner" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Acts as</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Owner"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value={ME}>Me</SelectItem>
                                            {accounts.data?.data.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} (service account)</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="expiry" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Expires after</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Expiry"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{ApiKeyExpiryOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Scopes</Label>
                            <PermissionPicker value={undefined} onlyHeld onChange={(k) => setScopes((s) => (s.includes(k) ? s : [...s, k]))} />
                            {scopes.length ? (
                                <div className="flex flex-wrap gap-1">
                                    {scopes.map((s) => (
                                        <Badge key={s} variant="secondary" className="h-6 gap-1 pr-1">
                                            <code>{s}</code>
                                            <button type="button" aria-label={`Remove ${s}`} className="rounded-xs hover:text-foreground" onClick={() => setScopes((list) => list.filter((x) => x !== s))}><X className="size-3" /></button>
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground">No scopes = everything the owner can do.</p>
                            )}
                        </div>
                        <FormField control={form.control} name="allowed_ip_ranges" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Allowed IP addresses</FormLabel>
                                <FormControl><Textarea rows={2} placeholder="203.0.113.10, 10.0.0.0/24" {...field} /></FormControl>
                                <FormDescription>Optional. Leave empty to allow any address.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                            <Button type="submit" loading={create.isPending}>Create key</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
