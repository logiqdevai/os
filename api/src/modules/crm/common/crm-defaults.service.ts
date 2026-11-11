import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import { DEFAULT_LEAD_SOURCES, DEFAULT_LEAD_STATUSES, DEFAULT_LIFECYCLE_STAGES, DEFAULT_LOSS_REASONS, DEFAULT_PIPELINE_STAGES } from './crm.constants';

/**
 * 02 §37 — CRM default provisioning. Idempotent: each set is created only when the organization has none.
 * Called lazily on first CRM use (pipelines, deals, leads, settings) so existing organizations get defaults too.
 */
@Injectable()
export class CrmDefaultsService {
    private readonly logger = new Logger(CrmDefaultsService.name);
    private readonly ensured = new Set<string>();
    private readonly inflight = new Map<string, Promise<void>>();

    constructor(private readonly prisma: PrismaService) { }

    async ensure(organizationId: string): Promise<void> {
        if (this.ensured.has(organizationId)) return;
        let p = this.inflight.get(organizationId);
        if (!p) {
            p = this.provision(organizationId).finally(() => this.inflight.delete(organizationId));
            this.inflight.set(organizationId, p);
        }
        await p;
        this.ensured.add(organizationId);
    }

    /** Forget the cache (after an admin deletes every pipeline, for example). */
    forget(organizationId: string) {
        this.ensured.delete(organizationId);
    }

    private async provision(organization_id: string) {
        const [pipelines, statuses, lifecycle, sources, reasons] = await Promise.all([
            this.prisma.crmPipeline.count({ where: { organization_id } }),
            this.prisma.crmLeadStatus.count({ where: { organization_id } }),
            this.prisma.crmLifecycleStage.count({ where: { organization_id } }),
            this.prisma.crmLeadSource.count({ where: { organization_id } }),
            this.prisma.crmLossReason.count({ where: { organization_id } }),
        ]);
        try {
            if (!pipelines) {
                const org = await this.prisma.organization.findUnique({ where: { id: organization_id }, select: { default_currency: true } });
                await this.prisma.crmPipeline.create({
                    data: {
                        organization_id,
                        name: 'Sales',
                        slug: 'sales',
                        is_default: true,
                        currency: org?.default_currency ?? 'EUR',
                        stages: {
                            create: DEFAULT_PIPELINE_STAGES.map((s, i) => ({
                                name: s.name,
                                slug: slugify(s.name),
                                sort_order: i,
                                probability: s.probability,
                                forecast_category: s.forecast_category,
                                is_won: !!s.is_won,
                                is_lost: !!s.is_lost,
                                color: s.color,
                                stale_after_days: s.is_won || s.is_lost ? null : 21,
                            })),
                        },
                    },
                });
            }
            if (!statuses) {
                await this.prisma.crmLeadStatus.createMany({
                    skipDuplicates: true,
                    data: DEFAULT_LEAD_STATUSES.map((s, i) => ({ organization_id, name: s.name, slug: slugify(s.name), color: s.color, sort_order: i, is_default: !!s.is_default, is_converted: !!s.is_converted, is_lost: !!s.is_lost })),
                });
            }
            if (!lifecycle) {
                await this.prisma.crmLifecycleStage.createMany({
                    skipDuplicates: true,
                    data: DEFAULT_LIFECYCLE_STAGES.map((s, i) => ({ organization_id, name: s.name, slug: slugify(s.name), sort_order: i, is_customer: !!s.is_customer, is_default: !!s.is_default })),
                });
            }
            if (!sources) {
                await this.prisma.crmLeadSource.createMany({
                    skipDuplicates: true,
                    data: DEFAULT_LEAD_SOURCES.map((name, i) => ({ organization_id, name, slug: slugify(name), sort_order: i, is_default: name === 'Website' })),
                });
            }
            if (!reasons) {
                await this.prisma.crmLossReason.createMany({
                    skipDuplicates: true,
                    data: DEFAULT_LOSS_REASONS.map((r, i) => ({ organization_id, name: r.name, slug: slugify(r.name), applies_to: r.applies_to, sort_order: i })),
                });
            }
        } catch (error) {
            // A concurrent request may have created the same rows (unique slug) — that's fine.
            this.logger.warn(`CRM defaults for ${organization_id}: ${(error as Error).message}`);
        }
    }
}
