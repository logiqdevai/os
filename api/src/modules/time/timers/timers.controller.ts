import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { TimersService } from './timers.service';
import { StartTimerDto, UpdateTimerDto } from './dto/timer.dto';

/** /time/timers — the caller's own running timer. */
@ApiTags('Time · Timers')
@ApiBearerAuth()
@Controller('time/timers')
@UseGuards(JwtGuard, PermissionsGuard)
export class TimersController {
    constructor(private readonly timers: TimersService) { }

    @Get('current')
    @RequirePermission('time.entries.read_own')
    @ApiOperation({ summary: 'The caller\'s running timer (or null)' })
    current(@CurrentOrg() ctx: OrgContext) {
        return this.timers.current(ctx);
    }

    @Post()
    @RequirePermission('time.entries.create_own')
    @ApiOperation({ summary: 'Start a timer (409 when one is running unless stop_current)' })
    start(@CurrentOrg() ctx: OrgContext, @Body() dto: StartTimerDto) {
        return this.timers.start(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('time.entries.create_own')
    @ApiOperation({ summary: 'Change what the running timer is for' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTimerDto) {
        return this.timers.update(ctx, id, dto);
    }

    @Post(':id/stop')
    @RequirePermission('time.entries.create_own')
    @ApiOperation({ summary: 'Stop the timer and save it as a time entry' })
    stop(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.timers.stop(ctx, id);
    }

    @Post(':id/pause')
    @RequirePermission('time.entries.create_own')
    @ApiOperation({ summary: 'Pause the timer' })
    pause(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.timers.pause(ctx, id);
    }

    @Post(':id/resume')
    @RequirePermission('time.entries.create_own')
    @ApiOperation({ summary: 'Resume a paused timer' })
    resume(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.timers.resume(ctx, id);
    }

    @Post(':id/discard')
    @RequirePermission('time.entries.create_own')
    @ApiOperation({ summary: 'Discard the timer without saving time' })
    discard(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.timers.discard(ctx, id);
    }
}
