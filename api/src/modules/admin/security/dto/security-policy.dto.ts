import { z } from 'zod';
import { InvitationPolicy, MfaPolicy } from 'generated/prisma';

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}(\/([0-9]|[12]\d|3[0-2]))?$/;
const DOMAIN = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const list = <T extends z.ZodTypeAny>(item: T, max = 100) => z.array(item).max(max);

/**
 * PATCH /security-policy — partial update of OrganizationSecurityPolicy (01 §72–74). Durations are minutes.
 * Same schema for REST and the MCP tool.
 */
export const UpdateSecurityPolicySchema = z
    .object({
        mfa_policy: z.nativeEnum(MfaPolicy),
        portal_mfa_policy: z.nativeEnum(MfaPolicy),
        password_min_length: z.number().int().min(8, 'Passwords must be at least 8 characters').max(128),
        password_require_symbols: z.boolean(),
        password_max_age_days: z.number().int().min(1).max(3650).nullable(),
        session_duration_minutes: z.number().int().min(15, 'Sessions must last at least 15 minutes').max(525600),
        idle_timeout_minutes: z.number().int().min(5).max(10080).nullable(),
        allowed_email_domains: list(z.string().trim().toLowerCase().regex(DOMAIN, 'Enter domains like agency.com')),
        restrict_invitations_to_domains: z.boolean(),
        allowed_ip_ranges: list(z.string().trim().regex(IPV4, 'Enter IPv4 addresses or CIDR ranges like 203.0.113.0/24')),
        allowed_countries: list(z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Use two-letter country codes (ISO 3166-1), e.g. GR'), 250),
        invitation_policy: z.nativeEnum(InvitationPolicy),
        members_can_view_sessions: z.boolean(),
        sso_required: z.boolean(),
    })
    .partial()
    .strict();

export type UpdateSecurityPolicyInput = z.infer<typeof UpdateSecurityPolicySchema>;
