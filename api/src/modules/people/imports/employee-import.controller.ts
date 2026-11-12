import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { z } from 'zod';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { BaseListQuery, BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';
import { P } from '../common/people.utils';
import { EmployeeImportService } from './employee-import.service';

export class UploadEmployeeImportDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) file_name?: string;
    @ApiProperty({ description: 'CSV text (UTF-8, comma, semicolon or tab separated; header row first). Max 5 MB.' }) @IsString() @MinLength(1) @MaxLength(5_300_000) csv: string;
}

export class EmployeeImportMappingDto {
    @ApiProperty({ description: '{ "<CSV header>": "<field>" } — fields from GET /people/imports/fields' }) @IsObject() columns: Record<string, string>;
    @ApiPropertyOptional({ description: 'Update employees that already exist (matched by email or employee number); otherwise they are skipped' }) @IsOptional() @IsBoolean() update_existing?: boolean;
}

export const EmployeeImportMappingSchema = z.object({ id: z.string().uuid(), columns: z.record(z.string(), z.string()), update_existing: z.boolean().optional() });

const uuid = new ParseUUIDPipe();

@ApiTags('People · Import')
@ApiBearerAuth()
@Controller('people/imports')
@UseGuards(JwtGuard, PermissionsGuard)
export class EmployeeImportController {
    constructor(private readonly imports: EmployeeImportService) { }

    @Get()
    @RequirePermission(P.import)
    list(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(BaseListQuerySchema)) query: BaseListQuery) {
        return this.imports.list(ctx, query);
    }

    @Get('fields')
    @RequirePermission(P.import)
    fields() {
        return this.imports.fields();
    }

    @Get(':id')
    @RequirePermission(P.import)
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.imports.findOne(ctx, id);
    }

    @Post()
    @RequirePermission(P.import, P.create)
    @ApiOperation({ summary: 'Upload a CSV: returns the columns, a sample and a suggested mapping' })
    upload(@CurrentOrg() ctx: OrgContext, @Body() dto: UploadEmployeeImportDto) {
        return this.imports.upload(ctx, dto);
    }

    @Put(':id/mapping')
    @RequirePermission(P.import, P.create)
    @ApiOperation({ summary: 'Save the mapping and validate every row (dry run, nothing is written)' })
    preview(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: EmployeeImportMappingDto) {
        return this.imports.preview(ctx, id, dto);
    }

    @Post(':id/run')
    @RequirePermission(P.import, P.create)
    @ApiOperation({ summary: 'Run the import in the background (sensitive, audited); poll GET /people/imports/:id' })
    run(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.imports.run(ctx, id);
    }
}
