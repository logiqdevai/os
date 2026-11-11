import { z } from 'zod';

/** Base list query: extend it in each feature's `<feature>-query.schema.ts`. */
export const BaseListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(200).optional().default(25),
    search: z.string().trim().optional(),
    order_by: z.string().optional(),
    order_direction: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type BaseListQuery = z.infer<typeof BaseListQuerySchema>;

export interface Paginated<T> {
    data: T[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        total_pages: number;
        has_next: boolean;
        has_prev: boolean;
    };
}

export function paginate<T>(data: T[], total: number, query: { page: number; limit: number }): Paginated<T> {
    const total_pages = Math.max(1, Math.ceil(total / query.limit));
    return {
        data,
        pagination: {
            total,
            page: query.page,
            limit: query.limit,
            total_pages,
            has_next: query.page < total_pages,
            has_prev: query.page > 1,
        },
    };
}

export const skipTake = (query: { page: number; limit: number }) => ({ skip: (query.page - 1) * query.limit, take: query.limit });

/** Safe order-by: only allow listed columns. */
export function orderBy(query: { order_by?: string; order_direction?: 'asc' | 'desc' }, allowed: string[], fallback = 'created_at') {
    const column = query.order_by && allowed.includes(query.order_by) ? query.order_by : fallback;
    return { [column]: query.order_direction ?? 'desc' };
}

/** Comma-separated query value → array (e.g. `status=OPEN,WON`). */
export const csv = <T extends z.ZodTypeAny>(item: T) =>
    z.preprocess((v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v), z.array(item)).optional();

export const boolish = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean()).optional();
