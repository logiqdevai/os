import { Link } from "react-router-dom";
import { CopyCheck, Download } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/access/can";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";

/** CSV export (sensitive and audited on the server). Shown only with the entity's export key. */
export function ExportButton({ permission, mutation, params }: { permission: string; mutation: UseMutationResult<number, Error, Record<string, unknown>>; params: Record<string, unknown> }) {
    return (
        <Can permission={permission}>
            <Button
                variant="outline"
                loading={mutation.isPending}
                onClick={() =>
                    mutation.mutate(params, {
                        onSuccess: (count) => toast({ title: "Export ready", description: `${count} record(s) exported. The export was logged.` }),
                        onError: (e) => toast({ variant: "destructive", title: "Could not export", description: getApiErrorMessage(e) }),
                    })
                }
            >
                <Download /> <span className="hidden sm:inline">Export</span>
            </Button>
        </Can>
    );
}

export interface DuplicateMatch {
    id: string;
    name?: string;
    first_name?: string;
    last_name?: string | null;
    email?: string | null;
    website?: string | null;
    match: string;
}

/** Possible duplicates from a 409 `possible_duplicates` response (02 §22), else null. */
export function getDuplicates(error: unknown): DuplicateMatch[] | null {
    if (!isAxiosError(error) || error.response?.status !== 409) return null;
    const data = error.response.data as { code?: string; duplicates?: DuplicateMatch[] };
    return data?.code === "possible_duplicates" ? data.duplicates ?? [] : null;
}

/** Inline warning listing possible duplicates with links; the form offers "Create anyway". */
export function DuplicateNotice({ matches, hrefOf }: { matches: DuplicateMatch[]; hrefOf: (id: string) => string }) {
    return (
        <div className="rounded-md border border-warning/40 bg-warning-soft p-3 text-[13px]" role="alert">
            <div className="mb-1 flex items-center gap-1.5 font-medium text-warning">
                <CopyCheck className="size-4" /> Possible duplicate{matches.length > 1 ? "s" : ""}
            </div>
            <ul className="space-y-0.5 text-foreground">
                {matches.map((m) => (
                    <li key={m.id} className="truncate">
                        <Link to={hrefOf(m.id)} target="_blank" className="underline underline-offset-2">
                            {m.name ?? [m.first_name, m.last_name].filter(Boolean).join(" ")}
                        </Link>
                        <span className="text-muted-foreground"> · same {m.match}{m.email ? ` · ${m.email}` : m.website ? ` · ${m.website}` : ""}</span>
                    </li>
                ))}
            </ul>
            <p className="mt-1 text-xs text-muted-foreground">Open the existing record, or choose “Create anyway”.</p>
        </div>
    );
}
