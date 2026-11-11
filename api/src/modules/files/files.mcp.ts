import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { DocumentsService } from './services/documents.service';
import { FoldersService } from './services/folders.service';
import { SharesService } from './services/shares.service';
import { ApprovalsService } from './services/approvals.service';
import { VaultService } from './services/vault.service';
import { DocumentQuerySchema, UpdateDocumentSchema } from './dto/documents.dto';
import { CreateFolderSchema, FolderTreeQuerySchema } from './dto/folders.dto';
import { CreateShareSchema, ShareQuerySchema } from './dto/shares.dto';
import { ApprovalDecisionSchema, ApprovalQuerySchema, CreateApprovalSchema } from './dto/approvals.dto';
import { CreateVaultEntrySchema, VaultQuerySchema } from './dto/vault.dto';
import { plain } from './utils/serialize.utils';

const M = ModuleKey.DOCUMENTS;
const id = z.object({ id: z.string().uuid() });

/** MCP adapter for module 17 — one tool per agent-useful action, same services as REST. */
@Injectable()
export class FilesMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly documents: DocumentsService,
        private readonly folders: FoldersService,
        private readonly shares: SharesService,
        private readonly approvals: ApprovalsService,
        private readonly vault: VaultService,
    ) { }

    onModuleInit() {
        const out = <T>(p: Promise<T>) => p.then((v) => plain(v));
        this.registry.registerMany([
            // Documents
            { name: 'documents_documents_list', description: 'List or search documents (folder_id, type, category_id, status, search, project_id, company_id, entity_type+entity_id for record attachments).', permission: 'documents.documents.read', module: M, resource_type: 'document', input: DocumentQuerySchema, handler: (ctx, a) => out(this.documents.findAll(ctx, a)) },
            { name: 'documents_documents_get', description: 'Get one document with its current version, folder path and legal hold state.', permission: 'documents.documents.read', module: M, resource_type: 'document', input: id, handler: (ctx, a) => out(this.documents.findOne(ctx, a.id)) },
            { name: 'documents_versions_list', description: 'Version history of a document.', permission: 'documents.documents.read', module: M, resource_type: 'document', input: id, handler: (ctx, a) => out(this.documents.listVersions(ctx, a.id)) },
            { name: 'documents_documents_download_url', description: 'Short-lived signed download URL path for a document (append to the API base URL).', permission: 'documents.documents.read', module: M, resource_type: 'document', input: id.extend({ version_id: z.string().uuid().optional() }), handler: (ctx, a) => out(this.documents.issueDownloadUrl(ctx, a.id, { version_id: a.version_id })) },
            { name: 'documents_documents_update', description: 'Update title, description, category, keywords, visibility or owner of a document.', permission: 'documents.documents.update', module: M, resource_type: 'document', input: UpdateDocumentSchema.extend({ id: z.string().uuid() }), handler: (ctx, { id: docId, ...dto }) => out(this.documents.update(ctx, docId, dto)) },
            { name: 'documents_documents_move', description: 'Move a document to another folder (folder_id null = root).', permission: 'documents.documents.update', module: M, resource_type: 'document', input: id.extend({ folder_id: z.string().uuid().nullable() }), handler: (ctx, a) => out(this.documents.move(ctx, a.id, a.folder_id)) },
            { name: 'documents_documents_archive', description: 'Archive a document.', permission: 'documents.documents.archive', module: M, resource_type: 'document', input: id, handler: (ctx, a) => out(this.documents.archive(ctx, a.id)) },
            { name: 'documents_documents_delete', description: 'Move a document to the trash (recoverable).', permission: 'documents.documents.delete', module: M, resource_type: 'document', sensitive: true, input: id, handler: (ctx, a) => out(this.documents.softDelete(ctx, a.id)) },
            { name: 'documents_documents_restore', description: 'Restore a document from the trash.', permission: 'documents.documents.restore', module: M, resource_type: 'document', input: id, handler: (ctx, a) => out(this.documents.restore(ctx, a.id)) },
            { name: 'documents_storage_usage', description: 'Storage usage of the organization by type and category, with the quota.', permission: 'documents.storage.manage', module: M, resource_type: 'document', input: z.object({}), handler: (ctx) => out(this.documents.storageUsage(ctx)) },
            // Folders
            { name: 'documents_folders_list', description: 'List all visible folders (flat, with parent ids and document counts).', permission: 'documents.documents.read', module: M, resource_type: 'folder', input: FolderTreeQuerySchema, handler: (ctx, a) => out(this.folders.tree(ctx, a)) },
            { name: 'documents_folders_create', description: 'Create a folder (optionally under parent_folder_id).', permission: 'documents.folders.manage', module: M, resource_type: 'folder', input: CreateFolderSchema, handler: (ctx, a) => out(this.folders.create(ctx, a)) },
            // Shares
            { name: 'documents_shares_list', description: 'List shares of documents and folders.', permission: 'documents.documents.share', module: M, resource_type: 'document_share', input: ShareQuerySchema, handler: (ctx, a) => out(this.shares.findAll(ctx, a)) },
            { name: 'documents_documents_share', description: 'Share a document or folder with a member, team, external email or public link (returns the link once).', permission: 'documents.documents.share', module: M, resource_type: 'document_share', sensitive: true, input: CreateShareSchema, handler: (ctx, a) => out(this.shares.create(ctx, a)) },
            { name: 'documents_shares_revoke', description: 'Revoke a share.', permission: 'documents.documents.share', module: M, resource_type: 'document_share', sensitive: true, input: id, handler: (ctx, a) => out(this.shares.revoke(ctx, a.id)) },
            // Approvals
            { name: 'documents_approvals_list', description: 'List document approvals (mine=true: waiting for my decision).', permission: 'documents.documents.read', module: M, resource_type: 'document_approval', input: ApprovalQuerySchema, handler: (ctx, a) => out(this.approvals.findAll(ctx, a)) },
            { name: 'documents_approvals_request', description: 'Request approval of a document version from members.', permission: 'documents.documents.approve', module: M, resource_type: 'document_approval', input: CreateApprovalSchema, handler: (ctx, a) => out(this.approvals.create(ctx, a)) },
            { name: 'documents_approvals_decide', description: 'Approve, reject or request changes on an approval where the caller is an approver.', permission: 'documents.documents.approve', module: M, resource_type: 'document_approval', sensitive: true, input: ApprovalDecisionSchema, handler: (ctx, { id: approvalId, ...dto }) => out(this.approvals.decide(ctx, approvalId, dto)) },
            // Vault (metadata only; reveal is sensitive and never meant to be passed to a model by default)
            { name: 'documents_vault_list', description: 'List vault credentials (metadata only, never secrets).', permission: 'documents.vault.read', module: M, resource_type: 'vault_entry', input: VaultQuerySchema, handler: (ctx, a) => out(this.vault.findAll(ctx, a)) },
            { name: 'documents_vault_get', description: 'Get a vault credential (metadata and grants, no secret).', permission: 'documents.vault.read', module: M, resource_type: 'vault_entry', input: id, handler: (ctx, a) => out(this.vault.findOne(ctx, a.id)) },
            { name: 'documents_vault_create', description: 'Store a new credential; the secret is encrypted and never returned.', permission: 'documents.vault.manage', module: M, resource_type: 'vault_entry', sensitive: true, input: CreateVaultEntrySchema, handler: (ctx, a) => out(this.vault.create(ctx, a)) },
            { name: 'documents_vault_reveal', description: 'Reveal a credential secret. Sensitive: requires human confirmation; logged and audited.', permission: 'documents.vault.reveal', module: M, resource_type: 'vault_entry', sensitive: true, input: id.extend({ reason: z.string().max(500).optional() }), handler: (ctx, a) => out(this.vault.reveal(ctx, a.id, a.reason)) },
        ]);
    }
}
