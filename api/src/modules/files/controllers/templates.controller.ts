import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { FileTemplatesService } from '../services/file-templates.service';
import {
    ApplyFolderTemplateInput, ApplyFolderTemplateSchema, CreateDocumentTemplateInput, CreateDocumentTemplateSchema, CreateFolderTemplateInput, CreateFolderTemplateSchema,
    GenerateDocumentInput, GenerateDocumentSchema, TemplateQuery, TemplateQuerySchema, UpdateDocumentTemplateInput, UpdateDocumentTemplateSchema, UpdateFolderTemplateInput,
    UpdateFolderTemplateSchema,
} from '../dto/templates.dto';

/** 17 §4, §7 — folder templates (documents.folders.manage) and document templates (documents.templates.*). */
@ApiTags('Files · Templates')
@ApiBearerAuth()
@Controller('files')
@UseGuards(JwtGuard, PermissionsGuard)
export class FileTemplatesController {
    constructor(private readonly templates: FileTemplatesService) { }

    @Get('folder-templates')
    @RequirePermission('documents.documents.read')
    @ApiOperation({ summary: 'Folder templates (reusable folder trees)' })
    listFolderTemplates(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TemplateQuerySchema)) query: TemplateQuery) {
        return this.templates.listFolderTemplates(ctx, query);
    }

    @Post('folder-templates')
    @RequirePermission('documents.folders.manage')
    createFolderTemplate(@CurrentOrg() ctx: OrgContext, @Body(new ZodValidationPipe(CreateFolderTemplateSchema)) dto: CreateFolderTemplateInput) {
        return this.templates.createFolderTemplate(ctx, dto);
    }

    @Get('folder-templates/:id')
    @RequirePermission('documents.documents.read')
    getFolderTemplate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.templates.getFolderTemplate(ctx, id);
    }

    @Patch('folder-templates/:id')
    @RequirePermission('documents.folders.manage')
    updateFolderTemplate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(UpdateFolderTemplateSchema)) dto: UpdateFolderTemplateInput) {
        return this.templates.updateFolderTemplate(ctx, id, dto);
    }

    @Post('folder-templates/:id/archive')
    @RequirePermission('documents.folders.manage')
    archiveFolderTemplate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.templates.setFolderTemplateArchived(ctx, id, true);
    }

    @Post('folder-templates/:id/restore')
    @RequirePermission('documents.folders.manage')
    restoreFolderTemplate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.templates.setFolderTemplateArchived(ctx, id, false);
    }

    @Post('folder-templates/:id/apply')
    @RequirePermission('documents.folders.manage')
    @ApiOperation({ summary: 'Create the template folder tree under a folder (optionally inside a new root folder)' })
    applyFolderTemplate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(ApplyFolderTemplateSchema)) dto: ApplyFolderTemplateInput) {
        return this.templates.applyFolderTemplate(ctx, id, dto);
    }

    @Get('document-templates')
    @RequirePermission('documents.templates.read')
    @ApiOperation({ summary: 'Document templates (text bodies with {{placeholders}})' })
    listDocumentTemplates(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TemplateQuerySchema)) query: TemplateQuery) {
        return this.templates.listDocumentTemplates(ctx, query);
    }

    @Post('document-templates')
    @RequirePermission('documents.templates.manage')
    @ApiOperation({ summary: 'Turn a text document into a template (placeholders are detected when variables are omitted)' })
    createDocumentTemplate(@CurrentOrg() ctx: OrgContext, @Body(new ZodValidationPipe(CreateDocumentTemplateSchema)) dto: CreateDocumentTemplateInput) {
        return this.templates.createDocumentTemplate(ctx, dto);
    }

    @Get('document-templates/:id')
    @RequirePermission('documents.templates.read')
    @ApiOperation({ summary: 'Template with its variables and a preview of the body' })
    getDocumentTemplate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.templates.getDocumentTemplate(ctx, id);
    }

    @Patch('document-templates/:id')
    @RequirePermission('documents.templates.manage')
    updateDocumentTemplate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(UpdateDocumentTemplateSchema)) dto: UpdateDocumentTemplateInput) {
        return this.templates.updateDocumentTemplate(ctx, id, dto);
    }

    @Post('document-templates/:id/archive')
    @RequirePermission('documents.templates.manage')
    archiveDocumentTemplate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.templates.setDocumentTemplateArchived(ctx, id, true);
    }

    @Post('document-templates/:id/restore')
    @RequirePermission('documents.templates.manage')
    restoreDocumentTemplate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.templates.setDocumentTemplateArchived(ctx, id, false);
    }

    @Post('document-templates/:id/generate')
    @RequirePermission('documents.templates.read', 'documents.documents.create')
    @ApiOperation({ summary: 'Generate a new document from the template with the given values' })
    generate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(GenerateDocumentSchema)) dto: GenerateDocumentInput) {
        return this.templates.generate(ctx, id, dto);
    }
}
