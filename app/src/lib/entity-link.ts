/** In-app route of a record referenced by an activity row (null when the module has no detail page yet). */
export function entityLink(entityType: string | null | undefined, entityId: string | null | undefined): string | null {
    if (!entityType || !entityId) return null;
    switch (entityType) {
        case "PROJECT":
            return `/projects/${entityId}`;
        case "TASK":
            return `/tasks/${entityId}`;
        case "CALENDAR_EVENT":
            return `/calendar/events/${entityId}`;
        case "CALENDAR_BOOKING":
            return `/calendar/bookings/${entityId}`;
        case "CRM_COMPANY":
            return `/crm/companies/${entityId}`;
        case "CRM_CONTACT":
            return `/crm/contacts/${entityId}`;
        case "CRM_DEAL":
            return `/crm/deals/${entityId}`;
        case "CRM_LEAD":
            return `/crm/leads/${entityId}`;
        case "PROPOSAL":
            return `/proposals/${entityId}`;
        case "CONTRACT":
            return `/contracts/${entityId}`;
        case "TICKET":
            return `/support/tickets/${entityId}`;
        case "WIKI_PAGE":
            return `/docs/pages/${entityId}`;
        default:
            return null;
    }
}
