import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * One entry per product area. Each `pages/<area>/routes.tsx` default-exports a component that renders its own
 * nested <Routes> (paths relative to the area). Lazy-loaded so every area is its own chunk. One line per area.
 */
export const MODULE_ROUTES: { path: string; Component: LazyExoticComponent<ComponentType> }[] = [
    { path: "home/*", Component: lazy(() => import("@/pages/home/routes")) },
    { path: "projects/*", Component: lazy(() => import("@/pages/projects/routes")) },
    { path: "tasks/*", Component: lazy(() => import("@/pages/tasks/routes")) },
    { path: "time/*", Component: lazy(() => import("@/pages/time/routes")) },
    { path: "calendar/*", Component: lazy(() => import("@/pages/calendar/routes")) },
    { path: "crm/*", Component: lazy(() => import("@/pages/crm/routes")) },
    { path: "proposals/*", Component: lazy(() => import("@/pages/proposals/routes")) },
    { path: "contracts/*", Component: lazy(() => import("@/pages/contracts/routes")) },
    { path: "client-portal/*", Component: lazy(() => import("@/pages/client-portal/routes")) },
    { path: "messages/*", Component: lazy(() => import("@/pages/messages/routes")) },
    { path: "support/*", Component: lazy(() => import("@/pages/support/routes")) },
    { path: "campaigns/*", Component: lazy(() => import("@/pages/campaigns/routes")) },
    { path: "billing/*", Component: lazy(() => import("@/pages/billing/routes")) },
    { path: "expenses/*", Component: lazy(() => import("@/pages/expenses/routes")) },
    { path: "people/*", Component: lazy(() => import("@/pages/people/routes")) },
    { path: "docs/*", Component: lazy(() => import("@/pages/docs/routes")) },
    { path: "files/*", Component: lazy(() => import("@/pages/files/routes")) },
    { path: "notifications/*", Component: lazy(() => import("@/pages/notifications/routes")) },
    { path: "automation/*", Component: lazy(() => import("@/pages/automation/routes")) },
    { path: "admin/*", Component: lazy(() => import("@/pages/admin/routes")) },
    { path: "settings/*", Component: lazy(() => import("@/pages/settings/routes")) },
];
