import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto, InvitationQuery, InvitationQuerySchema } from './dto/invitation.dto';

@ApiTags('Admin · Invitations')
@ApiBearerAuth()
@Controller('invitations')
@UseGuards(JwtGuard, PermissionsGuard)
export class InvitationsController {
    constructor(private readonly invitations: InvitationsService) { }

    @Get()
    @RequireAnyPermission('users.members.read', 'users.members.invite')
    @ApiOperation({ summary: 'List member invitations' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(InvitationQuerySchema)) query: InvitationQuery) {
        return this.invitations.findAll(ctx, query);
    }

    @Post()
    @RequirePermission('users.members.invite')
    @ApiOperation({ summary: 'Invite one or more people (returns the link when no email could be sent)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateInvitationDto) {
        return this.invitations.create(ctx, dto);
    }

    @Post(':id/resend')
    @HttpCode(200)
    @RequirePermission('users.members.invite')
    @ApiOperation({ summary: 'Resend an invitation with a fresh link (the old link stops working)' })
    resend(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.invitations.resend(ctx, id);
    }

    @Post(':id/cancel')
    @HttpCode(200)
    @RequirePermission('users.members.invite')
    @ApiOperation({ summary: 'Cancel a pending invitation' })
    cancel(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.invitations.cancel(ctx, id);
    }
}
