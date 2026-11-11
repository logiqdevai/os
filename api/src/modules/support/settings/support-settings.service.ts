import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { SupportSetupService } from '../common/support-setup.service';
import { SUPPORT_PERMS } from '../common/support.constants';
import { AI_SETTING_KEYS, UpdateSupportSettingsDto } from './dto/support-settings.dto';

@Injectable()
export class SupportSettingsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly setup: SupportSetupService,
    ) { }

    async get(ctx: OrgContext) {
        const settings = await this.setup.settings(ctx.organization_id);
        const ai = await this.aiStatus(ctx.organization_id);
        return { ...settings, ai_provider_connected: ai };
    }

    async update(ctx: OrgContext, dto: UpdateSupportSettingsDto) {
        const touchesAi = AI_SETTING_KEYS.some((k) => (dto as Record<string, unknown>)[k] !== undefined);
        if (touchesAi && !ctx.can(SUPPORT_PERMS.aiConfigure)) {
            throw new ForbiddenException({ message: 'Changing AI settings needs support.ai.configure', code: 'permission_denied', permissions: [SUPPORT_PERMS.aiConfigure] });
        }
        const touchesGeneral = Object.keys(dto).some((k) => !(AI_SETTING_KEYS as readonly string[]).includes(k) && (dto as Record<string, unknown>)[k] !== undefined);
        if (touchesGeneral && !ctx.can(SUPPORT_PERMS.settingsManage)) {
            throw new ForbiddenException({ message: 'Changing support settings needs support.settings.manage', code: 'permission_denied', permissions: [SUPPORT_PERMS.settingsManage] });
        }
        const before = await this.setup.settings(ctx.organization_id);
        if (dto.default_sla_policy_id) {
            const p = await this.prisma.slaPolicy.findFirst({ where: { id: dto.default_sla_policy_id, organization_id: ctx.organization_id, archived_at: null } });
            if (!p) throw new NotFoundException({ message: 'SLA policy not found', code: 'sla_policy_not_found' });
        }
        if (dto.default_inbox_id) {
            const i = await this.prisma.supportInbox.findFirst({ where: { id: dto.default_inbox_id, organization_id: ctx.organization_id, archived_at: null } });
            if (!i) throw new NotFoundException({ message: 'Inbox not found', code: 'inbox_not_found' });
        }
        const { task_priority_mapping, ...rest } = dto;
        const updated = await this.prisma.$transaction(async (tx) => {
            if (dto.default_sla_policy_id) {
                await tx.slaPolicy.updateMany({ where: { organization_id: ctx.organization_id }, data: { is_default: false } });
                await tx.slaPolicy.update({ where: { id: dto.default_sla_policy_id }, data: { is_default: true } });
            }
            if (dto.default_inbox_id) {
                await tx.supportInbox.updateMany({ where: { organization_id: ctx.organization_id }, data: { is_default: false } });
                await tx.supportInbox.update({ where: { id: dto.default_inbox_id }, data: { is_default: true } });
            }
            return tx.supportSettings.update({
                where: { organization_id: ctx.organization_id },
                data: {
                    ...rest,
                    ...(task_priority_mapping !== undefined && { task_priority_mapping: task_priority_mapping === null ? Prisma.DbNull : (task_priority_mapping as Prisma.InputJsonValue) }),
                },
            });
        });
        const changed = Object.fromEntries(Object.keys(dto).map((k) => [k, { from: (before as Record<string, unknown>)[k], to: (dto as Record<string, unknown>)[k] }]));
        await this.audit.record(ctx, touchesAi ? 'support.ai_settings.updated' : 'support.settings.updated', { resource_type: 'support_settings', resource_id: ctx.organization_id, metadata: { changes: changed } });
        this.events.publish(ctx, { event_key: 'support.settings.updated', module: ModuleKey.SUPPORT, entity_kind: 'support_settings', entity_id: ctx.organization_id, changes: dto as Record<string, unknown> });
        return { ...updated, ai_provider_connected: await this.aiStatus(ctx.organization_id) };
    }

    /** Whether the organization connected its own AI provider key (01 §157, BYOK). */
    private async aiStatus(organizationId: string) {
        const conn = await this.prisma.integrationConnection.findFirst({ where: { organization_id: organizationId, category: 'AI', status: 'ACTIVE' }, select: { id: true } }).catch(() => null);
        return !!conn;
    }
}
