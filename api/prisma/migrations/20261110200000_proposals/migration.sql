-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'VIEWED', 'CHANGES_REQUESTED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProposalVersionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'SENT', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ProposalApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "ProposalCustomerDecision" AS ENUM ('ACCEPTED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "ProposalDeliveryChannel" AS ENUM ('EMAIL', 'CUSTOMER_PORTAL', 'PDF', 'LINK');

-- CreateEnum
CREATE TYPE "ProposalDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProposalEventType" AS ENUM ('CREATED', 'VERSION_CREATED', 'SUBMITTED_FOR_REVIEW', 'APPROVED', 'SENT', 'VIEWED', 'DOWNLOADED', 'OPTIONAL_ITEM_TOGGLED', 'COMMENTED', 'CHANGES_REQUESTED', 'ACCEPTED', 'REJECTED', 'SIGNED', 'EXPIRED', 'CANCELLED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "ProposalSectionType" AS ENUM ('COVER', 'EXECUTIVE_SUMMARY', 'OVERVIEW', 'REQUIREMENTS', 'SOLUTION', 'SCOPE', 'FEATURES', 'DELIVERABLES', 'PHASES', 'MILESTONES', 'TIMELINE', 'PRICING', 'PAYMENT_SCHEDULE', 'SUPPORT_OPTIONS', 'ASSUMPTIONS', 'EXCLUSIONS', 'WARRANTY', 'TERMS', 'NEXT_STEPS', 'SIGNATURE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ProposalPaymentTrigger" AS ENUM ('ON_ACCEPTANCE', 'ON_SIGNATURE', 'ON_DATE', 'ON_MILESTONE', 'ON_DELIVERY', 'RECURRING');

-- CreateTable
CREATE TABLE "number_sequences" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "year" INTEGER,
    "next_number" INTEGER NOT NULL DEFAULT 1,
    "padding" INTEGER NOT NULL DEFAULT 4,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "work_type" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "branding" JSONB,
    "layout" JSONB,
    "sections" JSONB NOT NULL,
    "defaults" JSONB,
    "variables" JSONB,
    "default_validity_days" INTEGER NOT NULL DEFAULT 30,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "template_id" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "currency" TEXT NOT NULL,
    "company_id" TEXT,
    "contact_id" TEXT,
    "deal_id" TEXT,
    "owner_membership_id" TEXT,
    "project_id" TEXT,
    "valid_until" DATE,
    "current_version_id" TEXT,
    "sent_version_id" TEXT,
    "accepted_version_id" TEXT,
    "net_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gross_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "recurring_monthly" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "recurring_annual" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "requires_contract" BOOLEAN NOT NULL DEFAULT false,
    "public_token_hash" TEXT,
    "contract_id" TEXT,
    "converted_project_id" TEXT,
    "invoice_id" TEXT,
    "subscription_id" TEXT,
    "converted_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "first_viewed_at" TIMESTAMP(3),
    "last_viewed_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "expired_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_versions" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "ProposalVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "parent_version_id" TEXT,
    "change_summary" TEXT,
    "template_version" INTEGER,
    "variables" JSONB,
    "payment_terms" TEXT,
    "validity_days" INTEGER,
    "milestones" JSONB,
    "timeline" JSONB,
    "net_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gross_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "recurring_monthly" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "recurring_annual" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pdf_document_id" TEXT,
    "content_hash" TEXT,
    "is_ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "ai_metadata" JSONB,
    "locked_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_sections" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "type" "ProposalSectionType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_line_items" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "product_id" TEXT,
    "group_name" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unit" TEXT,
    "unit_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount_percent" DECIMAL(5,2),
    "discount_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_percent" DECIMAL(5,2),
    "net_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gross_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "billing_frequency" TEXT,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "selected_by_customer" BOOLEAN,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_payment_schedule_items" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" "ProposalPaymentTrigger" NOT NULL DEFAULT 'ON_ACCEPTANCE',
    "percentage" DECIMAL(5,2),
    "amount" DECIMAL(18,2),
    "due_date" DATE,
    "milestone_name" TEXT,
    "frequency" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "proposal_payment_schedule_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_approvals" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "approver_membership_id" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 1,
    "decision" "ProposalApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "proposal_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_comments" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "version_id" TEXT,
    "section_id" TEXT,
    "author_membership_id" TEXT,
    "author_user_id" TEXT,
    "author_contact_id" TEXT,
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "body" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_deliveries" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "channel" "ProposalDeliveryChannel" NOT NULL,
    "status" "ProposalDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "recipient_contact_id" TEXT,
    "recipient_email" TEXT,
    "communication_id" TEXT,
    "sent_by_user_id" TEXT,
    "message" TEXT,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "failed_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_events" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "version_id" TEXT,
    "type" "ProposalEventType" NOT NULL,
    "actor_user_id" TEXT,
    "actor_contact_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_acceptances" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "decision" "ProposalCustomerDecision" NOT NULL,
    "customer_user_id" TEXT,
    "contact_id" TEXT,
    "signer_name" TEXT NOT NULL,
    "signer_email" TEXT NOT NULL,
    "signer_title" TEXT,
    "terms_accepted" BOOLEAN NOT NULL DEFAULT false,
    "selected_optional_item_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "feedback" TEXT,
    "signature_request_id" TEXT,
    "signature_metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "number_sequences_organization_id_entity_type_prefix_year_key" ON "number_sequences"("organization_id", "entity_type", "prefix", "year");

-- CreateIndex
CREATE INDEX "proposal_templates_organization_id_work_type_idx" ON "proposal_templates"("organization_id", "work_type");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_templates_organization_id_slug_key" ON "proposal_templates"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_current_version_id_key" ON "proposals"("current_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_sent_version_id_key" ON "proposals"("sent_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_accepted_version_id_key" ON "proposals"("accepted_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_public_token_hash_key" ON "proposals"("public_token_hash");

-- CreateIndex
CREATE INDEX "proposals_organization_id_status_idx" ON "proposals"("organization_id", "status");

-- CreateIndex
CREATE INDEX "proposals_company_id_idx" ON "proposals"("company_id");

-- CreateIndex
CREATE INDEX "proposals_deal_id_idx" ON "proposals"("deal_id");

-- CreateIndex
CREATE INDEX "proposals_owner_membership_id_idx" ON "proposals"("owner_membership_id");

-- CreateIndex
CREATE INDEX "proposals_valid_until_idx" ON "proposals"("valid_until");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_organization_id_number_key" ON "proposals"("organization_id", "number");

-- CreateIndex
CREATE INDEX "proposal_versions_proposal_id_status_idx" ON "proposal_versions"("proposal_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_versions_proposal_id_version_number_key" ON "proposal_versions"("proposal_id", "version_number");

-- CreateIndex
CREATE INDEX "proposal_sections_version_id_sort_order_idx" ON "proposal_sections"("version_id", "sort_order");

-- CreateIndex
CREATE INDEX "proposal_line_items_version_id_sort_order_idx" ON "proposal_line_items"("version_id", "sort_order");

-- CreateIndex
CREATE INDEX "proposal_payment_schedule_items_version_id_sort_order_idx" ON "proposal_payment_schedule_items"("version_id", "sort_order");

-- CreateIndex
CREATE INDEX "proposal_approvals_approver_membership_id_decision_idx" ON "proposal_approvals"("approver_membership_id", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_approvals_version_id_approver_membership_id_step_key" ON "proposal_approvals"("version_id", "approver_membership_id", "step");

-- CreateIndex
CREATE INDEX "proposal_comments_proposal_id_created_at_idx" ON "proposal_comments"("proposal_id", "created_at");

-- CreateIndex
CREATE INDEX "proposal_comments_section_id_idx" ON "proposal_comments"("section_id");

-- CreateIndex
CREATE INDEX "proposal_deliveries_proposal_id_sent_at_idx" ON "proposal_deliveries"("proposal_id", "sent_at");

-- CreateIndex
CREATE INDEX "proposal_events_proposal_id_created_at_idx" ON "proposal_events"("proposal_id", "created_at");

-- CreateIndex
CREATE INDEX "proposal_events_type_created_at_idx" ON "proposal_events"("type", "created_at");

-- CreateIndex
CREATE INDEX "proposal_acceptances_proposal_id_created_at_idx" ON "proposal_acceptances"("proposal_id", "created_at");

-- CreateIndex
CREATE INDEX "proposal_acceptances_version_id_idx" ON "proposal_acceptances"("version_id");

-- AddForeignKey
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_templates" ADD CONSTRAINT "proposal_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "proposal_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "crm_deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "proposal_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_sent_version_id_fkey" FOREIGN KEY ("sent_version_id") REFERENCES "proposal_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_accepted_version_id_fkey" FOREIGN KEY ("accepted_version_id") REFERENCES "proposal_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_parent_version_id_fkey" FOREIGN KEY ("parent_version_id") REFERENCES "proposal_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_sections" ADD CONSTRAINT "proposal_sections_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "proposal_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_line_items" ADD CONSTRAINT "proposal_line_items_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "proposal_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_payment_schedule_items" ADD CONSTRAINT "proposal_payment_schedule_items_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "proposal_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_approvals" ADD CONSTRAINT "proposal_approvals_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "proposal_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_approvals" ADD CONSTRAINT "proposal_approvals_approver_membership_id_fkey" FOREIGN KEY ("approver_membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_comments" ADD CONSTRAINT "proposal_comments_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_comments" ADD CONSTRAINT "proposal_comments_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "proposal_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_comments" ADD CONSTRAINT "proposal_comments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "proposal_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_comments" ADD CONSTRAINT "proposal_comments_author_membership_id_fkey" FOREIGN KEY ("author_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_deliveries" ADD CONSTRAINT "proposal_deliveries_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_deliveries" ADD CONSTRAINT "proposal_deliveries_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "proposal_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_deliveries" ADD CONSTRAINT "proposal_deliveries_recipient_contact_id_fkey" FOREIGN KEY ("recipient_contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_events" ADD CONSTRAINT "proposal_events_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_events" ADD CONSTRAINT "proposal_events_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "proposal_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_acceptances" ADD CONSTRAINT "proposal_acceptances_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_acceptances" ADD CONSTRAINT "proposal_acceptances_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "proposal_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_acceptances" ADD CONSTRAINT "proposal_acceptances_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

