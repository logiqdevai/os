-- CreateEnum
CREATE TYPE "ProjectStatusCategory" AS ENUM ('DRAFT', 'PLANNED', 'NOT_STARTED', 'IN_PROGRESS', 'ON_HOLD', 'BLOCKED', 'READY_FOR_COMPLETION', 'COMPLETED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectHealth" AS ENUM ('HEALTHY', 'AT_RISK', 'BLOCKED', 'CRITICAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CalculationMode" AS ENUM ('MANUAL', 'AUTOMATIC', 'HYBRID');

-- CreateEnum
CREATE TYPE "ProjectPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ProjectVisibility" AS ENUM ('INTERNAL', 'CUSTOMER_VISIBLE');

-- CreateEnum
CREATE TYPE "ProjectItemStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'AT_RISK', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliverableStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'SUBMITTED', 'CHANGES_REQUESTED', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AcceptanceStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'WAIVED');

-- CreateEnum
CREATE TYPE "DependencyItemType" AS ENUM ('PROJECT', 'WORKSTREAM', 'MILESTONE', 'DELIVERABLE', 'TASK', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('FINISH_TO_START', 'START_TO_START', 'FINISH_TO_FINISH', 'START_TO_FINISH', 'BLOCKS', 'RELATED');

-- CreateEnum
CREATE TYPE "DependencyStatus" AS ENUM ('OPEN', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('OPEN', 'MONITORING', 'MITIGATED', 'ACCEPTED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProjectIssueKind" AS ENUM ('ISSUE', 'BLOCKER');

-- CreateEnum
CREATE TYPE "ProjectIssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ProjectChangeRequestStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'ESTIMATING', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'SCHEDULED', 'IMPLEMENTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectGateKind" AS ENUM ('APPROVAL', 'QUALITY');

-- CreateEnum
CREATE TYPE "ProjectGateStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'WAIVED');

-- CreateEnum
CREATE TYPE "ProjectReviewType" AS ENUM ('KICKOFF', 'MILESTONE', 'DELIVERY', 'QUALITY', 'CUSTOMER', 'POST_PROJECT', 'RETROSPECTIVE');

-- CreateEnum
CREATE TYPE "ProjectRelationType" AS ENUM ('RELATED', 'DEPENDENCY', 'REPLACEMENT', 'FOLLOW_UP', 'MAINTENANCE_FOR', 'CONTINUATION_OF');

-- CreateEnum
CREATE TYPE "EscalationStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "HandoverStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "project_types" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "default_template_id" TEXT,
    "enabled_sections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "health_rules" JSONB,
    "completion_requirements" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_statuses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "ProjectStatusCategory" NOT NULL,
    "color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "allowed_transitions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "current_version_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deprecated_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_template_versions" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "change_summary" TEXT,
    "structure" JSONB NOT NULL,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "parent_project_id" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type_id" TEXT,
    "status_id" TEXT,
    "health" "ProjectHealth" NOT NULL DEFAULT 'UNKNOWN',
    "health_mode" "CalculationMode" NOT NULL DEFAULT 'HYBRID',
    "health_reason" TEXT,
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "progress_mode" "CalculationMode" NOT NULL DEFAULT 'AUTOMATIC',
    "priority" "ProjectPriority" NOT NULL DEFAULT 'MEDIUM',
    "visibility" "ProjectVisibility" NOT NULL DEFAULT 'INTERNAL',
    "company_id" TEXT,
    "owner_membership_id" TEXT,
    "team_id" TEXT,
    "template_id" TEXT,
    "template_version_id" TEXT,
    "proposal_id" TEXT,
    "proposal_version_id" TEXT,
    "planned_start" DATE,
    "actual_start" DATE,
    "target_completion" DATE,
    "actual_completion" DATE,
    "review_date" DATE,
    "internal_deadline" DATE,
    "customer_deadline" DATE,
    "budget_hours" DECIMAL(12,2),
    "budget_amount" DECIMAL(18,2),
    "currency" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "channel_id" TEXT,
    "runbook_page_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "reopened_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_branches" (
    "project_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_branches_pkey" PRIMARY KEY ("project_id","branch_id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "role_id" TEXT,
    "role_label" TEXT,
    "allocation_percent" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_stakeholders" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "name" TEXT NOT NULL,
    "organization_name" TEXT,
    "email" TEXT,
    "role" TEXT,
    "responsibility" TEXT,
    "portal_visible" BOOLEAN NOT NULL DEFAULT false,
    "decision_authority" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_stakeholders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_objectives" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner_membership_id" TEXT,
    "target_date" DATE,
    "success_criteria" TEXT,
    "status" "ProjectItemStatus" NOT NULL DEFAULT 'PLANNED',
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_workstreams" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner_membership_id" TEXT,
    "status" "ProjectItemStatus" NOT NULL DEFAULT 'PLANNED',
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "planned_start" DATE,
    "planned_end" DATE,
    "actual_start" DATE,
    "actual_end" DATE,
    "color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_workstreams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_milestones" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "workstream_id" TEXT,
    "objective_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner_membership_id" TEXT,
    "status" "ProjectItemStatus" NOT NULL DEFAULT 'PLANNED',
    "planned_date" DATE,
    "actual_date" DATE,
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "customer_visible" BOOLEAN NOT NULL DEFAULT false,
    "is_billing_milestone" BOOLEAN NOT NULL DEFAULT false,
    "proposal_milestone_key" TEXT,
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_deliverables" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "milestone_id" TEXT,
    "workstream_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner_membership_id" TEXT,
    "status" "DeliverableStatus" NOT NULL DEFAULT 'PLANNED',
    "due_date" DATE,
    "customer_visible" BOOLEAN NOT NULL DEFAULT false,
    "document_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "proposal_reference" TEXT,
    "submitted_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "acceptance_record" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_acceptance_criteria" (
    "id" TEXT NOT NULL,
    "deliverable_id" TEXT,
    "milestone_id" TEXT,
    "requirement" TEXT NOT NULL,
    "expected_outcome" TEXT,
    "verification_method" TEXT,
    "status" "AcceptanceStatus" NOT NULL DEFAULT 'PENDING',
    "reviewer_membership_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "project_acceptance_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_dependencies" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "source_type" "DependencyItemType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "target_type" "DependencyItemType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "type" "DependencyType" NOT NULL DEFAULT 'FINISH_TO_START',
    "status" "DependencyStatus" NOT NULL DEFAULT 'OPEN',
    "owner_membership_id" TEXT,
    "expected_resolution" DATE,
    "lag_days" INTEGER,
    "notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_risks" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "probability" INTEGER,
    "impact" INTEGER,
    "severity" "Severity" NOT NULL DEFAULT 'MEDIUM',
    "status" "RiskStatus" NOT NULL DEFAULT 'OPEN',
    "owner_membership_id" TEXT,
    "mitigation" TEXT,
    "contingency" TEXT,
    "due_date" DATE,
    "milestone_id" TEXT,
    "task_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_issues" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "kind" "ProjectIssueKind" NOT NULL DEFAULT 'ISSUE',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "Severity" NOT NULL DEFAULT 'MEDIUM',
    "priority" "ProjectPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "ProjectIssueStatus" NOT NULL DEFAULT 'OPEN',
    "owner_membership_id" TEXT,
    "blocked_item_type" "DependencyItemType",
    "blocked_item_id" TEXT,
    "milestone_id" TEXT,
    "task_id" TEXT,
    "dependency_id" TEXT,
    "ticket_id" TEXT,
    "identified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "target_resolution" DATE,
    "resolution" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_decisions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decision_maker_membership_id" TEXT,
    "participants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "alternatives_considered" TEXT,
    "selected_option" TEXT,
    "reason" TEXT,
    "consequences" TEXT,
    "milestone_id" TEXT,
    "task_id" TEXT,
    "document_id" TEXT,
    "source_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_status_updates" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "period_start" DATE,
    "period_end" DATE,
    "summary" TEXT NOT NULL,
    "completed_work" TEXT,
    "current_work" TEXT,
    "upcoming_work" TEXT,
    "progress_percent" INTEGER,
    "health" "ProjectHealth",
    "risks_summary" TEXT,
    "blockers_summary" TEXT,
    "decisions_summary" TEXT,
    "required_actions" TEXT,
    "author_membership_id" TEXT,
    "customer_visible" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "is_ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_status_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_change_requests" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requester_membership_id" TEXT,
    "requester_contact_id" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priority" "ProjectPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "ProjectChangeRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "scope_impact" TEXT,
    "timeline_impact_days" INTEGER,
    "resource_impact" TEXT,
    "cost_impact_amount" DECIMAL(18,2),
    "currency" TEXT,
    "customer_visible" BOOLEAN NOT NULL DEFAULT false,
    "approved_by_membership_id" TEXT,
    "approved_by_customer_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "deliverable_id" TEXT,
    "task_id" TEXT,
    "proposal_id" TEXT,
    "contract_id" TEXT,
    "contract_change_request_id" TEXT,
    "implemented_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_gates" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "kind" "ProjectGateKind" NOT NULL DEFAULT 'APPROVAL',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "milestone_id" TEXT,
    "approver_membership_id" TEXT,
    "customer_approver_user_id" TEXT,
    "status" "ProjectGateStatus" NOT NULL DEFAULT 'PENDING',
    "blocks_completion" BOOLEAN NOT NULL DEFAULT false,
    "decision_comment" TEXT,
    "decided_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_gates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_reviews" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" "ProjectReviewType" NOT NULL,
    "title" TEXT NOT NULL,
    "held_at" TIMESTAMP(3),
    "facilitator_membership_id" TEXT,
    "participants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "findings" TEXT,
    "decisions" TEXT,
    "went_well" TEXT,
    "went_wrong" TEXT,
    "root_causes" TEXT,
    "lessons" TEXT,
    "actions" JSONB,
    "milestone_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_allocations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "membership_id" TEXT,
    "team_id" TEXT,
    "role_label" TEXT,
    "workstream_id" TEXT,
    "milestone_id" TEXT,
    "planned_hours" DECIMAL(10,2),
    "allocation_percent" INTEGER,
    "start_date" DATE,
    "end_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_checklists" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phase" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_checklist_items" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_by_membership_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "task_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "project_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_escalations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "issue_summary" TEXT NOT NULL,
    "category" TEXT,
    "severity" "Severity" NOT NULL DEFAULT 'HIGH',
    "status" "EscalationStatus" NOT NULL DEFAULT 'OPEN',
    "owner_membership_id" TEXT,
    "escalated_to_membership_id" TEXT,
    "escalated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action_taken" TEXT,
    "resolution" TEXT,
    "resolved_at" TIMESTAMP(3),
    "issue_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_handovers" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "from_team_id" TEXT,
    "to_team_id" TEXT,
    "new_owner_membership_id" TEXT,
    "status" "HandoverStatus" NOT NULL DEFAULT 'PLANNED',
    "scheduled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "details" JSONB,
    "accepted_by_membership_id" TEXT,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_closeouts" (
    "project_id" TEXT NOT NULL,
    "completion_checklist" JSONB,
    "final_status_summary" TEXT,
    "outstanding_items" TEXT,
    "lessons_learned" TEXT,
    "customer_outcome" TEXT,
    "financial_review_ref" TEXT,
    "documentation_document_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customer_acceptance_recorded_at" TIMESTAMP(3),
    "closed_by_membership_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_closeouts_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "project_relations" (
    "id" TEXT NOT NULL,
    "source_project_id" TEXT NOT NULL,
    "target_project_id" TEXT NOT NULL,
    "type" "ProjectRelationType" NOT NULL DEFAULT 'RELATED',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_external_references" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "label" TEXT,
    "external_id" TEXT,
    "url" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_external_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_types_organization_id_slug_key" ON "project_types"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "project_statuses_organization_id_slug_key" ON "project_statuses"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "project_templates_current_version_id_key" ON "project_templates"("current_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_templates_organization_id_slug_key" ON "project_templates"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "project_template_versions_template_id_version_number_key" ON "project_template_versions"("template_id", "version_number");

-- CreateIndex
CREATE INDEX "projects_organization_id_status_id_idx" ON "projects"("organization_id", "status_id");

-- CreateIndex
CREATE INDEX "projects_organization_id_health_idx" ON "projects"("organization_id", "health");

-- CreateIndex
CREATE INDEX "projects_company_id_idx" ON "projects"("company_id");

-- CreateIndex
CREATE INDEX "projects_owner_membership_id_idx" ON "projects"("owner_membership_id");

-- CreateIndex
CREATE INDEX "projects_parent_project_id_idx" ON "projects"("parent_project_id");

-- CreateIndex
CREATE INDEX "projects_target_completion_idx" ON "projects"("target_completion");

-- CreateIndex
CREATE UNIQUE INDEX "projects_organization_id_slug_key" ON "projects"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "projects_organization_id_code_key" ON "projects"("organization_id", "code");

-- CreateIndex
CREATE INDEX "project_branches_branch_id_idx" ON "project_branches"("branch_id");

-- CreateIndex
CREATE INDEX "project_members_membership_id_is_active_idx" ON "project_members"("membership_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_membership_id_key" ON "project_members"("project_id", "membership_id");

-- CreateIndex
CREATE INDEX "project_stakeholders_project_id_idx" ON "project_stakeholders"("project_id");

-- CreateIndex
CREATE INDEX "project_objectives_project_id_idx" ON "project_objectives"("project_id");

-- CreateIndex
CREATE INDEX "project_workstreams_project_id_idx" ON "project_workstreams"("project_id");

-- CreateIndex
CREATE INDEX "project_milestones_project_id_planned_date_idx" ON "project_milestones"("project_id", "planned_date");

-- CreateIndex
CREATE INDEX "project_milestones_workstream_id_idx" ON "project_milestones"("workstream_id");

-- CreateIndex
CREATE INDEX "project_deliverables_project_id_status_idx" ON "project_deliverables"("project_id", "status");

-- CreateIndex
CREATE INDEX "project_deliverables_milestone_id_idx" ON "project_deliverables"("milestone_id");

-- CreateIndex
CREATE INDEX "project_acceptance_criteria_deliverable_id_idx" ON "project_acceptance_criteria"("deliverable_id");

-- CreateIndex
CREATE INDEX "project_acceptance_criteria_milestone_id_idx" ON "project_acceptance_criteria"("milestone_id");

-- CreateIndex
CREATE INDEX "project_dependencies_project_id_status_idx" ON "project_dependencies"("project_id", "status");

-- CreateIndex
CREATE INDEX "project_dependencies_source_type_source_id_idx" ON "project_dependencies"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "project_dependencies_target_type_target_id_idx" ON "project_dependencies"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "project_risks_project_id_status_idx" ON "project_risks"("project_id", "status");

-- CreateIndex
CREATE INDEX "project_issues_project_id_kind_status_idx" ON "project_issues"("project_id", "kind", "status");

-- CreateIndex
CREATE INDEX "project_decisions_project_id_decided_at_idx" ON "project_decisions"("project_id", "decided_at");

-- CreateIndex
CREATE INDEX "project_status_updates_project_id_published_at_idx" ON "project_status_updates"("project_id", "published_at");

-- CreateIndex
CREATE INDEX "project_change_requests_project_id_status_idx" ON "project_change_requests"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_change_requests_project_id_number_key" ON "project_change_requests"("project_id", "number");

-- CreateIndex
CREATE INDEX "project_gates_project_id_status_idx" ON "project_gates"("project_id", "status");

-- CreateIndex
CREATE INDEX "project_reviews_project_id_type_idx" ON "project_reviews"("project_id", "type");

-- CreateIndex
CREATE INDEX "project_allocations_project_id_idx" ON "project_allocations"("project_id");

-- CreateIndex
CREATE INDEX "project_allocations_membership_id_start_date_end_date_idx" ON "project_allocations"("membership_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "project_checklists_project_id_idx" ON "project_checklists"("project_id");

-- CreateIndex
CREATE INDEX "project_checklist_items_checklist_id_idx" ON "project_checklist_items"("checklist_id");

-- CreateIndex
CREATE INDEX "project_escalations_project_id_status_idx" ON "project_escalations"("project_id", "status");

-- CreateIndex
CREATE INDEX "project_handovers_project_id_status_idx" ON "project_handovers"("project_id", "status");

-- CreateIndex
CREATE INDEX "project_relations_target_project_id_idx" ON "project_relations"("target_project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_relations_source_project_id_target_project_id_type_key" ON "project_relations"("source_project_id", "target_project_id", "type");

-- CreateIndex
CREATE INDEX "project_external_references_project_id_system_idx" ON "project_external_references"("project_id", "system");

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_converted_project_id_fkey" FOREIGN KEY ("converted_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_projects" ADD CONSTRAINT "contract_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_types" ADD CONSTRAINT "project_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_types" ADD CONSTRAINT "project_types_default_template_id_fkey" FOREIGN KEY ("default_template_id") REFERENCES "project_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_statuses" ADD CONSTRAINT "project_statuses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "project_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "project_template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_template_versions" ADD CONSTRAINT "project_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "project_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_parent_project_id_fkey" FOREIGN KEY ("parent_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "project_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "project_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "project_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "project_template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_proposal_version_id_fkey" FOREIGN KEY ("proposal_version_id") REFERENCES "proposal_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_branches" ADD CONSTRAINT "project_branches_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_branches" ADD CONSTRAINT "project_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_stakeholders" ADD CONSTRAINT "project_stakeholders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_stakeholders" ADD CONSTRAINT "project_stakeholders_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_objectives" ADD CONSTRAINT "project_objectives_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_workstreams" ADD CONSTRAINT "project_workstreams_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_workstream_id_fkey" FOREIGN KEY ("workstream_id") REFERENCES "project_workstreams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "project_objectives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deliverables" ADD CONSTRAINT "project_deliverables_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deliverables" ADD CONSTRAINT "project_deliverables_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deliverables" ADD CONSTRAINT "project_deliverables_workstream_id_fkey" FOREIGN KEY ("workstream_id") REFERENCES "project_workstreams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_acceptance_criteria" ADD CONSTRAINT "project_acceptance_criteria_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "project_deliverables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_acceptance_criteria" ADD CONSTRAINT "project_acceptance_criteria_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_dependencies" ADD CONSTRAINT "project_dependencies_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_risks" ADD CONSTRAINT "project_risks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_issues" ADD CONSTRAINT "project_issues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_decisions" ADD CONSTRAINT "project_decisions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_status_updates" ADD CONSTRAINT "project_status_updates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_change_requests" ADD CONSTRAINT "project_change_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_gates" ADD CONSTRAINT "project_gates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_gates" ADD CONSTRAINT "project_gates_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_gates" ADD CONSTRAINT "project_gates_approver_membership_id_fkey" FOREIGN KEY ("approver_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_reviews" ADD CONSTRAINT "project_reviews_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_allocations" ADD CONSTRAINT "project_allocations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_allocations" ADD CONSTRAINT "project_allocations_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_allocations" ADD CONSTRAINT "project_allocations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_allocations" ADD CONSTRAINT "project_allocations_workstream_id_fkey" FOREIGN KEY ("workstream_id") REFERENCES "project_workstreams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_allocations" ADD CONSTRAINT "project_allocations_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_checklists" ADD CONSTRAINT "project_checklists_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_checklist_items" ADD CONSTRAINT "project_checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "project_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_escalations" ADD CONSTRAINT "project_escalations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_handovers" ADD CONSTRAINT "project_handovers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_closeouts" ADD CONSTRAINT "project_closeouts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_relations" ADD CONSTRAINT "project_relations_source_project_id_fkey" FOREIGN KEY ("source_project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_relations" ADD CONSTRAINT "project_relations_target_project_id_fkey" FOREIGN KEY ("target_project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_external_references" ADD CONSTRAINT "project_external_references_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

