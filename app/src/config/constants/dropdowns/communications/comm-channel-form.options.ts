import type { CommChannel } from "@/features/communications/interfaces/communications.interfaces";

export const CommChannelFormOptions: { id: CommChannel; label: string }[] = [
    { id: "EMAIL", label: "Email" },
    { id: "SMS", label: "SMS" },
];

export const CommChannelFilterOptions: { id: CommChannel | "all"; label: string }[] = [{ id: "all", label: "All channels" }, ...CommChannelFormOptions];
