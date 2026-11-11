import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, Copy, Info, Rocket, Save } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermission } from "@/hooks/use-permission";
import { useDeprecateRole, usePublishRole, useRole, useUpdateRole } from "@/features/admin/roles/hooks/use-roles";
import type { PermissionEffect } from "@/features/admin/roles/interfaces/roles.interfaces";
import { roleDetailsSchema, type RoleDetailsFormValues } from "@/features/admin/roles/validation-schemas/roles.schema";
import { RoleTypeFormOptions } from "@/config/constants/dropdowns/admin/access-form.options";
import { ScopeTypeFormOptions } from "@/config/constants/dropdowns/admin/scope-type-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { RoleStatusBadge } from "../../components/status-badges";
import { CreateRoleDialog } from "../roles/components/create-role-dialog";
import { PermissionMatrix } from "./components/permission-matrix";

/**
 * Role detail / editor — /admin/roles/:id
 * @perm VIEW users.roles.read · edit / publish / deprecate users.roles.manage (templates are read-only; clone them)
 * @api GET /roles/:id · PATCH /roles/:id · POST /roles/:id/publish · POST /roles/:id/deprecate
 */
export default function RoleDetailPage() {
    const { id } = useParams();
    const role = useRole(id);
    const canManage = usePermission("users.roles.manage");
    const update = useUpdateRole();
    const publish = usePublishRole();
    const deprecate = useDeprecateRole();
    const [perms, setPerms] = useState<Map<string, PermissionEffect>>(new Map());
    const [publishOpen, setPublishOpen] = useState(false);
    const [note, setNote] = useState("");
    const [deprecating, setDeprecating] = useState(false);
    const [cloneOpen, setCloneOpen] = useState(false);
    const form = useForm<RoleDetailsFormValues>({ resolver: zodResolver(roleDetailsSchema), defaultValues: { name: "", description: "", default_scope: "ORGANIZATION" } });

    const original = useMemo(() => new Map((role.data?.permissions ?? []).map((p) => [p.permission.key, p.effect] as const)), [role.data]);
    useEffect(() => {
        if (!role.data) return;
        setPerms(new Map(original));
        form.reset({ name: role.data.name, description: role.data.description ?? "", default_scope: role.data.default_scope });
    }, [role.data, original, form]);

    if (role.isPending) return <PageSkeleton />;
    if (role.error) return <Page><PageHeader title="Role" back={{ to: "/admin/roles", label: "Roles" }} /><ErrorState error={role.error} onRetry={() => role.refetch()} /></Page>;
    const r = role.data;
    const readOnly = !canManage || r.is_template || r.status === "DEPRECATED";
    const permsDirty = perms.size !== original.size || [...perms].some(([k, e]) => original.get(k) !== e);
    const dirty = permsDirty || form.formState.isDirty;

    const save = form.handleSubmit((v) =>
        update.mutate(
            { id: r.id, name: v.name, description: v.description, default_scope: v.default_scope, ...(permsDirty && { permissions: [...perms].map(([key, effect]) => ({ key, effect })) }) },
            { onSuccess: () => toast({ title: r.status === "PUBLISHED" ? "Role saved — changes apply right away" : "Draft saved" }), onError: (e) => toast({ variant: "destructive", title: "Could not save the role", description: getApiErrorMessage(e) }) }
        )
    );

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: "/admin/roles", label: "Roles" }}
                title={r.name}
                meta={<><RoleStatusBadge status={r.status} />{r.is_template ? <Badge variant="secondary">System template</Badge> : <Badge variant="info">Custom</Badge>}{r.version > 0 && <Badge variant="outline">v{r.version}</Badge>}</>}
                description={`${getDropdownOptionLabel(RoleTypeFormOptions, r.type)} role · ${perms.size} permissions · assigned ${r._count.assignments} time${r._count.assignments === 1 ? "" : "s"}${r.template ? ` · cloned from ${r.template.name}` : ""}`}
                actions={
                    <>
                        {canManage && r.type !== "CUSTOMER_PORTAL" && <Button variant="outline" onClick={() => setCloneOpen(true)}><Copy /> Clone</Button>}
                        {!readOnly && (
                            <>
                                {r.status === "PUBLISHED" && <Button variant="destructive" onClick={() => setDeprecating(true)}><Archive /> Deprecate</Button>}
                                <Button variant="outline" onClick={save} loading={update.isPending} disabled={!dirty}><Save /> Save</Button>
                                <Button onClick={() => { setNote(""); setPublishOpen(true); }} disabled={dirty}><Rocket /> Publish{r.status === "PUBLISHED" ? " new version" : ""}</Button>
                            </>
                        )}
                    </>
                }
            />

            {r.is_template && <Alert className="mb-4"><Info className="size-4" /><AlertDescription>System templates are maintained by Logiqdev and cannot be edited. Clone this template to adjust it for your organization.</AlertDescription></Alert>}
            {r.status === "DRAFT" && !r.is_template && <Alert className="mb-4"><Info className="size-4" /><AlertDescription>This role is a draft: it grants nothing until you publish it.{dirty ? " Save your changes first." : ""}</AlertDescription></Alert>}
            {r.status === "DEPRECATED" && <Alert className="mb-4"><Info className="size-4" /><AlertDescription>Deprecated: people who hold it keep it, but it cannot be assigned again.</AlertDescription></Alert>}

            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                <div className="space-y-6">
                    <Section title="Details">
                        <Form {...form}>
                            <form onSubmit={save} className="space-y-4 rounded-lg border border-border bg-card p-4">
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem><FormLabel>Name</FormLabel><FormControl><Input disabled={readOnly} {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="description" render={({ field }) => (
                                    <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={3} disabled={readOnly} {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="default_scope" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Usually assigned to</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                                            <FormControl><SelectTrigger aria-label="Default scope"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{ScopeTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                            </form>
                        </Form>
                    </Section>
                    {r.versions.length > 0 && (
                        <Section title="Published versions">
                            <ol className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                                {r.versions.map((v) => (
                                    <li key={v.id} className="px-4 py-2.5 text-[13px]">
                                        <div className="flex items-center justify-between gap-2"><span className="font-medium text-foreground">Version {v.version}</span><span className="text-xs text-muted-foreground">{formatDateTime(v.published_at)}</span></div>
                                        {v.note && <p className="text-xs text-muted-foreground">{v.note}</p>}
                                        {v.published_by && <p className="text-xs text-ash">by {v.published_by.user.display_name ?? v.published_by.user.email}</p>}
                                    </li>
                                ))}
                            </ol>
                        </Section>
                    )}
                </div>
                <Section title="Permissions" description={readOnly ? "What this role allows." : "Tick what this role allows. Use the ban icon for an explicit deny, which overrides every other role."}>
                    <PermissionMatrix value={perms} onChange={setPerms} readOnly={readOnly} original={new Set(original.keys())} />
                </Section>
            </div>

            <Dialog open={publishOpen} onOpenChange={(o) => !publish.isPending && setPublishOpen(o)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Publish {r.name}?</DialogTitle>
                        <DialogDescription>Everyone who holds this role gets exactly these permissions right away. A new version is recorded.</DialogDescription>
                    </DialogHeader>
                    <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed (optional)" aria-label="Version note" maxLength={500} />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setPublishOpen(false)} disabled={publish.isPending}>Cancel</Button>
                        <Button loading={publish.isPending} onClick={() => publish.mutate({ id: r.id, note: note || undefined }, { onSuccess: () => { toast({ title: "Role published" }); setPublishOpen(false); }, onError: (e) => toast({ variant: "destructive", title: "Could not publish", description: getApiErrorMessage(e) }) })}>Publish</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ConfirmationDialog
                isOpen={deprecating}
                onClose={() => setDeprecating(false)}
                title={`Deprecate ${r.name}?`}
                description="Current holders keep it, but it can no longer be assigned. Remove it from members to take access away."
                confirmText="Deprecate"
                variant="destructive"
                isLoading={deprecate.isPending}
                onConfirm={() => deprecate.mutate(r.id, { onSuccess: () => { toast({ title: "Role deprecated" }); setDeprecating(false); }, onError: (e) => toast({ variant: "destructive", title: "Could not deprecate", description: getApiErrorMessage(e) }) })}
            />
            <CreateRoleDialog open={cloneOpen} onOpenChange={setCloneOpen} templateId={r.id} />
        </Page>
    );
}
