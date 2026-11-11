/** Every CRM frontend path (one place; never hand-write CRM URLs in components). */
export const CrmPaths = {
    root: "/crm",
    deals: "/crm/deals",
    deal_new: "/crm/deals/new",
    deal: (id: string) => `/crm/deals/${id}`,
    leads: "/crm/leads",
    lead: (id: string) => `/crm/leads/${id}`,
    companies: "/crm/companies",
    company: (id: string) => `/crm/companies/${id}`,
    contacts: "/crm/contacts",
    contact: (id: string) => `/crm/contacts/${id}`,
    activities: "/crm/activities",
    forecast: "/crm/forecast",
    pipelines: "/crm/pipelines",
    settings: "/crm/settings",
};
