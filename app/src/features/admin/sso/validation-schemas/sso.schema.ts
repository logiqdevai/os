import { z } from "zod";

const optionalUrl = z.string().trim().refine((v) => !v || /^https?:\/\/\S+$/.test(v), "Enter a full URL starting with https://");

/** Identity provider form (one form for both protocols; required fields depend on the protocol). */
export const ssoProviderFormSchema = z
    .object({
        name: z.string().trim().min(1, "Enter a name").max(120),
        protocol: z.enum(["SAML", "OIDC"]),
        auto_provision: z.boolean(),
        idp_entity_id: z.string().trim().max(500),
        sso_url: optionalUrl,
        certificate: z.string().trim().max(20000),
        metadata_url: optionalUrl,
        issuer: optionalUrl,
        client_id: z.string().trim().max(500),
        discovery_url: optionalUrl,
        client_secret: z.string().max(2000),
        email_attribute: z.string().trim().max(200),
        groups_attribute: z.string().trim().max(200),
        /** Edit mode: a client secret is already stored, so the field may stay empty. */
        has_secret: z.boolean(),
    })
    .superRefine((v, ctx) => {
        const need = (field: keyof typeof v, message: string) => {
            if (!String(v[field] ?? "").trim()) ctx.addIssue({ code: "custom", path: [field], message });
        };
        if (v.protocol === "SAML") {
            need("idp_entity_id", "Enter the IdP entity ID");
            need("sso_url", "Enter the sign-in URL");
            need("certificate", "Paste the IdP certificate");
            if (v.certificate && !v.certificate.includes("BEGIN CERTIFICATE")) ctx.addIssue({ code: "custom", path: ["certificate"], message: "Use PEM format (-----BEGIN CERTIFICATE-----)" });
        } else {
            need("issuer", "Enter the issuer URL");
            need("client_id", "Enter the client ID");
            if (!v.has_secret) need("client_secret", "Enter the client secret");
        }
    });
export type SsoProviderFormValues = z.infer<typeof ssoProviderFormSchema>;

export const groupMappingFormSchema = z.object({
    external_group: z.string().trim().min(1, "Enter the group name from your identity provider").max(200),
    role_id: z.string(),
    team_id: z.string(),
    branch_id: z.string(),
    modules: z.array(z.string()),
});
export type GroupMappingFormValues = z.infer<typeof groupMappingFormSchema>;
