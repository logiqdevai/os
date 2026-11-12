import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SsoProtocolFormOptions } from "@/config/constants/dropdowns/admin/sso-form.options";
import { ssoProviderFormSchema, type SsoProviderFormValues } from "@/features/admin/sso/validation-schemas/sso.schema";
import { useCreateSsoConfiguration, useUpdateSsoConfiguration } from "@/features/admin/sso/hooks/use-sso";
import type { SaveSsoConfigurationDto, SsoConfiguration } from "@/features/admin/sso/interfaces/sso.interfaces";

interface ProviderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    provider?: SsoConfiguration | null;
}

const blank: SsoProviderFormValues = {
    name: "", protocol: "SAML", auto_provision: false, idp_entity_id: "", sso_url: "", certificate: "", metadata_url: "",
    issuer: "", client_id: "", discovery_url: "", client_secret: "", email_attribute: "", groups_attribute: "", has_secret: false,
};

/** Add / edit an identity provider. The client secret is write-only: empty on edit keeps the stored one. */
export function ProviderDialog({ open, onOpenChange, provider }: ProviderDialogProps) {
    const create = useCreateSsoConfiguration();
    const update = useUpdateSsoConfiguration();
    const form = useForm<SsoProviderFormValues>({ resolver: zodResolver(ssoProviderFormSchema), defaultValues: blank });
    const protocol = form.watch("protocol");

    useEffect(() => {
        if (!open) return;
        const c = provider?.config ?? {};
        form.reset(
            provider
                ? {
                    ...blank,
                    name: provider.name,
                    protocol: provider.protocol,
                    auto_provision: provider.auto_provision,
                    idp_entity_id: c.idp_entity_id ?? "",
                    sso_url: c.sso_url ?? "",
                    certificate: c.certificate ?? "",
                    metadata_url: c.metadata_url ?? "",
                    issuer: c.issuer ?? "",
                    client_id: c.client_id ?? "",
                    discovery_url: c.discovery_url ?? "",
                    email_attribute: c.attribute_mapping?.email ?? "",
                    groups_attribute: c.attribute_mapping?.groups ?? "",
                    has_secret: !!provider.secret_hints.client_secret,
                }
                : blank
        );
    }, [open, provider, form]);

    const pending = create.isPending || update.isPending;

    const submit = form.handleSubmit((v) => {
        const mapping = { ...(v.email_attribute && { email: v.email_attribute }), ...(v.groups_attribute && { groups: v.groups_attribute }) };
        const attribute_mapping = Object.keys(mapping).length ? mapping : undefined;
        const dto: SaveSsoConfigurationDto =
            v.protocol === "SAML"
                ? { name: v.name, protocol: "SAML", auto_provision: v.auto_provision, config: { idp_entity_id: v.idp_entity_id, sso_url: v.sso_url, certificate: v.certificate, ...(v.metadata_url && { metadata_url: v.metadata_url }), attribute_mapping } }
                : {
                    name: v.name,
                    protocol: "OIDC",
                    auto_provision: v.auto_provision,
                    config: { issuer: v.issuer, client_id: v.client_id, ...(v.discovery_url && { discovery_url: v.discovery_url }), attribute_mapping },
                    ...(v.client_secret && { secrets: { client_secret: v.client_secret } }),
                };
        const options = {
            onSuccess: () => { form.setValue("client_secret", ""); onOpenChange(false); },
            onError: () => form.setValue("client_secret", ""), // the global error toast explains why
        };
        if (provider) update.mutate({ id: provider.id, ...dto }, options);
        else create.mutate(dto, options);
    });

    const text = (name: keyof SsoProviderFormValues, label: string, props: { placeholder?: string; description?: string; type?: string } = {}) => (
        <FormField control={form.control} name={name} render={({ field }) => (
            <FormItem>
                <FormLabel>{label}</FormLabel>
                <FormControl><Input type={props.type} autoComplete="off" placeholder={props.placeholder} {...field} value={(field.value as string) ?? ""} /></FormControl>
                {props.description && <FormDescription>{props.description}</FormDescription>}
                <FormMessage />
            </FormItem>
        )} />
    );

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{provider ? `Edit ${provider.name}` : "Add identity provider"}</DialogTitle>
                            <DialogDescription>Settings from your identity provider (Okta, Entra ID, Google Workspace…). Secrets are encrypted and never shown again.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {text("name", "Name", { placeholder: "Okta" })}
                            <FormField control={form.control} name="protocol" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Protocol</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange} disabled={!!provider}>
                                        <FormControl><SelectTrigger aria-label="Protocol"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{SsoProtocolFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                    {provider && <FormDescription>Cannot change after creation.</FormDescription>}
                                </FormItem>
                            )} />
                        </div>
                        {protocol === "SAML" ? (
                            <>
                                {text("idp_entity_id", "IdP entity ID", { placeholder: "http://www.okta.com/exk…" })}
                                {text("sso_url", "Sign-in URL", { placeholder: "https://agency.okta.com/app/…/sso/saml" })}
                                <FormField control={form.control} name="certificate" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>IdP certificate (X.509, PEM)</FormLabel>
                                        <FormControl><Textarea rows={4} className="font-mono text-xs" placeholder="-----BEGIN CERTIFICATE-----" {...field} /></FormControl>
                                        <FormDescription>Public certificate used to check signatures. Not a secret.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                {text("metadata_url", "Metadata URL (optional)")}
                            </>
                        ) : (
                            <>
                                {text("issuer", "Issuer URL", { placeholder: "https://accounts.google.com" })}
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {text("client_id", "Client ID")}
                                    {text("client_secret", "Client secret", {
                                        type: "password",
                                        placeholder: form.getValues("has_secret") ? `Stored (${provider?.secret_hints.client_secret ?? "hidden"}) · leave empty to keep` : "",
                                        description: "Write-only. Encrypted at rest.",
                                    })}
                                </div>
                                {text("discovery_url", "Discovery URL (optional)", { placeholder: "https://…/.well-known/openid-configuration" })}
                            </>
                        )}
                        <div className="grid gap-4 sm:grid-cols-2">
                            {text("email_attribute", "Email attribute (optional)", { placeholder: "email" })}
                            {text("groups_attribute", "Groups attribute (optional)", { placeholder: "groups" })}
                        </div>
                        <FormField control={form.control} name="auto_provision" render={({ field }) => (
                            <FormItem className="flex items-start justify-between gap-4 space-y-0">
                                <div>
                                    <FormLabel>Auto-provision members</FormLabel>
                                    <FormDescription>Create a membership on first SSO sign-in from a verified domain, using the group mappings.</FormDescription>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{provider ? "Save" : "Add provider"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
