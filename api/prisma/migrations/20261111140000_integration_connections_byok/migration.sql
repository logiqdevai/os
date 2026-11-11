-- 01 Integrations (bring your own keys): organizations connect OpenAI, Resend, Twilio, Stripe and Viva Wallet with THEIR credentials,
-- stored envelope-encrypted in integration_connections (01 sections 156-161) instead of the platform .env.
-- Payment provider connections (08) and communication provider accounts (11) now point at an integration connection;
-- their ad-hoc credential columns are dropped.
-- Safety: refuse to drop credential columns that hold data. Move the secrets into integration_connections first
-- (create an IntegrationConnection per row, then set integration_connection_id), then clear the old columns.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "payment_provider_connections" WHERE "credentials_ref" IS NOT NULL)
    OR EXISTS (SELECT 1 FROM "comm_provider_accounts" WHERE "credentials" IS NOT NULL OR "webhook_secret" IS NOT NULL) THEN
    RAISE EXCEPTION 'credential columns contain data: migrate them into integration_connections before applying this migration';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('OPENAI', 'RESEND', 'TWILIO', 'STRIPE', 'VIVA_WALLET');

-- CreateEnum
CREATE TYPE "IntegrationCategory" AS ENUM ('AI', 'EMAIL', 'SMS', 'PAYMENTS');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('PENDING', 'ACTIVE', 'ERROR', 'DISABLED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "IntegrationMode" AS ENUM ('LIVE', 'TEST');

-- CreateEnum
CREATE TYPE "IntegrationCredentialSource" AS ENUM ('ORGANIZATION', 'PLATFORM');

-- AlterTable
ALTER TABLE "payment_provider_connections" DROP COLUMN "credentials_ref",
ADD COLUMN     "integration_connection_id" TEXT;

-- AlterTable
ALTER TABLE "comm_provider_accounts" DROP COLUMN "credentials",
DROP COLUMN "webhook_secret",
ADD COLUMN     "integration_connection_id" TEXT;

-- CreateTable
CREATE TABLE "integration_connections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "category" "IntegrationCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "mode" "IntegrationMode" NOT NULL DEFAULT 'LIVE',
    "credential_source" "IntegrationCredentialSource" NOT NULL DEFAULT 'ORGANIZATION',
    "secret_ciphertext" TEXT,
    "vault_key_id" TEXT,
    "secret_hints" JSONB,
    "config" JSONB,
    "capabilities" JSONB,
    "usage_limits" JSONB,
    "webhook_token" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "branch_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "rotated_at" TIMESTAMP(3),
    "last_verified_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "last_error" TEXT,
    "last_error_at" TIMESTAMP(3),
    "created_by_membership_id" TEXT,
    "connected_at" TIMESTAMP(3),
    "disconnected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_usage_daily" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "integration_connection_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "units" BIGINT NOT NULL DEFAULT 0,
    "cost_micros" BIGINT,
    "cost_currency" TEXT,
    "breakdown" JSONB,

    CONSTRAINT "integration_usage_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_connections_webhook_token_key" ON "integration_connections"("webhook_token");

-- CreateIndex
CREATE INDEX "integration_connections_organization_id_category_status_idx" ON "integration_connections"("organization_id", "category", "status");

-- CreateIndex
CREATE INDEX "integration_connections_organization_id_provider_idx" ON "integration_connections"("organization_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "integration_connections_organization_id_name_key" ON "integration_connections"("organization_id", "name");

-- CreateIndex
CREATE INDEX "integration_usage_daily_organization_id_date_idx" ON "integration_usage_daily"("organization_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "integration_usage_daily_integration_connection_id_date_key" ON "integration_usage_daily"("integration_connection_id", "date");

-- CreateIndex
CREATE INDEX "payment_provider_connections_integration_connection_id_idx" ON "payment_provider_connections"("integration_connection_id");

-- CreateIndex
CREATE INDEX "comm_provider_accounts_integration_connection_id_idx" ON "comm_provider_accounts"("integration_connection_id");

-- AddForeignKey
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_vault_key_id_fkey" FOREIGN KEY ("vault_key_id") REFERENCES "vault_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_usage_daily" ADD CONSTRAINT "integration_usage_daily_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_usage_daily" ADD CONSTRAINT "integration_usage_daily_integration_connection_id_fkey" FOREIGN KEY ("integration_connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_provider_connections" ADD CONSTRAINT "payment_provider_connections_integration_connection_id_fkey" FOREIGN KEY ("integration_connection_id") REFERENCES "integration_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_provider_accounts" ADD CONSTRAINT "comm_provider_accounts_integration_connection_id_fkey" FOREIGN KEY ("integration_connection_id") REFERENCES "integration_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
