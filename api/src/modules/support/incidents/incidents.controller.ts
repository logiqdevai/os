import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto, IncidentQuery, IncidentQuerySchema, IncidentTicketsDto, IncidentUpdateDto, UpdateIncidentDto } from './dto/incident.dto';

@ApiTags('Support · Incidents')
@ApiBearerAuth()
@Controller('support/incidents')
@UseGuards(JwtGuard, PermissionsGuard)
export class IncidentsController {
    constructor(private readonly incidents: IncidentsService) { }

    @Get()
    @RequirePermission('support.tickets.read')
    @ApiOperation({ summary: 'Incidents grouping several tickets' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(IncidentQuerySchema)) q: IncidentQuery) {
        return this.incidents.findAll(ctx, q);
    }

    @Get(':id')
    @RequirePermission('support.tickets.read')
    @ApiOperation({ summary: 'Incident with its timeline and tickets' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.incidents.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('support.tickets.update')
    @ApiOperation({ summary: 'Declare an incident' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateIncidentDto) {
        return this.incidents.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('support.tickets.update')
    @ApiOperation({ summary: 'Update an incident (status: confirm, dismiss, resolve)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateIncidentDto) {
        return this.incidents.update(ctx, id, dto);
    }

    @Post(':id/tickets')
    @RequirePermission('support.tickets.update')
    @ApiOperation({ summary: 'Attach tickets' })
    attach(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: IncidentTicketsDto) {
        return this.incidents.attachTickets(ctx, id, dto.ticket_ids);
    }

    @Delete(':id/tickets/:ticketId')
    @RequirePermission('support.tickets.update')
    @ApiOperation({ summary: 'Detach a ticket' })
    detach(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('ticketId', ParseUUIDPipe) ticketId: string) {
        return this.incidents.detachTicket(ctx, id, ticketId);
    }

    @Post(':id/updates')
    @RequirePermission('support.tickets.update')
    @ApiOperation({ summary: 'Post a timeline update (customer-visible needs support.incidents.publish)' })
    postUpdate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: IncidentUpdateDto) {
        return this.incidents.postUpdate(ctx, id, dto);
    }
}
