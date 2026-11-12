import { Body, Controller, Get, Post, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { DocsTransferService } from '../services/docs-transfer.service';
import { ExportDocsInput, ExportDocsSchema, ImportDocsInput, ImportDocsSchema } from '../dto/ai-transfer.dto';

const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

/** 15 §2, §10 — Markdown import (a .md or a .zip of them) and export (zip of .md files with front matter). */
@ApiTags('Docs · Import & export')
@ApiBearerAuth()
@Controller('docs')
@UseGuards(JwtGuard, PermissionsGuard)
export class DocsTransferController {
    constructor(private readonly transfer: DocsTransferService) { }

    @Get('export')
    @RequirePermission('docs.pages.export')
    @ApiOperation({ summary: 'Download a ZIP of Markdown files: one page, a page and its sub-pages, or a space (readable pages only)' })
    async export(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ExportDocsSchema)) query: ExportDocsInput): Promise<StreamableFile> {
        const out = await this.transfer.export(ctx, query);
        return new StreamableFile(out.buffer, { type: 'application/zip', length: out.buffer.length, disposition: `attachment; filename="${out.filename}"` });
    }

    @Post('import')
    @RequirePermission('docs.pages.import', 'docs.pages.create')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMPORT_BYTES, files: 1 } }))
    @ApiConsumes('multipart/form-data')
    @ApiBody({ schema: { type: 'object', required: ['file', 'space_id'], properties: { file: { type: 'string', format: 'binary' }, space_id: { type: 'string' }, parent_page_id: { type: 'string' }, publish: { type: 'boolean' } } } })
    @ApiOperation({ summary: 'Import Markdown pages (.md or .zip); folders become parent pages' })
    import(@CurrentOrg() ctx: OrgContext, @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined, @Body(new ZodValidationPipe(ImportDocsSchema)) dto: ImportDocsInput) {
        if (file?.originalname) file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
        return this.transfer.import(ctx, file, dto);
    }

    @Get('transfers')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Recent import / export jobs (own, or all with docs.spaces.manage)' })
    jobs(@CurrentOrg() ctx: OrgContext) {
        return this.transfer.jobs(ctx);
    }
}
