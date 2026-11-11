import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { TeamsService } from './teams.service';
import { AddTeamMemberDto, CreateTeamDto, UpdateTeamDto } from './dto/create-team.dto';
import { TeamQuery, TeamQuerySchema } from './dto/team-query.schema';

/** REFERENCE CONTROLLER — routing only; guards JwtGuard → PermissionsGuard; one permission per endpoint. */
@ApiTags('Admin · Teams')
@ApiBearerAuth()
@Controller('teams')
@UseGuards(JwtGuard, PermissionsGuard)
export class TeamsController {
    constructor(private readonly teams: TeamsService) { }

    @Get()
    @RequirePermission('organizations.teams.read')
    @ApiOperation({ summary: 'List teams (scoped to the caller)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TeamQuerySchema)) query: TeamQuery) {
        return this.teams.findAll(ctx, query);
    }

    @Get(':id')
    @RequirePermission('organizations.teams.read')
    @ApiOperation({ summary: 'Get a team with its members' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.teams.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('organizations.teams.manage')
    @ApiOperation({ summary: 'Create a team' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateTeamDto) {
        return this.teams.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('organizations.teams.manage')
    @ApiOperation({ summary: 'Update a team' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTeamDto) {
        return this.teams.update(ctx, id, dto);
    }

    @Post(':id/archive')
    @RequirePermission('organizations.teams.manage')
    @ApiOperation({ summary: 'Archive a team' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.teams.archive(ctx, id);
    }

    @Post(':id/restore')
    @RequirePermission('organizations.teams.manage')
    @ApiOperation({ summary: 'Restore an archived team' })
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.teams.restore(ctx, id);
    }

    @Post(':id/members')
    @RequirePermission('organizations.teams.members.manage')
    @ApiOperation({ summary: 'Add a member to a team' })
    addMember(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddTeamMemberDto) {
        return this.teams.addMember(ctx, id, dto);
    }

    @Delete(':id/members/:membershipId')
    @RequirePermission('organizations.teams.members.manage')
    @ApiOperation({ summary: 'Remove a member from a team' })
    removeMember(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('membershipId', ParseUUIDPipe) membershipId: string) {
        return this.teams.removeMember(ctx, id, membershipId);
    }
}
