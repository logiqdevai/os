import { z } from 'zod';
import { DomainVerificationStatus } from 'generated/prisma';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

const DOMAIN = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Accepts "https://www.Agency.com/path" style input and keeps only the host name. */
const domainField = z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => v.replace(/^[a-z]+:\/\//, '').replace(/\/.*$/, '').replace(/^@/, '').replace(/\.$/, ''))
    .refine((v) => DOMAIN.test(v), 'Enter a domain like agency.com (no protocol or path)');

export const CreateDomainSchema = z.object({
    domain: domainField,
    allow_discovery: z.boolean().optional(),
    auto_provision: z.boolean().optional(),
});
export type CreateDomainInput = z.infer<typeof CreateDomainSchema>;

export const UpdateDomainSchema = z.object({
    allow_discovery: z.boolean().optional(),
    auto_provision: z.boolean().optional(),
}).strict();
export type UpdateDomainInput = z.infer<typeof UpdateDomainSchema>;

export const DomainQuerySchema = BaseListQuerySchema.extend({
    status: z.nativeEnum(DomainVerificationStatus).optional(),
});
export type DomainQuery = z.infer<typeof DomainQuerySchema>;
