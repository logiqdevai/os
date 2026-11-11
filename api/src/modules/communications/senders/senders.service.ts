import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { CommChannel, CommSenderDomainStatus, CommSenderIdentityStatus, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { isUniqueError, normalizeAddress, notFound } from '../common/comm.utils';
import { CommProviderService, ProviderError } from '../delivery/comm-provider.service';
import { CreateSenderDomainDto, CreateSenderIdentityDto, UpdateSenderIdentityDto } from './dto/sender.dto';

/** Sending domains (SPF / DKIM / DMARC) and sender identities (from addresses, SMS sender ids) — 11 "Email Management". */
@Injectable()
export class SendersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly providers: CommProviderService,
    ) { }

    // ------------------------------------------------------------------ domains

    listDomains(ctx: OrgContext) {
        return this.prisma.commSenderDomain.findMany({
            where: { organization_id: ctx.organization_id },
            orderBy: { created_at: 'asc' },
            include: { _count: { select: { identities: true } } },
        });
    }

    private async domain(ctx: OrgContext, id: string) {
        const row = await this.prisma.commSenderDomain.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!row) throw notFound('Sender domain', 'sender_domain_not_found');
        return row;
    }

    async createDomain(ctx: OrgContext, dto: CreateSenderDomainDto) {
        const domain = dto.domain.trim().toLowerCase();
        const provider = await this.providers.resolve(ctx.organization_id, CommChannel.EMAIL);
        let provider_domain_id: string | null = null;
        let dns_records: unknown[] = [
            { record: 'SPF', type: 'TXT', name: `send.${domain}`, value: 'v=spf1 include:amazonses.com ~all', status: 'not_started' },
            { record: 'DMARC', type: 'TXT', name: `_dmarc.${domain}`, value: 'v=DMARC1; p=none;', status: 'not_started' },
        ];
        let failure_reason: string | null = 'Connect Resend in Admin → Integrations to get the DKIM records and verify this domain.';
        if (provider) {
            try {
                const res = await this.providers.createDomain(provider, domain);
                provider_domain_id = res.provider_domain_id;
                dns_records = [...res.records, { record: 'DMARC', type: 'TXT', name: `_dmarc.${domain}`, value: 'v=DMARC1; p=none;', status: 'recommended' }];
                failure_reason = null;
            } catch (e) {
                failure_reason = (e as Error).message;
            }
        }
        try {
            const row = await this.prisma.commSenderDomain.create({
                data: { organization_id: ctx.organization_id, domain, tracking_domain: dto.tracking_domain ?? null, provider_domain_id, dns_records: dns_records as Prisma.InputJsonValue, failure_reason },
            });
            await this.audit.record(ctx, 'communications.sender_domain.created', { resource_type: 'comm_sender_domain', resource_id: row.id, metadata: { after: { domain } } });
            this.events.publish(ctx, { event_key: 'communications.sender_domain.created', module: ModuleKey.COMMUNICATION, entity_kind: 'comm_sender_domain', entity_id: row.id, payload: { domain } });
            return row;
        } catch (error) {
            if (isUniqueError(error)) throw new ConflictException({ message: 'This domain is already added', code: 'sender_domain_exists' });
            throw error;
        }
    }

    async verifyDomain(ctx: OrgContext, id: string) {
        const row = await this.domain(ctx, id);
        const provider = await this.providers.resolve(ctx.organization_id, CommChannel.EMAIL);
        const now = new Date();
        if (!provider || !row.provider_domain_id) {
            const updated = await this.prisma.commSenderDomain.update({
                where: { id },
                data: { last_checked_at: now, failure_reason: provider ? 'Domain is not registered at the provider. Remove it and add it again.' : this.providers.noProviderReason(CommChannel.EMAIL) },
            });
            return updated;
        }
        let data: Prisma.CommSenderDomainUpdateInput;
        try {
            const res = await this.providers.verifyDomain(provider, row.provider_domain_id);
            const verified = res.status === 'verified';
            const records = res.records as { record: string; status: string }[];
            const ok = (kind: string) => records.filter((r) => r.record === kind).every((r) => r.status === 'verified') && records.some((r) => r.record === kind);
            data = {
                status: verified ? CommSenderDomainStatus.VERIFIED : res.status === 'failed' ? CommSenderDomainStatus.FAILED : CommSenderDomainStatus.PENDING,
                dns_records: [...records, ...((row.dns_records as unknown[]) ?? []).filter((r) => (r as { record?: string }).record === 'DMARC')] as Prisma.InputJsonValue,
                spf_verified_at: ok('SPF') ? row.spf_verified_at ?? now : null,
                dkim_verified_at: ok('DKIM') ? row.dkim_verified_at ?? now : null,
                verified_at: verified ? row.verified_at ?? now : null,
                failure_reason: verified ? null : res.status === 'failed' ? 'DNS records not found. Publish the records below and try again.' : 'Verification in progress. DNS changes can take up to 72 hours.',
                last_checked_at: now,
            };
        } catch (e) {
            data = { last_checked_at: now, failure_reason: e instanceof ProviderError ? e.message : 'Verification failed' };
        }
        const updated = await this.prisma.commSenderDomain.update({ where: { id }, data });
        if (updated.status === CommSenderDomainStatus.VERIFIED && row.status !== CommSenderDomainStatus.VERIFIED) {
            // Identities on a verified domain become usable.
            await this.prisma.commSenderIdentity.updateMany({
                where: { organization_id: ctx.organization_id, channel: CommChannel.EMAIL, address: { endsWith: `@${row.domain}` }, status: CommSenderIdentityStatus.PENDING_VERIFICATION },
                data: { status: CommSenderIdentityStatus.VERIFIED, verified_at: now, sender_domain_id: id, failure_reason: null },
            });
        }
        await this.audit.record(ctx, 'communications.sender_domain.verified', { resource_type: 'comm_sender_domain', resource_id: id, metadata: { status: updated.status } });
        return updated;
    }

    async removeDomain(ctx: OrgContext, id: string) {
        const row = await this.domain(ctx, id);
        await this.prisma.commSenderDomain.delete({ where: { id } });
        await this.audit.record(ctx, 'communications.sender_domain.deleted', { resource_type: 'comm_sender_domain', resource_id: id, metadata: { before: { domain: row.domain } } });
        this.events.publish(ctx, { event_key: 'communications.sender_domain.deleted', module: ModuleKey.COMMUNICATION, entity_kind: 'comm_sender_domain', entity_id: id, payload: { domain: row.domain } });
        return { success: true };
    }

    // ------------------------------------------------------------------ identities

    listIdentities(ctx: OrgContext, channel?: CommChannel) {
        return this.prisma.commSenderIdentity.findMany({
            where: { organization_id: ctx.organization_id, ...(channel && { channel }) },
            orderBy: [{ channel: 'asc' }, { is_default: 'desc' }, { address: 'asc' }],
            include: { sender_domain: { select: { id: true, domain: true, status: true } }, branch: { select: { id: true, name: true } } },
        });
    }

    async identity(ctx: OrgContext, id: string) {
        const row = await this.prisma.commSenderIdentity.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!row) throw notFound('Sender identity', 'sender_identity_not_found');
        return row;
    }

    private async checkAddress(ctx: OrgContext, channel: CommChannel, raw: string) {
        if (channel === CommChannel.EMAIL) {
            const address = normalizeAddress(channel, raw);
            if (!address) throw new BadRequestException({ message: 'Enter a valid email address', code: 'invalid_address' });
            const domainName = address.split('@')[1];
            const domain = await this.prisma.commSenderDomain.findFirst({ where: { organization_id: ctx.organization_id, domain: domainName } });
            return {
                address,
                sender_domain_id: domain?.id ?? null,
                status: domain?.status === CommSenderDomainStatus.VERIFIED ? CommSenderIdentityStatus.VERIFIED : CommSenderIdentityStatus.PENDING_VERIFICATION,
                failure_reason: domain?.status === CommSenderDomainStatus.VERIFIED ? null : `Add and verify the domain ${domainName} to send from this address.`,
            };
        }
        const trimmed = raw.trim();
        const phone = normalizeAddress(channel, trimmed);
        const alpha = /^[A-Za-z0-9 ]{3,11}$/.test(trimmed) && /[A-Za-z]/.test(trimmed);
        if (!phone && !alpha) throw new BadRequestException({ message: 'Enter an E.164 number (+306912345678) or an alphanumeric sender id (3–11 characters)', code: 'invalid_address' });
        const provider = await this.providers.resolve(ctx.organization_id, CommChannel.SMS);
        return {
            address: phone ?? trimmed,
            sender_domain_id: null,
            status: provider ? CommSenderIdentityStatus.VERIFIED : CommSenderIdentityStatus.PENDING_VERIFICATION,
            failure_reason: provider ? null : this.providers.noProviderReason(CommChannel.SMS),
        };
    }

    async createIdentity(ctx: OrgContext, dto: CreateSenderIdentityDto) {
        const checked = await this.checkAddress(ctx, dto.channel, dto.address);
        if (dto.branch_id) await this.prisma.branch.findFirstOrThrow({ where: { id: dto.branch_id, organization_id: ctx.organization_id } }).catch(() => { throw notFound('Branch', 'branch_not_found'); });
        try {
            const row = await this.prisma.$transaction(async (tx) => {
                if (dto.is_default) await tx.commSenderIdentity.updateMany({ where: { organization_id: ctx.organization_id, channel: dto.channel }, data: { is_default: false } });
                const hasDefault = await tx.commSenderIdentity.count({ where: { organization_id: ctx.organization_id, channel: dto.channel, is_default: true } });
                return tx.commSenderIdentity.create({
                    data: {
                        organization_id: ctx.organization_id,
                        channel: dto.channel,
                        address: checked.address,
                        display_name: dto.display_name ?? null,
                        reply_to_address: dto.reply_to_address ?? null,
                        branch_id: dto.branch_id ?? null,
                        sender_domain_id: checked.sender_domain_id,
                        status: checked.status,
                        verified_at: checked.status === CommSenderIdentityStatus.VERIFIED ? new Date() : null,
                        failure_reason: checked.failure_reason,
                        is_default: dto.is_default ?? hasDefault === 0,
                    },
                });
            });
            await this.audit.record(ctx, 'communications.sender_identity.created', { resource_type: 'comm_sender_identity', resource_id: row.id, branch_id: row.branch_id, metadata: { after: { channel: row.channel, address: row.address } } });
            this.events.publish(ctx, { event_key: 'communications.sender_identity.created', module: ModuleKey.COMMUNICATION, entity_kind: 'comm_sender_identity', entity_id: row.id, payload: { channel: row.channel, address: row.address } });
            return row;
        } catch (error) {
            if (isUniqueError(error)) throw new ConflictException({ message: 'This sender already exists', code: 'sender_identity_exists' });
            throw error;
        }
    }

    async updateIdentity(ctx: OrgContext, id: string, dto: UpdateSenderIdentityDto) {
        const before = await this.identity(ctx, id);
        const channel = dto.channel ?? before.channel;
        const checked = dto.address && dto.address !== before.address ? await this.checkAddress(ctx, channel, dto.address) : null;
        const row = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.commSenderIdentity.updateMany({ where: { organization_id: ctx.organization_id, channel, id: { not: id } }, data: { is_default: false } });
            return tx.commSenderIdentity.update({
                where: { id },
                data: {
                    display_name: dto.display_name,
                    reply_to_address: dto.reply_to_address,
                    branch_id: dto.branch_id,
                    is_default: dto.is_default,
                    ...(checked && { address: checked.address, status: checked.status, sender_domain_id: checked.sender_domain_id, failure_reason: checked.failure_reason, verified_at: checked.status === 'VERIFIED' ? new Date() : null }),
                },
            });
        }).catch((error) => {
            if (isUniqueError(error)) throw new ConflictException({ message: 'This sender already exists', code: 'sender_identity_exists' });
            throw error;
        });
        await this.audit.record(ctx, 'communications.sender_identity.updated', { resource_type: 'comm_sender_identity', resource_id: id, metadata: { before: { address: before.address, display_name: before.display_name }, after: dto } });
        this.events.publish(ctx, { event_key: 'communications.sender_identity.updated', module: ModuleKey.COMMUNICATION, entity_kind: 'comm_sender_identity', entity_id: id, payload: { address: row.address } });
        return row;
    }

    async verifyIdentity(ctx: OrgContext, id: string) {
        const row = await this.identity(ctx, id);
        const checked = await this.checkAddress(ctx, row.channel, row.address);
        const updated = await this.prisma.commSenderIdentity.update({
            where: { id },
            data: { status: checked.status, sender_domain_id: checked.sender_domain_id, failure_reason: checked.failure_reason, verified_at: checked.status === 'VERIFIED' ? row.verified_at ?? new Date() : null },
        });
        await this.audit.record(ctx, 'communications.sender_identity.verified', { resource_type: 'comm_sender_identity', resource_id: id, metadata: { status: updated.status } });
        return updated;
    }

    async removeIdentity(ctx: OrgContext, id: string) {
        const row = await this.identity(ctx, id);
        await this.prisma.commSenderIdentity.delete({ where: { id } });
        await this.audit.record(ctx, 'communications.sender_identity.deleted', { resource_type: 'comm_sender_identity', resource_id: id, metadata: { before: { address: row.address, channel: row.channel } } });
        this.events.publish(ctx, { event_key: 'communications.sender_identity.deleted', module: ModuleKey.COMMUNICATION, entity_kind: 'comm_sender_identity', entity_id: id, payload: { address: row.address } });
        return { success: true };
    }

    /** Default verified identity for a channel (branch-specific first). */
    async defaultIdentity(organizationId: string, channel: CommChannel, branchId?: string | null) {
        const rows = await this.prisma.commSenderIdentity.findMany({
            where: { organization_id: organizationId, channel, status: CommSenderIdentityStatus.VERIFIED },
            orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
        });
        return rows.find((r) => branchId && r.branch_id === branchId) ?? rows.find((r) => !r.branch_id && r.is_default) ?? rows[0] ?? null;
    }
}
