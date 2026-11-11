import type { ChannelKind, ChannelMemberRole, CreatableChannelKind, PresenceState } from "@/features/messaging/interfaces/messaging.interfaces";

export const ChannelKindFormOptions: { id: ChannelKind; label: string }[] = [
    { id: "PUBLIC", label: "Public channel" },
    { id: "PRIVATE", label: "Private channel" },
    { id: "DIRECT", label: "Direct message" },
    { id: "GROUP_DIRECT", label: "Group message" },
    { id: "PROJECT", label: "Project channel" },
    { id: "CUSTOMER", label: "Client channel" },
    { id: "ANNOUNCEMENT", label: "Announcements" },
    { id: "RECORD", label: "Record conversation" },
];

export const CreatableChannelKindOptions: { id: CreatableChannelKind; label: string; description: string }[] = [
    { id: "PUBLIC", label: "Public", description: "Anyone in the organization can find and join it." },
    { id: "PRIVATE", label: "Private", description: "Only invited members can see it." },
];

export const ChannelMemberRoleOptions: { id: ChannelMemberRole; label: string }[] = [
    { id: "OWNER", label: "Owner" },
    { id: "ADMIN", label: "Admin" },
    { id: "MEMBER", label: "Member" },
    { id: "GUEST", label: "Guest" },
    { id: "EXTERNAL", label: "External" },
    { id: "READ_ONLY", label: "Read only" },
];

export const PresenceStateOptions: { id: PresenceState; label: string }[] = [
    { id: "ACTIVE", label: "Active" },
    { id: "AWAY", label: "Away" },
    { id: "DO_NOT_DISTURB", label: "Do not disturb" },
    { id: "OFFLINE", label: "Offline" },
];

/** Quick reactions offered on hover. */
export const QuickReactionOptions: { id: string; label: string }[] = [
    { id: "👍", label: "Thumbs up" },
    { id: "❤️", label: "Heart" },
    { id: "😂", label: "Laugh" },
    { id: "🎉", label: "Party" },
    { id: "👀", label: "Eyes" },
    { id: "✅", label: "Done" },
    { id: "🙏", label: "Thanks" },
    { id: "🔥", label: "Fire" },
];
