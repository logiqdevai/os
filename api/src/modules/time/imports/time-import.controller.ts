import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { BaseListQuery, BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';
import { TIME_IMPORT_FIELDS, TimeImportMappingSchema, TimeImportService, UploadTimeImportSchema } from './time-import.service';

const KEY = 'time.imports.manage';

@ApiTags('Time · Import')
@ApiBearerAuth()
@Controller('time/imports')
@UseGuards(JwtGuard, PermissionsGuard)
export class TimeImportController {
    constructor(private readonly imports: TimeImportService) { }

    @Get()
    @RequirePermission(KEY)
    list(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(BaseListQuerySchema)) query: BaseListQuery) {
        return this.imports.list(ctx, query);
    }

    @Get('fields')
    @RequirePermission(KEY)
    fields() {
        return TIME_IMPORT_FIELDS;
    }

    @Get(':id')
    @RequirePermission(KEY)
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.imports.findOne(ctx, id);
    }

    @Post()
    @RequirePermission(KEY, 'time.entries.create_own')
    @ApiOperation({ summary: 'Upload a CSV of time entries (columns + suggested mapping returned)' })
    upload(@CurrentOrg() ctx: OrgContext, @Body(new ZodValidationPipe(UploadTimeImportSchema)) dto: z.infer<typeof UploadTimeImportSchema>) {
        return this.imports.upload(ctx, dto);
    }

    @Put(':id/mapping')
    @RequirePermission(KEY, 'time.entries.create_own')
    @ApiOperation({ summary: 'Save the mapping and validate every row (dry run)' })
    preview(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(TimeImportMappingSchema)) dto: z.infer<typeof TimeImportMappingSchema>) {
        return this.imports.preview(ctx, id, dto.columns);
    }

    @Post(':id/run')
    @RequirePermission(KEY, 'time.entries.create_own')
    @ApiOperation({ summary: 'Import in the background (rows for other members need time.entries.create_team)' })
    run(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.imports.run(ctx, id);
    }
}
