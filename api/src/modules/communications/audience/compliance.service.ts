import { BadRequestException, Injectable } from '@nestjs/common';
import { CommChannel, CommConsentSource, CommConsentStatus, CommSuppressionReason, ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { normalizeAddress, notFound } from '../common/comm.utils';
import { ConsentQuery, CreateSuppressionDto, SetConsentDto, SuppressionQuery } from './dto/audience.dto';

/** Consent per contact and channel, and the suppression list (11 "Recipients"). */
@Injectable()
export class ComplianceService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    // ------------------------------------------------------------------ consent

    async consents(ctx: OrgContext, query: ConsentQuery) {
        const where: Prisma.CommConsentWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.channel && { channel: query.channel }),
            ...(query.status && { status: query.status }),
            ...(query.source && { source: query.source }),
            ...(query.search && { contact: { OR: [{ first_name: { contains: query.search, mode: 'insensitive' } }, { last_name: { contains: query.search, mode: 'insensitive' } }, { email: { contains: query.search, mode: 'insensitive' } }] } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.commConsent.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['updated_at', 'consented_at', 'created_at'], 'updated_at'),
                include: { contact: { select: { id: true, first_name: true, last_name: true, email: true, mobile: true, company: { select: { id: true, name: true } } } } },
            }),
            this.prisma.commConsent.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async contactConsents(ctx: OrgContext, contactId: string) {
        const contact = await this.prisma.crmContact.findFirst({ where: { id: contactId, organization_id: ctx.organization_id }, select: { id: true, first_name: true, last_name: true, email: true, mobile: true } });
        if (!contact) throw notFound('Contact', 'contact_not_found');
        const [consents, history] = await Promise.all([
            this.prisma.commConsent.findMany({ where: { contact_id: contactId } }),
            this.prisma.auditEvent.findMany({
                where: { organization_id: ctx.organization_id, resource_type: 'comm_consent', resource_id: contactId },
                orderBy: { created_at: 'desc' },
                take: 50,
                select: { id: true, event_type: true, metadata: true, created_at: true, actor_type: true, actor_user_id: true },
            }),
        ]);
        return { contact, consents, history };
    }

    async setConsent(ctx: OrgContext, contactId: string, channel: CommChannel, dto: SetConsentDto) {
        if (!Object.values(CommChannel).includes(channel)) throw new BadRequestException({ message: 'Unknown channel', code: 'invalid_channel' });
        const contact = await this.prisma.crmContact.findFirst({ where: { id: contactId, organization_id: ctx.organization_id }, select: { id: true, email: true, mobile: true, phone: true } });
        if (!contact) throw notFound('Contact', 'contact_not_found');
        const before = await this.prisma.commConsent.findUnique({ where: { contact_id_channel: { contact_id: contactId, channel } } });
        const now = new Date();
        const optedIn = dto.status === CommConsentStatus.OPTED_IN;
        const optedOut = dto.status === CommConsentStatus.OPTED_OUT;
        const data = {
            status: dto.status,
            source: dto.source ?? CommConsentSource.MANUAL,
            marketing_opted_in: optedIn,
            consented_at: optedIn ? now : before?.consented_at ?? null,
            withdrawn_at: optedOut ? now : null,
            notes: dto.notes ?? before?.notes ?? null,
            evidence: (dto.evidence ?? before?.evidence ?? undefined) as Prisma.InputJsonValue,
            updated_by_membership_id: ctx.membership_id,
        };
        const consent = await this.prisma.commConsent.upsert({
            where: { contact_id_channel: { contact_id: contactId, channel } },
            update: data,
            create: { organization_id: ctx.organization_id, contact_id: contactId, channel, ...data },
        });
        // Opt-out also suppresses the address for marketing; opt-in lifts an unsubscribe / consent-withdrawn suppression.
        const address = normalizeAddress(channel, channel === CommChannel.EMAIL ? contact.email : contact.mobile ?? contact.phone);
        if (address && optedOut) {
            await this.prisma.commSuppression.upsert({
                where: { organization_id_channel_address: { organization_id: ctx.organization_id, channel, address } },
                update: { removed_at: null, reason: CommSuppressionReason.CONSENT_WITHDRAWN },
                create: { organization_id: ctx.organization_id, channel, address, contact_id: contactId, reason: CommSuppressionReason.CONSENT_WITHDRAWN, created_by_membership_id: ctx.membership_id },
            });
        } else if (address && optedIn) {
            await this.prisma.commSuppression.updateMany({
                where: { organization_id: ctx.organization_id, channel, address, removed_at: null, reason: { in: [CommSuppressionReason.UNSUBSCRIBE, CommSuppressionReason.CONSENT_WITHDRAWN] } },
                data: { removed_at: now, removed_by_membership_id: ctx.membership_id },
            });
        }
        await this.audit.record(ctx, 'communications.consent.updated', {
            resource_type: 'comm_consent', resource_id: contactId,
            metadata: { channel, before: before ? { status: before.status, source: before.source } : null, after: { status: dto.status, source: data.source }, sensitive: true },
        });
        this.events.publish(ctx, { event_key: 'communications.consent.updated', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CRM_CONTACT, entity_id: contactId, payload: { channel, status: dto.status } });
        return consent;
    }

    // ------------------------------------------------------------------ suppressions

    async suppressions(ctx: OrgContext, query: SuppressionQuery) {
        const where: Prisma.CommSuppressionWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.removed ? { removed_at: { not: null } } : { removed_at: null }),
            ...(query.channel && { channel: query.channel }),
            ...(query.reason && { reason: query.reason }),
            ...(query.search && { address: { contains: query.search.toLowerCase() } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.commSuppression.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['created_at', 'address', 'expires_at'], 'created_at'),
                include: {
                    contact: { select: { id: true, first_name: true, last_name: true } },
                    campaign: { select: { id: true, name: true } },
                },
            }),
            this.prisma.commSuppression.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async addSuppression(ctx: OrgContext, dto: CreateSuppressionDto) {
        const address = normalizeAddress(dto.channel, dto.address);
        if (!address) throw new BadRequestException({ message: dto.channel === CommChannel.EMAIL ? 'Enter a valid email address' : 'Enter a phone number in E.164 format (+306912345678)', code: 'invalid_address' });
        const contact = await this.prisma.crmContact.findFirst({
            where: { organization_id: ctx.organization_id, ...(dto.channel === CommChannel.EMAIL ? { email: { equals: address, mode: 'insensitive' } } : { OR: [{ mobile: address }, { phone: address }] }) },
            select: { id: true },
        });
        const data = {
            reason: dto.reason ?? CommSuppressionReason.MANUAL,
            notes: dto.notes ?? null,
            expires_at: dto.expires_at ? new Date(dto.expires_at) : null,
            blocks_transactional: dto.blocks_transactional ?? false,
            contact_id: contact?.id ?? null,
            removed_at: null,
            removed_by_membership_id: null,
            created_by_membership_id: ctx.membership_id,
        };
        const row = await this.prisma.commSuppression.upsert({
            where: { organization_id_channel_address: { organization_id: ctx.organization_id, channel: dto.channel, address } },
            update: data,
            create: { organization_id: ctx.organization_id, channel: dto.channel, address, ...data },
        });
        await this.audit.record(ctx, 'communications.suppression.added', { resource_type: 'comm_suppression', resource_id: row.id, metadata: { channel: dto.channel, address, reason: data.reason, sensitive: true } });
        this.events.publish(ctx, { event_key: 'communications.suppression.added', module: ModuleKey.COMMUNICATION, entity_kind: 'comm_suppression', entity_id: row.id, payload: { channel: dto.channel, reason: data.reason } });
        return row;
    }

    async removeSuppression(ctx: OrgContext, id: string, reason?: string) {
        const row = await this.prisma.commSuppression.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!row) throw notFound('Suppression', 'suppression_not_found');
        const updated = await this.prisma.commSuppression.update({
            where: { id },
            data: { removed_at: new Date(), removed_by_membership_id: ctx.membership_id, notes: reason ? `${row.notes ? `${row.notes}\n` : ''}Removed: ${reason}` : row.notes },
        });
        await this.audit.record(ctx, 'communications.suppression.removed', { resource_type: 'comm_suppression', resource_id: id, metadata: { channel: row.channel, address: row.address, previous_reason: row.reason, reason, sensitive: true } });
        this.events.publish(ctx, { event_key: 'communications.suppression.removed', module: ModuleKey.COMMUNICATION, entity_kind: 'comm_suppression', entity_id: id, payload: { channel: row.channel } });
        return updated;
    }
}
