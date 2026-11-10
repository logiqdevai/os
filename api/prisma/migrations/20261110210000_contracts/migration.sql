-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'INTERNAL_REVIEW', 'CUSTOMER_REVIEW', 'APPROVAL_REQUIRED', 'READY_FOR_SIGNATURE', 'PARTIALLY_SIGNED', 'FULLY_SIGNED', 'ACTIVE', 'EXPIRING', 'RENEWED', 'SUPERSEDED', 'TERMINATED', 'EXPIRED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContractVersionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'LOCKED_FOR_SIGNATURE', 'SIGNED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ContractRelationKind" AS ENUM ('STANDALONE', 'AMENDMENT', 'RENEWAL', 'SOW', 'CHANGE_ORDER', 'TERMINATION_AGREEMENT');

-- CreateEnum
CREATE TYPE "ContractRenewalType" AS ENUM ('NONE', 'MANUAL', 'AUTOMATIC', 'EVERGREEN');

-- CreateEnum
CREATE TYPE "ContractPartyType" AS ENUM ('AGENCY', 'CUSTOMER', 'VENDOR', 'PARTNER', 'CONTRACTOR', 'EMPLOYEE', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "ContractClauseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "ContractReviewDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "ContractApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContractChangeRequestStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'IMPLEMENTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ContractObligationType" AS ENUM ('DELIVERABLE', 'PAYMENT', 'REPORTING', 'RENEWAL_NOTICE', 'SLA', 'SECURITY_REVIEW', 'CUSTOMER_APPROVAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractObligationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'FULFILLED', 'OVERDUE', 'WAIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExtractionReviewState" AS ENUM ('PENDING_REVIEW', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContractTerminationType" AS ENUM ('FOR_CONVENIENCE', 'FOR_CAUSE', 'MUTUAL', 'EXPIRY', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SignatureProvider" AS ENUM ('INTERNAL', 'DOCUSIGN', 'DROPBOX_SIGN', 'ADOBE_SIGN', 'OTHER');

-- CreateEnum
CREATE TYPE "SignatureSubjectType" AS ENUM ('CONTRACT_VERSION', 'PROPOSAL_VERSION');

-- CreateEnum
CREATE TYPE "SigningOrder" AS ENUM ('SEQUENTIAL', 'PARALLEL');

-- CreateEnum
CREATE TYPE "SignatureRequestStatus" AS ENUM ('NOT_SENT', 'SENT', 'DELIVERED', 'VIEWED', 'PARTIALLY_SIGNED', 'FULLY_SIGNED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "SignerStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'VIEWED', 'SIGNED', 'DECLINED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "SignatureEventType" AS ENUM ('REQUEST_CREATED', 'SENT', 'DELIVERED', 'VIEWED', 'SIGNED', 'DECLINED', 'REMINDER_SENT', 'CANCELLED', 'EXPIRED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "contract_types" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "default_template_id" TEXT,
    "required_metadata" JSONB,
    "approval_workflow" JSONB,
    "signature_requirements" JSONB,
    "default_renewal_type" "ContractRenewalType" NOT NULL DEFAULT 'NONE',
    "default_notice_days" INTEGER,
    "reminder_windows_days" INTEGER[] DEFAULT ARRAY[90, 60, 30, 14, 7]::INTEGER[],
    "retention_days" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" "ContractTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "current_version_id" TEXT,
    "owner_membership_id" TEXT,
    "effective_date" DATE,
    "deprecated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_template_versions" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "change_summary" TEXT,
    "sections" JSONB NOT NULL,
    "variables" JSONB,
    "conditional_rules" JSONB,
    "signature_blocks" JSONB,
    "required_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "published_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_clauses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "status" "ContractClauseStatus" NOT NULL DEFAULT 'DRAFT',
    "usage_restrictions" JSONB,
    "owner_membership_id" TEXT,
    "current_version_id" TEXT,
    "effective_date" DATE,
    "deprecated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_clauses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_clause_versions" (
    "id" TEXT NOT NULL,
    "clause_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "change_summary" TEXT,
    "effective_date" DATE,
    "deprecated_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_clause_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_approval_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_approval_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type_id" TEXT,
    "template_id" TEXT,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "relation_kind" "ContractRelationKind" NOT NULL DEFAULT 'STANDALONE',
    "parent_contract_id" TEXT,
    "relation_sequence" INTEGER,
    "superseded_by_contract_id" TEXT,
    "owner_membership_id" TEXT,
    "primary_company_id" TEXT,
    "proposal_id" TEXT,
    "proposal_version_id" TEXT,
    "project_change_request_id" TEXT,
    "currency" TEXT,
    "draft_date" DATE,
    "approval_date" DATE,
    "signature_date" DATE,
    "effective_date" DATE,
    "start_date" DATE,
    "end_date" DATE,
    "renewal_date" DATE,
    "notice_deadline" DATE,
    "expiration_date" DATE,
    "termination_date" DATE,
    "renewal_type" "ContractRenewalType" NOT NULL DEFAULT 'NONE',
    "renewal_term_months" INTEGER,
    "notice_days" INTEGER,
    "total_value" DECIMAL(18,2),
    "one_time_value" DECIMAL(18,2),
    "recurring_value" DECIMAL(18,2),
    "billing_frequency" TEXT,
    "payment_terms" TEXT,
    "risk_score" INTEGER,
    "risk_level" "ContractRiskLevel",
    "risk_factors" JSONB,
    "customer_visible" BOOLEAN NOT NULL DEFAULT false,
    "current_version_id" TEXT,
    "signed_version_id" TEXT,
    "processes_personal_data" BOOLEAN NOT NULL DEFAULT false,
    "activated_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_parties" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "party_type" "ContractPartyType" NOT NULL,
    "company_id" TEXT,
    "legal_name" TEXT NOT NULL,
    "address" JSONB,
    "registration_number" TEXT,
    "vat_number" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_signatories" (
    "id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "membership_id" TEXT,
    "contact_id" TEXT,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_signatories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_projects" (
    "contract_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'primary',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_projects_pkey" PRIMARY KEY ("contract_id","project_id")
);

-- CreateTable
CREATE TABLE "contract_versions" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "parent_version_id" TEXT,
    "status" "ContractVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "change_summary" TEXT,
    "template_version_id" TEXT,
    "variables" JSONB,
    "document_id" TEXT,
    "signed_document_id" TEXT,
    "content_hash" TEXT,
    "signed_hash" TEXT,
    "customer_visible" BOOLEAN NOT NULL DEFAULT false,
    "locked_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "signed_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_sections" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "clause_version_id" TEXT,
    "is_appendix" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_reviews" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "reviewer_membership_id" TEXT,
    "reviewer_user_id" TEXT,
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "decision" "ContractReviewDecision" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "requested_by_user_id" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "contract_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_comments" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "section_id" TEXT,
    "author_membership_id" TEXT,
    "author_user_id" TEXT,
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "is_blocking" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_change_requests" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "related_version_id" TEXT,
    "resulting_version_id" TEXT,
    "section_id" TEXT,
    "requester_membership_id" TEXT,
    "requester_user_id" TEXT,
    "requester_contact_id" TEXT,
    "requested_change" TEXT NOT NULL,
    "reason" TEXT,
    "impact" TEXT,
    "status" "ContractChangeRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "project_change_request_id" TEXT,
    "decided_by_user_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_approvals" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 1,
    "step_name" TEXT,
    "approver_membership_id" TEXT NOT NULL,
    "decision" "ContractApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "rule_id" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "contract_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subject_type" "SignatureSubjectType" NOT NULL,
    "contract_id" TEXT,
    "contract_version_id" TEXT,
    "proposal_version_id" TEXT,
    "provider" "SignatureProvider" NOT NULL DEFAULT 'INTERNAL',
    "provider_request_id" TEXT,
    "status" "SignatureRequestStatus" NOT NULL DEFAULT 'NOT_SENT',
    "signing_order" "SigningOrder" NOT NULL DEFAULT 'SEQUENTIAL',
    "package_documents" JSONB,
    "reminder_settings" JSONB,
    "reminders_sent" INTEGER NOT NULL DEFAULT 0,
    "signed_document_id" TEXT,
    "audit_certificate_document_id" TEXT,
    "signed_hash" TEXT,
    "message" TEXT,
    "created_by_user_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signature_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signers" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "signatory_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "title" TEXT,
    "order" INTEGER NOT NULL DEFAULT 1,
    "status" "SignerStatus" NOT NULL DEFAULT 'PENDING',
    "fields" JSONB,
    "access_token_hash" TEXT,
    "provider_signer_id" TEXT,
    "auth_method" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "sent_at" TIMESTAMP(3),
    "viewed_at" TIMESTAMP(3),
    "signed_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "decline_reason" TEXT,

    CONSTRAINT "signers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature_events" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "signer_id" TEXT,
    "type" "SignatureEventType" NOT NULL,
    "provider" "SignatureProvider" NOT NULL DEFAULT 'INTERNAL',
    "provider_event_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_obligations" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "section_id" TEXT,
    "type" "ContractObligationType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "responsible_party_id" TEXT,
    "responsible_membership_id" TEXT,
    "due_date" DATE,
    "frequency" TEXT,
    "status" "ContractObligationStatus" NOT NULL DEFAULT 'OPEN',
    "reminder_days_before" INTEGER,
    "project_id" TEXT,
    "task_id" TEXT,
    "is_ai_extracted" BOOLEAN NOT NULL DEFAULT false,
    "extraction_confidence" DECIMAL(5,4),
    "review_state" "ExtractionReviewState",
    "fulfilled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_terminations" (
    "contract_id" TEXT NOT NULL,
    "type" "ContractTerminationType" NOT NULL DEFAULT 'FOR_CONVENIENCE',
    "reason" TEXT,
    "requesting_party_id" TEXT,
    "notice_date" DATE,
    "effective_date" DATE NOT NULL,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "document_id" TEXT,
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_terminations_pkey" PRIMARY KEY ("contract_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_types_organization_id_slug_key" ON "contract_types"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "contract_templates_current_version_id_key" ON "contract_templates"("current_version_id");

-- CreateIndex
CREATE INDEX "contract_templates_organization_id_status_idx" ON "contract_templates"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contract_templates_organization_id_slug_key" ON "contract_templates"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "contract_template_versions_template_id_version_number_key" ON "contract_template_versions"("template_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "contract_clauses_current_version_id_key" ON "contract_clauses"("current_version_id");

-- CreateIndex
CREATE INDEX "contract_clauses_organization_id_category_idx" ON "contract_clauses"("organization_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "contract_clauses_organization_id_key_key" ON "contract_clauses"("organization_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "contract_clause_versions_clause_id_version_number_key" ON "contract_clause_versions"("clause_id", "version_number");

-- CreateIndex
CREATE INDEX "contract_approval_rules_organization_id_enabled_idx" ON "contract_approval_rules"("organization_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_superseded_by_contract_id_key" ON "contracts"("superseded_by_contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_current_version_id_key" ON "contracts"("current_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_signed_version_id_key" ON "contracts"("signed_version_id");

-- CreateIndex
CREATE INDEX "contracts_organization_id_status_idx" ON "contracts"("organization_id", "status");

-- CreateIndex
CREATE INDEX "contracts_primary_company_id_idx" ON "contracts"("primary_company_id");

-- CreateIndex
CREATE INDEX "contracts_parent_contract_id_idx" ON "contracts"("parent_contract_id");

-- CreateIndex
CREATE INDEX "contracts_expiration_date_idx" ON "contracts"("expiration_date");

-- CreateIndex
CREATE INDEX "contracts_renewal_date_idx" ON "contracts"("renewal_date");

-- CreateIndex
CREATE INDEX "contracts_notice_deadline_idx" ON "contracts"("notice_deadline");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_organization_id_number_key" ON "contracts"("organization_id", "number");

-- CreateIndex
CREATE INDEX "contract_parties_contract_id_idx" ON "contract_parties"("contract_id");

-- CreateIndex
CREATE INDEX "contract_parties_company_id_idx" ON "contract_parties"("company_id");

-- CreateIndex
CREATE INDEX "contract_signatories_party_id_idx" ON "contract_signatories"("party_id");

-- CreateIndex
CREATE INDEX "contract_projects_project_id_idx" ON "contract_projects"("project_id");

-- CreateIndex
CREATE INDEX "contract_versions_contract_id_status_idx" ON "contract_versions"("contract_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contract_versions_contract_id_version_number_key" ON "contract_versions"("contract_id", "version_number");

-- CreateIndex
CREATE INDEX "contract_sections_version_id_sort_order_idx" ON "contract_sections"("version_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "contract_sections_version_id_key_key" ON "contract_sections"("version_id", "key");

-- CreateIndex
CREATE INDEX "contract_reviews_version_id_decision_idx" ON "contract_reviews"("version_id", "decision");

-- CreateIndex
CREATE INDEX "contract_reviews_reviewer_membership_id_decision_idx" ON "contract_reviews"("reviewer_membership_id", "decision");

-- CreateIndex
CREATE INDEX "contract_comments_version_id_created_at_idx" ON "contract_comments"("version_id", "created_at");

-- CreateIndex
CREATE INDEX "contract_comments_section_id_idx" ON "contract_comments"("section_id");

-- CreateIndex
CREATE INDEX "contract_change_requests_contract_id_status_idx" ON "contract_change_requests"("contract_id", "status");

-- CreateIndex
CREATE INDEX "contract_approvals_approver_membership_id_decision_idx" ON "contract_approvals"("approver_membership_id", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "contract_approvals_version_id_approver_membership_id_step_key" ON "contract_approvals"("version_id", "approver_membership_id", "step");

-- CreateIndex
CREATE INDEX "signature_requests_organization_id_status_idx" ON "signature_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "signature_requests_contract_id_idx" ON "signature_requests"("contract_id");

-- CreateIndex
CREATE INDEX "signature_requests_contract_version_id_idx" ON "signature_requests"("contract_version_id");

-- CreateIndex
CREATE INDEX "signature_requests_proposal_version_id_idx" ON "signature_requests"("proposal_version_id");

-- CreateIndex
CREATE INDEX "signature_requests_expires_at_idx" ON "signature_requests"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "signature_requests_provider_provider_request_id_key" ON "signature_requests"("provider", "provider_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "signers_access_token_hash_key" ON "signers"("access_token_hash");

-- CreateIndex
CREATE INDEX "signers_request_id_order_idx" ON "signers"("request_id", "order");

-- CreateIndex
CREATE INDEX "signers_email_idx" ON "signers"("email");

-- CreateIndex
CREATE INDEX "signature_events_request_id_occurred_at_idx" ON "signature_events"("request_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "signature_events_provider_provider_event_id_key" ON "signature_events"("provider", "provider_event_id");

-- CreateIndex
CREATE INDEX "contract_obligations_contract_id_status_idx" ON "contract_obligations"("contract_id", "status");

-- CreateIndex
CREATE INDEX "contract_obligations_due_date_idx" ON "contract_obligations"("due_date");

-- AddForeignKey
ALTER TABLE "contract_types" ADD CONSTRAINT "contract_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_types" ADD CONSTRAINT "contract_types_default_template_id_fkey" FOREIGN KEY ("default_template_id") REFERENCES "contract_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "contract_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "contract_template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_template_versions" ADD CONSTRAINT "contract_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "contract_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_clauses" ADD CONSTRAINT "contract_clauses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_clauses" ADD CONSTRAINT "contract_clauses_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "contract_clause_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_clause_versions" ADD CONSTRAINT "contract_clause_versions_clause_id_fkey" FOREIGN KEY ("clause_id") REFERENCES "contract_clauses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_approval_rules" ADD CONSTRAINT "contract_approval_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "contract_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "contract_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_parent_contract_id_fkey" FOREIGN KEY ("parent_contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_superseded_by_contract_id_fkey" FOREIGN KEY ("superseded_by_contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_primary_company_id_fkey" FOREIGN KEY ("primary_company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_proposal_version_id_fkey" FOREIGN KEY ("proposal_version_id") REFERENCES "proposal_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "contract_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_signed_version_id_fkey" FOREIGN KEY ("signed_version_id") REFERENCES "contract_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_parties" ADD CONSTRAINT "contract_parties_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_parties" ADD CONSTRAINT "contract_parties_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signatories" ADD CONSTRAINT "contract_signatories_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "contract_parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signatories" ADD CONSTRAINT "contract_signatories_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signatories" ADD CONSTRAINT "contract_signatories_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_projects" ADD CONSTRAINT "contract_projects_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_parent_version_id_fkey" FOREIGN KEY ("parent_version_id") REFERENCES "contract_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "contract_template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_sections" ADD CONSTRAINT "contract_sections_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "contract_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_sections" ADD CONSTRAINT "contract_sections_clause_version_id_fkey" FOREIGN KEY ("clause_version_id") REFERENCES "contract_clause_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_reviews" ADD CONSTRAINT "contract_reviews_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "contract_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_reviews" ADD CONSTRAINT "contract_reviews_reviewer_membership_id_fkey" FOREIGN KEY ("reviewer_membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_comments" ADD CONSTRAINT "contract_comments_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "contract_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_comments" ADD CONSTRAINT "contract_comments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "contract_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_comments" ADD CONSTRAINT "contract_comments_author_membership_id_fkey" FOREIGN KEY ("author_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_change_requests" ADD CONSTRAINT "contract_change_requests_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_change_requests" ADD CONSTRAINT "contract_change_requests_related_version_id_fkey" FOREIGN KEY ("related_version_id") REFERENCES "contract_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_change_requests" ADD CONSTRAINT "contract_change_requests_resulting_version_id_fkey" FOREIGN KEY ("resulting_version_id") REFERENCES "contract_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_change_requests" ADD CONSTRAINT "contract_change_requests_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "contract_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_approvals" ADD CONSTRAINT "contract_approvals_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "contract_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_approvals" ADD CONSTRAINT "contract_approvals_approver_membership_id_fkey" FOREIGN KEY ("approver_membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_contract_version_id_fkey" FOREIGN KEY ("contract_version_id") REFERENCES "contract_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_proposal_version_id_fkey" FOREIGN KEY ("proposal_version_id") REFERENCES "proposal_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signers" ADD CONSTRAINT "signers_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "signature_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signers" ADD CONSTRAINT "signers_signatory_id_fkey" FOREIGN KEY ("signatory_id") REFERENCES "contract_signatories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_events" ADD CONSTRAINT "signature_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "signature_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_events" ADD CONSTRAINT "signature_events_signer_id_fkey" FOREIGN KEY ("signer_id") REFERENCES "signers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_obligations" ADD CONSTRAINT "contract_obligations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_obligations" ADD CONSTRAINT "contract_obligations_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "contract_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_terminations" ADD CONSTRAINT "contract_terminations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

