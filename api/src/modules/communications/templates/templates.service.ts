import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { CommChannel, CommTemplateStatus, CommTemplateVersionStatus, ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { branchScopeWhere, extractVariables, htmlToText, isUniqueError, notFound, renderTemplate, SAMPLE_CONTEXT, slugify, smsSegments } from '../common/comm.utils';
import { CreateTemplateDto, PreviewTemplateDto, TemplateContentDto, TemplateQuery, UpdateTemplateDto } from './dto/template.dto';

const READ = 'communications.templates.read';
const CONTENT_KEYS = ['subject', 'preheader', 'body_html', 'body_text', 'design'] as const;

/** Email / SMS templates with immutable published versions (11 "Communication Templates"). */
@Injectable()
export class TemplatesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    private scope(ctx: OrgContext): Prisma.CommTemplateWhereInput {
        return branchScopeWhere(ctx, READ, ['created_by_membership_id']) as Prisma.CommTemplateWhereInput;
    }

    async findAll(ctx: OrgContext, query: TemplateQuery) {
        const where: Prisma.CommTemplateWhereInput = {
            organization_id: ctx.organization_id,
            ...this.scope(ctx),
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(query.channel && { channel: query.channel }),
            ...(query.kind && { kind: query.kind }),
            ...(query.category && { category: query.category }),
            ...(query.status && { status: query.status }),
            ...(query.search && { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { description: { contains: query.search, mode: 'insensitive' } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.commTemplate.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['name', 'created_at', 'updated_at', 'usage_count', 'last_used_at'], 'updated_at'),
                include: {
                    current_version: { select: { id: true, version: true, subject: true, published_at: true } },
                    created_by: { select: { id: true, user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } },
                    _count: { select: { versions: true } },
                },
            }),
            this.prisma.commTemplate.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const template = await this.prisma.commTemplate.findFirst({
            where: { id, organization_id: ctx.organization_id, ...this.scope(ctx) },
            include: {
                current_version: true,
                default_sender_identity: { select: { id: true, address: true, display_name: true } },
                branch: { select: { id: true, name: true } },
                versions: {
                    orderBy: { version: 'desc' },
                    select: { id: true, version: true, status: true, subject: true, change_note: true, published_at: true, created_at: true, updated_at: true, created_by: { select: { id: true, user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } } },
                },
            },
        });
        if (!template) throw notFound('Template', 'template_not_found');
        const draft = await this.prisma.commTemplateVersion.findFirst({ where: { template_id: id, status: CommTemplateVersionStatus.DRAFT }, orderBy: { version: 'desc' } });
        return { ...template, draft_version: draft };
    }

    async getVersion(ctx: OrgContext, id: string, versionId: string) {
        await this.findOne(ctx, id);
        const version = await this.prisma.commTemplateVersion.findFirst({ where: { id: versionId, template_id: id } });
        if (!version) throw notFound('Template version', 'template_version_not_found');
        return version;
    }

    private contentData(channel: CommChannel, dto: TemplateContentDto) {
        if (channel === CommChannel.SMS && !dto.body_text && dto.body_html) throw new BadRequestException({ message: 'SMS templates use a plain text body', code: 'sms_body_text_required' });
        const body_text = dto.body_text ?? (dto.body_html ? htmlToText(dto.body_html) : undefined);
        return {
            subject: channel === CommChannel.SMS ? null : dto.subject ?? null,
            preheader: channel === CommChannel.SMS ? null : dto.preheader ?? null,
            body_html: channel === CommChannel.SMS ? null : dto.body_html ?? null,
            body_text: body_text ?? null,
            design: (dto.design ?? undefined) as Prisma.InputJsonValue,
            variables: extractVariables(dto.subject, dto.preheader, dto.body_html, dto.body_text) as Prisma.InputJsonValue,
            change_note: dto.change_note ?? null,
        };
    }

    private hasContent(dto: Partial<TemplateContentDto>) {
        return CONTENT_KEYS.some((k) => dto[k] !== undefined);
    }

    async create(ctx: OrgContext, dto: CreateTemplateDto) {
        await this.assertRefs(ctx, dto);
        const content = this.contentData(dto.channel, dto);
        try {
            const template = await this.prisma.$transaction(async (tx) => {
                const t = await tx.commTemplate.create({
                    data: {
                        organization_id: ctx.organization_id,
                        name: dto.name,
                        slug: await this.uniqueSlug(ctx, dto.name),
                        description: dto.description ?? null,
                        channel: dto.channel,
                        kind: dto.kind,
                        category: dto.category,
                        language: dto.language ?? 'en',
                        default_sender_identity_id: dto.default_sender_identity_id ?? null,
                        branch_id: dto.branch_id ?? null,
                        use_branded_layout: dto.use_branded_layout ?? true,
                        variables: content.variables,
                        created_by_membership_id: ctx.membership_id,
                    },
                });
                await tx.commTemplateVersion.create({ data: { template_id: t.id, version: 1, ...content, created_by_membership_id: ctx.membership_id } });
                return t;
            });
            await this.audit.record(ctx, 'communications.template.created', { resource_type: 'comm_template', resource_id: template.id, branch_id: template.branch_id, metadata: { after: { name: dto.name, channel: dto.channel, category: dto.category } } });
            this.events.publish(ctx, { event_key: 'communications.template.created', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.COMM_TEMPLATE, entity_id: template.id, payload: { name: template.name, channel: template.channel } });
            return this.findOne(ctx, template.id);
        } catch (error) {
            if (isUniqueError(error)) throw new ConflictException({ message: 'A template with this name already exists', code: 'template_conflict' });
            throw error;
        }
    }

    async update(ctx: OrgContext, id: string, dto: UpdateTemplateDto) {
        const before = await this.findOne(ctx, id);
        if (before.archived_at) throw new ConflictException({ message: 'Restore the template before editing it', code: 'template_archived' });
        if (dto.channel && dto.channel !== before.channel) throw new BadRequestException({ message: 'The channel of a template cannot change; duplicate it instead', code: 'template_channel_locked' });
        await this.assertRefs(ctx, dto);
        await this.prisma.commTemplate.update({
            where: { id },
            data: {
                name: dto.name,
                description: dto.description,
                kind: dto.kind,
                category: dto.category,
                language: dto.language,
                default_sender_identity_id: dto.default_sender_identity_id,
                branch_id: dto.branch_id,
                use_branded_layout: dto.use_branded_layout,
            },
        });
        if (this.hasContent(dto)) await this.saveDraft(ctx, id, dto, false);
        const meta = Object.fromEntries(Object.entries(dto).filter(([k]) => !(CONTENT_KEYS as readonly string[]).includes(k)));
        await this.audit.record(ctx, 'communications.template.updated', { resource_type: 'comm_template', resource_id: id, branch_id: before.branch_id, metadata: { before: { name: before.name, category: before.category }, after: meta } });
        this.events.publish(ctx, { event_key: 'communications.template.updated', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.COMM_TEMPLATE, entity_id: id, payload: { name: dto.name ?? before.name }, changes: meta });
        return this.findOne(ctx, id);
    }

    /** Save content into the open DRAFT version (or start a new draft after the last published one). */
    async saveDraft(ctx: OrgContext, id: string, dto: TemplateContentDto, audit = true) {
        const template = await this.findOne(ctx, id);
        const base = template.draft_version ?? template.current_version;
        const merged: TemplateContentDto = {
            subject: dto.subject ?? base?.subject ?? undefined,
            preheader: dto.preheader ?? base?.preheader ?? undefined,
            body_html: dto.body_html ?? base?.body_html ?? undefined,
            body_text: dto.body_text ?? (dto.body_html !== undefined ? undefined : base?.body_text ?? undefined),
            design: dto.design ?? (base?.design as Record<string, unknown> | undefined),
            change_note: dto.change_note,
        };
        const content = this.contentData(template.channel, merged);
        const version = template.draft_version
            ? await this.prisma.commTemplateVersion.update({ where: { id: template.draft_version.id }, data: content })
            : await this.prisma.commTemplateVersion.create({
                data: { template_id: id, version: (template.versions[0]?.version ?? 0) + 1, ...content, created_by_membership_id: ctx.membership_id },
            });
        await this.prisma.commTemplate.update({ where: { id }, data: { variables: content.variables } });
        if (audit) await this.audit.record(ctx, 'communications.template.version_saved', { resource_type: 'comm_template', resource_id: id, metadata: { version: version.version } });
        return version;
    }

    async publish(ctx: OrgContext, id: string, versionId: string) {
        const template = await this.findOne(ctx, id);
        const version = await this.prisma.commTemplateVersion.findFirst({ where: { id: versionId, template_id: id } });
        if (!version) throw notFound('Template version', 'template_version_not_found');
        if (version.status === CommTemplateVersionStatus.PUBLISHED) return version;
        if (template.channel === CommChannel.EMAIL && !version.subject) throw new BadRequestException({ message: 'Add a subject before publishing', code: 'template_subject_required' });
        if (!version.body_html && !version.body_text) throw new BadRequestException({ message: 'Add content before publishing', code: 'template_body_required' });
        const now = new Date();
        const published = await this.prisma.$transaction(async (tx) => {
            await tx.commTemplateVersion.updateMany({ where: { template_id: id, status: CommTemplateVersionStatus.PUBLISHED }, data: { status: CommTemplateVersionStatus.ARCHIVED } });
            const v = await tx.commTemplateVersion.update({ where: { id: versionId }, data: { status: CommTemplateVersionStatus.PUBLISHED, published_at: now } });
            await tx.commTemplate.update({ where: { id }, data: { current_version_id: versionId, status: CommTemplateStatus.ACTIVE, variables: (version.variables ?? []) as Prisma.InputJsonValue } });
            return v;
        });
        await this.audit.record(ctx, 'communications.template.published', { resource_type: 'comm_template', resource_id: id, branch_id: template.branch_id, metadata: { version: published.version } });
        this.events.publish(ctx, { event_key: 'communications.template.published', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.COMM_TEMPLATE, entity_id: id, payload: { name: template.name, version: published.version } });
        return published;
    }

    async duplicate(ctx: OrgContext, id: string) {
        const source = await this.findOne(ctx, id);
        const content = source.draft_version ?? source.current_version;
        return this.create(ctx, {
            name: `${source.name} (copy)`.slice(0, 160),
            description: source.description ?? undefined,
            channel: source.channel,
            kind: source.kind,
            category: source.category,
            language: source.language,
            branch_id: source.branch_id ?? undefined,
            default_sender_identity_id: source.default_sender_identity_id ?? undefined,
            subject: content?.subject ?? undefined,
            preheader: content?.preheader ?? undefined,
            body_html: content?.body_html ?? undefined,
            body_text: content?.body_text ?? undefined,
        });
    }

    async archive(ctx: OrgContext, id: string) {
        const t = await this.findOne(ctx, id);
        const row = await this.prisma.commTemplate.update({ where: { id }, data: { archived_at: new Date(), status: CommTemplateStatus.ARCHIVED } });
        await this.audit.record(ctx, 'communications.template.archived', { resource_type: 'comm_template', resource_id: id, branch_id: t.branch_id });
        this.events.publish(ctx, { event_key: 'communications.template.archived', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.COMM_TEMPLATE, entity_id: id, payload: { name: t.name } });
        return row;
    }

    async restore(ctx: OrgContext, id: string) {
        const t = await this.findOne(ctx, id);
        const row = await this.prisma.commTemplate.update({ where: { id }, data: { archived_at: null, status: t.current_version_id ? CommTemplateStatus.ACTIVE : CommTemplateStatus.DRAFT } });
        await this.audit.record(ctx, 'communications.template.restored', { resource_type: 'comm_template', resource_id: id });
        return row;
    }

    async remove(ctx: OrgContext, id: string) {
        const t = await this.findOne(ctx, id);
        const inUse = await this.prisma.campaign.count({ where: { template_id: id, status: { in: ['SCHEDULED', 'SENDING', 'PAUSED'] } } });
        if (inUse) throw new ConflictException({ message: 'The template is used by a scheduled or sending campaign', code: 'template_in_use' });
        await this.prisma.commTemplate.delete({ where: { id } });
        await this.audit.record(ctx, 'communications.template.deleted', { resource_type: 'comm_template', resource_id: id, branch_id: t.branch_id, metadata: { before: { name: t.name } } });
        this.events.publish(ctx, { event_key: 'communications.template.deleted', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.COMM_TEMPLATE, entity_id: id, payload: { name: t.name } });
        return { success: true };
    }

    /** Render content with sample values or a contact's values. Shows missing variables and SMS segment count. */
    async preview(ctx: OrgContext, dto: PreviewTemplateDto) {
        let content: TemplateContentDto = dto;
        if (dto.version_id) {
            const v = await this.prisma.commTemplateVersion.findFirst({ where: { id: dto.version_id, template: { organization_id: ctx.organization_id } } });
            if (!v) throw notFound('Template version', 'template_version_not_found');
            content = { subject: v.subject ?? undefined, preheader: v.preheader ?? undefined, body_html: v.body_html ?? undefined, body_text: v.body_text ?? undefined };
        }
        const context = await this.contextFor(ctx, dto.contact_id);
        const variables = extractVariables(content.subject, content.preheader, content.body_html, content.body_text);
        const body_text = renderTemplate(content.body_text ?? htmlToText(content.body_html), context, 'text');
        return {
            subject: renderTemplate(content.subject, context, 'text'),
            preheader: renderTemplate(content.preheader, context, 'text'),
            body_html: renderTemplate(content.body_html, context, 'html'),
            body_text,
            variables,
            missing_variables: variables.filter((k) => !(k in context) || context[k] === '' || context[k] === null),
            sms_segments: smsSegments(body_text),
            sample: !dto.contact_id,
        };
    }

    async contextFor(ctx: OrgContext, contactId?: string | null): Promise<Record<string, unknown>> {
        const org = await this.prisma.organization.findUnique({ where: { id: ctx.organization_id }, select: { display_name: true } });
        if (!contactId) return { ...SAMPLE_CONTEXT, organization_name: org?.display_name ?? SAMPLE_CONTEXT.organization_name };
        const c = await this.prisma.crmContact.findFirst({ where: { id: contactId, organization_id: ctx.organization_id }, include: { company: { select: { name: true } } } });
        if (!c) throw notFound('Contact', 'contact_not_found');
        const full = [c.first_name, c.last_name].filter(Boolean).join(' ');
        return { first_name: c.first_name, last_name: c.last_name ?? '', full_name: full, email: c.email, phone: c.mobile ?? c.phone, job_title: c.job_title, company_name: c.company?.name ?? '', organization_name: org?.display_name ?? '', unsubscribe_url: '#unsubscribe' };
    }

    private async assertRefs(ctx: OrgContext, dto: UpdateTemplateDto) {
        const checks: Promise<unknown>[] = [];
        if (dto.branch_id) checks.push(this.prisma.branch.findFirstOrThrow({ where: { id: dto.branch_id, organization_id: ctx.organization_id } }));
        if (dto.default_sender_identity_id) checks.push(this.prisma.commSenderIdentity.findFirstOrThrow({ where: { id: dto.default_sender_identity_id, organization_id: ctx.organization_id } }));
        try {
            await Promise.all(checks);
        } catch {
            throw notFound('Branch or sender identity', 'reference_not_found');
        }
    }

    private async uniqueSlug(ctx: OrgContext, name: string) {
        const base = slugify(name);
        let slug = base;
        for (let i = 2; await this.prisma.commTemplate.findFirst({ where: { organization_id: ctx.organization_id, slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
        return slug;
    }
}
