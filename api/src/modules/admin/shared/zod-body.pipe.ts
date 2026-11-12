import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodError, ZodType } from 'zod';

/**
 * Validates a request BODY with the same zod schema the MCP tool uses (one schema, two adapters).
 * Usage: `@Body(AdminBody(UpdateSecurityPolicySchema)) dto: UpdateSecurityPolicyInput`.
 */
@Injectable()
export class AdminZodBodyPipe implements PipeTransform {
    constructor(private readonly schema: ZodType) { }

    transform(value: unknown) {
        try {
            return this.schema.parse(value ?? {});
        } catch (error) {
            if (error instanceof ZodError) {
                throw new BadRequestException({
                    message: error.issues[0]?.message ?? 'Validation failed',
                    code: 'validation_failed',
                    errors: error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
                });
            }
            throw new BadRequestException({ message: 'Invalid request body', code: 'validation_failed' });
        }
    }
}

export const AdminBody = (schema: ZodType) => new AdminZodBodyPipe(schema);
