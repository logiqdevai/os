/** Field types the CRM renders (api `SUPPORTED_FIELD_TYPES`, Prisma `CustomFieldType`). */
export type CustomFieldType =
    | "TEXT" | "LONG_TEXT" | "NUMBER" | "DECIMAL" | "CURRENCY" | "PERCENTAGE" | "BOOLEAN" | "DATE" | "DATETIME"
    | "EMAIL" | "PHONE" | "URL" | "DROPDOWN" | "MULTI_SELECT" | "RADIO" | "USER";

/** Record types that carry custom fields. */
export type CustomFieldEntity = "CRM_COMPANY" | "CRM_CONTACT" | "CRM_LEAD" | "CRM_DEAL";

export interface CustomFieldOption {
    value: string;
    label: string;
    color?: string;
}

export interface CustomFieldValidation {
    min?: number;
    max?: number;
    max_length?: number;
    pattern?: string;
}

export interface CustomFieldGroupRef {
    id: string;
    name: string;
    sort_order?: number;
}

export interface CustomFieldDefinition {
    id: string;
    key: string;
    label: string;
    description: string | null;
    type: CustomFieldType;
    entity_types: CustomFieldEntity[];
    is_shared: boolean;
    is_required: boolean;
    options: CustomFieldOption[] | null;
    default_value: unknown;
    validation: CustomFieldValidation | null;
    is_searchable: boolean;
    is_filterable: boolean;
    is_sortable: boolean;
    sort_order: number;
    group_id: string | null;
    group: CustomFieldGroupRef | null;
    archived_at: string | null;
    usage_count: number;
}

export interface CustomFieldGroup {
    id: string;
    name: string;
    description: string | null;
    sort_order: number;
    _count: { fields: number };
}

export interface CreateCustomFieldDto {
    key: string;
    label: string;
    description?: string | null;
    type: CustomFieldType;
    entity_types: CustomFieldEntity[];
    group_id?: string | null;
    is_required?: boolean;
    options?: CustomFieldOption[] | null;
    default_value?: unknown;
    validation?: CustomFieldValidation | null;
}
export type UpdateCustomFieldDto = Partial<Omit<CreateCustomFieldDto, "key">> & { id: string };

/** `{ key: value }` sent as `custom_fields` on create/update and returned on detail responses. */
export type CustomFieldValues = Record<string, unknown>;
