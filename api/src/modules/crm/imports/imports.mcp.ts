import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { CrmImportsService } from './imports.service';
import { ImportMappingSchema, ImportQuerySchema } from './dto/import.dto';

/**
 * MCP tools for CSV imports. The file itself is uploaded over REST (`POST /crm/imports`, multipart); agents can then
 * inspect, map, preview and start the job. Starting and rolling back are sensitive (human confirmation for AI callers).
 */
@Injectable()
export class CrmImportsMcp implements OnModuleInit {
    constructor(private readonly registry: McpRegistry, private readonly imports: CrmImportsService) { }

    onModuleInit() {
        const base = { module: ModuleKey.CRM, resource_type: 'crm_import_job', permission: 'crm.records.import' };
        const id = z.object({ id: z.string().uuid() });
        this.registry.registerMany([
            { ...base, name: 'crm_records_import_list', description: 'CSV import history (status, counts).', input: ImportQuerySchema, handler: (ctx, args) => this.imports.findAll(ctx, args) },
            { ...base, name: 'crm_records_import_get', description: 'One import job: status, progress counts, headers/sample rows and target fields while it is being set up.', input: id, handler: (ctx, args) => this.imports.findOne(ctx, args.id) },
            {
                ...base, name: 'crm_records_import_map',
                description: 'Set the column mapping { "CSV header": "field key" | "cf:<custom key>" } and duplicate strategy { mode: skip|update|create, match_key }.',
                input: ImportMappingSchema.extend({ id: z.string().uuid() }),
                handler: (ctx, { id: jobId, ...dto }) => this.imports.setMapping(ctx, jobId, dto),
            },
            { ...base, name: 'crm_records_import_preview', description: 'Validate every row without writing: counts of create / update / skip / error and the first rows with messages.', input: id, handler: (ctx, args) => this.imports.preview(ctx, args.id) },
            { ...base, name: 'crm_records_import_start', sensitive: true, description: 'Start a previewed import in the background.', input: id, handler: (ctx, args) => this.imports.start(ctx, args.id) },
            { ...base, name: 'crm_records_import_rollback', sensitive: true, description: 'Delete the records a finished import created (updates are not undone).', input: id, handler: (ctx, args) => this.imports.rollback(ctx, args.id) },
        ]);
    }
}
