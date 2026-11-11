import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/lib/format";
import { useFillableForm, useSubmitForm } from "@/features/docs/hooks/use-docs";
import { FormRenderer } from "../../components/form-renderer";

/**
 * /docs/forms/:id/fill — answer a form as a member (15 §8)
 * @perm any member the form is assigned to (or open to the organization); checked by the API
 * @api GET /docs/forms/:id/fill · POST /docs/forms/:id/submissions
 */
export default function FormFillPage() {
    const { id = "" } = useParams<{ id: string }>();
    const form = useFillableForm(id);
    const submit = useSubmitForm();
    const [done, setDone] = useState<string | null>(null);

    if (form.isPending) return <PageSkeleton />;
    if (form.error) return <Page><ErrorState error={form.error} onRetry={() => form.refetch()} /></Page>;
    const f = form.data;

    return (
        <Page width="narrow">
            <PageHeader back={{ to: "/docs/forms", label: "Forms" }} title={f.name} description={f.description ?? undefined} />
            {done !== null ? (
                <div className="rounded-lg border border-border bg-card">
                    <EmptyState icon={CheckCircle2} title="Thank you" description={done || "Your response was recorded."} action={<Button variant="outline" asChild><Link to="/docs/forms">Back to forms</Link></Button>} />
                </div>
            ) : f.already_submitted && !f.allow_multiple_submissions ? (
                <div className="rounded-lg border border-border bg-card"><EmptyState icon={CheckCircle2} title="Already submitted" description="You have answered this form." /></div>
            ) : (
                <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
                    {f.is_anonymous && <p className="mb-4 rounded-md bg-info-soft px-3 py-2 text-xs text-info">Your answers are anonymous.</p>}
                    {f.closes_at && <p className="mb-4 text-xs text-muted-foreground">Closes {formatDate(f.closes_at)}</p>}
                    <FormRenderer fields={f.fields} pending={submit.isPending} onSubmit={(answers) => submit.mutate({ id, answers }, { onSuccess: () => setDone(f.confirmation_message ?? ""), onError: (e) => toast({ variant: "destructive", title: "Could not submit", description: getApiErrorMessage(e) }) })} />
                </div>
            )}
        </Page>
    );
}
