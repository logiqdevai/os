import { BadRequestException, Injectable } from '@nestjs/common';
import { MembershipStatus, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { UpdateBrandingDto, UpdateOrganizationDto } from './dto/organization.dto';

const MODULE = ModuleKey.ADMINISTRATION;
/** Modules that can never be switched off (the admin area itself). */
const ALWAYS_ON: ModuleKey[] = [ModuleKey.ADMINISTRATION];

/** Organization profile, branding (01 §8–15) and module enablement (01 §56). */
@Injectable()
export class OrganizationService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly authorization: AuthorizationService,
    ) { }

    async get(ctx: OrgContext) {
        return this.prisma.organization.findUniqueOrThrow({
            where: { id: ctx.organization_id },
            select: {
                id: true, legal_name: true, display_name: true, short_name: true, slug: true, logo_url: true, website: true, country: true,
                contact_email: true, contact_phone: true, address: true, status: true, default_currency: true, default_timezone: true,
                default_language: true, default_locale: true, date_format: true, number_format: true, week_start: true, branding: true, created_at: true,
            },
        });
    }

    async update(ctx: OrgContext, dto: UpdateOrganizationDto) {
        const before = await this.get(ctx);
        const data = { ...dto, ...(dto.website !== undefined && { website: dto.website || null }), ...(dto.contact_email !== undefined && { contact_email: dto.contact_email || null }) };
        await this.prisma.organization.update({ where: { id: ctx.organization_id }, data });
        const changed = Object.keys(dto).filter((k) => (before as Record<string, unknown>)[k] !== (dto as Record<string, unknown>)[k]);
        await this.audit.record(ctx, 'organization.updated', {
            resource_type: 'organization', resource_id: ctx.organization_id,
            metadata: { section: 'profile', before: Object.fromEntries(changed.map((k) => [k, (before as Record<string, unknown>)[k]])), after: Object.fromEntries(changed.map((k) => [k, (dto as Record<string, unknown>)[k]])) },
        });
        this.events.publish(ctx, { event_key: 'organizations.organization.updated', module: MODULE, entity_kind: 'organization', entity_id: ctx.organization_id, changes: dto as Record<string, unknown> });
        return this.get(ctx);
    }

    async updateBranding(ctx: OrgContext, dto: UpdateBrandingDto) {
        const before = await this.get(ctx);
        const current = (before.branding ?? {}) as Record<string, unknown>;
        const next: Record<string, unknown> = { ...current };
        for (const [k, v] of Object.entries(dto)) {
            if (v === '' || v === null) delete next[k];
            else if (v !== undefined) next[k] = v;
        }
        await this.prisma.organization.update({
            where: { id: ctx.organization_id },
            data: { branding: next as Prisma.InputJsonValue },
        });
        await this.audit.record(ctx, 'organization.updated', { resource_type: 'organization', resource_id: ctx.organization_id, metadata: { section: 'branding', before: current, after: next } });
        this.events.publish(ctx, { event_key: 'organizations.branding.updated', module: MODULE, entity_kind: 'organization', entity_id: ctx.organization_id, payload: next });
        return this.get(ctx);
    }

    // ---------------------------------------------------------------------------------------------
    // Modules
    // ---------------------------------------------------------------------------------------------

    async modules(ctx: OrgContext) {
        const [rows, overrides, members] = await Promise.all([
            this.prisma.organizationModule.findMany({ where: { organization_id: ctx.organization_id } }),
            this.prisma.membershipModuleAccess.groupBy({
                by: ['module'],
                where: { enabled: false, membership: { organization_id: ctx.organization_id, status: MembershipStatus.ACTIVE } },
                _count: { _all: true },
            }),
            this.prisma.membership.count({ where: { organization_id: ctx.organization_id, status: MembershipStatus.ACTIVE } }),
        ]);
        return (Object.values(ModuleKey) as ModuleKey[]).map((module) => {
            const row = rows.find((r) => r.module === module);
            const blocked = overrides.find((o) => o.module === module)?._count._all ?? 0;
            return {
                module,
                enabled: row ? row.enabled : true,
                enabled_at: row?.enabled_at ?? null,
                disabled_at: row?.disabled_at ?? null,
                locked: ALWAYS_ON.includes(module),
                members_blocked: blocked,
                active_members: members,
            };
        });
    }

    async setModule(ctx: OrgContext, module: ModuleKey, enabled: boolean) {
        if (!enabled && ALWAYS_ON.includes(module)) throw new BadRequestException({ message: 'Administration cannot be disabled', code: 'module_locked' });
        const now = new Date();
        const row = await this.prisma.organizationModule.upsert({
            where: { organization_id_module: { organization_id: ctx.organization_id, module } },
            update: { enabled, ...(enabled ? { enabled_at: now } : { disabled_at: now }) },
            create: { organization_id: ctx.organization_id, module, enabled, ...(enabled ? { enabled_at: now } : { disabled_at: now }) },
        });
        await this.authorization.invalidate(ctx.organization_id);
        await this.audit.record(ctx, enabled ? 'organization.module_enabled' : 'organization.module_disabled', { resource_type: 'organization_module', resource_id: row.id, metadata: { module } });
        this.events.publish(ctx, { event_key: enabled ? 'organizations.module.enabled' : 'organizations.module.disabled', module: MODULE, entity_kind: 'organization_module', entity_id: row.id, payload: { module } });
        return row;
    }
}
