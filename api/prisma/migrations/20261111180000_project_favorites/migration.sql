-- CreateTable
CREATE TABLE "project_favorites" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_favorites_membership_id_idx" ON "project_favorites"("membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_favorites_project_id_membership_id_key" ON "project_favorites"("project_id", "membership_id");

-- AddForeignKey
ALTER TABLE "project_favorites" ADD CONSTRAINT "project_favorites_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_favorites" ADD CONSTRAINT "project_favorites_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

