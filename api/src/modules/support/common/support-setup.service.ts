import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { DEFAULT_SLA_TARGETS, DEFAULT_TICKET_STATUSES } from './support.constants';

/**
 * Creates the per-organization Support defaults on first use (13 §2, §13): settings row, the six ticket statuses,
 * a default shared inbox and a default SLA policy. Idempotent and cached per process.
 */
@Injectable()
export class SupportSetupService {
    private ensured = new Set<string>();
    private pending = new Map<string, Promise<void>>();

    constructor(private readonly prisma: PrismaService) { }

    async ensureDefaults(organizationId: string): Promise<void> {
        if (this.ensured.has(organizationId)) return;
        const running = this.pending.get(organizationId);
        if (running) return running;
        const job = this.create(organizationId)
            .then(() => { this.ensured.add(organizationId); })
            .finally(() => this.pending.delete(organizationId));
        this.pending.set(organizationId, job);
        return job;
    }

    private async create(organizationId: string) {
        const [settings, statusCount, inbox, policy] = await Promise.all([
            this.prisma.supportSettings.findUnique({ where: { organization_id: organizationId } }),
            this.prisma.ticketStatus.count({ where: { organization_id: organizationId } }),
            this.prisma.supportInbox.findFirst({ where: { organization_id: organizationId, archived_at: null }, orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }] }),
            this.prisma.slaPolicy.findFirst({ where: { organization_id: organizationId, archived_at: null }, orderBy: [{ is_default: 'desc' }, { sort_order: 'asc' }] }),
        ]);

        if (!statusCount) {
            await this.prisma.ticketStatus.createMany({
                data: DEFAULT_TICKET_STATUSES.map((s, i) => ({ ...s, organization_id: organizationId, sort_order: i })),
                skipDuplicates: true,
            });
        }

        let inboxId = inbox?.id ?? null;
        if (!inbox) {
            const created = await this.prisma.supportInbox
                .create({ data: { organization_id: organizationId, name: 'Support', slug: 'support', is_default: true, description: 'Default shared inbox' } })
                .catch((e) => (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' ? this.prisma.supportInbox.findFirst({ where: { organization_id: organizationId, slug: 'support' } }) : Promise.reject(e)));
            inboxId = created?.id ?? null;
        }

        let policyId = policy?.id ?? null;
        if (!policy) {
            const created = await this.prisma.slaPolicy
                .create({
                    data: {
                        organization_id: organizationId,
                        name: 'Standard',
                        description: 'Default response and resolution targets',
                        is_default: true,
                        use_business_hours: false,
                        targets: { create: DEFAULT_SLA_TARGETS },
                    },
                })
                .catch((e) => (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' ? this.prisma.slaPolicy.findFirst({ where: { organization_id: organizationId, name: 'Standard' } }) : Promise.reject(e)));
            policyId = created?.id ?? null;
        }

        if (!settings) {
            await this.prisma.supportSettings.upsert({
                where: { organization_id: organizationId },
                update: {},
                create: { organization_id: organizationId, default_inbox_id: inboxId, default_sla_policy_id: policyId },
            });
        }
    }

    /** Settings row (created on first read). */
    async settings(organizationId: string) {
        await this.ensureDefaults(organizationId);
        return this.prisma.supportSettings.findUniqueOrThrow({ where: { organization_id: organizationId } });
    }
}
