import { NotificationDigestStatus } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

/**
 * 14 §5 — browser push registration. The app sends the PushSubscription it got from `pushManager.subscribe()` with the
 * deployment's VAPID public key. Only WEB is accepted here: mobile / desktop apps (APNs, FCM) have no provider yet.
 */
export const RegisterPushDeviceSchema = z.object({
    platform: z.literal('WEB').default('WEB'),
    subscription: z.object({
        endpoint: z.string().url().max(2000).refine((v) => v.startsWith('https://'), 'Push endpoints are https URLs'),
        expirationTime: z.number().nullable().optional(),
        keys: z.object({ p256dh: z.string().min(16).max(200), auth: z.string().min(8).max(100) }),
    }),
    device_name: z.string().trim().max(120).nullable().optional(),
    app_version: z.string().trim().max(40).nullable().optional(),
    locale: z.string().trim().max(20).nullable().optional(),
});
export type RegisterPushDeviceInput = z.infer<typeof RegisterPushDeviceSchema>;

export const PushDeviceIdSchema = z.object({ id: z.string().uuid() });

/** Own digest history (mockup 14 "Quiet hours and digests"). */
export const MyDigestQuerySchema = BaseListQuerySchema.extend({
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.nativeEnum(NotificationDigestStatus).optional(),
});
export type MyDigestQuery = z.infer<typeof MyDigestQuerySchema>;
