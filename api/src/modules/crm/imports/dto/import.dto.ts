import { z } from 'zod';
import { CrmImportStatus } from 'generated/prisma';
import { BaseListQuerySchema, csv } from '@/shared/utils/pagination/pagination.utils';

export const IMPORT_ENTITIES = ['CRM_COMPANY', 'CRM_CONTACT', 'CRM_LEAD', 'CRM_DEAL'] as const;

export const ImportEntitySchema = z.enum(IMPORT_ENTITIES);

/** How rows that match an existing record are handled (02 §22). */
export const DuplicateStrategySchema = z.object({
    mode: z.enum(['skip', 'update', 'create']).default('skip'),
    /** Match key from `MATCH_KEYS` (email, domain, vat_number, name). */
    match_key: z.string().max(40).default('name'),
});
export type DuplicateStrategy = z.infer<typeof DuplicateStrategySchema>;

export const ImportMappingSchema = z.object({
    /** CSV header → field key (`name`, `email`, … or `cf:<custom field key>`); missing/empty = ignored. */
    field_mapping: z.record(z.string(), z.string().max(80)),
    duplicate_strategy: DuplicateStrategySchema,
    /** Also save this mapping for later imports under this name (CrmImportMapping). */
    save_as: z.string().trim().min(1).max(80).optional(),
});
export type ImportMappingInput = z.infer<typeof ImportMappingSchema>;

export const ImportQuerySchema = BaseListQuerySchema.extend({
    entity_type: ImportEntitySchema.optional(),
    status: csv(z.nativeEnum(CrmImportStatus)),
});
export type ImportQuery = z.infer<typeof ImportQuerySchema>;

export const ImportFieldsQuerySchema = z.object({ entity_type: ImportEntitySchema });
