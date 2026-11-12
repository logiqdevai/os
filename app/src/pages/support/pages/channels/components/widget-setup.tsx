import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, ExternalLink, Palette, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { environments } from "@/config/environments";
import { ApiRoutes } from "@/config/api/routes";
import { WidgetPositionOptions } from "@/config/constants/dropdowns/support/support.options";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { useRotateWidgetKey, useUpdateChannel } from "@/features/support/hooks/use-support";
import { widgetAppearanceSchema, type WidgetAppearanceValues } from "@/features/support/validation-schemas/support.schema";
import type { SupportChannel } from "@/features/support/interfaces/support.interfaces";

const apiBase = () => environments.API_URL.replace(/\/+$/, "");

/** Embed snippet, test page link, key rotation and appearance of a WIDGET / LIVE_CHAT channel (mockup 13-support `widget`). */
export function WidgetSetup({ channel, canManage }: { channel: SupportChannel; canManage: boolean }) {
    const rotate = useRotateWidgetKey();
    const [editing, setEditing] = useState(false);
    if (!channel.widget_key) return null;
    const snippet = `<script src="${apiBase()}${ApiRoutes.support.widgetScript(channel.widget_key)}" async></script>`;
    const demoUrl = `/widget-demo.html?key=${encodeURIComponent(channel.widget_key)}&api=${encodeURIComponent(apiBase())}`;
    const copy = () =>
        navigator.clipboard.writeText(snippet).then(
            () => toast({ title: "Snippet copied", description: "Paste it before </body> on your site." }),
            () => toast({ variant: "destructive", title: "Could not copy" }),
        );
    return (
        <div className="mt-3 space-y-2">
            <div className="text-xs text-muted-foreground">
                Paste before <code>&lt;/body&gt;</code>. Allowed sites: {channel.allowed_origins.length ? channel.allowed_origins.join(", ") : "any site (add origins to restrict)"}
            </div>
            <pre className="whitespace-pre-wrap break-all rounded-md border border-border bg-secondary p-2 text-xs text-foreground">{snippet}</pre>
            <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={copy}><Copy /> Copy snippet</Button>
                <Button size="sm" variant="outline" asChild><a href={demoUrl} target="_blank" rel="noreferrer"><ExternalLink /> Test page</a></Button>
                {canManage && <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Palette /> Appearance</Button>}
                {canManage && (
                    <Button size="sm" variant="ghost" loading={rotate.isPending} onClick={() => rotate.mutate(channel.id, { onSuccess: () => toast({ title: "Embed key rotated", description: "Update the snippet on your site." }), onError: (e) => toast({ variant: "destructive", title: "Could not rotate key", description: getApiErrorMessage(e) }) })}>
                        <RefreshCw /> Rotate key
                    </Button>
                )}
            </div>
            <WidgetAppearanceDialog channel={channel} open={editing} onOpenChange={setEditing} />
        </div>
    );
}

function WidgetAppearanceDialog({ channel, open, onOpenChange }: { channel: SupportChannel; open: boolean; onOpenChange: (o: boolean) => void }) {
    const update = useUpdateChannel();
    const form = useForm<WidgetAppearanceValues>({ resolver: zodResolver(widgetAppearanceSchema), defaultValues: { title: "", welcome_message: "", color: "", position: "right", require_email: false, allowed_origins: "" } });
    useEffect(() => {
        if (!open) return;
        const c = (channel.config ?? {}) as Record<string, unknown>;
        form.reset({
            title: typeof c.title === "string" ? c.title : "",
            welcome_message: typeof c.welcome_message === "string" ? c.welcome_message : "",
            color: typeof c.color === "string" ? c.color : "",
            position: c.position === "left" ? "left" : "right",
            require_email: c.require_email === true,
            allowed_origins: channel.allowed_origins.join(", "),
        });
    }, [open, channel, form]);
    const submit = form.handleSubmit((v) =>
        update.mutate(
            {
                id: channel.id,
                config: { ...(channel.config ?? {}), title: v.title || undefined, welcome_message: v.welcome_message || undefined, color: v.color || undefined, position: v.position, require_email: v.require_email },
                allowed_origins: (v.allowed_origins ?? "").split(/[\s,]+/).filter(Boolean).map((o) => o.replace(/\/+$/, "")),
            },
            { onSuccess: () => { toast({ title: "Widget saved" }); onOpenChange(false); }, onError: (e) => toast({ variant: "destructive", title: "Could not save widget", description: getApiErrorMessage(e) }) },
        ),
    );
    return (
        <Dialog open={open} onOpenChange={(o) => !update.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader><DialogTitle>Widget appearance</DialogTitle><DialogDescription>What visitors see on your website. Changes apply on their next page load.</DialogDescription></DialogHeader>
                        <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="Your organization name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="welcome_message" render={({ field }) => (<FormItem><FormLabel>Welcome message</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="color" render={({ field }) => (<FormItem><FormLabel>Brand colour</FormLabel><FormControl><Input placeholder="#2563eb" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="position" render={({ field }) => (
                                <FormItem><FormLabel>Position</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Position"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{WidgetPositionOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="require_email" render={({ field }) => (
                            <FormItem className="flex items-center justify-between gap-3 rounded-md border border-border p-3"><div><FormLabel>Ask for an email</FormLabel><FormDescription>Visitors must leave an email before the first message.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="allowed_origins" render={({ field }) => (<FormItem><FormLabel>Allowed sites</FormLabel><FormControl><Input placeholder="https://www.example.com" {...field} /></FormControl><FormDescription>Origins separated by commas. Empty = any site.</FormDescription></FormItem>)} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={update.isPending}>Cancel</Button>
                            <Button type="submit" loading={update.isPending}>Save</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
