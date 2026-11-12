import { useBrowseChannels, useMyChannels } from "@/features/messaging/hooks/use-messaging";
import type { MultiPickerItem } from "@/components/ui/multi-picker";

/** Channels for admin pickers: my channels (incl. private / DMs I am in) + all public channels. */
export function useChannelOptions(includeDms = false): { items: MultiPickerItem[]; loading: boolean } {
    const mine = useMyChannels();
    const browse = useBrowseChannels({ limit: 200 });
    const map = new Map<string, MultiPickerItem>();
    for (const c of mine.data?.data ?? []) {
        if (!includeDms && (c.kind === "DIRECT" || c.kind === "GROUP_DIRECT")) continue;
        map.set(c.id, { id: c.id, label: c.kind === "DIRECT" || c.kind === "GROUP_DIRECT" ? c.label : `#${c.name ?? c.label}` });
    }
    for (const c of browse.data?.data ?? []) if (!map.has(c.id)) map.set(c.id, { id: c.id, label: `#${c.name}` });
    return { items: [...map.values()].sort((a, b) => a.label.localeCompare(b.label)), loading: mine.isPending || browse.isPending };
}
