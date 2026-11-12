-- 03/07: one public link per delivery instead of a single token on the proposal.
CREATE TYPE "ProposalAccessTokenSource" AS ENUM ('SEND', 'REMINDER', 'PORTAL', 'ROTATION');

CREATE TABLE "proposal_access_tokens" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "source" "ProposalAccessTokenSource" NOT NULL,
    "recipient_email" TEXT,
    "portal_membership_id" TEXT,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "proposal_access_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "proposal_access_tokens_token_hash_key" ON "proposal_access_tokens"("token_hash");
CREATE INDEX "proposal_access_tokens_proposal_id_revoked_at_idx" ON "proposal_access_tokens"("proposal_id", "revoked_at");

ALTER TABLE "proposal_access_tokens" ADD CONSTRAINT "proposal_access_tokens_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proposal_access_tokens" ADD CONSTRAINT "proposal_access_tokens_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "proposals_public_token_hash_key";
ALTER TABLE "proposals" DROP COLUMN "public_token_hash";

-- 06: release notes draft/published state.
ALTER TABLE "releases" ADD COLUMN "notes_published_at" TIMESTAMP(3),
ADD COLUMN "notes_published_by_membership_id" TEXT;
