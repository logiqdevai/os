import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { UpdateAutomationSettingsDto } from './dto/update-automation-settings.dto';

/** 20 §6, §8, §10 — per-organization engine guardrails (one row per organization, created on first read). */
@Injectable()
export class AutomationSettingsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    /** Engine-side read (no permission check): used by the rule engine, webhooks and jobs. */
    forOrganization(organizationId: string) {
        return this.prisma.automationSettings.upsert({
            where: { organization_id: organizationId },
            update: {},
            create: { organization_id: organizationId },
        });
    }

    async get(ctx: OrgContext) {
        const settings = await this.forOrganization(ctx.organization_id);
        const [defaultAccount, enabledBy] = await Promise.all([
            settings.default_service_account_id
                ? this.prisma.serviceAccount.findFirst({ where: { id: settings.default_service_account_id, organization_id: ctx.organization_id }, select: { id: true, name: true, status: true, expires_at: true } })
                : null,
            settings.destructive_actions_enabled_by_membership_id
                ? this.prisma.membership.findFirst({ where: { id: settings.destructive_actions_enabled_by_membership_id }, select: { id: true, user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } })
                : null,
        ]);
        return { ...settings, default_service_account: defaultAccount, destructive_actions_enabled_by: enabledBy };
    }

    async update(ctx: OrgContext, dto: UpdateAutomationSettingsDto) {
        const before = await this.forOrganization(ctx.organization_id);
        const data: Prisma.AutomationSettingsUpdateInput = { ...dto } as Prisma.AutomationSettingsUpdateInput;
        delete (data as Record<string, unknown>).default_service_account_id;

        if (dto.destructive_actions_enabled !== undefined && dto.destructive_actions_enabled !== before.destructive_actions_enabled) {
            if (!ctx.can('automation.actions.destructive.enable')) {
                throw new ForbiddenException({ message: 'Enabling destructive actions needs automation.actions.destructive.enable', code: 'permission_denied' });
            }
            data.destructive_actions_enabled_at = dto.destructive_actions_enabled ? new Date() : null;
            data.destructive_actions_enabled_by_membership_id = dto.destructive_actions_enabled ? ctx.membership_id : null;
        }
        if (dto.default_service_account_id !== undefined && dto.default_service_account_id !== before.default_service_account_id) {
            if (!ctx.can('automation.service_accounts.manage')) {
                throw new ForbiddenException({ message: 'Changing the default service account needs automation.service_accounts.manage', code: 'permission_denied' });
            }
            if (dto.default_service_account_id) {
                const sa = await this.prisma.serviceAccount.findFirst({ where: { id: dto.default_service_account_id, organization_id: ctx.organization_id } });
                if (!sa) throw new NotFoundException({ message: 'Service account not found', code: 'service_account_not_found' });
                if (sa.status !== 'ACTIVE') throw new BadRequestException({ message: 'The service account is not active', code: 'service_account_inactive' });
            }
            data.default_service_account = dto.default_service_account_id ? { connect: { id: dto.default_service_account_id } } : { disconnect: true };
        }
        if (dto.dead_letter_alert_membership_ids?.length) {
            const count = await this.prisma.membership.count({ where: { id: { in: dto.dead_letter_alert_membership_ids }, organization_id: ctx.organization_id } });
            if (count !== new Set(dto.dead_letter_alert_membership_ids).size) throw new BadRequestException({ message: 'Unknown member in dead-letter recipients', code: 'membership_not_found' });
        }

        const updated = await this.prisma.automationSettings.update({ where: { organization_id: ctx.organization_id }, data });
        await this.audit.record(ctx, 'automation.settings.updated', {
            resource_type: 'automation_settings',
            resource_id: ctx.organization_id,
            metadata: { before: pick(before, Object.keys(dto)), after: dto },
        });
        this.events.publish(ctx, { event_key: 'automation.settings.updated', module: ModuleKey.AUTOMATION, entity_kind: 'automation_settings', entity_id: ctx.organization_id, changes: dto as Record<string, unknown> });
        return updated;
    }
}

function pick(obj: Record<string, unknown>, keys: string[]) {
    return Object.fromEntries(keys.map((k) => [k, obj[k]]));
}
