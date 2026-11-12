import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
    CustomFormStatus,
    FormAssignmentRecipientStatus,
    FormAssignmentTargetType,
    FormSubmissionStatus,
    MembershipStatus,
    ModuleKey,
    Prisma,
} from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import {
    CreateAssignmentDto,
    CreateFormDto,
    FieldsSchema,
    FormField,
    FormQuery,
    ReviewSubmissionDto,
    SubmissionQuery,
    UpdateFormDto,
} from '../dto/form.dto';
import { MEMBER_SELECT, publicContext } from '../utils/docs.utils';

const MAX_ANSWERS_BYTES = 64 * 1024;

/**
 * Custom forms (15 §5): builder schema, publish → frozen version, assignments with recipients,
 * submissions (named or anonymous), review, summary and export. Anonymous + published forms also
 * accept submissions on the public link (`/public/forms/:id`).
 */
@Injectable()
export class DocsFormsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    // --- Definitions ---------------------------------------------------------------------

    async findAll(ctx: OrgContext, query: FormQuery) {
        const where: Prisma.CustomFormWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.archived ? { status: CustomFormStatus.ARCHIVED } : query.status ? { status: query.status } : { status: { not: CustomFormStatus.ARCHIVED } }),
            ...(query.kind && { kind: query.kind }),
            ...(query.space_id && { space_id: query.space_id }),
            ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.customForm.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['name', 'created_at', 'updated_at', 'published_at'], 'updated_at'),
                include: {
                    owner: { select: MEMBER_SELECT },
                    space: { select: { id: true, name: true } },
                    _count: { select: { submissions: { where: { status: { not: FormSubmissionStatus.DRAFT } } }, assignments: { where: { cancelled_at: null } } } },
                },
            }),
            this.prisma.customForm.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const form = await this.prisma.customForm.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: {
                owner: { select: MEMBER_SELECT },
                space: { select: { id: true, name: true } },
                versions: { select: { id: true, version_number: true, change_summary: true, created_at: true }, orderBy: { version_number: 'desc' } },
                _count: { select: { submissions: { where: { status: { not: FormSubmissionStatus.DRAFT } } }, assignments: true } },
            },
        });
        if (!form) throw new NotFoundException({ message: 'Form not found', code: 'form_not_found' });
        return { ...form, public_link_enabled: this.publicEnabled(form) };
    }

    async create(ctx: OrgContext, dto: CreateFormDto) {
        const fields = this.parseFields(dto.fields_schema ?? []);
        await this.assertRefs(ctx, dto);
        const form = await this.prisma.customForm.create({
            data: {
                ...dto,
                fields_schema: fields as unknown as Prisma.InputJsonValue,
                organization_id: ctx.organization_id,
                slug: await this.uniqueSlug(ctx, dto.name),
                owner_membership_id: ctx.membership_id,
                created_by_user_id: ctx.user_id,
            },
        });
        await this.audit.record(ctx, 'custom_form.created', { resource_type: 'custom_form', resource_id: form.id, metadata: { after: { name: form.name, kind: form.kind, is_anonymous: form.is_anonymous, fields: fields.length } } });
        this.events.publish(ctx, { event_key: 'docs.form.created', module: ModuleKey.BUSINESS_DOCS, entity_kind: 'custom_form', entity_id: form.id, payload: { name: form.name, kind: form.kind } });
        return form;
    }

    async update(ctx: OrgContext, id: string, dto: UpdateFormDto) {
        const before = await this.findOne(ctx, id);
        if (before.status === CustomFormStatus.ARCHIVED) throw new BadRequestException({ message: 'Unarchive the form before editing it', code: 'form_archived' });
        if (dto.is_anonymous !== undefined && dto.is_anonymous !== before.is_anonymous && before._count.submissions > 0) {
            throw new ConflictException({ message: 'The anonymous setting is locked after the first submission', code: 'form_anonymous_locked' });
        }
        await this.assertRefs(ctx, dto);
        const data: Prisma.CustomFormUpdateInput = { ...dto, fields_schema: undefined };
        if (dto.fields_schema) data.fields_schema = this.parseFields(dto.fields_schema) as unknown as Prisma.InputJsonValue;
        const form = await this.prisma.customForm.update({ where: { id }, data });
        await this.audit.record(ctx, 'custom_form.updated', {
            resource_type: 'custom_form', resource_id: id,
            metadata: { before: { name: before.name, is_anonymous: before.is_anonymous, status: before.status }, after: { ...dto, fields_schema: dto.fields_schema ? `${dto.fields_schema.length} fields` : undefined } },
        });
        this.events.publish(ctx, { event_key: 'docs.form.updated', module: ModuleKey.BUSINESS_DOCS, entity_kind: 'custom_form', entity_id: id, payload: { name: form.name } });
        return form;
    }

    /** Freeze the current draft schema as a new version and open the form for responses. */
    async publish(ctx: OrgContext, id: string, changeSummary?: string) {
        const form = await this.findOne(ctx, id);
        const fields = this.parseFields(form.fields_schema as unknown[]);
        if (!fields.filter((f) => f.type !== 'SECTION').length) throw new BadRequestException({ message: 'Add at least one question before publishing', code: 'form_empty' });
        const next = form.current_version_number + 1;
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.customFormVersion.create({ data: { form_id: id, version_number: next, fields_schema: fields as unknown as Prisma.InputJsonValue, change_summary: changeSummary ?? null, created_by_user_id: ctx.user_id } });
            const row = await tx.customForm.update({ where: { id }, data: { status: CustomFormStatus.PUBLISHED, current_version_number: next, published_at: form.published_at ?? new Date() } });
            await this.audit.record(ctx, 'custom_form.published', { resource_type: 'custom_form', resource_id: id, metadata: { version_number: next } }, tx);
            return row;
        });
        this.events.publish(ctx, {
            event_key: 'docs.form.published', module: ModuleKey.BUSINESS_DOCS, entity_kind: 'custom_form', entity_id: id,
            payload: { name: form.name, version_number: next }, activity: { summary: `published the form ${form.name}`, entity_label: form.name },
        });
        return updated;
    }

    async setStatus(ctx: OrgContext, id: string, status: 'CLOSED' | 'PUBLISHED' | 'ARCHIVED' | 'DRAFT') {
        const form = await this.findOne(ctx, id);
        if (status === CustomFormStatus.PUBLISHED && !form.current_version_number) throw new BadRequestException({ message: 'Publish the form first', code: 'form_not_published' });
        if (status === CustomFormStatus.DRAFT) status = form.current_version_number ? CustomFormStatus.CLOSED : CustomFormStatus.DRAFT;
        const row = await this.prisma.customForm.update({ where: { id }, data: { status, archived_at: status === CustomFormStatus.ARCHIVED ? new Date() : null } });
        await this.audit.record(ctx, `custom_form.${status.toLowerCase()}`, { resource_type: 'custom_form', resource_id: id, metadata: { before: { status: form.status }, after: { status } } });
        this.events.publish(ctx, { event_key: `docs.form.${status === 'PUBLISHED' ? 'reopened' : status.toLowerCase()}`, module: ModuleKey.BUSINESS_DOCS, entity_kind: 'custom_form', entity_id: id, payload: { name: form.name, status } });
        return row;
    }

    async remove(ctx: OrgContext, id: string) {
        const form = await this.findOne(ctx, id);
        await this.prisma.$transaction(async (tx) => {
            await tx.formSubmission.deleteMany({ where: { form_id: id } });
            await tx.customForm.delete({ where: { id } });
            await this.audit.record(ctx, 'custom_form.deleted', { resource_type: 'custom_form', resource_id: id, metadata: { name: form.name, submissions: form._count.submissions } }, tx);
        });
        this.events.publish(ctx, { event_key: 'docs.form.deleted', module: ModuleKey.BUSINESS_DOCS, entity_kind: 'custom_form', entity_id: id, payload: { name: form.name } });
        return { success: true };
    }

    // --- Assignments ---------------------------------------------------------------------

    async assignments(ctx: OrgContext, id: string) {
        await this.findOne(ctx, id);
        return this.prisma.formAssignment.findMany({ where: { form_id: id, organization_id: ctx.organization_id }, orderBy: { created_at: 'desc' } });
    }

    async recipients(ctx: OrgContext, id: string) {
        await this.findOne(ctx, id);
        return this.prisma.formAssignmentRecipient.findMany({
            where: { assignment: { form_id: id, organization_id: ctx.organization_id, cancelled_at: null } },
            include: { membership: { select: MEMBER_SELECT }, assignment: { select: { id: true, due_at: true, target_type: true } } },
            orderBy: [{ status: 'asc' }, { created_at: 'asc' }],
        });
    }

    async assign(ctx: OrgContext, id: string, dto: CreateAssignmentDto) {
        const form = await this.findOne(ctx, id);
        if (form.status !== CustomFormStatus.PUBLISHED) throw new BadRequestException({ message: 'Publish the form before assigning it', code: 'form_not_published' });
        if (dto.target_type !== FormAssignmentTargetType.ORGANIZATION && !dto.target_id) throw new BadRequestException({ message: 'Choose who to assign the form to', code: 'form_assignment_target_required' });
        const membershipIds = await this.expandTarget(ctx, dto.target_type, dto.target_id ?? null);
        if (!membershipIds.length) throw new BadRequestException({ message: 'Nobody matches this assignment target', code: 'form_assignment_empty' });
        const assignment = await this.prisma.$transaction(async (tx) => {
            const a = await tx.formAssignment.create({
                data: {
                    organization_id: ctx.organization_id, form_id: id, target_type: dto.target_type, target_id: dto.target_id ?? null,
                    due_at: dto.due_at ? new Date(dto.due_at) : null, message: dto.message, assigned_by_membership_id: ctx.membership_id, recipient_count: membershipIds.length,
                },
            });
            await tx.formAssignmentRecipient.createMany({ data: membershipIds.map((m) => ({ assignment_id: a.id, membership_id: m })), skipDuplicates: true });
            await this.audit.record(ctx, 'custom_form.assigned', { resource_type: 'custom_form', resource_id: id, metadata: { assignment_id: a.id, target_type: dto.target_type, target_id: dto.target_id, recipients: membershipIds.length } }, tx);
            return a;
        });
        this.events.publish(ctx, {
            event_key: 'docs.form.assigned', module: ModuleKey.BUSINESS_DOCS, entity_kind: 'custom_form', entity_id: id,
            payload: { name: form.name, assignment_id: assignment.id, recipient_membership_ids: membershipIds, due_at: assignment.due_at },
        });
        return assignment;
    }

    async cancelAssignment(ctx: OrgContext, id: string, assignmentId: string) {
        await this.findOne(ctx, id);
        const res = await this.prisma.formAssignment.updateMany({ where: { id: assignmentId, form_id: id, organization_id: ctx.organization_id, cancelled_at: null }, data: { cancelled_at: new Date() } });
        if (!res.count) throw new NotFoundException({ message: 'Assignment not found', code: 'form_assignment_not_found' });
        await this.prisma.formAssignmentRecipient.updateMany({ where: { assignment_id: assignmentId, status: { in: [FormAssignmentRecipientStatus.PENDING, FormAssignmentRecipientStatus.IN_PROGRESS, FormAssignmentRecipientStatus.OVERDUE] } }, data: { status: FormAssignmentRecipientStatus.CANCELLED } });
        await this.audit.record(ctx, 'custom_form.assignment_cancelled', { resource_type: 'custom_form', resource_id: id, metadata: { assignment_id: assignmentId } });
        return { success: true };
    }

    /** Forms assigned to the caller that still need a response. */
    async myAssignments(ctx: OrgContext) {
        if (!ctx.membership_id) return [];
        return this.prisma.formAssignmentRecipient.findMany({
            where: { membership_id: ctx.membership_id, status: { in: [FormAssignmentRecipientStatus.PENDING, FormAssignmentRecipientStatus.IN_PROGRESS, FormAssignmentRecipientStatus.OVERDUE] }, assignment: { organization_id: ctx.organization_id, cancelled_at: null, form: { status: CustomFormStatus.PUBLISHED } } },
            include: { assignment: { select: { id: true, due_at: true, message: true, form: { select: { id: true, name: true, description: true, kind: true } } } } },
            orderBy: { created_at: 'desc' },
        });
    }

    // --- Filling & submissions -----------------------------------------------------------

    /** The published version for a respondent (assigned member or forms reader). */
    async forFilling(ctx: OrgContext, id: string) {
        const form = await this.loadFillable(ctx.organization_id, id);
        await this.assertCanFill(ctx, form.id);
        const version = await this.latestVersion(form.id);
        const mine = ctx.membership_id && !form.is_anonymous
            ? await this.prisma.formSubmission.count({ where: { form_id: id, respondent_membership_id: ctx.membership_id, status: { not: FormSubmissionStatus.DRAFT } } })
            : 0;
        return {
            id: form.id, name: form.name, description: form.description, kind: form.kind, is_anonymous: form.is_anonymous,
            allow_multiple_submissions: form.allow_multiple_submissions, confirmation_message: form.confirmation_message,
            closes_at: form.closes_at, version_number: version.version_number, fields: version.fields_schema, already_submitted: mine > 0,
        };
    }

    async submit(ctx: OrgContext, id: string, answers: Record<string, unknown>) {
        const form = await this.loadFillable(ctx.organization_id, id);
        await this.assertCanFill(ctx, form.id);
        return this.storeSubmission(ctx, form, answers);
    }

    async publicForm(id: string) {
        const form = await this.prisma.customForm.findUnique({ where: { id }, include: { organization: { select: { id: true, display_name: true } } } });
        if (!form || !this.publicEnabled(form) || !this.isOpen(form)) throw new NotFoundException({ message: 'This form is not available', code: 'form_not_available' });
        const version = await this.latestVersion(form.id);
        return {
            id: form.id, name: form.name, description: form.description, organization_name: form.organization.display_name,
            confirmation_message: form.confirmation_message, closes_at: form.closes_at, version_number: version.version_number, fields: version.fields_schema,
        };
    }

    async submitPublic(id: string, answers: Record<string, unknown>, meta: { ip?: string | null; user_agent?: string | null }) {
        const form = await this.prisma.customForm.findUnique({ where: { id } });
        if (!form || !this.publicEnabled(form) || !this.isOpen(form)) throw new NotFoundException({ message: 'This form is not available', code: 'form_not_available' });
        const ctx = publicContext(form.organization_id, meta);
        const res = await this.storeSubmission(ctx, form, answers);
        return { success: true, confirmation_message: form.confirmation_message, id: res.id };
    }

    async submissions(ctx: OrgContext, id: string, query: SubmissionQuery) {
        const form = await this.findOne(ctx, id);
        this.assertAnonymousAccess(ctx, form);
        const where: Prisma.FormSubmissionWhereInput = {
            form_id: id, organization_id: ctx.organization_id,
            ...(query.status ? { status: query.status } : { status: { not: FormSubmissionStatus.DRAFT } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.formSubmission.findMany({
                where, ...skipTake(query), orderBy: { submitted_at: query.order_direction ?? 'desc' },
                include: { respondent: { select: MEMBER_SELECT }, form_version: { select: { version_number: true } } },
            }),
            this.prisma.formSubmission.count({ where }),
        ]);
        if (form.is_anonymous) this.audit.recordAsync(ctx, 'custom_form.anonymous_responses_viewed', { resource_type: 'custom_form', resource_id: id, metadata: { count: items.length } });
        return paginate(items, total, query);
    }

    async review(ctx: OrgContext, id: string, submissionId: string, dto: ReviewSubmissionDto) {
        const form = await this.findOne(ctx, id);
        const allowedStatuses: FormSubmissionStatus[] = [FormSubmissionStatus.UNDER_REVIEW, FormSubmissionStatus.REVIEWED, FormSubmissionStatus.REJECTED];
        if (!allowedStatuses.includes(dto.status)) throw new BadRequestException({ message: 'Invalid review status', code: 'form_review_status_invalid' });
        if (form.reviewer_membership_ids.length && ctx.membership_id && !form.reviewer_membership_ids.includes(ctx.membership_id) && form.owner_membership_id !== ctx.membership_id) {
            throw new ForbiddenException({ message: 'You are not a reviewer of this form', code: 'form_not_reviewer' });
        }
        const sub = await this.prisma.formSubmission.findFirst({ where: { id: submissionId, form_id: id, organization_id: ctx.organization_id } });
        if (!sub) throw new NotFoundException({ message: 'Response not found', code: 'form_submission_not_found' });
        const row = await this.prisma.formSubmission.update({ where: { id: submissionId }, data: { status: dto.status, review_notes: dto.review_notes, reviewed_at: new Date(), reviewed_by_membership_id: ctx.membership_id } });
        await this.audit.record(ctx, 'form_submission.reviewed', { resource_type: 'form_submission', resource_id: submissionId, metadata: { before: { status: sub.status }, after: { status: dto.status } } });
        this.events.publish(ctx, { event_key: 'docs.form.response_reviewed', module: ModuleKey.BUSINESS_DOCS, entity_kind: 'form_submission', entity_id: submissionId, payload: { form_id: id, form_name: form.name, status: dto.status, respondent_membership_id: sub.respondent_membership_id } });
        return row;
    }

    /** Per-question summary: counts for choices/checkbox, average for scale/number, response count for text. */
    async summary(ctx: OrgContext, id: string) {
        const form = await this.findOne(ctx, id);
        this.assertAnonymousAccess(ctx, form);
        const subs = await this.prisma.formSubmission.findMany({ where: { form_id: id, status: { not: FormSubmissionStatus.DRAFT } }, select: { answers: true, submitted_at: true }, take: 5000 });
        const fields = this.parseFields(form.fields_schema as unknown[]);
        const [recipients, submittedRecipients] = await Promise.all([
            this.prisma.formAssignmentRecipient.count({ where: { assignment: { form_id: id, cancelled_at: null }, status: { not: FormAssignmentRecipientStatus.CANCELLED } } }),
            this.prisma.formAssignmentRecipient.count({ where: { assignment: { form_id: id, cancelled_at: null }, status: FormAssignmentRecipientStatus.SUBMITTED } }),
        ]);
        const questions = fields.filter((f) => f.type !== 'SECTION').map((f) => {
            const values = subs.map((s) => (s.answers as Record<string, unknown>)?.[f.key]).filter((v) => v !== undefined && v !== null && v !== '');
            if (f.type === 'SINGLE_CHOICE' || f.type === 'MULTI_CHOICE') {
                const counts: Record<string, number> = {};
                for (const v of values) for (const x of Array.isArray(v) ? v : [v]) counts[String(x)] = (counts[String(x)] ?? 0) + 1;
                return { key: f.key, label: f.label, type: f.type, responses: values.length, options: (f.options ?? []).map((o) => ({ value: o.value, label: o.label, count: counts[o.value] ?? 0 })) };
            }
            if (f.type === 'CHECKBOX') return { key: f.key, label: f.label, type: f.type, responses: values.length, yes: values.filter((v) => v === true).length };
            if (f.type === 'SCALE' || f.type === 'NUMBER') {
                const nums = values.map(Number).filter((n) => !Number.isNaN(n));
                return { key: f.key, label: f.label, type: f.type, responses: nums.length, average: nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null };
            }
            return { key: f.key, label: f.label, type: f.type, responses: values.length, latest: form.is_anonymous ? [] : values.slice(-3).map(String) };
        });
        return { total_responses: subs.length, recipients, submitted_recipients: submittedRecipients, questions };
    }

    /** CSV export (sensitive, audited). */
    async exportCsv(ctx: OrgContext, id: string) {
        const form = await this.findOne(ctx, id);
        this.assertAnonymousAccess(ctx, form);
        const fields = this.parseFields(form.fields_schema as unknown[]).filter((f) => f.type !== 'SECTION');
        const subs = await this.prisma.formSubmission.findMany({ where: { form_id: id, status: { not: FormSubmissionStatus.DRAFT } }, include: { respondent: { select: MEMBER_SELECT } }, orderBy: { submitted_at: 'asc' } });
        const esc = (v: unknown) => {
            const s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join('; ') : String(v);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const header = ['submitted_at', 'status', ...(form.is_anonymous ? [] : ['respondent']), ...fields.map((f) => f.label)];
        const lines = subs.map((s) => [
            s.submitted_at?.toISOString() ?? '',
            s.status,
            ...(form.is_anonymous ? [] : [s.respondent?.user.email ?? '']),
            ...fields.map((f) => (s.answers as Record<string, unknown>)?.[f.key]),
        ].map(esc).join(','));
        await this.audit.record(ctx, 'custom_form.exported', { resource_type: 'custom_form', resource_id: id, metadata: { rows: subs.length, format: 'csv' } });
        return { filename: `${form.slug}-responses.csv`, content: [header.map(esc).join(','), ...lines].join('\n') };
    }

    // --- Helpers -------------------------------------------------------------------------

    private async storeSubmission(ctx: OrgContext, form: { id: string; name: string; organization_id: string; is_anonymous: boolean; allow_multiple_submissions: boolean; requires_review: boolean }, answers: Record<string, unknown>) {
        if (Buffer.byteLength(JSON.stringify(answers ?? {}), 'utf8') > MAX_ANSWERS_BYTES) throw new BadRequestException({ message: 'The response is too large', code: 'form_answers_too_large' });
        const version = await this.latestVersion(form.id);
        const clean = this.validateAnswers(this.parseFields(version.fields_schema as unknown[]), answers ?? {});
        const respondent = form.is_anonymous ? null : ctx.membership_id;
        if (!form.allow_multiple_submissions && respondent) {
            const existing = await this.prisma.formSubmission.count({ where: { form_id: form.id, respondent_membership_id: respondent, status: { not: FormSubmissionStatus.DRAFT } } });
            if (existing) throw new ConflictException({ message: 'You already responded to this form', code: 'form_already_submitted' });
        }
        const now = new Date();
        const sub = await this.prisma.$transaction(async (tx) => {
            const created = await tx.formSubmission.create({
                data: {
                    organization_id: form.organization_id, form_id: form.id, form_version_id: version.id,
                    respondent_membership_id: respondent, submitted_by_user_id: form.is_anonymous ? null : ctx.user_id,
                    is_anonymous: form.is_anonymous, status: form.requires_review ? FormSubmissionStatus.UNDER_REVIEW : FormSubmissionStatus.SUBMITTED,
                    answers: clean as Prisma.InputJsonValue, submitted_at: now, exclude_from_ai_index: form.is_anonymous,
                },
            });
            if (ctx.membership_id) {
                const open = await tx.formAssignmentRecipient.findMany({
                    where: { membership_id: ctx.membership_id, status: { in: [FormAssignmentRecipientStatus.PENDING, FormAssignmentRecipientStatus.IN_PROGRESS, FormAssignmentRecipientStatus.OVERDUE] }, assignment: { form_id: form.id, cancelled_at: null } },
                    select: { id: true, assignment_id: true },
                });
                for (const [i, r] of open.entries()) {
                    // Anonymous: completion is tracked but the response is never linked to the person.
                    await tx.formAssignmentRecipient.update({ where: { id: r.id }, data: { status: FormAssignmentRecipientStatus.SUBMITTED, submitted_at: now, submission_id: form.is_anonymous || i > 0 ? null : created.id } });
                    await tx.formAssignment.update({ where: { id: r.assignment_id }, data: { submitted_count: { increment: 1 } } });
                }
            }
            await this.audit.record(ctx, 'form_submission.created', { resource_type: 'form_submission', resource_id: created.id, metadata: { form_id: form.id, anonymous: form.is_anonymous } }, tx);
            return created;
        });
        this.events.publish(ctx, {
            event_key: 'docs.form.submitted', module: ModuleKey.BUSINESS_DOCS, entity_kind: 'form_submission', entity_id: sub.id,
            payload: { form_id: form.id, form_name: form.name, anonymous: form.is_anonymous, respondent_membership_id: respondent, status: sub.status, ...(form.is_anonymous ? {} : { answers: clean }) },
        });
        return sub;
    }

    private validateAnswers(fields: FormField[], answers: Record<string, unknown>) {
        const out: Record<string, unknown> = {};
        const errors: Record<string, string> = {};
        for (const f of fields) {
            if (f.type === 'SECTION') continue;
            const v = answers[f.key];
            const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) || (f.type === 'CHECKBOX' && v === false && f.required);
            if (empty) {
                if (f.required) errors[f.key] = `${f.label} is required`;
                continue;
            }
            switch (f.type) {
                case 'SHORT_TEXT':
                case 'LONG_TEXT':
                case 'SIGNATURE':
                    if (typeof v !== 'string' || v.length > (f.type === 'SHORT_TEXT' ? 500 : 10_000)) errors[f.key] = `${f.label}: invalid text`;
                    else out[f.key] = v.trim();
                    break;
                case 'EMAIL':
                    if (typeof v !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors[f.key] = `${f.label}: enter a valid email`;
                    else out[f.key] = v.trim().toLowerCase();
                    break;
                case 'NUMBER': {
                    const n = typeof v === 'number' ? v : Number(v);
                    if (Number.isNaN(n)) errors[f.key] = `${f.label}: enter a number`;
                    else out[f.key] = n;
                    break;
                }
                case 'SCALE': {
                    const n = typeof v === 'number' ? v : Number(v);
                    const min = f.scale?.min ?? 1;
                    const max = f.scale?.max ?? 5;
                    if (!Number.isInteger(n) || n < min || n > max) errors[f.key] = `${f.label}: choose ${min}–${max}`;
                    else out[f.key] = n;
                    break;
                }
                case 'DATE':
                    if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) errors[f.key] = `${f.label}: enter a valid date`;
                    else out[f.key] = v.slice(0, 10);
                    break;
                case 'CHECKBOX':
                    out[f.key] = v === true || v === 'true';
                    break;
                case 'SINGLE_CHOICE':
                    if (typeof v !== 'string' || !f.options?.some((o) => o.value === v)) errors[f.key] = `${f.label}: choose one of the options`;
                    else out[f.key] = v;
                    break;
                case 'MULTI_CHOICE': {
                    const arr = Array.isArray(v) ? v : [v];
                    if (!arr.every((x) => typeof x === 'string' && f.options?.some((o) => o.value === x))) errors[f.key] = `${f.label}: choose from the options`;
                    else out[f.key] = [...new Set(arr)];
                    break;
                }
                case 'FILE_UPLOAD': {
                    const arr = (Array.isArray(v) ? v : [v]).map(String);
                    if (arr.length > (f.max_files ?? 5)) errors[f.key] = `${f.label}: too many files`;
                    else out[f.key] = arr;
                    break;
                }
            }
        }
        if (Object.keys(errors).length) throw new BadRequestException({ message: Object.values(errors)[0], code: 'form_answers_invalid', errors });
        return out;
    }

    private parseFields(raw: unknown[]): FormField[] {
        const res = FieldsSchema.safeParse(raw ?? []);
        if (!res.success) throw new BadRequestException({ message: res.error.issues[0]?.message ?? 'Invalid form fields', code: 'form_fields_invalid', issues: res.error.issues });
        return res.data;
    }

    private async latestVersion(formId: string) {
        const v = await this.prisma.customFormVersion.findFirst({ where: { form_id: formId }, orderBy: { version_number: 'desc' } });
        if (!v) throw new NotFoundException({ message: 'This form has not been published', code: 'form_not_published' });
        return v;
    }

    private async loadFillable(orgId: string, id: string) {
        const form = await this.prisma.customForm.findFirst({ where: { id, organization_id: orgId } });
        if (!form) throw new NotFoundException({ message: 'Form not found', code: 'form_not_found' });
        if (form.status !== CustomFormStatus.PUBLISHED || !this.isOpen(form)) throw new BadRequestException({ message: 'This form is not accepting responses', code: 'form_closed' });
        return form;
    }

    /** Respondents: assigned members, or anyone holding docs.forms.read. */
    private async assertCanFill(ctx: OrgContext, formId: string) {
        if (ctx.can('docs.forms.read')) return;
        if (!ctx.membership_id) throw new NotFoundException({ message: 'Form not found', code: 'form_not_found' });
        const assigned = await this.prisma.formAssignmentRecipient.count({ where: { membership_id: ctx.membership_id, assignment: { form_id: formId, cancelled_at: null } } });
        if (!assigned) throw new NotFoundException({ message: 'Form not found', code: 'form_not_found' });
    }

    private assertAnonymousAccess(ctx: OrgContext, form: { is_anonymous: boolean }) {
        if (form.is_anonymous && !ctx.can('docs.forms.anonymous_responses.read')) {
            throw new ForbiddenException({ message: 'Viewing anonymous responses needs docs.forms.anonymous_responses.read', code: 'permission_denied', permissions: ['docs.forms.anonymous_responses.read'] });
        }
    }

    private publicEnabled(form: { status: CustomFormStatus; is_anonymous: boolean; current_version_number: number }) {
        return form.status === CustomFormStatus.PUBLISHED && form.is_anonymous && form.current_version_number > 0;
    }

    private isOpen(form: { opens_at: Date | null; closes_at: Date | null }) {
        const now = Date.now();
        return (!form.opens_at || form.opens_at.getTime() <= now) && (!form.closes_at || form.closes_at.getTime() > now);
    }

    private async expandTarget(ctx: OrgContext, type: FormAssignmentTargetType, targetId: string | null): Promise<string[]> {
        const org = ctx.organization_id;
        const active = { organization_id: org, status: MembershipStatus.ACTIVE };
        switch (type) {
            case FormAssignmentTargetType.MEMBERSHIP: {
                const m = await this.prisma.membership.findFirst({ where: { id: targetId as string, ...active }, select: { id: true } });
                return m ? [m.id] : [];
            }
            case FormAssignmentTargetType.TEAM:
            case FormAssignmentTargetType.DEPARTMENT: {
                const team = await this.prisma.team.findFirst({ where: { id: targetId as string, organization_id: org } });
                if (!team) throw new NotFoundException({ message: 'Team not found', code: 'team_not_found' });
                const rows = await this.prisma.teamMembership.findMany({ where: { team_id: team.id, ended_at: null, membership: active }, select: { membership_id: true } });
                return rows.map((r) => r.membership_id);
            }
            case FormAssignmentTargetType.BRANCH: {
                const branch = await this.prisma.branch.findFirst({ where: { id: targetId as string, organization_id: org } });
                if (!branch) throw new NotFoundException({ message: 'Branch not found', code: 'branch_not_found' });
                const rows = await this.prisma.membershipBranch.findMany({ where: { branch_id: branch.id, ended_at: null, membership: active }, select: { membership_id: true } });
                return [...new Set(rows.map((r) => r.membership_id))];
            }
            default: {
                const rows = await this.prisma.membership.findMany({ where: active, select: { id: true } });
                return rows.map((r) => r.id);
            }
        }
    }

    private async assertRefs(ctx: OrgContext, dto: UpdateFormDto) {
        if (dto.space_id && !(await this.prisma.wikiSpace.count({ where: { id: dto.space_id, organization_id: ctx.organization_id } }))) {
            throw new BadRequestException({ message: 'Space not found', code: 'wiki_space_not_found' });
        }
        if (dto.reviewer_membership_ids?.length) {
            const n = await this.prisma.membership.count({ where: { id: { in: dto.reviewer_membership_ids }, organization_id: ctx.organization_id } });
            if (n !== new Set(dto.reviewer_membership_ids).size) throw new BadRequestException({ message: 'A reviewer was not found', code: 'membership_not_found' });
        }
    }

    private async uniqueSlug(ctx: OrgContext, name: string) {
        const base = slugify(name) || 'form';
        let slug = base;
        for (let i = 2; await this.prisma.customForm.findFirst({ where: { organization_id: ctx.organization_id, slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
        return slug;
    }
}
