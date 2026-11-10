-- CreateEnum
CREATE TYPE "TaskStatusCategory" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskDependencyType" AS ENUM ('BLOCKS', 'RELATED', 'DUPLICATE_OF');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'RELEASED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "TaskCommentVisibility" AS ENUM ('INTERNAL', 'CUSTOMER_VISIBLE');

-- CreateTable
CREATE TABLE "task_statuses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "team_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "TaskStatusCategory" NOT NULL,
    "color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "allowed_transitions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_types" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "template" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_labels" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "parent_label_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "team_id" TEXT,
    "project_id" TEXT,
    "number" INTEGER NOT NULL,
    "name" TEXT,
    "goal" TEXT,
    "status" "CycleStatus" NOT NULL DEFAULT 'PLANNED',
    "starts_at" DATE NOT NULL,
    "ends_at" DATE NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "team_id" TEXT,
    "project_id" TEXT,
    "workstream_id" TEXT,
    "milestone_id" TEXT,
    "parent_task_id" TEXT,
    "cycle_id" TEXT,
    "release_id" TEXT,
    "type_id" TEXT,
    "status_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'NONE',
    "assignee_membership_id" TEXT,
    "reporter_membership_id" TEXT,
    "estimate_points" DECIMAL(6,2),
    "estimate_hours" DECIMAL(8,2),
    "start_date" DATE,
    "due_date" DATE,
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "acceptance_criteria" JSONB,
    "customer_visible" BOOLEAN NOT NULL DEFAULT false,
    "automation_rule_id" TEXT,
    "recurring_template_task_id" TEXT,
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "rank" TEXT,
    "duplicate_of_task_id" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignees" (
    "task_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("task_id","membership_id")
);

-- CreateTable
CREATE TABLE "task_label_assignments" (
    "task_id" TEXT NOT NULL,
    "label_id" TEXT NOT NULL,

    CONSTRAINT "task_label_assignments_pkey" PRIMARY KEY ("task_id","label_id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "id" TEXT NOT NULL,
    "source_task_id" TEXT NOT NULL,
    "target_task_id" TEXT NOT NULL,
    "type" "TaskDependencyType" NOT NULL DEFAULT 'BLOCKS',
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_checklist_items" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_by_membership_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "task_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "parent_comment_id" TEXT,
    "author_membership_id" TEXT,
    "author_user_id" TEXT,
    "visibility" "TaskCommentVisibility" NOT NULL DEFAULT 'INTERNAL',
    "body" TEXT NOT NULL,
    "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reactions" JSONB,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_attachments" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "added_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_links" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "entity_type" "RecordEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'related',
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_watchers" (
    "task_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_watchers_pkey" PRIMARY KEY ("task_id","membership_id")
);

-- CreateTable
CREATE TABLE "releases" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "team_id" TEXT,
    "project_id" TEXT,
    "milestone_id" TEXT,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "status" "ReleaseStatus" NOT NULL DEFAULT 'PLANNED',
    "target_date" DATE,
    "released_at" TIMESTAMP(3),
    "notes" TEXT,
    "notes_document_id" TEXT,
    "customer_visible" BOOLEAN NOT NULL DEFAULT false,
    "affected_company_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_deployments" (
    "id" TEXT NOT NULL,
    "release_id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "status" "DeploymentStatus" NOT NULL DEFAULT 'PENDING',
    "url" TEXT,
    "deployed_by_user_id" TEXT,
    "deployed_at" TIMESTAMP(3),
    "external_ref" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "release_deployments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_statuses_organization_id_category_idx" ON "task_statuses"("organization_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "task_statuses_organization_id_team_id_slug_key" ON "task_statuses"("organization_id", "team_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "task_types_organization_id_slug_key" ON "task_types"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "task_labels_organization_id_slug_key" ON "task_labels"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "cycles_organization_id_status_idx" ON "cycles"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cycles_organization_id_team_id_number_key" ON "cycles"("organization_id", "team_id", "number");

-- CreateIndex
CREATE INDEX "tasks_organization_id_status_id_idx" ON "tasks"("organization_id", "status_id");

-- CreateIndex
CREATE INDEX "tasks_project_id_status_id_idx" ON "tasks"("project_id", "status_id");

-- CreateIndex
CREATE INDEX "tasks_assignee_membership_id_status_id_idx" ON "tasks"("assignee_membership_id", "status_id");

-- CreateIndex
CREATE INDEX "tasks_team_id_cycle_id_idx" ON "tasks"("team_id", "cycle_id");

-- CreateIndex
CREATE INDEX "tasks_parent_task_id_idx" ON "tasks"("parent_task_id");

-- CreateIndex
CREATE INDEX "tasks_milestone_id_idx" ON "tasks"("milestone_id");

-- CreateIndex
CREATE INDEX "tasks_due_date_idx" ON "tasks"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_organization_id_number_key" ON "tasks"("organization_id", "number");

-- CreateIndex
CREATE INDEX "task_assignees_membership_id_idx" ON "task_assignees"("membership_id");

-- CreateIndex
CREATE INDEX "task_label_assignments_label_id_idx" ON "task_label_assignments"("label_id");

-- CreateIndex
CREATE INDEX "task_dependencies_target_task_id_idx" ON "task_dependencies"("target_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_source_task_id_target_task_id_type_key" ON "task_dependencies"("source_task_id", "target_task_id", "type");

-- CreateIndex
CREATE INDEX "task_checklist_items_task_id_idx" ON "task_checklist_items"("task_id");

-- CreateIndex
CREATE INDEX "task_comments_task_id_created_at_idx" ON "task_comments"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "task_comments_parent_comment_id_idx" ON "task_comments"("parent_comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_attachments_task_id_document_id_key" ON "task_attachments"("task_id", "document_id");

-- CreateIndex
CREATE INDEX "task_links_entity_type_entity_id_idx" ON "task_links"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_links_task_id_entity_type_entity_id_key" ON "task_links"("task_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "task_watchers_membership_id_idx" ON "task_watchers"("membership_id");

-- CreateIndex
CREATE INDEX "releases_organization_id_status_idx" ON "releases"("organization_id", "status");

-- CreateIndex
CREATE INDEX "releases_project_id_idx" ON "releases"("project_id");

-- CreateIndex
CREATE INDEX "release_deployments_release_id_environment_idx" ON "release_deployments"("release_id", "environment");

-- AddForeignKey
ALTER TABLE "contract_obligations" ADD CONSTRAINT "contract_obligations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_issues" ADD CONSTRAINT "project_issues_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_change_requests" ADD CONSTRAINT "project_change_requests_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_checklist_items" ADD CONSTRAINT "project_checklist_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_statuses" ADD CONSTRAINT "task_statuses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_statuses" ADD CONSTRAINT "task_statuses_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_types" ADD CONSTRAINT "task_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_parent_label_id_fkey" FOREIGN KEY ("parent_label_id") REFERENCES "task_labels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workstream_id_fkey" FOREIGN KEY ("workstream_id") REFERENCES "project_workstreams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "task_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "task_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_membership_id_fkey" FOREIGN KEY ("assignee_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_reporter_membership_id_fkey" FOREIGN KEY ("reporter_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurring_template_task_id_fkey" FOREIGN KEY ("recurring_template_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_duplicate_of_task_id_fkey" FOREIGN KEY ("duplicate_of_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_label_assignments" ADD CONSTRAINT "task_label_assignments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_label_assignments" ADD CONSTRAINT "task_label_assignments_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "task_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_source_task_id_fkey" FOREIGN KEY ("source_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_target_task_id_fkey" FOREIGN KEY ("target_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "task_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_membership_id_fkey" FOREIGN KEY ("author_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_links" ADD CONSTRAINT "task_links_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_watchers" ADD CONSTRAINT "task_watchers_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_watchers" ADD CONSTRAINT "task_watchers_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_deployments" ADD CONSTRAINT "release_deployments_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

