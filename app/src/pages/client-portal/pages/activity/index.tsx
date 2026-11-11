import { Activity } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { useListParams } from "@/hooks/use-list-params";
import { formatDateTime } from "@/lib/format";
import { usePortalActivity } from "@/features/client-portal/hooks/use-client-portal";
import type { PortalActivityRow } from "@/features/client-portal/interfaces/client-portal.interfaces";

/**
 * Portal activity — /client-portal/activity (mockup 07-portal `activity`): what portal users did, from the audit log.
 * @perm portal.activity.read
 */
export default function PortalActivityPage() {
    const { params, setPage } = useListParams({ limit: 50 });
    const activity = usePortalActivity(params);
    const columns: DataTableColumn<PortalActivityRow>[] = [
        { key: "actor", header: "Who", cell: (a) => <MemberAvatar person={a.actor} showName size="xs" emptyLabel="System" /> },
        { key: "event", header: "What", cell: (a) => <span className="text-foreground">{a.event_type.replace(/[._]/g, " ")}</span> },
        { key: "company", header: "Client", cell: (a) => (a.company ? <Badge variant="neutral">{a.company.name}</Badge> : <span className="text-ash">Agency</span>), hideBelow: "sm" },
        { key: "outcome", header: "Result", cell: (a) => <Badge variant={a.outcome === "SUCCESS" ? "success" : a.outcome === "DENIED" ? "danger" : "warning"}>{a.outcome.toLowerCase()}</Badge>, hideBelow: "md" },
        { key: "when", header: "When", cell: (a) => <span className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</span> },
    ];
    return (
        <Page>
            <PageHeader title="Portal activity" description="Sign-ins, requests, approvals and changes made by client users, and portal administration." />
            <DataTable columns={columns} data={activity.data?.data} rowKey={(a) => a.id} loading={activity.isFetching} error={activity.error} onRetry={() => activity.refetch()} pagination={activity.data?.pagination} onPageChange={setPage} empty={{ icon: Activity, title: "No portal activity yet" }} />
        </Page>
    );
}
