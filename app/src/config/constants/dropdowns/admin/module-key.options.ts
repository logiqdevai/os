import type { ModuleKey } from "@/config/apps/app.types";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** ModuleKey labels (01 §56). */
export const ModuleKeyOptions: DropdownOption<ModuleKey>[] = [
    { id: "CRM", label: "CRM" },
    { id: "PROPOSALS", label: "Proposals" },
    { id: "CONTRACTS", label: "Contracts" },
    { id: "PROJECTS", label: "Projects" },
    { id: "TASKS", label: "Tasks" },
    { id: "CUSTOMER_PORTAL", label: "Client portal" },
    { id: "FINANCE", label: "Billing & finance" },
    { id: "INCOME_EXPENSE", label: "Income & expenses" },
    { id: "EMPLOYEES", label: "People" },
    { id: "COMMUNICATION", label: "Campaigns" },
    { id: "MESSAGING", label: "Messages" },
    { id: "SUPPORT", label: "Support" },
    { id: "NOTIFICATIONS", label: "Notifications" },
    { id: "BUSINESS_DOCS", label: "Docs" },
    { id: "DOCUMENTS", label: "Files" },
    { id: "TIME_TRACKING", label: "Time" },
    { id: "CALENDAR", label: "Calendar" },
    { id: "AUTOMATION", label: "Automation" },
    { id: "ADMINISTRATION", label: "Administration" },
];

export const ModuleKeyFilterOptions: DropdownOption<ModuleKey | "all">[] = [{ id: "all", label: "All modules" }, ...ModuleKeyOptions];

/** Short description per module (Admin → Module access). */
export const ModuleKeyDescriptionOptions: { id: ModuleKey; description: string }[] = [
    { id: "CRM", description: "Companies, contacts, leads and deals." },
    { id: "PROPOSALS", description: "Proposals and quotes sent to clients." },
    { id: "CONTRACTS", description: "Contracts, signatures and renewals." },
    { id: "PROJECTS", description: "Projects, milestones and deliverables." },
    { id: "TASKS", description: "Tasks, cycles and boards." },
    { id: "CUSTOMER_PORTAL", description: "The portal your clients sign in to." },
    { id: "FINANCE", description: "Invoices, payments and subscriptions." },
    { id: "INCOME_EXPENSE", description: "Ledger, expenses and budgets." },
    { id: "EMPLOYEES", description: "Employee records, leave and payroll." },
    { id: "COMMUNICATION", description: "Email and SMS campaigns." },
    { id: "MESSAGING", description: "Internal channels and direct messages." },
    { id: "SUPPORT", description: "Tickets, inboxes and knowledge base." },
    { id: "NOTIFICATIONS", description: "In-app, email and push notifications." },
    { id: "BUSINESS_DOCS", description: "Wiki spaces and checklists." },
    { id: "DOCUMENTS", description: "Files, folders and the vault." },
    { id: "TIME_TRACKING", description: "Time entries and timesheets." },
    { id: "CALENDAR", description: "Calendars, bookings and resources." },
    { id: "AUTOMATION", description: "Rules, scheduled jobs and webhooks." },
    { id: "ADMINISTRATION", description: "This admin area. Always on." },
];

export const getModuleKeyDescription = (module: string) => ModuleKeyDescriptionOptions.find((o) => o.id === module)?.description ?? "";
