import { z } from 'zod';

/**
 * Segment definition (Segment.definition) — a filter tree over CRM contacts (02), evaluated at send time:
 *   { and: [ { field: 'company.type', op: 'eq', value: 'CUSTOMER' }, { or: [ ... ] } ] }
 * Fields and operators are whitelisted below; the UI builder reads the same catalog from GET /communications/segments/fields.
 */
export const SEGMENT_OPS = [
    'eq', 'neq', 'in', 'not_in', 'contains', 'not_contains', 'starts_with', 'is_set', 'is_not_set',
    'before', 'after', 'within_days', 'older_than_days', 'has', 'not_has',
] as const;
export type SegmentOp = (typeof SEGMENT_OPS)[number];

export interface SegmentRule {
    field: string;
    op: SegmentOp;
    value?: unknown;
}
export interface SegmentGroup {
    and?: SegmentNode[];
    or?: SegmentNode[];
}
export type SegmentNode = SegmentRule | SegmentGroup;

const RuleSchema = z.object({ field: z.string().min(1).max(80), op: z.enum(SEGMENT_OPS), value: z.unknown().optional() });
export const SegmentNodeSchema: z.ZodType<SegmentNode> = z.lazy(() =>
    z.union([RuleSchema, z.object({ and: z.array(SegmentNodeSchema).max(50).optional(), or: z.array(SegmentNodeSchema).max(50).optional() })]),
) as z.ZodType<SegmentNode>;

export type FieldType = 'string' | 'enum' | 'id' | 'date' | 'array' | 'tag' | 'consent';

export interface SegmentField {
    key: string;
    label: string;
    type: FieldType;
    group: string;
    options?: string[];
    ops: SegmentOp[];
}

const STRING_OPS: SegmentOp[] = ['eq', 'neq', 'contains', 'not_contains', 'starts_with', 'is_set', 'is_not_set'];
const ENUM_OPS: SegmentOp[] = ['eq', 'neq', 'in', 'not_in', 'is_set', 'is_not_set'];
const ID_OPS: SegmentOp[] = ['eq', 'neq', 'in', 'not_in', 'is_set', 'is_not_set'];
const DATE_OPS: SegmentOp[] = ['before', 'after', 'within_days', 'older_than_days', 'is_set', 'is_not_set'];

/** Fields a CRM_CONTACT segment can filter on. */
export const CONTACT_FIELDS: SegmentField[] = [
    { key: 'first_name', label: 'First name', type: 'string', group: 'Contact', ops: STRING_OPS },
    { key: 'last_name', label: 'Last name', type: 'string', group: 'Contact', ops: STRING_OPS },
    { key: 'email', label: 'Email', type: 'string', group: 'Contact', ops: STRING_OPS },
    { key: 'mobile', label: 'Mobile', type: 'string', group: 'Contact', ops: STRING_OPS },
    { key: 'job_title', label: 'Job title', type: 'string', group: 'Contact', ops: STRING_OPS },
    { key: 'department', label: 'Department', type: 'string', group: 'Contact', ops: STRING_OPS },
    { key: 'language', label: 'Language', type: 'string', group: 'Contact', ops: STRING_OPS },
    { key: 'contact_type', label: 'Contact type', type: 'string', group: 'Contact', ops: STRING_OPS },
    { key: 'roles', label: 'Role', type: 'array', group: 'Contact', options: ['PRIMARY', 'DECISION_MAKER', 'TECHNICAL', 'BILLING', 'PROJECT_STAKEHOLDER'], ops: ['has', 'not_has'] },
    { key: 'owner_membership_id', label: 'Owner', type: 'id', group: 'Contact', ops: ID_OPS },
    { key: 'lifecycle_stage_id', label: 'Lifecycle stage', type: 'id', group: 'Contact', ops: ID_OPS },
    { key: 'created_at', label: 'Created', type: 'date', group: 'Activity', ops: DATE_OPS },
    { key: 'last_activity_at', label: 'Last activity', type: 'date', group: 'Activity', ops: DATE_OPS },
    { key: 'tag', label: 'Tag', type: 'tag', group: 'Contact', ops: ['has', 'not_has'] },
    { key: 'company.name', label: 'Company name', type: 'string', group: 'Company', ops: STRING_OPS },
    { key: 'company.type', label: 'Company type', type: 'enum', group: 'Company', options: ['PROSPECT', 'CUSTOMER', 'PARTNER', 'VENDOR', 'OTHER'], ops: ENUM_OPS },
    { key: 'company.industry', label: 'Industry', type: 'string', group: 'Company', ops: STRING_OPS },
    { key: 'company.country', label: 'Country', type: 'string', group: 'Company', ops: STRING_OPS },
    { key: 'company.company_size', label: 'Company size', type: 'string', group: 'Company', ops: STRING_OPS },
    { key: 'company_id', label: 'Company', type: 'id', group: 'Company', ops: ID_OPS },
    { key: 'consent.EMAIL', label: 'Email consent', type: 'consent', group: 'Consent', options: ['UNKNOWN', 'PENDING_DOUBLE_OPT_IN', 'OPTED_IN', 'OPTED_OUT'], ops: ['eq', 'neq'] },
    { key: 'consent.SMS', label: 'SMS consent', type: 'consent', group: 'Consent', options: ['UNKNOWN', 'PENDING_DOUBLE_OPT_IN', 'OPTED_IN', 'OPTED_OUT'], ops: ['eq', 'neq'] },
];

/** Fields a MEMBERSHIP segment (internal announcements) can filter on. */
export const MEMBERSHIP_FIELDS: SegmentField[] = [
    { key: 'job_title', label: 'Job title', type: 'string', group: 'Member', ops: STRING_OPS },
    { key: 'team_id', label: 'Team', type: 'id', group: 'Member', ops: ['eq', 'in'] },
    { key: 'branch_id', label: 'Branch', type: 'id', group: 'Member', ops: ['eq', 'in'] },
    { key: 'joined_at', label: 'Joined', type: 'date', group: 'Member', ops: DATE_OPS },
];
