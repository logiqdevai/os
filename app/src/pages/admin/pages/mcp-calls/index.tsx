import { useState } from "react";
import { Bot, Check, Sparkles, X } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useListParams } from "@/hooks/use-list-params";
import { useConfirmMcpCall, useMcpCalls, useRejectMcpCall } from "@/features/admin/mcp-calls/hooks/use-mcp-calls";
import type { McpCall } from "@/features/admin/mcp-calls/interfaces/mcp-calls.interfaces";
import { McpCallStatusFilterOptions } from "@/config/constants/dropdowns/admin/developer-form.options";
import { formatDateTime, formatRelative, personName } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { McpCallStatusBadge } from "../../components/status-badges";

const caller = (c: McpCall) => c.service_account?.name ?? (c.actor_member ? personName(c.actor_member) : "Unknown");

/**
 * MCP calls — /admin/mcp-calls?status=
 * @perm VIEW organizations.mcp_calls.read · confirm / reject also needs the tool's own permission (checked by the API)
 * @api GET /mcp-calls · POST /mcp-calls/:id/confirm (runs as the original caller) · POST /mcp-calls/:id/reject
 */
export default function McpCallsPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const calls = useMcpCalls(params);
    const confirm = useConfirmMcpCall();
    const reject = useRejectMcpCall();
    const [deciding, setDeciding] = useState<{ kind: "confirm" | "reject"; call: McpCall } | null>(null);

    const decide = () => {
        if (!deciding) return;
        const onError = (e: unknown) => toast({ variant: "destructive", title: "Could not decide", description: getApiErrorMessage(e) });
        if (deciding.kind === "confirm")
            confirm.mutate(deciding.call.id, {
                onSuccess: (res) => { toast({ title: res.call.status === "SUCCEEDED" ? "Confirmed and run" : "Confirmed, but the tool failed", variant: res.call.status === "SUCCEEDED" ? undefined : "destructive" }); setDeciding(null); },
                onError,
            });
        else reject.mutate(deciding.call.id, { onSuccess: () => { toast({ title: "Call rejected" }); setDeciding(null); }, onError });
    };

    const columns: DataTableColumn<McpCall>[] = [
        {
            key: "tool",
            header: "Tool",
            cell: (c) => (
                <div className="min-w-0">
                    <code className="truncate text-[12.5px] text-foreground">{c.tool_name}</code>
                    <div className="truncate text-xs text-muted-foreground">{Object.entries(c.input_summary ?? {}).filter(([k]) => k.endsWith("id")).map(([k, v]) => `${k}: ${String(v).slice(0, 8)}`).join(" · ") || c.permission_key}</div>
                </div>
            ),
        },
        {
            key: "caller",
            header: "Caller",
            hideBelow: "md",
            cell: (c) => (
                <div className="flex min-w-0 items-center gap-1.5">
                    {c.service_account && <Bot className="size-4 flex-none text-muted-foreground" />}
                    <span className="truncate">{caller(c)}</span>
                    {c.client_name && <span className="truncate text-xs text-muted-foreground">via {c.client_name}</span>}
                </div>
            ),
        },
        { key: "when", header: "When", hideBelow: "sm", cell: (c) => <span className="text-muted-foreground" title={formatDateTime(c.created_at)}>{formatRelative(c.created_at)}</span> },
        { key: "duration", header: "Duration", hideBelow: "xl", className: "tabular", cell: (c) => <span className="text-muted-foreground">{c.duration_ms !== null ? `${c.duration_ms} ms` : "—"}</span> },
        {
            key: "status",
            header: "Status",
            cell: (c) => (
                <div className="space-y-0.5">
                    <McpCallStatusBadge status={c.status} />
                    {c.confirmed_by && <div className="text-xs text-muted-foreground">by {personName(c.confirmed_by)}</div>}
                    {c.error_code && <div className="text-xs text-danger">{c.error_code}</div>}
                </div>
            ),
        },
        {
            key: "decide",
            header: <span className="sr-only">Decide</span>,
            className: "w-px whitespace-nowrap",
            cell: (c) =>
                c.status === "AWAITING_CONFIRMATION" && c.can_decide && (
                    <div className="flex gap-1">
                        <Button size="sm" onClick={() => setDeciding({ kind: "confirm", call: c })}><Check /> Confirm</Button>
                        <Button size="sm" variant="ghost" aria-label="Reject" onClick={() => setDeciding({ kind: "reject", call: c })}><X /></Button>
                    </div>
                ),
        },
    ];

    return (
        <Page>
            <PageHeader title="MCP calls" description="Every tool call made by AI agents, API keys and service accounts. Sensitive calls wait here for a person to confirm them." />
            {!!calls.data?.awaiting_confirmation && filters.status !== "AWAITING_CONFIRMATION" && (
                <Alert className="mb-4">
                    <Sparkles className="size-4" />
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                        {calls.data.awaiting_confirmation} call{calls.data.awaiting_confirmation > 1 ? "s are" : " is"} waiting for confirmation.
                        <Button size="sm" variant="outline" onClick={() => setFilter("status", "AWAITING_CONFIRMATION")}>Review</Button>
                    </AlertDescription>
                </Alert>
            )}
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search tool or client…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-52" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{McpCallStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={calls.data?.data}
                rowKey={(c) => c.id}
                loading={calls.isFetching}
                error={calls.error}
                onRetry={() => calls.refetch()}
                pagination={calls.data?.pagination}
                onPageChange={setPage}
                empty={{ icon: Sparkles, title: filters.status ? "No calls match" : "No MCP calls yet", description: "Connect an agent to POST /mcp with an API key to see its calls here." }}
            />
            <ConfirmationDialog
                isOpen={!!deciding}
                onClose={() => setDeciding(null)}
                title={deciding?.kind === "confirm" ? `Run ${deciding.call.tool_name}?` : `Reject ${deciding?.call.tool_name}?`}
                description={deciding?.kind === "confirm" ? `It runs now as ${caller(deciding.call)}, with that caller's permissions — not yours.` : "The agent is told the call was rejected. Nothing runs."}
                confirmText={deciding?.kind === "confirm" ? "Confirm and run" : "Reject"}
                variant={deciding?.kind === "confirm" ? "default" : "destructive"}
                isLoading={confirm.isPending || reject.isPending}
                onConfirm={decide}
            />
        </Page>
    );
}
