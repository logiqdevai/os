import { AdminApiRoutes } from "./modules/admin.routes";
import { CrmApiRoutes } from "./modules/crm.routes";
import { ProjectsApiRoutes } from "./modules/projects.routes";
import { TasksApiRoutes } from "./modules/tasks.routes";
import { ContractsApiRoutes } from "./modules/contracts.routes";
import { TimeApiRoutes } from "./modules/time.routes";
import { PeopleApiRoutes } from "./modules/people.routes";
import { MessagingApiRoutes } from "./modules/messaging.routes";
import { ProposalsApiRoutes } from "./modules/proposals.routes";
import { CommunicationsApiRoutes } from "./modules/communications.routes";
import { AutomationApiRoutes } from "./modules/automation.routes";
import { DocsApiRoutes } from "./modules/docs.routes";
import { FilesApiRoutes } from "./modules/files.routes";
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
        photo: "/auth/me/photo",
        appearance: "/auth/me/appearance",
        logout: "/auth/logout",
        sessions: "/auth/sessions",
        session: (id: string) => `/auth/sessions/${id}`,
        switch_organization: (id: string) => `/auth/switch-organization/${id}`,
        organizations: "/auth/organizations",
        invitation: (token: string) => `/auth/invitations/${token}`,
        accept_invitation: "/auth/invitations/accept",
        mfa: {
            status: "/auth/mfa",
            verify: "/auth/mfa/verify",
            totp_setup: "/auth/mfa/totp/setup",
            totp_confirm: "/auth/mfa/totp/confirm",
            recovery_codes: "/auth/mfa/recovery-codes",
            disable: "/auth/mfa/disable",
        },
    },
    mcp: { tools: "/mcp/tools" },
    admin: AdminApiRoutes,
    projects: ProjectsApiRoutes,
    tasks: TasksApiRoutes,
    contracts: ContractsApiRoutes,
    time: TimeApiRoutes,
    people: PeopleApiRoutes,
    messaging: MessagingApiRoutes,
    proposals: ProposalsApiRoutes,
    communications: CommunicationsApiRoutes,
    crm: CrmApiRoutes,
    automation: AutomationApiRoutes,
    docs: DocsApiRoutes,
    files: FilesApiRoutes,
    notifications: NotificationsApiRoutes,
    calendar: CalendarApiRoutes,
    billing: BillingApiRoutes,
    expenses: ExpensesApiRoutes,
    support: SupportApiRoutes,
    portal: PortalApiRoutes,
};
