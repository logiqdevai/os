import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermission } from "@/hooks/use-permission";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { useAddChannelMembers, useAutosaveChannel, useChannelSources, useChannelMembers, useCreateChannel, useOpenDm, useRemoveChannelMember } from "@/features/messaging/hooks/use-messaging";
import { SaveStatus } from "@/components/ui/save-status";
import { useFormAutosave } from "@/hooks/use-autosave";
import type { ChannelDetail, ChannelMemberRow } from "@/features/messaging/interfaces/messaging.interfaces";
import { ChannelMemberRoleOptions, CreatableChannelKindOptions } from "@/config/constants/dropdowns/messaging/messaging.options";
import { MessagesPaths } from "../messages-paths";
import { PeoplePicker } from "./people-picker";
import { PersonAvatar } from "./person-avatar";
import { useMessaging } from "./messaging-context";

const channelSchema = z.object({
    name: z.string().trim().min(1, "Give the channel a name").max(80).regex(/^[^#\s].*$/, "Leave out the #"),
    kind: z.enum(["PUBLIC", "PRIVATE"]),
    description: z.string().trim().max(500).optional(),
});
type ChannelFormValues = z.infer<typeof channelSchema>;
const NONE = "none";

/** Create a public or private channel and invite people. @perm messaging.channels.create */
export function CreateChannelDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const navigate = useNavigate();
    const create = useCreateChannel();
    const [members, setMembers] = useState<string[]>([]);
    const [teamId, setTeamId] = useState(NONE);
    const [projectId, setProjectId] = useState(NONE);
    const sources = useChannelSources(open);
    const form = useForm<ChannelFormValues>({ resolver: zodResolver(channelSchema), defaultValues: { name: "", kind: "PUBLIC", description: "" } });
    useEffect(() => {
        if (open) { form.reset(); setMembers([]); setTeamId(NONE); setProjectId(NONE); }
    }, [open, form]);
    /** Picking a team / project selects all its people; changing it takes back only the people it added. */
    const pickSource = (kind: "team" | "project", id: string) => {
        const list = kind === "team" ? sources.data?.teams : sources.data?.projects;
        const previous = kind === "team" ? teamId : projectId;
        const idsOf = (x: string) => list?.find((s) => s.id === x)?.member_ids ?? [];
        const otherIds = kind === "team" ? sources.data?.projects.find((s) => s.id === projectId)?.member_ids ?? [] : sources.data?.teams.find((s) => s.id === teamId)?.member_ids ?? [];
        const removed = idsOf(previous).filter((m) => !otherIds.includes(m) && !idsOf(id).includes(m));
        setMembers((cur) => [...new Set([...cur.filter((m) => !removed.includes(m)), ...(id === NONE ? [] : idsOf(id))])]);
        (kind === "team" ? setTeamId : setProjectId)(id);
    };
    const submit = form.handleSubmit((v) =>
        create.mutate({ name: v.name, kind: v.kind, description: v.description || undefined, membership_ids: members, team_id: teamId === NONE ? undefined : teamId, project_id: projectId === NONE ? undefined : projectId }, {
            onSuccess: (c) => { onOpenChange(false); navigate(MessagesPaths.channel(c.id)); },
        }),
    );
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Create a channel</DialogTitle>
                            <DialogDescription>Channels are where your team talks about a topic, a client or a project.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">#</span>
                                        <Input autoFocus className="pl-6" placeholder="design-reviews" {...field} />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="kind" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Visibility</FormLabel>
                                <FormControl>
                                    <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2 sm:grid-cols-2">
                                        {CreatableChannelKindOptions.map((o) => (
                                            <label key={o.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 has-[[data-state=checked]]:border-primary">
                                                <RadioGroupItem value={o.id} className="mt-0.5" />
                                                <span><span className="block text-[13px] font-medium text-foreground">{o.label}</span><span className="text-xs text-muted-foreground">{o.description}</span></span>
                                            </label>
                                        ))}
                                    </RadioGroup>
                                </FormControl>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} placeholder="What is this channel about?" {...field} value={field.value ?? ""} /></FormControl><FormDescription>Optional.</FormDescription></FormItem>
                        )} />
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <div className="text-[13px] font-medium text-foreground">Team</div>
                                <Select value={teamId} onValueChange={(v) => pickSource("team", v)}>
                                    <SelectTrigger aria-label="Team"><SelectValue placeholder="No team" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NONE}>No team</SelectItem>
                                        {(sources.data?.teams ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.member_ids.length})</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            {(sources.data?.projects.length ?? 0) > 0 && (
                                <div className="space-y-1.5">
                                    <div className="text-[13px] font-medium text-foreground">Project</div>
                                    <Select value={projectId} onValueChange={(v) => pickSource("project", v)}>
                                        <SelectTrigger aria-label="Project"><SelectValue placeholder="No project" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={NONE}>No project</SelectItem>
                                            {(sources.data?.projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ""}{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <div className="text-[13px] font-medium text-foreground">Add people</div>
                            <PeoplePicker selected={members} onChange={setMembers} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                            <Button type="submit" loading={create.isPending}>Create channel</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

/** Start a direct or group message. @perm messaging.messages.post · @api POST /messaging/dms */
export function NewDmDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const navigate = useNavigate();
    const openDm = useOpenDm();
    const [people, setPeople] = useState<string[]>([]);
    useEffect(() => { if (open) setPeople([]); }, [open]);
    const start = () =>
        openDm.mutate(people, {
            onSuccess: (c) => { onOpenChange(false); navigate(MessagesPaths.channel(c.id)); },
        });
    return (
        <Dialog open={open} onOpenChange={(o) => !openDm.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>New message</DialogTitle>
                    <DialogDescription>Pick one person for a direct message, or several for a group conversation.</DialogDescription>
                </DialogHeader>
                <PeoplePicker selected={people} onChange={setPeople} />
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={openDm.isPending}>Cancel</Button>
                    <Button onClick={start} loading={openDm.isPending} disabled={!people.length}>{people.length > 1 ? "Start group conversation" : "Open conversation"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Channel members list with add / remove (messaging.channel_members.manage) and edit details for channel managers. */
export function ChannelMembersDialog({ channel, open, onOpenChange }: { channel: ChannelDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
    const { presenceOf } = useMessaging();
    const canManageMembers = usePermission("messaging.channel_members.manage");
    const members = useChannelMembers(channel.id, open);
    const add = useAddChannelMembers();
    const remove = useRemoveChannelMember();
    const [adding, setAdding] = useState<string[] | null>(null);
    const [removing, setRemoving] = useState<ChannelMemberRow | null>(null);
    const isDm = channel.kind === "DIRECT" || channel.kind === "GROUP_DIRECT";
    const canEditMembers = canManageMembers && !isDm && (channel.can_manage || channel.kind === "PUBLIC");
    const existing = (members.data?.data ?? []).map((m) => m.membership_id).filter((x): x is string => !!x);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{isDm ? "People in this conversation" : `Members of #${channel.name}`}</DialogTitle>
                    <DialogDescription>{channel.member_count} {channel.member_count === 1 ? "member" : "members"}</DialogDescription>
                </DialogHeader>
                {adding ? (
                    <div className="space-y-3">
                        <PeoplePicker selected={adding} onChange={setAdding} exclude={existing} />
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setAdding(null)} disabled={add.isPending}>Back</Button>
                            <Button
                                loading={add.isPending}
                                disabled={!adding.length}
                                onClick={() => add.mutate({ id: channel.id, membership_ids: adding }, { onSuccess: () => setAdding(null) })}
                            >
                                Add {adding.length || ""}
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <>
                        {canEditMembers && <Button variant="outline" size="sm" className="w-fit" onClick={() => setAdding([])}><UserPlus /> Add people</Button>}
                        {members.isPending ? (
                            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                        ) : members.error ? (
                            <ErrorState error={members.error} onRetry={() => members.refetch()} />
                        ) : (
                            <ul className="max-h-80 divide-y divide-border-soft overflow-y-auto rounded-lg border border-border">
                                {members.data.data.map((m) => (
                                    <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                                        <PersonAvatar name={m.name} src={m.profile_photo_url} presence={m.membership_id ? presenceOf(m.membership_id) : undefined} />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-[13px] font-medium text-foreground">{m.name}</div>
                                            <div className="truncate text-xs text-muted-foreground">{m.external ? m.external_label ?? "External" : m.job_title ?? m.email}</div>
                                        </div>
                                        {m.role !== "MEMBER" && <Badge variant={m.role === "OWNER" ? "violet" : "neutral"}>{getDropdownOptionLabel(ChannelMemberRoleOptions, m.role)}</Badge>}
                                        {canEditMembers && m.role !== "OWNER" && (
                                            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${m.name}`} onClick={() => setRemoving(m)}><Trash2 /></Button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
                <ConfirmationDialog
                    isOpen={!!removing}
                    onClose={() => setRemoving(null)}
                    title={`Remove ${removing?.name}?`}
                    description="They lose access to this channel's messages."
                    confirmText="Remove"
                    variant="destructive"
                    onConfirm={() => { if (!removing) return; remove.mutate({ id: channel.id, member_id: removing.id }); setRemoving(null); }}
                />
            </DialogContent>
        </Dialog>
    );
}

const detailsSchema = z.object({ topic: z.string().trim().max(250).optional(), description: z.string().trim().max(500).optional() });
type DetailsValues = z.infer<typeof detailsSchema>;

/** Edit topic / description (channel owners and admins). Saves as you type (no Save button); the header updates at once. */
export function ChannelDetailsDialog({ channel, open, onOpenChange }: { channel: ChannelDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
    const update = useAutosaveChannel();
    const form = useForm<DetailsValues>({ resolver: zodResolver(detailsSchema), defaultValues: { topic: "", description: "" } });
    useEffect(() => {
        if (open) form.reset({ topic: channel.topic ?? "", description: channel.description ?? "" });
        // Only when the dialog opens: the header refresh after each save must not reset typing.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, channel.id, form]);
    const autosave = useFormAutosave(form, (v) => update.mutateAsync({ id: channel.id, topic: v.topic ?? "", description: v.description ?? "" }), { enabled: open });
    const close = () => { autosave.flush(); onOpenChange(false); };
    const submit = form.handleSubmit(close);
    return (
        <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : close())}>
            <DialogContent className="sm:max-w-md">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader><DialogTitle className="flex flex-wrap items-center gap-2">Edit #{channel.name} <SaveStatus state={autosave} className="font-normal" /></DialogTitle><DialogDescription>The topic shows in the channel header.</DialogDescription></DialogHeader>
                        <FormField control={form.control} name="topic" render={({ field }) => (
                            <FormItem><FormLabel>Topic</FormLabel><FormControl><Input placeholder="Sprint 14 · release Friday" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={3} {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="submit">Done</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
