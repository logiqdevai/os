/** Front-end paths of the People app (one place, no string literals in pages). */
export const PeoplePaths = {
    root: "/people",
    dashboard: "/people/dashboard",
    directory: "/people/directory",
    orgChart: "/people/org-chart",
    create: "/people/new",
    employee: (id: string, tab?: string) => `/people/employees/${id}${tab ? `?tab=${tab}` : ""}`,
    me: "/people/me",
    changes: "/people/changes",
    leave: "/people/leave",
    leaveCalendar: "/people/leave/calendar",
    balances: "/people/leave/balances",
    attendance: "/people/attendance",
    capacity: "/people/capacity",
    skills: "/people/skills",
    performance: "/people/performance",
    review: (id: string) => `/people/performance/reviews/${id}`,
} as const;
