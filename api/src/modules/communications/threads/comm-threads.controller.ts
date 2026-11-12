import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ZBody } from '@/modules/finance-shared/zod-body.pipe';
import { MessagesService } from '../messages/messages.service';
import { CommThreadsService, ThreadQuery, ThreadQuerySchema } from './comm-threads.service';

export const ThreadReplySchema = z.object({
    subject: z.string().max(300).optional(),
    body_html: z.string().max(500_000).optional(),
    body_text: z.string().max(100_000).optional(),
    sender_identity_id: z.string().uuid().optional(),
});
export type ThreadReplyInput = z.infer<typeof ThreadReplySchema>;

/** Conversation threads of one-off email / SMS (11 "Communication History"). */
@ApiTags('Communications · Threads')
@ApiBearerAuth()
@Controller('communications/threads')
@UseGuards(JwtGuard, PermissionsGuard)
export class CommThreadsController {
    constructor(
        private readonly threads: CommThreadsService,
        private readonly messages: MessagesService,
    ) { }

    @Get()
    @RequirePermission('communications.messages.read')
    @ApiOperation({ summary: 'Conversation threads, newest activity first' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ThreadQuerySchema)) query: ThreadQuery) {
        return this.threads.findAll(ctx, query);
    }

    @Get(':id')
    @RequirePermission('communications.messages.read')
    @ApiOperation({ summary: 'A thread with its messages, oldest first' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.threads.findOne(ctx, id);
    }

    @Post(':id/reply')
    @RequirePermission('communications.messages.send')
    @ApiOperation({ summary: 'Send a follow-up in the thread (to the same recipient)' })
    async reply(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(ThreadReplySchema)) dto: ThreadReplyInput) {
        return this.messages.replyInThread(ctx, await this.threads.findOne(ctx, id), dto);
    }

    @Post(':id/archive')
    @RequirePermission('communications.messages.archive')
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.threads.archive(ctx, id, true);
    }

    @Post(':id/restore')
    @RequirePermission('communications.messages.archive')
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.threads.archive(ctx, id, false);
    }
}
