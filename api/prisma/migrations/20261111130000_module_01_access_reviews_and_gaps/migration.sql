-- 01 Users & permissions: close the gaps found while mocking the Admin UI (additive, no data migration needed).
-- Access reviews (01 §98), role versions (01 §109), password_changed_at, multi-branch session context (01 §27),
-- login/invitation policy, API key scope + rotation, audit branch scope, branch headquarters, team lead, SCIM sync time.

-- CreateEnum
CREATE TYPE "InvitationPolicy" AS ENUM ('PERMISSION_HOLDERS', 'ADMINS_ONLY');

-- CreateEnum
CREATE TYPE "InvitationAudience" AS ENUM ('MEMBER', 'CUSTOMER_PORTAL');

-- CreateEnum
CREATE TYPE "AccessReviewStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccessReviewDecision" AS ENUM ('PENDING', 'CERTIFIED', 'REVOKED', 'MODIFIED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_changed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user_sessions" ADD COLUMN     "active_branch_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "organization_security_policies" ADD COLUMN     "allowed_countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "invitation_policy" "InvitationPolicy" NOT NULL DEFAULT 'PERMISSION_HOLDERS',
ADD COLUMN     "members_can_view_sessions" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "is_headquarters" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "team_memberships" ADD COLUMN     "is_lead" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "restrictions" JSONB,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "audience" "InvitationAudience" NOT NULL DEFAULT 'MEMBER';

-- AlterTable
ALTER TABLE "sso_configurations" ADD COLUMN     "scim_last_synced_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN     "rotation_due_at" TIMESTAMP(3),
ADD COLUMN     "scope_id" TEXT,
ADD COLUMN     "scope_type" "ScopeType" NOT NULL DEFAULT 'ORGANIZATION';

-- AlterTable
ALTER TABLE "audit_events" ADD COLUMN     "branch_id" TEXT;

-- CreateTable
CREATE TABLE "access_reviews" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AccessReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "scope_type" "ScopeType" NOT NULL DEFAULT 'ORGANIZATION',
    "scope_id" TEXT,
    "modules" "ModuleKey"[] DEFAULT ARRAY[]::"ModuleKey"[],
    "starts_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_review_items" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "reviewer_membership_id" TEXT,
    "decision" "AccessReviewDecision" NOT NULL DEFAULT 'PENDING',
    "decided_at" TIMESTAMP(3),
    "comment" TEXT,
    "access_snapshot" JSONB NOT NULL,
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_review_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_versions" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "default_scope" "ScopeType" NOT NULL,
    "modules" "ModuleKey"[] DEFAULT ARRAY[]::"ModuleKey"[],
    "permissions" JSONB NOT NULL,
    "restrictions" JSONB,
    "note" TEXT,
    "published_by_membership_id" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "access_reviews_organization_id_status_idx" ON "access_reviews"("organization_id", "status");

-- CreateIndex
CREATE INDEX "access_reviews_organization_id_due_at_idx" ON "access_reviews"("organization_id", "due_at");

-- CreateIndex
CREATE INDEX "access_review_items_reviewer_membership_id_decision_idx" ON "access_review_items"("reviewer_membership_id", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "access_review_items_review_id_membership_id_key" ON "access_review_items"("review_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_versions_role_id_version_key" ON "role_versions"("role_id", "version");

-- CreateIndex
CREATE INDEX "audit_events_organization_id_branch_id_created_at_idx" ON "audit_events"("organization_id", "branch_id", "created_at");

-- AddForeignKey
ALTER TABLE "access_reviews" ADD CONSTRAINT "access_reviews_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_reviews" ADD CONSTRAINT "access_reviews_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_review_items" ADD CONSTRAINT "access_review_items_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "access_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_review_items" ADD CONSTRAINT "access_review_items_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_review_items" ADD CONSTRAINT "access_review_items_reviewer_membership_id_fkey" FOREIGN KEY ("reviewer_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_versions" ADD CONSTRAINT "role_versions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_versions" ADD CONSTRAINT "role_versions_published_by_membership_id_fkey" FOREIGN KEY ("published_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
