-- 14: Web Push VAPID key pair of the deployment (generated on first use, private key encrypted with the secret box).
CREATE TABLE "platform_web_push_keys" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "public_key" TEXT NOT NULL,
    "private_key_ciphertext" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_web_push_keys_pkey" PRIMARY KEY ("id")
);

-- 14: read / archived notifications are purged after 365 days unless the organization sets another period (null = keep).
ALTER TABLE "notification_org_settings" ALTER COLUMN "retention_days" SET DEFAULT 365;
