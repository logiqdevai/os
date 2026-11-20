-- Tasks get any number of assignees: task_assignees is the single source of truth.
-- Backfill: every existing primary assignee becomes a task_assignees row (already-present rows are kept).
INSERT INTO "task_assignees" ("task_id", "membership_id", "assigned_at")
SELECT "id", "assignee_membership_id", COALESCE("created_at", CURRENT_TIMESTAMP)
FROM "tasks"
WHERE "assignee_membership_id" IS NOT NULL
ON CONFLICT ("task_id", "membership_id") DO NOTHING;

-- Drop the old single-assignee column.
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_assignee_membership_id_fkey";
DROP INDEX "tasks_assignee_membership_id_status_id_idx";
ALTER TABLE "tasks" DROP COLUMN "assignee_membership_id";
