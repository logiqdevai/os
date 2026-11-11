import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { CRM_PRIVATE_NOTES, MEMBER_SELECT } from '../common/crm.constants';
import { companyScopeWhere, contactScopeWhere, dealScopeWhere, leadScopeWhere } from '../common/crm-scope.utils';
import { CrmRefsService } from '../common/crm-refs.service';
import { CreateNoteDto, NoteEntityType, NoteQuery, UpdateNoteDto } from './dto/note.dto';

const RESOURCE: Record<NoteEntityType, string> = { CRM_COMPANY: 'companies', CRM_CONTACT: 'contacts', CRM_LEAD: 'leads', CRM_DEAL: 'deals' };

/**
 * 02 §16 — notes on companies, contacts, leads and deals. Reading follows the record's read key and scope;
 * writing needs the record's update key. Private notes: the author and holders of crm.notes.private.read.
 */
@Injectable()
export class CrmNotesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly refs: CrmRefsService,
    ) { }

    /** Checks the caller may `action` the parent record and returns a short label for events. */
    private async assertParent(ctx: OrgContext, type: NoteEntityType, id: string, action: 'read' | 'update') {
        const key = `crm.${RESOURCE[type]}.${action}`;
        if (!ctx.can(key)) throw new ForbiddenException({ message: `Missing permission ${key}`, code: 'permission_denied', permission: key });
        const org = ctx.organization_id;
        let label: string | null = null;
        let company_id: string | null = null;
        switch (type) {
            case 'CRM_COMPANY': { const r = await this.prisma.crmCompany.findFirst({ where: { id, organization_id: org, ...companyScopeWhere(ctx, key) }, select: { name: true, id: true } }); label = r?.name ?? null; company_id = r?.id ?? null; break; }
            case 'CRM_CONTACT': { const r = await this.prisma.crmContact.findFirst({ where: { id, organization_id: org, ...contactScopeWhere(ctx, key) }, select: { first_name: true, last_name: true, company_id: true } }); label = r ? [r.first_name, r.last_name].filter(Boolean).join(' ') : null; company_id = r?.company_id ?? null; break; }
            case 'CRM_LEAD': { const r = await this.prisma.crmLead.findFirst({ where: { id, organization_id: org, ...leadScopeWhere(ctx, key) }, select: { name: true, company_id: true } }); label = r?.name ?? null; company_id = r?.company_id ?? null; break; }
            case 'CRM_DEAL': { const r = await this.prisma.crmDeal.findFirst({ where: { id, organization_id: org, ...dealScopeWhere(ctx, key) }, select: { name: true, company_id: true } }); label = r?.name ?? null; company_id = r?.company_id ?? null; break; }
        }
        if (label === null) throw new NotFoundException({ message: 'Record not found', code: 'record_not_found' });
        return { label, company_id };
    }

    private visibility(ctx: OrgContext): Prisma.CrmNoteWhereInput {
        if (ctx.can(CRM_PRIVATE_NOTES)) return {};
        return { OR: [{ is_private: false }, { author_membership_id: ctx.membership_id ?? '__none__' }] };
    }

    async findAll(ctx: OrgContext, query: NoteQuery) {
        await this.assertParent(ctx, query.entity_type, query.entity_id, 'read');
        const notes = await this.prisma.crmNote.findMany({
            where: { organization_id: ctx.organization_id, entity_type: query.entity_type as RecordEntityType, entity_id: query.entity_id, ...this.visibility(ctx) },
            include: { author: { select: MEMBER_SELECT } },
            orderBy: [{ pinned: 'desc' }, { created_at: 'desc' }],
            take: 200,
        });
        return notes.map(({ edit_history, ...n }) => ({ ...n, edit_count: Array.isArray(edit_history) ? edit_history.length : 0, can_edit: n.author_membership_id === ctx.membership_id }));
    }

    async create(ctx: OrgContext, dto: CreateNoteDto) {
        const parent = await this.assertParent(ctx, dto.entity_type, dto.entity_id, 'update');
        await this.refs.assert(ctx, { membership: dto.mentions });
        const note = await this.prisma.$transaction(async (tx) => {
            const n = await tx.crmNote.create({
                data: {
                    organization_id: ctx.organization_id, entity_type: dto.entity_type as RecordEntityType, entity_id: dto.entity_id,
                    author_membership_id: ctx.membership_id, body: dto.body, is_private: !!dto.is_private, pinned: !!dto.pinned, mentions: dto.mentions ?? [],
                },
                include: { author: { select: MEMBER_SELECT } },
            });
            await this.audit.record(ctx, 'crm.note.created', { resource_type: 'crm_note', resource_id: n.id, metadata: { entity_type: dto.entity_type, entity_id: dto.entity_id, is_private: n.is_private } }, tx);
            return n;
        });
        this.events.publish(ctx, {
            event_key: 'crm.note.created', module: ModuleKey.CRM, entity_type: dto.entity_type as RecordEntityType, entity_id: dto.entity_id,
            payload: { note_id: note.id, record: parent.label, is_private: note.is_private, assignee_membership_ids: note.mentions },
            ...(!note.is_private && { activity: { summary: `added a note on ${parent.label}`, entity_label: parent.label, company_id: parent.company_id } }),
        });
        if (note.mentions.length) {
            this.events.publish(ctx, { event_key: 'crm.note.mentioned', module: ModuleKey.CRM, entity_type: dto.entity_type as RecordEntityType, entity_id: dto.entity_id, payload: { note_id: note.id, record: parent.label, assignee_membership_ids: note.mentions } });
        }
        return { ...note, edit_history: undefined, edit_count: 0, can_edit: true };
    }

    async update(ctx: OrgContext, id: string, dto: UpdateNoteDto) {
        const before = await this.getOwn(ctx, id);
        await this.assertParent(ctx, before.entity_type as NoteEntityType, before.entity_id, 'update');
        await this.refs.assert(ctx, { membership: dto.mentions });
        const bodyChanged = dto.body !== undefined && dto.body !== before.body;
        const history = Array.isArray(before.edit_history) ? before.edit_history : [];
        const note = await this.prisma.crmNote.update({
            where: { id },
            data: {
                ...dto,
                ...(bodyChanged && { edited_at: new Date(), edit_history: [...history, { body: before.body, edited_at: (before.edited_at ?? before.created_at).toISOString() }] as Prisma.InputJsonValue }),
            },
            include: { author: { select: MEMBER_SELECT } },
        });
        await this.audit.record(ctx, 'crm.note.updated', { resource_type: 'crm_note', resource_id: id, metadata: { before: { is_private: before.is_private, pinned: before.pinned }, after: { is_private: note.is_private, pinned: note.pinned, body_changed: bodyChanged } } });
        const newMentions = (dto.mentions ?? []).filter((m) => !before.mentions.includes(m));
        if (newMentions.length) this.events.publish(ctx, { event_key: 'crm.note.mentioned', module: ModuleKey.CRM, entity_type: before.entity_type, entity_id: before.entity_id, payload: { note_id: id, assignee_membership_ids: newMentions } });
        const { edit_history, ...rest } = note;
        return { ...rest, edit_count: Array.isArray(edit_history) ? edit_history.length : 0, can_edit: true };
    }

    async remove(ctx: OrgContext, id: string) {
        const note = await this.prisma.crmNote.findFirst({ where: { id, organization_id: ctx.organization_id, ...this.visibility(ctx) } });
        if (!note) throw new NotFoundException({ message: 'Note not found', code: 'note_not_found' });
        await this.assertParent(ctx, note.entity_type as NoteEntityType, note.entity_id, 'update');
        if (note.author_membership_id !== ctx.membership_id && !ctx.can(`crm.${RESOURCE[note.entity_type as NoteEntityType]}.delete`)) {
            throw new ForbiddenException({ message: 'Only the author can delete this note', code: 'note_not_author' });
        }
        await this.prisma.crmNote.delete({ where: { id } });
        await this.audit.record(ctx, 'crm.note.deleted', { resource_type: 'crm_note', resource_id: id, metadata: { entity_type: note.entity_type, entity_id: note.entity_id } });
        return { success: true };
    }

    private async getOwn(ctx: OrgContext, id: string) {
        const note = await this.prisma.crmNote.findFirst({ where: { id, organization_id: ctx.organization_id, ...this.visibility(ctx) } });
        if (!note) throw new NotFoundException({ message: 'Note not found', code: 'note_not_found' });
        if (note.author_membership_id !== ctx.membership_id) throw new ForbiddenException({ message: 'Only the author can edit this note', code: 'note_not_author' });
        return note;
    }
}
