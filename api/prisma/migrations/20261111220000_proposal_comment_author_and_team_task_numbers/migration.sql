-- 03: name typed by a customer on the public proposal link
ALTER TABLE "proposal_comments" ADD COLUMN "author_name" TEXT;

-- 06: task numbers are per team (WEB-1, APP-1)
DROP INDEX "tasks_organization_id_number_key";
CREATE UNIQUE INDEX "tasks_organization_id_team_id_number_key" ON "tasks"("organization_id", "team_id", "number");
