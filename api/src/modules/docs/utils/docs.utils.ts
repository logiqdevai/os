import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';

/** Plain text from markdown (for excerpts, word counts and search snippets). */
export function markdownToText(md: string | null | undefined): string {
    if (!md) return '';
    return md
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`([^`]*)`/g, '$1')
        .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
        .replace(/\[\[([^\]]+)]]/g, '$1')
        .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
        .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
        .replace(/[*_~]{1,3}/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export const excerptOf = (md: string | null | undefined, max = 220) => {
    const text = markdownToText(md);
    return text.length > max ? `${text.slice(0, max - 1)}…` : text || null;
};

export const wordCount = (md: string | null | undefined) => {
    const text = markdownToText(md);
    return text ? text.split(' ').length : 0;
};

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Page references inside markdown: `/docs/pages/<id>` links and `[[Page title]]` wiki links. */
export function parsePageRefs(md: string | null | undefined): { ids: string[]; titles: string[] } {
    if (!md) return { ids: [], titles: [] };
    const ids = new Set<string>();
    const titles = new Set<string>();
    for (const m of md.matchAll(new RegExp(`/docs/pages/(${UUID})`, 'gi'))) ids.add(m[1].toLowerCase());
    for (const m of md.matchAll(/\[\[([^\]|]{1,200})(?:\|[^\]]*)?]]/g)) titles.add(m[1].trim());
    return { ids: [...ids], titles: [...titles] };
}

/** Context for public (unauthenticated) actions such as an anonymous public form submission. */
export function publicContext(organizationId: string, meta: { ip?: string | null; user_agent?: string | null } = {}): OrgContext {
    return {
        organization_id: organizationId,
        user_id: null,
        membership_id: null,
        service_account_id: null,
        api_key_id: null,
        actor_type: 'SYSTEM',
        channel: 'api',
        ip_address: meta.ip ?? null,
        user_agent: meta.user_agent ?? null,
        effective: { permissions: {}, modules: [] },
        can: () => false,
        scopeOf: () => null,
    };
}

export const MEMBER_SELECT = {
    id: true,
    job_title: true,
    user: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true, profile_photo_url: true } },
} as const;
