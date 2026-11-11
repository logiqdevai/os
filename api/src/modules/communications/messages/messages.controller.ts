import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { MessagesService } from './messages.service';
import { MessageQuery, MessageQuerySchema, SendMessageDto } from './dto/message.dto';

@ApiTags('Communications · Messages')
@ApiBearerAuth()
@Controller('communications/messages')
@UseGuards(JwtGuard, PermissionsGuard)
export class MessagesController {
    constructor(private readonly messages: MessagesService) { }

    @Get()
    @RequirePermission('communications.messages.read')
    @ApiOperation({ summary: 'Message log: one-off, campaign and transactional email / SMS' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(MessageQuerySchema)) query: MessageQuery) {
        return this.messages.findAll(ctx, query);
    }

    @Get(':id')
    @RequirePermission('communications.messages.read')
    @ApiOperation({ summary: 'Get a message with recipients and delivery events' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.messages.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('communications.messages.create')
    @ApiOperation({ summary: 'Compose a message; sends now unless send=false or scheduled_at is set (sending needs communications.messages.send)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: SendMessageDto) {
        return this.messages.create(ctx, dto);
    }

    @Post(':id/send')
    @RequirePermission('communications.messages.send')
    @ApiOperation({ summary: 'Send a draft' })
    send(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.messages.send(ctx, id);
    }

    @Post(':id/resend')
    @RequirePermission('communications.messages.send')
    @ApiOperation({ summary: 'Resend a failed, bounced or cancelled message as a new message' })
    resend(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.messages.resend(ctx, id);
    }

    @Post(':id/cancel')
    @RequirePermission('communications.messages.send')
    @ApiOperation({ summary: 'Cancel a scheduled or queued message' })
    cancel(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.messages.cancel(ctx, id);
    }

    @Post(':id/archive')
    @RequirePermission('communications.messages.archive')
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.messages.archive(ctx, id, true);
    }

    @Post(':id/restore')
    @RequirePermission('communications.messages.archive')
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.messages.archive(ctx, id, false);
    }
}
