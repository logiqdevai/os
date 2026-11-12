import { Page, PageHeader } from "@/components/ui/page";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState, NoAccessState, PageSkeleton } from "@/components/ui/states";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { useHrSettings } from "@/features/people/overview/hooks/use-overview";
import { GeneralTab, type GeneralSection } from "./components/general-tab";
import { LeaveTypesTab } from "./components/leave-types-tab";
import { LeavePoliciesTab } from "./components/leave-policies-tab";
import { HolidaysTab } from "./components/holidays-tab";

/**
 * /people/settings?tab=general|types|policies|holidays|attendance|capacity|selfservice — organization HR configuration.
 * @perm general / attendance / capacity / self-service: employees.settings.manage · types, policies, holidays: employees.leave.manage_policies
 * @api GET/PUT /people/settings · /people/leave-types · /people/leave-policies (+assign, assignments) · /people/holidays · /people/branch-holidays
 */
export default function PeopleSettingsPage() {
    const p = usePermissions();
    const canSettings = p.can("employees.settings.manage");
    const canLeave = p.can("employees.leave.manage_policies");
    const q = useHrSettings();
    const { filters, setFilter } = useListParams();
    const tabs = [
        ...(canSettings ? [{ id: "general", label: "General" }] : []),
        ...(canLeave ? [{ id: "types", label: "Leave types" }, { id: "policies", label: "Leave policies" }, { id: "holidays", label: "Holidays" }] : []),
        ...(canSettings ? [{ id: "attendance", label: "Attendance" }, { id: "capacity", label: "Capacity" }, { id: "selfservice", label: "Self-service & directory" }] : []),
    ];
    const tab = tabs.find((t) => t.id === filters.tab)?.id ?? tabs[0]?.id;
    if (!tabs.length) return <Page><PageHeader title="People settings" /><NoAccessState /></Page>;
    if (q.isLoading) return <PageSkeleton />;
    return (
        <Page width="wide">
            <PageHeader title="People settings" description="Organization-wide HR configuration." />
            <Tabs value={tab} onValueChange={(v) => setFilter("tab", v === tabs[0].id ? null : v)} className="mb-4">
                <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0"><TabsList className="w-max">{tabs.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}</TabsList></div>
            </Tabs>
            {q.error || !q.data ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
                <>
                    {["general", "attendance", "capacity", "selfservice"].includes(tab) && <GeneralTab key={tab} settings={q.data} section={tab as GeneralSection} />}
                    {tab === "types" && <LeaveTypesTab />}
                    {tab === "policies" && <LeavePoliciesTab branches={q.data.options.branches} />}
                    {tab === "holidays" && <HolidaysTab branches={q.data.options.branches} />}
                </>
            )}
        </Page>
    );
}
