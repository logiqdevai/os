import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { SharesService } from '../services/shares.service';
import { CreateShareDto, ShareQuery, ShareQuerySchema, UpdateShareDto } from '../dto/shares.dto';
import { BigIntInterceptor } from '../utils/serialize.utils';

/** Shares of documents and folders (17 §9). */
@ApiTags('Files · Shares')
@ApiBearerAuth()
@Controller('files/shares')
@UseGuards(JwtGuard, PermissionsGuard)
@UseInterceptors(BigIntInterceptor)
export class SharesController {
    constructor(private readonly shares: SharesService) { }

    @Get()
    @RequirePermission('documents.documents.read')
    @ApiOperation({ summary: 'List shares (all shares with documents.documents.share; otherwise shares with me)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ShareQuerySchema)) query: ShareQuery) {
        return this.shares.findAll(ctx, query);
    }

    @Get('directory')
    @RequireAnyPermission('documents.documents.share', 'documents.documents.approve', 'documents.vault.manage')
    @ApiOperation({ summary: 'Members and teams to pick from when sharing, requesting approval or granting vault access' })
    directory(@CurrentOrg() ctx: OrgContext, @Query('search') search?: string) {
        return this.shares.directory(ctx, search);
    }

    @Post()
    @RequirePermission('documents.documents.share')
    @ApiOperation({ summary: 'Share a document or folder (link token is returned once)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateShareDto) {
        return this.shares.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('documents.documents.share')
    @ApiOperation({ summary: 'Change permission, expiry or limits' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateShareDto) {
        return this.shares.update(ctx, id, dto);
    }

    @Post(':id/revoke')
    @RequirePermission('documents.documents.share')
    @ApiOperation({ summary: 'Revoke a share (takes effect at once)' })
    revoke(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.shares.revoke(ctx, id);
    }
}
