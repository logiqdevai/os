import { z } from 'zod';
import { McpToolCallStatus } from 'generated/prisma';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

export const McpCallQuerySchema = BaseListQuerySchema.extend({
    status: z.nativeEnum(McpToolCallStatus).optional(),
    tool_name: z.string().max(120).optional(),
    service_account_id: z.string().uuid().optional(),
    api_key_id: z.string().uuid().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
});
export type McpCallQuery = z.infer<typeof McpCallQuerySchema>;
