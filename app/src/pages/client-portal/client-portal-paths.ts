/** Frontend paths of the agency-side Client portal app (07). The customer-facing portal lives under /portal. */
export const CLIENT_PORTAL_PATHS = {
    overview: "/client-portal",
    clients: "/client-portal/clients",
    client: (companyId: string) => `/client-portal/clients/${companyId}`,
    users: "/client-portal/users",
    invite: "/client-portal/users/invite",
    requests: "/client-portal/requests",
    approvals: "/client-portal/approvals",
    profileChanges: "/client-portal/profile-changes",
    activity: "/client-portal/activity",
    settings: "/client-portal/settings",
    customerPortal: "/portal",
} as const;
