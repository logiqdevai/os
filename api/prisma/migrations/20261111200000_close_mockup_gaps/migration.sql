-- CreateEnum
CREATE TYPE "DomainTlsStatus" AS ENUM ('PENDING', 'ISSUED', 'FAILED');

-- CreateEnum
CREATE TYPE "OrganizationRetentionDataClass" AS ENUM ('AUDIT_EVENTS', 'SESSIONS', 'INVITATIONS', 'WEBHOOK_DELIVERIES');

-- CreateEnum
CREATE TYPE "OrganizationRetentionAction" AS ENUM ('ARCHIVE', 'DELETE', 'ANONYMIZE');

-- CreateEnum
CREATE TYPE "OrganizationPlanStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrganizationPlanInvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "EntitlementPeriod" AS ENUM ('LIFETIME', 'MONTHLY');

-- CreateEnum
CREATE TYPE "EntitlementEnforcement" AS ENUM ('HARD', 'SOFT');

-- CreateEnum
CREATE TYPE "EntitlementSource" AS ENUM ('PLAN', 'TRIAL', 'OVERRIDE');

-- CreateEnum
CREATE TYPE "ReviewerStrategy" AS ENUM ('BRANCH_MANAGERS', 'TEAM_LEADS', 'LINE_MANAGER', 'SPECIFIC');

-- CreateEnum
CREATE TYPE "McpToolCallStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'DENIED', 'AWAITING_CONFIRMATION', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');

-- CreateEnum
CREATE TYPE "CrmActivityDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CrmLossReasonScope" AS ENUM ('DEAL', 'LEAD', 'BOTH');

-- CreateEnum
CREATE TYPE "CrmReportFormat" AS ENUM ('PDF', 'CSV', 'XLSX');

-- CreateEnum
CREATE TYPE "ProposalLostReason" AS ENUM ('PRICE', 'SCOPE', 'TIMING', 'COMPETITOR', 'NO_DECISION', 'OTHER');

-- CreateEnum
CREATE TYPE "ProposalLinkAccessMode" AS ENUM ('ANYONE_WITH_LINK', 'EMAIL_VERIFIED');

-- CreateEnum
CREATE TYPE "ProposalAiFindingKind" AS ENUM ('MISSING_SECTION', 'PRICING_INCONSISTENCY', 'DATE_CONFLICT', 'UNCLEAR_SCOPE', 'TERMS_RISK', 'TONE_OR_CLARITY', 'OTHER');

-- CreateEnum
CREATE TYPE "ProposalAiFindingSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ProposalAiFindingStatus" AS ENUM ('OPEN', 'ACCEPTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "VerificationPurpose" AS ENUM ('SIGNER_IDENTITY', 'PROPOSAL_ACCESS');

-- CreateEnum
CREATE TYPE "VerificationChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "ContractRenewalDecisionType" AS ENUM ('RENEW', 'DO_NOT_RENEW');

-- CreateEnum
CREATE TYPE "DeliverableApprovalMode" AS ENUM ('ANY_ONE', 'ALL');

-- CreateEnum
CREATE TYPE "PaymentLinkStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'DISABLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentDisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'WON', 'LOST', 'CLOSED');

-- CreateEnum
CREATE TYPE "PaymentPayoutStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'PAID', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VatValidationStatus" AS ENUM ('VALID', 'INVALID', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FinanceApprovalEntityType" AS ENUM ('INVOICE', 'REFUND', 'CREDIT_NOTE', 'WRITE_OFF', 'LEDGER_RECORD', 'EXPENSE_CLAIM');

-- CreateEnum
CREATE TYPE "FinanceApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinanceReportFormat" AS ENUM ('PDF', 'XLSX', 'CSV');

-- CreateEnum
CREATE TYPE "NumberResetPolicy" AS ENUM ('NEVER', 'YEARLY');

-- CreateEnum
CREATE TYPE "LedgerBudgetScope" AS ENUM ('CATEGORY', 'PROJECT', 'DEPARTMENT');

-- CreateEnum
CREATE TYPE "LedgerBudgetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "VatReturnStatus" AS ENUM ('DRAFT', 'FILED', 'PAID');

-- CreateEnum
CREATE TYPE "ExpenseClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "EmployeeEquipmentType" AS ENUM ('LAPTOP', 'PHONE', 'MONITOR', 'ACCESS_CARD', 'VEHICLE', 'OTHER');

-- CreateEnum
CREATE TYPE "EmployeeEquipmentCondition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'DAMAGED', 'LOST');

-- CreateEnum
CREATE TYPE "EmployeeTerminationKind" AS ENUM ('RESIGNATION', 'DISMISSAL', 'END_OF_CONTRACT', 'REDUNDANCY', 'RETIREMENT', 'MUTUAL_AGREEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "PerformanceFeedbackRequestStatus" AS ENUM ('PENDING', 'SUBMITTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmployeeImportStatus" AS ENUM ('PENDING', 'VALIDATING', 'PREVIEW', 'IMPORTING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CampaignAbMetric" AS ENUM ('OPEN', 'CLICK');

-- CreateEnum
CREATE TYPE "ChannelInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ChannelAccessRequestKind" AS ENUM ('JOIN', 'POST');

-- CreateEnum
CREATE TYPE "ChannelAccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupportIncidentSeverity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SupportIncidentUpdateStatus" AS ENUM ('INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "SupportRoutingStrategy" AS ENUM ('MANUAL', 'ROUND_ROBIN', 'LOAD_BALANCED', 'SKILL_BASED');

-- CreateEnum
CREATE TYPE "SupportAgentAvailability" AS ENUM ('ONLINE', 'AWAY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "SupportCsatScale" AS ENUM ('STARS_5', 'THUMBS');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "WikiPageViewSource" AS ENUM ('UI', 'SEARCH', 'AI_CITATION');

-- CreateEnum
CREATE TYPE "WikiSearchMode" AS ENUM ('KEYWORD', 'SEMANTIC');

-- CreateEnum
CREATE TYPE "WikiTransferKind" AS ENUM ('IMPORT', 'EXPORT');

-- CreateEnum
CREATE TYPE "WikiTransferFormat" AS ENUM ('MARKDOWN', 'HTML', 'DOCX', 'PDF', 'NOTION', 'CONFLUENCE', 'GOOGLE_DOCS');

-- CreateEnum
CREATE TYPE "WikiTransferScope" AS ENUM ('PAGE', 'SUBTREE', 'SPACE');

-- CreateEnum
CREATE TYPE "WikiTransferStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "WikiReviewRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "TimeReportFormat" AS ENUM ('CSV', 'XLSX', 'PDF');

-- CreateEnum
CREATE TYPE "TimeReportFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "TimeExportStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RecordEntityType" ADD VALUE 'MEMBERSHIP';
ALTER TYPE "RecordEntityType" ADD VALUE 'AUDIT_EVENT';
ALTER TYPE "RecordEntityType" ADD VALUE 'CONTRACT_OBLIGATION';
ALTER TYPE "RecordEntityType" ADD VALUE 'LEDGER_INVOICE_IMPORT';
ALTER TYPE "RecordEntityType" ADD VALUE 'EXPENSE_CLAIM';
ALTER TYPE "RecordEntityType" ADD VALUE 'LEDGER_BUDGET';
ALTER TYPE "RecordEntityType" ADD VALUE 'VAT_RETURN';
ALTER TYPE "RecordEntityType" ADD VALUE 'PAYMENT_LINK';

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentProvider_new" AS ENUM ('STRIPE', 'VIVA_WALLET', 'MANUAL', 'BANK');
ALTER TABLE "payment_methods" ALTER COLUMN "provider" TYPE "PaymentProvider_new" USING ("provider"::text::"PaymentProvider_new");
ALTER TABLE "payments" ALTER COLUMN "provider" TYPE "PaymentProvider_new" USING ("provider"::text::"PaymentProvider_new");
ALTER TABLE "payment_provider_connections" ALTER COLUMN "provider" TYPE "PaymentProvider_new" USING ("provider"::text::"PaymentProvider_new");
ALTER TYPE "PaymentProvider" RENAME TO "PaymentProvider_old";
ALTER TYPE "PaymentProvider_new" RENAME TO "PaymentProvider";
DROP TYPE "PaymentProvider_old";
COMMIT;

-- AlterEnum
ALTER TYPE "LedgerInsightKind" ADD VALUE 'BUDGET_ALERT';

-- AlterEnum
ALTER TYPE "HrNoteCategory" ADD VALUE 'EXIT_INTERVIEW';

-- AlterEnum
ALTER TYPE "TicketSource" ADD VALUE 'CHANNEL_MESSAGE';

-- AlterEnum
BEGIN;
CREATE TYPE "NotificationChannel_new" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH', 'DESKTOP');
ALTER TABLE "notification_event_types" ALTER COLUMN "default_channels" DROP DEFAULT;
ALTER TABLE "notification_event_types" ALTER COLUMN "forced_channels" DROP DEFAULT;
ALTER TABLE "notification_org_settings" ALTER COLUMN "enabled_channels" DROP DEFAULT;
ALTER TABLE "notification_org_settings" ALTER COLUMN "portal_enabled_channels" DROP DEFAULT;
ALTER TABLE "notification_org_defaults" ALTER COLUMN "channels" DROP DEFAULT;
ALTER TABLE "notification_org_defaults" ALTER COLUMN "portal_channels" DROP DEFAULT;
ALTER TABLE "notification_recipient_settings" ALTER COLUMN "digest_channel" DROP DEFAULT;
ALTER TABLE "notification_keywords" ALTER COLUMN "channels" DROP DEFAULT;
ALTER TABLE "notification_digests" ALTER COLUMN "channel" DROP DEFAULT;
ALTER TABLE "notification_event_types" ALTER COLUMN "default_channels" TYPE "NotificationChannel_new"[] USING ("default_channels"::text::"NotificationChannel_new"[]);
ALTER TABLE "notification_event_types" ALTER COLUMN "forced_channels" TYPE "NotificationChannel_new"[] USING ("forced_channels"::text::"NotificationChannel_new"[]);
ALTER TABLE "notification_deliveries" ALTER COLUMN "channel" TYPE "NotificationChannel_new" USING ("channel"::text::"NotificationChannel_new");
ALTER TABLE "notification_templates" ALTER COLUMN "channel" TYPE "NotificationChannel_new" USING ("channel"::text::"NotificationChannel_new");
ALTER TABLE "notification_org_settings" ALTER COLUMN "enabled_channels" TYPE "NotificationChannel_new"[] USING ("enabled_channels"::text::"NotificationChannel_new"[]);
ALTER TABLE "notification_org_settings" ALTER COLUMN "portal_enabled_channels" TYPE "NotificationChannel_new"[] USING ("portal_enabled_channels"::text::"NotificationChannel_new"[]);
ALTER TABLE "notification_org_defaults" ALTER COLUMN "channels" TYPE "NotificationChannel_new"[] USING ("channels"::text::"NotificationChannel_new"[]);
ALTER TABLE "notification_org_defaults" ALTER COLUMN "portal_channels" TYPE "NotificationChannel_new"[] USING ("portal_channels"::text::"NotificationChannel_new"[]);
ALTER TABLE "notification_recipient_settings" ALTER COLUMN "digest_channel" TYPE "NotificationChannel_new" USING ("digest_channel"::text::"NotificationChannel_new");
ALTER TABLE "notification_preferences" ALTER COLUMN "channel" TYPE "NotificationChannel_new" USING ("channel"::text::"NotificationChannel_new");
ALTER TABLE "notification_keywords" ALTER COLUMN "channels" TYPE "NotificationChannel_new"[] USING ("channels"::text::"NotificationChannel_new"[]);
ALTER TABLE "notification_digests" ALTER COLUMN "channel" TYPE "NotificationChannel_new" USING ("channel"::text::"NotificationChannel_new");
ALTER TABLE "notification_delivery_rules" ALTER COLUMN "channel" TYPE "NotificationChannel_new" USING ("channel"::text::"NotificationChannel_new");
ALTER TYPE "NotificationChannel" RENAME TO "NotificationChannel_old";
ALTER TYPE "NotificationChannel_new" RENAME TO "NotificationChannel";
DROP TYPE "NotificationChannel_old";
ALTER TABLE "notification_event_types" ALTER COLUMN "default_channels" SET DEFAULT ARRAY['IN_APP']::"NotificationChannel"[];
ALTER TABLE "notification_event_types" ALTER COLUMN "forced_channels" SET DEFAULT ARRAY[]::"NotificationChannel"[];
ALTER TABLE "notification_org_settings" ALTER COLUMN "enabled_channels" SET DEFAULT ARRAY['IN_APP', 'EMAIL']::"NotificationChannel"[];
ALTER TABLE "notification_org_settings" ALTER COLUMN "portal_enabled_channels" SET DEFAULT ARRAY['IN_APP', 'EMAIL']::"NotificationChannel"[];
ALTER TABLE "notification_org_defaults" ALTER COLUMN "channels" SET DEFAULT ARRAY['IN_APP']::"NotificationChannel"[];
ALTER TABLE "notification_org_defaults" ALTER COLUMN "portal_channels" SET DEFAULT ARRAY['IN_APP', 'EMAIL']::"NotificationChannel"[];
ALTER TABLE "notification_recipient_settings" ALTER COLUMN "digest_channel" SET DEFAULT 'EMAIL';
ALTER TABLE "notification_keywords" ALTER COLUMN "channels" SET DEFAULT ARRAY[]::"NotificationChannel"[];
ALTER TABLE "notification_digests" ALTER COLUMN "channel" SET DEFAULT 'EMAIL';
COMMIT;

-- AlterTable
ALTER TABLE "organization_domains" ADD COLUMN     "dns_check" JSONB,
ADD COLUMN     "last_checked_at" TIMESTAMP(3),
ADD COLUMN     "tls_expires_at" TIMESTAMP(3),
ADD COLUMN     "tls_status" "DomainTlsStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "role_permissions" ADD COLUMN     "max_scope_type" "ScopeType";

-- AlterTable
ALTER TABLE "access_reviews" ADD COLUMN     "reviewer_membership_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reviewer_strategy" "ReviewerStrategy" NOT NULL DEFAULT 'BRANCH_MANAGERS';

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "last_sent_at" TIMESTAMP(3),
ADD COLUMN     "scope_id" TEXT,
ADD COLUMN     "scope_type" "ScopeType" NOT NULL DEFAULT 'ORGANIZATION',
ADD COLUMN     "send_count" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "valid_until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN     "allowed_ip_ranges" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "audit_events" ADD COLUMN     "outcome" "AuditOutcome" NOT NULL DEFAULT 'SUCCESS';

-- AlterTable
ALTER TABLE "crm_companies" ADD COLUMN     "merged_at" TIMESTAMP(3),
ADD COLUMN     "merged_into_id" TEXT,
ADD COLUMN     "partner_commission_percent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "crm_contacts" ADD COLUMN     "address" JSONB,
ADD COLUMN     "merged_at" TIMESTAMP(3),
ADD COLUMN     "merged_into_id" TEXT;

-- AlterTable
ALTER TABLE "crm_leads" ADD COLUMN     "lost_reason_id" TEXT,
ADD COLUMN     "merged_at" TIMESTAMP(3),
ADD COLUMN     "merged_into_id" TEXT,
ADD COLUMN     "referring_partner_company_id" TEXT;

-- AlterTable
ALTER TABLE "crm_deals" ADD COLUMN     "discount_approved_at" TIMESTAMP(3),
ADD COLUMN     "discount_approved_by_membership_id" TEXT,
ADD COLUMN     "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "lost_reason_id" TEXT,
ADD COLUMN     "merged_at" TIMESTAMP(3),
ADD COLUMN     "merged_into_id" TEXT,
ADD COLUMN     "referring_partner_company_id" TEXT,
ADD COLUMN     "won_note" TEXT;

-- AlterTable
ALTER TABLE "crm_activities" ADD COLUMN     "comm_message_id" TEXT,
ADD COLUMN     "direction" "CrmActivityDirection",
ADD COLUMN     "recording_document_id" TEXT;

-- AlterTable
ALTER TABLE "number_sequences" ADD COLUMN     "format" TEXT,
ADD COLUMN     "reset_policy" "NumberResetPolicy" NOT NULL DEFAULT 'YEARLY';

-- AlterTable
ALTER TABLE "proposals" ADD COLUMN     "link_access_mode" "ProposalLinkAccessMode" NOT NULL DEFAULT 'ANYONE_WITH_LINK',
ADD COLUMN     "lost_reason" "ProposalLostReason",
ADD COLUMN     "reminder_days" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "proposal_approvals" ADD COLUMN     "due_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "proposal_comments" ADD COLUMN     "parent_comment_id" TEXT;

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "contract_signatories" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "contract_reviews" ADD COLUMN     "reviewer_contact_id" TEXT;

-- AlterTable
ALTER TABLE "contract_comments" ADD COLUMN     "parent_comment_id" TEXT;

-- AlterTable
ALTER TABLE "contract_change_requests" ADD COLUMN     "decision_note" TEXT;

-- AlterTable
ALTER TABLE "signers" DROP COLUMN "consent_text_version",
ADD COLUMN     "consent_text_id" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "contract_terminations" ADD COLUMN     "impact" JSONB;

-- AlterTable
ALTER TABLE "project_deliverables" ADD COLUMN     "approval_mode" "DeliverableApprovalMode" NOT NULL DEFAULT 'ANY_ONE';

-- AlterTable
ALTER TABLE "billing_profiles" ADD COLUMN     "reverse_charge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vat_validated_at" TIMESTAMP(3),
ADD COLUMN     "vat_validation_status" "VatValidationStatus" NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "tax_rates" ADD COLUMN     "invoice_note" TEXT,
ADD COLUMN     "is_reverse_charge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tax_category" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "sent_communication_id" TEXT,
ADD COLUMN     "uncollectible_at" TIMESTAMP(3),
ADD COLUMN     "uncollectible_reason" TEXT,
ADD COLUMN     "viewed_at" TIMESTAMP(3),
ADD COLUMN     "written_off_amount" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "payment_link_id" TEXT;

-- AlterTable
ALTER TABLE "ledger_payment_methods" ADD COLUMN     "currency" TEXT,
ADD COLUMN     "iban_last4" TEXT,
ADD COLUMN     "opening_balance" DECIMAL(18,2),
ADD COLUMN     "opening_date" DATE,
ADD COLUMN     "track_balance" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "rehire_eligible" BOOLEAN,
ADD COLUMN     "termination_kind" "EmployeeTerminationKind";

-- AlterTable
ALTER TABLE "company_holidays" ADD COLUMN     "country_code" TEXT;

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "ab_metric" "CampaignAbMetric",
ADD COLUMN     "ab_test_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ab_test_percent" INTEGER,
ADD COLUMN     "ab_wait_hours" INTEGER,
ADD COLUMN     "ab_winner_selected_at" TIMESTAMP(3),
ADD COLUMN     "preflight" JSONB,
ADD COLUMN     "preflight_checked_at" TIMESTAMP(3),
ADD COLUMN     "topic_id" TEXT;

-- AlterTable
ALTER TABLE "campaign_recipients" ADD COLUMN     "variant_id" TEXT;

-- AlterTable
ALTER TABLE "message_mentions" ADD COLUMN     "read_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "support_settings" ADD COLUMN     "csat_follow_up_threshold" INTEGER,
ADD COLUMN     "csat_question" TEXT,
ADD COLUMN     "csat_scale" "SupportCsatScale" NOT NULL DEFAULT 'STARS_5',
ADD COLUMN     "csat_thank_you" TEXT;

-- AlterTable
ALTER TABLE "support_inboxes" DROP COLUMN "routing_strategy",
ADD COLUMN     "routing_strategy" "SupportRoutingStrategy" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "support_channels" ADD COLUMN     "csat_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "source_message_id" TEXT;

-- AlterTable
ALTER TABLE "support_incidents" ADD COLUMN     "affected_services" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "severity" "SupportIncidentSeverity" NOT NULL DEFAULT 'MINOR';

-- AlterTable
ALTER TABLE "knowledge_articles" ADD COLUMN     "translation_group_id" TEXT;

-- AlterTable
ALTER TABLE "notification_events" ADD COLUMN     "context_company_id" TEXT,
ADD COLUMN     "context_project_id" TEXT;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "context_company_id" TEXT,
ADD COLUMN     "context_project_id" TEXT;

-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN     "entity_label" TEXT;

-- AlterTable
ALTER TABLE "wiki_spaces" ADD COLUMN     "allow_customer_visible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_membership_id" TEXT,
ADD COLUMN     "members_can_publish" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "require_review_before_publish" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "wiki_pages" ADD COLUMN     "ack_due_at" DATE,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_membership_id" TEXT;

-- AlterTable
ALTER TABLE "folders" ADD COLUMN     "legal_hold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "legal_hold_reason" TEXT,
ADD COLUMN     "legal_hold_set_at" TIMESTAMP(3),
ADD COLUMN     "legal_hold_set_by_user_id" TEXT;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "template_id" TEXT;

-- AlterTable
ALTER TABLE "document_shares" ADD COLUMN     "max_download_count" INTEGER;

-- AlterTable
ALTER TABLE "time_tracking_settings" ADD COLUMN     "locked_before_date" DATE,
ADD COLUMN     "locked_before_set_at" TIMESTAMP(3),
ADD COLUMN     "locked_before_set_by_membership_id" TEXT;

-- AlterTable
ALTER TABLE "calendars" ADD COLUMN     "feed_token" TEXT,
ADD COLUMN     "feed_token_rotated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "calendar_events" ADD COLUMN     "auto_decline_invitations" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "auto_reply_message" TEXT,
ADD COLUMN     "guests_can_see_guests" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "calendar_event_attendees" ADD COLUMN     "proposal_comment" TEXT,
ADD COLUMN     "proposed_at" TIMESTAMP(3),
ADD COLUMN     "proposed_ends_at" TIMESTAMP(3),
ADD COLUMN     "proposed_starts_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "automation_settings" ADD COLUMN     "dead_letter_alert_channel_id" TEXT,
ADD COLUMN     "dead_letter_alert_membership_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "dead_letter_alert_notify_rule_owner" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "automation_rules" ADD COLUMN     "draft_definition" JSONB,
ADD COLUMN     "draft_updated_at" TIMESTAMP(3),
ADD COLUMN     "draft_updated_by_membership_id" TEXT;

-- AlterTable
ALTER TABLE "automation_approvals" ADD COLUMN     "escalated_at" TIMESTAMP(3),
ADD COLUMN     "escalated_to_membership_id" TEXT,
ADD COLUMN     "policy_id" TEXT;

-- AlterTable
ALTER TABLE "outbound_webhooks" ADD COLUMN     "previous_secret" TEXT,
ADD COLUMN     "previous_secret_expires_at" TIMESTAMP(3),
ADD COLUMN     "secret_rotated_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "user_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "fingerprint_hash" TEXT NOT NULL,
    "label" TEXT,
    "platform" TEXT,
    "browser" TEXT,
    "last_ip" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trusted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_retention_policies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "data_class" "OrganizationRetentionDataClass" NOT NULL,
    "retention_days" INTEGER,
    "action" "OrganizationRetentionAction" NOT NULL DEFAULT 'ARCHIVE',
    "legal_hold" BOOLEAN NOT NULL DEFAULT false,
    "legal_hold_reason" TEXT,
    "last_run_at" TIMESTAMP(3),
    "updated_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_plans" (
    "organization_id" TEXT NOT NULL,
    "plan_key" TEXT NOT NULL,
    "status" "OrganizationPlanStatus" NOT NULL DEFAULT 'TRIALING',
    "seats" INTEGER NOT NULL DEFAULT 1,
    "limits" JSONB,
    "billing_email" TEXT,
    "trial_ends_at" TIMESTAMP(3),
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "payment_provider_ref" TEXT,
    "payment_method" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_plans_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "organization_plan_invoices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "OrganizationPlanInvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "currency" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "provider_invoice_id" TEXT,
    "hosted_invoice_url" TEXT,
    "pdf_url" TEXT,

    CONSTRAINT "organization_plan_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_entitlements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "limit_value" BIGINT,
    "period" "EntitlementPeriod" NOT NULL DEFAULT 'LIFETIME',
    "enforcement" "EntitlementEnforcement" NOT NULL DEFAULT 'HARD',
    "source" "EntitlementSource" NOT NULL DEFAULT 'PLAN',
    "valid_until" TIMESTAMP(3),
    "note" TEXT,
    "set_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_tool_calls" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "permission_key" TEXT,
    "module" "ModuleKey",
    "actor_type" "AuditActorType" NOT NULL DEFAULT 'SERVICE_ACCOUNT',
    "api_key_id" TEXT,
    "service_account_id" TEXT,
    "actor_membership_id" TEXT,
    "client_name" TEXT,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "status" "McpToolCallStatus" NOT NULL DEFAULT 'SUCCEEDED',
    "requires_confirmation" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_by_membership_id" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "input_summary" JSONB,
    "error_code" TEXT,
    "duration_ms" INTEGER,
    "audit_event_id" TEXT,
    "automation_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_tool_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key_usage_daily" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "api_key_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "rejected" INTEGER NOT NULL DEFAULT 0,
    "last_ip" TEXT,
    "seen_ips" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "api_key_usage_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_portal_membership_projects" (
    "portal_membership_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_portal_membership_projects_pkey" PRIMARY KEY ("portal_membership_id","project_id")
);

-- CreateTable
CREATE TABLE "crm_merge_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entity_type" "RecordEntityType" NOT NULL,
    "survivor_id" TEXT NOT NULL,
    "merged_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "field_choices" JSONB,
    "moved_counts" JSONB,
    "merged_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_merge_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_duplicate_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entity_type" "RecordEntityType" NOT NULL,
    "match_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "min_score" INTEGER NOT NULL DEFAULT 50,
    "auto_check" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_duplicate_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_duplicate_dismissals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entity_type" "RecordEntityType" NOT NULL,
    "record_a_id" TEXT NOT NULL,
    "record_b_id" TEXT NOT NULL,
    "dismissed_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_duplicate_dismissals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_loss_reasons" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "applies_to" "CrmLossReasonScope" NOT NULL DEFAULT 'BOTH',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_loss_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_import_mappings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entity_type" "RecordEntityType" NOT NULL,
    "field_mapping" JSONB NOT NULL,
    "duplicate_strategy" JSONB,
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_import_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_discount_policies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "max_percent" DECIMAL(5,2) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_discount_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_report_schedules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "report_key" TEXT NOT NULL,
    "filters" JSONB,
    "format" "CrmReportFormat" NOT NULL DEFAULT 'PDF',
    "recipient_membership_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recipient_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "owner_membership_id" TEXT,
    "scheduled_job_id" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_template_versions" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "branding" JSONB,
    "layout" JSONB,
    "sections" JSONB NOT NULL,
    "defaults" JSONB,
    "variables" JSONB,
    "default_validity_days" INTEGER NOT NULL DEFAULT 30,
    "change_summary" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_ai_findings" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "section_id" TEXT,
    "kind" "ProposalAiFindingKind" NOT NULL,
    "severity" "ProposalAiFindingSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "recommendation" TEXT,
    "status" "ProposalAiFindingStatus" NOT NULL DEFAULT 'OPEN',
    "model" TEXT,
    "review_run_id" TEXT,
    "reviewed_by_membership_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_ai_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature_consent_texts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "body" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "retired_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_consent_texts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "purpose" "VerificationPurpose" NOT NULL,
    "channel" "VerificationChannel" NOT NULL,
    "signer_id" TEXT,
    "proposal_id" TEXT,
    "recipient" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "locked_until" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_renewal_decisions" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "decision" "ContractRenewalDecisionType" NOT NULL,
    "reason" TEXT,
    "decided_by_user_id" TEXT,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resulting_contract_id" TEXT,

    CONSTRAINT "contract_renewal_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_deliverable_approvers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "deliverable_id" TEXT NOT NULL,
    "portal_membership_id" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "notified_at" TIMESTAMP(3),
    "reminded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_deliverable_approvers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_portal_client_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "features" JSONB,
    "default_role_slug" TEXT,
    "welcome_message" TEXT,
    "branding" JSONB,
    "disabled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_portal_client_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_links" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "billing_profile_id" TEXT,
    "invoice_id" TEXT,
    "price_id" TEXT,
    "provider_connection_id" TEXT,
    "provider_link_id" TEXT,
    "public_token" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(18,2),
    "currency" TEXT NOT NULL,
    "allow_custom_amount" BOOLEAN NOT NULL DEFAULT false,
    "url" TEXT NOT NULL,
    "status" "PaymentLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "accepted_methods" "PaymentMethodType"[] DEFAULT ARRAY['CARD', 'BANK_TRANSFER']::"PaymentMethodType"[],
    "expires_at" TIMESTAMP(3),
    "max_uses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_disputes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider_connection_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "provider_dispute_id" TEXT NOT NULL,
    "status" "PaymentDisputeStatus" NOT NULL DEFAULT 'OPEN',
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "reason" TEXT,
    "evidence_due_at" TIMESTAMP(3),
    "evidence_submitted_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "outcome_note" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_payouts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider_connection_id" TEXT NOT NULL,
    "provider_payout_id" TEXT NOT NULL,
    "status" "PaymentPayoutStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "fee_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "arrival_date" DATE,
    "paid_at" TIMESTAMP(3),
    "bank_reference" TEXT,
    "reconciled_at" TIMESTAMP(3),
    "reconciled_ledger_record_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_approval_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entity_type" "FinanceApprovalEntityType" NOT NULL,
    "record_type" "LedgerRecordType",
    "min_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "max_amount" DECIMAL(18,2),
    "currency" TEXT,
    "branch_id" TEXT,
    "steps" JSONB NOT NULL,
    "require_distinct_user" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_approval_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_approvals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entity_type" "FinanceApprovalEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "rule_id" TEXT,
    "step" INTEGER NOT NULL DEFAULT 1,
    "approver_membership_id" TEXT,
    "approver_role_id" TEXT,
    "decision" "FinanceApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "requested_by_membership_id" TEXT,
    "decided_by_membership_id" TEXT,
    "amount" DECIMAL(18,2),
    "currency" TEXT,
    "comment" TEXT,
    "rejection_reason" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "finance_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_report_schedules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "report_key" TEXT NOT NULL,
    "filters" JSONB,
    "basis" "LedgerReportBasis",
    "format" "FinanceReportFormat" NOT NULL DEFAULT 'PDF',
    "frequency" "BillingInterval" NOT NULL DEFAULT 'MONTH',
    "send_day" INTEGER,
    "recipient_membership_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recipient_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "scheduled_job_id" TEXT,
    "next_run_at" TIMESTAMP(3),
    "last_run_at" TIMESTAMP(3),
    "last_error" TEXT,
    "last_document_id" TEXT,
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_balance_snapshots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "payment_method_id" TEXT NOT NULL,
    "as_of" DATE NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "note" TEXT,
    "recorded_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_balance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_budgets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "scope" "LedgerBudgetScope" NOT NULL DEFAULT 'CATEGORY',
    "basis" "LedgerReportBasis" NOT NULL DEFAULT 'ACCRUAL',
    "currency" TEXT NOT NULL,
    "owner_membership_id" TEXT,
    "status" "LedgerBudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "warn_percent" INTEGER NOT NULL DEFAULT 80,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_budget_lines" (
    "id" TEXT NOT NULL,
    "budget_id" TEXT NOT NULL,
    "subject_key" TEXT NOT NULL,
    "category_id" TEXT,
    "project_id" TEXT,
    "department_id" TEXT,
    "month" INTEGER NOT NULL,
    "planned_amount" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_budget_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vat_returns" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "basis" "LedgerReportBasis" NOT NULL DEFAULT 'ACCRUAL',
    "currency" TEXT NOT NULL,
    "vat_collected" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vat_paid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net_vat" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "VatReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "filed_at" TIMESTAMP(3),
    "filed_by_membership_id" TEXT,
    "authority_reference" TEXT,
    "paid_at" TIMESTAMP(3),
    "document_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vat_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_claims" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "employee_name_snapshot" TEXT,
    "title" TEXT NOT NULL,
    "status" "ExpenseClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL,
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vat_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMP(3),
    "approver_membership_id" TEXT,
    "decided_by_membership_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "paid_at" TIMESTAMP(3),
    "payroll_entry_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_claim_lines" (
    "id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "expense_date" DATE NOT NULL,
    "category_id" TEXT,
    "project_id" TEXT,
    "description" TEXT NOT NULL,
    "merchant" TEXT,
    "gross_amount" DECIMAL(18,2) NOT NULL,
    "vat_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "document_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_claim_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_equipment" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "asset_type" "EmployeeEquipmentType" NOT NULL DEFAULT 'OTHER',
    "name" TEXT NOT NULL,
    "serial_number" TEXT,
    "assigned_on" DATE NOT NULL,
    "expected_return_on" DATE,
    "returned_on" DATE,
    "condition" "EmployeeEquipmentCondition" NOT NULL DEFAULT 'GOOD',
    "document_id" TEXT,
    "notes" TEXT,
    "assigned_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_feedback_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "requested_by_membership_id" TEXT,
    "requested_from_membership_id" TEXT NOT NULL,
    "review_id" TEXT,
    "cycle_id" TEXT,
    "status" "PerformanceFeedbackRequestStatus" NOT NULL DEFAULT 'PENDING',
    "due_date" DATE,
    "message" TEXT,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "feedback_id" TEXT,
    "decline_reason" TEXT,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_feedback_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_calibrations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "original_rating" DECIMAL(4,2),
    "calibrated_rating" DECIMAL(4,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "calibrated_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_calibrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_allocation_skills" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "allocation_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "min_proficiency" "SkillProficiency" NOT NULL DEFAULT 'INTERMEDIATE',
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_allocation_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_import_jobs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "status" "EmployeeImportStatus" NOT NULL DEFAULT 'PENDING',
    "file_name" TEXT,
    "document_id" TEXT,
    "mapping" JSONB,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "created_rows" INTEGER NOT NULL DEFAULT 0,
    "updated_rows" INTEGER NOT NULL DEFAULT 0,
    "skipped_rows" INTEGER NOT NULL DEFAULT 0,
    "error_rows" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "error_report_document_id" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_variants" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "subject" TEXT,
    "preheader" TEXT,
    "body_html" TEXT,
    "body_text" TEXT,
    "share_percent" INTEGER,
    "is_winner" BOOLEAN NOT NULL DEFAULT false,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "opened_count" INTEGER NOT NULL DEFAULT 0,
    "clicked_count" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_topics" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "channel" "CommChannel",
    "default_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comm_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_topic_subscriptions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "status" "CommConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "source" "CommConsentSource" NOT NULL DEFAULT 'MANUAL',
    "updated_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comm_topic_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_settings" (
    "organization_id" TEXT NOT NULL,
    "approval_required" BOOLEAN NOT NULL DEFAULT false,
    "approval_min_recipients" INTEGER,
    "quiet_hours_start" TEXT,
    "quiet_hours_end" TEXT,
    "max_marketing_per_week" INTEGER,
    "footer_address" TEXT,
    "double_opt_in_default" BOOLEAN NOT NULL DEFAULT true,
    "retention_days_bodies" INTEGER,
    "retention_days_event_pii" INTEGER,
    "default_language" TEXT,
    "default_timezone" TEXT,
    "updated_by_membership_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comm_settings_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "channel_invitations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "ChannelMemberRole" NOT NULL DEFAULT 'GUEST',
    "guest_kind" "ChannelGuestKind",
    "external_label" TEXT,
    "access_expires_at" TIMESTAMP(3),
    "token_hash" TEXT NOT NULL,
    "status" "ChannelInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invited_by_user_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "external_user_id" TEXT,
    "revoked_at" TIMESTAMP(3),
    "last_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_access_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "kind" "ChannelAccessRequestKind" NOT NULL DEFAULT 'JOIN',
    "note" TEXT,
    "status" "ChannelAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decided_by_user_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging_legal_holds" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "channel_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "membership_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "date_from" DATE,
    "date_to" DATE,
    "created_by_user_id" TEXT,
    "released_at" TIMESTAMP(3),
    "released_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_legal_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_incident_updates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "incident_id" TEXT NOT NULL,
    "status" "SupportIncidentUpdateStatus" NOT NULL,
    "body" TEXT NOT NULL,
    "customer_visible" BOOLEAN NOT NULL DEFAULT false,
    "author_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_incident_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_agent_profiles" (
    "membership_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "availability" "SupportAgentAvailability" NOT NULL DEFAULT 'OFFLINE',
    "max_open_conversations" INTEGER,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_assigned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_agent_profiles_pkey" PRIMARY KEY ("membership_id")
);

-- CreateTable
CREATE TABLE "notification_template_versions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "template_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "subject" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "html_body" TEXT,
    "cta_label" TEXT,
    "cta_url" TEXT,
    "variables" JSONB,
    "changed_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "severity" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "audience" JSONB,
    "portal_visible" BOOLEAN NOT NULL DEFAULT false,
    "requires_ack" BOOLEAN NOT NULL DEFAULT false,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "publish_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "withdrawn_at" TIMESTAMP(3),
    "incident_id" TEXT,
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_acknowledgements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "announcement_id" TEXT NOT NULL,
    "membership_id" TEXT,
    "portal_membership_id" TEXT,
    "acknowledged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "module" "ModuleKey" NOT NULL,
    "summary" TEXT NOT NULL,
    "entity_type" "RecordEntityType",
    "entity_id" TEXT,
    "entity_label" TEXT,
    "actor_membership_id" TEXT,
    "actor_user_id" TEXT,
    "project_id" TEXT,
    "company_id" TEXT,
    "branch_id" TEXT,
    "customer_visible" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "audit_event_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_page_views" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "version_number" INTEGER,
    "source" "WikiPageViewSource" NOT NULL DEFAULT 'UI',
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wiki_page_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_page_view_daily" (
    "page_id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "organization_id" TEXT NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "unique_readers" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "wiki_page_view_daily_pkey" PRIMARY KEY ("page_id","day")
);

-- CreateTable
CREATE TABLE "wiki_search_queries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "membership_id" TEXT,
    "query" TEXT NOT NULL,
    "mode" "WikiSearchMode" NOT NULL DEFAULT 'KEYWORD',
    "filters" JSONB,
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "clicked_page_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wiki_search_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_page_feedback" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "comment" TEXT,
    "version_number" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_page_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_transfer_jobs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "WikiTransferKind" NOT NULL,
    "format" "WikiTransferFormat" NOT NULL,
    "scope" "WikiTransferScope" NOT NULL DEFAULT 'PAGE',
    "space_id" TEXT,
    "page_id" TEXT,
    "source_document_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "result_document_id" TEXT,
    "status" "WikiTransferStatus" NOT NULL DEFAULT 'QUEUED',
    "page_count" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "error_report" JSONB,
    "requested_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "wiki_transfer_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_page_ack_targets" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "principal_type" "WikiPrincipalType" NOT NULL,
    "principal_id" TEXT NOT NULL,
    "due_at" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wiki_page_ack_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_page_watchers" (
    "page_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wiki_page_watchers_pkey" PRIMARY KEY ("page_id","membership_id")
);

-- CreateTable
CREATE TABLE "wiki_page_review_requests" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "requested_by_membership_id" TEXT,
    "reviewer_membership_id" TEXT NOT NULL,
    "status" "WikiReviewRequestStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wiki_page_review_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category_id" TEXT,
    "folder_id" TEXT,
    "scope" "DocumentScope" NOT NULL DEFAULT 'ORGANIZATION',
    "source_version_id" TEXT NOT NULL,
    "variables" JSONB,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_report_schedules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "report_key" TEXT NOT NULL,
    "saved_view_id" TEXT,
    "filters" JSONB NOT NULL,
    "format" "TimeReportFormat" NOT NULL DEFAULT 'CSV',
    "frequency" "TimeReportFrequency" NOT NULL DEFAULT 'WEEKLY',
    "day_of_week" INTEGER,
    "day_of_month" INTEGER,
    "time_of_day" TEXT NOT NULL DEFAULT '08:00',
    "timezone" TEXT NOT NULL,
    "recipient_membership_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recipient_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "next_run_at" TIMESTAMP(3),
    "last_run_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_exports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "report_key" TEXT NOT NULL,
    "schedule_id" TEXT,
    "format" "TimeReportFormat" NOT NULL DEFAULT 'CSV',
    "status" "TimeExportStatus" NOT NULL DEFAULT 'PENDING',
    "filters" JSONB NOT NULL,
    "row_count" INTEGER,
    "file_document_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_link_stats_daily" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "booking_link_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "page_views" INTEGER NOT NULL DEFAULT 0,
    "unique_visitors" INTEGER NOT NULL DEFAULT 0,
    "slot_selections" INTEGER NOT NULL DEFAULT 0,
    "bookings_created" INTEGER NOT NULL DEFAULT 0,
    "bookings_cancelled" INTEGER NOT NULL DEFAULT 0,
    "sources" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_link_stats_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_approval_policies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "approver_membership_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approver_team_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approver_role_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allow_rule_owner" BOOLEAN NOT NULL DEFAULT false,
    "expires_after_hours" INTEGER,
    "escalate_after_hours" INTEGER,
    "escalate_to_membership_id" TEXT,
    "delegate_when_out_of_office" BOOLEAN NOT NULL DEFAULT true,
    "created_by_membership_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_approval_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_devices_user_id_revoked_at_idx" ON "user_devices"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_user_id_fingerprint_hash_key" ON "user_devices"("user_id", "fingerprint_hash");

-- CreateIndex
CREATE INDEX "organization_retention_policies_updated_by_membership_id_idx" ON "organization_retention_policies"("updated_by_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_retention_policies_organization_id_data_class_key" ON "organization_retention_policies"("organization_id", "data_class");

-- CreateIndex
CREATE INDEX "organization_plan_invoices_organization_id_issued_at_idx" ON "organization_plan_invoices"("organization_id", "issued_at");

-- CreateIndex
CREATE UNIQUE INDEX "organization_plan_invoices_organization_id_number_key" ON "organization_plan_invoices"("organization_id", "number");

-- CreateIndex
CREATE INDEX "organization_entitlements_key_idx" ON "organization_entitlements"("key");

-- CreateIndex
CREATE UNIQUE INDEX "organization_entitlements_organization_id_key_key" ON "organization_entitlements"("organization_id", "key");

-- CreateIndex
CREATE INDEX "mcp_tool_calls_organization_id_created_at_idx" ON "mcp_tool_calls"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "mcp_tool_calls_organization_id_status_created_at_idx" ON "mcp_tool_calls"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "mcp_tool_calls_organization_id_tool_name_created_at_idx" ON "mcp_tool_calls"("organization_id", "tool_name", "created_at");

-- CreateIndex
CREATE INDEX "mcp_tool_calls_api_key_id_idx" ON "mcp_tool_calls"("api_key_id");

-- CreateIndex
CREATE INDEX "mcp_tool_calls_service_account_id_idx" ON "mcp_tool_calls"("service_account_id");

-- CreateIndex
CREATE INDEX "mcp_tool_calls_actor_membership_id_idx" ON "mcp_tool_calls"("actor_membership_id");

-- CreateIndex
CREATE INDEX "api_key_usage_daily_organization_id_date_idx" ON "api_key_usage_daily"("organization_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "api_key_usage_daily_api_key_id_date_key" ON "api_key_usage_daily"("api_key_id", "date");

-- CreateIndex
CREATE INDEX "customer_portal_membership_projects_project_id_idx" ON "customer_portal_membership_projects"("project_id");

-- CreateIndex
CREATE INDEX "customer_portal_membership_projects_organization_id_idx" ON "customer_portal_membership_projects"("organization_id");

-- CreateIndex
CREATE INDEX "crm_merge_logs_organization_id_entity_type_survivor_id_idx" ON "crm_merge_logs"("organization_id", "entity_type", "survivor_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_duplicate_rules_organization_id_entity_type_key" ON "crm_duplicate_rules"("organization_id", "entity_type");

-- CreateIndex
CREATE UNIQUE INDEX "crm_duplicate_dismissals_organization_id_entity_type_record_key" ON "crm_duplicate_dismissals"("organization_id", "entity_type", "record_a_id", "record_b_id");

-- CreateIndex
CREATE INDEX "crm_loss_reasons_organization_id_archived_at_idx" ON "crm_loss_reasons"("organization_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "crm_loss_reasons_organization_id_slug_key" ON "crm_loss_reasons"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "crm_import_mappings_organization_id_entity_type_name_key" ON "crm_import_mappings"("organization_id", "entity_type", "name");

-- CreateIndex
CREATE UNIQUE INDEX "crm_discount_policies_organization_id_role_id_key" ON "crm_discount_policies"("organization_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_report_schedules_scheduled_job_id_key" ON "crm_report_schedules"("scheduled_job_id");

-- CreateIndex
CREATE INDEX "crm_report_schedules_organization_id_enabled_idx" ON "crm_report_schedules"("organization_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_template_versions_template_id_version_number_key" ON "proposal_template_versions"("template_id", "version_number");

-- CreateIndex
CREATE INDEX "proposal_ai_findings_version_id_status_idx" ON "proposal_ai_findings"("version_id", "status");

-- CreateIndex
CREATE INDEX "signature_consent_texts_organization_id_locale_effective_da_idx" ON "signature_consent_texts"("organization_id", "locale", "effective_date");

-- CreateIndex
CREATE UNIQUE INDEX "signature_consent_texts_organization_id_version_locale_key" ON "signature_consent_texts"("organization_id", "version", "locale");

-- CreateIndex
CREATE INDEX "verification_codes_signer_id_created_at_idx" ON "verification_codes"("signer_id", "created_at");

-- CreateIndex
CREATE INDEX "verification_codes_proposal_id_created_at_idx" ON "verification_codes"("proposal_id", "created_at");

-- CreateIndex
CREATE INDEX "verification_codes_expires_at_idx" ON "verification_codes"("expires_at");

-- CreateIndex
CREATE INDEX "contract_renewal_decisions_contract_id_decided_at_idx" ON "contract_renewal_decisions"("contract_id", "decided_at");

-- CreateIndex
CREATE INDEX "project_deliverable_approvers_portal_membership_id_idx" ON "project_deliverable_approvers"("portal_membership_id");

-- CreateIndex
CREATE INDEX "project_deliverable_approvers_organization_id_idx" ON "project_deliverable_approvers"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_deliverable_approvers_deliverable_id_portal_members_key" ON "project_deliverable_approvers"("deliverable_id", "portal_membership_id");

-- CreateIndex
CREATE INDEX "customer_portal_client_settings_company_id_idx" ON "customer_portal_client_settings"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_portal_client_settings_organization_id_company_id_key" ON "customer_portal_client_settings"("organization_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_links_public_token_key" ON "payment_links"("public_token");

-- CreateIndex
CREATE INDEX "payment_links_organization_id_status_idx" ON "payment_links"("organization_id", "status");

-- CreateIndex
CREATE INDEX "payment_links_invoice_id_idx" ON "payment_links"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_links_provider_connection_id_provider_link_id_key" ON "payment_links"("provider_connection_id", "provider_link_id");

-- CreateIndex
CREATE INDEX "payment_disputes_organization_id_status_idx" ON "payment_disputes"("organization_id", "status");

-- CreateIndex
CREATE INDEX "payment_disputes_payment_id_idx" ON "payment_disputes"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_disputes_provider_connection_id_provider_dispute_id_key" ON "payment_disputes"("provider_connection_id", "provider_dispute_id");

-- CreateIndex
CREATE INDEX "payment_payouts_organization_id_status_idx" ON "payment_payouts"("organization_id", "status");

-- CreateIndex
CREATE INDEX "payment_payouts_arrival_date_idx" ON "payment_payouts"("arrival_date");

-- CreateIndex
CREATE UNIQUE INDEX "payment_payouts_provider_connection_id_provider_payout_id_key" ON "payment_payouts"("provider_connection_id", "provider_payout_id");

-- CreateIndex
CREATE INDEX "finance_approval_rules_organization_id_entity_type_enabled__idx" ON "finance_approval_rules"("organization_id", "entity_type", "enabled", "priority");

-- CreateIndex
CREATE INDEX "finance_approvals_organization_id_entity_type_entity_id_idx" ON "finance_approvals"("organization_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "finance_approvals_approver_membership_id_decision_idx" ON "finance_approvals"("approver_membership_id", "decision");

-- CreateIndex
CREATE INDEX "finance_approvals_organization_id_decision_idx" ON "finance_approvals"("organization_id", "decision");

-- CreateIndex
CREATE INDEX "finance_report_schedules_organization_id_enabled_next_run_a_idx" ON "finance_report_schedules"("organization_id", "enabled", "next_run_at");

-- CreateIndex
CREATE INDEX "ledger_balance_snapshots_organization_id_as_of_idx" ON "ledger_balance_snapshots"("organization_id", "as_of");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_balance_snapshots_payment_method_id_as_of_key" ON "ledger_balance_snapshots"("payment_method_id", "as_of");

-- CreateIndex
CREATE INDEX "ledger_budgets_organization_id_fiscal_year_status_idx" ON "ledger_budgets"("organization_id", "fiscal_year", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_budgets_organization_id_name_fiscal_year_key" ON "ledger_budgets"("organization_id", "name", "fiscal_year");

-- CreateIndex
CREATE INDEX "ledger_budget_lines_category_id_idx" ON "ledger_budget_lines"("category_id");

-- CreateIndex
CREATE INDEX "ledger_budget_lines_project_id_idx" ON "ledger_budget_lines"("project_id");

-- CreateIndex
CREATE INDEX "ledger_budget_lines_department_id_idx" ON "ledger_budget_lines"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_budget_lines_budget_id_subject_key_month_key" ON "ledger_budget_lines"("budget_id", "subject_key", "month");

-- CreateIndex
CREATE INDEX "vat_returns_organization_id_status_idx" ON "vat_returns"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vat_returns_period_id_basis_key" ON "vat_returns"("period_id", "basis");

-- CreateIndex
CREATE UNIQUE INDEX "expense_claims_payroll_entry_id_key" ON "expense_claims"("payroll_entry_id");

-- CreateIndex
CREATE INDEX "expense_claims_organization_id_employee_id_status_idx" ON "expense_claims"("organization_id", "employee_id", "status");

-- CreateIndex
CREATE INDEX "expense_claims_organization_id_status_idx" ON "expense_claims"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "expense_claims_organization_id_number_key" ON "expense_claims"("organization_id", "number");

-- CreateIndex
CREATE INDEX "expense_claim_lines_claim_id_idx" ON "expense_claim_lines"("claim_id");

-- CreateIndex
CREATE INDEX "expense_claim_lines_category_id_idx" ON "expense_claim_lines"("category_id");

-- CreateIndex
CREATE INDEX "expense_claim_lines_project_id_idx" ON "expense_claim_lines"("project_id");

-- CreateIndex
CREATE INDEX "employee_equipment_organization_id_employee_id_idx" ON "employee_equipment"("organization_id", "employee_id");

-- CreateIndex
CREATE INDEX "employee_equipment_employee_id_returned_on_idx" ON "employee_equipment"("employee_id", "returned_on");

-- CreateIndex
CREATE INDEX "employee_equipment_document_id_idx" ON "employee_equipment"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "performance_feedback_requests_feedback_id_key" ON "performance_feedback_requests"("feedback_id");

-- CreateIndex
CREATE INDEX "performance_feedback_requests_requested_from_membership_id__idx" ON "performance_feedback_requests"("requested_from_membership_id", "status");

-- CreateIndex
CREATE INDEX "performance_feedback_requests_employee_id_status_idx" ON "performance_feedback_requests"("employee_id", "status");

-- CreateIndex
CREATE INDEX "performance_feedback_requests_organization_id_status_idx" ON "performance_feedback_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "performance_feedback_requests_review_id_idx" ON "performance_feedback_requests"("review_id");

-- CreateIndex
CREATE INDEX "performance_feedback_requests_cycle_id_idx" ON "performance_feedback_requests"("cycle_id");

-- CreateIndex
CREATE INDEX "performance_calibrations_cycle_id_idx" ON "performance_calibrations"("cycle_id");

-- CreateIndex
CREATE INDEX "performance_calibrations_review_id_created_at_idx" ON "performance_calibrations"("review_id", "created_at");

-- CreateIndex
CREATE INDEX "performance_calibrations_organization_id_idx" ON "performance_calibrations"("organization_id");

-- CreateIndex
CREATE INDEX "project_allocation_skills_skill_id_idx" ON "project_allocation_skills"("skill_id");

-- CreateIndex
CREATE INDEX "project_allocation_skills_organization_id_idx" ON "project_allocation_skills"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_allocation_skills_allocation_id_skill_id_key" ON "project_allocation_skills"("allocation_id", "skill_id");

-- CreateIndex
CREATE INDEX "employee_import_jobs_organization_id_status_idx" ON "employee_import_jobs"("organization_id", "status");

-- CreateIndex
CREATE INDEX "employee_import_jobs_document_id_idx" ON "employee_import_jobs"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_variants_campaign_id_label_key" ON "campaign_variants"("campaign_id", "label");

-- CreateIndex
CREATE INDEX "comm_topics_organization_id_archived_at_idx" ON "comm_topics"("organization_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "comm_topics_organization_id_slug_key" ON "comm_topics"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "comm_topic_subscriptions_organization_id_topic_id_status_idx" ON "comm_topic_subscriptions"("organization_id", "topic_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "comm_topic_subscriptions_contact_id_topic_id_key" ON "comm_topic_subscriptions"("contact_id", "topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_invitations_token_hash_key" ON "channel_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "channel_invitations_channel_id_status_idx" ON "channel_invitations"("channel_id", "status");

-- CreateIndex
CREATE INDEX "channel_invitations_organization_id_status_idx" ON "channel_invitations"("organization_id", "status");

-- CreateIndex
CREATE INDEX "channel_invitations_email_idx" ON "channel_invitations"("email");

-- CreateIndex
CREATE INDEX "channel_invitations_expires_at_idx" ON "channel_invitations"("expires_at");

-- CreateIndex
CREATE INDEX "channel_access_requests_channel_id_status_idx" ON "channel_access_requests"("channel_id", "status");

-- CreateIndex
CREATE INDEX "channel_access_requests_membership_id_status_idx" ON "channel_access_requests"("membership_id", "status");

-- CreateIndex
CREATE INDEX "channel_access_requests_organization_id_status_idx" ON "channel_access_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "messaging_legal_holds_organization_id_released_at_idx" ON "messaging_legal_holds"("organization_id", "released_at");

-- CreateIndex
CREATE INDEX "support_incident_updates_incident_id_created_at_idx" ON "support_incident_updates"("incident_id", "created_at");

-- CreateIndex
CREATE INDEX "support_incident_updates_organization_id_idx" ON "support_incident_updates"("organization_id");

-- CreateIndex
CREATE INDEX "support_agent_profiles_organization_id_availability_idx" ON "support_agent_profiles"("organization_id", "availability");

-- CreateIndex
CREATE INDEX "notification_template_versions_organization_id_idx" ON "notification_template_versions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_template_versions_template_id_version_key" ON "notification_template_versions"("template_id", "version");

-- CreateIndex
CREATE INDEX "announcements_organization_id_status_publish_at_idx" ON "announcements"("organization_id", "status", "publish_at");

-- CreateIndex
CREATE INDEX "announcements_organization_id_portal_visible_status_idx" ON "announcements"("organization_id", "portal_visible", "status");

-- CreateIndex
CREATE INDEX "announcements_incident_id_idx" ON "announcements"("incident_id");

-- CreateIndex
CREATE INDEX "announcement_acknowledgements_organization_id_idx" ON "announcement_acknowledgements"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_acknowledgements_announcement_id_membership_id_key" ON "announcement_acknowledgements"("announcement_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_acknowledgements_announcement_id_portal_member_key" ON "announcement_acknowledgements"("announcement_id", "portal_membership_id");

-- CreateIndex
CREATE INDEX "activity_events_organization_id_occurred_at_idx" ON "activity_events"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "activity_events_organization_id_project_id_occurred_at_idx" ON "activity_events"("organization_id", "project_id", "occurred_at");

-- CreateIndex
CREATE INDEX "activity_events_organization_id_company_id_customer_visible_idx" ON "activity_events"("organization_id", "company_id", "customer_visible", "occurred_at");

-- CreateIndex
CREATE INDEX "activity_events_entity_type_entity_id_occurred_at_idx" ON "activity_events"("entity_type", "entity_id", "occurred_at");

-- CreateIndex
CREATE INDEX "activity_events_organization_id_branch_id_occurred_at_idx" ON "activity_events"("organization_id", "branch_id", "occurred_at");

-- CreateIndex
CREATE INDEX "wiki_page_views_membership_id_viewed_at_idx" ON "wiki_page_views"("membership_id", "viewed_at" DESC);

-- CreateIndex
CREATE INDEX "wiki_page_views_page_id_viewed_at_idx" ON "wiki_page_views"("page_id", "viewed_at");

-- CreateIndex
CREATE INDEX "wiki_page_views_organization_id_viewed_at_idx" ON "wiki_page_views"("organization_id", "viewed_at");

-- CreateIndex
CREATE INDEX "wiki_page_view_daily_organization_id_day_idx" ON "wiki_page_view_daily"("organization_id", "day");

-- CreateIndex
CREATE INDEX "wiki_search_queries_organization_id_created_at_idx" ON "wiki_search_queries"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "wiki_search_queries_organization_id_result_count_created_at_idx" ON "wiki_search_queries"("organization_id", "result_count", "created_at");

-- CreateIndex
CREATE INDEX "wiki_page_feedback_organization_id_created_at_idx" ON "wiki_page_feedback"("organization_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_page_feedback_page_id_membership_id_key" ON "wiki_page_feedback"("page_id", "membership_id");

-- CreateIndex
CREATE INDEX "wiki_transfer_jobs_organization_id_status_created_at_idx" ON "wiki_transfer_jobs"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "wiki_page_ack_targets_principal_type_principal_id_idx" ON "wiki_page_ack_targets"("principal_type", "principal_id");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_page_ack_targets_page_id_principal_type_principal_id_key" ON "wiki_page_ack_targets"("page_id", "principal_type", "principal_id");

-- CreateIndex
CREATE INDEX "wiki_page_watchers_membership_id_idx" ON "wiki_page_watchers"("membership_id");

-- CreateIndex
CREATE INDEX "wiki_page_review_requests_page_id_version_number_idx" ON "wiki_page_review_requests"("page_id", "version_number");

-- CreateIndex
CREATE INDEX "wiki_page_review_requests_reviewer_membership_id_status_idx" ON "wiki_page_review_requests"("reviewer_membership_id", "status");

-- CreateIndex
CREATE INDEX "document_templates_organization_id_archived_at_idx" ON "document_templates"("organization_id", "archived_at");

-- CreateIndex
CREATE INDEX "document_templates_category_id_idx" ON "document_templates"("category_id");

-- CreateIndex
CREATE INDEX "document_templates_folder_id_idx" ON "document_templates"("folder_id");

-- CreateIndex
CREATE INDEX "document_templates_source_version_id_idx" ON "document_templates"("source_version_id");

-- CreateIndex
CREATE INDEX "time_report_schedules_organization_id_is_active_idx" ON "time_report_schedules"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "time_report_schedules_is_active_next_run_at_idx" ON "time_report_schedules"("is_active", "next_run_at");

-- CreateIndex
CREATE INDEX "time_report_schedules_created_by_membership_id_idx" ON "time_report_schedules"("created_by_membership_id");

-- CreateIndex
CREATE INDEX "time_exports_organization_id_created_at_idx" ON "time_exports"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "time_exports_organization_id_status_idx" ON "time_exports"("organization_id", "status");

-- CreateIndex
CREATE INDEX "time_exports_schedule_id_idx" ON "time_exports"("schedule_id");

-- CreateIndex
CREATE INDEX "time_exports_created_by_membership_id_idx" ON "time_exports"("created_by_membership_id");

-- CreateIndex
CREATE INDEX "booking_link_stats_daily_organization_id_date_idx" ON "booking_link_stats_daily"("organization_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "booking_link_stats_daily_booking_link_id_date_key" ON "booking_link_stats_daily"("booking_link_id", "date");

-- CreateIndex
CREATE INDEX "automation_approval_policies_organization_id_archived_at_idx" ON "automation_approval_policies"("organization_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "automation_approval_policies_organization_id_name_key" ON "automation_approval_policies"("organization_id", "name");

-- CreateIndex
CREATE INDEX "audit_events_organization_id_outcome_created_at_idx" ON "audit_events"("organization_id", "outcome", "created_at");

-- CreateIndex
CREATE INDEX "crm_companies_merged_into_id_idx" ON "crm_companies"("merged_into_id");

-- CreateIndex
CREATE INDEX "crm_contacts_merged_into_id_idx" ON "crm_contacts"("merged_into_id");

-- CreateIndex
CREATE INDEX "crm_leads_merged_into_id_idx" ON "crm_leads"("merged_into_id");

-- CreateIndex
CREATE INDEX "crm_leads_referring_partner_company_id_idx" ON "crm_leads"("referring_partner_company_id");

-- CreateIndex
CREATE INDEX "crm_deals_merged_into_id_idx" ON "crm_deals"("merged_into_id");

-- CreateIndex
CREATE INDEX "crm_deals_referring_partner_company_id_idx" ON "crm_deals"("referring_partner_company_id");

-- CreateIndex
CREATE INDEX "crm_activities_comm_message_id_idx" ON "crm_activities"("comm_message_id");

-- CreateIndex
CREATE INDEX "proposal_comments_parent_comment_id_idx" ON "proposal_comments"("parent_comment_id");

-- CreateIndex
CREATE INDEX "contract_reviews_reviewer_contact_id_idx" ON "contract_reviews"("reviewer_contact_id");

-- CreateIndex
CREATE INDEX "contract_comments_parent_comment_id_idx" ON "contract_comments"("parent_comment_id");

-- CreateIndex
CREATE INDEX "campaigns_topic_id_idx" ON "campaigns"("topic_id");

-- CreateIndex
CREATE INDEX "campaign_recipients_variant_id_idx" ON "campaign_recipients"("variant_id");

-- CreateIndex
CREATE INDEX "message_mentions_membership_id_read_at_idx" ON "message_mentions"("membership_id", "read_at");

-- CreateIndex
CREATE INDEX "tickets_source_message_id_idx" ON "tickets"("source_message_id");

-- CreateIndex
CREATE INDEX "knowledge_articles_organization_id_translation_group_id_idx" ON "knowledge_articles"("organization_id", "translation_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_articles_translation_group_id_locale_key" ON "knowledge_articles"("translation_group_id", "locale");

-- CreateIndex
CREATE INDEX "notification_events_organization_id_context_project_id_occu_idx" ON "notification_events"("organization_id", "context_project_id", "occurred_at");

-- CreateIndex
CREATE INDEX "notification_events_organization_id_context_company_id_occu_idx" ON "notification_events"("organization_id", "context_company_id", "occurred_at");

-- CreateIndex
CREATE INDEX "notifications_organization_id_recipient_membership_id_conte_idx" ON "notifications"("organization_id", "recipient_membership_id", "context_project_id");

-- CreateIndex
CREATE INDEX "notifications_organization_id_context_company_id_idx" ON "notifications"("organization_id", "context_company_id");

-- CreateIndex
CREATE INDEX "wiki_spaces_organization_id_deleted_at_idx" ON "wiki_spaces"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "wiki_pages_organization_id_deleted_at_idx" ON "wiki_pages"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "folders_organization_id_legal_hold_idx" ON "folders"("organization_id", "legal_hold");

-- CreateIndex
CREATE INDEX "documents_template_id_idx" ON "documents"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendars_feed_token_key" ON "calendars"("feed_token");

-- CreateIndex
CREATE INDEX "automation_approvals_policy_id_idx" ON "automation_approvals"("policy_id");

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_retention_policies" ADD CONSTRAINT "organization_retention_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_retention_policies" ADD CONSTRAINT "organization_retention_policies_updated_by_membership_id_fkey" FOREIGN KEY ("updated_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_plans" ADD CONSTRAINT "organization_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_plan_invoices" ADD CONSTRAINT "organization_plan_invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_entitlements" ADD CONSTRAINT "organization_entitlements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_tool_calls" ADD CONSTRAINT "mcp_tool_calls_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_tool_calls" ADD CONSTRAINT "mcp_tool_calls_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_tool_calls" ADD CONSTRAINT "mcp_tool_calls_service_account_id_fkey" FOREIGN KEY ("service_account_id") REFERENCES "service_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key_usage_daily" ADD CONSTRAINT "api_key_usage_daily_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key_usage_daily" ADD CONSTRAINT "api_key_usage_daily_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_portal_membership_projects" ADD CONSTRAINT "customer_portal_membership_projects_portal_membership_id_fkey" FOREIGN KEY ("portal_membership_id") REFERENCES "customer_portal_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_portal_membership_projects" ADD CONSTRAINT "customer_portal_membership_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_portal_membership_projects" ADD CONSTRAINT "customer_portal_membership_projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_companies" ADD CONSTRAINT "crm_companies_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_lost_reason_id_fkey" FOREIGN KEY ("lost_reason_id") REFERENCES "crm_loss_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_referring_partner_company_id_fkey" FOREIGN KEY ("referring_partner_company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_lost_reason_id_fkey" FOREIGN KEY ("lost_reason_id") REFERENCES "crm_loss_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_referring_partner_company_id_fkey" FOREIGN KEY ("referring_partner_company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_discount_approved_by_membership_id_fkey" FOREIGN KEY ("discount_approved_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "crm_deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_comm_message_id_fkey" FOREIGN KEY ("comm_message_id") REFERENCES "comm_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_recording_document_id_fkey" FOREIGN KEY ("recording_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_merge_logs" ADD CONSTRAINT "crm_merge_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_merge_logs" ADD CONSTRAINT "crm_merge_logs_merged_by_membership_id_fkey" FOREIGN KEY ("merged_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_duplicate_rules" ADD CONSTRAINT "crm_duplicate_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_duplicate_dismissals" ADD CONSTRAINT "crm_duplicate_dismissals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_duplicate_dismissals" ADD CONSTRAINT "crm_duplicate_dismissals_dismissed_by_membership_id_fkey" FOREIGN KEY ("dismissed_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_loss_reasons" ADD CONSTRAINT "crm_loss_reasons_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_import_mappings" ADD CONSTRAINT "crm_import_mappings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_import_mappings" ADD CONSTRAINT "crm_import_mappings_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_discount_policies" ADD CONSTRAINT "crm_discount_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_discount_policies" ADD CONSTRAINT "crm_discount_policies_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_report_schedules" ADD CONSTRAINT "crm_report_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_report_schedules" ADD CONSTRAINT "crm_report_schedules_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_report_schedules" ADD CONSTRAINT "crm_report_schedules_scheduled_job_id_fkey" FOREIGN KEY ("scheduled_job_id") REFERENCES "scheduled_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_template_versions" ADD CONSTRAINT "proposal_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "proposal_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_comments" ADD CONSTRAINT "proposal_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "proposal_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_ai_findings" ADD CONSTRAINT "proposal_ai_findings_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "proposal_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_ai_findings" ADD CONSTRAINT "proposal_ai_findings_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "proposal_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_ai_findings" ADD CONSTRAINT "proposal_ai_findings_reviewed_by_membership_id_fkey" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_reviews" ADD CONSTRAINT "contract_reviews_reviewer_contact_id_fkey" FOREIGN KEY ("reviewer_contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_comments" ADD CONSTRAINT "contract_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "contract_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signers" ADD CONSTRAINT "signers_consent_text_id_fkey" FOREIGN KEY ("consent_text_id") REFERENCES "signature_consent_texts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_consent_texts" ADD CONSTRAINT "signature_consent_texts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_signer_id_fkey" FOREIGN KEY ("signer_id") REFERENCES "signers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_renewal_decisions" ADD CONSTRAINT "contract_renewal_decisions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_renewal_decisions" ADD CONSTRAINT "contract_renewal_decisions_resulting_contract_id_fkey" FOREIGN KEY ("resulting_contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deliverable_approvers" ADD CONSTRAINT "project_deliverable_approvers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deliverable_approvers" ADD CONSTRAINT "project_deliverable_approvers_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "project_deliverables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deliverable_approvers" ADD CONSTRAINT "project_deliverable_approvers_portal_membership_id_fkey" FOREIGN KEY ("portal_membership_id") REFERENCES "customer_portal_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_portal_client_settings" ADD CONSTRAINT "customer_portal_client_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_portal_client_settings" ADD CONSTRAINT "customer_portal_client_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_sent_communication_id_fkey" FOREIGN KEY ("sent_communication_id") REFERENCES "comm_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_link_id_fkey" FOREIGN KEY ("payment_link_id") REFERENCES "payment_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_billing_profile_id_fkey" FOREIGN KEY ("billing_profile_id") REFERENCES "billing_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_price_id_fkey" FOREIGN KEY ("price_id") REFERENCES "prices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_provider_connection_id_fkey" FOREIGN KEY ("provider_connection_id") REFERENCES "payment_provider_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_provider_connection_id_fkey" FOREIGN KEY ("provider_connection_id") REFERENCES "payment_provider_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_payouts" ADD CONSTRAINT "payment_payouts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_payouts" ADD CONSTRAINT "payment_payouts_provider_connection_id_fkey" FOREIGN KEY ("provider_connection_id") REFERENCES "payment_provider_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_approval_rules" ADD CONSTRAINT "finance_approval_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_approvals" ADD CONSTRAINT "finance_approvals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_approvals" ADD CONSTRAINT "finance_approvals_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "finance_approval_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_report_schedules" ADD CONSTRAINT "finance_report_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_balance_snapshots" ADD CONSTRAINT "ledger_balance_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_balance_snapshots" ADD CONSTRAINT "ledger_balance_snapshots_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "ledger_payment_methods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_budgets" ADD CONSTRAINT "ledger_budgets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_budget_lines" ADD CONSTRAINT "ledger_budget_lines_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "ledger_budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_budget_lines" ADD CONSTRAINT "ledger_budget_lines_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ledger_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_budget_lines" ADD CONSTRAINT "ledger_budget_lines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_budget_lines" ADD CONSTRAINT "ledger_budget_lines_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vat_returns" ADD CONSTRAINT "vat_returns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vat_returns" ADD CONSTRAINT "vat_returns_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "financial_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_payroll_entry_id_fkey" FOREIGN KEY ("payroll_entry_id") REFERENCES "payroll_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claim_lines" ADD CONSTRAINT "expense_claim_lines_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "expense_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claim_lines" ADD CONSTRAINT "expense_claim_lines_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ledger_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claim_lines" ADD CONSTRAINT "expense_claim_lines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_equipment" ADD CONSTRAINT "employee_equipment_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_equipment" ADD CONSTRAINT "employee_equipment_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_feedback_requests" ADD CONSTRAINT "performance_feedback_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_feedback_requests" ADD CONSTRAINT "performance_feedback_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_feedback_requests" ADD CONSTRAINT "performance_feedback_requests_requested_by_membership_id_fkey" FOREIGN KEY ("requested_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_feedback_requests" ADD CONSTRAINT "performance_feedback_requests_requested_from_membership_id_fkey" FOREIGN KEY ("requested_from_membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_feedback_requests" ADD CONSTRAINT "performance_feedback_requests_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "performance_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_feedback_requests" ADD CONSTRAINT "performance_feedback_requests_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "performance_review_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_feedback_requests" ADD CONSTRAINT "performance_feedback_requests_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "performance_feedback"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_calibrations" ADD CONSTRAINT "performance_calibrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_calibrations" ADD CONSTRAINT "performance_calibrations_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "performance_review_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_calibrations" ADD CONSTRAINT "performance_calibrations_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "performance_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_allocation_skills" ADD CONSTRAINT "project_allocation_skills_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_allocation_skills" ADD CONSTRAINT "project_allocation_skills_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "project_allocations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_allocation_skills" ADD CONSTRAINT "project_allocation_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_import_jobs" ADD CONSTRAINT "employee_import_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "comm_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "campaign_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_variants" ADD CONSTRAINT "campaign_variants_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_topics" ADD CONSTRAINT "comm_topics_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_topic_subscriptions" ADD CONSTRAINT "comm_topic_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_topic_subscriptions" ADD CONSTRAINT "comm_topic_subscriptions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_topic_subscriptions" ADD CONSTRAINT "comm_topic_subscriptions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "comm_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_settings" ADD CONSTRAINT "comm_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_invitations" ADD CONSTRAINT "channel_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_invitations" ADD CONSTRAINT "channel_invitations_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_access_requests" ADD CONSTRAINT "channel_access_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_access_requests" ADD CONSTRAINT "channel_access_requests_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_access_requests" ADD CONSTRAINT "channel_access_requests_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_legal_holds" ADD CONSTRAINT "messaging_legal_holds_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_incident_updates" ADD CONSTRAINT "support_incident_updates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_incident_updates" ADD CONSTRAINT "support_incident_updates_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "support_incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_incident_updates" ADD CONSTRAINT "support_incident_updates_author_membership_id_fkey" FOREIGN KEY ("author_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_agent_profiles" ADD CONSTRAINT "support_agent_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_agent_profiles" ADD CONSTRAINT "support_agent_profiles_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_template_versions" ADD CONSTRAINT "notification_template_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_template_versions" ADD CONSTRAINT "notification_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "support_incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_acknowledgements" ADD CONSTRAINT "announcement_acknowledgements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_acknowledgements" ADD CONSTRAINT "announcement_acknowledgements_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_acknowledgements" ADD CONSTRAINT "announcement_acknowledgements_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_acknowledgements" ADD CONSTRAINT "announcement_acknowledgements_portal_membership_id_fkey" FOREIGN KEY ("portal_membership_id") REFERENCES "customer_portal_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_views" ADD CONSTRAINT "wiki_page_views_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_views" ADD CONSTRAINT "wiki_page_views_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_views" ADD CONSTRAINT "wiki_page_views_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_view_daily" ADD CONSTRAINT "wiki_page_view_daily_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_view_daily" ADD CONSTRAINT "wiki_page_view_daily_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_search_queries" ADD CONSTRAINT "wiki_search_queries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_search_queries" ADD CONSTRAINT "wiki_search_queries_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_search_queries" ADD CONSTRAINT "wiki_search_queries_clicked_page_id_fkey" FOREIGN KEY ("clicked_page_id") REFERENCES "wiki_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_feedback" ADD CONSTRAINT "wiki_page_feedback_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_feedback" ADD CONSTRAINT "wiki_page_feedback_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_feedback" ADD CONSTRAINT "wiki_page_feedback_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_transfer_jobs" ADD CONSTRAINT "wiki_transfer_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_transfer_jobs" ADD CONSTRAINT "wiki_transfer_jobs_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "wiki_spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_transfer_jobs" ADD CONSTRAINT "wiki_transfer_jobs_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_ack_targets" ADD CONSTRAINT "wiki_page_ack_targets_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_watchers" ADD CONSTRAINT "wiki_page_watchers_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_watchers" ADD CONSTRAINT "wiki_page_watchers_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_review_requests" ADD CONSTRAINT "wiki_page_review_requests_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_review_requests" ADD CONSTRAINT "wiki_page_review_requests_reviewer_membership_id_fkey" FOREIGN KEY ("reviewer_membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "document_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "document_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_source_version_id_fkey" FOREIGN KEY ("source_version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_report_schedules" ADD CONSTRAINT "time_report_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_report_schedules" ADD CONSTRAINT "time_report_schedules_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_exports" ADD CONSTRAINT "time_exports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_exports" ADD CONSTRAINT "time_exports_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "time_report_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_exports" ADD CONSTRAINT "time_exports_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_link_stats_daily" ADD CONSTRAINT "booking_link_stats_daily_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_link_stats_daily" ADD CONSTRAINT "booking_link_stats_daily_booking_link_id_fkey" FOREIGN KEY ("booking_link_id") REFERENCES "booking_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_approvals" ADD CONSTRAINT "automation_approvals_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "automation_approval_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_approval_policies" ADD CONSTRAINT "automation_approval_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

