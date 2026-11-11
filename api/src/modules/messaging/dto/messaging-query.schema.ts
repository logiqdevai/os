import { z } from 'zod';
import { BaseListQuerySchema, boolish } from '@/shared/utils/pagination/pagination.utils';

/** Browse discoverable channels. */
export const BrowseChannelsQuerySchema = BaseListQuerySchema.extend({
    archived: boolish,
});
export type BrowseChannelsQuery = z.infer<typeof BrowseChannelsQuerySchema>;

/** Cursor pagination over a channel's (or a thread's) messages. `before`/`after` are message ids. Results are oldest → newest. */
export const MessageListQuerySchema = z.object({
    before: z.string().uuid().optional(),
    after: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});
export type MessageListQuery = z.infer<typeof MessageListQuerySchema>;

export const SearchMessagesQuerySchema = z.object({
    q: z.string().trim().min(2).max(200),
    channel_id: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(25),
});
export type SearchMessagesQuery = z.infer<typeof SearchMessagesQuerySchema>;

export const DirectoryQuerySchema = z.object({
    search: z.string().trim().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});
export type DirectoryQuery = z.infer<typeof DirectoryQuerySchema>;

export const InboxQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(30),
    unread: boolish,
});
export type InboxQuery = z.infer<typeof InboxQuerySchema>;

export const PresenceQuerySchema = z.object({
    membership_ids: z.preprocess((v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v), z.array(z.string().uuid()).max(200)).optional(),
});
export type PresenceQuery = z.infer<typeof PresenceQuerySchema>;
