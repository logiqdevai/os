-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AuthRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "AuthMethodType" AS ENUM ('PASSWORD', 'MAGIC_LINK', 'PASSKEY', 'OAUTH', 'SSO', 'TOTP', 'SMS_OTP', 'EMAIL_OTP', 'RECOVERY_CODES');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('SETUP', 'ACTIVE', 'SUSPENDED', 'READ_ONLY', 'ARCHIVED', 'PENDING_DELETION', 'DELETED');

-- CreateEnum
CREATE TYPE "BranchStatus" AS ENUM ('ACTIVE', 'PLANNED', 'TEMPORARILY_CLOSED', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BranchKind" AS ENUM ('OPERATIONAL', 'OFFICE', 'REGIONAL_UNIT', 'SUBSIDIARY_REFERENCE', 'SERVICE_CENTER', 'REMOTE');

-- CreateEnum
CREATE TYPE "MembershipType" AS ENUM ('INTERNAL', 'EXTERNAL_COLLABORATOR', 'GUEST');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "TeamKind" AS ENUM ('TEAM', 'DEPARTMENT', 'BUSINESS_UNIT', 'PROJECT_TEAM');

-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('SYSTEM', 'ORGANIZATION', 'BRANCH', 'TEAM', 'PROJECT', 'CUSTOMER_PORTAL');

-- CreateEnum
CREATE TYPE "RoleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('ORGANIZATION', 'BRANCH', 'BRANCH_HIERARCHY', 'TEAM', 'PROJECT', 'RESOURCE', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "ModuleKey" AS ENUM ('CRM', 'PROPOSALS', 'CONTRACTS', 'PROJECTS', 'TASKS', 'CUSTOMER_PORTAL', 'FINANCE', 'INCOME_EXPENSE', 'EMPLOYEES', 'COMMUNICATION', 'MESSAGING', 'SUPPORT', 'NOTIFICATIONS', 'BUSINESS_DOCS', 'DOCUMENTS', 'TIME_TRACKING', 'CALENDAR', 'AUTOMATION', 'ADMINISTRATION');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProvisioningSource" AS ENUM ('MANUAL', 'INVITATION_LINK', 'BULK_IMPORT', 'SSO', 'SCIM', 'API');

-- CreateEnum
CREATE TYPE "SsoProtocol" AS ENUM ('SAML', 'OIDC');

-- CreateEnum
CREATE TYPE "DomainVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'REVOKED');

-- CreateEnum
CREATE TYPE "MfaPolicy" AS ENUM ('OPTIONAL', 'REQUIRED_FOR_ADMINS', 'REQUIRED_FOR_ALL', 'REQUIRED_FOR_SENSITIVE_MODULES');

-- CreateEnum
CREATE TYPE "ServiceAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "DelegationStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SERVICE_ACCOUNT', 'SYSTEM', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('LOGO', 'BANNER', 'IMAGE', 'VIDEO', 'AUDIO', 'PDF', 'DOCUMENT', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "role" "AuthRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "first_name" TEXT,
    "last_name" TEXT,
    "display_name" TEXT,
    "profile_photo_url" TEXT,
    "locale" TEXT,
    "timezone" TEXT,
    "language" TEXT,
    "email_verified_at" TIMESTAMP(3),
    "phone_verified_at" TIMESTAMP(3),
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "default_organization_id" TEXT,
    "deactivated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_uuid" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_auth_methods" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "AuthMethodType" NOT NULL,
    "identifier" TEXT,
    "secret_hash" TEXT,
    "label" TEXT,
    "metadata" JSONB,
    "verified_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "disabled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_auth_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "active_organization_id" TEXT,
    "active_branch_id" TEXT,
    "token_hash" TEXT NOT NULL,
    "device" TEXT,
    "browser" TEXT,
    "ip_address" TEXT,
    "location_approx" TEXT,
    "user_agent" TEXT,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "user_id" TEXT NOT NULL,
    "theme" TEXT,
    "default_organization_id" TEXT,
    "default_branch_id" TEXT,
    "default_team_id" TEXT,
    "notification_preferences" JSONB,
    "dashboard_layout" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "short_name" TEXT,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "website" TEXT,
    "country" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "address" JSONB,
    "tax_identifiers" JSONB,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'SETUP',
    "default_currency" TEXT NOT NULL DEFAULT 'EUR',
    "default_timezone" TEXT NOT NULL DEFAULT 'Europe/Athens',
    "default_language" TEXT NOT NULL DEFAULT 'en',
    "default_locale" TEXT,
    "date_format" TEXT,
    "number_format" TEXT,
    "week_start" INTEGER NOT NULL DEFAULT 1,
    "working_days" JSONB,
    "business_hours" JSONB,
    "branding" JSONB,
    "settings" JSONB,
    "deletion_requested_at" TIMESTAMP(3),
    "deletion_scheduled_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_security_policies" (
    "organization_id" TEXT NOT NULL,
    "password_min_length" INTEGER NOT NULL DEFAULT 10,
    "password_require_symbols" BOOLEAN NOT NULL DEFAULT false,
    "password_max_age_days" INTEGER,
    "mfa_policy" "MfaPolicy" NOT NULL DEFAULT 'OPTIONAL',
    "sso_required" BOOLEAN NOT NULL DEFAULT false,
    "session_duration_minutes" INTEGER NOT NULL DEFAULT 43200,
    "idle_timeout_minutes" INTEGER,
    "allowed_email_domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "restrict_invitations_to_domains" BOOLEAN NOT NULL DEFAULT false,
    "allowed_ip_ranges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "portal_mfa_policy" "MfaPolicy" NOT NULL DEFAULT 'OPTIONAL',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_security_policies_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "organization_domains" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" "DomainVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verification_token" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "allow_discovery" BOOLEAN NOT NULL DEFAULT false,
    "auto_provision" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_modules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "module" "ModuleKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "enabled_at" TIMESTAMP(3),
    "disabled_at" TIMESTAMP(3),
    "settings" JSONB,

    CONSTRAINT "organization_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "parent_branch_id" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "kind" "BranchKind" NOT NULL DEFAULT 'OPERATIONAL',
    "status" "BranchStatus" NOT NULL DEFAULT 'ACTIVE',
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "address" JSONB,
    "phone" TEXT,
    "email" TEXT,
    "path" TEXT NOT NULL DEFAULT '',
    "depth" INTEGER NOT NULL DEFAULT 0,
    "cost_center_code" TEXT,
    "currency" TEXT,
    "timezone" TEXT,
    "locale" TEXT,
    "language" TEXT,
    "date_format" TEXT,
    "week_start" INTEGER,
    "working_days" JSONB,
    "business_hours" JSONB,
    "branding" JSONB,
    "custom_fields" JSONB,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_managers" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_holidays" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "parent_team_id" TEXT,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "kind" "TeamKind" NOT NULL DEFAULT 'TEAM',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_memberships" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "team_role" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "MembershipType" NOT NULL DEFAULT 'INTERNAL',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "provisioning_source" "ProvisioningSource" NOT NULL DEFAULT 'MANUAL',
    "external_id" TEXT,
    "invited_by_user_id" TEXT,
    "default_branch_id" TEXT,
    "default_team_id" TEXT,
    "job_title" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3),
    "suspended_at" TIMESTAMP(3),
    "deactivated_at" TIMESTAMP(3),
    "offboarding" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_branches" (
    "id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "include_children" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "membership_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_module_access" (
    "id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "module" "ModuleKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "granted_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_module_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "module" "ModuleKey" NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "is_field_level" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" "RoleType" NOT NULL DEFAULT 'ORGANIZATION',
    "status" "RoleStatus" NOT NULL DEFAULT 'PUBLISHED',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "template_role_id" TEXT,
    "default_scope" "ScopeType" NOT NULL DEFAULT 'ORGANIZATION',
    "modules" "ModuleKey"[] DEFAULT ARRAY[]::"ModuleKey"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "effect" "PermissionEffect" NOT NULL DEFAULT 'ALLOW',
    "conditions" JSONB,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "role_assignments" (
    "id" TEXT NOT NULL,
    "membership_id" TEXT,
    "service_account_id" TEXT,
    "role_id" TEXT NOT NULL,
    "scope_type" "ScopeType" NOT NULL DEFAULT 'ORGANIZATION',
    "scope_id" TEXT,
    "granted_by_user_id" TEXT,
    "reason" TEXT,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_grants" (
    "id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "effect" "PermissionEffect" NOT NULL DEFAULT 'ALLOW',
    "scope_type" "ScopeType" NOT NULL DEFAULT 'ORGANIZATION',
    "scope_id" TEXT,
    "granted_by_user_id" TEXT,
    "reason" TEXT,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "delegator_membership_id" TEXT NOT NULL,
    "delegate_membership_id" TEXT NOT NULL,
    "permission_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "role_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scope_type" "ScopeType" NOT NULL DEFAULT 'ORGANIZATION',
    "scope_id" TEXT,
    "status" "DelegationStatus" NOT NULL DEFAULT 'SCHEDULED',
    "reason" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "type" "MembershipType" NOT NULL DEFAULT 'INTERNAL',
    "branch_id" TEXT,
    "team_id" TEXT,
    "role_id" TEXT,
    "modules" "ModuleKey"[] DEFAULT ARRAY[]::"ModuleKey"[],
    "token_hash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "source" "ProvisioningSource" NOT NULL DEFAULT 'MANUAL',
    "message" TEXT,
    "invited_by_user_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "membership_id" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sso_configurations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "protocol" "SsoProtocol" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL,
    "auto_provision" BOOLEAN NOT NULL DEFAULT false,
    "scim_enabled" BOOLEAN NOT NULL DEFAULT false,
    "scim_token_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sso_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sso_group_mappings" (
    "id" TEXT NOT NULL,
    "sso_configuration_id" TEXT NOT NULL,
    "external_group" TEXT NOT NULL,
    "role_id" TEXT,
    "team_id" TEXT,
    "branch_id" TEXT,
    "modules" "ModuleKey"[] DEFAULT ARRAY[]::"ModuleKey"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sso_group_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "owner_membership_id" TEXT,
    "name" TEXT NOT NULL,
    "purpose" TEXT,
    "status" "ServiceAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "membership_id" TEXT,
    "service_account_id" TEXT,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "rotated_from_id" TEXT,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_portal_memberships" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "invited_by_user_id" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3),
    "deactivated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_portal_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "actor_type" "AuditActorType" NOT NULL DEFAULT 'USER',
    "actor_user_id" TEXT,
    "actor_service_account_id" TEXT,
    "event_type" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "user_uuid" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL DEFAULT 'LOGO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_uuid_idx" ON "password_reset_tokens"("user_uuid");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "user_auth_methods_user_id_idx" ON "user_auth_methods"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_auth_methods_user_id_type_identifier_key" ON "user_auth_methods"("user_id", "type", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_hash_key" ON "user_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_status_idx" ON "organizations"("status");

-- CreateIndex
CREATE INDEX "organization_domains_organization_id_idx" ON "organization_domains"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_domains_domain_key" ON "organization_domains"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "organization_modules_organization_id_module_key" ON "organization_modules"("organization_id", "module");

-- CreateIndex
CREATE INDEX "branches_organization_id_idx" ON "branches"("organization_id");

-- CreateIndex
CREATE INDEX "branches_parent_branch_id_idx" ON "branches"("parent_branch_id");

-- CreateIndex
CREATE INDEX "branches_organization_id_status_idx" ON "branches"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "branches_organization_id_code_key" ON "branches"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "branch_managers_branch_id_membership_id_key" ON "branch_managers"("branch_id", "membership_id");

-- CreateIndex
CREATE INDEX "branch_holidays_branch_id_date_idx" ON "branch_holidays"("branch_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "branch_holidays_branch_id_date_name_key" ON "branch_holidays"("branch_id", "date", "name");

-- CreateIndex
CREATE INDEX "teams_organization_id_idx" ON "teams"("organization_id");

-- CreateIndex
CREATE INDEX "teams_parent_team_id_idx" ON "teams"("parent_team_id");

-- CreateIndex
CREATE INDEX "teams_branch_id_idx" ON "teams"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_organization_id_slug_key" ON "teams"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "team_memberships_membership_id_idx" ON "team_memberships"("membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_memberships_team_id_membership_id_key" ON "team_memberships"("team_id", "membership_id");

-- CreateIndex
CREATE INDEX "memberships_organization_id_status_idx" ON "memberships"("organization_id", "status");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_organization_id_key" ON "memberships"("user_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_organization_id_external_id_key" ON "memberships"("organization_id", "external_id");

-- CreateIndex
CREATE INDEX "membership_branches_branch_id_idx" ON "membership_branches"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_branches_membership_id_branch_id_key" ON "membership_branches"("membership_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_module_access_membership_id_module_key" ON "membership_module_access"("membership_id", "module");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE INDEX "roles_organization_id_type_idx" ON "roles"("organization_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organization_id_slug_key" ON "roles"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "role_assignments_membership_id_idx" ON "role_assignments"("membership_id");

-- CreateIndex
CREATE INDEX "role_assignments_service_account_id_idx" ON "role_assignments"("service_account_id");

-- CreateIndex
CREATE INDEX "role_assignments_role_id_idx" ON "role_assignments"("role_id");

-- CreateIndex
CREATE INDEX "role_assignments_scope_type_scope_id_idx" ON "role_assignments"("scope_type", "scope_id");

-- CreateIndex
CREATE INDEX "permission_grants_membership_id_idx" ON "permission_grants"("membership_id");

-- CreateIndex
CREATE INDEX "permission_grants_permission_id_idx" ON "permission_grants"("permission_id");

-- CreateIndex
CREATE INDEX "permission_grants_scope_type_scope_id_idx" ON "permission_grants"("scope_type", "scope_id");

-- CreateIndex
CREATE INDEX "delegations_organization_id_status_idx" ON "delegations"("organization_id", "status");

-- CreateIndex
CREATE INDEX "delegations_delegate_membership_id_idx" ON "delegations"("delegate_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_organization_id_status_idx" ON "invitations"("organization_id", "status");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE INDEX "invitations_expires_at_idx" ON "invitations"("expires_at");

-- CreateIndex
CREATE INDEX "sso_configurations_organization_id_idx" ON "sso_configurations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "sso_group_mappings_sso_configuration_id_external_group_key" ON "sso_group_mappings"("sso_configuration_id", "external_group");

-- CreateIndex
CREATE INDEX "service_accounts_organization_id_status_idx" ON "service_accounts"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "service_accounts_organization_id_name_key" ON "service_accounts"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_organization_id_idx" ON "api_keys"("organization_id");

-- CreateIndex
CREATE INDEX "api_keys_membership_id_idx" ON "api_keys"("membership_id");

-- CreateIndex
CREATE INDEX "api_keys_service_account_id_idx" ON "api_keys"("service_account_id");

-- CreateIndex
CREATE INDEX "customer_portal_memberships_customer_id_idx" ON "customer_portal_memberships"("customer_id");

-- CreateIndex
CREATE INDEX "customer_portal_memberships_user_id_idx" ON "customer_portal_memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_portal_memberships_organization_id_customer_id_use_key" ON "customer_portal_memberships"("organization_id", "customer_id", "user_id");

-- CreateIndex
CREATE INDEX "audit_events_organization_id_created_at_idx" ON "audit_events"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_actor_user_id_created_at_idx" ON "audit_events"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_event_type_idx" ON "audit_events"("event_type");

-- CreateIndex
CREATE INDEX "audit_events_resource_type_resource_id_idx" ON "audit_events"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "documents_user_uuid_idx" ON "documents"("user_uuid");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_auth_methods" ADD CONSTRAINT "user_auth_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_security_policies" ADD CONSTRAINT "organization_security_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_domains" ADD CONSTRAINT "organization_domains_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_modules" ADD CONSTRAINT "organization_modules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_parent_branch_id_fkey" FOREIGN KEY ("parent_branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_managers" ADD CONSTRAINT "branch_managers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_managers" ADD CONSTRAINT "branch_managers_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_holidays" ADD CONSTRAINT "branch_holidays_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_parent_team_id_fkey" FOREIGN KEY ("parent_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_branches" ADD CONSTRAINT "membership_branches_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_branches" ADD CONSTRAINT "membership_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_module_access" ADD CONSTRAINT "membership_module_access_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_service_account_id_fkey" FOREIGN KEY ("service_account_id") REFERENCES "service_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_grants" ADD CONSTRAINT "permission_grants_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_grants" ADD CONSTRAINT "permission_grants_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_delegator_membership_id_fkey" FOREIGN KEY ("delegator_membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_delegate_membership_id_fkey" FOREIGN KEY ("delegate_membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sso_configurations" ADD CONSTRAINT "sso_configurations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sso_group_mappings" ADD CONSTRAINT "sso_group_mappings_sso_configuration_id_fkey" FOREIGN KEY ("sso_configuration_id") REFERENCES "sso_configurations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sso_group_mappings" ADD CONSTRAINT "sso_group_mappings_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sso_group_mappings" ADD CONSTRAINT "sso_group_mappings_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sso_group_mappings" ADD CONSTRAINT "sso_group_mappings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_accounts" ADD CONSTRAINT "service_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_accounts" ADD CONSTRAINT "service_accounts_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_service_account_id_fkey" FOREIGN KEY ("service_account_id") REFERENCES "service_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_portal_memberships" ADD CONSTRAINT "customer_portal_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_portal_memberships" ADD CONSTRAINT "customer_portal_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_portal_memberships" ADD CONSTRAINT "customer_portal_memberships_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

