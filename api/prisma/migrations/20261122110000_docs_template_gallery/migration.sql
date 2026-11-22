-- CreateEnum
CREATE TYPE "WikiTemplateCategory" AS ENUM ('COMPANY', 'PROJECTS', 'MEETINGS', 'ENGINEERING', 'PRODUCT', 'OPERATIONS', 'PEOPLE', 'SALES', 'MARKETING', 'PERSONAL', 'OTHER');

-- AlterTable
ALTER TABLE "wiki_page_templates" ADD COLUMN "category" "WikiTemplateCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "wiki_page_templates_organization_id_category_idx" ON "wiki_page_templates"("organization_id", "category");
