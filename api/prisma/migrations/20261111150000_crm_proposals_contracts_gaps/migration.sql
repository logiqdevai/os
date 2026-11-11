-- Close the schema gaps found while mocking modules 02, 03 and 04.
-- 02 CRM: sales targets, forecast snapshots, role/team dashboard layouts, lead-scoring rules, secondary owner and project manager on deals/leads/contacts/companies.
-- 03 Proposals: approval rules (ProposalApprovalRule) and ProposalApproval.rule_id.
-- 04 Contracts: AI contract-review findings (ContractAiFinding). E-signature is built in-house: the signature provider enum and the provider
--   columns are removed, and the signer gets the fields the custom signing flow needs (signature type, consent, identity verification).
-- Safety: refuse to drop provider columns that hold data (only the INTERNAL provider and empty provider ids can be dropped without losing information).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "signature_requests" WHERE "provider" <> 'INTERNAL' OR "provider_request_id" IS NOT NULL)
    OR EXISTS (SELECT 1 FROM "signers" WHERE "provider_signer_id" IS NOT NULL)
    OR EXISTS (SELECT 1 FROM "signature_events" WHERE "provider" <> 'INTERNAL' OR "provider_event_id" IS NOT NULL) THEN
    RAISE EXCEPTION 'external signature provider data exists: migrate or archive it before applying this migration';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "CrmTargetPeriod" AS ENUM ('MONTH', 'QUARTER', 'YEAR');

-- CreateEnum
CREATE TYPE "CrmTargetMetric" AS ENUM ('REVENUE_WON', 'PIPELINE_CREATED', 'DEALS_WON');

-- CreateEnum
CREATE TYPE "ContractAiFindingKind" AS ENUM ('MISSING_CLAUSE', 'CONFLICTING_DATES', 'UNUSUAL_PAYMENT_TERMS', 'LIABILITY_DIFFERENCE', 'TERMINATION_DIFFERENCE', 'SCOPE_INCONSISTENCY', 'RENEWAL_PROVISION', 'NON_STANDARD_CLAUSE');

-- CreateEnum
CREATE TYPE "ContractAiFindingStatus" AS ENUM ('OPEN', 'ACCEPTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "SignatureType" AS ENUM ('DRAWN', 'TYPED', 'UPLOADED');

-- DropIndex
DROP INDEX "signature_requests_provider_provider_request_id_key";

-- DropIndex
DROP INDEX "signature_events_provider_provider_event_id_key";

-- AlterTable
ALTER TABLE "crm_companies" ADD COLUMN     "project_manager_membership_id" TEXT,
ADD COLUMN     "secondary_owner_membership_id" TEXT;

-- AlterTable
ALTER TABLE "crm_contacts" ADD COLUMN     "secondary_owner_membership_id" TEXT;

-- AlterTable
ALTER TABLE "crm_leads" ADD COLUMN     "secondary_owner_membership_id" TEXT;

-- AlterTable
ALTER TABLE "crm_deals" ADD COLUMN     "project_manager_membership_id" TEXT,
ADD COLUMN     "secondary_owner_membership_id" TEXT;

-- AlterTable
ALTER TABLE "proposal_approvals" ADD COLUMN     "rule_id" TEXT;

-- AlterTable
ALTER TABLE "signature_requests" DROP COLUMN "provider",
DROP COLUMN "provider_request_id";

-- AlterTable
ALTER TABLE "signers" DROP COLUMN "provider_signer_id",
ADD COLUMN     "consent_accepted_at" TIMESTAMP(3),
ADD COLUMN     "consent_text_version" TEXT,
ADD COLUMN     "identity_verified_at" TIMESTAMP(3),
ADD COLUMN     "signature_document_id" TEXT,
ADD COLUMN     "signature_type" "SignatureType";

-- AlterTable
ALTER TABLE "signature_events" DROP COLUMN "provider",
DROP COLUMN "provider_event_id";

-- DropEnum
DROP TYPE "SignatureProvider";

-- CreateTable
CREATE TABLE "crm_sales_targets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "pipeline_id" TEXT,
    "owner_membership_id" TEXT,
    "team_id" TEXT,
    "period" "CrmTargetPeriod" NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "metric" "CrmTargetMetric" NOT NULL DEFAULT 'REVENUE_WON',
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_sales_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_forecast_snapshots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,
    "owner_membership_id" TEXT,
    "team_id" TEXT,
    "snapshot_date" DATE NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "pipeline_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "best_case_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "commit_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "closed_won_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "weighted_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deal_count" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_forecast_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_dashboard_layouts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role_id" TEXT,
    "team_id" TEXT,
    "widgets" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_dashboard_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_lead_scoring_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "conditions" JSONB NOT NULL,
    "points" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_lead_scoring_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_approval_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_approval_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_ai_findings" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "section_id" TEXT,
    "kind" "ContractAiFindingKind" NOT NULL,
    "severity" "ContractRiskLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "recommendation" TEXT,
    "status" "ContractAiFindingStatus" NOT NULL DEFAULT 'OPEN',
    "model" TEXT,
    "review_run_id" TEXT,
    "confidence" DECIMAL(5,4),
    "reviewed_by_membership_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_ai_findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_sales_targets_organization_id_period_start_idx" ON "crm_sales_targets"("organization_id", "period_start");

-- CreateIndex
CREATE INDEX "crm_sales_targets_owner_membership_id_idx" ON "crm_sales_targets"("owner_membership_id");

-- CreateIndex
CREATE INDEX "crm_sales_targets_team_id_idx" ON "crm_sales_targets"("team_id");

-- CreateIndex
CREATE INDEX "crm_forecast_snapshots_organization_id_pipeline_id_snapshot_idx" ON "crm_forecast_snapshots"("organization_id", "pipeline_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "crm_forecast_snapshots_organization_id_period_start_idx" ON "crm_forecast_snapshots"("organization_id", "period_start");

-- CreateIndex
CREATE INDEX "crm_dashboard_layouts_organization_id_role_id_idx" ON "crm_dashboard_layouts"("organization_id", "role_id");

-- CreateIndex
CREATE INDEX "crm_dashboard_layouts_organization_id_team_id_idx" ON "crm_dashboard_layouts"("organization_id", "team_id");

-- CreateIndex
CREATE INDEX "crm_lead_scoring_rules_organization_id_enabled_idx" ON "crm_lead_scoring_rules"("organization_id", "enabled");

-- CreateIndex
CREATE INDEX "proposal_approval_rules_organization_id_enabled_priority_idx" ON "proposal_approval_rules"("organization_id", "enabled", "priority");

-- CreateIndex
CREATE INDEX "contract_ai_findings_version_id_status_idx" ON "contract_ai_findings"("version_id", "status");

-- AddForeignKey
ALTER TABLE "crm_companies" ADD CONSTRAINT "crm_companies_secondary_owner_membership_id_fkey" FOREIGN KEY ("secondary_owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_companies" ADD CONSTRAINT "crm_companies_project_manager_membership_id_fkey" FOREIGN KEY ("project_manager_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_secondary_owner_membership_id_fkey" FOREIGN KEY ("secondary_owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_secondary_owner_membership_id_fkey" FOREIGN KEY ("secondary_owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_secondary_owner_membership_id_fkey" FOREIGN KEY ("secondary_owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_project_manager_membership_id_fkey" FOREIGN KEY ("project_manager_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_sales_targets" ADD CONSTRAINT "crm_sales_targets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_sales_targets" ADD CONSTRAINT "crm_sales_targets_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "crm_pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_sales_targets" ADD CONSTRAINT "crm_sales_targets_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_sales_targets" ADD CONSTRAINT "crm_sales_targets_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_forecast_snapshots" ADD CONSTRAINT "crm_forecast_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_forecast_snapshots" ADD CONSTRAINT "crm_forecast_snapshots_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "crm_pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_forecast_snapshots" ADD CONSTRAINT "crm_forecast_snapshots_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_forecast_snapshots" ADD CONSTRAINT "crm_forecast_snapshots_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_dashboard_layouts" ADD CONSTRAINT "crm_dashboard_layouts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_dashboard_layouts" ADD CONSTRAINT "crm_dashboard_layouts_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_dashboard_layouts" ADD CONSTRAINT "crm_dashboard_layouts_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_scoring_rules" ADD CONSTRAINT "crm_lead_scoring_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_approval_rules" ADD CONSTRAINT "proposal_approval_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_ai_findings" ADD CONSTRAINT "contract_ai_findings_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "contract_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_ai_findings" ADD CONSTRAINT "contract_ai_findings_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "contract_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_ai_findings" ADD CONSTRAINT "contract_ai_findings_reviewed_by_membership_id_fkey" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
