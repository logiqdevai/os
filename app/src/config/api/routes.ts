import { AdminApiRoutes } from "./modules/admin.routes";
import { CrmApiRoutes } from "./modules/crm.routes";
import { MessagingApiRoutes } from "./modules/messaging.routes";
import { CommunicationsApiRoutes } from "./modules/communications.routes";
import { NotificationsApiRoutes } from "./modules/notifications.routes";
import { CalendarApiRoutes } from "./modules/calendar.routes";
import { BillingApiRoutes } from "./modules/billing.routes";
import { ExpensesApiRoutes } from "./modules/expenses.routes";
import { SupportApiRoutes } from "./modules/support.routes";
import { PortalApiRoutes } from "./modules/portal.routes";

/**
 * Central API route map. Each module keeps its routes in `config/api/modules/<module>.routes.ts`
 * and is added here with one import line and one key.
 */
export const ApiRoutes = {
    health: { prefix: "/health" },
    auth: {
        login: "/auth/email/login",
        register: "/auth/email/register",
        forgot_password: "/auth/forgot-password",
        reset_password: "/auth/reset-password",
        me: "/auth/me",
        password: "/auth/me/password",
        preferences: "/auth/me/preferences",
        logout: "/auth/logout",
        sessions: "/auth/sessions",
        session: (id: string) => `/auth/sessions/${id}`,
        switch_organization: (id: string) => `/auth/switch-organization/${id}`,
        organizations: "/auth/organizations",
        invitation: (token: string) => `/auth/invitations/${token}`,
        accept_invitation: "/auth/invitations/accept",
    },
    mcp: { tools: "/mcp/tools" },
    admin: AdminApiRoutes,
    messaging: MessagingApiRoutes,
    communications: CommunicationsApiRoutes,
    crm: CrmApiRoutes,
    notifications: NotificationsApiRoutes,
    calendar: CalendarApiRoutes,
    billing: BillingApiRoutes,
    expenses: ExpensesApiRoutes,
    support: SupportApiRoutes,
    portal: PortalApiRoutes,
};
