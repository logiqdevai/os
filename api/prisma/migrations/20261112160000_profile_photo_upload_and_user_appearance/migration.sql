-- Profile photo: uploaded file instead of a pasted URL (01 §127).
ALTER TABLE "users" ADD COLUMN "profile_photo_key" TEXT;
UPDATE "users" SET "profile_photo_url" = NULL;

-- Theme moves from a global user preference to a per-organization appearance.
ALTER TABLE "user_preferences" DROP COLUMN "theme";

CREATE TYPE "AppColorMode" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');
CREATE TYPE "AppTheme" AS ENUM ('DEFAULT', 'CYAN', 'OCEAN', 'INDIGO', 'AUBERGINE', 'ROSE', 'CRIMSON', 'SUNSET', 'HONEY', 'FOREST', 'SLATE', 'MOCHA');

CREATE TABLE "user_appearances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "color_mode" "AppColorMode" NOT NULL DEFAULT 'SYSTEM',
    "theme" "AppTheme" NOT NULL DEFAULT 'DEFAULT',
    "primary_color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_appearances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_appearances_user_id_organization_id_key" ON "user_appearances"("user_id", "organization_id");
CREATE INDEX "user_appearances_organization_id_idx" ON "user_appearances"("organization_id");

ALTER TABLE "user_appearances" ADD CONSTRAINT "user_appearances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_appearances" ADD CONSTRAINT "user_appearances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
