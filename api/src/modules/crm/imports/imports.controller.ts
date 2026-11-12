import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ZBody } from '@/modules/finance-shared/zod-body.pipe';
import { sendCsv } from '../common/send-csv';
import { CrmImportsService } from './imports.service';
import { ImportEntitySchema, ImportFieldsQuerySchema, ImportMappingInput, ImportMappingSchema, ImportQuery, ImportQuerySchema } from './dto/import.dto';

const KEY = 'crm.records.import';
const UploadBodySchema = z.object({ entity_type: ImportEntitySchema });

/**
 * 02 §22 — CSV import wizard (mockup `imports`). Every endpoint needs `crm.records.import` (sensitive); the service
 * also requires the record type's create key (and update key when matching rows are updated).
 */
@ApiTags('CRM · Import')
@ApiBearerAuth()
@Controller('crm/imports')
@UseGuards(JwtGuard, PermissionsGuard)
export class CrmImportsController {
    constructor(private readonly imports: CrmImportsService) { }

    @Get()
    @RequirePermission(KEY)
    @ApiOperation({ summary: 'Import history' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ImportQuerySchema)) query: ImportQuery) {
        return this.imports.findAll(ctx, query);
    }

    @Get('fields')
    @RequirePermission(KEY)
    @ApiOperation({ summary: 'Target fields (incl. custom fields) and match keys for a record type' })
    fields(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ImportFieldsQuerySchema)) q: { entity_type: z.infer<typeof ImportEntitySchema> }) {
        return this.imports.fields(ctx, q.entity_type);
    }

    @Get('mappings')
    @RequirePermission(KEY)
    @ApiOperation({ summary: 'Saved column mappings for a record type' })
    mappings(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ImportFieldsQuerySchema)) q: { entity_type: z.infer<typeof ImportEntitySchema> }) {
        return this.imports.savedMappings(ctx, q.entity_type);
    }

    @Delete('mappings/:id')
    @RequirePermission(KEY)
    @ApiOperation({ summary: 'Delete a saved mapping' })
    deleteMapping(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.imports.deleteMapping(ctx, id);
    }

    @Post()
    @RequirePermission(KEY)
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
    @ApiConsumes('multipart/form-data')
    @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, entity_type: { type: 'string', enum: ['CRM_COMPANY', 'CRM_CONTACT', 'CRM_LEAD', 'CRM_DEAL'] } } } })
    @ApiOperation({ summary: 'Upload a CSV (≤ 5 MB, ≤ 10 000 rows) → import job with headers, sample rows and a suggested mapping' })
    upload(@CurrentOrg() ctx: OrgContext, @UploadedFile() file: { buffer: Buffer; originalname: string; size: number } | undefined, @Body(ZBody(UploadBodySchema)) body: z.infer<typeof UploadBodySchema>) {
        if (file?.originalname) file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
        return this.imports.upload(ctx, body.entity_type, file);
    }

    @Get(':id')
    @RequirePermission(KEY)
    @ApiOperation({ summary: 'Import job with progress (poll while IMPORTING)' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.imports.findOne(ctx, id);
    }

    @Put(':id/mapping')
    @RequirePermission(KEY)
    @ApiOperation({ summary: 'Set the column mapping and duplicate strategy (optionally save the mapping)' })
    setMapping(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(ImportMappingSchema)) dto: ImportMappingInput) {
        return this.imports.setMapping(ctx, id, dto);
    }

    @Post(':id/preview')
    @RequirePermission(KEY)
    @ApiOperation({ summary: 'Validate every row without writing (create / update / skip / error per row)' })
    preview(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.imports.preview(ctx, id);
    }

    @Post(':id/start')
    @RequirePermission(KEY)
    @ApiOperation({ summary: 'Run the import in the background (sensitive, audited)' })
    start(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.imports.start(ctx, id);
    }

    @Get(':id/errors.csv')
    @RequirePermission(KEY)
    @ApiOperation({ summary: 'Rows that failed, as CSV' })
    async errors(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
        sendCsv(res, await this.imports.errorsCsv(ctx, id));
    }

    @Post(':id/rollback')
    @RequirePermission(KEY)
    @ApiOperation({ summary: 'Delete the records this import created (updates are not undone)' })
    rollback(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.imports.rollback(ctx, id);
    }
}
