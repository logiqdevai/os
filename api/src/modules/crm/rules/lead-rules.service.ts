import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CrmLead, ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { domainOf } from '../common/crm-scope.utils';
import {
    AssignTo, CreateAssignmentRuleInput, CreateScoringRuleInput, RuleCondition, UpdateAssignmentRuleInput, UpdateScoringRuleInput,
} from './dto/rules.dto';

/** Lead fields usable in assignment and scoring conditions (plus `cf:<key>` custom fields). */
export const LEAD_RULE_FIELDS: { key: string; label: string; type: 'id' | 'text' | 'number' }[] = [
    { key: 'lead_source_id', label: 'Source', type: 'id' },
    { key: 'status_id', label: 'Status', type: 'id' },
    { key: 'branch_id', label: 'Branch (territory)', type: 'id' },
    { key: 'industry', label: 'Industry', type: 'text' },
    { key: 'estimated_company_size', label: 'Company size', type: 'text' },
    { key: 'estimated_value', label: 'Estimated value', type: 'number' },
    { key: 'currency', label: 'Currency', type: 'text' },
    { key: 'company_name', label: 'Company name', type: 'text' },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'email_domain', label: 'Email domain', type: 'text' },
    { key: 'phone', label: 'Phone', type: 'text' },
    { key: 'website', label: 'Website', type: 'text' },
];
const FIELD_KEYS = new Set(LEAD_RULE_FIELDS.map((f) => f.key));

type Tx = Prisma.TransactionClient | PrismaService;
type LeadLike = Pick<CrmLead, 'lead_source_id' | 'status_id' | 'branch_id' | 'industry' | 'estimated_company_size' | 'estimated_value' | 'currency' | 'company_name' | 'email' | 'phone' | 'website'>;

const SETTINGS = 'crm.settings.manage';
const SCORING = 'crm.scoring_rules.manage';

/**
 * 02 §4–6, §31 — lead assignment rules (applied on create when no owner is chosen: first matching rule by
 * priority wins; a specific member, round robin or least loaded across a team or a list of members) and lead
 * scoring rules (sum of the points of every matching rule → `CrmLead.lead_score`, recomputed on create/update;
 * `manual_score` stays separate). Same evaluation for REST, MCP, import and automation.
 */
@Injectable()
export class CrmLeadRulesService {
    constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly events: EventsService) { }

    // ---- evaluation ------------------------------------------------------------------------------------------

    private valueOf(lead: LeadLike, custom: Record<string, string | null>, field: string): unknown {
        if (field.startsWith('cf:')) return custom[field.slice(3)] ?? null;
        if (field === 'email_domain') return domainOf(lead.email);
        if (field === 'estimated_value') return lead.estimated_value === null || lead.estimated_value === undefined ? null : Number(lead.estimated_value);
        return (lead as Record<string, unknown>)[field] ?? null;
    }

    matches(lead: LeadLike, custom: Record<string, string | null>, conditions: RuleCondition[]): boolean {
        return conditions.every((c) => {
            const v = this.valueOf(lead, custom, c.field);
            const empty = v === null || v === undefined || v === '';
            const s = empty ? '' : String(v).toLowerCase();
            const target = Array.isArray(c.value) ? c.value.map((x) => String(x).toLowerCase()) : c.value === null || c.value === undefined ? '' : String(c.value).toLowerCase();
            switch (c.operator) {
                case 'is_empty': return empty;
                case 'is_not_empty': return !empty;
                case 'equals': return !empty && s === target;
                case 'not_equals': return s !== target;
                case 'contains': return !empty && typeof target === 'string' && s.includes(target);
                case 'in': return !empty && (Array.isArray(target) ? target : String(target).split(',').map((x) => x.trim())).includes(s);
                case 'gt': case 'gte': case 'lt': case 'lte': {
                    const n = Number(v); const t = Number(c.value);
                    if (empty || !Number.isFinite(n) || !Number.isFinite(t)) return false;
                    return c.operator === 'gt' ? n > t : c.operator === 'gte' ? n >= t : c.operator === 'lt' ? n < t : n <= t;
                }
            }
        });
    }

    private async customText(tx: Tx, organization_id: string, lead_id: string) {
        const rows = await tx.customFieldValue.findMany({ where: { entity_id: lead_id, entity_type: RecordEntityType.CRM_LEAD, definition: { organization_id } }, select: { value_text: true, definition: { select: { key: true } } } });
        return Object.fromEntries(rows.map((r) => [r.definition.key, r.value_text]));
    }

    async computeScore(tx: Tx, organization_id: string, lead: LeadLike & { id: string }) {
        const rules = await tx.crmLeadScoringRule.findMany({ where: { organization_id, enabled: true }, orderBy: { sort_order: 'asc' } });
        if (!rules.length) return null;
        const custom = await this.customText(tx, organization_id, lead.id);
        const total = rules.filter((r) => this.matches(lead, custom, r.conditions as RuleCondition[])).reduce((n, r) => n + r.points, 0);
        return Math.max(0, Math.min(100, total));
    }

    private async candidatesOf(tx: Tx, organization_id: string, to: AssignTo): Promise<string[]> {
        if ('membership_id' in to) return [to.membership_id];
        const ids = 'team_id' in to
            ? (await tx.teamMembership.findMany({ where: { team_id: to.team_id, ended_at: null, team: { organization_id } }, select: { membership_id: true } })).map((m) => m.membership_id)
            : to.membership_ids;
        const active = await tx.membership.findMany({ where: { id: { in: ids }, organization_id, status: 'ACTIVE' }, select: { id: true } });
        return active.map((m) => m.id);
    }

    private async pick(tx: Tx, organization_id: string, to: AssignTo): Promise<string | null> {
        const candidates = await this.candidatesOf(tx, organization_id, to);
        if (candidates.length <= 1) return candidates[0] ?? null;
        const strategy = 'strategy' in to ? to.strategy : 'round_robin';
        if (strategy === 'least_loaded') {
            const loads = await tx.crmLead.groupBy({ by: ['owner_membership_id'], where: { organization_id, owner_membership_id: { in: candidates }, converted_at: null, archived_at: null }, _count: { _all: true } });
            const load = new Map(loads.map((l) => [l.owner_membership_id, l._count._all]));
            return [...candidates].sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0))[0];
        }
        // Round robin without stored state: the candidate who least recently received a lead.
        const last = await tx.crmLead.groupBy({ by: ['owner_membership_id'], where: { organization_id, owner_membership_id: { in: candidates } }, _max: { created_at: true } });
        const at = new Map(last.map((l) => [l.owner_membership_id, l._max.created_at?.getTime() ?? 0]));
        return [...candidates].sort((a, b) => (at.get(a) ?? 0) - (at.get(b) ?? 0))[0];
    }

    /** First enabled assignment rule (by priority) that matches the lead → owner membership id. */
    async resolveOwner(tx: Tx, organization_id: string, lead: LeadLike & { id: string }) {
        const rules = await tx.crmAssignmentRule.findMany({ where: { organization_id, entity_type: RecordEntityType.CRM_LEAD, enabled: true }, orderBy: [{ priority: 'asc' }, { created_at: 'asc' }] });
        if (!rules.length) return null;
        const custom = await this.customText(tx, organization_id, lead.id);
        for (const r of rules) {
            if (!this.matches(lead, custom, r.conditions as RuleCondition[])) continue;
            const owner = await this.pick(tx, organization_id, r.assign_to as AssignTo);
            if (owner) return { owner, rule: { id: r.id, name: r.name } };
        }
        return null;
    }

    /**
     * Run inside the lead's create transaction (after custom fields are written): assignment rules when the caller did
     * not choose an owner (else `fallbackOwner`), then the score. Returns the applied owner / rule / score.
     */
    async applyOnCreate(tx: Prisma.TransactionClient, ctx: OrgContext, lead_id: string, opts: { assign: boolean; fallbackOwner?: string | null }) {
        const lead = await tx.crmLead.findUniqueOrThrow({ where: { id: lead_id } });
        const assigned = opts.assign ? await this.resolveOwner(tx, ctx.organization_id, lead) : null;
        const owner = assigned?.owner ?? (opts.assign ? opts.fallbackOwner ?? null : lead.owner_membership_id);
        const score = await this.computeScore(tx, ctx.organization_id, lead);
        const updated = await tx.crmLead.update({ where: { id: lead_id }, data: { owner_membership_id: owner, ...(score !== null && { lead_score: score }) } });
        if (assigned) await this.audit.record(ctx, 'crm.lead.auto_assigned', { resource_type: 'crm_lead', resource_id: lead_id, metadata: { rule_id: assigned.rule.id, rule: assigned.rule.name, owner_membership_id: assigned.owner } }, tx);
        return { lead: updated, rule: assigned?.rule ?? null, score };
    }

    /** Recompute one lead's score (after an update). */
    async rescore(tx: Tx, organization_id: string, lead_id: string) {
        const lead = await tx.crmLead.findUnique({ where: { id: lead_id } });
        if (!lead) return null;
        const score = await this.computeScore(tx, organization_id, lead);
        if (score !== null && score !== lead.lead_score) await tx.crmLead.update({ where: { id: lead_id }, data: { lead_score: score } });
        return score;
    }

    /** Recompute every open lead's score (after the scoring rules changed). */
    async rescoreAll(ctx: OrgContext) {
        const leads = await this.prisma.crmLead.findMany({ where: { organization_id: ctx.organization_id, converted_at: null, archived_at: null, merged_into_id: null } });
        const rules = await this.prisma.crmLeadScoringRule.findMany({ where: { organization_id: ctx.organization_id, enabled: true } });
        let changed = 0;
        for (const lead of leads) {
            const custom = rules.length ? await this.customText(this.prisma, ctx.organization_id, lead.id) : {};
            const total = rules.length ? Math.max(0, Math.min(100, rules.filter((r) => this.matches(lead, custom, r.conditions as RuleCondition[])).reduce((n, r) => n + r.points, 0))) : null;
            if (total !== lead.lead_score) { await this.prisma.crmLead.update({ where: { id: lead.id }, data: { lead_score: total } }); changed++; }
        }
        await this.audit.record(ctx, 'crm.lead.scores_recalculated', { resource_type: 'crm_lead', metadata: { leads: leads.length, changed } });
        return { leads: leads.length, changed };
    }

    // ---- rule management -------------------------------------------------------------------------------------

    private async checkConditions(ctx: OrgContext, conditions: RuleCondition[] | undefined) {
        if (!conditions?.length) return;
        const cfKeys = conditions.filter((c) => c.field.startsWith('cf:')).map((c) => c.field.slice(3));
        const bad = conditions.find((c) => !c.field.startsWith('cf:') && !FIELD_KEYS.has(c.field));
        if (bad) throw new BadRequestException({ message: `Unknown condition field "${bad.field}"`, code: 'rule_field_unknown' });
        if (cfKeys.length) {
            const found = await this.prisma.customFieldDefinition.count({ where: { organization_id: ctx.organization_id, key: { in: cfKeys }, entity_types: { has: RecordEntityType.CRM_LEAD } } });
            if (found !== new Set(cfKeys).size) throw new BadRequestException({ message: 'A condition uses an unknown custom field', code: 'rule_field_unknown' });
        }
    }

    private async checkAssignTo(ctx: OrgContext, to: AssignTo | undefined) {
        if (!to) return;
        if ('team_id' in to) {
            if (!(await this.prisma.team.count({ where: { id: to.team_id, organization_id: ctx.organization_id } }))) throw new NotFoundException({ message: 'Team not found', code: 'reference_not_found' });
            return;
        }
        const ids = 'membership_id' in to ? [to.membership_id] : [...new Set(to.membership_ids)];
        if ((await this.prisma.membership.count({ where: { id: { in: ids }, organization_id: ctx.organization_id } })) !== ids.length) throw new NotFoundException({ message: 'Member not found', code: 'reference_not_found' });
    }

    fields(ctx: OrgContext) {
        return this.prisma.customFieldDefinition.findMany({ where: { organization_id: ctx.organization_id, archived_at: null, entity_types: { has: RecordEntityType.CRM_LEAD } }, select: { key: true, label: true, type: true, options: true } })
            .then((cf) => ({ fields: [...LEAD_RULE_FIELDS, ...cf.map((d) => ({ key: `cf:${d.key}`, label: d.label, type: ['NUMBER', 'DECIMAL', 'CURRENCY', 'PERCENTAGE'].includes(d.type) ? 'number' : 'text', options: d.options }))] }));
    }

    assignmentRules(ctx: OrgContext) {
        return this.prisma.crmAssignmentRule.findMany({ where: { organization_id: ctx.organization_id, entity_type: RecordEntityType.CRM_LEAD }, orderBy: [{ priority: 'asc' }, { created_at: 'asc' }] });
    }

    async createAssignmentRule(ctx: OrgContext, dto: CreateAssignmentRuleInput) {
        await this.checkConditions(ctx, dto.conditions);
        await this.checkAssignTo(ctx, dto.assign_to);
        const last = await this.prisma.crmAssignmentRule.aggregate({ where: { organization_id: ctx.organization_id }, _max: { priority: true } });
        const rule = await this.prisma.crmAssignmentRule.create({
            data: { organization_id: ctx.organization_id, entity_type: RecordEntityType.CRM_LEAD, name: dto.name, conditions: dto.conditions as Prisma.InputJsonValue, assign_to: dto.assign_to as Prisma.InputJsonValue, priority: dto.priority ?? (last._max.priority ?? 0) + 10, enabled: dto.enabled ?? true },
        });
        await this.audit.record(ctx, 'crm.assignment_rule.created', { resource_type: 'crm_assignment_rule', resource_id: rule.id, metadata: { after: dto } });
        this.events.publish(ctx, { event_key: 'crm.assignment_rule.created', module: ModuleKey.CRM, entity_kind: 'crm_assignment_rule', entity_id: rule.id, payload: { name: rule.name } });
        return rule;
    }

    async updateAssignmentRule(ctx: OrgContext, id: string, dto: UpdateAssignmentRuleInput) {
        const before = await this.prisma.crmAssignmentRule.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Rule not found', code: 'rule_not_found' });
        await this.checkConditions(ctx, dto.conditions);
        await this.checkAssignTo(ctx, dto.assign_to);
        const rule = await this.prisma.crmAssignmentRule.update({
            where: { id },
            data: { ...dto, conditions: dto.conditions as Prisma.InputJsonValue | undefined, assign_to: dto.assign_to as Prisma.InputJsonValue | undefined },
        });
        await this.audit.record(ctx, 'crm.assignment_rule.updated', { resource_type: 'crm_assignment_rule', resource_id: id, metadata: { before: { name: before.name, enabled: before.enabled, priority: before.priority }, after: dto } });
        return rule;
    }

    async deleteAssignmentRule(ctx: OrgContext, id: string) {
        const before = await this.prisma.crmAssignmentRule.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Rule not found', code: 'rule_not_found' });
        await this.prisma.crmAssignmentRule.delete({ where: { id } });
        await this.audit.record(ctx, 'crm.assignment_rule.deleted', { resource_type: 'crm_assignment_rule', resource_id: id, metadata: { before: { name: before.name } } });
        return { success: true };
    }

    scoringRules(ctx: OrgContext) {
        return this.prisma.crmLeadScoringRule.findMany({ where: { organization_id: ctx.organization_id }, orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }] });
    }

    async createScoringRule(ctx: OrgContext, dto: CreateScoringRuleInput) {
        await this.checkConditions(ctx, dto.conditions);
        const rule = await this.prisma.crmLeadScoringRule.create({
            data: { organization_id: ctx.organization_id, name: dto.name, description: dto.description ?? null, conditions: dto.conditions as Prisma.InputJsonValue, points: dto.points, enabled: dto.enabled ?? true, sort_order: dto.sort_order ?? 0 },
        });
        await this.audit.record(ctx, 'crm.scoring_rule.created', { resource_type: 'crm_lead_scoring_rule', resource_id: rule.id, metadata: { after: dto } });
        return rule;
    }

    async updateScoringRule(ctx: OrgContext, id: string, dto: UpdateScoringRuleInput) {
        const before = await this.prisma.crmLeadScoringRule.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Rule not found', code: 'rule_not_found' });
        await this.checkConditions(ctx, dto.conditions);
        const rule = await this.prisma.crmLeadScoringRule.update({ where: { id }, data: { ...dto, conditions: dto.conditions as Prisma.InputJsonValue | undefined } });
        await this.audit.record(ctx, 'crm.scoring_rule.updated', { resource_type: 'crm_lead_scoring_rule', resource_id: id, metadata: { before: { name: before.name, points: before.points, enabled: before.enabled }, after: dto } });
        return rule;
    }

    async deleteScoringRule(ctx: OrgContext, id: string) {
        const before = await this.prisma.crmLeadScoringRule.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Rule not found', code: 'rule_not_found' });
        await this.prisma.crmLeadScoringRule.delete({ where: { id } });
        await this.audit.record(ctx, 'crm.scoring_rule.deleted', { resource_type: 'crm_lead_scoring_rule', resource_id: id, metadata: { before: { name: before.name } } });
        return { success: true };
    }

    static readonly KEYS = { SETTINGS, SCORING };
}
