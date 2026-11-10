-- CreateEnum
CREATE TYPE "RecordEntityType" AS ENUM ('CRM_COMPANY', 'CRM_CONTACT', 'CRM_LEAD', 'CRM_DEAL', 'CRM_ACTIVITY', 'PROJECT', 'TASK', 'CONTRACT', 'PROPOSAL', 'TICKET', 'DOCUMENT', 'FINANCIAL_RECORD', 'EMPLOYEE', 'INVOICE');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'LONG_TEXT', 'NUMBER', 'DECIMAL', 'CURRENCY', 'PERCENTAGE', 'BOOLEAN', 'DATE', 'DATETIME', 'EMAIL', 'PHONE', 'URL', 'DROPDOWN', 'MULTI_SELECT', 'RADIO', 'USER', 'TEAM', 'COMPANY', 'CONTACT', 'DEAL', 'RECORD_REFERENCE');

-- CreateEnum
CREATE TYPE "SavedViewVisibility" AS ENUM ('PERSONAL', 'TEAM', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "CrmCompanyType" AS ENUM ('PROSPECT', 'CUSTOMER', 'PARTNER', 'VENDOR', 'OTHER');

-- CreateEnum
CREATE TYPE "CrmContactRole" AS ENUM ('PRIMARY', 'DECISION_MAKER', 'TECHNICAL', 'BILLING', 'PROJECT_STAKEHOLDER', 'EXECUTIVE');

-- CreateEnum
CREATE TYPE "CrmActivityType" AS ENUM ('CALL', 'MEETING', 'FOLLOW_UP', 'REMINDER', 'APPOINTMENT', 'INTERNAL_COMMENT', 'EMAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "CrmActivityStatus" AS ENUM ('PLANNED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "CrmPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "CrmForecastCategory" AS ENUM ('PIPELINE', 'BEST_CASE', 'COMMIT', 'CLOSED_WON', 'CLOSED_LOST');

-- CreateEnum
CREATE TYPE "CrmDealStatus" AS ENUM ('OPEN', 'WON', 'LOST', 'ABANDONED');

-- CreateEnum
CREATE TYPE "CrmImportStatus" AS ENUM ('PENDING', 'VALIDATING', 'PREVIEW', 'IMPORTING', 'COMPLETED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "CrmBranchRelationType" AS ENUM ('OWNER', 'SALES', 'DELIVERY', 'SUPPORT', 'BILLING', 'OTHER');

-- CreateTable
CREATE TABLE "custom_field_groups" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_field_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "group_id" TEXT,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "type" "CustomFieldType" NOT NULL,
    "entity_types" "RecordEntityType"[],
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "default_value" JSONB,
    "validation" JSONB,
    "visibility" JSONB,
    "is_searchable" BOOLEAN NOT NULL DEFAULT true,
    "is_filterable" BOOLEAN NOT NULL DEFAULT true,
    "is_sortable" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_values" (
    "id" TEXT NOT NULL,
    "definition_id" TEXT NOT NULL,
    "entity_type" "RecordEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "value" JSONB,
    "value_text" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "entity_types" "RecordEntityType"[] DEFAULT ARRAY[]::"RecordEntityType"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taggings" (
    "tag_id" TEXT NOT NULL,
    "entity_type" "RecordEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taggings_pkey" PRIMARY KEY ("tag_id","entity_type","entity_id")
);

-- CreateTable
CREATE TABLE "saved_views" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entity_type" "RecordEntityType" NOT NULL,
    "name" TEXT NOT NULL,
    "layout" TEXT NOT NULL DEFAULT 'table',
    "visibility" "SavedViewVisibility" NOT NULL DEFAULT 'PERSONAL',
    "owner_membership_id" TEXT,
    "team_id" TEXT,
    "filters" JSONB,
    "sorting" JSONB,
    "grouping" JSONB,
    "columns" JSONB,
    "search" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_lead_sources" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_lead_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_lead_statuses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_converted" BOOLEAN NOT NULL DEFAULT false,
    "is_lost" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_lead_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_lifecycle_stages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_customer" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_lifecycle_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_lifecycle_history" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "contact_id" TEXT,
    "stage_id" TEXT NOT NULL,
    "changed_by_user_id" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_lifecycle_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_pipelines" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "team_id" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_pipeline_stages" (
    "id" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "probability" INTEGER NOT NULL DEFAULT 0,
    "forecast_category" "CrmForecastCategory" NOT NULL DEFAULT 'PIPELINE',
    "is_won" BOOLEAN NOT NULL DEFAULT false,
    "is_lost" BOOLEAN NOT NULL DEFAULT false,
    "stale_after_days" INTEGER,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_companies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "parent_company_id" TEXT,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "type" "CrmCompanyType" NOT NULL DEFAULT 'PROSPECT',
    "lifecycle_stage_id" TEXT,
    "industry" TEXT,
    "company_size" TEXT,
    "number_of_employees" INTEGER,
    "annual_revenue" DECIMAL(18,2),
    "currency" TEXT,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "address" JSONB,
    "tax_id" TEXT,
    "vat_number" TEXT,
    "registration_number" TEXT,
    "description" TEXT,
    "lead_source_id" TEXT,
    "customer_since" TIMESTAMP(3),
    "owner_membership_id" TEXT,
    "account_manager_membership_id" TEXT,
    "success_owner_membership_id" TEXT,
    "team_id" TEXT,
    "external_ids" JSONB,
    "last_activity_at" TIMESTAMP(3),
    "next_activity_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_company_branches" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "relation_type" "CrmBranchRelationType" NOT NULL DEFAULT 'SALES',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_company_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_contacts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "company_id" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "job_title" TEXT,
    "department" TEXT,
    "email" TEXT,
    "emails" JSONB,
    "phone" TEXT,
    "mobile" TEXT,
    "phones" JSONB,
    "website" TEXT,
    "linkedin_url" TEXT,
    "social_profiles" JSONB,
    "roles" "CrmContactRole"[] DEFAULT ARRAY[]::"CrmContactRole"[],
    "contact_type" TEXT,
    "lifecycle_stage_id" TEXT,
    "lead_source_id" TEXT,
    "owner_membership_id" TEXT,
    "timezone" TEXT,
    "language" TEXT,
    "consent" JSONB,
    "description" TEXT,
    "last_activity_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_leads" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "company_id" TEXT,
    "contact_id" TEXT,
    "company_name" TEXT,
    "contact_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "industry" TEXT,
    "estimated_company_size" TEXT,
    "estimated_value" DECIMAL(18,2),
    "currency" TEXT,
    "status_id" TEXT,
    "lead_source_id" TEXT,
    "owner_membership_id" TEXT,
    "qualification" JSONB,
    "qualification_notes" TEXT,
    "lead_score" INTEGER,
    "manual_score" INTEGER,
    "description" TEXT,
    "last_activity_at" TIMESTAMP(3),
    "next_follow_up_at" TIMESTAMP(3),
    "converted_at" TIMESTAMP(3),
    "converted_company_id" TEXT,
    "converted_contact_id" TEXT,
    "converted_deal_id" TEXT,
    "lost_reason" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_deals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "pipeline_id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company_id" TEXT,
    "primary_contact_id" TEXT,
    "owner_membership_id" TEXT,
    "team_id" TEXT,
    "status" "CrmDealStatus" NOT NULL DEFAULT 'OPEN',
    "value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "recurring_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "one_time_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "probability" INTEGER,
    "forecast_category" "CrmForecastCategory" NOT NULL DEFAULT 'PIPELINE',
    "expected_close_date" DATE,
    "actual_close_date" DATE,
    "deal_type" TEXT,
    "lead_source_id" TEXT,
    "competitor" TEXT,
    "lost_reason" TEXT,
    "next_step" TEXT,
    "description" TEXT,
    "proposal_id" TEXT,
    "contract_id" TEXT,
    "project_id" TEXT,
    "stage_entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_deal_contacts" (
    "deal_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "role" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_deal_contacts_pkey" PRIMARY KEY ("deal_id","contact_id")
);

-- CreateTable
CREATE TABLE "crm_deal_line_items" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "product_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount_percent" DECIMAL(5,2),
    "discount_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_percent" DECIMAL(5,2),
    "net_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gross_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "billing_frequency" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_deal_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_deal_stage_history" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "from_stage_id" TEXT,
    "to_stage_id" TEXT NOT NULL,
    "changed_by_user_id" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_seconds" INTEGER,

    CONSTRAINT "crm_deal_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_activities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "CrmActivityType" NOT NULL,
    "status" "CrmActivityStatus" NOT NULL DEFAULT 'PLANNED',
    "priority" "CrmPriority" NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "company_id" TEXT,
    "contact_id" TEXT,
    "lead_id" TEXT,
    "deal_id" TEXT,
    "project_id" TEXT,
    "owner_membership_id" TEXT,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "duration_minutes" INTEGER,
    "location" TEXT,
    "meeting_url" TEXT,
    "calendar_event_id" TEXT,
    "outcome" TEXT,
    "automation_rule_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_activity_participants" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "membership_id" TEXT,
    "contact_id" TEXT,
    "response" TEXT,

    CONSTRAINT "crm_activity_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_notes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entity_type" "RecordEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "author_membership_id" TEXT,
    "body" TEXT NOT NULL,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "edited_at" TIMESTAMP(3),
    "edit_history" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_assignment_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entity_type" "RecordEntityType" NOT NULL,
    "conditions" JSONB NOT NULL,
    "assign_to" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_assignment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_import_jobs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entity_type" "RecordEntityType" NOT NULL,
    "status" "CrmImportStatus" NOT NULL DEFAULT 'PENDING',
    "document_id" TEXT,
    "file_name" TEXT,
    "field_mapping" JSONB,
    "duplicate_strategy" JSONB,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "imported_rows" INTEGER NOT NULL DEFAULT 0,
    "updated_rows" INTEGER NOT NULL DEFAULT 0,
    "skipped_rows" INTEGER NOT NULL DEFAULT 0,
    "error_rows" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "created_record_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "started_by_membership_id" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "rolled_back_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_groups_organization_id_name_key" ON "custom_field_groups"("organization_id", "name");

-- CreateIndex
CREATE INDEX "custom_field_definitions_organization_id_idx" ON "custom_field_definitions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_definitions_organization_id_key_key" ON "custom_field_definitions"("organization_id", "key");

-- CreateIndex
CREATE INDEX "custom_field_values_entity_type_entity_id_idx" ON "custom_field_values"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "custom_field_values_definition_id_value_text_idx" ON "custom_field_values"("definition_id", "value_text");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_values_definition_id_entity_id_key" ON "custom_field_values"("definition_id", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_organization_id_slug_key" ON "tags"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "taggings_entity_type_entity_id_idx" ON "taggings"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "saved_views_organization_id_entity_type_idx" ON "saved_views"("organization_id", "entity_type");

-- CreateIndex
CREATE INDEX "saved_views_owner_membership_id_idx" ON "saved_views"("owner_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_lead_sources_organization_id_slug_key" ON "crm_lead_sources"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "crm_lead_statuses_organization_id_slug_key" ON "crm_lead_statuses"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "crm_lifecycle_stages_organization_id_slug_key" ON "crm_lifecycle_stages"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "crm_lifecycle_history_company_id_changed_at_idx" ON "crm_lifecycle_history"("company_id", "changed_at");

-- CreateIndex
CREATE INDEX "crm_lifecycle_history_contact_id_changed_at_idx" ON "crm_lifecycle_history"("contact_id", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "crm_pipelines_organization_id_slug_key" ON "crm_pipelines"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "crm_pipeline_stages_pipeline_id_sort_order_idx" ON "crm_pipeline_stages"("pipeline_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "crm_pipeline_stages_pipeline_id_slug_key" ON "crm_pipeline_stages"("pipeline_id", "slug");

-- CreateIndex
CREATE INDEX "crm_companies_organization_id_name_idx" ON "crm_companies"("organization_id", "name");

-- CreateIndex
CREATE INDEX "crm_companies_organization_id_type_idx" ON "crm_companies"("organization_id", "type");

-- CreateIndex
CREATE INDEX "crm_companies_organization_id_lifecycle_stage_id_idx" ON "crm_companies"("organization_id", "lifecycle_stage_id");

-- CreateIndex
CREATE INDEX "crm_companies_owner_membership_id_idx" ON "crm_companies"("owner_membership_id");

-- CreateIndex
CREATE INDEX "crm_companies_parent_company_id_idx" ON "crm_companies"("parent_company_id");

-- CreateIndex
CREATE INDEX "crm_company_branches_branch_id_idx" ON "crm_company_branches"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_company_branches_company_id_branch_id_relation_type_key" ON "crm_company_branches"("company_id", "branch_id", "relation_type");

-- CreateIndex
CREATE INDEX "crm_contacts_organization_id_email_idx" ON "crm_contacts"("organization_id", "email");

-- CreateIndex
CREATE INDEX "crm_contacts_organization_id_last_name_first_name_idx" ON "crm_contacts"("organization_id", "last_name", "first_name");

-- CreateIndex
CREATE INDEX "crm_contacts_company_id_idx" ON "crm_contacts"("company_id");

-- CreateIndex
CREATE INDEX "crm_contacts_owner_membership_id_idx" ON "crm_contacts"("owner_membership_id");

-- CreateIndex
CREATE INDEX "crm_leads_organization_id_status_id_idx" ON "crm_leads"("organization_id", "status_id");

-- CreateIndex
CREATE INDEX "crm_leads_organization_id_owner_membership_id_idx" ON "crm_leads"("organization_id", "owner_membership_id");

-- CreateIndex
CREATE INDEX "crm_leads_organization_id_email_idx" ON "crm_leads"("organization_id", "email");

-- CreateIndex
CREATE INDEX "crm_deals_organization_id_pipeline_id_stage_id_idx" ON "crm_deals"("organization_id", "pipeline_id", "stage_id");

-- CreateIndex
CREATE INDEX "crm_deals_organization_id_status_idx" ON "crm_deals"("organization_id", "status");

-- CreateIndex
CREATE INDEX "crm_deals_company_id_idx" ON "crm_deals"("company_id");

-- CreateIndex
CREATE INDEX "crm_deals_owner_membership_id_idx" ON "crm_deals"("owner_membership_id");

-- CreateIndex
CREATE INDEX "crm_deals_expected_close_date_idx" ON "crm_deals"("expected_close_date");

-- CreateIndex
CREATE INDEX "crm_deal_contacts_contact_id_idx" ON "crm_deal_contacts"("contact_id");

-- CreateIndex
CREATE INDEX "crm_deal_line_items_deal_id_idx" ON "crm_deal_line_items"("deal_id");

-- CreateIndex
CREATE INDEX "crm_deal_stage_history_deal_id_changed_at_idx" ON "crm_deal_stage_history"("deal_id", "changed_at");

-- CreateIndex
CREATE INDEX "crm_activities_organization_id_starts_at_idx" ON "crm_activities"("organization_id", "starts_at");

-- CreateIndex
CREATE INDEX "crm_activities_company_id_idx" ON "crm_activities"("company_id");

-- CreateIndex
CREATE INDEX "crm_activities_contact_id_idx" ON "crm_activities"("contact_id");

-- CreateIndex
CREATE INDEX "crm_activities_deal_id_idx" ON "crm_activities"("deal_id");

-- CreateIndex
CREATE INDEX "crm_activities_lead_id_idx" ON "crm_activities"("lead_id");

-- CreateIndex
CREATE INDEX "crm_activities_owner_membership_id_status_idx" ON "crm_activities"("owner_membership_id", "status");

-- CreateIndex
CREATE INDEX "crm_activity_participants_contact_id_idx" ON "crm_activity_participants"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_activity_participants_activity_id_membership_id_contact_key" ON "crm_activity_participants"("activity_id", "membership_id", "contact_id");

-- CreateIndex
CREATE INDEX "crm_notes_entity_type_entity_id_created_at_idx" ON "crm_notes"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "crm_notes_organization_id_idx" ON "crm_notes"("organization_id");

-- CreateIndex
CREATE INDEX "crm_assignment_rules_organization_id_entity_type_enabled_idx" ON "crm_assignment_rules"("organization_id", "entity_type", "enabled");

-- CreateIndex
CREATE INDEX "crm_import_jobs_organization_id_status_idx" ON "crm_import_jobs"("organization_id", "status");

-- AddForeignKey
ALTER TABLE "custom_field_groups" ADD CONSTRAINT "custom_field_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "custom_field_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "custom_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taggings" ADD CONSTRAINT "taggings_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_sources" ADD CONSTRAINT "crm_lead_sources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_statuses" ADD CONSTRAINT "crm_lead_statuses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lifecycle_stages" ADD CONSTRAINT "crm_lifecycle_stages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lifecycle_history" ADD CONSTRAINT "crm_lifecycle_history_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lifecycle_history" ADD CONSTRAINT "crm_lifecycle_history_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lifecycle_history" ADD CONSTRAINT "crm_lifecycle_history_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "crm_lifecycle_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_pipelines" ADD CONSTRAINT "crm_pipelines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_pipelines" ADD CONSTRAINT "crm_pipelines_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_pipeline_stages" ADD CONSTRAINT "crm_pipeline_stages_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "crm_pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_companies" ADD CONSTRAINT "crm_companies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_companies" ADD CONSTRAINT "crm_companies_parent_company_id_fkey" FOREIGN KEY ("parent_company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_companies" ADD CONSTRAINT "crm_companies_lifecycle_stage_id_fkey" FOREIGN KEY ("lifecycle_stage_id") REFERENCES "crm_lifecycle_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_companies" ADD CONSTRAINT "crm_companies_lead_source_id_fkey" FOREIGN KEY ("lead_source_id") REFERENCES "crm_lead_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_companies" ADD CONSTRAINT "crm_companies_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_companies" ADD CONSTRAINT "crm_companies_account_manager_membership_id_fkey" FOREIGN KEY ("account_manager_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_companies" ADD CONSTRAINT "crm_companies_success_owner_membership_id_fkey" FOREIGN KEY ("success_owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_companies" ADD CONSTRAINT "crm_companies_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_company_branches" ADD CONSTRAINT "crm_company_branches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_company_branches" ADD CONSTRAINT "crm_company_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_lifecycle_stage_id_fkey" FOREIGN KEY ("lifecycle_stage_id") REFERENCES "crm_lifecycle_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_lead_source_id_fkey" FOREIGN KEY ("lead_source_id") REFERENCES "crm_lead_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "crm_lead_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_lead_source_id_fkey" FOREIGN KEY ("lead_source_id") REFERENCES "crm_lead_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_converted_company_id_fkey" FOREIGN KEY ("converted_company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_converted_contact_id_fkey" FOREIGN KEY ("converted_contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_converted_deal_id_fkey" FOREIGN KEY ("converted_deal_id") REFERENCES "crm_deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "crm_pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "crm_pipeline_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_primary_contact_id_fkey" FOREIGN KEY ("primary_contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_lead_source_id_fkey" FOREIGN KEY ("lead_source_id") REFERENCES "crm_lead_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deal_contacts" ADD CONSTRAINT "crm_deal_contacts_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "crm_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deal_contacts" ADD CONSTRAINT "crm_deal_contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deal_line_items" ADD CONSTRAINT "crm_deal_line_items_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "crm_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deal_stage_history" ADD CONSTRAINT "crm_deal_stage_history_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "crm_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deal_stage_history" ADD CONSTRAINT "crm_deal_stage_history_from_stage_id_fkey" FOREIGN KEY ("from_stage_id") REFERENCES "crm_pipeline_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deal_stage_history" ADD CONSTRAINT "crm_deal_stage_history_to_stage_id_fkey" FOREIGN KEY ("to_stage_id") REFERENCES "crm_pipeline_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "crm_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activity_participants" ADD CONSTRAINT "crm_activity_participants_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "crm_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activity_participants" ADD CONSTRAINT "crm_activity_participants_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_author_membership_id_fkey" FOREIGN KEY ("author_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_assignment_rules" ADD CONSTRAINT "crm_assignment_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_import_jobs" ADD CONSTRAINT "crm_import_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_import_jobs" ADD CONSTRAINT "crm_import_jobs_started_by_membership_id_fkey" FOREIGN KEY ("started_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

