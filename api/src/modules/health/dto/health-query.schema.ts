import { z } from 'zod';

export const HealthQuerySchema = z
    .object({
        postgres: z
            .string()
            .optional()
            .transform((value) => value === 'true' || value === '1'),
        redis: z
            .string()
            .optional()
            .transform((value) => value === 'true' || value === '1'),
    })
    .superRefine((data, context) => {
        if (data.postgres && data.redis) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                    'Only one health check query parameter can be provided at a time',
            });
        }
    });

export type HealthQueryType = z.infer<typeof HealthQuerySchema>;
