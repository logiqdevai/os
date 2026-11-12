import { useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, FileQuestion } from "lucide-react";
import { EmptyState, PageSkeleton } from "@/components/ui/states";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { formatDate } from "@/lib/format";
import { usePublicForm, useSubmitPublicForm } from "@/features/docs/hooks/use-docs";
import { FormRenderer } from "../components/form-renderer";

/**
 * /f/:formId — public, anonymous form (15 §8). No sign-in; the API only serves published anonymous forms.
 * @api GET /public/forms/:id · POST /public/forms/:id/submissions (rate-limited)
 */
export default function PublicFormPage() {
    const { formId = "" } = useParams<{ formId: string }>();
    const form = usePublicForm(formId);
    const submit = useSubmitPublicForm();
    const [done, setDone] = useState<string | null>(null);
    usePageMetadata({ title: form.data?.name });

    return (
        <div className="min-h-screen bg-background px-4 py-8 sm:py-12">
            <div className="mx-auto w-full max-w-xl">
                {form.isPending ? <PageSkeleton /> : form.error ? (
                    <div className="rounded-lg border border-border bg-card"><EmptyState icon={FileQuestion} title="This form is not available" description="It may be closed, or the link is wrong." /></div>
                ) : done !== null ? (
                    <div className="rounded-lg border border-border bg-card"><EmptyState icon={CheckCircle2} title="Thank you" description={done || "Your response was recorded."} /></div>
                ) : (
                    <div className="rounded-lg border border-border bg-card p-5 sm:p-8">
                        {form.data.organization_name && <p className="mb-1 text-xs text-muted-foreground">{form.data.organization_name}</p>}
                        <h1 className="text-xl font-semibold text-foreground">{form.data.name}</h1>
                        {form.data.description && <p className="mt-1 whitespace-pre-wrap text-[13px] text-muted-foreground">{form.data.description}</p>}
                        {form.data.closes_at && <p className="mt-2 text-xs text-muted-foreground">Open until {formatDate(form.data.closes_at)}</p>}
                        <div className="mt-6">
                            <FormRenderer
                                fields={form.data.fields}
                                pending={submit.isPending}
                                onSubmit={(answers) => submit.mutate({ id: formId, answers }, { onSuccess: (r) => setDone(r?.confirmation_message ?? form.data.confirmation_message ?? "") })}
                            />
                        </div>
                    </div>
                )}
                <p className="mt-6 text-center text-xs text-muted-foreground">Powered by Logiqdev OS</p>
            </div>
        </div>
    );
}
