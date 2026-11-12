import { Section } from "@/components/ui/page";
import { useUpdateProject } from "@/features/projects/hooks/use-projects";
import type { ProjectDetail } from "@/features/projects/interfaces/projects.interfaces";
import { ProjectForm } from "../../../components/project-form";

/** Edit project fields — autosaves (no Save button). @perm projects.projects.update (budget: manage_budgets) */
export function SettingsTab({ project: d }: { project: ProjectDetail }) {
    const update = useUpdateProject({ inline: true });
    return (
        <Section title="Project settings" description="Changes save automatically.">
            <div className="max-w-3xl rounded-lg border border-border bg-card p-4 md:p-5">
                <ProjectForm
                    customerName={d.company?.name}
                    owner={d.owner}
                    defaults={{
                        name: d.name,
                        code: d.code ?? "",
                        description: d.description ?? "",
                        type_id: d.type_id ?? "__none",
                        company_id: d.company_id ?? "",
                        owner_membership_id: d.owner_membership_id ?? "",
                        team_id: d.team_id ?? "__none",
                        priority: d.priority,
                        visibility: d.visibility,
                        planned_start: d.planned_start?.slice(0, 10) ?? "",
                        target_completion: d.target_completion?.slice(0, 10) ?? "",
                        budget_hours: d.budget_hours ? String(Number(d.budget_hours)) : "",
                        budget_amount: d.budget_amount ? String(Number(d.budget_amount)) : "",
                        currency: d.currency ?? "EUR",
                    }}
                    autosave={{ resetKey: d.id, onSave: ({ template_id: _template, ...dto }) => update.mutateAsync({ id: d.id, ...dto }) }}
                />
            </div>
        </Section>
    );
}
