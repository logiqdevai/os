import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WikiPermissionLevel } from 'generated/prisma';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { DocsSpacesService } from '../services/spaces.service';
import { DocsPagesService } from '../services/pages.service';
import { CreateSpaceDto, SpaceQuery, SpaceQuerySchema, UpdateSpaceDto } from '../dto/space.dto';

class SpaceMemberLevelDto {
    @ApiProperty({ enum: WikiPermissionLevel })
    @IsEnum(WikiPermissionLevel)
    level: WikiPermissionLevel;
}

@ApiTags('Docs · Spaces')
@ApiBearerAuth()
@Controller('docs/spaces')
@UseGuards(JwtGuard, PermissionsGuard)
export class DocsSpacesController {
    constructor(
        private readonly spaces: DocsSpacesService,
        private readonly pages: DocsPagesService,
    ) { }

    @Get()
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'List spaces the caller can read' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(SpaceQuerySchema)) query: SpaceQuery) {
        return this.spaces.findAll(ctx, query);
    }

    @Get('directory')
    @RequireAnyPermission('docs.spaces.manage', 'docs.pages.update', 'docs.checklists.manage', 'docs.forms.assign')
    @ApiOperation({ summary: 'People, teams and branches for docs pickers' })
    directory(@CurrentOrg() ctx: OrgContext, @Query('search') search?: string) {
        return this.spaces.directory(ctx, search);
    }

    @Get(':id')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Get a space by id or slug, with members and the caller level' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id') id: string) {
        return this.spaces.findOne(ctx, id);
    }

    @Get(':id/tree')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Page tree of a space (flat list with parent ids)' })
    tree(@CurrentOrg() ctx: OrgContext, @Param('id') id: string) {
        return this.pages.tree(ctx, id);
    }

    @Post()
    @RequirePermission('docs.spaces.manage')
    @ApiOperation({ summary: 'Create a space' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateSpaceDto) {
        return this.spaces.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('docs.spaces.manage')
    @ApiOperation({ summary: 'Update space settings' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSpaceDto) {
        return this.spaces.update(ctx, id, dto);
    }

    @Post(':id/archive')
    @RequirePermission('docs.spaces.manage')
    @ApiOperation({ summary: 'Archive a space' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.spaces.setArchived(ctx, id, true);
    }

    @Post(':id/unarchive')
    @RequirePermission('docs.spaces.manage')
    @ApiOperation({ summary: 'Unarchive a space' })
    unarchive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.spaces.setArchived(ctx, id, false);
    }

    @Delete(':id')
    @RequirePermission('docs.spaces.manage', 'docs.pages.delete')
    @ApiOperation({ summary: 'Move a space and its pages to trash (sensitive)' })
    trash(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.spaces.trash(ctx, id);
    }

    @Post(':id/restore')
    @RequirePermission('docs.spaces.manage')
    @ApiOperation({ summary: 'Restore a space from trash' })
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.spaces.restore(ctx, id);
    }

    @Get(':id/members')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'List space members' })
    members(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.spaces.listMembers(ctx, id);
    }

    @Put(':id/members/:membershipId')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Add a member or change their level (needs MANAGE on the space)' })
    setMember(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('membershipId', ParseUUIDPipe) membershipId: string, @Body() dto: SpaceMemberLevelDto) {
        return this.spaces.upsertMember(ctx, id, membershipId, dto.level);
    }

    @Delete(':id/members/:membershipId')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Remove a member from the space (needs MANAGE on the space)' })
    removeMember(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('membershipId', ParseUUIDPipe) membershipId: string) {
        return this.spaces.removeMember(ctx, id, membershipId);
    }
}
