import { z } from 'zod';
import { CustomFieldType, RecordEntityType } from 'generated/prisma';

/** CRM record types that carry custom fields (02 §24). */
export const CUSTOM_FIELD_ENTITIES = [RecordEntityType.CRM_COMPANY, RecordEntityType.CRM_CONTACT, RecordEntityType.CRM_LEAD, RecordEntityType.CRM_DEAL] as const;
export type CustomFieldEntity = (typeof CUSTOM_FIELD_ENTITIES)[number];

/** Field types the CRM forms can render and the API can validate (02 §24). Reference types (team/company/contact/deal) come later. */
export const SUPPORTED_FIELD_TYPES = [
    CustomFieldType.TEXT, CustomFieldType.LONG_TEXT, CustomFieldType.NUMBER, CustomFieldType.DECIMAL, CustomFieldType.CURRENCY,
    CustomFieldType.PERCENTAGE, CustomFieldType.BOOLEAN, CustomFieldType.DATE, CustomFieldType.DATETIME, CustomFieldType.EMAIL,
    CustomFieldType.PHONE, CustomFieldType.URL, CustomFieldType.DROPDOWN, CustomFieldType.MULTI_SELECT, CustomFieldType.RADIO, CustomFieldType.USER,
] as const;
export const OPTION_TYPES: CustomFieldType[] = [CustomFieldType.DROPDOWN, CustomFieldType.MULTI_SELECT, CustomFieldType.RADIO];

const EntitySchema = z.enum(CUSTOM_FIELD_ENTITIES);

export const FieldOptionSchema = z.object({
    value: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(120),
    color: z.string().max(20).optional(),
});

export const FieldValidationSchema = z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    max_length: z.number().int().min(1).max(10000).optional(),
    pattern: z.string().max(200).optional(),
}).partial();

export const CreateCustomFieldSchema = z.object({
    /** Stable API identifier (02 §26): snake_case, immutable after create. */
    key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,49}$/, 'Use snake_case: a letter, then letters, digits or underscores (2–50 characters)'),
    label: z.string().trim().min(1).max(120),
    description: z.string().max(500).optional().nullable(),
    type: z.enum(SUPPORTED_FIELD_TYPES),
    /** More than one entity type = a shared field (02 §25). */
    entity_types: z.array(EntitySchema).min(1),
    group_id: z.string().uuid().optional().nullable(),
    is_required: z.boolean().optional(),
    options: z.array(FieldOptionSchema).max(200).optional().nullable(),
    default_value: z.unknown().optional(),
    validation: FieldValidationSchema.optional().nullable(),
    is_searchable: z.boolean().optional(),
    is_filterable: z.boolean().optional(),
    is_sortable: z.boolean().optional(),
    sort_order: z.number().int().min(0).max(10000).optional(),
});
export type CreateCustomFieldInput = z.infer<typeof CreateCustomFieldSchema>;

export const UpdateCustomFieldSchema = CreateCustomFieldSchema.omit({ key: true }).partial();
export type UpdateCustomFieldInput = z.infer<typeof UpdateCustomFieldSchema>;

export const CustomFieldQuerySchema = z.object({
    entity_type: EntitySchema.optional(),
    include_archived: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
});
export type CustomFieldQuery = z.infer<typeof CustomFieldQuerySchema>;

export const ReorderFieldsSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

export const CreateFieldGroupSchema = z.object({
    name: z.string().trim().min(1).max(80),
    description: z.string().max(300).optional().nullable(),
    sort_order: z.number().int().min(0).max(10000).optional(),
});
export const UpdateFieldGroupSchema = CreateFieldGroupSchema.partial();
export type CreateFieldGroupInput = z.infer<typeof CreateFieldGroupSchema>;
export type UpdateFieldGroupInput = z.infer<typeof UpdateFieldGroupSchema>;

/** `custom_fields` on create/update of a company, contact, lead or deal: `{ <key>: value | null }`. */
export const CustomFieldValuesSchema = z.record(z.string(), z.unknown());
export type CustomFieldValuesInput = z.infer<typeof CustomFieldValuesSchema>;

export const SetValuesSchema = z.object({
    entity_type: EntitySchema,
    entity_id: z.string().uuid(),
    values: CustomFieldValuesSchema,
});
