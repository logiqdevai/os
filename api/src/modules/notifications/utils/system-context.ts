import { AccessChannel, OrgContext } from '@/shared/authorization/interfaces/org-context.interface';

/**
 * Context for background jobs and public endpoints (scheduled announcements, calendar reminders, public bookings):
 * the organization comes from the record being processed, never from input. Holds no permissions.
 */
export function systemContext(organization_id: string, membership_id: string | null = null, channel: AccessChannel = 'automation'): OrgContext {
    return {
        organization_id,
        user_id: null,
        membership_id,
        service_account_id: null,
        api_key_id: null,
        actor_type: 'SYSTEM',
        channel,
        effective: { permissions: {}, modules: [] },
        can: () => false,
        scopeOf: () => null,
    };
}

/** `tasks.task.assigned` → "Task assigned". */
export function humanizeEventKey(key: string) {
    const parts = key.split('.');
    const tail = parts.slice(-2).join(' ').replace(/_/g, ' ');
    return tail.charAt(0).toUpperCase() + tail.slice(1);
}

export const memberUserSelect = { id: true, email: true, display_name: true, first_name: true, last_name: true, profile_photo_url: true } as const;

export function displayName(u: { display_name?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null } | null | undefined) {
    if (!u) return 'Someone';
    return u.display_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'Someone';
}
