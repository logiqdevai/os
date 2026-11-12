import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { SessionsService } from './sessions.service';
import { RevokeAllSessionsDto, RevokeSessionDto, SessionQuery, SessionQuerySchema } from './dto/session.dto';

/** Members' active sessions (01 §72). Own sessions are under /auth/sessions. */
@ApiTags('Admin · Sessions')
@ApiBearerAuth()
@Controller('sessions')
@UseGuards(JwtGuard, PermissionsGuard)
export class SessionsController {
    constructor(private readonly sessions: SessionsService) { }

    @Get()
    @RequirePermission('users.sessions.read')
    @ApiOperation({ summary: 'List active sessions of members in your scope' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(SessionQuerySchema)) query: SessionQuery, @CurrentUser('session_id') sessionId: string | null) {
        return this.sessions.findAll(ctx, query, sessionId ?? null);
    }

    @Post('revoke-all')
    @HttpCode(200)
    @RequirePermission('users.sessions.revoke')
    @ApiOperation({ summary: 'Revoke every session in scope (or one member’s); your current session is kept' })
    revokeAll(@CurrentOrg() ctx: OrgContext, @Body() dto: RevokeAllSessionsDto, @CurrentUser('session_id') sessionId: string | null) {
        return this.sessions.revokeAll(ctx, dto, sessionId ?? null);
    }

    @Post(':id/revoke')
    @HttpCode(200)
    @RequirePermission('users.sessions.revoke')
    @ApiOperation({ summary: 'Revoke one session (signs that device out immediately)' })
    revoke(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RevokeSessionDto, @CurrentUser('session_id') sessionId: string | null) {
        return this.sessions.revoke(ctx, id, dto.reason, sessionId ?? null);
    }
}
