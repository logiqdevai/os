import type { ProjectDetail } from "@/features/projects/interfaces/projects.interfaces";
import { GatesSection } from "./governance/gates-section";
import { ChecklistsSection } from "./governance/checklists-section";
import { ReviewsSection } from "./governance/reviews-section";

/**
 * Gates & reviews tab (05 §46–49, §92–93): approval / quality gates with their decision flow, phase checklists and
 * reviews / retrospectives. Archived projects are read-only.
 */
export function GovernanceTab({ project }: { project: ProjectDetail }) {
    const readOnly = !!project.archived_at;
    return (
        <div className="space-y-8">
            <GatesSection projectId={project.id} readOnly={readOnly} />
            <ChecklistsSection projectId={project.id} readOnly={readOnly} />
            <ReviewsSection projectId={project.id} readOnly={readOnly} />
        </div>
    );
}
