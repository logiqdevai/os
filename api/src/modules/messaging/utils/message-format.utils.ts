/**
 * Message body format (Markdown). Mentions are written as `@[Display name](<membership uuid>)` so the body stays readable and
 * renders without a lookup; `@channel`, `@here` and `@everyone` notify every member of the channel.
 */
export const MENTION_TOKEN = /@\[([^\]\n]{1,100})\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;
export const BROADCAST_TOKEN = /(^|[\s(])@(channel|here|everyone)\b/i;
const URL_TOKEN = /https?:\/\/[^\s<>()]+/i;

export interface ParsedBody {
    plain: string;
    mentioned_membership_ids: string[];
    broadcast: boolean;
    has_links: boolean;
}

export function parseBody(body: string): ParsedBody {
    const ids = new Set<string>();
    for (const match of body.matchAll(MENTION_TOKEN)) ids.add(match[2].toLowerCase());
    const plain = body
        .replace(MENTION_TOKEN, (_m, name: string) => `@${name}`)
        .replace(/```[a-z]*\n?/gi, '')
        .replace(/[*_~`]/g, '')
        .trim();
    return { plain, mentioned_membership_ids: [...ids], broadcast: BROADCAST_TOKEN.test(body), has_links: URL_TOKEN.test(body) };
}

/** Short preview for notifications and event payloads. */
export const preview = (plain: string, max = 140) => (plain.length > max ? `${plain.slice(0, max - 1)}…` : plain);

export function slugifyChannel(name: string) {
    return name
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/^#/, '')
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80);
}
