import { MembershipStatus, Prisma, ProjectStatusCategory } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';

/** Member (Membership + user) fields returned wherever a person is shown. */
export const MEMBER_SELECT = {
    id: true,
    job_title: true,
    user: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true, profile_photo_url: true } },
} satisfies Prisma.MembershipSelect;

export const PROJECT_READ = 'projects.projects.read';

/** Status categories that mean the project is no longer in delivery. */
export const CLOSED_PROJECT_CATEGORIES: ProjectStatusCategory[] = [ProjectStatusCategory.COMPLETED, ProjectStatusCategory.CANCELLED, ProjectStatusCategory.ARCHIVED];

/** `YYYY-MM-DD` / ISO string → Date (undefined stays undefined so PATCH leaves the column alone, null clears it). */
export function toDate(value: string | Date | null | undefined): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    return value instanceof Date ? value : new Date(value);
}

/** Convert the listed date keys of a DTO in place-safe copy. */
export function withDates<T extends Record<string, unknown>>(dto: T, keys: readonly string[]): T {
    const out: Record<string, unknown> = { ...dto };
    for (const key of keys) if (key in out) out[key] = toDate(out[key] as string | null | undefined);
    return out as T;
}

/** Drop undefined values so Prisma `update` only touches the fields that were sent. */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Risk severity from probability × impact (1–5 each), 05 §29. */
export function riskSeverity(probability?: number | null, impact?: number | null) {
    if (!probability || !impact) return undefined;
    const score = probability * impact;
    if (score >= 16) return 'CRITICAL' as const;
    if (score >= 10) return 'HIGH' as const;
    if (score >= 5) return 'MEDIUM' as const;
    return 'LOW' as const;
}

export const startOfDay = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);

/** Active members of the organization for assignee / owner pickers (name, email, job title only). */
export function listPeople(prisma: PrismaService, organizationId: string, search?: string, limit = 50) {
    return prisma.membership.findMany({
        where: {
            organization_id: organizationId,
            status: MembershipStatus.ACTIVE,
            ...(search && {
                user: {
                    OR: [
                        { display_name: { contains: search, mode: 'insensitive' } },
                        { first_name: { contains: search, mode: 'insensitive' } },
                        { last_name: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } },
                    ],
                },
            }),
        },
        take: limit,
        orderBy: { user: { first_name: 'asc' } },
        select: MEMBER_SELECT,
    });
}
