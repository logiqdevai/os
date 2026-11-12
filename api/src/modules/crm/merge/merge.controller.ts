import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ZBody } from '@/modules/finance-shared/zod-body.pipe';
import { CrmMergeService, MergeInput, MergePreviewQuery, MergePreviewQuerySchema, MergeSchema } from './merge.service';
import { CrmDuplicatesService, DismissSchema, DuplicateRuleInput, DuplicateRuleSchema, DuplicatesQuery, DuplicatesQuerySchema } from './duplicates.service';

const MERGE_ANY = ['crm.companies.merge', 'crm.contacts.merge', 'crm.leads.merge', 'crm.deals.merge'];
const READ_ANY = ['crm.companies.read', 'crm.contacts.read', 'crm.leads.read'];
const UPDATE_ANY = ['crm.companies.update', 'crm.contacts.update', 'crm.leads.update'];

/** 02 §22 — duplicates inbox and record merge (mockups `duplicates`, `company-merge`). Per-entity keys are checked in the services. */
@ApiTags('CRM · Duplicates & merge')
@ApiBearerAuth()
@Controller('crm')
@UseGuards(JwtGuard, PermissionsGuard)
export class CrmMergeController {
    constructor(private readonly merges: CrmMergeService, private readonly duplicates: CrmDuplicatesService) { }

    @Get('duplicates')
    @RequireAnyPermission(...READ_ANY)
    @ApiOperation({ summary: 'Duplicate candidate pairs with score and reasons (needs the entity read key)' })
    find(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(DuplicatesQuerySchema)) q: DuplicatesQuery) {
        return this.duplicates.find(ctx, q);
    }

    @Post('duplicates/dismiss')
    @RequireAnyPermission(...UPDATE_ANY)
    @ApiOperation({ summary: 'Mark a pair as "not a duplicate" (needs the entity update key)' })
    dismiss(@CurrentOrg() ctx: OrgContext, @Body(ZBody(DismissSchema)) dto: z.infer<typeof DismissSchema>) {
        return this.duplicates.dismiss(ctx, dto);
    }

    @Get('duplicate-rules')
    @RequirePermission('crm.settings.manage')
    @ApiOperation({ summary: 'Duplicate detection settings per record type' })
    rules(@CurrentOrg() ctx: OrgContext) {
        return this.duplicates.rules(ctx);
    }

    @Put('duplicate-rules')
    @RequirePermission('crm.settings.manage')
    @ApiOperation({ summary: 'Save the duplicate detection settings of one record type' })
    saveRule(@CurrentOrg() ctx: OrgContext, @Body(ZBody(DuplicateRuleSchema)) dto: DuplicateRuleInput) {
        return this.duplicates.saveRule(ctx, dto);
    }

    @Get('merge/preview')
    @RequireAnyPermission(...MERGE_ANY)
    @ApiOperation({ summary: 'Field-by-field comparison and counts of related records that will move' })
    preview(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(MergePreviewQuerySchema)) q: MergePreviewQuery) {
        return this.merges.preview(ctx, q);
    }

    @Post('merge')
    @RequireAnyPermission(...MERGE_ANY)
    @ApiOperation({ summary: 'Merge records into a survivor (irreversible; needs the entity merge key + update scope)' })
    merge(@CurrentOrg() ctx: OrgContext, @Body(ZBody(MergeSchema)) dto: MergeInput) {
        return this.merges.merge(ctx, dto);
    }
}
