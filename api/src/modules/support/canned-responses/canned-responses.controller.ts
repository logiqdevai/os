import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { CannedResponsesService } from './canned-responses.service';
import { CannedQuery, CannedQuerySchema, CreateCannedResponseDto, RenderCannedResponseDto, UpdateCannedResponseDto } from './dto/canned-response.dto';

@ApiTags('Support · Canned responses')
@ApiBearerAuth()
@Controller('support/canned-responses')
@UseGuards(JwtGuard, PermissionsGuard)
export class CannedResponsesController {
    constructor(private readonly canned: CannedResponsesService) { }

    @Get()
    @RequireAnyPermission('support.conversations.reply', 'support.canned_responses.manage')
    @ApiOperation({ summary: 'Saved replies visible to me (organization, my teams, personal)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(CannedQuerySchema)) q: CannedQuery) {
        return this.canned.findAll(ctx, q);
    }

    @Get(':id')
    @RequireAnyPermission('support.conversations.reply', 'support.canned_responses.manage')
    @ApiOperation({ summary: 'Get a saved reply' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.canned.findOne(ctx, id);
    }

    @Post()
    @RequireAnyPermission('support.conversations.reply', 'support.canned_responses.manage')
    @ApiOperation({ summary: 'Create a saved reply (shared scopes need support.canned_responses.manage)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateCannedResponseDto) {
        return this.canned.create(ctx, dto);
    }

    @Patch(':id')
    @RequireAnyPermission('support.conversations.reply', 'support.canned_responses.manage')
    @ApiOperation({ summary: 'Update a saved reply' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCannedResponseDto) {
        return this.canned.update(ctx, id, dto);
    }

    @Delete(':id')
    @RequireAnyPermission('support.conversations.reply', 'support.canned_responses.manage')
    @ApiOperation({ summary: 'Remove a saved reply' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.canned.remove(ctx, id);
    }

    @Post(':id/render')
    @RequirePermission('support.conversations.reply')
    @ApiOperation({ summary: 'Render placeholders for a conversation or ticket' })
    render(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RenderCannedResponseDto) {
        return this.canned.render(ctx, id, dto);
    }
}
