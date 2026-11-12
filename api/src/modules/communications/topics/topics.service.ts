import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CommConsentSource, CommConsentStatus, ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { isUniqueError, notFound, slugify } from '../common/comm.utils';
import { CommStatsService } from '../delivery/comm-stats.service';
import { CreateTopicInput, SetSubscriptionsInput, TopicQuery, UpdateTopicInput } from './dto/topic.dto';

/** Minimal system context for writes made by a recipient on the public preference page (no credential). */
const publicCtx = (organizationId: string) =>
    ({ organization_id: organizationId, user_id: null, membership_id: null, service_account_id: null, api_key_id: null, actor_type: 'SYSTEM', channel: 'api' }) as unknown as OrgContext;

export interface PreferenceCenterView {
    organization_name: string;
    address: string;
    channel: string;
    unsubscribed: boolean;
    topics: { id: string; name: string; description: string | null; subscribed: boolean }[];
}

/**
 * Preference-center topics and per-contact topic subscriptions (11 "Customer Communication", "Recipients").
 * A campaign with a topic only reaches contacts subscribed to it (or, without a choice, topics with default_opt_in) —
 * enforced in AudienceService.resolveCampaign and again per message in CommDispatchService.blockReason.
 * The public preference center is reached with the unsubscribe token of any message the contact received.
 */
@Injectable()
export class TopicsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly stats: CommStatsService,
    ) { }

    async findAll(ctx: OrgContext, query: TopicQuery) {
        const where: Prisma.CommTopicWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(query.channel && { OR: [{ channel: query.channel }, { channel: null }] }),
            ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.commTopic.findMany({ where, ...skipTake(query), orderBy: [{ sort_order: 'asc' }, orderBy(query, ['name', 'created_at'], 'name')], include: { _count: { select: { campaigns: true } } } }),
            this.prisma.commTopic.count({ where }),
        ]);
        const counts = await this.prisma.commTopicSubscription.groupBy({ by: ['topic_id', 'status'], where: { topic_id: { in: items.map((t) => t.id) } }, _count: { _all: true } });
        const of = (id: string, status: CommConsentStatus) => counts.find((c) => c.topic_id === id && c.status === status)?._count._all ?? 0;
        return paginate(
            items.map(({ _count, ...t }) => ({ ...t, campaign_count: _count.campaigns, subscribed_count: of(t.id, CommConsentStatus.OPTED_IN), unsubscribed_count: of(t.id, CommConsentStatus.OPTED_OUT) })),
            total,
            query,
        );
    }

    async findOne(ctx: OrgContext, id: string) {
        const topic = await this.prisma.commTopic.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!topic) throw notFound('Topic', 'topic_not_found');
        return topic;
    }

    async create(ctx: OrgContext, dto: CreateTopicInput) {
        try {
            const topic = await this.prisma.commTopic.create({
                data: {
                    organization_id: ctx.organization_id,
                    name: dto.name,
                    slug: dto.slug ?? slugify(dto.name),
                    description: dto.description ?? null,
                    channel: dto.channel ?? null,
                    default_opt_in: dto.default_opt_in ?? false,
                    sort_order: dto.sort_order ?? 0,
                },
            });
            await this.audit.record(ctx, 'communications.topic.created', { resource_type: 'comm_topic', resource_id: topic.id, metadata: { after: dto } });
            this.events.publish(ctx, { event_key: 'communications.topic.created', module: ModuleKey.COMMUNICATION, entity_kind: 'comm_topic', entity_id: topic.id, payload: { name: topic.name } });
            return topic;
        } catch (error) {
            if (isUniqueError(error)) throw new ConflictException({ message: 'A topic with this slug already exists', code: 'topic_slug_taken' });
            throw error;
        }
    }

    async update(ctx: OrgContext, id: string, dto: UpdateTopicInput) {
        const before = await this.findOne(ctx, id);
        try {
            const topic = await this.prisma.commTopic.update({ where: { id }, data: { ...dto } });
            await this.audit.record(ctx, 'communications.topic.updated', { resource_type: 'comm_topic', resource_id: id, metadata: { before: { name: before.name, default_opt_in: before.default_opt_in, channel: before.channel }, after: dto } });
            this.events.publish(ctx, { event_key: 'communications.topic.updated', module: ModuleKey.COMMUNICATION, entity_kind: 'comm_topic', entity_id: id, payload: { name: topic.name } });
            return topic;
        } catch (error) {
            if (isUniqueError(error)) throw new ConflictException({ message: 'A topic with this slug already exists', code: 'topic_slug_taken' });
            throw error;
        }
    }

    async archive(ctx: OrgContext, id: string, archived: boolean) {
        await this.findOne(ctx, id);
        const topic = await this.prisma.commTopic.update({ where: { id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'communications.topic.archived' : 'communications.topic.restored', { resource_type: 'comm_topic', resource_id: id });
        this.events.publish(ctx, { event_key: archived ? 'communications.topic.archived' : 'communications.topic.restored', module: ModuleKey.COMMUNICATION, entity_kind: 'comm_topic', entity_id: id, payload: { name: topic.name } });
        return topic;
    }

    async remove(ctx: OrgContext, id: string) {
        const topic = await this.findOne(ctx, id);
        const live = await this.prisma.campaign.count({ where: { topic_id: id, status: { in: ['SCHEDULED', 'SENDING', 'PAUSED'] } } });
        if (live) throw new ConflictException({ message: 'Campaigns that are scheduled or sending use this topic; archive it instead', code: 'topic_in_use' });
        await this.prisma.commTopic.delete({ where: { id } });
        await this.audit.record(ctx, 'communications.topic.deleted', { resource_type: 'comm_topic', resource_id: id, metadata: { before: { name: topic.name, slug: topic.slug }, sensitive: true } });
        this.events.publish(ctx, { event_key: 'communications.topic.deleted', module: ModuleKey.COMMUNICATION, entity_kind: 'comm_topic', entity_id: id, payload: { name: topic.name } });
        return { success: true };
    }

    // ------------------------------------------------------------------ per-contact subscriptions

    /** Every active topic with the contact's state (explicit choice, or the topic default). */
    async contactSubscriptions(ctx: OrgContext, contactId: string) {
        const contact = await this.prisma.crmContact.findFirst({ where: { id: contactId, organization_id: ctx.organization_id }, select: { id: true, first_name: true, last_name: true, email: true } });
        if (!contact) throw notFound('Contact', 'contact_not_found');
        const [topics, subs] = await Promise.all([
            this.prisma.commTopic.findMany({ where: { organization_id: ctx.organization_id, archived_at: null }, orderBy: [{ sort_order: 'asc' }, { name: 'asc' }] }),
            this.prisma.commTopicSubscription.findMany({ where: { contact_id: contactId } }),
        ]);
        return {
            contact,
            topics: topics.map((t) => {
                const s = subs.find((x) => x.topic_id === t.id);
                return { topic: t, status: s?.status ?? CommConsentStatus.UNKNOWN, source: s?.source ?? null, updated_at: s?.updated_at ?? null, effective: s ? s.status === CommConsentStatus.OPTED_IN : t.default_opt_in };
            }),
        };
    }

    async setSubscriptions(ctx: OrgContext, contactId: string, dto: SetSubscriptionsInput, source: CommConsentSource = CommConsentSource.MANUAL) {
        const contact = await this.prisma.crmContact.findFirst({ where: { id: contactId, organization_id: ctx.organization_id }, select: { id: true } });
        if (!contact) throw notFound('Contact', 'contact_not_found');
        const topicIds = [...new Set(dto.subscriptions.map((s) => s.topic_id))];
        const found = await this.prisma.commTopic.count({ where: { id: { in: topicIds }, organization_id: ctx.organization_id } });
        if (found !== topicIds.length) throw notFound('Topic', 'topic_not_found');
        const before = await this.prisma.commTopicSubscription.findMany({ where: { contact_id: contactId, topic_id: { in: topicIds } }, select: { topic_id: true, status: true } });
        await this.write(ctx.organization_id, contactId, dto.subscriptions, source, ctx.membership_id);
        await this.audit.record(ctx, 'communications.topic_subscription.updated', {
            resource_type: 'comm_consent', resource_id: contactId,
            metadata: { before, after: dto.subscriptions, source, sensitive: true },
        });
        this.events.publish(ctx, { event_key: 'communications.topic_subscription.updated', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CRM_CONTACT, entity_id: contactId, payload: { subscriptions: dto.subscriptions, source } });
        return this.contactSubscriptions(ctx, contactId);
    }

    private async write(organizationId: string, contactId: string, rows: { topic_id: string; status: CommConsentStatus }[], source: CommConsentSource, membershipId: string | null) {
        await this.prisma.$transaction(
            rows.map((r) =>
                this.prisma.commTopicSubscription.upsert({
                    where: { contact_id_topic_id: { contact_id: contactId, topic_id: r.topic_id } },
                    update: { status: r.status, source, updated_by_membership_id: membershipId },
                    create: { organization_id: organizationId, contact_id: contactId, topic_id: r.topic_id, status: r.status, source, updated_by_membership_id: membershipId },
                }),
            ),
        );
    }

    // ------------------------------------------------------------------ public preference center (token = message unsubscribe token)

    private async tokenTarget(token: string) {
        if (!token || token.length > 100) return null;
        return this.prisma.commMessage.findUnique({
            where: { unsubscribe_token: token },
            select: { id: true, organization_id: true, channel: true, to_address: true, recipient_contact_id: true, unsubscribed_at: true, organization: { select: { display_name: true } } },
        });
    }

    async preferenceCenter(token: string): Promise<PreferenceCenterView | null> {
        const target = await this.tokenTarget(token);
        if (!target) return null;
        const topics = await this.prisma.commTopic.findMany({
            where: { organization_id: target.organization_id, archived_at: null, OR: [{ channel: null }, { channel: target.channel }] },
            orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
        });
        const subs = target.recipient_contact_id ? await this.prisma.commTopicSubscription.findMany({ where: { contact_id: target.recipient_contact_id } }) : [];
        const suppressed = await this.prisma.commSuppression.findFirst({
            where: { organization_id: target.organization_id, channel: target.channel, address: target.to_address, removed_at: null, reason: { in: ['UNSUBSCRIBE', 'CONSENT_WITHDRAWN'] } },
            select: { id: true },
        });
        return {
            organization_name: target.organization.display_name,
            address: target.to_address,
            channel: target.channel,
            unsubscribed: !!suppressed,
            // Topics are per CRM contact; an external address without a contact can only unsubscribe from everything.
            topics: target.recipient_contact_id
                ? topics.map((t) => {
                    const s = subs.find((x) => x.topic_id === t.id);
                    return { id: t.id, name: t.name, description: t.description, subscribed: s ? s.status === CommConsentStatus.OPTED_IN : t.default_opt_in };
                })
                : [],
        };
    }

    /** Save the choices from the public page. `unsubscribe_all` writes the global unsubscribe (suppression + consent OPTED_OUT). */
    async savePreferences(token: string, input: { topic_ids: string[]; unsubscribe_all: boolean }) {
        const target = await this.tokenTarget(token);
        if (!target) throw new NotFoundException({ message: 'Link expired', code: 'preference_token_invalid' });
        const ctx = publicCtx(target.organization_id);
        if (input.unsubscribe_all) {
            await this.stats.record(target.id, { type: 'UNSUBSCRIBED', reason: 'Preference center: unsubscribe from all' });
            await this.audit.record(ctx, 'communications.preferences.unsubscribed_all', { resource_type: 'comm_consent', resource_id: target.recipient_contact_id ?? target.id, metadata: { message_id: target.id, channel: target.channel, sensitive: true } });
            return { unsubscribed: true };
        }
        if (!target.recipient_contact_id) throw new BadRequestException({ message: 'Topic choices need a contact', code: 'preference_no_contact' });
        const topics = await this.prisma.commTopic.findMany({ where: { organization_id: target.organization_id, archived_at: null, OR: [{ channel: null }, { channel: target.channel }] }, select: { id: true } });
        const wanted = new Set(input.topic_ids);
        const rows = topics.map((t) => ({ topic_id: t.id, status: wanted.has(t.id) ? CommConsentStatus.OPTED_IN : CommConsentStatus.OPTED_OUT }));
        if (rows.length) await this.write(target.organization_id, target.recipient_contact_id, rows, CommConsentSource.UNSUBSCRIBE_LINK, null);
        // Choosing topics again lifts an earlier global unsubscribe of this address.
        if (rows.some((r) => r.status === CommConsentStatus.OPTED_IN)) {
            await this.prisma.commSuppression.updateMany({
                where: { organization_id: target.organization_id, channel: target.channel, address: target.to_address, removed_at: null, reason: 'UNSUBSCRIBE' },
                data: { removed_at: new Date() },
            });
            await this.prisma.commConsent.updateMany({ where: { contact_id: target.recipient_contact_id, channel: target.channel, status: 'OPTED_OUT', source: 'UNSUBSCRIBE_LINK' }, data: { status: 'OPTED_IN', withdrawn_at: null, consented_at: new Date() } });
        }
        await this.audit.record(ctx, 'communications.preferences.updated', { resource_type: 'comm_consent', resource_id: target.recipient_contact_id, metadata: { message_id: target.id, after: rows, sensitive: true } });
        this.events.publish(ctx, { event_key: 'communications.topic_subscription.updated', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CRM_CONTACT, entity_id: target.recipient_contact_id, payload: { subscriptions: rows, source: 'preference_center' } });
        return { unsubscribed: false, subscribed_topic_ids: rows.filter((r) => r.status === CommConsentStatus.OPTED_IN).map((r) => r.topic_id) };
    }
}
