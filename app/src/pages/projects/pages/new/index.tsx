import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, FileStack, Sparkles } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateProject, useProjectTemplates } from "@/features/projects/hooks/use-projects";
import { cn } from "@/lib/utils";
import { ProjectForm } from "../../components/project-form";

/**
 * /projects/new?template=&customer= — create a project, optionally from a template.
 * @perm projects.projects.create · budget fields projects.projects.manage_budgets (+ finance.read for money)
 * @api GET /project-templates · POST /projects
 * @audit project created (with template version)
 */
export default function NewProjectPage() {
    const navigate = useNavigate();
    const [sp, setSp] = useSearchParams();
    const templateId = sp.get("template");
    const templates = useProjectTemplates();
    const create = useCreateProject();
    const chosen = templates.data?.find((t) => t.id === templateId) ?? null;
    const structure = chosen?.current_version?.structure;

    const pick = (id: string | null) => setSp((prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set("template", id);
        else next.delete("template");
        return next;
    }, { replace: true });

    return (
        <Page width="narrow">
            <PageHeader title="New project" back={{ to: "/projects", label: "Projects" }} description="Start blank or from a template; a template copies milestones, deliverables, checklists and starter tasks." />
            <div className="space-y-6">
                <Section title="Start from">
                    {templates.isPending ? (
                        <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Template">
                            {[{ id: null as string | null, name: "Blank project", description: "No milestones or tasks yet.", meta: null as string | null }, ...(templates.data ?? []).map((t) => ({
                                id: t.id as string | null,
                                name: t.name,
                                description: t.description ?? "",
                                meta: `${t.current_version?.structure.milestones?.length ?? 0} milestones · ${t.current_version?.structure.tasks?.length ?? 0} tasks · v${t.current_version?.version_number ?? 1}`,
                            }))].map((t) => {
                                const active = (templateId ?? null) === t.id;
                                return (
                                    <button
                                        key={t.id ?? "blank"}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => pick(t.id)}
                                        className={cn("flex items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors", active ? "border-primary ring-1 ring-primary" : "border-border hover:border-border-strong")}
                                    >
                                        <div className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">{t.id ? <FileStack className="size-4" /> : <Sparkles className="size-4" />}</div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">{t.name}{active && <Check className="size-3.5 text-primary" />}</div>
                                            {t.description && <div className="line-clamp-2 text-xs text-muted-foreground">{t.description}</div>}
                                            {t.meta && <div className="mt-1 text-xs text-ash">{t.meta}</div>}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {structure?.milestones?.length ? (
                        <p className="text-xs text-muted-foreground">Milestones: {structure.milestones.map((m) => `${m.name} (day ${m.offset_days ?? 0})`).join(" · ")}. Dates are counted from the planned start.</p>
                    ) : null}
                </Section>

                <div className="rounded-lg border border-border bg-card p-4 md:p-5">
                    <ProjectForm
                        templateId={templateId}
                        defaults={{ company_id: sp.get("customer") ?? "", type_id: chosen?.type?.id ?? "__none" }}
                        submitLabel="Create project"
                        pending={create.isPending}
                        onCancel={() => navigate("/projects")}
                        onSubmit={(dto) => create.mutate(dto, { onSuccess: (p) => navigate(`/projects/${p.id}`) })}
                    />
                </div>
            </div>
        </Page>
    );
}
