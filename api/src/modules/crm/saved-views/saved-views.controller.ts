import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireOrgMember } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { CreateSavedViewDto, SavedViewQuery, SavedViewQuerySchema, SavedViewsService, UpdateSavedViewDto } from './saved-views.service';

/**
 * Personal views are self-service (any member); shared views need platform.saved_views.manage_shared (checked
 * in the service). A view only stores filters: the list endpoints still apply the caller's permissions and scope.
 */
@ApiTags('Platform · Saved views')
@ApiBearerAuth()
@Controller('saved-views')
@UseGuards(JwtGuard, PermissionsGuard)
export class SavedViewsController {
    constructor(private readonly views: SavedViewsService) { }

    @Get()
    @RequireOrgMember()
    @ApiOperation({ summary: 'My personal, team and organization views for an entity type' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(SavedViewQuerySchema)) query: SavedViewQuery) {
        return this.views.findAll(ctx, query);
    }

    @Post()
    @RequireOrgMember()
    @ApiOperation({ summary: 'Save a view' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateSavedViewDto) {
        return this.views.create(ctx, dto);
    }

    @Patch(':id')
    @RequireOrgMember()
    @ApiOperation({ summary: 'Update a view' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSavedViewDto) {
        return this.views.update(ctx, id, dto);
    }

    @Delete(':id')
    @RequireOrgMember()
    @ApiOperation({ summary: 'Delete a view' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.views.remove(ctx, id);
    }
}
