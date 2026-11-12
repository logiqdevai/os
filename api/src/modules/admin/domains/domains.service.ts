import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { resolveTxt } from 'node:dns/promises';
import { randomBytes } from 'crypto';
import { DomainVerificationStatus, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { CreateDomainInput, DomainQuery, UpdateDomainInput } from './dto/domain.dto';

/** DNS record the organization adds to prove ownership (01 §70). */
export const VERIFICATION_PREFIX = '_logiq-verify';
const DNS_TIMEOUT_MS = 8_000;

/**
 * Verified corporate email domains (01 §70, mockup 01-admin `domains` / `domainNew`). Ownership is proven with a DNS TXT
 * record `_logiq-verify.<domain>` = `lq-verify=<token>` (the apex TXT is accepted too). A verified domain never grants
 * membership by itself; allow_discovery / auto_provision only take effect where sign-in / SSO honour them.
 */
@Injectable()
export class DomainsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    async findAll(ctx: OrgContext, query: DomainQuery) {
        const where: Prisma.OrganizationDomainWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.status && { status: query.status }),
            ...(query.search && { domain: { contains: query.search.toLowerCase() } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.organizationDomain.findMany({ where, ...skipTake(query), orderBy: orderBy(query, ['domain', 'created_at', 'status'], 'created_at') }),
            this.prisma.organizationDomain.count({ where }),
        ]);
        const counts = await Promise.all(
            items.map((d) => this.prisma.membership.count({ where: { organization_id: ctx.organization_id, status: 'ACTIVE', user: { email: { endsWith: `@${d.domain}`, mode: 'insensitive' } } } })),
        );
        return paginate(items.map((d, i) => this.present(d, counts[i])), total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const domain = await this.prisma.organizationDomain.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!domain) throw new NotFoundException({ message: 'Domain not found', code: 'domain_not_found' });
        return domain;
    }

    async get(ctx: OrgContext, id: string) {
        return this.present(await this.findOne(ctx, id));
    }

    async create(ctx: OrgContext, dto: CreateDomainInput) {
        const existing = await this.prisma.organizationDomain.findUnique({ where: { domain: dto.domain }, select: { organization_id: true } });
        if (existing) {
            throw new ConflictException({
                message: existing.organization_id === ctx.organization_id ? 'This domain is already added' : 'This domain is registered by another organization',
                code: 'domain_taken',
            });
        }
        try {
            const domain = await this.prisma.organizationDomain.create({
                data: {
                    organization_id: ctx.organization_id,
                    domain: dto.domain,
                    verification_token: `lq-verify=${randomBytes(16).toString('hex')}`,
                    allow_discovery: dto.allow_discovery ?? false,
                    auto_provision: dto.auto_provision ?? false,
                },
            });
            await this.audit.record(ctx, 'domain.added', { resource_type: 'organization_domain', resource_id: domain.id, metadata: { domain: domain.domain } });
            this.events.publish(ctx, { event_key: 'organizations.domain.added', module: ModuleKey.ADMINISTRATION, entity_kind: 'organization_domain', entity_id: domain.id, payload: { domain: domain.domain } });
            return this.present(domain);
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException({ message: 'This domain is already registered', code: 'domain_taken' });
            }
            throw error;
        }
    }

    async update(ctx: OrgContext, id: string, dto: UpdateDomainInput) {
        const before = await this.findOne(ctx, id);
        if (dto.auto_provision && before.status !== DomainVerificationStatus.VERIFIED) {
            throw new BadRequestException({ message: 'Verify the domain before turning on auto-provisioning', code: 'domain_not_verified' });
        }
        const domain = await this.prisma.organizationDomain.update({ where: { id }, data: dto });
        await this.audit.record(ctx, 'domain.updated', {
            resource_type: 'organization_domain',
            resource_id: id,
            metadata: { domain: domain.domain, before: { allow_discovery: before.allow_discovery, auto_provision: before.auto_provision }, after: dto },
        });
        return this.present(domain);
    }

    /** Look up the TXT record now and store the result (status, dns_check, last_checked_at). */
    async verify(ctx: OrgContext, id: string) {
        const before = await this.findOne(ctx, id);
        const recordName = `${VERIFICATION_PREFIX}.${before.domain}`;
        const [named, apex] = await Promise.all([this.lookupTxt(recordName), this.lookupTxt(before.domain)]);
        const found = [...named.values, ...apex.values];
        const ok = found.some((v) => v.trim() === before.verification_token);
        const now = new Date();
        const dns_check = {
            txt: { ok, name: recordName, expected: before.verification_token, found: found.slice(0, 10), error: ok ? null : named.error ?? apex.error ?? (found.length ? 'record_mismatch' : 'record_not_found') },
        };
        const domain = await this.prisma.organizationDomain.update({
            where: { id },
            data: {
                status: ok ? DomainVerificationStatus.VERIFIED : before.status === DomainVerificationStatus.VERIFIED ? DomainVerificationStatus.VERIFIED : DomainVerificationStatus.FAILED,
                verified_at: ok ? before.verified_at ?? now : before.verified_at,
                dns_check,
                last_checked_at: now,
            },
        });
        if (ok && before.status !== DomainVerificationStatus.VERIFIED) {
            await this.audit.record(ctx, 'domain.verified', { resource_type: 'organization_domain', resource_id: id, metadata: { domain: domain.domain } });
            this.events.publish(ctx, { event_key: 'organizations.domain.verified', module: ModuleKey.ADMINISTRATION, entity_kind: 'organization_domain', entity_id: id, payload: { domain: domain.domain } });
        } else if (!ok) {
            await this.audit.record(ctx, 'domain.verification_failed', { resource_type: 'organization_domain', resource_id: id, outcome: 'FAILURE', metadata: { domain: domain.domain, reason: dns_check.txt.error } });
        }
        return this.present(domain);
    }

    /** Remove the domain (frees it for others). Blocked while SSO is required and this is the last verified domain. */
    async remove(ctx: OrgContext, id: string) {
        const domain = await this.findOne(ctx, id);
        if (domain.status === DomainVerificationStatus.VERIFIED) {
            const [policy, otherVerified] = await Promise.all([
                this.prisma.organizationSecurityPolicy.findUnique({ where: { organization_id: ctx.organization_id }, select: { sso_required: true } }),
                this.prisma.organizationDomain.count({ where: { organization_id: ctx.organization_id, status: DomainVerificationStatus.VERIFIED, id: { not: id } } }),
            ]);
            if (policy?.sso_required && !otherVerified) {
                throw new ConflictException({ message: 'SSO is required and this is your only verified domain. Turn off “Require SSO” first.', code: 'domain_required_by_sso' });
            }
        }
        await this.prisma.organizationDomain.delete({ where: { id } });
        await this.audit.record(ctx, 'domain.revoked', { resource_type: 'organization_domain', resource_id: id, metadata: { domain: domain.domain, status: domain.status } });
        this.events.publish(ctx, { event_key: 'organizations.domain.removed', module: ModuleKey.ADMINISTRATION, entity_kind: 'organization_domain', entity_id: id, payload: { domain: domain.domain } });
        return { success: true };
    }

    private async lookupTxt(name: string): Promise<{ values: string[]; error: string | null }> {
        try {
            const records = await Promise.race([
                resolveTxt(name),
                new Promise<never>((_, reject) => setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), DNS_TIMEOUT_MS)),
            ]);
            return { values: records.map((chunks) => chunks.join('')), error: null };
        } catch (error) {
            const code = (error as { code?: string }).code;
            return { values: [], error: code === 'ENOTFOUND' || code === 'ENODATA' ? 'record_not_found' : code === 'ETIMEOUT' ? 'dns_timeout' : 'dns_error' };
        }
    }

    /** API shape: the DNS record to add is spelled out so the UI never builds it. */
    private present<T extends { domain: string; verification_token: string }>(d: T, members_using?: number) {
        return {
            ...d,
            dns_record: { type: 'TXT', name: `${VERIFICATION_PREFIX}.${d.domain}`, value: d.verification_token },
            ...(members_using !== undefined && { members_using }),
        };
    }
}
