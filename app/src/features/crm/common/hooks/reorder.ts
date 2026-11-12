/** Put the items of `list` whose id is in `ids` in that order (others keep their place at the end) and renumber sort_order. */
export function reorderById<T extends { id: string; sort_order?: number }>(list: T[], ids: string[]): T[] {
    const pos = new Map(ids.map((id, i) => [id, i]));
    return [...list]
        .sort((a, b) => (pos.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (pos.get(b.id) ?? Number.MAX_SAFE_INTEGER))
        .map((x, i) => (pos.has(x.id) ? { ...x, sort_order: i } : x));
}
