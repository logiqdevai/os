import { useNavigate, useSearchParams } from "react-router-dom";
import { Page, PageHeader } from "@/components/ui/page";
import { TaskCreateForm } from "../../components/task-create-form";

/**
 * /tasks/new?team=&project=&parent=&status= — full-page create (quick create is the "c" dialog).
 * @perm tasks.tasks.create · @api POST /tasks
 */
export default function NewTaskPage() {
    const navigate = useNavigate();
    const [sp] = useSearchParams();
    return (
        <Page width="narrow">
            <PageHeader title="New task" back={{ to: "/tasks", label: "My tasks" }} />
            <div className="rounded-lg border border-border bg-card p-4 md:p-5">
                <TaskCreateForm
                    defaults={{ team_id: sp.get("team"), project_id: sp.get("project"), parent_task_id: sp.get("parent"), status_id: sp.get("status") }}
                    onCancel={() => navigate(-1)}
                    onCreated={(task) => navigate(`/tasks/${task.identifier}`, { replace: true })}
                />
            </div>
        </Page>
    );
}
