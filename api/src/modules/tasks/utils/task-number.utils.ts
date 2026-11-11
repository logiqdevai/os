import { NumberResetPolicy, Prisma } from 'generated/prisma';

const ENTITY = 'task';
const PREFIX = 'TASK';

/**
 * Allocate the next task number (06 §3) inside the caller's transaction. The counter is a NumberSequence row
 * (entity_type `task`, never resets); the atomic `increment` takes a row lock until the transaction commits, so two
 * concurrent creates can never get the same number and a rolled-back create never leaves a gap twice.
 * Numbers are unique per organization (Task @@unique([organization_id, number])); the identifier shown to people is
 * `<Team.task_key>-<number>`, e.g. WEB-142.
 */
export async function nextTaskNumber(tx: Prisma.TransactionClient, organizationId: string): Promise<number> {
    let seq = await tx.numberSequence.findFirst({ where: { organization_id: organizationId, entity_type: ENTITY, prefix: PREFIX, year: null } });
    if (!seq) {
        const max = await tx.task.aggregate({ where: { organization_id: organizationId }, _max: { number: true } });
        try {
            seq = await tx.numberSequence.create({
                data: { organization_id: organizationId, entity_type: ENTITY, prefix: PREFIX, year: null, reset_policy: NumberResetPolicy.NEVER, padding: 0, next_number: (max._max.number ?? 0) + 1 },
            });
        } catch (error) {
            if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
            seq = await tx.numberSequence.findFirstOrThrow({ where: { organization_id: organizationId, entity_type: ENTITY, prefix: PREFIX, year: null } });
        }
    }
    const updated = await tx.numberSequence.update({ where: { id: seq.id }, data: { next_number: { increment: 1 } } });
    return updated.next_number - 1;
}

/** Fallback key for tasks without a team (or a team without a task key). */
export const DEFAULT_TASK_KEY = 'TASK';

export const taskIdentifier = (task: { number: number; team?: { task_key: string | null } | null }) => `${task.team?.task_key || DEFAULT_TASK_KEY}-${task.number}`;

/** Parse `WEB-142` → { key: 'WEB', number: 142 }. */
export function parseTaskIdentifier(value: string): { key: string; number: number } | null {
    const m = /^([A-Za-z][A-Za-z0-9]{0,9})-(\d{1,9})$/.exec(value.trim());
    return m ? { key: m[1].toUpperCase(), number: Number(m[2]) } : null;
}

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Lexicographic rank strictly between `a` and `b` (null = open end) for manual ordering on boards (fractional
 * indexing). Ranks never end in '0', so there is always room between two neighbours.
 */
export function rankBetween(a: string | null | undefined, b: string | null | undefined): string {
    const lo = a ?? '';
    let hi: string | null = b ?? null;
    if (hi !== null && lo >= hi) hi = null;
    let result = '';
    for (let i = 0; i < 64; i++) {
        const loDigit = i < lo.length ? DIGITS.indexOf(lo[i]) : 0;
        const hiDigit = hi !== null && i < hi.length ? DIGITS.indexOf(hi[i]) : DIGITS.length;
        if (hiDigit - loDigit > 1) return result + DIGITS[Math.floor((loDigit + hiDigit) / 2)];
        result += DIGITS[loDigit];
        if (hiDigit - loDigit === 1) hi = null;
    }
    return result + 'i';
}
