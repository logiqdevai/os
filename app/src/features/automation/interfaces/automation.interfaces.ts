import type { PaginationMeta } from "@/components/ui/data-table";

export interface Paginated<T> {
    data: T[];
    pagination: PaginationMeta & { has_next: boolean; has_prev: boolean };
}

export type TriggerKind = "EVENT" | "SCHEDULE" | "DATE_RELATIVE" | "MANUAL" | "INBOUND_WEBHOOK";
export type RuleStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type RuleScopeType = "ORGANIZATION" | "BRANCH" | "TEAM" | "PROJECT_TYPE" | "PROJECT";
export type RunMode = "LIVE" | "TEST" | "DRY_RUN";
export type RunStatus = "PENDING" | "RUNNING" | "WAITING" | "AWAITING_APPROVAL" | "RETRY_SCHEDULED" | "SUCCEEDED" | "FAILED" | "DEAD_LETTERED" | "SKIPPED" | "CANCELLED";
export type StepStatus = "PENDING" | "RUNNING" | "WAITING" | "AWAITING_APPROVAL" | "SUCCEEDED" | "FAILED" | "SKIPPED" | "CANCELLED";
export type ApprovalDecision = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "CANCELLED";
export type ActionKind = "UPDATE_FIELD" | "ADD_TAG" | "SET_CUSTOM_FIELD" | "CHANGE_STATUS" | "ASSIGN" | "CREATE_RECORD" | "NOTIFY" | "SEND_COMMUNICATION" | "POST_MESSAGE" | "MANAGE_CHANNEL" | "CALL_WEBHOOK" | "AI_STEP" | "WAIT" | "APPROVAL" | "BRANCH" | "CUSTOM";
export type OutboundWebhookStatus = "ACTIVE" | "PAUSED" | "DISABLED";
export type DeliveryStatus = "PENDING" | "RETRY_SCHEDULED" | "SUCCEEDED" | "FAILED" | "DEAD_LETTERED";
export type InboundWebhookStatus = "ACTIVE" | "PAUSED" | "REVOKED";
export type InboundAuthScheme = "HMAC_SHA256" | "BEARER_TOKEN" | "BASIC" | "NONE";
export type JobKind = "CRON" | "INTERVAL" | "ONCE";
export type JobStatus = "ACTIVE" | "PAUSED" | "DISABLED" | "COMPLETED";
export type JobRunStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED" | "CANCELLED" | "TIMED_OUT";
export type EventSource = "MODULE" | "API" | "INBOUND_WEBHOOK" | "SCHEDULED_JOB" | "AUTOMATION" | "SYSTEM";
export type ConditionOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "not_contains" | "starts_with" | "ends_with" | "in" | "not_in" | "exists" | "not_exists" | "changed";

export interface PersonRef {
    id: string;
    user: { id?: string; display_name: string | null; first_name: string | null; last_name: string | null; email: string; profile_photo_url?: string | null };
}

export interface ConditionPredicate {
    path: string;
    operator: ConditionOperator;
    value?: unknown;
}
export interface ConditionGroup {
    all?: (ConditionPredicate | ConditionGroup)[];
    any?: (ConditionPredicate | ConditionGroup)[];
    not?: (ConditionPredicate | ConditionGroup)[];
}

export interface RuleStep {
    key: string;
    action_key: string;
    inputs: Record<string, unknown>;
    on_error?: "stop" | "continue";
    name?: string;
}

export interface TriggerConfig {
    cron?: string;
    timezone?: string;
    interval_seconds?: number;
    [key: string]: unknown;
}

export interface RuleDefinitionFields {
    name: string;
    description?: string | null;
    module?: string | null;
    trigger_kind: TriggerKind;
    trigger_key: string;
    trigger_config?: TriggerConfig | null;
    conditions?: ConditionGroup | null;
    actions: RuleStep[];
    scope_type?: RuleScopeType;
    branch_id?: string | null;
    team_id?: string | null;
    project_id?: string | null;
    owner_membership_id?: string | null;
    run_as_service_account_id?: string | null;
    serialize_per_record?: boolean;
    max_retries?: number | null;
    retry_backoff_seconds?: number | null;
    rate_limit_per_hour?: number | null;
    max_trigger_depth?: number | null;
    allow_destructive_actions?: boolean;
    require_approval_for_destructive?: boolean;
    template_id?: string | null;
}

export interface RuleListItem {
    id: string;
    name: string;
    description: string | null;
    module: string | null;
    status: RuleStatus;
    enabled: boolean;
    current_version: number;
    trigger_kind: TriggerKind;
    trigger_key: string;
    scope_type: RuleScopeType;
    run_count: number;
    failure_count: number;
    last_run_at: string | null;
    last_run_status: RunStatus | null;
    next_run_at: string | null;
    updated_at: string;
    created_at: string;
    step_count: number;
    has_draft: boolean;
    owner: PersonRef | null;
    run_as: { id: string; name: string; status: string } | null;
}

export interface Rule extends Omit<RuleListItem, "step_count" | "has_draft"> {
    trigger_config: TriggerConfig | null;
    conditions: ConditionGroup | null;
    actions: RuleStep[];
    branch_id: string | null;
    team_id: string | null;
    project_id: string | null;
    project_type_id: string | null;
    owner_membership_id: string | null;
    run_as_service_account_id: string | null;
    serialize_per_record: boolean;
    max_retries: number | null;
    retry_backoff_seconds: number | null;
    rate_limit_per_hour: number | null;
    max_trigger_depth: number | null;
    allow_destructive_actions: boolean;
    require_approval_for_destructive: boolean;
    draft_definition: Partial<RuleDefinitionFields> | null;
    draft_updated_at: string | null;
    published_at: string | null;
    enabled_at: string | null;
    branch: { id: string; name: string } | null;
    team: { id: string; name: string } | null;
    project: { id: string; name: string } | null;
    template: { id: string; name: string } | null;
    scheduled_jobs: { id: string; status: JobStatus; next_run_at: string | null; last_run_at: string | null; last_run_status: JobRunStatus | null }[];
    _count: { versions: number; runs: number };
}

export interface RuleVersion {
    id: string;
    version: number;
    name: string;
    trigger_kind: TriggerKind;
    trigger_key: string;
    conditions: ConditionGroup | null;
    actions: RuleStep[];
    change_summary: string | null;
    published_at: string;
    superseded_at: string | null;
    author: PersonRef | null;
    _count: { runs: number };
}

export interface CatalogField {
    path: string;
    label: string;
    type: "string" | "number" | "boolean" | "date" | "id";
}

export interface TriggerEntry {
    key: string;
    module: string;
    name: string;
    description: string;
    kind: TriggerKind;
    entity_type?: string;
    required_permission?: string;
    fields?: CatalogField[];
    sample_payload?: Record<string, unknown>;
    source: "catalog" | "discovered";
    can_use: boolean;
    module_enabled: boolean;
    seen_30d: number;
    last_seen_at: string | null;
}

export interface ActionField {
    key: string;
    label: string;
    type: "text" | "textarea" | "number" | "boolean" | "json" | "select" | "member" | "members" | "webhook" | "conditions";
    required?: boolean;
    placeholder?: string;
    help?: string;
    options?: { id: string; label: string }[];
    default?: unknown;
}

export interface ActionEntry {
    key: string;
    module: string;
    name: string;
    description: string;
    kind: ActionKind;
    executor: "builtin" | "mcp";
    tool: string | null;
    available: boolean;
    is_destructive: boolean;
    is_customer_facing?: boolean;
    required_permissions: string[];
    can_use: boolean;
    module_enabled: boolean;
    fields: ActionField[];
}

export interface RuleTemplate {
    id: string | null;
    key: string;
    module: string;
    name: string;
    description: string | null;
    category: string | null;
    definition: { trigger_kind: TriggerKind; trigger_key: string; trigger_config?: TriggerConfig | null; conditions?: ConditionGroup | null; actions: RuleStep[] };
    is_system: boolean;
    usage_count: number;
}

export interface RunListItem {
    id: string;
    rule_id: string;
    rule_version: number;
    mode: RunMode;
    status: RunStatus;
    trigger_kind: TriggerKind;
    trigger_key: string;
    entity_type: string | null;
    entity_kind: string | null;
    entity_id: string | null;
    attempt: number;
    max_attempts: number;
    duration_ms: number | null;
    error_code: string | null;
    error_message: string | null;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
    actor_type: string;
    performed_destructive_action: boolean;
    trigger_depth: number;
    next_retry_at: string | null;
    wait_until: string | null;
    rule: { id: string; name: string };
    _count?: { steps: number };
}

export interface RunApproval {
    id: string;
    decision: ApprovalDecision;
    context: { message?: string; rule_name?: string } | null;
    comment: string | null;
    requested_at: string;
    expires_at: string | null;
    decided_at: string | null;
    requested_from_membership_id: string | null;
    requested_from_member: PersonRef | null;
    approver: PersonRef | null;
}

export interface RunStep {
    id: string;
    step_index: number;
    step_key: string;
    action_key: string;
    kind: ActionKind;
    status: StepStatus;
    input: unknown;
    output: unknown;
    attempt: number;
    max_attempts: number;
    wait_until: string | null;
    branch_taken: string | null;
    skipped_reason: string | null;
    is_destructive: boolean;
    started_at: string | null;
    finished_at: string | null;
    duration_ms: number | null;
    error_code: string | null;
    error_message: string | null;
    approval: RunApproval | null;
    webhook_deliveries: { id: string; status: DeliveryStatus; response_status_code: number | null; duration_ms: number | null; created_at: string }[];
}

export interface RunDetail extends RunListItem {
    idempotency_key: string;
    input: { event?: { id: string | null; event_key: string; entity_type: string | null; entity_id: string | null; payload: Record<string, unknown> } } | null;
    output: Record<string, unknown> | null;
    conditions_result: { path: string; operator: string; expected: unknown; actual: unknown; passed: boolean }[] | null;
    conditions_passed: boolean | null;
    current_step_index: number | null;
    event_id: string | null;
    parent_run_id: string | null;
    dead_letter_reason: string | null;
    rule: { id: string; name: string; trigger_kind: TriggerKind; owner_membership_id: string | null };
    steps: RunStep[];
    actor_membership: PersonRef | null;
    run_as: { id: string; name: string } | null;
    parent_run: { id: string; rule: { name: string } } | null;
    child_runs: { id: string; status: RunStatus; rule: { name: string } }[];
}

export interface ApprovalRow extends RunApproval {
    run: { id: string; status: RunStatus; rule: { id: string; name: string } };
    step: { step_key: string; action_key: string; input: unknown };
    can_decide: boolean;
}

export interface PlatformEventRow {
    id: string;
    event_key: string;
    module: string;
    source: EventSource;
    entity_type: string | null;
    entity_kind: string | null;
    entity_id: string | null;
    actor_type: string;
    trigger_depth: number;
    occurred_at: string;
    rules_processed_at: string | null;
    rules_matched_count: number;
    webhooks_processed_at: string | null;
    processing_attempts: number;
    processing_error: string | null;
    dead_lettered_at: string | null;
    causation_run_id: string | null;
    actor_membership: PersonRef | null;
}

export interface PlatformEventDetail extends PlatformEventRow {
    payload: Record<string, unknown>;
    changes: Record<string, unknown> | null;
    actor_service_account: { id: string; name: string } | null;
    triggered_runs: { id: string; status: RunStatus; mode: RunMode; created_at: string; rule: { id: string; name: string } }[];
    webhook_deliveries: { id: string; status: DeliveryStatus; response_status_code: number | null; created_at: string; webhook: { id: string; name: string } }[];
    causation_run: { id: string; rule: { name: string } } | null;
}

export interface OutboundWebhook {
    id: string;
    name: string;
    description: string | null;
    url: string;
    subscribed_events: string[];
    headers: Record<string, string> | null;
    status: OutboundWebhookStatus;
    max_attempts: number;
    retry_backoff_seconds: number;
    timeout_seconds: number;
    disable_after_failures: number | null;
    consecutive_failures: number;
    last_delivery_at: string | null;
    last_success_at: string | null;
    last_failure_at: string | null;
    disabled_reason: string | null;
    secret_hint: string;
    created_at: string;
    stats_7d?: Partial<Record<DeliveryStatus, number>>;
    /** Only in the create / rotate response. */
    secret?: string;
}

export interface WebhookDelivery {
    id: string;
    webhook_id: string;
    event_id: string | null;
    run_step_id: string | null;
    event_key: string;
    status: DeliveryStatus;
    attempt: number;
    max_attempts: number;
    next_retry_at: string | null;
    response_status_code: number | null;
    error_message: string | null;
    duration_ms: number | null;
    delivered_at: string | null;
    created_at: string;
    webhook: { id: string; name: string; url: string };
}

export interface WebhookDeliveryDetail extends WebhookDelivery {
    payload: unknown;
    request_headers: Record<string, string> | null;
    response_body: string | null;
}

export interface InboundWebhook {
    id: string;
    name: string;
    description: string | null;
    slug: string;
    auth_scheme: InboundAuthScheme;
    signature_header: string | null;
    status: InboundWebhookStatus;
    rule_id: string | null;
    rule: { id: string; name: string } | null;
    allowed_ip_ranges: string[];
    rate_limit_per_minute: number | null;
    received_count: number;
    rejected_count: number;
    last_received_at: string | null;
    last_rejected_at: string | null;
    last_rejection_reason: string | null;
    url_path: string;
    event_key: string;
    created_at: string;
    secret?: string;
}

export interface ScheduledJob {
    id: string;
    key: string;
    name: string;
    description: string | null;
    module: string;
    kind: JobKind;
    cron_expression: string | null;
    interval_seconds: number | null;
    run_at: string | null;
    timezone: string;
    handler: string;
    payload: Record<string, unknown> | null;
    status: JobStatus;
    rule_id: string | null;
    rule: { id: string; name: string } | null;
    branch: { id: string; name: string } | null;
    next_run_at: string | null;
    last_run_at: string | null;
    last_run_status: JobRunStatus | null;
    last_error: string | null;
    last_duration_ms: number | null;
    run_count: number;
    failure_count: number;
    consecutive_failures: number;
    max_retries: number;
    retry_backoff_seconds: number;
    timeout_seconds: number | null;
    allow_overlap: boolean;
    handler_info?: JobHandler | null;
}

export interface JobHandler {
    key: string;
    module: string;
    name: string;
    description: string;
    user_creatable?: boolean;
}

export interface JobRun {
    id: string;
    status: JobRunStatus;
    scheduled_for: string;
    started_at: string | null;
    finished_at: string | null;
    duration_ms: number | null;
    attempt: number;
    max_attempts: number;
    next_retry_at: string | null;
    output: Record<string, unknown> | null;
    error_code: string | null;
    error_message: string | null;
    triggered_by: PersonRef | null;
    created_at: string;
}

export interface AutomationOverview {
    rules: { total: number; enabled: number; drafts: number };
    runs: { last_24h: number; failed_24h: number; waiting: number; success_rate_7d: number | null; avg_duration_ms_7d: number | null; by_status_7d: Partial<Record<RunStatus, number>> } | null;
    pending_approvals_mine: number;
    dead_lettered_deliveries_7d: number | null;
    failing_jobs: number | null;
    top_failing_rules: { id: string; name: string; failure_count: number; run_count: number; last_run_status: RunStatus | null; last_run_at: string | null }[];
    recent_runs: { id: string; status: RunStatus; mode: RunMode; trigger_key: string; created_at: string; duration_ms: number | null; rule: { id: string; name: string } }[];
}

export interface AutomationUsage {
    days: number;
    runs_total: number;
    steps_total: number;
    runs_by_day: { date: string; succeeded: number; failed: number; other: number }[];
    top_events: { event_key: string; count: number }[];
    deliveries_by_status: Partial<Record<DeliveryStatus, number>>;
    job_runs_total: number;
}

export interface AutomationSettings {
    organization_id: string;
    org_rate_limit_per_hour: number;
    default_rule_rate_limit_per_hour: number;
    max_trigger_depth: number;
    default_max_retries: number;
    default_retry_backoff_seconds: number;
    destructive_actions_enabled: boolean;
    destructive_actions_enabled_at: string | null;
    destructive_requires_approval: boolean;
    run_retention_days: number | null;
    event_retention_days: number | null;
    job_run_retention_days: number | null;
    dead_letter_alerts_enabled: boolean;
    dead_letter_alert_membership_ids: string[];
    dead_letter_alert_notify_rule_owner: boolean;
    default_service_account_id: string | null;
    default_service_account: { id: string; name: string; status: string } | null;
    destructive_actions_enabled_by: PersonRef | null;
    updated_at: string;
}

export type UpdateAutomationSettingsDto = Partial<Pick<AutomationSettings,
    "org_rate_limit_per_hour" | "default_rule_rate_limit_per_hour" | "max_trigger_depth" | "default_max_retries" | "default_retry_backoff_seconds"
    | "destructive_actions_enabled" | "destructive_requires_approval" | "run_retention_days" | "event_retention_days" | "job_run_retention_days"
    | "dead_letter_alerts_enabled" | "dead_letter_alert_notify_rule_owner">>;

export interface CreateOutboundWebhookDto {
    name: string;
    description?: string;
    url: string;
    subscribed_events: string[];
    max_attempts?: number;
    timeout_seconds?: number;
}

export interface CreateInboundWebhookDto {
    name: string;
    description?: string;
    slug?: string;
    auth_scheme?: InboundAuthScheme;
    rule_id?: string | null;
}

export interface CreateJobDto {
    key: string;
    name: string;
    description?: string;
    kind: JobKind;
    cron_expression?: string;
    interval_seconds?: number;
    run_at?: string;
    timezone?: string;
    handler: string;
    payload?: Record<string, unknown>;
    max_retries?: number;
}
