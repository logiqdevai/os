/** 02 CRM API routes (api/src/modules/crm). */
const resource = (base: string) => ({
    list: base,
    detail: (id: string) => `${base}/${id}`,
    export: `${base}/export`,
    duplicates: `${base}/duplicates`,
    assign: (id: string) => `${base}/${id}/assign`,
    archive: (id: string) => `${base}/${id}/archive`,
    restore: (id: string) => `${base}/${id}/restore`,
});

export const CrmApiRoutes = {
    companies: { ...resource("/crm/companies"), lookup: "/crm/companies/lookup" },
    contacts: { ...resource("/crm/contacts"), lookup: "/crm/contacts/lookup" },
    leads: {
        ...resource("/crm/leads"),
        status: (id: string) => `/crm/leads/${id}/status`,
        convert_preview: (id: string) => `/crm/leads/${id}/convert-preview`,
        convert: (id: string) => `/crm/leads/${id}/convert`,
    },
    deals: {
        ...resource("/crm/deals"),
        board: "/crm/deals/board",
        stage: (id: string) => `/crm/deals/${id}/stage`,
        won: (id: string) => `/crm/deals/${id}/won`,
        lost: (id: string) => `/crm/deals/${id}/lost`,
        reopen: (id: string) => `/crm/deals/${id}/reopen`,
        line_items: (id: string) => `/crm/deals/${id}/line-items`,
        contacts: (id: string) => `/crm/deals/${id}/contacts`,
        contact: (id: string, contactId: string) => `/crm/deals/${id}/contacts/${contactId}`,
    },
    pipelines: {
        list: "/crm/pipelines",
        detail: (id: string) => `/crm/pipelines/${id}`,
        stages: (id: string) => `/crm/pipelines/${id}/stages`,
        archive: (id: string) => `/crm/pipelines/${id}/archive`,
    },
    activities: {
        list: "/crm/activities",
        summary: "/crm/activities/summary",
        detail: (id: string) => `/crm/activities/${id}`,
        complete: (id: string) => `/crm/activities/${id}/complete`,
    },
    notes: { list: "/crm/notes", detail: (id: string) => `/crm/notes/${id}` },
    settings: {
        all: "/crm/settings",
        list: (kind: string) => `/crm/settings/${kind}`,
        item: (kind: string, id: string) => `/crm/settings/${kind}/${id}`,
        archive: (kind: string, id: string) => `/crm/settings/${kind}/${id}/archive`,
        restore: (kind: string, id: string) => `/crm/settings/${kind}/${id}/restore`,
        order: (kind: string) => `/crm/settings/${kind}/order`,
    },
    members: "/crm/members",
    dashboard: "/crm/dashboard",
    forecast: "/crm/forecast",
    tags: { list: "/tags", detail: (id: string) => `/tags/${id}`, merge: (id: string) => `/tags/${id}/merge`, taggings: "/taggings" },
    saved_views: { list: "/saved-views", detail: (id: string) => `/saved-views/${id}` },
};
