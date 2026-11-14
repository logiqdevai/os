-- Huddles and calls are on by default; the provider defaults to the in-app one.
UPDATE "messaging_settings" SET "calls_enabled" = true;
UPDATE "messaging_settings" SET "call_provider" = 'internal' WHERE "call_provider" IS NULL OR "call_provider" NOT IN ('internal', 'google_meet', 'zoom', 'teams', 'custom');
ALTER TABLE "messaging_settings" ALTER COLUMN "calls_enabled" SET DEFAULT true;
ALTER TABLE "messaging_settings" ALTER COLUMN "call_provider" SET NOT NULL;
ALTER TABLE "messaging_settings" ALTER COLUMN "call_provider" SET DEFAULT 'internal';
