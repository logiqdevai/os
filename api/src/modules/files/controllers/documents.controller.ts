import type { IncomingFile } from '../services/documents.service';
import {
    Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { DocumentsService } from '../services/documents.service';
import { BulkDocumentsDto, DocumentQuery, DocumentQuerySchema, LegalHoldDto, MoveDocumentDto, RestoreVersionDto, UpdateDocumentDto, UploadFields, UploadFieldsSchema } from '../dto/documents.dto';
import { MAX_UPLOAD_BYTES } from '../utils/file-policy.utils';
import { BigIntInterceptor } from '../utils/serialize.utils';
import { streamable } from '../utils/streamable.utils';

const VersionQuerySchema = z.object({ version_id: z.string().uuid().optional(), disposition: z.enum(['inline', 'attachment']).optional() });
type VersionQuery = z.infer<typeof VersionQuerySchema>;

/** Documents, versions, upload and download (17 §2–8). Routing only. */
@ApiTags('Files · Documents')
@ApiBearerAuth()
@Controller('files')
@UseGuards(JwtGuard, PermissionsGuard)
@UseInterceptors(BigIntInterceptor)
export class DocumentsController {
    constructor(private readonly documents: DocumentsService) { }

    @Post('upload')
    @RequireAnyPermission('documents.documents.create', 'documents.documents.update')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
    @ApiConsumes('multipart/form-data')
    @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' }, folder_id: { type: 'string' }, document_id: { type: 'string', description: 'Upload a new version of this document' }, title: { type: 'string' }, category_id: { type: 'string' }, entity_type: { type: 'string' }, entity_id: { type: 'string' }, change_note: { type: 'string' } } } })
    @ApiOperation({ summary: 'Upload a file as a new document (or a new version with document_id). Multipart field "file".' })
    upload(@CurrentOrg() ctx: OrgContext, @UploadedFile() file: IncomingFile, @Body(new ZodValidationPipe(UploadFieldsSchema)) fields: UploadFields) {
        // Multer decodes header values as latin1; restore UTF-8 file names.
        if (file?.originalname) file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
        return this.documents.upload(ctx, file, fields);
    }

    @Get('documents')
    @RequirePermission('documents.documents.read')
    @ApiOperation({ summary: 'List documents (folder, type, category, status incl. DELETED = trash, record attachments)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(DocumentQuerySchema)) query: DocumentQuery) {
        return this.documents.findAll(ctx, query);
    }

    @Get('recent')
    @RequirePermission('documents.documents.read')
    @ApiOperation({ summary: 'Documents I opened recently' })
    recent(@CurrentOrg() ctx: OrgContext) {
        return this.documents.listRecent(ctx);
    }

    @Get('favorites')
    @RequirePermission('documents.documents.read')
    @ApiOperation({ summary: 'My favorite documents and folders' })
    favorites(@CurrentOrg() ctx: OrgContext) {
        return this.documents.listFavorites(ctx);
    }

    @Get('storage-usage')
    @RequirePermission('documents.storage.manage')
    @ApiOperation({ summary: 'Storage usage by type and category, largest files and quota' })
    storageUsage(@CurrentOrg() ctx: OrgContext) {
        return this.documents.storageUsage(ctx);
    }

    @Post('documents/bulk')
    @RequirePermission('documents.documents.read')
    @ApiOperation({ summary: 'Bulk archive / delete / restore / move (each item checks its own permission)' })
    bulk(@CurrentOrg() ctx: OrgContext, @Body() dto: BulkDocumentsDto) {
        return this.documents.bulk(ctx, dto);
    }

    @Get('documents/:id')
    @RequirePermission('documents.documents.read')
    @ApiOperation({ summary: 'Get a document (bumps "recent")' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.documents.findOne(ctx, id);
    }

    @Patch('documents/:id')
    @RequirePermission('documents.documents.update')
    @ApiOperation({ summary: 'Update title, description, category, visibility, keywords, owner' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDocumentDto) {
        return this.documents.update(ctx, id, dto);
    }

    @Post('documents/:id/move')
    @RequirePermission('documents.documents.update')
    @ApiOperation({ summary: 'Move to another folder (null = root); the id never changes' })
    move(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveDocumentDto) {
        return this.documents.move(ctx, id, dto.folder_id ?? null);
    }

    @Post('documents/:id/archive')
    @RequirePermission('documents.documents.archive')
    @ApiOperation({ summary: 'Archive a document' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.documents.archive(ctx, id);
    }

    @Post('documents/:id/unarchive')
    @RequirePermission('documents.documents.archive')
    @ApiOperation({ summary: 'Unarchive a document' })
    unarchive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.documents.unarchive(ctx, id);
    }

    @Delete('documents/:id')
    @RequirePermission('documents.documents.delete')
    @ApiOperation({ summary: 'Move to trash (soft delete with recovery window; legal hold blocks)' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.documents.softDelete(ctx, id);
    }

    @Post('documents/:id/restore')
    @RequirePermission('documents.documents.restore')
    @ApiOperation({ summary: 'Restore from trash' })
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.documents.restore(ctx, id);
    }

    @Get('documents/:id/versions')
    @RequirePermission('documents.documents.read')
    @ApiOperation({ summary: 'Version history' })
    versions(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.documents.listVersions(ctx, id);
    }

    @Post('documents/:id/versions/:versionId/restore')
    @RequirePermission('documents.documents.update')
    @ApiOperation({ summary: 'Restore an older version as a new version' })
    restoreVersion(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('versionId', ParseUUIDPipe) versionId: string, @Body() dto: RestoreVersionDto) {
        return this.documents.restoreVersion(ctx, id, versionId, dto.change_note);
    }

    @Get('documents/:id/download-url')
    @RequirePermission('documents.documents.read')
    @ApiOperation({ summary: 'Short-lived signed URL path for a download or inline view (use in <a href> / <img src>)' })
    downloadUrl(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(VersionQuerySchema)) query: VersionQuery) {
        return this.documents.issueDownloadUrl(ctx, id, query);
    }

    @Get('documents/:id/download')
    @RequirePermission('documents.documents.read')
    @ApiOperation({ summary: 'Stream the file (API clients with a bearer token or API key)' })
    async download(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(VersionQuerySchema)) query: VersionQuery): Promise<StreamableFile> {
        return streamable(await this.documents.streamForCaller(ctx, id, query.version_id));
    }

    @Get('documents/:id/preview')
    @RequirePermission('documents.documents.read')
    @ApiOperation({ summary: 'Preview metadata with a signed inline URL (or UNSUPPORTED)' })
    preview(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(VersionQuerySchema)) query: VersionQuery) {
        return this.documents.preview(ctx, id, query.version_id);
    }

    @Post('documents/:id/favorite')
    @RequirePermission('documents.documents.read')
    @ApiOperation({ summary: 'Add to my favorites' })
    favorite(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.documents.favorite(ctx, id, true);
    }

    @Delete('documents/:id/favorite')
    @RequirePermission('documents.documents.read')
    @ApiOperation({ summary: 'Remove from my favorites' })
    unfavorite(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.documents.favorite(ctx, id, false);
    }

    @Post('documents/:id/legal-hold')
    @RequirePermission('documents.legal_hold.manage')
    @ApiOperation({ summary: 'Place a legal hold (blocks deletion)' })
    setHold(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LegalHoldDto) {
        return this.documents.setLegalHold(ctx, id, dto.reason);
    }

    @Delete('documents/:id/legal-hold')
    @RequirePermission('documents.legal_hold.manage')
    @ApiOperation({ summary: 'Release the legal hold' })
    releaseHold(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.documents.releaseLegalHold(ctx, id);
    }
}
