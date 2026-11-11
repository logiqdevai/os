import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    BrowseChannel, ChannelDetail, ChannelMemberRow, CreateChannelDto, DirectoryMember, Draft, MentionItem, Message, MessagePage, MessageWithChannel, MyChannel,
    Paginated, PostMessageDto, Presence, ReactionGroup, SavedItem, ThreadInboxItem, ThreadResponse, UpdateChannelDto,
} from "../interfaces/messaging.interfaces";

const R = () => ApiRoutes.messaging;

export const getMyChannels = async (): Promise<{ data: MyChannel[] }> => (await axiosInstance.get(R().channels.mine)).data;
export const browseChannels = async (params: Record<string, unknown>): Promise<Paginated<BrowseChannel>> => (await axiosInstance.get(R().channels.browse, { params })).data;
export const getChannel = async (id: string): Promise<ChannelDetail> => (await axiosInstance.get(R().channels.detail(id))).data;
export const createChannel = async (dto: CreateChannelDto): Promise<ChannelDetail> => (await axiosInstance.post(R().channels.mine, dto)).data;
export const updateChannel = async ({ id, ...dto }: UpdateChannelDto & { id: string }): Promise<ChannelDetail> => (await axiosInstance.patch(R().channels.detail(id), dto)).data;
export const setChannelArchived = async ({ id, archived }: { id: string; archived: boolean }): Promise<ChannelDetail> =>
    (await axiosInstance.post(archived ? R().channels.archive(id) : R().channels.unarchive(id))).data;
export const joinChannel = async (id: string): Promise<ChannelDetail> => (await axiosInstance.post(R().channels.join(id))).data;
export const leaveChannel = async (id: string) => (await axiosInstance.post(R().channels.leave(id))).data;
export const getChannelMembers = async (id: string): Promise<{ data: ChannelMemberRow[] }> => (await axiosInstance.get(R().channels.members(id))).data;
export const addChannelMembers = async ({ id, membership_ids }: { id: string; membership_ids: string[] }): Promise<{ data: ChannelMemberRow[] }> =>
    (await axiosInstance.post(R().channels.members(id), { membership_ids })).data;
export const removeChannelMember = async ({ id, member_id }: { id: string; member_id: string }) => (await axiosInstance.delete(R().channels.member(id, member_id))).data;
export const updateChannelPreferences = async ({ id, ...dto }: { id: string; is_favorite?: boolean; muted_until?: string | null }) =>
    (await axiosInstance.patch(R().channels.preferences(id), dto)).data;
export const openDm = async (membership_ids: string[]): Promise<ChannelDetail> => (await axiosInstance.post(R().dms, { membership_ids })).data;

export const getMessages = async (channelId: string, params: { before?: string; after?: string; limit?: number }): Promise<MessagePage> =>
    (await axiosInstance.get(R().channels.messages(channelId), { params })).data;
export const postMessage = async ({ channelId, ...dto }: PostMessageDto & { channelId: string }): Promise<Message> => (await axiosInstance.post(R().channels.messages(channelId), dto)).data;
export const editMessage = async ({ id, body }: { id: string; body: string }): Promise<Message> => (await axiosInstance.patch(R().messages.detail(id), { body })).data;
export const deleteMessage = async (id: string) => (await axiosInstance.delete(R().messages.detail(id))).data;
export const getThread = async (id: string): Promise<ThreadResponse> => (await axiosInstance.get(R().messages.thread(id))).data;
export const markThreadRead = async (id: string) => (await axiosInstance.post(R().messages.thread_read(id))).data;
export const setThreadFollow = async ({ id, follow }: { id: string; follow: boolean }) =>
    (follow ? await axiosInstance.put(R().messages.follow(id)) : await axiosInstance.delete(R().messages.follow(id))).data;
export const toggleReaction = async ({ id, emoji }: { id: string; emoji: string }): Promise<{ added: boolean; reactions: ReactionGroup[] }> =>
    (await axiosInstance.post(R().messages.reactions(id), { emoji })).data;
export const setPinned = async ({ id, pinned }: { id: string; pinned: boolean }): Promise<Message> =>
    (pinned ? await axiosInstance.put(R().messages.pin(id)) : await axiosInstance.delete(R().messages.pin(id))).data;
export const setSaved = async ({ id, saved }: { id: string; saved: boolean }): Promise<{ message_id: string; is_saved: boolean }> =>
    (saved ? await axiosInstance.put(R().messages.save(id), {}) : await axiosInstance.delete(R().messages.save(id))).data;
export const getPins = async (channelId: string): Promise<{ data: Message[] }> => (await axiosInstance.get(R().channels.pins(channelId))).data;
export const markChannelRead = async ({ id, message_id }: { id: string; message_id?: string }) => (await axiosInstance.post(R().channels.read(id), { message_id })).data;

export const getDraft = async (channelId: string, threadRootId?: string): Promise<Draft | null> =>
    (await axiosInstance.get(R().channels.draft(channelId), { params: { thread_root_message_id: threadRootId } })).data || null;
export const saveDraft = async ({ channelId, body, thread_root_message_id }: { channelId: string; body: string; thread_root_message_id?: string }) =>
    (await axiosInstance.put(R().channels.draft(channelId), { body, thread_root_message_id })).data;

export const searchMessages = async (params: { q: string; channel_id?: string }): Promise<{ data: MessageWithChannel[] }> => (await axiosInstance.get(R().search, { params })).data;
export const getThreadsInbox = async (): Promise<{ data: ThreadInboxItem[] }> => (await axiosInstance.get(R().threads)).data;
export const getMentions = async (): Promise<{ data: MentionItem[] }> => (await axiosInstance.get(R().mentions)).data;
export const markMentionsRead = async () => (await axiosInstance.post(R().mentions_read)).data;
export const getSaved = async (): Promise<{ data: SavedItem[] }> => (await axiosInstance.get(R().saved)).data;
export const getDirectory = async (search?: string): Promise<{ data: DirectoryMember[] }> => (await axiosInstance.get(R().directory, { params: { search, limit: 100 } })).data;
export const getOnlinePresence = async (): Promise<{ data: Presence[] }> => (await axiosInstance.get(R().presence)).data;
export const updateMyPresence = async (dto: { manual_state?: string | null; status_text?: string | null; status_emoji?: string | null; status_expires_at?: string | null }): Promise<Presence> =>
    (await axiosInstance.put(R().presence_me, dto)).data;
