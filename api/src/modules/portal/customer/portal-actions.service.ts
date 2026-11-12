import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentSource, ModuleKey, NotificationDigestFrequency, NotificationRecipientType, Prisma } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { DocumentsService, IncomingFile } from '@/modules/files/services/documents.service';
import { ProposalFlowService } from '@/modules/proposals/proposal-flow.service';
import { SignaturesService } from '@/modules/contracts/signatures/signatures.service';
import { PortalContext, PortalFeature } from '../common/portal-context';

/** Notification topics a portal user can switch off; each maps to a module of the 14 preference model (scope `module:<KEY>`). */
export const PORTAL_NOTIFICATION_TOPICS: { module: ModuleKey; feature: PortalFeature; label: string; description: string }[] = [
    { module: ModuleKey.SUPPORT, feature: 'requests', label: 'Requests and messages', description: 'Replies from the team and status changes of your requests.' },
    { module: ModuleKey.PROJECTS, feature: 'projects', label: 'Projects and approvals', description: 'Status updates, milestones and deliverables waiting for your review.' },
    { module: ModuleKey.PROPOSALS, feature: 'proposals', label: 'Proposals', description: 'New proposals and reminders before they expire.' },
    { module: ModuleKey.CONTRACTS, feature: 'contracts', label: 'Contracts', description: 'Contracts waiting for your signature and renewals.' },
    { module: ModuleKey.FINANCE, feature: 'billing', label: 'Invoices and payments', description: 'New invoices, payment confirmations and reminders.' },
    { module: ModuleKey.DOCUMENTS, feature: 'documents', label: 'Documents', description: 'Files the team shares with you.' },
];

export const PortalUploadFieldsSchema = z.object({
    title: z.string().trim().min(1).max(255).optional(),
    project_id: z.string().uuid().optional(),
    description: z.string().max(2000).optional(),
});
export type PortalUploadFields = z.infer<typeof PortalUploadFieldsSchema>;

export const PortalNotificationPreferencesSchema = z.object({
    email_enabled: z.boolean().optional(),
    in_app_enabled: z.boolean().optional(),
    digest_frequency: z.nativeEnum(NotificationDigestFrequency).optional(),
    topics: z.array(z.object({ module: z.nativeEnum(ModuleKey), enabled: z.boolean() })).max(20).optional(),
});
export type PortalNotificationPreferences = z.infer<typeof PortalNotificationPreferencesSchema>;

/**
 * Customer portal actions that reuse other modules (07 §9, §10, §11, §13):
 * - document upload through Files (17) into the company's customer-visible upload folder,
 * - proposal acceptance / contract signing by issuing a fresh token through Proposals (03) / Contracts (04) and redirecting into
 *   their public pages (`/p/:token`, `/sign/:token`), so acceptance and signature evidence stay in one place,
 * - the portal user's own notification preferences on the 14 tables (recipient `p:<portal_membership_id>`).
 * Every call is pinned to PortalContext (organization + customer) and re-checks the portal feature switch.
 */
@Injectable()
export class PortalActionsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly documents: DocumentsService,
        private readonly proposals: ProposalFlowService,
        private readonly signatures: SignaturesService,
    ) { }

    private feature(p: PortalContext, f: PortalFeature) {
        if (!p.features[f]) throw new ForbiddenException({ message: 'This part of the portal is switched off', code: 'portal_feature_disabled', feature: f });
    }

    private async user(p: PortalContext) {
        return this.prisma.user.findUniqueOrThrow({ where: { id: p.user_id }, select: { email: true, display_name: true, first_name: true, last_name: true } });
    }

    // --- Documents --------------------------------------------------------------------------------

    async uploadDocument(p: PortalContext, file: IncomingFile, fields: PortalUploadFields) {
        this.feature(p, 'documents');
        if (fields.project_id) {
            const project = await this.prisma.project.findFirst({ where: { id: fields.project_id, organization_id: p.organization_id, company_id: p.customer_id, visibility: 'CUSTOMER_VISIBLE', archived_at: null }, select: { id: true } });
            const access = await this.prisma.customerPortalMembershipProject.findMany({ where: { portal_membership_id: p.portal_membership_id }, select: { project_id: true } });
            if (!project || (access.length && !access.some((a) => a.project_id === project.id))) throw new NotFoundException({ message: 'Project not found', code: 'project_not_found' });
        }
        const folderId = await this.documents.customerUploadFolder(p.organization_id, p.customer_id);
        // The portal guard authorized portal.documents.upload; Files still validates size, type, quota and writes audit + events.
        const doc = await this.documents.upload(
            p.actor,
            file,
            { folder_id: folderId, company_id: p.customer_id, project_id: fields.project_id, title: fields.title, description: fields.description, customer_visible: true },
            { source: DocumentSource.UPLOAD, source_module: ModuleKey.CUSTOMER_PORTAL, authorized_by_module: true, uploaded_via_portal: true },
        );
        await this.audit.record(p.actor, 'portal.document.uploaded', { resource_type: 'document', resource_id: doc.id, metadata: { portal_membership_id: p.portal_membership_id, company_id: p.customer_id, project_id: fields.project_id ?? null, filename: file.originalname } });
        this.events.publish(p.actor, {
            event_key: 'portal.document.uploaded',
            module: ModuleKey.CUSTOMER_PORTAL,
            entity_type: 'DOCUMENT',
            entity_id: doc.id,
            payload: { company_id: p.customer_id, project_id: fields.project_id ?? null, title: doc.title },
            activity: { summary: `Client uploaded ${doc.title}`, entity_label: doc.title, company_id: p.customer_id, project_id: fields.project_id ?? null, customer_visible: true },
        });
        return { id: doc.id, title: doc.title, filename: file.originalname, size: file.size ?? file.buffer.length, created_at: new Date() };
    }

    /** Signed download link of a customer-visible document of the caller's company / visible projects. */
    async documentDownload(p: PortalContext, id: string) {
        this.feature(p, 'documents');
        const access = await this.prisma.customerPortalMembershipProject.findMany({ where: { portal_membership_id: p.portal_membership_id }, select: { project_id: true } });
        const projects = await this.prisma.project.findMany({
            where: { organization_id: p.organization_id, company_id: p.customer_id, visibility: 'CUSTOMER_VISIBLE', archived_at: null, ...(access.length && { id: { in: access.map((a) => a.project_id) } }) },
            select: { id: true },
        });
        const doc = await this.prisma.document.findFirst({
            where: { id, organization_id: p.organization_id, customer_visible: true, deleted_at: null, archived_at: null, OR: [{ company_id: p.customer_id }, { project_id: { in: projects.map((x) => x.id) } }] },
            select: { id: true },
        });
        if (!doc) throw new NotFoundException({ message: 'Document not found', code: 'document_not_found' });
        const url = await this.documents.issueRecordDownloadUrl(p.organization_id, doc.id, 'attachment');
        await this.audit.record(p.actor, 'portal.document.downloaded', { resource_type: 'document', resource_id: doc.id, metadata: { portal_membership_id: p.portal_membership_id } });
        return url;
    }

    // --- Proposals & contracts -------------------------------------------------------------------

    async proposalLink(p: PortalContext, proposalId: string) {
        this.feature(p, 'proposals');
        const user = await this.user(p);
        return this.proposals.portalLink({ organization_id: p.organization_id, company_id: p.customer_id, proposal_id: proposalId, user_id: p.user_id, email: user.email, ip: p.actor.ip_address ?? null });
    }

    async contractSigningLink(p: PortalContext, contractId: string) {
        this.feature(p, 'contracts');
        const user = await this.user(p);
        return this.signatures.portalSigningLink({ organization_id: p.organization_id, company_id: p.customer_id, contract_id: contractId, user_id: p.user_id, email: user.email, ip: p.actor.ip_address ?? null });
    }

    // --- Notification preferences (14) -----------------------------------------------------------

    async notificationPreferences(p: PortalContext) {
        const [settings, prefs, org] = await Promise.all([
            this.prisma.notificationRecipientSettings.findUnique({ where: { portal_membership_id: p.portal_membership_id } }),
            this.prisma.notificationPreference.findMany({ where: { organization_id: p.organization_id, portal_membership_id: p.portal_membership_id, module: { not: null }, channel: null } }),
            this.prisma.notificationOrgSettings.findUnique({ where: { organization_id: p.organization_id }, select: { enabled_channels: true } }),
        ]);
        return {
            email_enabled: settings?.email_enabled ?? true,
            in_app_enabled: settings?.in_app_enabled ?? true,
            digest_frequency: settings?.digest_frequency ?? NotificationDigestFrequency.IMMEDIATE,
            email_available: (org?.enabled_channels ?? ['IN_APP', 'EMAIL']).includes('EMAIL'),
            topics: PORTAL_NOTIFICATION_TOPICS.filter((t) => p.features[t.feature]).map((t) => ({
                module: t.module,
                label: t.label,
                description: t.description,
                enabled: prefs.find((x) => x.module === t.module)?.enabled ?? true,
            })),
        };
    }

    async updateNotificationPreferences(p: PortalContext, dto: PortalNotificationPreferences) {
        const { topics, ...channels } = dto;
        if (Object.keys(channels).length) {
            await this.prisma.notificationRecipientSettings.upsert({
                where: { portal_membership_id: p.portal_membership_id },
                update: channels,
                create: { ...channels, organization_id: p.organization_id, portal_membership_id: p.portal_membership_id, recipient_type: NotificationRecipientType.PORTAL_USER },
            });
        }
        const allowed = new Set(PORTAL_NOTIFICATION_TOPICS.map((t) => t.module));
        const recipient_key = `p:${p.portal_membership_id}`;
        for (const t of topics ?? []) {
            if (!allowed.has(t.module)) continue;
            const scope_key = `module:${t.module}`;
            // channel = null rows cannot use the compound unique (NULLs are distinct), so find + update (same as 14).
            const existing = await this.prisma.notificationPreference.findFirst({ where: { organization_id: p.organization_id, recipient_key, scope_key, channel: null }, select: { id: true } });
            if (existing) await this.prisma.notificationPreference.update({ where: { id: existing.id }, data: { enabled: t.enabled } });
            else {
                await this.prisma.notificationPreference.create({
                    data: { organization_id: p.organization_id, recipient_type: NotificationRecipientType.PORTAL_USER, portal_membership_id: p.portal_membership_id, recipient_key, module: t.module, scope_key, channel: null, enabled: t.enabled } as Prisma.NotificationPreferenceUncheckedCreateInput,
                });
            }
        }
        await this.audit.record(p.actor, 'notification.preferences_updated', { resource_type: 'notification_recipient_settings', resource_id: p.portal_membership_id, metadata: { after: dto, via: 'portal' } });
        return this.notificationPreferences(p);
    }
}
