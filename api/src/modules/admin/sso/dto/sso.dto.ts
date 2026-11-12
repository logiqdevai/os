import { z } from 'zod';
import { ModuleKey, SsoProtocol } from 'generated/prisma';

const url = z.string().trim().url('Enter a full URL starting with https://').max(2000);
const AttributeMappingSchema = z
    .object({
        email: z.string().trim().max(200).optional(),
        first_name: z.string().trim().max(200).optional(),
        last_name: z.string().trim().max(200).optional(),
        groups: z.string().trim().max(200).optional(),
    })
    .strict();

/** Public SAML settings (stored in SsoConfiguration.config). The IdP certificate is public, not a secret. */
export const SamlConfigSchema = z
    .object({
        idp_entity_id: z.string().trim().min(1).max(500),
        sso_url: url,
        certificate: z.string().trim().max(20000).refine((v) => v.includes('BEGIN CERTIFICATE'), 'Paste the X.509 certificate in PEM format (-----BEGIN CERTIFICATE-----)'),
        metadata_url: url.optional(),
        attribute_mapping: AttributeMappingSchema.optional(),
    })
    .strict();

/** Public OIDC settings. The client secret travels separately in `secrets` and is stored encrypted. */
export const OidcConfigSchema = z
    .object({
        issuer: url,
        client_id: z.string().trim().min(1).max(500),
        discovery_url: url.optional(),
        scopes: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
        attribute_mapping: AttributeMappingSchema.optional(),
    })
    .strict();

/** Write-only fields: encrypted with secret-box, never returned (only a hint). */
export const SsoSecretsSchema = z.object({ client_secret: z.string().min(1).max(2000).optional() }).strict();

const common = {
    name: z.string().trim().min(1).max(120),
    auto_provision: z.boolean().optional(),
    secrets: SsoSecretsSchema.optional(),
};

export const CreateSsoConfigurationSchema = z.discriminatedUnion('protocol', [
    z.object({ protocol: z.literal(SsoProtocol.SAML), config: SamlConfigSchema, ...common }),
    z.object({ protocol: z.literal(SsoProtocol.OIDC), config: OidcConfigSchema, ...common }),
]);
export type CreateSsoConfigurationInput = z.infer<typeof CreateSsoConfigurationSchema>;

/** The protocol cannot change; `config` replaces the public settings as a whole (validated against the stored protocol). */
export const UpdateSsoConfigurationSchema = z
    .object({
        name: common.name.optional(),
        auto_provision: z.boolean().optional(),
        config: z.record(z.string(), z.unknown()).optional(),
        secrets: SsoSecretsSchema.optional(),
    })
    .strict();
export type UpdateSsoConfigurationInput = z.infer<typeof UpdateSsoConfigurationSchema>;

export const GroupMappingSchema = z
    .object({
        external_group: z.string().trim().min(1).max(200),
        role_id: z.string().uuid().nullable().optional(),
        team_id: z.string().uuid().nullable().optional(),
        branch_id: z.string().uuid().nullable().optional(),
        modules: z.array(z.nativeEnum(ModuleKey)).max(40).optional(),
    })
    .strict();
export type GroupMappingInput = z.infer<typeof GroupMappingSchema>;
export const UpdateGroupMappingSchema = GroupMappingSchema.partial();
export type UpdateGroupMappingInput = z.infer<typeof UpdateGroupMappingSchema>;
