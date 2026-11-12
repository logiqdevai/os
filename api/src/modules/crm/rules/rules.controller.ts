import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CrmTargetPeriod } from 'generated/prisma';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ZBody } from '@/modules/finance-shared/zod-body.pipe';
import { CrmLeadRulesService } from './lead-rules.service';
import { CrmTargetsService } from './targets.service';
import {
    CreateAssignmentRuleInput, CreateAssignmentRuleSchema, CreateScoringRuleInput, CreateScoringRuleSchema, CreateTargetInput, CreateTargetSchema,
    TargetQuery, TargetQuerySchema, UpdateAssignmentRuleInput, UpdateAssignmentRuleSchema, UpdateScoringRuleInput, UpdateScoringRuleSchema, UpdateTargetInput, UpdateTargetSchema,
} from './dto/rules.dto';

export const TargetListQuerySchema = z.object({ period: z.nativeEnum(CrmTargetPeriod).optional(), year: z.coerce.number().int().min(2000).max(2100).optional() });

/** 02 §6, §11, §31, §33 — lead assignment rules, lead scoring rules and sales targets. */
@ApiTags('CRM · Rules & targets')
@ApiBearerAuth()
@Controller('crm')
@UseGuards(JwtGuard, PermissionsGuard)
export class CrmRulesController {
    constructor(private readonly rules: CrmLeadRulesService, private readonly targets: CrmTargetsService) { }

    @Get('rules/fields')
    @RequireAnyPermission('crm.settings.manage', 'crm.scoring_rules.manage')
    @ApiOperation({ summary: 'Lead fields (and lead custom fields) usable in rule conditions' })
    fields(@CurrentOrg() ctx: OrgContext) {
        return this.rules.fields(ctx);
    }

    @Get('assignment-rules')
    @RequirePermission('crm.settings.manage')
    @ApiOperation({ summary: 'Lead assignment rules in priority order' })
    assignmentRules(@CurrentOrg() ctx: OrgContext) {
        return this.rules.assignmentRules(ctx);
    }

    @Post('assignment-rules')
    @RequirePermission('crm.settings.manage')
    @ApiOperation({ summary: 'Create an assignment rule (member, round robin or least loaded)' })
    createAssignmentRule(@CurrentOrg() ctx: OrgContext, @Body(ZBody(CreateAssignmentRuleSchema)) dto: CreateAssignmentRuleInput) {
        return this.rules.createAssignmentRule(ctx, dto);
    }

    @Patch('assignment-rules/:id')
    @RequirePermission('crm.settings.manage')
    @ApiOperation({ summary: 'Update an assignment rule' })
    updateAssignmentRule(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(UpdateAssignmentRuleSchema)) dto: UpdateAssignmentRuleInput) {
        return this.rules.updateAssignmentRule(ctx, id, dto);
    }

    @Delete('assignment-rules/:id')
    @RequirePermission('crm.settings.manage')
    @ApiOperation({ summary: 'Delete an assignment rule' })
    deleteAssignmentRule(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.rules.deleteAssignmentRule(ctx, id);
    }

    @Get('scoring-rules')
    @RequirePermission('crm.scoring_rules.manage')
    @ApiOperation({ summary: 'Lead scoring rules' })
    scoringRules(@CurrentOrg() ctx: OrgContext) {
        return this.rules.scoringRules(ctx);
    }

    @Post('scoring-rules')
    @RequirePermission('crm.scoring_rules.manage')
    @ApiOperation({ summary: 'Create a scoring rule (points added when every condition matches)' })
    createScoringRule(@CurrentOrg() ctx: OrgContext, @Body(ZBody(CreateScoringRuleSchema)) dto: CreateScoringRuleInput) {
        return this.rules.createScoringRule(ctx, dto);
    }

    @Patch('scoring-rules/:id')
    @RequirePermission('crm.scoring_rules.manage')
    @ApiOperation({ summary: 'Update a scoring rule' })
    updateScoringRule(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(UpdateScoringRuleSchema)) dto: UpdateScoringRuleInput) {
        return this.rules.updateScoringRule(ctx, id, dto);
    }

    @Delete('scoring-rules/:id')
    @RequirePermission('crm.scoring_rules.manage')
    @ApiOperation({ summary: 'Delete a scoring rule' })
    deleteScoringRule(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.rules.deleteScoringRule(ctx, id);
    }

    @Post('scoring-rules/recalculate')
    @RequirePermission('crm.scoring_rules.manage')
    @ApiOperation({ summary: 'Recompute the score of every open lead' })
    recalculate(@CurrentOrg() ctx: OrgContext) {
        return this.rules.rescoreAll(ctx);
    }

    @Get('targets/attainment')
    @RequirePermission('crm.targets.read')
    @ApiOperation({ summary: 'Targets active on a date (default today) with actuals and attainment %' })
    attainment(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TargetQuerySchema)) q: TargetQuery) {
        return this.targets.findAll(ctx, q);
    }

    @Get('targets')
    @RequirePermission('crm.targets.read')
    @ApiOperation({ summary: 'Targets of a year (optionally one period type) with attainment' })
    list(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TargetListQuerySchema)) q: z.infer<typeof TargetListQuerySchema>) {
        return this.targets.list(ctx, q);
    }

    @Post('targets')
    @RequirePermission('crm.targets.manage')
    @ApiOperation({ summary: 'Create a target for a member, a team or the organization (sensitive)' })
    createTarget(@CurrentOrg() ctx: OrgContext, @Body(ZBody(CreateTargetSchema)) dto: CreateTargetInput) {
        return this.targets.create(ctx, dto);
    }

    @Patch('targets/:id')
    @RequirePermission('crm.targets.manage')
    @ApiOperation({ summary: 'Update a target' })
    updateTarget(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(UpdateTargetSchema)) dto: UpdateTargetInput) {
        return this.targets.update(ctx, id, dto);
    }

    @Delete('targets/:id')
    @RequirePermission('crm.targets.manage')
    @ApiOperation({ summary: 'Delete a target' })
    removeTarget(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.targets.remove(ctx, id);
    }
}
