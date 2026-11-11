import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * Routes outside the agency shell: the customer portal (`/portal/*`, its own shell, 07), public signing pages,
 * public proposal links, booking pages, forms. Each module adds one line here, e.g.
 */
export const PUBLIC_ROUTES: { path: string; Component: LazyExoticComponent<ComponentType> }[] = [
    { path: "/print/invoices/:id", Component: lazy(() => import("@/pages/billing/print/invoice-print")) },
    { path: "/book/:orgSlug/:slug", Component: lazy(() => import("@/pages/calendar/public/booking-page")) },
];
