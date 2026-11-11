import { AdminApiRoutes } from "./modules/admin.routes";
import { CrmApiRoutes } from "./modules/crm.routes";
import { NotificationsApiRoutes } from "./modules/notifications.routes";
import { CalendarApiRoutes } from "./modules/calendar.routes";

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
    crm: CrmApiRoutes,
    notifications: NotificationsApiRoutes,
    calendar: CalendarApiRoutes,
};
