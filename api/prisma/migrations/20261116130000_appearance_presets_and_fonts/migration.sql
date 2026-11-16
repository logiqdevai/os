-- Appearance: dev-station theme presets + font settings. Development stage: stored appearances are reset.
DELETE FROM "user_appearances";

ALTER TABLE "user_appearances" ALTER COLUMN "theme" DROP DEFAULT;
ALTER TYPE "AppTheme" RENAME TO "AppTheme_old";
CREATE TYPE "AppTheme" AS ENUM ('DEFAULT', 'CYAN', 'AUBERGINE', 'OCEAN', 'FOREST', 'SUNSET', 'MONOCHROME', 'SOLARIZED', 'NORD', 'DRACULA');
ALTER TABLE "user_appearances" ALTER COLUMN "theme" TYPE "AppTheme" USING ("theme"::text::"AppTheme");
ALTER TABLE "user_appearances" ALTER COLUMN "theme" SET DEFAULT 'DEFAULT';
DROP TYPE "AppTheme_old";

ALTER TABLE "user_appearances"
    ADD COLUMN "font_family" TEXT NOT NULL DEFAULT 'inter',
    ADD COLUMN "mono_font_family" TEXT NOT NULL DEFAULT 'jetbrains-mono',
    ADD COLUMN "font_size" INTEGER NOT NULL DEFAULT 14;
