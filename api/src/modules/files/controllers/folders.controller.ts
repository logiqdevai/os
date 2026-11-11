import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { FoldersService } from '../services/folders.service';
import { CreateFolderDto, FolderTreeQuery, FolderTreeQuerySchema, MoveFolderDto, UpdateFolderDto } from '../dto/folders.dto';
import { LegalHoldDto } from '../dto/documents.dto';
import { BigIntInterceptor } from '../utils/serialize.utils';

/** Folder hierarchy (17 §7). */
@ApiTags('Files · Folders')
@ApiBearerAuth()
@Controller('files/folders')
@UseGuards(JwtGuard, PermissionsGuard)
@UseInterceptors(BigIntInterceptor)
export class FoldersController {
    constructor(private readonly folders: FoldersService) { }

    @Get('tree')
    @RequirePermission('documents.documents.read')
    @ApiOperation({ summary: 'Every visible folder (flat, with parent ids and counts)' })
    tree(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(FolderTreeQuerySchema)) query: FolderTreeQuery) {
        return this.folders.tree(ctx, query);
    }

    @Get(':id')
    @RequirePermission('documents.documents.read')
    @ApiOperation({ summary: 'Folder with breadcrumbs and subfolders' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.folders.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('documents.folders.manage')
    @ApiOperation({ summary: 'Create a folder' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateFolderDto) {
        return this.folders.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('documents.folders.manage')
    @ApiOperation({ summary: 'Rename / update a folder' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFolderDto) {
        return this.folders.update(ctx, id, dto);
    }

    @Post(':id/move')
    @RequirePermission('documents.folders.manage')
    @ApiOperation({ summary: 'Move a folder with its subtree' })
    move(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveFolderDto) {
        return this.folders.move(ctx, id, dto.parent_folder_id ?? null);
    }

    @Delete(':id')
    @RequirePermission('documents.folders.manage')
    @ApiOperation({ summary: 'Delete an empty folder' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.folders.remove(ctx, id);
    }

    @Post(':id/favorite')
    @RequirePermission('documents.documents.read')
    @ApiOperation({ summary: 'Add a folder to my favorites' })
    favorite(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.folders.favorite(ctx, id, true);
    }

    @Delete(':id/favorite')
    @RequirePermission('documents.documents.read')
    @ApiOperation({ summary: 'Remove a folder from my favorites' })
    unfavorite(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.folders.favorite(ctx, id, false);
    }

    @Post(':id/legal-hold')
    @RequirePermission('documents.legal_hold.manage')
    @ApiOperation({ summary: 'Place a legal hold on the folder and everything below it' })
    setHold(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LegalHoldDto) {
        return this.folders.setLegalHold(ctx, id, dto.reason);
    }

    @Delete(':id/legal-hold')
    @RequirePermission('documents.legal_hold.manage')
    @ApiOperation({ summary: 'Release the folder legal hold' })
    releaseHold(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.folders.releaseLegalHold(ctx, id);
    }
}
