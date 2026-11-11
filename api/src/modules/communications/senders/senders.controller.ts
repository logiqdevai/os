import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommChannel } from 'generated/prisma';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { SendersService } from './senders.service';
import { CreateSenderDomainDto, CreateSenderIdentityDto, UpdateSenderIdentityDto } from './dto/sender.dto';

const MANAGE = 'communications.sender_identities.manage';
/** Pickers in the campaign wizard / composer only need to read senders. */
const READ_ANY = [MANAGE, 'communications.campaigns.read', 'communications.messages.create', 'communications.templates.read'];

@ApiTags('Communications · Senders')
@ApiBearerAuth()
@Controller('communications')
@UseGuards(JwtGuard, PermissionsGuard)
export class SendersController {
    constructor(private readonly senders: SendersService) { }

    @Get('sender-domains')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'List sending domains with DNS records' })
    listDomains(@CurrentOrg() ctx: OrgContext) {
        return this.senders.listDomains(ctx);
    }

    @Post('sender-domains')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Add a sending domain (registers it at the connected email provider)' })
    createDomain(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateSenderDomainDto) {
        return this.senders.createDomain(ctx, dto);
    }

    @Post('sender-domains/:id/verify')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Check DNS records of a sending domain' })
    verifyDomain(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.senders.verifyDomain(ctx, id);
    }

    @Delete('sender-domains/:id')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Remove a sending domain' })
    removeDomain(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.senders.removeDomain(ctx, id);
    }

    @Get('sender-identities')
    @RequireAnyPermission(...READ_ANY)
    @ApiOperation({ summary: 'List sender identities (from addresses and SMS sender ids)' })
    listIdentities(@CurrentOrg() ctx: OrgContext, @Query('channel') channel?: CommChannel) {
        return this.senders.listIdentities(ctx, Object.values(CommChannel).includes(channel as CommChannel) ? channel : undefined);
    }

    @Post('sender-identities')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Add a sender identity' })
    createIdentity(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateSenderIdentityDto) {
        return this.senders.createIdentity(ctx, dto);
    }

    @Patch('sender-identities/:id')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Update a sender identity (display name, reply-to, default)' })
    updateIdentity(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSenderIdentityDto) {
        return this.senders.updateIdentity(ctx, id, dto);
    }

    @Post('sender-identities/:id/verify')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Re-check a sender identity' })
    verifyIdentity(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.senders.verifyIdentity(ctx, id);
    }

    @Delete('sender-identities/:id')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Remove a sender identity' })
    removeIdentity(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.senders.removeIdentity(ctx, id);
    }
}
