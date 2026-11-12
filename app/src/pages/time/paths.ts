/** Front-end paths of the Time app. */
export const TimePaths = {
    week: "/time",
    entries: "/time/entries",
    newEntry: "/time/new",
    team: "/time/team",
    approvals: "/time/approvals",
    timesheet: (id: string) => `/time/timesheets/${id}`,
    rates: "/time/rates",
    reports: "/time/reports",
    unbilled: "/time/unbilled",
    settings: "/time/settings",
    suggestions: "/time/suggestions",
    import: "/time/import",
    schedules: "/time/schedules",
    projectSettings: "/time/projects",
} as const;
