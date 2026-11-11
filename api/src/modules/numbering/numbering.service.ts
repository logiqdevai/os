import { Injectable } from '@nestjs/common';
import { NumberResetPolicy, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';

/** Default prefixes per document type (organizations may add their own NumberSequence rows). */
export const NUMBER_PREFIXES = {
    proposal: 'PRO',
    contract: 'CTR',
    invoice: 'INV',
    credit_note: 'CN',
    ticket: 'TCK',
} as const;

export type NumberedEntity = keyof typeof NUMBER_PREFIXES | (string & {});

export interface AllocateNumberOptions {
    /** Override the default prefix for the entity type. */
    prefix?: string;
    reset_policy?: NumberResetPolicy;
    padding?: number;
    /** Date that decides the year (defaults to now). */
    date?: Date;
}

/**
 * Platform document numbering (NumberSequence) shared by 03 Proposals, 04 Contracts and 08 Billing.
 * `next()` must run inside the caller's transaction so a rolled-back create never burns a number twice;
 * the counter row is locked with an atomic increment, numbers are never reused.
 *
 * Format: `format` column when set (tokens {PREFIX} {YYYY} {YY} {####…} {N}), otherwise PREFIX-YYYY-0001
 * (or PREFIX-0001 when the sequence never resets).
 */
@Injectable()
export class NumberingService {
    constructor(private readonly prisma: PrismaService) { }

    async next(tx: Prisma.TransactionClient | null, organizationId: string, entityType: NumberedEntity, options: AllocateNumberOptions = {}): Promise<string> {
        const client = tx ?? this.prisma;
        const prefix = options.prefix ?? NUMBER_PREFIXES[entityType as keyof typeof NUMBER_PREFIXES] ?? entityType.slice(0, 3).toUpperCase();
        const resetPolicy = options.reset_policy ?? NumberResetPolicy.YEARLY;
        const year = resetPolicy === NumberResetPolicy.YEARLY ? (options.date ?? new Date()).getUTCFullYear() : null;

        // Prisma's compound unique cannot match a NULL year, so find-or-create explicitly, then increment atomically.
        let seq = await client.numberSequence.findFirst({ where: { organization_id: organizationId, entity_type: entityType, prefix, year } });
        if (!seq) {
            try {
                seq = await client.numberSequence.create({
                    data: { organization_id: organizationId, entity_type: entityType, prefix, year, reset_policy: resetPolicy, padding: options.padding ?? 4 },
                });
            } catch (error) {
                if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
                seq = await client.numberSequence.findFirstOrThrow({ where: { organization_id: organizationId, entity_type: entityType, prefix, year } });
            }
        }
        const updated = await client.numberSequence.update({ where: { id: seq.id }, data: { next_number: { increment: 1 } } });
        const n = updated.next_number - 1;
        return this.render(updated.format, prefix, year, n, updated.padding);
    }

    /** Preview the next number without allocating it (forms show "will be PRO-2026-0042"). */
    async peek(organizationId: string, entityType: NumberedEntity, options: AllocateNumberOptions = {}) {
        const prefix = options.prefix ?? NUMBER_PREFIXES[entityType as keyof typeof NUMBER_PREFIXES] ?? entityType.slice(0, 3).toUpperCase();
        const resetPolicy = options.reset_policy ?? NumberResetPolicy.YEARLY;
        const year = resetPolicy === NumberResetPolicy.YEARLY ? (options.date ?? new Date()).getUTCFullYear() : null;
        const seq = await this.prisma.numberSequence.findFirst({ where: { organization_id: organizationId, entity_type: entityType, prefix, year } });
        return this.render(seq?.format ?? null, prefix, year, seq?.next_number ?? 1, seq?.padding ?? options.padding ?? 4);
    }

    private render(format: string | null, prefix: string, year: number | null, n: number, padding: number) {
        const padded = String(n).padStart(padding, '0');
        if (!format) return year ? `${prefix}-${year}-${padded}` : `${prefix}-${padded}`;
        return format
            .replace(/\{PREFIX\}/g, prefix)
            .replace(/\{YYYY\}/g, year ? String(year) : '')
            .replace(/\{YY\}/g, year ? String(year).slice(-2) : '')
            .replace(/\{#+\}/g, (m) => String(n).padStart(m.length - 2, '0'))
            .replace(/\{N\}/g, String(n))
            .replace(/--+/g, '-');
    }
}
