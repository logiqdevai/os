import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Crown, Pause, Play, UserMinus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { usePermissions } from "@/hooks/use-permission";
import { useMember, useOffboardMember, useReactivateMember, useSuspendMember } from "@/features/admin/members/hooks/use-members";
import { personName } from "@/lib/format";
import { PersonCell } from "../../components/person-cell";
import { MemberStatusBadge } from "../../components/status-badges";
import { MemberAccessTab } from "./components/member-access-tab";
import { MemberModulesTab } from "./components/member-modules-tab";
import { MemberPermissionsTab } from "./components/member-permissions-tab";
import { MemberProfileTab } from "./components/member-profile-tab";

type Action = "suspend" | "reactivate" | "offboard" | null;

/**
 * Member detail — /admin/members/:id?tab=access|modules|permissions|profile
 * @perm VIEW users.members.read · roles users.roles.assign · branches organizations.branches.members.manage · teams organizations.teams.members.manage ·
 *       modules + suspend users.members.manage · offboard users.members.offboard · grants users.permissions.grant · effective users.permissions.read
 */
export default function MemberDetailPage() {
    const { id } = useParams();
    const [sp, setSp] = useSearchParams();
    const tab = sp.get("tab") ?? "access";
    const member = useMember(id);
    const p = usePermissions();
    const suspend = useSuspendMember();
    const reactivate = useReactivateMember();
    const offboard = useOffboardMember();
    const [action, setAction] = useState<Action>(null);

    if (member.isPending) return <PageSkeleton />;
    if (member.error) return <Page><PageHeader title="Member" back={{ to: "/admin/members", label: "Members" }} /><ErrorState error={member.error} onRetry={() => member.refetch()} /></Page>;
    const m = member.data;
    const name = personName(m.user);

    const run = () => {
        // Optimistic: the status badge changes at once, so the confirmation closes right away.
        if (action === "suspend") suspend.mutate(m.id);
        if (action === "reactivate") reactivate.mutate(m.id);
        if (action === "offboard") offboard.mutate({ id: m.id });
        setAction(null);
    };

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: "/admin/members", label: "Members" }}
                documentTitle={name}
                title={<PersonCell user={m.user} size="lg" sub={[m.job_title, m.user.email].filter(Boolean).join(" · ")} />}
                meta={
                    <>
                        <MemberStatusBadge status={m.status} />
                        {m.is_owner && <Badge variant="violet"><Crown className="size-3" /> Owner</Badge>}
                        {m.is_self && <Badge variant="info">You</Badge>}
                    </>
                }
                actions={
                    !m.is_self && (
                        <>
                            <Can permission="users.members.manage">
                                {m.status === "ACTIVE" && <Button variant="outline" onClick={() => setAction("suspend")}><Pause /> Suspend</Button>}
                                {(m.status === "SUSPENDED" || m.status === "DEACTIVATED") && <Button variant="outline" onClick={() => setAction("reactivate")}><Play /> Reactivate</Button>}
                            </Can>
                            <Can permission="users.members.offboard">
                                {m.status !== "DEACTIVATED" && <Button variant="destructive" onClick={() => setAction("offboard")}><UserMinus /> Offboard</Button>}
                            </Can>
                        </>
                    )
                }
            />

            <Tabs value={tab} onValueChange={(v) => setSp((prev) => { const n = new URLSearchParams(prev); n.set("tab", v); return n; }, { replace: true })}>
                <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                    <TabsList>
                        <TabsTrigger value="access">Roles & structure</TabsTrigger>
                        <TabsTrigger value="modules">Modules</TabsTrigger>
                        {p.can("users.permissions.read") && <TabsTrigger value="permissions">Permissions</TabsTrigger>}
                        <TabsTrigger value="profile">Profile</TabsTrigger>
                    </TabsList>
                </div>
                <TabsContent value="access" className="mt-4"><MemberAccessTab member={m} /></TabsContent>
                <TabsContent value="modules" className="mt-4"><MemberModulesTab member={m} /></TabsContent>
                {p.can("users.permissions.read") && <TabsContent value="permissions" className="mt-4"><MemberPermissionsTab member={m} /></TabsContent>}
                <TabsContent value="profile" className="mt-4"><MemberProfileTab member={m} /></TabsContent>
            </Tabs>

            <ConfirmationDialog
                isOpen={!!action}
                onClose={() => setAction(null)}
                title={action === "suspend" ? `Suspend ${name}?` : action === "reactivate" ? `Reactivate ${name}?` : `Offboard ${name}?`}
                description={
                    action === "suspend" ? "They lose access to this organization right away. You can reactivate them later."
                        : action === "reactivate" ? "They get access back with their current roles."
                            : "Roles, branches, teams and personal API keys are removed. Records they own stay in place. This is recorded in the audit log."
                }
                confirmText={action === "suspend" ? "Suspend" : action === "reactivate" ? "Reactivate" : "Offboard"}
                variant={action === "reactivate" ? "default" : "destructive"}
                onConfirm={run}
            />
        </Page>
    );
}
