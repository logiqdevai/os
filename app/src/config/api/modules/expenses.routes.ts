/** 09 Income & expense API (api/src/modules/ledger). */
export const ExpensesApiRoutes = {
    dashboard: "/ledger/dashboard",
    records: {
        list: "/ledger/records",
        export: "/ledger/records/export",
        detail: (id: string) => `/ledger/records/${id}`,
        action: (id: string, action: string) => `/ledger/records/${id}/${action}`,
        settlements: (id: string) => `/ledger/records/${id}/settlements`,
    },
    approvals: "/ledger/approvals",
    settings: "/ledger/settings",
    categories: { list: "/ledger/categories", detail: (id: string) => `/ledger/categories/${id}`, action: (id: string, action: string) => `/ledger/categories/${id}/${action}` },
    payment_methods: { list: "/ledger/payment-methods", detail: (id: string) => `/ledger/payment-methods/${id}`, archive: (id: string) => `/ledger/payment-methods/${id}/archive` },
    suppliers: { list: "/ledger/suppliers", detail: (id: string) => `/ledger/suppliers/${id}`, profile: (id: string) => `/ledger/suppliers/${id}/profile` },
    recurring: { list: "/ledger/recurring", upcoming: "/ledger/recurring/upcoming", detail: (id: string) => `/ledger/recurring/${id}`, action: (id: string, action: string) => `/ledger/recurring/${id}/${action}` },
    claims: { list: "/ledger/claims", detail: (id: string) => `/ledger/claims/${id}`, action: (id: string, action: string) => `/ledger/claims/${id}/${action}` },
    budgets: { list: "/ledger/budgets", detail: (id: string) => `/ledger/budgets/${id}` },
    periods: { list: "/ledger/periods", generate: "/ledger/periods/generate", detail: (id: string) => `/ledger/periods/${id}`, action: (id: string, action: string) => `/ledger/periods/${id}/${action}` },
    vat_returns: { list: "/ledger/vat-returns", action: (id: string, action: string) => `/ledger/vat-returns/${id}/${action}` },
    reports: { profit_loss: "/ledger/reports/profit-loss", vat: "/ledger/reports/vat", cash_flow: "/ledger/reports/cash-flow", aging: (type: string) => `/ledger/reports/aging/${type}` },
    profitability: "/ledger/profitability",
    insights: { list: "/ledger/insights", detect: "/ledger/insights/detect", action: (id: string, action: string) => `/ledger/insights/${id}/${action}` },
};
