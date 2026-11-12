import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ContractAiService, DecideFindingDto, DecideFindingSchema, FindingQuery, FindingQuerySchema, ReviewExtractionDto, ReviewExtractionSchema } from './contract-ai.service';

const READ = 'contracts.contracts.read';
const REVIEW = 'contracts.contracts.review';

/** 04 §72–75 — AI review findings and obligation extraction (organization OpenAI key; humans decide). */
@ApiTags('Contracts · AI')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtGuard, PermissionsGuard)
export class ContractAiController {
    constructor(private readonly ai: ContractAiService) { }

    @Get('contract-ai/status') @RequirePermission(READ) @ApiOperation({ summary: 'Whether the organization has an active OpenAI connection' })
    status(@CurrentOrg() ctx: OrgContext) { return this.ai.status(ctx); }

    @Post('contracts/:id/versions/:vid/ai/review') @RequirePermission(REVIEW) @ApiOperation({ summary: 'Run an AI review of the version: findings (ContractAiFinding) + explainable risk score. Never edits the text' })
    review(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('vid', ParseUUIDPipe) vid: string) { return this.ai.review(ctx, id, vid); }

    @Get('contracts/:id/versions/:vid/ai/findings') @RequirePermission(READ) @ApiOperation({ summary: 'AI review findings of a version' })
    findings(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('vid', ParseUUIDPipe) vid: string, @Query(new ZodValidationPipe(FindingQuerySchema)) q: FindingQuery) { return this.ai.findings(ctx, id, vid, q); }

    @Patch('contracts/:id/ai/findings/:fid') @RequirePermission(REVIEW) @ApiOperation({ summary: 'Accept or dismiss a finding (dismiss needs a note)' })
    decide(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('fid', ParseUUIDPipe) fid: string, @Body(new ZodValidationPipe(DecideFindingSchema)) dto: DecideFindingDto) { return this.ai.decideFinding(ctx, id, fid, dto); }

    @Post('contracts/:id/versions/:vid/ai/extract-obligations') @RequirePermission(REVIEW) @ApiOperation({ summary: 'Extract obligation suggestions (PENDING_REVIEW) from the version text' })
    extract(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('vid', ParseUUIDPipe) vid: string) { return this.ai.extractObligations(ctx, id, vid); }

    @Get('contracts/:id/ai/obligation-suggestions') @RequirePermission(READ) @ApiOperation({ summary: 'AI-extracted obligations waiting for review' })
    suggestions(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.ai.suggestions(ctx, id); }

    @Post('contracts/:id/ai/obligation-suggestions/:oid/review') @RequirePermission('contracts.obligations.manage') @ApiOperation({ summary: 'Confirm (optionally corrected) or reject an extracted obligation' })
    reviewExtraction(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('oid', ParseUUIDPipe) oid: string, @Body(new ZodValidationPipe(ReviewExtractionSchema)) dto: ReviewExtractionDto) { return this.ai.reviewExtraction(ctx, id, oid, dto); }
}
