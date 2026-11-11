-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "task_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "teams_organization_id_task_key_key" ON "teams"("organization_id", "task_key");

