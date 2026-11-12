import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ZBody } from '@/modules/finance-shared/zod-body.pipe';
import type { IncomingFile } from '@/modules/files/services/documents.service';
import { MAX_UPLOAD_BYTES } from '@/modules/files/utils/file-policy.utils';
import { MessagingAttachmentsService } from '../services/attachments.service';
import { CallQuery, CallQuerySchema, ChannelCallsService, StartCallInput, StartCallSchema } from '../services/calls.service';
import { MessagingModerationService, ReportMessageInput, ReportMessageSchema } from '../services/moderation.service';

const UrlQuerySchema = z.object({ disposition: z.enum(['inline', 'attachment']).default('attachment') });
const FilesQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });

/** Files in messages, huddles / calls and reporting a message (12 §22, §44, §49). Every action re-checks channel access. */
@ApiTags('Messaging · Files, calls, reports')
@ApiBearerAuth()
@Controller('messaging')
@UseGuards(JwtGuard, PermissionsGuard)
export class MessagingWorkspaceController {
    constructor(
        private readonly attachments: MessagingAttachmentsService,
        private readonly calls: ChannelCallsService,
        private readonly moderation: MessagingModerationService,
    ) { }

    // --- files
    @Post('channels/:id/attachments')
    @RequirePermission('messaging.messages.post')
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
    @ApiOperation({ summary: 'Upload a file for a message in this channel (stored as a 17 Document); post it with attachments: [{ document_id, file_name, mime_type, size_bytes }]' })
    upload(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: IncomingFile) {
        return this.attachments.upload(ctx, id, file);
    }

    @Get('channels/:id/files')
    @RequirePermission('messaging.messages.read')
    @ApiOperation({ summary: 'Files shared in a channel' })
    files(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(FilesQuerySchema)) q: { limit: number }) {
        return this.attachments.channelFiles(ctx, id, q.limit);
    }

    @Get('attachments/:id/url')
    @RequirePermission('messaging.messages.read')
    @ApiOperation({ summary: 'Signed, short-lived URL to preview (inline) or download an attachment' })
    url(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(UrlQuerySchema)) q: { disposition: 'inline' | 'attachment' }) {
        return this.attachments.url(ctx, id, q.disposition);
    }

    // --- calls / huddles
    @Get('calls')
    @RequirePermission('messaging.channels.read')
    @ApiOperation({ summary: 'Active (default) or recent calls in channels I can read' })
    listCalls(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(CallQuerySchema)) q: CallQuery) {
        return this.calls.list(ctx, q);
    }

    @Get('calls/:id')
    @RequirePermission('messaging.channels.read')
    getCall(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.calls.get(ctx, id);
    }

    @Post('channels/:id/calls')
    @RequirePermission('messaging.calls.start')
    @ApiOperation({ summary: 'Start a huddle / call in a channel (or join the running one). Media is not hosted: pass meeting_url for an external meeting.' })
    startCall(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(StartCallSchema)) dto: StartCallInput) {
        return this.calls.start(ctx, id, dto);
    }

    @Post('calls/:id/join')
    @RequirePermission('messaging.calls.start')
    join(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.calls.join(ctx, id);
    }

    @Post('calls/:id/leave')
    @RequirePermission('messaging.channels.read')
    leave(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.calls.leave(ctx, id);
    }

    @Post('calls/:id/end')
    @RequirePermission('messaging.calls.start')
    end(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.calls.end(ctx, id);
    }

    // --- reporting
    @Post('messages/:id/report')
    @RequirePermission('messaging.messages.read')
    @ApiOperation({ summary: 'Report a message to the moderators (reason: spam | abuse | sensitive_data | off_topic | other)' })
    report(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(ReportMessageSchema)) dto: ReportMessageInput) {
        return this.moderation.report(ctx, id, dto);
    }
}
