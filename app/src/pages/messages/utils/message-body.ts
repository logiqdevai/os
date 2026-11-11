/** Mention token stored in the body: `@[Display name](<membership uuid>)` (api/src/modules/messaging/utils/message-format.utils.ts). */
export const MENTION_TOKEN = /@\[([^\]\n]{1,100})\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

export type MentionMap = Record<string, string>;

/** Body with tokens → editable text with `@Name`, plus the name → membership id map to convert back. */
export function tokensToText(body: string): { text: string; mentions: MentionMap } {
    const mentions: MentionMap = {};
    const text = body.replace(MENTION_TOKEN, (_m, name: string, id: string) => {
        mentions[name] = id;
        return `@${name}`;
    });
    return { text, mentions };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Editable text → body: each known `@Name` becomes a mention token (longest names first). */
export function textToTokens(text: string, mentions: MentionMap): string {
    let out = text;
    for (const name of Object.keys(mentions).sort((a, b) => b.length - a.length)) {
        out = out.replace(new RegExp(`(^|[^\\w\\[])@${escapeRe(name)}(?![\\w])`, "g"), (_m, pre: string) => `${pre}@[${name}](${mentions[name]})`);
    }
    return out;
}

export type BodySegment =
    | { type: "text"; text: string }
    | { type: "mention"; name: string; id: string }
    | { type: "broadcast"; text: string }
    | { type: "link"; href: string }
    | { type: "code"; text: string }
    | { type: "bold"; text: string }
    | { type: "italic"; text: string };

const INLINE = /@\[([^\]\n]{1,100})\]\(([0-9a-f-]{36})\)|(^|\s)(@(?:channel|here|everyone))\b|(https?:\/\/[^\s<>()]+)|`([^`\n]+)`|\*\*([^*\n]+)\*\*|(?:^|(?<=\s))_([^_\n]+)_/gi;

/** Split a Markdown-lite body into renderable segments (no HTML is ever injected). */
export function parseBody(body: string): BodySegment[] {
    const out: BodySegment[] = [];
    let last = 0;
    for (const m of body.matchAll(INLINE)) {
        const start = m.index ?? 0;
        let matchStart = start;
        if (m[4]) {
            matchStart = start + (m[3]?.length ?? 0);
        }
        if (matchStart > last) out.push({ type: "text", text: body.slice(last, matchStart) });
        if (m[1]) out.push({ type: "mention", name: m[1], id: m[2] });
        else if (m[4]) out.push({ type: "broadcast", text: m[4] });
        else if (m[5]) out.push({ type: "link", href: m[5] });
        else if (m[6]) out.push({ type: "code", text: m[6] });
        else if (m[7]) out.push({ type: "bold", text: m[7] });
        else if (m[8]) out.push({ type: "italic", text: m[8] });
        last = start + m[0].length;
    }
    if (last < body.length) out.push({ type: "text", text: body.slice(last) });
    return out;
}
