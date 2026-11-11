/**
 * Metered entitlement keys (01 §56). `OrganizationEntitlement.key` must be one of these.
 * Usage is computed by the owning module, never stored on the entitlement row.
 * Unit is what `limit_value` is measured in. No row for a key = the platform default.
 */
export const ENTITLEMENT_KEYS = {
  DOCUMENTS_STORAGE_BYTES: { key: 'documents.storage_bytes', unit: 'bytes', module: 'DOCUMENTS' },
  AUTOMATION_RUNS_PER_MONTH: { key: 'automation.runs_per_month', unit: 'count', module: 'AUTOMATION' },
  AUTOMATION_AI_COST_CAP_CENTS: { key: 'automation.ai_cost_cap_cents', unit: 'cents', module: 'AUTOMATION' },
} as const;

export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[keyof typeof ENTITLEMENT_KEYS]['key'];
