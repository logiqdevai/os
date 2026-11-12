import { useEffect, useState } from "react";
import { CheckCircle2, Circle, CircleAlert, Flag, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/page";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermissions } from "@/hooks/use-permission";
import { useGovernance, useGovernancePost, useGovernancePut } from "@/features/projects/hooks/use-projects";
import type { ProjectCloseoutData, ProjectDetail } from "@/features/projects/interfaces/projects.interfaces";
import { formatDate, personName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { HandoversSection } from "./governance/handovers-section";

type Fields = { final_status_summary: string; outstanding_items: string; lessons_learned: string; customer_outcome: string };

/**
 * Closeout (05 §71–74, §103): completion requirements (required ones block completion), the closeout record, handovers,
 * and "Close project" which saves the record and completes the project.
 * @perm VIEW projects.projects.read · save projects.projects.update · customer acceptance projects.deliverables.accept_on_behalf* ·
 *       close projects.projects.complete
 * @api GET/PUT /projects/:id/closeout · POST /projects/:id/closeout/close · /projects/:id/handovers
 */
export function CloseoutTab({ project }: { project: ProjectDetail }) {
    const p = usePermissions();
    const data = useGovernance<ProjectCloseoutData>(project.id, "closeout");
    const save = useGovernancePut("Closeout saved");
    const close = useGovernancePost("Project closed", "Could not close the project");
    const [fields, setFields] = useState<Fields>({ final_status_summary: "", outstanding_items: "", lessons_learned: "", customer_outcome: "" });
    const [acceptance, setAcceptance] = useState(false);
    const [confirm, setConfirm] = useState(false);
    const record = data.data?.closeout;
    useEffect(() => {
        setFields({
            final_status_summary: record?.final_status_summary ?? "",
            outstanding_items: record?.outstanding_items ?? "",
            lessons_learned: record?.lessons_learned ?? "",
            customer_outcome: record?.customer_outcome ?? "",
        });
        setAcceptance(!!record?.customer_acceptance_recorded_at);
    }, [record]);

    if (data.isPending) return <ListSkeleton rows={6} />;
    if (data.error) return <ErrorState error={data.error} onRetry={() => data.refetch()} />;
    const d = data.data;
    const completed = !!d.project.completed_at;
    const readOnly = !!project.archived_at;
    const canSave = p.can("projects.projects.update") && !readOnly;
    const canAccept = p.can("projects.deliverables.accept_on_behalf") && canSave;
    const canClose = p.can("projects.projects.complete") && !completed && !readOnly;
    const blocking = d.requirements.filter((r) => r.required && !r.satisfied);
    const dto = () => ({
        ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.trim() || null])),
        ...(canAccept && acceptance !== !!record?.customer_acceptance_recorded_at && { customer_acceptance_recorded: acceptance }),
    });

    const textarea = (key: keyof Fields, label: string, placeholder: string) => (
        <div className="space-y-1.5">
            <Label htmlFor={`co-${key}`}>{label}</Label>
            <Textarea id={`co-${key}`} rows={3} value={fields[key]} disabled={!canSave} placeholder={placeholder} onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))} />
        </div>
    );

    return (
        <div className="space-y-8">
            {completed ? (
                <div className="flex items-start gap-3 rounded-lg border border-success/40 bg-success-soft p-3 text-[13px] text-success">
                    <CheckCircle2 className="mt-0.5 size-4 flex-none" />
                    <span>Completed {formatDate(d.project.completed_at)}{record?.closed_by ? ` · closed by ${personName(record.closed_by.user)}` : ""}.</span>
                </div>
            ) : blocking.length > 0 ? (
                <div role="status" className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning-soft p-3 text-[13px] text-warning">
                    <CircleAlert className="mt-0.5 size-4 flex-none" />
                    <span>
                        <b>Cannot complete yet.</b>{" "}
                        {d.blockers.gates.length > 0 && `${d.blockers.gates.length} blocking gate${d.blockers.gates.length === 1 ? " is" : "s are"} not passed (${d.blockers.gates.map((g) => g.name).join(", ")}). `}
                        {d.blockers.checklist_items.length > 0 && `${d.blockers.checklist_items.length} required checklist item${d.blockers.checklist_items.length === 1 ? " is" : "s are"} open.`}
                    </span>
                </div>
            ) : null}

            <Section title="Completion requirements" description="Required items block completion; the others are recommended.">
                <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                    {d.requirements.map((r) => (
                        <li key={r.key} className="flex items-center gap-3 px-3 py-2.5">
                            {r.satisfied ? <CheckCircle2 className="size-4 flex-none text-success" aria-label="Done" /> : <Circle className={cn("size-4 flex-none", r.required ? "text-warning" : "text-ash")} aria-label="Open" />}
                            <span className="min-w-0 flex-1 text-[13px] text-foreground">{r.label}</span>
                            {r.detail && <span className="text-xs text-muted-foreground">{r.detail}</span>}
                            {r.required && <Badge variant={r.satisfied ? "neutral" : "warning"}>Required</Badge>}
                        </li>
                    ))}
                </ul>
            </Section>

            <Section
                title="Closeout record"
                description={record?.updated_at ? `Last saved ${formatDate(record.updated_at)}` : "Final summary, outstanding items and lessons learned."}
                actions={
                    <div className="flex flex-wrap gap-2">
                        {canSave && <Button size="sm" variant="outline" loading={save.isPending} onClick={() => save.mutate({ id: project.id, path: "closeout", dto: dto() })}><Save /> Save</Button>}
                        {canClose && <Button size="sm" disabled={!d.can_complete} title={d.can_complete ? undefined : "Resolve the required items first"} onClick={() => setConfirm(true)}><Flag /> Close project</Button>}
                    </div>
                }
            >
                <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        {textarea("final_status_summary", "Final status summary", "What was delivered, on time and budget?")}
                        {textarea("customer_outcome", "Customer outcome", "What changed for the customer?")}
                        {textarea("outstanding_items", "Outstanding items", "Anything left for support or a follow-up project")}
                        {textarea("lessons_learned", "Lessons learned", "Keep, stop, start")}
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                        <div>
                            <Label htmlFor="co-accept" className="font-normal">Customer acceptance recorded</Label>
                            <p className="text-xs text-muted-foreground">
                                {record?.customer_acceptance_recorded_at ? `Recorded ${formatDate(record.customer_acceptance_recorded_at)}` : canAccept ? "Record that the customer accepted the delivery." : "Needs permission to accept on behalf of the customer."}
                            </p>
                        </div>
                        <Switch id="co-accept" checked={acceptance} onCheckedChange={setAcceptance} disabled={!canAccept} />
                    </div>
                </div>
            </Section>

            <HandoversSection projectId={project.id} readOnly={readOnly} />

            <ConfirmationDialog
                isOpen={confirm}
                onClose={() => setConfirm(false)}
                title={`Close ${project.name}?`}
                description="The closeout record is saved and the project moves to Completed. You can reopen it later with a reason."
                confirmText="Close project"
                isLoading={close.isPending}
                onConfirm={() => close.mutate({ id: project.id, path: "closeout/close", dto: dto() }, { onSuccess: () => setConfirm(false) })}
            />
        </div>
    );
}
