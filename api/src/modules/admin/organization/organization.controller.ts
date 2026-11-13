import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, Public, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import type { IncomingFile } from '@/modules/files/services/documents.service';
import { OrganizationService } from './organization.service';
import { LOGO_MAX_BYTES, LogoVariant, OrganizationLogoService } from './organization-logo.service';
import { ModuleToggleDto, UpdateBrandingDto, UpdateOrganizationDto } from './dto/organization.dto';

@ApiTags('Admin · Organization')
@ApiBearerAuth()
@Controller('organization')
@UseGuards(JwtGuard, PermissionsGuard)
export class OrganizationController {
    constructor(private readonly organization: OrganizationService, private readonly logos: OrganizationLogoService) { }

    @Get()
    @RequireAnyPermission('organizations.settings.manage', 'organizations.branding.manage')
    @ApiOperation({ summary: 'Organization profile, defaults and branding' })
    get(@CurrentOrg() ctx: OrgContext) {
        return this.organization.get(ctx);
    }

    @Patch()
    @RequirePermission('organizations.settings.manage')
    @ApiOperation({ summary: 'Update the organization profile and defaults' })
    update(@CurrentOrg() ctx: OrgContext, @Body() dto: UpdateOrganizationDto) {
        return this.organization.update(ctx, dto);
    }

    @Patch('branding')
    @RequirePermission('organizations.branding.manage')
    @ApiOperation({ summary: 'Update branding (colors, footer, portal); logos are uploaded separately' })
    branding(@CurrentOrg() ctx: OrgContext, @Body() dto: UpdateBrandingDto) {
        return this.organization.updateBranding(ctx, dto);
    }

    @Post('branding/logo/:variant')
    @RequirePermission('organizations.branding.manage')
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: LOGO_MAX_BYTES, files: 1 } }))
    @ApiOperation({ summary: 'Upload or replace the light or dark logo (PNG, JPG or WebP, max 5 MB)' })
    uploadLogo(@CurrentOrg() ctx: OrgContext, @Param('variant', new ZodValidationPipe(z.enum(['light', 'dark']))) variant: LogoVariant, @UploadedFile() file: IncomingFile) {
        return this.logos.upload(ctx, variant, file);
    }

    @Delete('branding/logo/:variant')
    @RequirePermission('organizations.branding.manage')
    @ApiOperation({ summary: 'Remove the light or dark logo' })
    removeLogo(@CurrentOrg() ctx: OrgContext, @Param('variant', new ZodValidationPipe(z.enum(['light', 'dark']))) variant: LogoVariant) {
        return this.logos.remove(ctx, variant);
    }

    @Get('logos/:orgId/:variant/:logoId')
    @Public()
    @ApiOperation({ summary: 'Public logo by versioned id (replaced or removed logos return 404)' })
    async logo(@Param('orgId', ParseUUIDPipe) orgId: string, @Param('variant', new ZodValidationPipe(z.enum(['light', 'dark']))) variant: LogoVariant, @Param('logoId', ParseUUIDPipe) logoId: string, @Res() res: Response) {
        const { stream, mime } = await this.logos.stream(orgId, variant, logoId);
        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        stream.on('error', () => { if (!res.headersSent) res.status(404); res.end(); });
        stream.pipe(res);
    }

    @Get('modules')
    @RequirePermission('organizations.modules.manage')
    @ApiOperation({ summary: 'Every module with its enablement for the organization' })
    modules(@CurrentOrg() ctx: OrgContext) {
        return this.organization.modules(ctx);
    }

    @Put('modules/:module')
    @RequirePermission('organizations.modules.manage')
    @ApiOperation({ summary: 'Enable or disable a module for the whole organization' })
    setModule(@CurrentOrg() ctx: OrgContext, @Param('module', new ZodValidationPipe(z.nativeEnum(ModuleKey))) module: ModuleKey, @Body() dto: ModuleToggleDto) {
        return this.organization.setModule(ctx, module, dto.enabled);
    }
}
