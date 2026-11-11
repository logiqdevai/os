import { Body, Controller, Delete, Get, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommChannel } from 'generated/prisma';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { BaseListQuery, BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';
import { ListsService } from './lists.service';
import { SegmentsService } from './segments.service';
import { ComplianceService } from './compliance.service';
import {
    AddListMembersDto, ConsentQuery, ConsentQuerySchema, CreateRecipientListDto, CreateSegmentDto, CreateSuppressionDto, ListQuery, ListQuerySchema,
    PreviewSegmentDto, RemoveSuppressionDto, SegmentQuery, SegmentQuerySchema, SetConsentDto, SuppressionQuery, SuppressionQuerySchema, UpdateRecipientListDto, UpdateSegmentDto,
} from './dto/audience.dto';

@ApiTags('Communications · Recipient lists')
@ApiBearerAuth()
@Controller('communications/lists')
@UseGuards(JwtGuard, PermissionsGuard)
export class ListsController {
    constructor(private readonly lists: ListsService) { }

    @Get()
    @RequirePermission('communications.recipient_lists.read')
    @ApiOperation({ summary: 'List recipient lists' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ListQuerySchema)) query: ListQuery) {
        return this.lists.findAll(ctx, query);
    }

    @Get(':id')
    @RequirePermission('communications.recipient_lists.read')
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.lists.findOne(ctx, id);
    }

    @Get(':id/members')
    @RequirePermission('communications.recipient_lists.read')
    @ApiOperation({ summary: 'List members of a recipient list' })
    members(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(BaseListQuerySchema)) query: BaseListQuery) {
        return this.lists.members(ctx, id, query);
    }

    @Post()
    @RequirePermission('communications.recipient_lists.create')
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateRecipientListDto) {
        return this.lists.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('communications.recipient_lists.update')
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRecipientListDto) {
        return this.lists.update(ctx, id, dto);
    }

    @Post(':id/members')
    @RequirePermission('communications.recipient_lists.update')
    @ApiOperation({ summary: 'Add members (contacts, members, external addresses); also used for CSV import' })
    addMembers(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddListMembersDto) {
        return this.lists.addMembers(ctx, id, dto.members);
    }

    @Delete(':id/members/:memberId')
    @RequirePermission('communications.recipient_lists.update')
    removeMember(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('memberId', ParseUUIDPipe) memberId: string) {
        return this.lists.removeMember(ctx, id, memberId);
    }

    @Post(':id/archive')
    @RequirePermission('communications.recipient_lists.archive')
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.lists.archive(ctx, id, true);
    }

    @Post(':id/restore')
    @RequirePermission('communications.recipient_lists.archive')
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.lists.archive(ctx, id, false);
    }

    @Delete(':id')
    @RequirePermission('communications.recipient_lists.delete')
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.lists.remove(ctx, id);
    }
}

@ApiTags('Communications · Segments')
@ApiBearerAuth()
@Controller('communications/segments')
@UseGuards(JwtGuard, PermissionsGuard)
export class SegmentsController {
    constructor(private readonly segments: SegmentsService) { }

    @Get()
    @RequirePermission('communications.segments.read')
    @ApiOperation({ summary: 'List segments' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(SegmentQuerySchema)) query: SegmentQuery) {
        return this.segments.findAll(ctx, query);
    }

    @Get('fields')
    @RequirePermission('communications.segments.read')
    @ApiOperation({ summary: 'Fields and operators available in the segment builder' })
    fields() {
        return this.segments.fields();
    }

    @Post('preview')
    @RequirePermission('communications.segments.read')
    @ApiOperation({ summary: 'Evaluate a definition without saving: count, sample, exclusions' })
    preview(@CurrentOrg() ctx: OrgContext, @Body() dto: PreviewSegmentDto) {
        return this.segments.preview(ctx, dto);
    }

    @Get(':id')
    @RequirePermission('communications.segments.read')
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.segments.findOne(ctx, id);
    }

    @Get(':id/members')
    @RequirePermission('communications.segments.read')
    @ApiOperation({ summary: 'Evaluate the segment now and page through its members' })
    members(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(BaseListQuerySchema)) query: BaseListQuery) {
        return this.segments.members(ctx, id, query);
    }

    @Post(':id/refresh')
    @RequirePermission('communications.segments.read')
    @ApiOperation({ summary: 'Recount the segment' })
    refresh(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.segments.refresh(ctx, id);
    }

    @Post()
    @RequirePermission('communications.segments.create')
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateSegmentDto) {
        return this.segments.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('communications.segments.update')
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSegmentDto) {
        return this.segments.update(ctx, id, dto);
    }

    @Post(':id/archive')
    @RequirePermission('communications.segments.archive')
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.segments.archive(ctx, id, true);
    }

    @Post(':id/restore')
    @RequirePermission('communications.segments.archive')
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.segments.archive(ctx, id, false);
    }

    @Delete(':id')
    @RequirePermission('communications.segments.delete')
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.segments.remove(ctx, id);
    }
}

@ApiTags('Communications · Consent & suppression')
@ApiBearerAuth()
@Controller('communications')
@UseGuards(JwtGuard, PermissionsGuard)
export class ComplianceController {
    constructor(private readonly compliance: ComplianceService) { }

    @Get('consents')
    @RequirePermission('communications.consents.read')
    @ApiOperation({ summary: 'List consent records' })
    consents(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ConsentQuerySchema)) query: ConsentQuery) {
        return this.compliance.consents(ctx, query);
    }

    @Get('consents/:contactId')
    @RequirePermission('communications.consents.read')
    @ApiOperation({ summary: 'Consent of one contact per channel, with history' })
    contactConsents(@CurrentOrg() ctx: OrgContext, @Param('contactId', ParseUUIDPipe) contactId: string) {
        return this.compliance.contactConsents(ctx, contactId);
    }

    @Put('consents/:contactId/:channel')
    @RequirePermission('communications.consents.manage')
    @ApiOperation({ summary: 'Set the consent of a contact on a channel (with evidence)' })
    setConsent(
        @CurrentOrg() ctx: OrgContext,
        @Param('contactId', ParseUUIDPipe) contactId: string,
        @Param('channel', new ParseEnumPipe(CommChannel)) channel: CommChannel,
        @Body() dto: SetConsentDto,
    ) {
        return this.compliance.setConsent(ctx, contactId, channel, dto);
    }

    @Get('suppressions')
    @RequirePermission('communications.suppressions.manage')
    @ApiOperation({ summary: 'List suppressed addresses' })
    suppressions(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(SuppressionQuerySchema)) query: SuppressionQuery) {
        return this.compliance.suppressions(ctx, query);
    }

    @Post('suppressions')
    @RequirePermission('communications.suppressions.manage')
    @ApiOperation({ summary: 'Suppress an address' })
    addSuppression(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateSuppressionDto) {
        return this.compliance.addSuppression(ctx, dto);
    }

    @Post('suppressions/:id/remove')
    @RequirePermission('communications.suppressions.manage')
    @ApiOperation({ summary: 'Remove an address from the suppression list' })
    removeSuppression(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RemoveSuppressionDto) {
        return this.compliance.removeSuppression(ctx, id, dto.reason);
    }
}
