import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { SearchX } from "lucide-react";
import { RequirePermission } from "@/components/access/can";
import { Page } from "@/components/ui/page";
import { EmptyState } from "@/components/ui/states";

const DashboardPage = lazy(() => import("./pages/dashboard"));
const DealsPage = lazy(() => import("./pages/deals"));
const DealDetailPage = lazy(() => import("./pages/deal-detail"));
const LeadsPage = lazy(() => import("./pages/leads"));
const LeadDetailPage = lazy(() => import("./pages/lead-detail"));
const CompaniesPage = lazy(() => import("./pages/companies"));
const CompanyDetailPage = lazy(() => import("./pages/company-detail"));
const ContactsPage = lazy(() => import("./pages/contacts"));
const ContactDetailPage = lazy(() => import("./pages/contact-detail"));
const ActivitiesPage = lazy(() => import("./pages/activities"));
const ForecastPage = lazy(() => import("./pages/forecast"));
const PipelinesPage = lazy(() => import("./pages/pipelines"));
const CrmSettingsPage = lazy(() => import("./pages/settings"));
const CustomFieldsPage = lazy(() => import("./pages/custom-fields"));

function NotFound() {
    return <Page><EmptyState icon={SearchX} title="Page not found" description="This CRM page does not exist." /></Page>;
}

/** /crm/* — each route is gated by its VIEW permission (app/mockups/modules/02-crm). */
export default function CrmRoutes() {
    return (
        <Routes>
            <Route index element={<RequirePermission permission="crm.dashboards.read"><DashboardPage /></RequirePermission>} />
            <Route path="dashboard" element={<RequirePermission permission="crm.dashboards.read"><DashboardPage /></RequirePermission>} />
            <Route path="deals" element={<RequirePermission permission="crm.deals.read"><DealsPage /></RequirePermission>} />
            <Route path="deals/new" element={<RequirePermission allOf={["crm.deals.read", "crm.deals.create"]}><DealsPage /></RequirePermission>} />
            <Route path="deals/:dealId" element={<RequirePermission permission="crm.deals.read"><DealDetailPage /></RequirePermission>} />
            <Route path="leads" element={<RequirePermission permission="crm.leads.read"><LeadsPage /></RequirePermission>} />
            <Route path="leads/:leadId" element={<RequirePermission permission="crm.leads.read"><LeadDetailPage /></RequirePermission>} />
            <Route path="companies" element={<RequirePermission permission="crm.companies.read"><CompaniesPage /></RequirePermission>} />
            <Route path="companies/:companyId" element={<RequirePermission permission="crm.companies.read"><CompanyDetailPage /></RequirePermission>} />
            <Route path="contacts" element={<RequirePermission permission="crm.contacts.read"><ContactsPage /></RequirePermission>} />
            <Route path="contacts/:contactId" element={<RequirePermission permission="crm.contacts.read"><ContactDetailPage /></RequirePermission>} />
            <Route path="activities" element={<RequirePermission permission="crm.activities.read"><ActivitiesPage /></RequirePermission>} />
            <Route path="forecast" element={<RequirePermission permission="crm.forecast.read"><ForecastPage /></RequirePermission>} />
            <Route path="pipelines" element={<RequirePermission permission="crm.pipelines.manage"><PipelinesPage /></RequirePermission>} />
            <Route path="settings" element={<RequirePermission permission="crm.settings.manage"><CrmSettingsPage /></RequirePermission>} />
            <Route path="custom-fields" element={<RequirePermission permission="platform.custom_fields.manage"><CustomFieldsPage /></RequirePermission>} />
            <Route path="*" element={<NotFound />} />
        </Routes>
    );
}
