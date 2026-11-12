import type { DropdownOption } from "@/lib/dropdown-option-label.utils";
import type { BadgeVariant } from "@/components/ui/badge";
import type {
    CannedScope,
    ConversationStatus,
    KnowledgeArticleStatus,
    KnowledgeVisibility,
    RoutingStrategy,
    SlaMetric,
    SupportChannelType,
    TicketPriority,
    TicketSource,
    TicketStatusCategory,
    TicketType,
} from "@/features/support/interfaces/support.interfaces";

/** Canonical labels for 13 Support enums. Filters spread the form lists. */
export const TicketPriorityFormOptions: DropdownOption<TicketPriority>[] = [
    { id: "URGENT", label: "Urgent" },
    { id: "HIGH", label: "High" },
    { id: "NORMAL", label: "Normal" },
    { id: "LOW", label: "Low" },
];
export const TicketPriorityFilterOptions: DropdownOption<TicketPriority | "all">[] = [{ id: "all", label: "Any priority" }, ...TicketPriorityFormOptions];

export const TicketTypeFormOptions: DropdownOption<TicketType>[] = [
    { id: "QUESTION", label: "Question" },
    { id: "BUG", label: "Bug" },
    { id: "FEATURE_REQUEST", label: "Feature request" },
    { id: "CHANGE_REQUEST", label: "Change request" },
    { id: "BILLING", label: "Billing" },
    { id: "ACCOUNT", label: "Account" },
    { id: "INCIDENT", label: "Incident" },
    { id: "OTHER", label: "Other" },
];
export const TicketTypeFilterOptions: DropdownOption<TicketType | "all">[] = [{ id: "all", label: "Any type" }, ...TicketTypeFormOptions];

export const TicketSourceOptions: DropdownOption<TicketSource>[] = [
    { id: "CONVERSATION", label: "Conversation" },
    { id: "EMAIL", label: "Email" },
    { id: "LIVE_CHAT", label: "Live chat" },
    { id: "WIDGET", label: "Widget" },
    { id: "PORTAL", label: "Client portal" },
    { id: "FORM", label: "Form" },
    { id: "AI_AGENT", label: "AI agent" },
    { id: "MANUAL", label: "Manual" },
    { id: "API", label: "API" },
    { id: "CHANNEL_MESSAGE", label: "Message" },
];
export const TicketSourceFilterOptions: DropdownOption<TicketSource | "all">[] = [{ id: "all", label: "Any source" }, ...TicketSourceOptions];

export const TicketStatusCategoryOptions: DropdownOption<TicketStatusCategory>[] = [
    { id: "NEW", label: "New" },
    { id: "OPEN", label: "Open" },
    { id: "PENDING_CUSTOMER", label: "Waiting on customer" },
    { id: "ON_HOLD", label: "On hold" },
    { id: "RESOLVED", label: "Resolved" },
    { id: "CLOSED", label: "Closed" },
];

export const TicketStateFilterOptions: DropdownOption<"open" | "closed" | "everything">[] = [
    { id: "open", label: "Open" },
    { id: "closed", label: "Resolved & closed" },
    { id: "everything", label: "All tickets" },
];

export const TicketSlaFilterOptions: DropdownOption<"breached" | "at_risk" | "ok" | "all">[] = [
    { id: "all", label: "Any SLA" },
    { id: "breached", label: "Breached" },
    { id: "at_risk", label: "At risk" },
    { id: "ok", label: "On track" },
];

export const TicketAssigneeFilterOptions: DropdownOption<"me" | "unassigned" | "all">[] = [
    { id: "all", label: "Anyone" },
    { id: "me", label: "Assigned to me" },
    { id: "unassigned", label: "Unassigned" },
];

export const ConversationStatusOptions: DropdownOption<ConversationStatus>[] = [
    { id: "OPEN", label: "Open" },
    { id: "PENDING", label: "Pending" },
    { id: "SNOOZED", label: "Snoozed" },
    { id: "RESOLVED", label: "Resolved" },
];

/** Inbox status tabs (value is the `status` query, comma-separated). */
export const ConversationStatusFilterOptions: DropdownOption<string>[] = [
    { id: "OPEN,PENDING", label: "Open" },
    { id: "SNOOZED", label: "Snoozed" },
    { id: "RESOLVED", label: "Resolved" },
    { id: "all", label: "All" },
];

export const ConversationViewOptions: DropdownOption<"all" | "mine" | "unassigned" | "mentions">[] = [
    { id: "mine", label: "Assigned to me" },
    { id: "unassigned", label: "Unassigned" },
    { id: "mentions", label: "Mentions" },
    { id: "all", label: "All conversations" },
];

export const SupportChannelTypeOptions: DropdownOption<SupportChannelType>[] = [
    { id: "EMAIL", label: "Email" },
    { id: "LIVE_CHAT", label: "Live chat" },
    { id: "WIDGET", label: "Website widget" },
    { id: "PORTAL", label: "Client portal" },
    { id: "FORM", label: "Request form" },
    { id: "API", label: "API" },
    { id: "PHONE", label: "Phone" },
];
export const SupportChannelTypeFilterOptions: DropdownOption<SupportChannelType | "all">[] = [{ id: "all", label: "Any channel" }, ...SupportChannelTypeOptions];

export const SupportChannelTypeDescriptionOptions: Record<SupportChannelType, string> = {
    EMAIL: "Forward a support address; each email becomes a conversation.",
    LIVE_CHAT: "Real-time chat on your website.",
    WIDGET: "Embedded help and contact widget for websites and apps.",
    PORTAL: "Requests and messages from signed-in clients in the portal.",
    FORM: "A request form that opens tickets.",
    API: "Create conversations from your own systems.",
    PHONE: "Log phone calls as conversations.",
};

export const RoutingStrategyOptions: DropdownOption<RoutingStrategy>[] = [
    { id: "MANUAL", label: "Manual" },
    { id: "ROUND_ROBIN", label: "Round robin" },
    { id: "LOAD_BALANCED", label: "Load balanced" },
    { id: "SKILL_BASED", label: "Skill based" },
];

export const SlaMetricOptions: DropdownOption<SlaMetric>[] = [
    { id: "FIRST_RESPONSE", label: "First response" },
    { id: "NEXT_RESPONSE", label: "Next response" },
    { id: "RESOLUTION", label: "Resolution" },
];

export const KnowledgeStatusOptions: DropdownOption<KnowledgeArticleStatus>[] = [
    { id: "DRAFT", label: "Draft" },
    { id: "IN_REVIEW", label: "In review" },
    { id: "PUBLISHED", label: "Published" },
    { id: "ARCHIVED", label: "Archived" },
];
export const KnowledgeStatusFilterOptions: DropdownOption<KnowledgeArticleStatus | "all">[] = [{ id: "all", label: "Any status" }, ...KnowledgeStatusOptions.filter((o) => o.id !== "ARCHIVED")];

export const KnowledgeVisibilityOptions: DropdownOption<KnowledgeVisibility>[] = [
    { id: "PUBLIC", label: "Public help center" },
    { id: "CUSTOMERS", label: "Clients only (portal)" },
    { id: "INTERNAL", label: "Internal (agents)" },
];
export const KnowledgeVisibilityFilterOptions: DropdownOption<KnowledgeVisibility | "all">[] = [{ id: "all", label: "Any visibility" }, ...KnowledgeVisibilityOptions];

export const CannedScopeOptions: DropdownOption<CannedScope>[] = [
    { id: "ORGANIZATION", label: "Everyone" },
    { id: "TEAM", label: "Team" },
    { id: "PERSONAL", label: "Only me" },
];
export const CannedScopeFilterOptions: DropdownOption<CannedScope | "all">[] = [{ id: "all", label: "All scopes" }, ...CannedScopeOptions];

export const SnoozeOptions: DropdownOption<string>[] = [
    { id: "1h", label: "1 hour" },
    { id: "4h", label: "4 hours" },
    { id: "tomorrow", label: "Tomorrow 9:00" },
    { id: "next_week", label: "Next Monday 9:00" },
];

export const AnalyticsRangeOptions: DropdownOption<string>[] = [
    { id: "7", label: "Last 7 days" },
    { id: "30", label: "Last 30 days" },
    { id: "90", label: "Last 90 days" },
];

/** Badge tones (visual only). */
export const PriorityTone: Record<TicketPriority, BadgeVariant> = { URGENT: "danger", HIGH: "warning", NORMAL: "info", LOW: "neutral" };
export const StatusCategoryTone: Record<TicketStatusCategory, BadgeVariant> = { NEW: "info", OPEN: "info", PENDING_CUSTOMER: "warning", ON_HOLD: "neutral", RESOLVED: "success", CLOSED: "neutral" };
export const ConversationStatusTone: Record<ConversationStatus, BadgeVariant> = { OPEN: "info", PENDING: "warning", SNOOZED: "violet", RESOLVED: "success" };
export const KnowledgeStatusTone: Record<KnowledgeArticleStatus, BadgeVariant> = { DRAFT: "neutral", IN_REVIEW: "warning", PUBLISHED: "success", ARCHIVED: "neutral" };

export const WidgetPositionOptions: DropdownOption<"right" | "left">[] = [
    { id: "right", label: "Bottom right" },
    { id: "left", label: "Bottom left" },
];
