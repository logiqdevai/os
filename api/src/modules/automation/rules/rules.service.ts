import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
    AutomationRule,
    AutomationRuleScopeType,
    AutomationRuleStatus,
    AutomationRunMode,
    AutomationTriggerKind,
    ModuleKey,
    Prisma,
    RecordEntityType,
    ScheduledJobKind,
    ScheduledJobStatus,
} from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { ACTION_BY_KEY } from '../catalog/action-catalog';
import { SYSTEM_TEMPLATES } from '../catalog/template-catalog';
import { TRIGGER_BY_KEY } from '../catalog/trigger-catalog';
import { AutomationEngineService } from '../engine/automation-engine.service';
import { RuleDefinition, RuleStep } from '../engine/rule-definition.types';
import { SchedulerService } from '../jobs/scheduler.service';
import { CreateRuleSchema, CreateTemplateDto, RuleInput, RuleQuery, TestRuleDto, UpdateRuleSchema } from './dto/rule.dto';

const READ = 'automation.rules.read';
const EVENT_KEY = /^[a-z0-9_]+(\.[a-z0-9_-]+)+$/;
/** Columns that make up the "definition" of a rule: edits to a live rule go to `draft_definition` (20 §5). */
const DRAFTABLE = ['name', 'description', 'module', 'trigger_kind', 'trigger_key', 'trigger_config', 'entity_type', 'conditions', 'actions', 'scope_type', 'branch_id', 'team_id', 'project_type_id', 'project_id', 'serialize_per_record', 'max_retries', 'retry_backoff_seconds', 'rate_limit_per_hour', 'max_trigger_depth', 'allow_destructive_actions', 'require_approval_for_destructive', 'timeout_seconds'] as const;

const PERSON = { select: { id: true, user: { select: { id: true, display_name: true, first_name: true, last_name: true, email: true, profile_photo_url: true } } } } as const;

/** 20 §5 — workflows (rules): CRUD, drafts of live rules, publish with versions, enable/disable, test/dry run, import/export. */
@Injectable()
export class RulesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly engine: AutomationEngineService,
        private readonly scheduler: SchedulerService,
        private readonly mcp: McpRegistry,
    ) { }

    /** Organization-wide readers see every rule; scoped readers see organization rules plus those in their branches / teams / projects. */
    scopeWhere(ctx: OrgContext, key = READ): Prisma.AutomationRuleWhereInput {
        const scope = ctx.scopeOf(key);
        if (!scope || scope.organization) return {};
        return {
            OR: [
                { scope_type: AutomationRuleScopeType.ORGANIZATION },
                { branch_id: { in: scope.branch_ids } },
                { team_id: { in: scope.team_ids } },
                { project_id: { in: scope.project_ids } },
            ],
        };
    }

    async findAll(ctx: OrgContext, query: RuleQuery) {
        const where: Prisma.AutomationRuleWhereInput = {
            organization_id: ctx.organization_id,
            AND: [this.scopeWhere(ctx)],
            ...(query.archived ? { status: AutomationRuleStatus.ARCHIVED } : query.status ? { status: query.status } : { status: { not: AutomationRuleStatus.ARCHIVED } }),
            ...(query.enabled !== undefined && { enabled: query.enabled }),
            ...(query.module && { module: query.module }),
            ...(query.trigger_kind && { trigger_kind: query.trigger_kind }),
            ...(query.trigger_key && { trigger_key: query.trigger_key }),
            ...(query.search && { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { description: { contains: query.search, mode: 'insensitive' } }, { trigger_key: { contains: query.search, mode: 'insensitive' } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.automationRule.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['name', 'created_at', 'updated_at', 'last_run_at', 'run_count', 'failure_count'], 'updated_at'),
                include: { owner: PERSON, run_as: { select: { id: true, name: true, status: true } } },
            }),
            this.prisma.automationRule.count({ where }),
        ]);
        return paginate(items.map((r) => this.withoutHeavy(r)), total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const rule = await this.prisma.automationRule.findFirst({
            where: { id, organization_id: ctx.organization_id, AND: [this.scopeWhere(ctx)] },
            include: {
                owner: PERSON,
                run_as: { select: { id: true, name: true, status: true, expires_at: true } },
                branch: { select: { id: true, name: true } },
                team: { select: { id: true, name: true } },
                project: { select: { id: true, name: true } },
                template: { select: { id: true, name: true } },
                scheduled_jobs: { select: { id: true, status: true, next_run_at: true, last_run_at: true, last_run_status: true } },
                _count: { select: { versions: true, runs: true } },
            },
        });
        if (!rule) throw new NotFoundException({ message: 'Workflow not found', code: 'rule_not_found' });
        return rule;
    }

    private withoutHeavy<T extends AutomationRule>(rule: T) {
        const { conditions: _c, actions, draft_definition, ...rest } = rule;
        return { ...rest, step_count: Array.isArray(actions) ? actions.length : 0, has_draft: !!draft_definition };
    }

    // ---------------------------------------------------------------------------------------------
    // Create / edit
    // ---------------------------------------------------------------------------------------------

    async create(ctx: OrgContext, raw: Record<string, unknown>) {
        let input = raw;
        let templateRef: { id: string | null; key: string | null } | null = null;
        if (raw.template_id && (!raw.actions || !(raw.actions as unknown[]).length)) {
            const tpl = await this.resolveTemplate(ctx, String(raw.template_id));
            templateRef = { id: tpl.id, key: tpl.key };
            input = { module: tpl.module, ...tpl.definition, ...raw, actions: tpl.definition.actions, trigger_kind: tpl.definition.trigger_kind, trigger_key: tpl.definition.trigger_key, trigger_config: tpl.definition.trigger_config ?? null, conditions: tpl.definition.conditions ?? null };
        } else if (raw.template_id) {
            const tpl = await this.resolveTemplate(ctx, String(raw.template_id));
            templateRef = { id: tpl.id, key: tpl.key };
        }
        const dto = this.parse(CreateRuleSchema, input);
        await this.assertUniqueName(ctx, dto.name);
        await this.validate(ctx, dto, null);

        const rule = await this.prisma.automationRule.create({
            data: {
                ...this.columns(dto),
                organization_id: ctx.organization_id,
                name: dto.name,
                trigger_kind: dto.trigger_kind,
                trigger_key: dto.trigger_key,
                actions: dto.actions as unknown as Prisma.InputJsonValue,
                owner_membership_id: dto.owner_membership_id ?? ctx.membership_id,
                status: AutomationRuleStatus.DRAFT,
                enabled: false,
                current_version: 0,
                created_by_user_id: ctx.user_id,
                template_id: templateRef?.id ?? null,
                ...(templateRef?.key ? { imported_from: { template_key: templateRef.key } } : {}),
            } as Prisma.AutomationRuleUncheckedCreateInput,
        });
        if (templateRef?.id) await this.prisma.automationRuleTemplate.update({ where: { id: templateRef.id }, data: { usage_count: { increment: 1 } } }).catch(() => undefined);
        await this.audit.record(ctx, 'automation.rule.created', { resource_type: 'automation_rule', resource_id: rule.id, metadata: { after: { name: rule.name, trigger_key: rule.trigger_key, template: templateRef?.key ?? templateRef?.id ?? null } } });
        this.emit(ctx, 'automation.rule.created', rule);
        return rule;
    }

    /** Draft rules are edited in place; edits of a published rule are saved as an unpublished draft (20 §5). */
    async update(ctx: OrgContext, id: string, raw: Record<string, unknown>) {
        const rule = await this.findOne(ctx, id);
        if (rule.status === AutomationRuleStatus.ARCHIVED) throw new ConflictException({ message: 'Restore the workflow before editing it', code: 'rule_archived' });
        const dto = this.parse(UpdateRuleSchema, raw);
        if (dto.name && dto.name !== rule.name) await this.assertUniqueName(ctx, dto.name, id);

        // Owner / run-as are not part of the definition: applied directly (and audited) in both states.
        const direct: Prisma.AutomationRuleUncheckedUpdateInput = {};
        if (dto.owner_membership_id !== undefined) direct.owner_membership_id = dto.owner_membership_id;
        if (dto.run_as_service_account_id !== undefined) direct.run_as_service_account_id = dto.run_as_service_account_id;
        if (dto.template_id !== undefined) delete (dto as Record<string, unknown>).template_id;

        if (rule.status === AutomationRuleStatus.DRAFT) {
            const merged = { ...this.definitionOf(rule), ...dto } as RuleInput;
            await this.validate(ctx, merged, rule);
            const updated = await this.prisma.automationRule.update({ where: { id }, data: { ...this.columns(dto), ...direct } });
            await this.audit.record(ctx, 'automation.rule.updated', { resource_type: 'automation_rule', resource_id: id, metadata: { fields: Object.keys(dto) } });
            this.emit(ctx, 'automation.rule.updated', updated);
            return updated;
        }

        const draftPart = Object.fromEntries(Object.entries(dto).filter(([k]) => (DRAFTABLE as readonly string[]).includes(k)));
        const draft = { ...this.definitionOf(rule), ...((rule.draft_definition as Record<string, unknown>) ?? {}), ...draftPart };
        await this.validate(ctx, { ...draft, ...direct } as RuleInput, rule);
        const updated = await this.prisma.automationRule.update({
            where: { id },
            data: {
                ...direct,
                ...(Object.keys(draftPart).length ? { draft_definition: draft as Prisma.InputJsonValue, draft_updated_at: new Date(), draft_updated_by_membership_id: ctx.membership_id } : {}),
            },
        });
        await this.audit.record(ctx, 'automation.rule.draft_saved', { resource_type: 'automation_rule', resource_id: id, metadata: { fields: Object.keys(dto) } });
        return updated;
    }

    async discardDraft(ctx: OrgContext, id: string) {
        await this.findOne(ctx, id);
        const updated = await this.prisma.automationRule.update({ where: { id }, data: { draft_definition: Prisma.DbNull, draft_updated_at: null, draft_updated_by_membership_id: null } });
        await this.audit.record(ctx, 'automation.rule.draft_discarded', { resource_type: 'automation_rule', resource_id: id });
        return updated;
    }

    /** Copy the draft (if any) over the live definition, write a new immutable version, sync the schedule. */
    async publish(ctx: OrgContext, id: string, changeSummary?: string, override?: Record<string, unknown>) {
        const rule = await this.findOne(ctx, id);
        if (rule.status === AutomationRuleStatus.ARCHIVED) throw new ConflictException({ message: 'Restore the workflow before publishing it', code: 'rule_archived' });
        const def = { ...this.definitionOf(rule), ...((rule.draft_definition as Record<string, unknown>) ?? {}), ...(override ?? {}) } as RuleInput;
        const full = this.parse(CreateRuleSchema, def);
        if (!full.actions.length) throw new BadRequestException({ message: 'Add at least one step before publishing', code: 'rule_no_steps' });
        await this.validate(ctx, full, rule);

        const version = rule.current_version + 1;
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.automationRuleVersion.updateMany({ where: { rule_id: id, superseded_at: null }, data: { superseded_at: new Date() } });
            await tx.automationRuleVersion.create({
                data: {
                    rule_id: id,
                    version,
                    name: full.name,
                    description: full.description ?? null,
                    trigger_kind: full.trigger_kind,
                    trigger_key: full.trigger_key,
                    trigger_config: (full.trigger_config ?? undefined) as Prisma.InputJsonValue | undefined,
                    conditions: (full.conditions ?? undefined) as Prisma.InputJsonValue | undefined,
                    actions: full.actions as unknown as Prisma.InputJsonValue,
                    scope_type: full.scope_type ?? AutomationRuleScopeType.ORGANIZATION,
                    scope: { branch_id: full.branch_id ?? null, team_id: full.team_id ?? null, project_type_id: full.project_type_id ?? null, project_id: full.project_id ?? null },
                    settings: {
                        serialize_per_record: full.serialize_per_record ?? false,
                        max_retries: full.max_retries ?? null,
                        retry_backoff_seconds: full.retry_backoff_seconds ?? null,
                        rate_limit_per_hour: full.rate_limit_per_hour ?? null,
                        max_trigger_depth: full.max_trigger_depth ?? null,
                        allow_destructive_actions: full.allow_destructive_actions ?? false,
                        require_approval_for_destructive: full.require_approval_for_destructive ?? true,
                        timeout_seconds: full.timeout_seconds ?? null,
                    },
                    change_summary: changeSummary ?? null,
                    author_membership_id: ctx.membership_id,
                },
            });
            return tx.automationRule.update({
                where: { id },
                data: {
                    ...this.columns(full),
                    actions: full.actions as unknown as Prisma.InputJsonValue,
                    status: AutomationRuleStatus.PUBLISHED,
                    current_version: version,
                    published_at: new Date(),
                    draft_definition: Prisma.DbNull,
                    draft_updated_at: null,
                    draft_updated_by_membership_id: null,
                },
            });
        });
        await this.syncSchedule(updated);
        await this.audit.record(ctx, 'automation.rule.published', { resource_type: 'automation_rule', resource_id: id, metadata: { version, change_summary: changeSummary ?? null } });
        this.emit(ctx, 'automation.rule.published', updated, { version });
        return this.findOne(ctx, id);
    }

    async setEnabled(ctx: OrgContext, id: string, enabled: boolean) {
        const rule = await this.findOne(ctx, id);
        if (enabled && rule.status !== AutomationRuleStatus.PUBLISHED) throw new ConflictException({ message: 'Publish the workflow before enabling it', code: 'rule_not_published' });
        if (rule.enabled === enabled) return rule;
        const updated = await this.prisma.automationRule.update({ where: { id }, data: { enabled, ...(enabled ? { enabled_at: new Date() } : { disabled_at: new Date() }) } });
        await this.syncSchedule(updated);
        await this.audit.record(ctx, enabled ? 'automation.rule.enabled' : 'automation.rule.disabled', { resource_type: 'automation_rule', resource_id: id });
        this.emit(ctx, enabled ? 'automation.rule.enabled' : 'automation.rule.disabled', updated);
        return this.findOne(ctx, id);
    }

    async duplicate(ctx: OrgContext, id: string) {
        const rule = await this.findOne(ctx, id);
        const source = { ...this.definitionOf(rule), ...((rule.draft_definition as Record<string, unknown>) ?? {}) } as RuleInput;
        let name = `${source.name} (copy)`;
        for (let i = 2; await this.prisma.automationRule.findFirst({ where: { organization_id: ctx.organization_id, name }, select: { id: true } }); i++) name = `${source.name} (copy ${i})`;
        const dto = this.parse(CreateRuleSchema, { ...source, name });
        const copy = await this.prisma.automationRule.create({
            data: {
                ...this.columns(dto),
                organization_id: ctx.organization_id,
                name,
                trigger_kind: dto.trigger_kind,
                trigger_key: dto.trigger_key,
                actions: dto.actions as unknown as Prisma.InputJsonValue,
                owner_membership_id: ctx.membership_id,
                run_as_service_account_id: rule.run_as_service_account_id,
                status: AutomationRuleStatus.DRAFT,
                current_version: 0,
                duplicated_from_rule_id: id,
                created_by_user_id: ctx.user_id,
            } as Prisma.AutomationRuleUncheckedCreateInput,
        });
        await this.audit.record(ctx, 'automation.rule.created', { resource_type: 'automation_rule', resource_id: copy.id, metadata: { duplicated_from: id } });
        this.emit(ctx, 'automation.rule.created', copy);
        return copy;
    }

    async archive(ctx: OrgContext, id: string) {
        await this.findOne(ctx, id);
        const updated = await this.prisma.automationRule.update({ where: { id }, data: { status: AutomationRuleStatus.ARCHIVED, enabled: false, archived_at: new Date(), disabled_at: new Date() } });
        await this.syncSchedule(updated);
        await this.audit.record(ctx, 'automation.rule.archived', { resource_type: 'automation_rule', resource_id: id });
        this.emit(ctx, 'automation.rule.archived', updated);
        return updated;
    }

    async restore(ctx: OrgContext, id: string) {
        const rule = await this.findOne(ctx, id);
        if (rule.status !== AutomationRuleStatus.ARCHIVED) return rule;
        const updated = await this.prisma.automationRule.update({ where: { id }, data: { status: rule.current_version > 0 ? AutomationRuleStatus.PUBLISHED : AutomationRuleStatus.DRAFT, archived_at: null } });
        await this.audit.record(ctx, 'automation.rule.restored', { resource_type: 'automation_rule', resource_id: id });
        return updated;
    }

    async remove(ctx: OrgContext, id: string) {
        const rule = await this.findOne(ctx, id);
        for (const job of rule.scheduled_jobs) this.scheduler.unschedule(job.id);
        await this.prisma.automationRule.delete({ where: { id } });
        await this.audit.record(ctx, 'automation.rule.deleted', { resource_type: 'automation_rule', resource_id: id, metadata: { before: { name: rule.name, trigger_key: rule.trigger_key } } });
        this.emit(ctx, 'automation.rule.deleted', rule);
        return { success: true };
    }

    // ---------------------------------------------------------------------------------------------
    // Versions, export / import, templates
    // ---------------------------------------------------------------------------------------------

    async versions(ctx: OrgContext, id: string) {
        await this.findOne(ctx, id);
        return this.prisma.automationRuleVersion.findMany({ where: { rule_id: id }, orderBy: { version: 'desc' }, include: { author: PERSON, _count: { select: { runs: true } } } });
    }

    /** Restoring never rewrites history: the old definition is published as a NEW version. */
    async restoreVersion(ctx: OrgContext, id: string, version: number) {
        await this.findOne(ctx, id);
        const v = await this.prisma.automationRuleVersion.findUnique({ where: { rule_id_version: { rule_id: id, version } } });
        if (!v) throw new NotFoundException({ message: 'Version not found', code: 'rule_version_not_found' });
        const scope = (v.scope as Record<string, string | null>) ?? {};
        const settings = (v.settings as Record<string, unknown>) ?? {};
        return this.publish(ctx, id, `Restored version ${version}`, {
            name: v.name, description: v.description, trigger_kind: v.trigger_kind, trigger_key: v.trigger_key, trigger_config: v.trigger_config, conditions: v.conditions, actions: v.actions,
            scope_type: v.scope_type, ...scope, ...settings,
        });
    }

    async export(ctx: OrgContext, id: string) {
        const rule = await this.findOne(ctx, id);
        await this.audit.record(ctx, 'automation.rule.exported', { resource_type: 'automation_rule', resource_id: id });
        return { format: 'logiqdev.automation.rule', version: 1, exported_at: new Date().toISOString(), rule: { ...this.definitionOf(rule), owner_membership_id: undefined } };
    }

    async import(ctx: OrgContext, body: Record<string, unknown>) {
        const rule = (body.rule as Record<string, unknown>) ?? body;
        const dto = this.parse(CreateRuleSchema, { ...rule, branch_id: null, team_id: null, project_id: null, project_type_id: null, scope_type: AutomationRuleScopeType.ORGANIZATION, owner_membership_id: null, run_as_service_account_id: null });
        let name = dto.name;
        for (let i = 2; await this.prisma.automationRule.findFirst({ where: { organization_id: ctx.organization_id, name }, select: { id: true } }); i++) name = `${dto.name} (${i})`;
        await this.validate(ctx, { ...dto, name }, null);
        const created = await this.prisma.automationRule.create({
            data: {
                ...this.columns(dto),
                organization_id: ctx.organization_id,
                name,
                trigger_kind: dto.trigger_kind,
                trigger_key: dto.trigger_key,
                actions: dto.actions as unknown as Prisma.InputJsonValue,
                owner_membership_id: ctx.membership_id,
                status: AutomationRuleStatus.DRAFT,
                current_version: 0,
                imported_from: { imported_at: new Date().toISOString(), source_name: dto.name } as Prisma.InputJsonValue,
                created_by_user_id: ctx.user_id,
            } as Prisma.AutomationRuleUncheckedCreateInput,
        });
        await this.audit.record(ctx, 'automation.rule.imported', { resource_type: 'automation_rule', resource_id: created.id, metadata: { source_name: dto.name } });
        this.emit(ctx, 'automation.rule.created', created);
        return created;
    }

    async templates(ctx: OrgContext, query: { module?: ModuleKey; category?: string; search?: string }) {
        const org = await this.prisma.automationRuleTemplate.findMany({
            where: { OR: [{ organization_id: ctx.organization_id }, { organization_id: null }], is_published: true, ...(query.module && { module: query.module }), ...(query.category && { category: query.category }) },
            orderBy: { name: 'asc' },
        });
        const all = [
            ...SYSTEM_TEMPLATES.map((t) => ({ id: null as string | null, key: t.key, module: t.module, name: t.name, description: t.description, category: t.category, definition: t.definition, is_system: true, usage_count: 0 })),
            ...org.map((t) => ({ id: t.id, key: t.key, module: t.module, name: t.name, description: t.description, category: t.category, definition: t.definition as unknown as RuleDefinition, is_system: t.is_system, usage_count: t.usage_count })),
        ];
        const q = query.search?.toLowerCase();
        return all.filter((t) => (!query.module || t.module === query.module) && (!query.category || t.category === query.category) && (!q || `${t.name} ${t.description}`.toLowerCase().includes(q)));
    }

    async createTemplate(ctx: OrgContext, dto: CreateTemplateDto) {
        const rule = await this.findOne(ctx, dto.from_rule_id);
        const def = this.definitionOf(rule);
        const key = `${dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}-${Date.now().toString(36)}`;
        const template = await this.prisma.automationRuleTemplate.create({
            data: {
                organization_id: ctx.organization_id,
                module: rule.module ?? ModuleKey.AUTOMATION,
                key,
                name: dto.name,
                description: dto.description ?? null,
                category: dto.category ?? null,
                definition: { trigger_kind: def.trigger_kind, trigger_key: def.trigger_key, trigger_config: def.trigger_config, conditions: def.conditions, actions: def.actions } as Prisma.InputJsonValue,
                created_by_membership_id: ctx.membership_id,
            },
        });
        await this.audit.record(ctx, 'automation.template.published', { resource_type: 'automation_rule_template', resource_id: template.id, metadata: { from_rule_id: rule.id } });
        return template;
    }

    async removeTemplate(ctx: OrgContext, id: string) {
        const t = await this.prisma.automationRuleTemplate.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!t) throw new NotFoundException({ message: 'Template not found', code: 'template_not_found' });
        await this.prisma.automationRuleTemplate.delete({ where: { id } });
        await this.audit.record(ctx, 'automation.template.unpublished', { resource_type: 'automation_rule_template', resource_id: id });
        return { success: true };
    }

    private async resolveTemplate(ctx: OrgContext, ref: string) {
        const system = SYSTEM_TEMPLATES.find((t) => t.key === ref);
        if (system) return { id: null as string | null, key: system.key, module: system.module, definition: system.definition };
        const byRef: Prisma.AutomationRuleTemplateWhereInput[] = [{ key: ref }];
        if (/^[0-9a-f-]{36}$/i.test(ref)) byRef.push({ id: ref });
        const t = await this.prisma.automationRuleTemplate.findFirst({ where: { OR: byRef, AND: [{ OR: [{ organization_id: ctx.organization_id }, { organization_id: null }] }] } });
        if (!t) throw new NotFoundException({ message: 'Template not found', code: 'template_not_found' });
        return { id: t.id, key: t.key, module: t.module, definition: t.definition as unknown as RuleDefinition };
    }

    // ---------------------------------------------------------------------------------------------
    // Run now / test
    // ---------------------------------------------------------------------------------------------

    async runNow(ctx: OrgContext, id: string, input: { payload?: Record<string, unknown>; entity_id?: string }) {
        const rule = await this.findOne(ctx, id);
        if (rule.status !== AutomationRuleStatus.PUBLISHED) throw new ConflictException({ message: 'Publish the workflow before running it', code: 'rule_not_published' });
        const run = await this.engine.startRun(rule, {
            mode: AutomationRunMode.LIVE,
            event: this.syntheticEvent(rule, input),
            actor_membership_id: ctx.membership_id,
        });
        if (!run) throw new ConflictException({ message: 'The run was not started (out of scope)', code: 'run_not_started' });
        await this.audit.record(ctx, 'automation.rule.run_manually', { resource_type: 'automation_rule', resource_id: id, metadata: { run_id: run.id } });
        return run;
    }

    async test(ctx: OrgContext, id: string, input: TestRuleDto) {
        const rule = await this.findOne(ctx, id);
        const mode = input.mode ?? AutomationRunMode.DRY_RUN;
        if (mode === AutomationRunMode.TEST && !ctx.can('automation.rules.update')) {
            throw new ForbiddenException({ message: 'A test run executes the steps and needs automation.rules.update; use a dry run instead', code: 'permission_denied' });
        }
        const definition = this.parse(CreateRuleSchema, { ...this.definitionOf(rule), ...(input.use_draft !== false ? ((rule.draft_definition as Record<string, unknown>) ?? {}) : {}) });
        const run = await this.engine.startRun(rule, {
            mode,
            event: this.syntheticEvent(rule, input, definition.trigger_key),
            actor_membership_id: ctx.membership_id,
            definition: { trigger_kind: definition.trigger_kind, trigger_key: definition.trigger_key, trigger_config: definition.trigger_config ?? null, conditions: definition.conditions ?? null, actions: definition.actions as RuleStep[] },
        });
        await this.audit.record(ctx, 'automation.rule.tested', { resource_type: 'automation_rule', resource_id: id, metadata: { mode, run_id: run?.id } });
        return run;
    }

    private syntheticEvent(rule: AutomationRule, input: { payload?: Record<string, unknown>; entity_id?: string }, triggerKey = rule.trigger_key) {
        const sample = TRIGGER_BY_KEY.get(triggerKey)?.sample_payload ?? {};
        return {
            id: null,
            event_key: triggerKey,
            entity_type: TRIGGER_BY_KEY.get(triggerKey)?.entity_type ?? rule.entity_type ?? null,
            entity_id: input.entity_id ?? null,
            payload: input.payload ?? sample,
            changes: null,
            actor_membership_id: null,
            occurred_at: new Date().toISOString(),
        };
    }

    // ---------------------------------------------------------------------------------------------
    // Validation helpers
    // ---------------------------------------------------------------------------------------------

    private parse<T extends typeof CreateRuleSchema | typeof UpdateRuleSchema>(schema: T, input: unknown): ReturnType<T['parse']> {
        const res = schema.safeParse(input);
        if (!res.success) {
            throw new BadRequestException({ message: res.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '), code: 'rule_invalid' });
        }
        return res.data as ReturnType<T['parse']>;
    }

    /** Live definition as a plain object (same shape as the create body). */
    definitionOf(rule: AutomationRule): Record<string, unknown> {
        return Object.fromEntries((DRAFTABLE as readonly string[]).map((k) => [k, (rule as unknown as Record<string, unknown>)[k] ?? null]).concat([['owner_membership_id', rule.owner_membership_id], ['run_as_service_account_id', rule.run_as_service_account_id]]));
    }

    private columns(dto: RuleInput): Prisma.AutomationRuleUncheckedUpdateInput {
        const out: Prisma.AutomationRuleUncheckedUpdateInput = {};
        const json = (v: unknown) => (v === null ? Prisma.DbNull : (v as Prisma.InputJsonValue));
        for (const [k, v] of Object.entries(dto)) {
            if (v === undefined || k === 'template_id') continue;
            if (k === 'trigger_config' || k === 'conditions' || k === 'actions') (out as Record<string, unknown>)[k] = json(v);
            else (out as Record<string, unknown>)[k] = v;
        }
        if (dto.scope_type) {
            // Keep only the id that matches the scope type.
            if (dto.scope_type !== AutomationRuleScopeType.BRANCH) out.branch_id = null;
            if (dto.scope_type !== AutomationRuleScopeType.TEAM) out.team_id = null;
            if (dto.scope_type !== AutomationRuleScopeType.PROJECT) out.project_id = null;
            if (dto.scope_type !== AutomationRuleScopeType.PROJECT_TYPE) out.project_type_id = null;
        }
        return out;
    }

    private async assertUniqueName(ctx: OrgContext, name: string, exceptId?: string) {
        const existing = await this.prisma.automationRule.findFirst({ where: { organization_id: ctx.organization_id, name, ...(exceptId && { id: { not: exceptId } }) }, select: { id: true } });
        if (existing) throw new ConflictException({ message: 'A workflow with this name already exists', code: 'rule_name_taken' });
    }

    /**
     * 20 §10 — trigger/action shape, scope references and "a user can only build rules whose actions they are
     * themselves permitted to perform, or that run under a service account they manage".
     */
    private async validate(ctx: OrgContext, dto: RuleInput, existing: AutomationRule | null) {
        const kind = dto.trigger_kind ?? existing?.trigger_kind;
        const key = dto.trigger_key ?? existing?.trigger_key;
        const config = (dto.trigger_config ?? (existing?.trigger_config as Record<string, unknown>) ?? {}) as Record<string, unknown>;
        const runAs = dto.run_as_service_account_id !== undefined ? dto.run_as_service_account_id : existing?.run_as_service_account_id ?? null;
        const bad = (message: string, code = 'rule_invalid') => new BadRequestException({ message, code });

        if (!kind || !key) throw bad('A trigger is required');
        switch (kind) {
            case AutomationTriggerKind.EVENT:
                if (!EVENT_KEY.test(key)) throw bad('The trigger must be an event key such as crm.deal.won');
                break;
            case AutomationTriggerKind.MANUAL:
                if (key !== 'manual') throw bad('Manual workflows use the trigger key "manual"');
                break;
            case AutomationTriggerKind.SCHEDULE:
                if (key !== 'schedule.cron') throw bad('Scheduled workflows use the trigger key "schedule.cron"');
                if (config.cron) SchedulerService.validate(ScheduledJobKind.CRON, { cron_expression: String(config.cron), timezone: String(config.timezone ?? 'UTC') });
                else if (config.interval_seconds) SchedulerService.validate(ScheduledJobKind.INTERVAL, { interval_seconds: Number(config.interval_seconds) });
                else throw bad('A schedule needs a cron expression or an interval');
                break;
            case AutomationTriggerKind.INBOUND_WEBHOOK: {
                const slug = key.startsWith('inbound_webhook.') ? key.slice('inbound_webhook.'.length) : '';
                const hook = slug ? await this.prisma.automationInboundWebhook.findFirst({ where: { slug, organization_id: ctx.organization_id } }) : null;
                if (!hook) throw bad('Choose an inbound webhook endpoint of this organization');
                break;
            }
            case AutomationTriggerKind.DATE_RELATIVE:
                throw bad('Date-relative triggers are not available yet; use a schedule with a condition instead', 'trigger_unsupported');
        }

        // Scope references belong to the organization.
        const refChecks: Promise<unknown>[] = [];
        const scopeType = dto.scope_type ?? existing?.scope_type ?? AutomationRuleScopeType.ORGANIZATION;
        const pickId = (k: 'branch_id' | 'team_id' | 'project_id' | 'project_type_id') => (dto[k] !== undefined ? dto[k] : existing?.[k] ?? null);
        if (scopeType === AutomationRuleScopeType.BRANCH) {
            const id = pickId('branch_id');
            if (!id) throw bad('Choose a branch for a branch-scoped workflow');
            refChecks.push(this.prisma.branch.findFirstOrThrow({ where: { id, organization_id: ctx.organization_id } }));
        }
        if (scopeType === AutomationRuleScopeType.TEAM) {
            const id = pickId('team_id');
            if (!id) throw bad('Choose a team for a team-scoped workflow');
            refChecks.push(this.prisma.team.findFirstOrThrow({ where: { id, organization_id: ctx.organization_id } }));
        }
        if (scopeType === AutomationRuleScopeType.PROJECT) {
            const id = pickId('project_id');
            if (!id) throw bad('Choose a project for a project-scoped workflow');
            refChecks.push(this.prisma.project.findFirstOrThrow({ where: { id, organization_id: ctx.organization_id } }));
        }
        if (scopeType === AutomationRuleScopeType.PROJECT_TYPE) {
            const id = pickId('project_type_id');
            if (!id) throw bad('Choose a project type for a project-type-scoped workflow');
            refChecks.push(this.prisma.projectType.findFirstOrThrow({ where: { id, organization_id: ctx.organization_id } }));
        }
        if (dto.owner_membership_id) refChecks.push(this.prisma.membership.findFirstOrThrow({ where: { id: dto.owner_membership_id, organization_id: ctx.organization_id } }));
        try {
            await Promise.all(refChecks);
        } catch {
            throw new NotFoundException({ message: 'Branch, team, project or owner not found', code: 'reference_not_found' });
        }

        // Run-as service account (01 §76).
        const runAsChanged = dto.run_as_service_account_id !== undefined && dto.run_as_service_account_id !== (existing?.run_as_service_account_id ?? null);
        if (runAs) {
            if (runAsChanged && !ctx.can('automation.service_accounts.manage')) throw new ForbiddenException({ message: 'Running a workflow as a service account needs automation.service_accounts.manage', code: 'permission_denied' });
            const sa = await this.prisma.serviceAccount.findFirst({ where: { id: runAs, organization_id: ctx.organization_id } });
            if (!sa) throw new NotFoundException({ message: 'Service account not found', code: 'service_account_not_found' });
            if (runAsChanged && (sa.status !== 'ACTIVE' || (sa.expires_at && sa.expires_at < new Date()))) throw bad('The service account is not active', 'service_account_inactive');
        }
        const delegated = !!runAs && ctx.can('automation.service_accounts.manage');

        // Trigger permission.
        const trigger = TRIGGER_BY_KEY.get(key);
        if (trigger?.required_permission && !delegated && !ctx.can(trigger.required_permission)) {
            throw new ForbiddenException({ message: `Building on "${trigger.name}" needs ${trigger.required_permission}`, code: 'permission_denied' });
        }

        // Steps.
        const steps = (dto.actions ?? (existing?.actions as unknown as RuleStep[]) ?? []) as RuleStep[];
        const keys = new Set<string>();
        const allowDestructive = dto.allow_destructive_actions ?? existing?.allow_destructive_actions ?? false;
        if (dto.allow_destructive_actions && !existing?.allow_destructive_actions && !ctx.can('automation.actions.destructive.enable')) {
            throw new ForbiddenException({ message: 'Allowing destructive actions needs automation.actions.destructive.enable', code: 'permission_denied' });
        }
        for (const step of steps) {
            if (keys.has(step.key)) throw bad(`Duplicate step key "${step.key}"`);
            keys.add(step.key);
            const def = ACTION_BY_KEY.get(step.action_key);
            if (!def) throw bad(`Unknown action "${step.action_key}"`);
            const toolName = def.executor.type === 'mcp' ? def.executor.tool : step.action_key === 'mcp.tool' ? String(step.inputs?.tool ?? '') : null;
            const tool = toolName ? this.mcp.get(toolName) : undefined;
            if (step.action_key === 'mcp.tool' && !tool) throw bad(`Unknown tool "${toolName}"`);
            const perms = [def.required_permission, tool?.permission].filter(Boolean) as string[];
            for (const p of perms) {
                if (!delegated && !ctx.can(p)) throw new ForbiddenException({ message: `Step "${step.name ?? def.name}" needs ${p}, which you do not hold. Run the workflow as a service account you manage instead.`, code: 'permission_denied' });
            }
            if ((def.is_destructive || def.is_customer_facing || tool?.sensitive) && !allowDestructive) {
                throw bad(`Step "${step.name ?? def.name}" is destructive or customer-facing: allow destructive actions on the workflow first`, 'destructive_not_allowed');
            }
            for (const field of def.fields) {
                if (!field.required) continue;
                const v = step.inputs?.[field.key];
                const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
                if (empty && field.type !== 'conditions') throw bad(`Step "${step.name ?? def.name}": ${field.label} is required`);
            }
        }
    }

    /** SCHEDULE rules own one ScheduledJob (`rule.<id>`), active only while the rule is published and enabled. */
    private async syncSchedule(rule: AutomationRule) {
        const existing = await this.prisma.scheduledJob.findFirst({ where: { rule_id: rule.id } });
        if (rule.trigger_kind !== AutomationTriggerKind.SCHEDULE || rule.status === AutomationRuleStatus.DRAFT) {
            if (existing) {
                this.scheduler.unschedule(existing.id);
                await this.prisma.scheduledJob.delete({ where: { id: existing.id } });
                await this.prisma.automationRule.update({ where: { id: rule.id }, data: { next_run_at: null } });
            }
            return;
        }
        const config = (rule.trigger_config as Record<string, unknown>) ?? {};
        const active = rule.status === AutomationRuleStatus.PUBLISHED && rule.enabled;
        const job = await this.scheduler.ensureJob({
            organization_id: rule.organization_id,
            module: ModuleKey.AUTOMATION,
            key: `rule.${rule.id}`,
            name: `Workflow: ${rule.name}`,
            description: 'Schedule of a SCHEDULE-triggered workflow',
            handler: 'automation.rule.schedule',
            kind: config.cron ? ScheduledJobKind.CRON : ScheduledJobKind.INTERVAL,
            cron_expression: config.cron ? String(config.cron) : null,
            interval_seconds: config.interval_seconds ? Number(config.interval_seconds) : null,
            timezone: String(config.timezone ?? 'UTC'),
            payload: { rule_id: rule.id },
            rule_id: rule.id,
            branch_id: rule.branch_id,
            status: active ? ScheduledJobStatus.ACTIVE : ScheduledJobStatus.PAUSED,
        });
        const fresh = await this.prisma.scheduledJob.findUnique({ where: { id: job.id }, select: { next_run_at: true } });
        await this.prisma.automationRule.update({ where: { id: rule.id }, data: { next_run_at: fresh?.next_run_at ?? null } });
    }

    private emit(ctx: OrgContext, key: string, rule: AutomationRule, extra: Record<string, unknown> = {}) {
        this.events.publish(ctx, {
            event_key: key,
            module: ModuleKey.AUTOMATION,
            entity_type: RecordEntityType.AUTOMATION_RULE,
            entity_id: rule.id,
            payload: { name: rule.name, trigger_key: rule.trigger_key, status: rule.status, enabled: rule.enabled, ...extra },
        });
    }
}
