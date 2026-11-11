import { BadRequestException } from '@nestjs/common';
import { Prisma } from 'generated/prisma';

/** CRM fields a customer may propose to change (07 §2). Anything else is rejected. */
export const COMPANY_EDITABLE = ['name', 'legal_name', 'website', 'email', 'phone', 'vat_number', 'tax_id', 'registration_number', 'address'] as const;
export const CONTACT_EDITABLE = ['first_name', 'last_name', 'job_title', 'email', 'phone', 'mobile'] as const;

export type ChangeSet = Record<string, { from: unknown; to: unknown }>;

/** Build the `{ field: { from, to } }` diff for the allowed fields; throws on unknown fields. */
export function buildChangeSet(current: Record<string, unknown>, proposed: Record<string, unknown>, allowed: readonly string[]): ChangeSet {
    const out: ChangeSet = {};
    for (const [k, v] of Object.entries(proposed)) {
        if (!allowed.includes(k)) throw new BadRequestException({ message: `Field "${k}" cannot be changed from the portal`, code: 'profile_field_not_allowed' });
        if (k !== 'address' && v !== null && typeof v !== 'string') throw new BadRequestException({ message: `Field "${k}" must be text`, code: 'profile_field_invalid' });
        if (typeof v === 'string' && v.length > 500) throw new BadRequestException({ message: `Field "${k}" is too long`, code: 'profile_field_invalid' });
        if (JSON.stringify(current[k] ?? null) !== JSON.stringify(v ?? null)) out[k] = { from: current[k] ?? null, to: v ?? null };
    }
    if (!Object.keys(out).length) throw new BadRequestException({ message: 'Nothing changed', code: 'profile_no_changes' });
    return out;
}

/** Write an approved / auto-applied change to the CRM Company or Contact (owned by 02). */
export async function applyChangeSet(tx: Prisma.TransactionClient, req: { organization_id: string; company_id: string; contact_id: string | null; changes: Prisma.JsonValue }) {
    const changes = (req.changes ?? {}) as ChangeSet;
    const data = Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.to]));
    if (req.contact_id) {
        const safe = Object.fromEntries(Object.entries(data).filter(([k]) => (CONTACT_EDITABLE as readonly string[]).includes(k)));
        await tx.crmContact.updateMany({ where: { id: req.contact_id, organization_id: req.organization_id }, data: safe as Prisma.CrmContactUpdateManyMutationInput });
    } else {
        const safe = Object.fromEntries(Object.entries(data).filter(([k]) => (COMPANY_EDITABLE as readonly string[]).includes(k)));
        await tx.crmCompany.updateMany({ where: { id: req.company_id, organization_id: req.organization_id }, data: safe as Prisma.CrmCompanyUpdateManyMutationInput });
    }
}
