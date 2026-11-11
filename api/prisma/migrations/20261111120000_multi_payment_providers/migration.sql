-- 08 Payment Providers: support several payment providers per organization (Stripe, Viva Wallet, PayPal, Mollie, Adyen).
-- Provider ids move from stripe_* columns to generic provider_* columns plus payment_provider_objects.
-- Safety: refuse to drop stripe_* ids that hold data; migrate them to payment_provider_objects / provider_* first.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "billing_profiles" WHERE "stripe_customer_id" IS NOT NULL)
    OR EXISTS (SELECT 1 FROM "products" WHERE "stripe_product_id" IS NOT NULL)
    OR EXISTS (SELECT 1 FROM "prices" WHERE "stripe_price_id" IS NOT NULL)
    OR EXISTS (SELECT 1 FROM "tax_rates" WHERE "stripe_tax_rate_id" IS NOT NULL)
    OR EXISTS (SELECT 1 FROM "coupons" WHERE "stripe_coupon_id" IS NOT NULL)
    OR EXISTS (SELECT 1 FROM "invoices" WHERE "stripe_invoice_id" IS NOT NULL)
    OR EXISTS (SELECT 1 FROM "credit_notes" WHERE "stripe_credit_note_id" IS NOT NULL)
    OR EXISTS (SELECT 1 FROM "subscriptions" WHERE "stripe_subscription_id" IS NOT NULL)
    OR EXISTS (SELECT 1 FROM "subscription_items" WHERE "stripe_item_id" IS NOT NULL) THEN
    RAISE EXCEPTION 'stripe_* columns contain data: migrate it to payment_provider_objects / provider_* before applying this migration';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "PaymentProviderConnectionStatus" AS ENUM ('PENDING', 'ACTIVE', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "ProviderObjectType" AS ENUM ('CUSTOMER', 'PRODUCT', 'PRICE', 'TAX_RATE', 'COUPON');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentProvider" ADD VALUE 'VIVA_WALLET';
ALTER TYPE "PaymentProvider" ADD VALUE 'PAYPAL';
ALTER TYPE "PaymentProvider" ADD VALUE 'MOLLIE';
ALTER TYPE "PaymentProvider" ADD VALUE 'ADYEN';

-- DropIndex
DROP INDEX "billing_profiles_stripe_customer_id_key";

-- DropIndex
DROP INDEX "payment_methods_provider_provider_method_id_key";

-- DropIndex
DROP INDEX "products_stripe_product_id_key";

-- DropIndex
DROP INDEX "prices_stripe_price_id_key";

-- DropIndex
DROP INDEX "tax_rates_stripe_tax_rate_id_key";

-- DropIndex
DROP INDEX "coupons_stripe_coupon_id_key";

-- DropIndex
DROP INDEX "invoices_stripe_invoice_id_key";

-- DropIndex
DROP INDEX "payments_provider_provider_payment_id_key";

-- DropIndex
DROP INDEX "refunds_provider_refund_id_key";

-- DropIndex
DROP INDEX "credit_notes_stripe_credit_note_id_key";

-- DropIndex
DROP INDEX "subscriptions_stripe_subscription_id_key";

-- DropIndex
DROP INDEX "subscription_items_stripe_item_id_key";

-- DropIndex
DROP INDEX "payment_provider_connections_provider_provider_account_id_key";

-- AlterTable
ALTER TABLE "billing_profiles" DROP COLUMN "stripe_customer_id",
ADD COLUMN     "preferred_provider_connection_id" TEXT;

-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN     "provider_connection_id" TEXT,
ALTER COLUMN "provider" DROP DEFAULT;

-- AlterTable
ALTER TABLE "products" DROP COLUMN "stripe_product_id";

-- AlterTable
ALTER TABLE "prices" DROP COLUMN "stripe_price_id";

-- AlterTable
ALTER TABLE "tax_rates" DROP COLUMN "stripe_tax_rate_id";

-- AlterTable
ALTER TABLE "coupons" DROP COLUMN "stripe_coupon_id";

-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "stripe_invoice_id",
ADD COLUMN     "provider_connection_id" TEXT,
ADD COLUMN     "provider_invoice_id" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "provider_checkout_id" TEXT,
ADD COLUMN     "provider_connection_id" TEXT,
ALTER COLUMN "provider" DROP DEFAULT;

-- AlterTable
ALTER TABLE "credit_notes" DROP COLUMN "stripe_credit_note_id",
ADD COLUMN     "provider_connection_id" TEXT,
ADD COLUMN     "provider_credit_note_id" TEXT;

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "stripe_subscription_id",
ADD COLUMN     "provider_connection_id" TEXT,
ADD COLUMN     "provider_subscription_id" TEXT;

-- AlterTable
ALTER TABLE "subscription_items" DROP COLUMN "stripe_item_id",
ADD COLUMN     "provider_item_id" TEXT;

-- AlterTable
ALTER TABLE "payment_provider_connections" ADD COLUMN     "branch_id" TEXT,
ADD COLUMN     "capabilities" JSONB,
ADD COLUMN     "currencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "display_name" TEXT,
ADD COLUMN     "ledger_payment_method_id" TEXT,
ADD COLUMN     "method_types" "PaymentMethodType"[] DEFAULT ARRAY[]::"PaymentMethodType"[],
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "status" "PaymentProviderConnectionStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "provider" DROP DEFAULT,
ALTER COLUMN "is_default" SET DEFAULT false;

-- Backfill display_name for existing connections, then require it
UPDATE "payment_provider_connections" SET "display_name" = "provider"::text WHERE "display_name" IS NULL;
ALTER TABLE "payment_provider_connections" ALTER COLUMN "display_name" SET NOT NULL;

-- AlterTable
ALTER TABLE "provider_webhook_events" ADD COLUMN     "provider_connection_id" TEXT;

-- CreateTable
CREATE TABLE "payment_provider_objects" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider_connection_id" TEXT NOT NULL,
    "object_type" "ProviderObjectType" NOT NULL,
    "local_id" TEXT NOT NULL,
    "provider_object_id" TEXT NOT NULL,
    "last_synced_at" TIMESTAMP(3),
    "last_error" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_provider_objects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_provider_objects_organization_id_object_type_local__idx" ON "payment_provider_objects"("organization_id", "object_type", "local_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_provider_objects_connection_local_key" ON "payment_provider_objects"("provider_connection_id", "object_type", "local_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_provider_objects_connection_remote_key" ON "payment_provider_objects"("provider_connection_id", "object_type", "provider_object_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_provider_connection_id_provider_method_id_key" ON "payment_methods"("provider_connection_id", "provider_method_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_provider_connection_id_provider_invoice_id_key" ON "invoices"("provider_connection_id", "provider_invoice_id");

-- CreateIndex
CREATE INDEX "payments_provider_connection_id_provider_checkout_id_idx" ON "payments"("provider_connection_id", "provider_checkout_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_connection_id_provider_payment_id_key" ON "payments"("provider_connection_id", "provider_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_payment_id_provider_refund_id_key" ON "refunds"("payment_id", "provider_refund_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_provider_connection_id_provider_credit_note_id_key" ON "credit_notes"("provider_connection_id", "provider_credit_note_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_provider_connection_id_provider_subscription__key" ON "subscriptions"("provider_connection_id", "provider_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_items_subscription_id_provider_item_id_key" ON "subscription_items"("subscription_id", "provider_item_id");

-- CreateIndex
CREATE INDEX "payment_provider_connections_organization_id_status_idx" ON "payment_provider_connections"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_provider_connections_provider_provider_account_id_m_key" ON "payment_provider_connections"("provider", "provider_account_id", "mode");

-- AddForeignKey
ALTER TABLE "billing_profiles" ADD CONSTRAINT "billing_profiles_preferred_provider_connection_id_fkey" FOREIGN KEY ("preferred_provider_connection_id") REFERENCES "payment_provider_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_provider_connection_id_fkey" FOREIGN KEY ("provider_connection_id") REFERENCES "payment_provider_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_provider_connection_id_fkey" FOREIGN KEY ("provider_connection_id") REFERENCES "payment_provider_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_provider_connection_id_fkey" FOREIGN KEY ("provider_connection_id") REFERENCES "payment_provider_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_provider_connection_id_fkey" FOREIGN KEY ("provider_connection_id") REFERENCES "payment_provider_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_provider_connection_id_fkey" FOREIGN KEY ("provider_connection_id") REFERENCES "payment_provider_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_provider_connections" ADD CONSTRAINT "payment_provider_connections_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_provider_connections" ADD CONSTRAINT "payment_provider_connections_ledger_payment_method_id_fkey" FOREIGN KEY ("ledger_payment_method_id") REFERENCES "ledger_payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_provider_objects" ADD CONSTRAINT "payment_provider_objects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_provider_objects" ADD CONSTRAINT "payment_provider_objects_provider_connection_id_fkey" FOREIGN KEY ("provider_connection_id") REFERENCES "payment_provider_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_webhook_events" ADD CONSTRAINT "provider_webhook_events_provider_connection_id_fkey" FOREIGN KEY ("provider_connection_id") REFERENCES "payment_provider_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

