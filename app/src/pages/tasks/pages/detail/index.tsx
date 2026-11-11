import { useParams } from "react-router-dom";
import { Page, PageHeader } from "@/components/ui/page";
import { TaskDetailView } from "../../components/task-detail-view";

/**
 * /tasks/:identifier (e.g. /tasks/WEB-142) — full task page.
 * @perm VIEW tasks.tasks.read · @api GET /tasks/:key
 * @states loading · not found / no access · error
 */
export default function TaskDetailPage() {
    const { identifier } = useParams();
    return (
        <Page width="wide">
            <PageHeader title="" documentTitle={identifier} back={{ to: "/tasks", label: "Tasks" }} className="mb-2" />
            {identifier && <TaskDetailView taskKey={identifier} />}
        </Page>
    );
}
