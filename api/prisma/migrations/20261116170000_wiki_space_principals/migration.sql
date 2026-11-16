-- Space access becomes principal-based (member, team, branch, role, department) instead of members only.
-- Development stage, no real data: the table is dropped and recreated.
DROP TABLE "wiki_space_members";

CREATE TABLE "wiki_space_members" (
    "id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "principal_type" "WikiPrincipalType" NOT NULL DEFAULT 'MEMBERSHIP',
    "principal_id" TEXT NOT NULL,
    "level" "WikiPermissionLevel" NOT NULL DEFAULT 'VIEW',
    "added_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wiki_space_members_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "wiki_space_members_principal_type_principal_id_idx" ON "wiki_space_members"("principal_type", "principal_id");
CREATE UNIQUE INDEX "wiki_space_members_space_id_principal_type_principal_id_key" ON "wiki_space_members"("space_id", "principal_type", "principal_id");

ALTER TABLE "wiki_space_members" ADD CONSTRAINT "wiki_space_members_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "wiki_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
