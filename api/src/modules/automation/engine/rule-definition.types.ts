import { AutomationTriggerKind } from 'generated/prisma';

export type ConditionOperator =
    | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
    | 'contains' | 'not_contains' | 'starts_with' | 'ends_with'
    | 'in' | 'not_in' | 'exists' | 'not_exists' | 'changed';

export interface ConditionPredicate {
    /** Dotted path into the run context, e.g. `event.payload.amount`, `event.changes.status`. */
    path: string;
    operator: ConditionOperator;
    value?: unknown;
}

/** 20 §2 — condition tree stored in `AutomationRule.conditions`. Groups nest. */
export interface ConditionGroup {
    all?: ConditionNode[];
    any?: ConditionNode[];
    not?: ConditionNode[];
}

export type ConditionNode = ConditionPredicate | ConditionGroup;

/** 20 §2, §4 — one ordered step stored in `AutomationRule.actions`. */
export interface RuleStep {
    /** Unique key within the rule; later steps reference outputs as `{{steps.<key>.output.…}}`. */
    key: string;
    action_key: string;
    inputs: Record<string, unknown>;
    on_error?: 'stop' | 'continue';
    /** Optional display name in the builder. */
    name?: string;
}

/** Trigger config per kind: EVENT `{}` · SCHEDULE `{ cron, timezone }` or `{ interval_seconds }` · INBOUND_WEBHOOK `{ slug }`. */
export interface TriggerConfig {
    cron?: string;
    timezone?: string;
    interval_seconds?: number;
    slug?: string;
    [key: string]: unknown;
}

export interface RuleDefinition {
    trigger_kind: AutomationTriggerKind;
    trigger_key: string;
    trigger_config?: TriggerConfig | null;
    conditions?: ConditionGroup | null;
    actions: RuleStep[];
}

/** What templates and conditions can read during a run. */
export interface RunScope {
    event: {
        id: string | null;
        event_key: string;
        entity_type: string | null;
        entity_id: string | null;
        payload: Record<string, unknown>;
        changes: Record<string, unknown> | null;
        actor_membership_id: string | null;
        occurred_at: string;
    };
    rule: { id: string; name: string; version: number };
    run: { id: string; mode: string };
    steps: Record<string, { output: unknown }>;
    now: string;
}
