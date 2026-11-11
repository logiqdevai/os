import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { FileSettingsService } from '../services/file-settings.service';
import { CreateCategoryDto, UpdateCategoryDto, UpdateDocumentSettingsDto } from '../dto/settings.dto';
import { BigIntInterceptor } from '../utils/serialize.utils';

/** Document settings and categories (17 §4, §5, §8, §9). */
@ApiTags('Files · Settings')
@ApiBearerAuth()
@Controller('files')
@UseGuards(JwtGuard, PermissionsGuard)
@UseInterceptors(BigIntInterceptor)
export class FileSettingsController {
    constructor(private readonly settings: FileSettingsService) { }

    @Get('settings')
    @RequirePermission('documents.documents.read')
    @ApiOperation({ summary: 'Organization document settings (limits, sharing policy)' })
    get(@CurrentOrg() ctx: OrgContext) {
        return this.settings.get(ctx.organization_id);
    }

    @Patch('settings')
    @RequirePermission('documents.storage.manage')
    @ApiOperation({ summary: 'Update document settings' })
    update(@CurrentOrg() ctx: OrgContext, @Body() dto: UpdateDocumentSettingsDto) {
        return this.settings.update(ctx, dto);
    }

    @Get('categories')
    @RequirePermission('documents.documents.read')
    @ApiOperation({ summary: 'Document categories (system categories are created on first use)' })
    categories(@CurrentOrg() ctx: OrgContext) {
        return this.settings.listCategories(ctx);
    }

    @Post('categories')
    @RequirePermission('documents.categories.manage')
    @ApiOperation({ summary: 'Create a category' })
    createCategory(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateCategoryDto) {
        return this.settings.createCategory(ctx, dto);
    }

    @Patch('categories/:id')
    @RequirePermission('documents.categories.manage')
    @ApiOperation({ summary: 'Update a category' })
    updateCategory(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
        return this.settings.updateCategory(ctx, id, dto);
    }

    @Post('categories/:id/archive')
    @RequirePermission('documents.categories.manage')
    @ApiOperation({ summary: 'Archive a category' })
    archiveCategory(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.settings.archiveCategory(ctx, id);
    }
}
