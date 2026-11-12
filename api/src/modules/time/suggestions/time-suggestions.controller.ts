import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import {
    AcceptSuggestion, AcceptSuggestionSchema, GenerateSuggestionsSchema, SuggestionQuery, SuggestionQuerySchema, TimeSuggestionsService,
} from './time-suggestions.service';

const BulkSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) });

@ApiTags('Time · Suggestions')
@ApiBearerAuth()
@Controller('time/suggestions')
@UseGuards(JwtGuard, PermissionsGuard)
export class TimeSuggestionsController {
    constructor(private readonly suggestions: TimeSuggestionsService) { }

    @Get()
    @RequirePermission('time.entries.create_own')
    @ApiOperation({ summary: 'My suggested entries (default: PENDING)' })
    list(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(SuggestionQuerySchema)) q: SuggestionQuery) {
        return this.suggestions.list(ctx, q);
    }

    @Post('generate')
    @RequirePermission('time.entries.create_own')
    @ApiOperation({ summary: 'Scan my calendar events and task status changes (last 14 days by default) for new suggestions' })
    generate(@CurrentOrg() ctx: OrgContext, @Body(new ZodValidationPipe(GenerateSuggestionsSchema)) dto: z.infer<typeof GenerateSuggestionsSchema>) {
        return this.suggestions.generate(ctx, dto);
    }

    @Post('accept')
    @RequirePermission('time.entries.create_own')
    @ApiOperation({ summary: 'Accept several suggestions as proposed' })
    acceptMany(@CurrentOrg() ctx: OrgContext, @Body(new ZodValidationPipe(BulkSchema)) dto: z.infer<typeof BulkSchema>) {
        return this.suggestions.acceptMany(ctx, dto.ids);
    }

    @Post(':id/accept')
    @RequirePermission('time.entries.create_own')
    @ApiOperation({ summary: 'Accept (optionally edited) — creates a time entry' })
    accept(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AcceptSuggestionSchema)) dto: AcceptSuggestion) {
        return this.suggestions.accept(ctx, id, dto);
    }

    @Post(':id/dismiss')
    @RequirePermission('time.entries.create_own')
    dismiss(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.suggestions.dismiss(ctx, id);
    }
}
