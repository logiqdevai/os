import { useEffect, useState } from "react";
import { Eye, TriangleAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { getApiErrorMessage } from "@/lib/api-error";
import { usePreviewTemplate } from "@/features/communications/hooks/use-communications";
import type { CommChannel, TemplatePreview } from "@/features/communications/interfaces/communications.interfaces";

interface ContentPreviewProps {
    channel: CommChannel;
    subject?: string;
    preheader?: string;
    body_html?: string;
    body_text?: string;
}

/**
 * Live preview rendered by the API with sample values (POST /communications/templates/preview), debounced.
 * Email HTML is shown in a sandboxed iframe (no scripts); SMS as a phone bubble with the segment count.
 */
export function ContentPreview({ channel, subject, preheader, body_html, body_text }: ContentPreviewProps) {
    const preview = usePreviewTemplate();
    const [result, setResult] = useState<TemplatePreview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const empty = channel === "EMAIL" ? !body_html && !body_text : !body_text;
    const { mutate } = preview;

    useEffect(() => {
        if (empty) {
            setResult(null);
            return;
        }
        const t = setTimeout(() => {
            mutate(
                channel === "EMAIL" ? { subject, preheader, body_html, body_text } : { body_text },
                { onSuccess: (r) => { setResult(r); setError(null); }, onError: (e) => setError(getApiErrorMessage(e)) },
            );
        }, 500);
        return () => clearTimeout(t);
    }, [channel, subject, preheader, body_html, body_text, empty, mutate]);

    if (empty) return <EmptyState compact icon={Eye} title="Preview" description="Write the content to see it rendered with sample data." />;
    if (error) return <EmptyState compact icon={TriangleAlert} title="Preview failed" description={error} />;
    if (!result) return <div className="space-y-2 p-3"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-48 w-full" /></div>;

    return (
        <div className="space-y-2">
            {result.missing_variables.length > 0 && (
                <p className="text-xs text-warning">No sample value for {result.missing_variables.map((v) => `{{${v}}}`).join(", ")} — they render empty.</p>
            )}
            {channel === "EMAIL" ? (
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                    <div className="space-y-0.5 border-b border-border px-3 py-2">
                        <div className="truncate text-[13px] font-medium text-foreground">{result.subject || "(no subject)"}</div>
                        {result.preheader && <div className="truncate text-xs text-muted-foreground">{result.preheader}</div>}
                    </div>
                    {result.body_html ? (
                        <iframe title="Email preview" sandbox="" srcDoc={result.body_html} className="h-96 w-full bg-white" />
                    ) : (
                        <pre className="whitespace-pre-wrap p-3 font-sans text-[13px] text-foreground">{result.body_text}</pre>
                    )}
                </div>
            ) : (
                <div className="rounded-lg border border-border bg-secondary p-4">
                    <div className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-[13px] text-primary-foreground">{result.body_text}</div>
                    <div className="mt-2 flex justify-end gap-2">
                        <Badge variant={result.sms_segments > 3 ? "warning" : "neutral"}>{result.sms_segments} SMS segment{result.sms_segments === 1 ? "" : "s"}</Badge>
                        <Badge variant="neutral">{result.body_text.length} characters</Badge>
                    </div>
                </div>
            )}
        </div>
    );
}
