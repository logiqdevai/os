import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import type { IncomingFile } from '@/modules/files/services/documents.service';
import { PortalGuard } from '../common/portal.guard';
import { CurrentPortal, PortalContext, PortalMember, RequirePortalPermission } from '../common/portal-context';
import {
    PortalActionsService, PortalNotificationPreferences, PortalNotificationPreferencesSchema, PortalUploadFields, PortalUploadFieldsSchema,
} from './portal-actions.service';

/** Portal uploads are capped lower than agency uploads (Files still applies the organization's type and quota rules). */
const PORTAL_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * Customer portal actions that hand off to other modules: document upload (17), proposal acceptance (03),
 * contract signing (04) and the portal user's notification preferences (14). Guards: JwtGuard → PortalGuard.
 */
@ApiTags('Customer portal')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Portal-Membership-Id', required: false })
@Controller('portal')
@UseGuards(JwtGuard, PortalGuard)
export class PortalActionsController {
    constructor(private readonly actions: PortalActionsService) { }

    @Post('documents')
    @RequirePortalPermission('portal.documents.upload')
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: PORTAL_MAX_UPLOAD_BYTES, files: 1 } }))
    @ApiOperation({ summary: "Upload a file to your company's shared folder (multipart field `file`; optional title, project_id, description)" })
    upload(@CurrentPortal() p: PortalContext, @UploadedFile() file: IncomingFile, @Body(new ZodValidationPipe(PortalUploadFieldsSchema)) fields: PortalUploadFields) {
        return this.actions.uploadDocument(p, file, fields);
    }

    @Get('documents/:id/download')
    @RequirePortalPermission('portal.documents.read')
    @ApiOperation({ summary: 'Signed, expiring download path of a shared document' })
    download(@CurrentPortal() p: PortalContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.actions.documentDownload(p, id);
    }

    @Post('proposals/:id/open')
    @RequirePortalPermission('portal.proposals.accept')
    @ApiOperation({ summary: 'Fresh customer link to review and accept a proposal (returns the /p/:token path; earlier emailed links stop working)' })
    proposalLink(@CurrentPortal() p: PortalContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.actions.proposalLink(p, id);
    }

    @Post('contracts/:id/sign')
    @RequirePortalPermission('portal.contracts.sign')
    @ApiOperation({ summary: 'Fresh signing link when you are a signer whose turn it is (returns the /sign/:token path)' })
    signLink(@CurrentPortal() p: PortalContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.actions.contractSigningLink(p, id);
    }

    @Get('notification-preferences')
    @PortalMember()
    @ApiOperation({ summary: 'Your notification preferences (email / in-app, digest, topics)' })
    preferences(@CurrentPortal() p: PortalContext) {
        return this.actions.notificationPreferences(p);
    }

    @Patch('notification-preferences')
    @PortalMember()
    @ApiOperation({ summary: 'Update your notification preferences' })
    updatePreferences(@CurrentPortal() p: PortalContext, @Body(new ZodValidationPipe(PortalNotificationPreferencesSchema)) dto: PortalNotificationPreferences) {
        return this.actions.updateNotificationPreferences(p, dto);
    }
}
