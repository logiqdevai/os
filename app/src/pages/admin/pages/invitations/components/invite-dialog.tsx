import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Info, MailCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSessionData } from "@/features/session/hooks/use-session";
import { usePermissions } from "@/hooks/use-permission";
import { useAssignableRoles } from "@/features/admin/roles/hooks/use-roles";
import { useTeams } from "@/features/admin/teams/hooks/use-teams";
import { useCreateInvitations } from "@/features/admin/invitations/hooks/use-invitations";
import type { InvitationSendResult } from "@/features/admin/invitations/interfaces/invitations.interfaces";
import { inviteFormSchema, parseEmails, type InviteFormValues } from "@/features/admin/invitations/validation-schemas/invitations.schema";
import { MembershipTypeFormOptions } from "@/config/constants/dropdowns/admin/membership-form.options";
import { InvitationExpiryOptions } from "@/config/constants/dropdowns/admin/access-form.options";
import type { ScopeType } from "@/config/constants/dropdowns/admin/scope-type-form.options";
import { toast } from "@/hooks/use-toast";
import { CopyField } from "../../../components/copy-field";
import { ScopeFields, scopeComplete } from "../../../components/scope-fields";

const NONE = "__none";

const defaults: InviteFormValues = { emails: "", type: "INTERNAL", role_id: NONE, branch_id: NONE, team_id: NONE, expires_in_days: "7", valid_until: "", message: "" };

/** Invite by email with role (+ scope), branch, team and expiry. Shows copyable links when no email could be sent. */
export function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const session = useSessionData();
    const p = usePermissions();
    const roles = useAssignableRoles(open && p.can("users.roles.read"));
    const teams = useTeams({ limit: 200 });
    const create = useCreateInvitations();
    const [scopeType, setScopeType] = useState<ScopeType>("ORGANIZATION");
    const [scopeId, setScopeId] = useState<string | undefined>();
    const [results, setResults] = useState<InvitationSendResult[] | null>(null);
    const form = useForm<InviteFormValues>({ resolver: zodResolver(inviteFormSchema), defaultValues: defaults });
    const roleId = form.watch("role_id");

    useEffect(() => {
        if (open) {
            form.reset(defaults);
            setScopeType("ORGANIZATION");
            setScopeId(undefined);
            setResults(null);
        }
    }, [open, form]);

    const submit = form.handleSubmit((v) => {
        if (v.role_id !== NONE && !scopeComplete(scopeType, scopeId)) {
            toast({ variant: "destructive", title: "Pick where the role applies" });
            return;
        }
        create.mutate(
            {
                emails: parseEmails(v.emails),
                type: v.type,
                ...(v.role_id !== NONE && { role_id: v.role_id, scope_type: scopeType, scope_id: scopeId }),
                ...(v.branch_id !== NONE && { branch_id: v.branch_id }),
                ...(v.team_id !== NONE && { team_id: v.team_id }),
                expires_in_days: Number(v.expires_in_days),
                ...(v.valid_until && { valid_until: new Date(`${v.valid_until}T23:59:59`).toISOString() }),
                ...(v.message && { message: v.message }),
            },
            // The dialog switches to the per-email results (links, already-member notes) instead of a toast.
            { onSuccess: (res) => setResults(res.results) }
        );
    });

    const external = !p.can("users.external_collaborators.manage");

    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                {results ? (
                    <div className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Invitations</DialogTitle>
                            <DialogDescription>Links are shown only now. Each link works once and only for its email address.</DialogDescription>
                        </DialogHeader>
                        <ul className="space-y-3">
                            {results.map((r) => (
                                <li key={r.email} className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-[13px]">
                                        {r.status === "invited" ? (r.email_sent ? <MailCheck className="size-4 text-success" /> : <CheckCircle2 className="size-4 text-info" />) : <Info className="size-4 text-muted-foreground" />}
                                        <span className="font-medium text-foreground">{r.email}</span>
                                        <span className="text-muted-foreground">
                                            {r.status === "already_member" ? "is already a member" : r.status === "already_invited" ? "already has a pending invitation" : r.email_sent ? "email sent" : "copy the link and send it yourself"}
                                        </span>
                                    </div>
                                    {r.invite_url && <CopyField value={r.invite_url} label={`invitation link for ${r.email}`} />}
                                </li>
                            ))}
                        </ul>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setResults(null)}>Invite more</Button>
                            <Button onClick={() => onOpenChange(false)}>Done</Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={submit} className="space-y-4">
                            <DialogHeader>
                                <DialogTitle>Invite people</DialogTitle>
                                <DialogDescription>They get an email with a link to join {session?.active_organization?.display_name}.</DialogDescription>
                            </DialogHeader>
                            <FormField control={form.control} name="emails" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email addresses</FormLabel>
                                    <FormControl><Textarea rows={3} autoFocus placeholder="ana@agency.com, nikos@agency.com" {...field} /></FormControl>
                                    <FormDescription>Separate several addresses with commas or new lines.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField control={form.control} name="type" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Type</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{MembershipTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id} disabled={o.id !== "INTERNAL" && external}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="role_id" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Role</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl><SelectTrigger aria-label="Role"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value={NONE}>No role yet</SelectItem>
                                                {roles.data?.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                            {roleId !== NONE && <ScopeFields label="Role applies to" scopeType={scopeType} scopeId={scopeId} onChange={(t, s) => { setScopeType(t); setScopeId(s); }} />}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField control={form.control} name="branch_id" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Branch</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl><SelectTrigger aria-label="Branch"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value={NONE}>No branch</SelectItem>
                                                {session?.branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="team_id" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Team</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl><SelectTrigger aria-label="Team"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value={NONE}>No team</SelectItem>
                                                {teams.data?.data.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="expires_in_days" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Link expires after</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl><SelectTrigger aria-label="Link expiry"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{InvitationExpiryOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="valid_until" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Access ends on</FormLabel>
                                        <FormControl><Input type="date" min={new Date().toISOString().slice(0, 10)} {...field} /></FormControl>
                                        <FormDescription>Optional, for temporary access.</FormDescription>
                                    </FormItem>
                                )} />
                            </div>
                            <FormField control={form.control} name="message" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Personal note</FormLabel>
                                    <FormControl><Textarea rows={2} placeholder="Optional, added to the email" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                                <Button type="submit" loading={create.isPending}>Send invitations</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    );
}
