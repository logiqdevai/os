import { Building2, Handshake, Inbox, Layers, LayoutDashboard, Phone, Settings, SlidersHorizontal, TrendingUp, Users } from "lucide-react";
import type { AppDefinition } from "../app.types";

export const crmApp: AppDefinition = {
    id: "crm",
    label: "CRM",
    icon: Handshake,
    basePath: "/crm",
    module: "CRM",
    viewPermissions: ["crm.dashboards.read", "crm.deals.read", "crm.leads.read", "crm.companies.read", "crm.contacts.read", "crm.activities.read"],
    newAction: { label: "New deal", to: "/crm/deals/new", permission: "crm.deals.create" },
    separatorBefore: true,
    nav: [
        { items: [
            { label: "Dashboard", to: "/crm", icon: LayoutDashboard, permissions: ["crm.dashboards.read"], end: true },
            { label: "Deals", to: "/crm/deals", icon: Handshake, permissions: ["crm.deals.read"] },
            { label: "Leads", to: "/crm/leads", icon: Inbox, permissions: ["crm.leads.read"] },
            { label: "Companies", to: "/crm/companies", icon: Building2, permissions: ["crm.companies.read"] },
            { label: "Contacts", to: "/crm/contacts", icon: Users, permissions: ["crm.contacts.read"] },
            { label: "Activities", to: "/crm/activities", icon: Phone, permissions: ["crm.activities.read"] },
            { label: "Forecast", to: "/crm/forecast", icon: TrendingUp, permissions: ["crm.forecast.read"] },
        ] },
        { label: "Setup", items: [
            { label: "Pipelines & stages", to: "/crm/pipelines", icon: Layers, permissions: ["crm.pipelines.manage"] },
            { label: "Settings & tags", to: "/crm/settings", icon: Settings, permissions: ["crm.settings.manage"] },
            { label: "Custom fields", to: "/crm/custom-fields", icon: SlidersHorizontal, permissions: ["platform.custom_fields.manage"] },
        ] },
    ],
};
