import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { CrmCompanyType, ModuleKey, RecordEntityType } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { CrmCompaniesService } from '../companies/companies.service';
import { CrmContactsService } from '../contacts/contacts.service';
import { CrmLeadsService } from '../leads/leads.service';
import { CrmDealsService } from '../deals/deals.service';
import { TagsService } from '../tags/tags.service';

export const BulkActionSchema = z.object({
    entity_type: z.enum(['CRM_COMPANY', 'CRM_CONTACT', 'CRM_LEAD', 'CRM_DEAL']),
    ids: z.array(z.string().uuid()).min(1).max(200),
    action: z.enum(['assign', 'add_tag', 'remove_tag', 'set_status', 'set_stage', 'set_lifecycle', 'set_type', 'archive', 'restore']),
    owner_membership_id: z.string().uuid().optional(),
    tag_id: z.string().uuid().optional(),
    /** Leads: lead status. */
    status_id: z.string().uuid().optional(),
    /** Deals: pipeline stage (same pipeline as each deal). */
    stage_id: z.string().uuid().optional(),
    /** Lost status / lost stage need a reason. */
    lost_reason_id: z.string().uuid().optional(),
    lifecycle_stage_id: z.string().uuid().optional(),
    type: z.nativeEnum(CrmCompanyType).optional(),
});
export type BulkActionInput = z.infer<typeof BulkActionSchema>;

const RES: Record<BulkActionInput['entity_type'], string> = { CRM_COMPANY: 'companies', CRM_CONTACT: 'contacts', CRM_LEAD: 'leads', CRM_DEAL: 'deals' };

/** Which actions each record type supports and the permission key they need. */
const ACTION_KEY: Record<BulkActionInput['action'], (res: string) => string> = {
    assign: (r) => `crm.${r}.assign`,
    add_tag: (r) => `crm.${r}.update`,
    remove_tag: (r) => `crm.${r}.update`,
    set_status: (r) => `crm.${r}.update`,
    set_stage: () => 'crm.deals.change_stage',
    set_lifecycle: (r) => `crm.${r}.update`,
    set_type: (r) => `crm.${r}.update`,
    archive: (r) => `crm.${r}.archive`,
    restore: (r) => `crm.${r}.archive`,
};
const SUPPORTED: Record<BulkActionInput['entity_type'], BulkActionInput['action'][]> = {
    CRM_COMPANY: ['assign', 'add_tag', 'remove_tag', 'set_lifecycle', 'set_type', 'archive', 'restore'],
    CRM_CONTACT: ['assign', 'add_tag', 'remove_tag', 'set_lifecycle', 'archive', 'restore'],
    CRM_LEAD: ['assign', 'add_tag', 'remove_tag', 'set_status', 'archive', 'restore'],
    CRM_DEAL: ['assign', 'add_tag', 'remove_tag', 'set_stage', 'archive', 'restore'],
};

const reason = (e: unknown) => {
    const r = (e as { response?: { message?: string; code?: string } }).response;
    return r?.message ?? (e as Error).message ?? 'Failed';
};

/**
 * 02 §20, §29 — bulk actions on list selections. Each record runs through the same service method as a single
 * edit, so permission, scope (records outside it fail as "not found"), audit and events apply per record. A summary
 * audit event records the action and counts. Partial success is normal: the response lists every failure.
 */
@Injectable()
export class CrmBulkService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly companies: CrmCompaniesService,
        private readonly contacts: CrmContactsService,
        private readonly leads: CrmLeadsService,
        private readonly deals: CrmDealsService,
        private readonly tags: TagsService,
    ) { }

    async run(ctx: OrgContext, dto: BulkActionInput) {
        const res = RES[dto.entity_type];
        if (!SUPPORTED[dto.entity_type].includes(dto.action)) throw new BadRequestException({ message: `${dto.action} is not available for ${res}`, code: 'bulk_action_unsupported' });
        const key = ACTION_KEY[dto.action](res);
        if (!ctx.can(key)) throw new ForbiddenException({ message: `Missing permission ${key}`, code: 'permission_denied', permission: key });
        const need = (v: unknown, field: string) => { if (!v) throw new BadRequestException({ message: `${field} is required for ${dto.action}`, code: 'bulk_param_required', field }); };
        if (dto.action === 'assign') need(dto.owner_membership_id, 'owner_membership_id');
        if (dto.action === 'add_tag' || dto.action === 'remove_tag') need(dto.tag_id, 'tag_id');
        if (dto.action === 'set_status') need(dto.status_id, 'status_id');
        if (dto.action === 'set_stage') need(dto.stage_id, 'stage_id');
        if (dto.action === 'set_lifecycle') need(dto.lifecycle_stage_id, 'lifecycle_stage_id');
        if (dto.action === 'set_type') need(dto.type, 'type');

        const ids = [...new Set(dto.ids)];
        const succeeded: string[] = [];
        const failed: { id: string; reason: string }[] = [];
        for (const id of ids) {
            try {
                await this.one(ctx, dto, id);
                succeeded.push(id);
            } catch (e) {
                failed.push({ id, reason: reason(e) });
            }
        }
        await this.audit.record(ctx, 'crm.records.bulk_updated', {
            resource_type: `crm_${res}`,
            metadata: { action: dto.action, entity_type: dto.entity_type, requested: ids.length, succeeded: succeeded.length, failed: failed.length, params: { owner_membership_id: dto.owner_membership_id, tag_id: dto.tag_id, status_id: dto.status_id, stage_id: dto.stage_id, lifecycle_stage_id: dto.lifecycle_stage_id, type: dto.type } },
        });
        if (succeeded.length) this.events.publish(ctx, { event_key: 'crm.records.bulk_updated', module: ModuleKey.CRM, payload: { entity_type: dto.entity_type, action: dto.action, count: succeeded.length } });
        return { requested: ids.length, succeeded, failed };
    }

    private async one(ctx: OrgContext, dto: BulkActionInput, id: string) {
        const t = dto.entity_type;
        switch (dto.action) {
            case 'assign':
                if (t === 'CRM_COMPANY') return this.companies.assign(ctx, id, dto.owner_membership_id!);
                if (t === 'CRM_CONTACT') return this.contacts.assign(ctx, id, dto.owner_membership_id!);
                if (t === 'CRM_LEAD') return this.leads.assign(ctx, id, dto.owner_membership_id!);
                return this.deals.assign(ctx, id, dto.owner_membership_id!);
            case 'add_tag': case 'remove_tag': {
                const current = await this.prisma.tagging.findMany({ where: { entity_type: t as RecordEntityType, entity_id: id }, select: { tag_id: true } });
                const ids = current.map((c) => c.tag_id);
                const next = dto.action === 'add_tag' ? [...new Set([...ids, dto.tag_id!])] : ids.filter((x) => x !== dto.tag_id);
                if (next.length === ids.length && next.every((x) => ids.includes(x))) return null;
                return this.tags.setTaggings(ctx, { entity_type: t as RecordEntityType, entity_id: id, tag_ids: next });
            }
            case 'set_status':
                return this.leads.setStatus(ctx, id, { status_id: dto.status_id!, lost_reason_id: dto.lost_reason_id });
            case 'set_stage':
                return this.deals.changeStage(ctx, id, { stage_id: dto.stage_id!, lost_reason_id: dto.lost_reason_id });
            case 'set_lifecycle':
                return t === 'CRM_COMPANY' ? this.companies.update(ctx, id, { lifecycle_stage_id: dto.lifecycle_stage_id }) : this.contacts.update(ctx, id, { lifecycle_stage_id: dto.lifecycle_stage_id });
            case 'set_type':
                return this.companies.update(ctx, id, { type: dto.type });
            case 'archive': case 'restore': {
                const archived = dto.action === 'archive';
                if (t === 'CRM_COMPANY') return archived ? this.companies.archive(ctx, id) : this.companies.restore(ctx, id);
                if (t === 'CRM_CONTACT') return this.contacts.archive(ctx, id, archived);
                if (t === 'CRM_LEAD') return this.leads.archive(ctx, id, archived);
                return this.deals.archive(ctx, id, archived);
            }
        }
    }
}
