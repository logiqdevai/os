import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { sendCsv } from '../common/send-csv';
import { AssignOwnerDto } from '../companies/dto/company.dto';
import { CrmDealsService } from './deals.service';
import {
    BoardQuery, BoardQuerySchema, ChangeStageDto, CreateDealDto, DealContactDto, DealQuery, DealQuerySchema,
    LostDealDto, ReopenDealDto, ReplaceLineItemsDto, UpdateDealDto, WonDealDto,
} from './dto/deal.dto';

@ApiTags('CRM · Deals')
@ApiBearerAuth()
@Controller('crm/deals')
@UseGuards(JwtGuard, PermissionsGuard)
export class CrmDealsController {
    constructor(private readonly deals: CrmDealsService) { }

    @Get()
    @RequirePermission('crm.deals.read')
    @ApiOperation({ summary: 'List deals (scoped; money only with crm.financials.read)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(DealQuerySchema)) query: DealQuery) {
        return this.deals.findAll(ctx, query);
    }

    @Get('board')
    @RequirePermission('crm.deals.read')
    @ApiOperation({ summary: 'Pipeline board: stages with cards, counts, totals and weighted value' })
    board(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(BoardQuerySchema)) query: BoardQuery) {
        return this.deals.board(ctx, query);
    }

    @Get('export')
    @RequirePermission('crm.deals.export')
    @ApiOperation({ summary: 'Export deals as CSV (sensitive, audited)' })
    async export(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(DealQuerySchema)) query: DealQuery, @Res() res: Response) {
        sendCsv(res, await this.deals.export(ctx, query));
    }

    @Get(':id')
    @RequirePermission('crm.deals.read')
    @ApiOperation({ summary: 'Get a deal with stages, contacts, line items and stage history' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.deals.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('crm.deals.create')
    @ApiOperation({ summary: 'Create a deal (default pipeline and first stage when omitted)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateDealDto) {
        return this.deals.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('crm.deals.update')
    @ApiOperation({ summary: 'Update a deal (owners need crm.deals.assign; value needs crm.financials.read)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDealDto) {
        return this.deals.update(ctx, id, dto);
    }

    @Post(':id/stage')
    @RequirePermission('crm.deals.change_stage')
    @ApiOperation({ summary: 'Move the deal to a stage (history + probability; lost needs lost_reason_id)' })
    changeStage(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeStageDto) {
        return this.deals.changeStage(ctx, id, dto);
    }

    @Post(':id/won')
    @RequirePermission('crm.deals.change_stage')
    @ApiOperation({ summary: 'Mark the deal won (moves to the won stage)' })
    won(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: WonDealDto) {
        return this.deals.markWon(ctx, id, dto);
    }

    @Post(':id/lost')
    @RequirePermission('crm.deals.change_stage')
    @ApiOperation({ summary: 'Mark the deal lost with a catalogue reason' })
    lost(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LostDealDto) {
        return this.deals.markLost(ctx, id, dto);
    }

    @Post(':id/reopen')
    @RequirePermission('crm.deals.update')
    @ApiOperation({ summary: 'Reopen a won/lost deal' })
    reopen(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReopenDealDto) {
        return this.deals.reopen(ctx, id, dto.stage_id);
    }

    @Post(':id/assign')
    @RequirePermission('crm.deals.assign')
    @ApiOperation({ summary: 'Change the deal owner' })
    assign(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignOwnerDto) {
        return this.deals.assign(ctx, id, dto.owner_membership_id);
    }

    @Put(':id/line-items')
    @RequirePermission('crm.deals.update', 'crm.financials.read')
    @ApiOperation({ summary: 'Replace line items; deal totals are derived' })
    lineItems(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplaceLineItemsDto) {
        return this.deals.replaceLineItems(ctx, id, dto.items, dto.discount_percent);
    }

    @Post(':id/contacts')
    @RequirePermission('crm.deals.update')
    @ApiOperation({ summary: 'Add a contact to the deal' })
    addContact(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DealContactDto) {
        return this.deals.addContact(ctx, id, dto.contact_id, dto.role);
    }

    @Delete(':id/contacts/:contactId')
    @RequirePermission('crm.deals.update')
    @ApiOperation({ summary: 'Remove a contact from the deal' })
    removeContact(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('contactId', ParseUUIDPipe) contactId: string) {
        return this.deals.removeContact(ctx, id, contactId);
    }

    @Post(':id/archive')
    @RequirePermission('crm.deals.archive')
    @ApiOperation({ summary: 'Archive a deal' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.deals.archive(ctx, id, true);
    }

    @Post(':id/restore')
    @RequirePermission('crm.deals.archive')
    @ApiOperation({ summary: 'Restore an archived deal' })
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.deals.archive(ctx, id, false);
    }

    @Delete(':id')
    @RequirePermission('crm.deals.delete')
    @ApiOperation({ summary: 'Delete a deal (sensitive)' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.deals.remove(ctx, id);
    }
}
