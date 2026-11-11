import { homeApp } from "./modules/home.app";
import { projectsApp } from "./modules/projects.app";
import { tasksApp } from "./modules/tasks.app";
import { timeApp } from "./modules/time.app";
import { calendarApp } from "./modules/calendar.app";
import { crmApp } from "./modules/crm.app";
import { proposalsApp } from "./modules/proposals.app";
import { contractsApp } from "./modules/contracts.app";
import { clientPortalApp } from "./modules/client-portal.app";
import { messagesApp } from "./modules/messages.app";
import { supportApp } from "./modules/support.app";
import { campaignsApp } from "./modules/campaigns.app";
import { billingApp } from "./modules/billing.app";
import { expensesApp } from "./modules/expenses.app";
import { peopleApp } from "./modules/people.app";
import { docsApp } from "./modules/docs.app";
import { filesApp } from "./modules/files.app";
import { notificationsApp } from "./modules/notifications.app";
import { automationApp } from "./modules/automation.app";
import { adminApp } from "./modules/admin.app";
import type { AppDefinition } from "./app.types";

/** Rail order (app/mockups/core/apps.js). One line per app. */
export const APPS: AppDefinition[] = [
    homeApp,
    projectsApp,
    tasksApp,
    timeApp,
    calendarApp,
    crmApp,
    proposalsApp,
    contractsApp,
    clientPortalApp,
    messagesApp,
    supportApp,
    campaignsApp,
    billingApp,
    expensesApp,
    peopleApp,
    docsApp,
    filesApp,
    notificationsApp,
    automationApp,
    adminApp,
];

export const appById = (id: string) => APPS.find((a) => a.id === id);

/** App whose basePath matches the pathname (longest prefix wins). */
export const appForPath = (pathname: string) =>
    [...APPS].sort((a, b) => b.basePath.length - a.basePath.length).find((a) => pathname === a.basePath || pathname.startsWith(a.basePath + "/"));
