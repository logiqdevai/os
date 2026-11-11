export const personName = (u: { display_name?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null } | null | undefined) =>
    u ? u.display_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || '' : '';
