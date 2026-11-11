import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireOrgMember, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { TagsService } from './tags.service';
import { CreateTagDto, MergeTagDto, SetTaggingsDto, TagQuery, TagQuerySchema, UpdateTagDto } from './dto/tag.dto';

@ApiTags('Platform · Tags')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtGuard, PermissionsGuard)
export class TagsController {
    constructor(private readonly tags: TagsService) { }

    @Get('tags')
    @RequireOrgMember()
    @ApiOperation({ summary: 'Organization tags (filter by entity type) with usage counts' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TagQuerySchema)) query: TagQuery) {
        return this.tags.findAll(ctx, query);
    }

    @Post('tags')
    @RequirePermission('platform.tags.manage')
    @ApiOperation({ summary: 'Create a tag' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateTagDto) {
        return this.tags.create(ctx, dto);
    }

    @Patch('tags/:id')
    @RequirePermission('platform.tags.manage')
    @ApiOperation({ summary: 'Rename / recolor a tag' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTagDto) {
        return this.tags.update(ctx, id, dto);
    }

    @Post('tags/:id/merge')
    @RequirePermission('platform.tags.manage')
    @ApiOperation({ summary: 'Merge a tag into another one' })
    merge(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MergeTagDto) {
        return this.tags.merge(ctx, id, dto.into_id);
    }

    @Delete('tags/:id')
    @RequirePermission('platform.tags.manage')
    @ApiOperation({ summary: 'Delete a tag (removed from every record)' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.tags.remove(ctx, id);
    }

    @Put('taggings')
    @RequireOrgMember()
    @ApiOperation({ summary: "Replace a record's tags (needs the record's update key, checked by the service)" })
    set(@CurrentOrg() ctx: OrgContext, @Body() dto: SetTaggingsDto) {
        return this.tags.setTaggings(ctx, dto);
    }
}
