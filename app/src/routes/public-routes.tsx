import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * Routes outside the agency shell: the customer portal (`/portal/*`, its own shell, 07), public signing pages,
 * public proposal links, booking pages, forms. Each module adds one line here, e.g.
 *   { path: "/portal/*", Component: lazy(() => import("@/pages/portal/routes")) },
 */
export const PUBLIC_ROUTES: { path: string; Component: LazyExoticComponent<ComponentType> }[] = [
    { path: "/p/:token", Component: lazy(() => import("@/pages/proposals/public/public-proposal-page")) },
    { path: "/sign/:token", Component: lazy(() => import("@/pages/contracts/public/sign-page")) },
    { path: "/print/invoices/:id", Component: lazy(() => import("@/pages/billing/print/invoice-print")) },
    { path: "/book/:orgSlug/:slug", Component: lazy(() => import("@/pages/calendar/public/booking-page")) },
    { path: "/portal/*", Component: lazy(() => import("@/pages/portal/routes")) },
];
