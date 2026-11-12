import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ZBody } from '@/modules/finance-shared/zod-body.pipe';
import { TopicsService } from './topics.service';
import { CreateTopicInput, CreateTopicSchema, SetSubscriptionsInput, SetSubscriptionsSchema, TopicQuery, TopicQuerySchema, UpdateTopicInput, UpdateTopicSchema } from './dto/topic.dto';

/** Preference-center topics and per-contact topic subscriptions (11). Topic definitions are organization settings. */
@ApiTags('Communications · Topics')
@ApiBearerAuth()
@Controller('communications/topics')
@UseGuards(JwtGuard, PermissionsGuard)
export class TopicsController {
    constructor(private readonly topics: TopicsService) { }

    @Get()
    @RequirePermission('communications.consents.read')
    @ApiOperation({ summary: 'List topics with subscriber counts' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TopicQuerySchema)) query: TopicQuery) {
        return this.topics.findAll(ctx, query);
    }

    @Post()
    @RequirePermission('communications.settings.manage')
    @ApiOperation({ summary: 'Create a topic' })
    create(@CurrentOrg() ctx: OrgContext, @Body(ZBody(CreateTopicSchema)) dto: CreateTopicInput) {
        return this.topics.create(ctx, dto);
    }

    @Get('contacts/:contactId')
    @RequirePermission('communications.consents.read')
    @ApiOperation({ summary: 'Topic subscriptions of a contact' })
    contact(@CurrentOrg() ctx: OrgContext, @Param('contactId', ParseUUIDPipe) contactId: string) {
        return this.topics.contactSubscriptions(ctx, contactId);
    }

    @Put('contacts/:contactId')
    @RequirePermission('communications.consents.manage')
    @ApiOperation({ summary: 'Set topic subscriptions of a contact' })
    setContact(@CurrentOrg() ctx: OrgContext, @Param('contactId', ParseUUIDPipe) contactId: string, @Body(ZBody(SetSubscriptionsSchema)) dto: SetSubscriptionsInput) {
        return this.topics.setSubscriptions(ctx, contactId, dto);
    }

    @Get(':id')
    @RequirePermission('communications.consents.read')
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.topics.findOne(ctx, id);
    }

    @Patch(':id')
    @RequirePermission('communications.settings.manage')
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(UpdateTopicSchema)) dto: UpdateTopicInput) {
        return this.topics.update(ctx, id, dto);
    }

    @Post(':id/archive')
    @RequirePermission('communications.settings.manage')
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.topics.archive(ctx, id, true);
    }

    @Post(':id/restore')
    @RequirePermission('communications.settings.manage')
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.topics.archive(ctx, id, false);
    }

    @Delete(':id')
    @RequirePermission('communications.settings.manage')
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.topics.remove(ctx, id);
    }
}
