import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ApprovalPoliciesService } from './approval-policies.service';
import {
    ApprovalPolicyQuery, ApprovalPolicyQuerySchema, CreateApprovalPolicyInput, CreateApprovalPolicySchema, UpdateApprovalPolicyInput, UpdateApprovalPolicySchema,
} from './dto/approval-policy.dto';

/** 20 §4, §6 — reusable approval policies. Reading is open to workflow builders; changes need automation.approval_policies.manage. */
@ApiTags('Automation · Approval policies')
@ApiBearerAuth()
@Controller('automation/approval-policies')
@UseGuards(JwtGuard, PermissionsGuard)
export class ApprovalPoliciesController {
    constructor(private readonly policies: ApprovalPoliciesService) { }

    @Get()
    @RequirePermission('automation.rules.read')
    @ApiOperation({ summary: 'List approval policies' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ApprovalPolicyQuerySchema)) query: ApprovalPolicyQuery) {
        return this.policies.findAll(ctx, query);
    }

    @Post()
    @RequirePermission('automation.approval_policies.manage')
    @ApiOperation({ summary: 'Create an approval policy' })
    create(@CurrentOrg() ctx: OrgContext, @Body(new ZodValidationPipe(CreateApprovalPolicySchema)) dto: CreateApprovalPolicyInput) {
        return this.policies.create(ctx, dto);
    }

    @Get(':id')
    @RequirePermission('automation.rules.read')
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.policies.findOne(ctx, id);
    }

    @Patch(':id')
    @RequirePermission('automation.approval_policies.manage')
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(UpdateApprovalPolicySchema)) dto: UpdateApprovalPolicyInput) {
        return this.policies.update(ctx, id, dto);
    }

    @Post(':id/archive')
    @RequirePermission('automation.approval_policies.manage')
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.policies.setArchived(ctx, id, true);
    }

    @Post(':id/restore')
    @RequirePermission('automation.approval_policies.manage')
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.policies.setArchived(ctx, id, false);
    }
}
