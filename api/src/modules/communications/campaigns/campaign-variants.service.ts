import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { CampaignAbMetric, CampaignStatus, ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { branchScopeWhere, htmlToText, notFound } from '../common/comm.utils';
import { SetVariantsInput } from './dto/campaign.dto';

const LABELS = ['A', 'B', 'C', 'D', 'E'];
const EDITABLE: CampaignStatus[] = [CampaignStatus.DRAFT, CampaignStatus.PENDING_APPROVAL, CampaignStatus.APPROVED];

/** Split 100 % over the variants: given shares are kept (scaled when they overflow), missing ones share the rest equally. */
export function normalizeShares(shares: (number | null | undefined)[]): number[] {
    const given = shares.reduce<number>((a, s) => a + (s ?? 0), 0);
    const missing = shares.filter((s) => !s).length;
    if (!missing && given === 100) return shares as number[];
    if (given >= 100 || !missing) return shares.map((s) => Math.max(1, Math.round(((s ?? 0) / (given || 1)) * 100)));
    const each = Math.floor((100 - given) / missing);
    let rest = 100 - given - each * missing;
    return shares.map((s) => {
        if (s) return s;
        const v = each + (rest > 0 ? 1 : 0);
        rest -= 1;
        return v;
    });
}

/**
 * A/B test variants of a campaign (11 "Marketing Campaigns"). The test settings live on the campaign (ab_test_enabled,
 * ab_metric, ab_test_percent, ab_wait_hours); CampaignRunnerService sends the variants to the test group, waits
 * ab_wait_hours, picks the winner by open or click rate and sends it to the rest of the audience.
 */
@Injectable()
export class CampaignVariantsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    private async campaign(ctx: OrgContext, id: string) {
        const c = await this.prisma.campaign.findFirst({
            where: { id, organization_id: ctx.organization_id, ...(branchScopeWhere(ctx, 'communications.campaigns.read', ['owner_membership_id', 'created_by_membership_id']) as Prisma.CampaignWhereInput) },
        });
        if (!c) throw notFound('Campaign', 'campaign_not_found');
        return c;
    }

    /** Variants with live counters and rates (sent / opened / clicked per variant). */
    async list(ctx: OrgContext, campaignId: string) {
        const c = await this.campaign(ctx, campaignId);
        const variants = await this.prisma.campaignVariant.findMany({ where: { campaign_id: campaignId }, orderBy: { sort_order: 'asc' } });
        const withStats = await Promise.all(variants.map(async (v) => ({ ...v, ...(await this.counters(v.id)) })));
        const holdout = await this.prisma.campaignRecipient.count({ where: { campaign_id: campaignId, variant_id: null, message_id: null, status: 'PENDING' } });
        const decideAt = c.started_at && c.ab_wait_hours ? new Date(c.started_at.getTime() + c.ab_wait_hours * 3600_000) : null;
        return {
            ab_test_enabled: c.ab_test_enabled,
            ab_metric: c.ab_metric,
            ab_test_percent: c.ab_test_percent,
            ab_wait_hours: c.ab_wait_hours,
            ab_winner_selected_at: c.ab_winner_selected_at,
            winner_decides_at: c.ab_winner_selected_at ? null : decideAt,
            holdout_count: holdout,
            variants: withStats.map((v) => ({
                ...v,
                open_rate: v.sent_count ? Math.round((v.opened_count / v.sent_count) * 1000) / 10 : 0,
                click_rate: v.sent_count ? Math.round((v.clicked_count / v.sent_count) * 1000) / 10 : 0,
            })),
        };
    }

    /** Live counters of one variant, also written back to the row. */
    async counters(variantId: string) {
        const base = { variant_id: variantId, message_id: { not: null } } satisfies Prisma.CampaignRecipientWhereInput;
        const [sent, delivered, opened, clicked] = await Promise.all([
            this.prisma.campaignRecipient.count({ where: { ...base, message: { sent_at: { not: null } } } }),
            this.prisma.campaignRecipient.count({ where: { ...base, message: { delivered_at: { not: null } } } }),
            this.prisma.campaignRecipient.count({ where: { ...base, message: { first_opened_at: { not: null } } } }),
            this.prisma.campaignRecipient.count({ where: { ...base, message: { first_clicked_at: { not: null } } } }),
        ]);
        await this.prisma.campaignVariant.update({ where: { id: variantId }, data: { sent_count: sent, delivered_count: delivered, opened_count: opened, clicked_count: clicked } }).catch(() => undefined);
        return { sent_count: sent, delivered_count: delivered, opened_count: opened, clicked_count: clicked };
    }

    async replace(ctx: OrgContext, campaignId: string, dto: SetVariantsInput) {
        const c = await this.campaign(ctx, campaignId);
        if (!EDITABLE.includes(c.status)) throw new ConflictException({ message: 'Variants can only change before the campaign is scheduled', code: 'campaign_not_editable' });
        if (dto.variants.length === 1) throw new BadRequestException({ message: 'An A/B test needs at least two variants (or none)', code: 'variants_too_few' });
        const shares = normalizeShares(dto.variants.map((v) => v.share_percent));
        await this.prisma.$transaction(async (tx) => {
            await tx.campaignVariant.deleteMany({ where: { campaign_id: campaignId } });
            if (dto.variants.length) {
                await tx.campaignVariant.createMany({
                    data: dto.variants.map((v, i) => ({
                        campaign_id: campaignId,
                        label: LABELS[i],
                        subject: v.subject ?? null,
                        preheader: v.preheader ?? null,
                        body_html: c.channel === 'EMAIL' ? v.body_html ?? null : null,
                        body_text: v.body_text ?? (v.body_html ? htmlToText(v.body_html) : null),
                        share_percent: shares[i],
                        sort_order: i,
                    })),
                });
            }
            // Changing a reviewed campaign sends it back to draft, like any content change.
            await tx.campaign.update({
                where: { id: campaignId },
                data: {
                    ab_test_enabled: dto.variants.length >= 2,
                    ab_metric: c.ab_metric ?? CampaignAbMetric.OPEN,
                    ab_test_percent: c.ab_test_percent ?? 20,
                    ab_wait_hours: c.ab_wait_hours ?? 4,
                    ...(c.status !== CampaignStatus.DRAFT && { status: CampaignStatus.DRAFT, approved_at: null, approved_by_membership_id: null, submitted_for_approval_at: null }),
                },
            });
        });
        await this.audit.record(ctx, 'communications.campaign.variants_updated', { resource_type: 'campaign', resource_id: campaignId, branch_id: c.branch_id, metadata: { count: dto.variants.length, shares } });
        this.events.publish(ctx, { event_key: 'communications.campaign.updated', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: campaignId, payload: { name: c.name, variants: dto.variants.length } });
        return this.list(ctx, campaignId);
    }

    /** Manual winner pick (before the test window ends). The runner then sends the winner to the holdout group. */
    async chooseWinner(ctx: OrgContext, campaignId: string, variantId: string) {
        const c = await this.campaign(ctx, campaignId);
        if (!c.ab_test_enabled) throw new BadRequestException({ message: 'This campaign has no A/B test', code: 'ab_not_enabled' });
        if (c.ab_winner_selected_at) throw new ConflictException({ message: 'The winner was already picked', code: 'ab_winner_selected' });
        if (c.status !== CampaignStatus.SENDING && c.status !== CampaignStatus.PAUSED) throw new ConflictException({ message: 'The test has not started yet', code: 'ab_not_started' });
        const variant = await this.prisma.campaignVariant.findFirst({ where: { id: variantId, campaign_id: campaignId } });
        if (!variant) throw notFound('Variant', 'variant_not_found');
        await this.markWinner(campaignId, variantId);
        await this.audit.record(ctx, 'communications.campaign.ab_winner_selected', { resource_type: 'campaign', resource_id: campaignId, branch_id: c.branch_id, metadata: { variant_id: variantId, label: variant.label, manual: true, sensitive: true } });
        this.events.publish(ctx, {
            event_key: 'communications.campaign.ab_winner_selected', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: campaignId,
            payload: { name: c.name, variant_id: variantId, label: variant.label, manual: true }, activity: { summary: `Variant ${variant.label} picked as the winner of "${c.name}"`, entity_label: c.name },
        });
        return this.list(ctx, campaignId);
    }

    /** Pick the variant with the best rate for the campaign metric (ties: lower sort order). */
    async bestVariant(campaign: { id: string; ab_metric: CampaignAbMetric | null }) {
        const variants = await this.prisma.campaignVariant.findMany({ where: { campaign_id: campaign.id }, orderBy: { sort_order: 'asc' } });
        let best: { id: string; label: string; rate: number } | null = null;
        for (const v of variants) {
            const c = await this.counters(v.id);
            const hits = campaign.ab_metric === CampaignAbMetric.CLICK ? c.clicked_count : c.opened_count;
            const rate = c.sent_count ? hits / c.sent_count : 0;
            if (!best || rate > best.rate) best = { id: v.id, label: v.label, rate };
        }
        return best;
    }

    async markWinner(campaignId: string, variantId: string) {
        await this.prisma.$transaction([
            this.prisma.campaignVariant.updateMany({ where: { campaign_id: campaignId }, data: { is_winner: false } }),
            this.prisma.campaignVariant.update({ where: { id: variantId }, data: { is_winner: true } }),
            this.prisma.campaign.update({ where: { id: campaignId }, data: { ab_winner_selected_at: new Date() } }),
        ]);
    }
}
