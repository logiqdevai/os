import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

/** ModuleKey values from the Prisma schema (enum ModuleKey). */
export type ModuleKey =
    | "CRM"
    | "PROPOSALS"
    | "CONTRACTS"
    | "PROJECTS"
    | "TASKS"
    | "CUSTOMER_PORTAL"
    | "FINANCE"
    | "INCOME_EXPENSE"
    | "EMPLOYEES"
    | "COMMUNICATION"
    | "MESSAGING"
    | "SUPPORT"
    | "NOTIFICATIONS"
    | "BUSINESS_DOCS"
    | "DOCUMENTS"
    | "TIME_TRACKING"
    | "CALENDAR"
    | "AUTOMATION"
    | "ADMINISTRATION";

export interface AppNavItem {
    label: string;
    /** Absolute route, e.g. `/crm/deals`. */
    to: string;
    icon?: LucideIcon;
    /** Show only when the caller holds at least one of these permission keys. */
    permissions?: string[];
    /** Match the route exactly (no nested highlighting). */
    end?: boolean;
}

export interface AppNavSection {
    label?: string;
    items: AppNavItem[];
}

/**
 * One rail entry = one product area (app/mockups/core/apps.js). Visible only when the module is enabled
 * and the caller holds at least one `viewPermissions` key.
 */
export interface AppDefinition {
    id: string;
    label: string;
    icon: LucideIcon;
    /** Route prefix, e.g. `/crm`. */
    basePath: string;
    module?: ModuleKey;
    /** Any of these grants access to the app. Empty = every signed-in member. */
    viewPermissions: string[];
    /** Primary action in the app bar. */
    newAction?: { label: string; to: string; permission?: string };
    /** Draw a separator above this entry on the rail. */
    separatorBefore?: boolean;
    /** Not listed on the rail (Admin is reached from the gear). */
    hidden?: boolean;
    /** The app owns its own scrolling (Messages, Support inbox). */
    fill?: boolean;
    /** The app renders its own sidebar (Messages channel list): the shell hides its context panel on desktop.
     *  `nav` is still used by the command palette and the mobile navigation sheet. */
    ownSidebar?: boolean;
    nav: AppNavSection[];
    /** Dynamic entries rendered under `nav` in the context panel and the mobile sheet (e.g. the caller's saved views). */
    navExtra?: ComponentType<{ onNavigate?: () => void }>;
}
