import { useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuickCreate } from "../../components/quick-create";
import AllTasksPage from "../all";

/**
 * /tasks/new?team=&project=&parent=&status= — opens the New task dialog over the All tasks list (Linear style).
 * Closing the dialog goes back to where the link was opened from.
 * @perm tasks.tasks.create · @api POST /tasks
 */
export default function NewTaskPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [sp] = useSearchParams();
    const quick = useQuickCreate();
    const team = sp.get("team");
    const project = sp.get("project");
    const parent = sp.get("parent");
    const status = sp.get("status");
    const cameFromApp = location.key !== "default";

    useEffect(() => {
        quick.open(
            { team_id: team, project_id: project, parent_task_id: parent, status_id: status },
            () => (cameFromApp ? navigate(-1) : navigate("/tasks/all", { replace: true })),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [team, project, parent, status]);

    return <AllTasksPage />;
}
