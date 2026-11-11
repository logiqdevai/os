/** Frontend paths of the customer-facing portal (07). */
export const PORTAL_PATHS = {
    home: "/portal",
    projects: "/portal/projects",
    project: (id: string) => `/portal/projects/${id}`,
    approvals: "/portal/approvals",
    requests: "/portal/requests",
    newRequest: "/portal/requests/new",
    request: (ref: string) => `/portal/requests/${ref}`,
    messages: "/portal/messages",
    message: (id: string) => `/portal/messages/${id}`,
    documents: "/portal/documents",
    agreements: "/portal/agreements",
    billing: "/portal/billing",
    help: "/portal/help",
    helpArticle: (slug: string) => `/portal/help/${slug}`,
    company: "/portal/company",
    signIn: "/auth/sign-in",
} as const;
