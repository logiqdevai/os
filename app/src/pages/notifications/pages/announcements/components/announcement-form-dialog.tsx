import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiPicker } from "@/components/ui/multi-picker";
import { NotificationPriorityFormOptions } from "@/config/constants/dropdowns/notifications/notification.options";
import { announcementFormSchema, type AnnouncementFormValues } from "@/features/notifications/validation-schemas/announcement.schema";
import { useAnnouncementAudienceOptions, useCreateAnnouncement, useUpdateAnnouncement } from "@/features/notifications/hooks/use-notifications";
import type { Announcement } from "@/features/notifications/interfaces/notifications.interfaces";

const toLocal = (iso: string | null | undefined) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "");
const toIso = (local: string | undefined) => (local ? new Date(local).toISOString() : null);

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    announcement?: Announcement | null;
}

/** Create / edit a draft or scheduled announcement. Audience: every member, or selected members / teams / branches (union). */
export function AnnouncementFormDialog({ open, onOpenChange, announcement }: Props) {
    const create = useCreateAnnouncement();
    const update = useUpdateAnnouncement();
    const options = useAnnouncementAudienceOptions(open);
    const form = useForm<AnnouncementFormValues>({
        resolver: zodResolver(announcementFormSchema),
        defaultValues: { title: "", body: "", severity: "NORMAL", requires_ack: false, audience_mode: "all", membership_ids: [], team_ids: [], branch_ids: [], publish_at: "", expires_at: "" },
    });

    useEffect(() => {
        if (open) {
            const a = announcement?.audience;
            form.reset({
                title: announcement?.title ?? "",
                body: announcement?.body ?? "",
                severity: announcement?.severity ?? "NORMAL",
                requires_ack: announcement?.requires_ack ?? false,
                audience_mode: a && (a.membership_ids?.length || a.team_ids?.length || a.branch_ids?.length) ? "custom" : "all",
                membership_ids: a?.membership_ids ?? [],
                team_ids: a?.team_ids ?? [],
                branch_ids: a?.branch_ids ?? [],
                publish_at: toLocal(announcement?.publish_at),
                expires_at: toLocal(announcement?.expires_at),
            });
        }
    }, [open, announcement, form]);

    const mode = form.watch("audience_mode");
    const pending = create.isPending || update.isPending;
    const submit = form.handleSubmit((v) => {
        const audience = v.audience_mode === "all" ? null : { membership_ids: v.membership_ids, team_ids: v.team_ids, branch_ids: v.branch_ids };
        const dto = { title: v.title, body: v.body, severity: v.severity, requires_ack: v.requires_ack, audience, publish_at: toIso(v.publish_at), expires_at: toIso(v.expires_at) };
        const options = { onSuccess: () => onOpenChange(false) };
        if (announcement) update.mutate({ id: announcement.id, ...dto }, options);
        else create.mutate(dto, options);
    });

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{announcement ? "Edit announcement" : "New announcement"}</DialogTitle>
                            <DialogDescription>Goes to the audience's inboxes when published. Leave “Publish at” empty to publish manually.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="title" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Title</FormLabel>
                                <FormControl><Input autoFocus placeholder="Planned maintenance on Saturday" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="body" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Message</FormLabel>
                                <FormControl><Textarea rows={5} {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="severity" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Severity</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Severity"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{NotificationPriorityFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="requires_ack" render={({ field }) => (
                                <FormItem className="flex flex-col justify-end">
                                    <FormLabel>Require acknowledgement</FormLabel>
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Require acknowledgement" /></FormControl>
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="audience_mode" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Audience</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl><SelectTrigger aria-label="Audience"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="all">Every member</SelectItem>
                                        <SelectItem value="custom">Selected members, teams or branches</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        {mode === "custom" && (
                            <div className="space-y-3 rounded-md border border-border bg-muted/40 p-3">
                                {options.isError && <p className="text-xs text-destructive">Could not load members, teams and branches.</p>}
                                <FormField control={form.control} name="membership_ids" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Members</FormLabel>
                                        <MultiPicker
                                            items={(options.data?.members ?? []).map((m) => ({ id: m.id, label: m.name, hint: m.email, keywords: m.email }))}
                                            value={field.value} onChange={field.onChange} loading={options.isLoading}
                                            placeholder="Add members" searchPlaceholder="Search members…" emptyText="No members found"
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="team_ids" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Teams</FormLabel>
                                        <MultiPicker
                                            items={(options.data?.teams ?? []).map((t) => ({ id: t.id, label: t.name, hint: `${t.member_count} member${t.member_count === 1 ? "" : "s"}` }))}
                                            value={field.value} onChange={field.onChange} loading={options.isLoading}
                                            placeholder="Add teams" searchPlaceholder="Search teams…" emptyText="No teams"
                                        />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="branch_ids" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Branches</FormLabel>
                                        <MultiPicker
                                            items={(options.data?.branches ?? []).map((b) => ({ id: b.id, label: b.name }))}
                                            value={field.value} onChange={field.onChange} loading={options.isLoading}
                                            placeholder="Add branches" searchPlaceholder="Search branches…" emptyText="No branches"
                                        />
                                        <FormDescription>Everyone who matches any selection receives it.</FormDescription>
                                    </FormItem>
                                )} />
                            </div>
                        )}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="publish_at" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Publish at</FormLabel>
                                    <FormControl><Input type="datetime-local" {...field} /></FormControl>
                                    <FormDescription>Optional schedule.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="expires_at" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Expires at</FormLabel>
                                    <FormControl><Input type="datetime-local" {...field} /></FormControl>
                                    <FormDescription>Removed from inboxes after.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{announcement ? "Save changes" : "Save draft"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
