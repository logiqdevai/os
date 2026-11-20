-- DropForeignKey
ALTER TABLE "wiki_page_review_requests" DROP CONSTRAINT "wiki_page_review_requests_page_id_fkey";

-- DropForeignKey
ALTER TABLE "wiki_page_review_requests" DROP CONSTRAINT "wiki_page_review_requests_reviewer_membership_id_fkey";

-- DropIndex
DROP INDEX "wiki_pages_organization_id_status_idx";

-- AlterTable
ALTER TABLE "wiki_spaces" DROP COLUMN "members_can_publish",
DROP COLUMN "require_review_before_publish";

-- AlterTable
ALTER TABLE "wiki_page_templates" DROP COLUMN "content";

-- AlterTable
ALTER TABLE "wiki_pages" DROP COLUMN "content",
DROP COLUMN "published_at",
DROP COLUMN "published_by_membership_id",
DROP COLUMN "published_version_number",
DROP COLUMN "status",
ADD COLUMN     "ack_version_number" INTEGER,
ADD COLUMN     "cover_position" INTEGER NOT NULL DEFAULT 50;

-- AlterTable
ALTER TABLE "wiki_page_versions" DROP COLUMN "content",
DROP COLUMN "is_published_snapshot";

-- DropTable
DROP TABLE "wiki_page_review_requests";

-- DropEnum
DROP TYPE "WikiPageStatus";

-- DropEnum
DROP TYPE "WikiReviewRequestStatus";
