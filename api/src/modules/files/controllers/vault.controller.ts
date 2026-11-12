import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { BaseListQuery, BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { VaultService } from '../services/vault.service';
import { CreateVaultEntryDto, CreateVaultGrantDto, RevealVaultEntryDto, UpdateVaultEntryDto, VaultQuery, VaultQuerySchema } from '../dto/vault.dto';
import { BigIntInterceptor } from '../utils/serialize.utils';

/** Secure credential vault (17 §12). Secrets only leave through `reveal`. */
@ApiTags('Files · Vault')
@ApiBearerAuth()
@Controller('files/vault/entries')
@UseGuards(JwtGuard, PermissionsGuard)
@UseInterceptors(BigIntInterceptor)
export class VaultController {
    constructor(private readonly vault: VaultService) { }

    @Get()
    @RequirePermission('documents.vault.read')
    @ApiOperation({ summary: 'List vault entries (metadata only, never secrets)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(VaultQuerySchema)) query: VaultQuery) {
        return this.vault.findAll(ctx, query);
    }

    @Get(':id')
    @RequirePermission('documents.vault.read')
    @ApiOperation({ summary: 'Vault entry metadata and grants (logged as VIEW)' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.vault.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('documents.vault.manage')
    @ApiOperation({ summary: 'Create a credential (secret is write-only, encrypted at rest)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateVaultEntryDto) {
        return this.vault.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('documents.vault.manage')
    @ApiOperation({ summary: 'Update a credential (sending a secret rotates it)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVaultEntryDto) {
        return this.vault.update(ctx, id, dto);
    }

    @Delete(':id')
    @RequirePermission('documents.vault.manage')
    @ApiOperation({ summary: 'Delete a credential (ciphertext is wiped)' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.vault.remove(ctx, id);
    }

    @Post(':id/reveal')
    @RequirePermission('documents.vault.read')
    @ApiOperation({ summary: 'Reveal the secret (needs documents.vault.reveal or a grant with can_reveal; logged and audited)' })
    reveal(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RevealVaultEntryDto) {
        return this.vault.reveal(ctx, id, dto.reason);
    }

    @Post(':id/copy')
    @RequirePermission('documents.vault.read')
    @ApiOperation({ summary: 'Log that the revealed secret was copied' })
    copy(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.vault.copy(ctx, id);
    }

    @Get(':id/access-log')
    @RequirePermission('documents.vault.manage')
    @ApiOperation({ summary: 'Access history of an entry' })
    accessLog(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(BaseListQuerySchema)) query: BaseListQuery) {
        return this.vault.accessLog(ctx, id, query);
    }

    @Post(':id/grants')
    @RequirePermission('documents.vault.manage')
    @ApiOperation({ summary: 'Grant a member, team or (customer-scoped entries) a Customer Portal user access to this entry' })
    addGrant(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateVaultGrantDto) {
        return this.vault.addGrant(ctx, id, dto);
    }

    @Get(':id/portal-users')
    @RequirePermission('documents.vault.manage')
    @ApiOperation({ summary: 'Customer Portal users of the entry\'s customer who can be granted access' })
    portalUsers(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.vault.portalCandidates(ctx, id);
    }

    @Delete(':id/grants/:grantId')
    @RequirePermission('documents.vault.manage')
    @ApiOperation({ summary: 'Revoke a grant' })
    revokeGrant(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('grantId', ParseUUIDPipe) grantId: string) {
        return this.vault.revokeGrant(ctx, id, grantId);
    }
}
