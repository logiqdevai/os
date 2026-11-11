import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodError, ZodType } from 'zod';

/**
 * Validates a request body with the SAME zod schema the MCP tool uses (roles-and-permissions rule §5: one validation for
 * every channel). Error message names the first failing field so the UI can show it directly.
 */
@Injectable()
export class ZodBodyPipe implements PipeTransform {
    constructor(private readonly schema: ZodType) { }

    transform(value: unknown) {
        const parsed = this.schema.safeParse(value ?? {});
        if (parsed.success) return parsed.data;
        const issues = (parsed.error as ZodError).issues;
        const first = issues[0];
        const field = first?.path?.join('.') || 'body';
        throw new BadRequestException({
            message: `${field}: ${first?.message ?? 'invalid value'}`,
            code: 'validation_failed',
            errors: issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        });
    }
}

export const ZBody = (schema: ZodType) => new ZodBodyPipe(schema);
