import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

/** Deep-convert BigInt (file sizes) to numbers so responses serialize as JSON. Dates and buffers stay as they are. */
export function plain<T>(value: T): T {
    if (typeof value === 'bigint') return Number(value) as unknown as T;
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((v) => plain(v)) as unknown as T;
    // Only plain objects are walked (Prisma rows); Dates, Buffers, StreamableFile, Decimal stay untouched.
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = plain(v);
    return out as T;
}

/** Applies `plain()` to every controller response of this module. */
@Injectable()
export class BigIntInterceptor implements NestInterceptor {
    intercept(_: ExecutionContext, next: CallHandler): Observable<unknown> {
        return next.handle().pipe(map((data) => plain(data)));
    }
}

/** Shared `select` for a membership with its user (owner, author, approver). */
export const MEMBER_SELECT = {
    id: true,
    job_title: true,
    user: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true, profile_photo_url: true } },
} as const;
