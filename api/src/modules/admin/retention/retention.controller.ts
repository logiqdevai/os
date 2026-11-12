import { Body, Controller, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { OrganizationRetentionDataClass } from 'generated/prisma';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { AdminBody } from '../shared/zod-body.pipe';
import { RetentionService } from './retention.service';
import { DataClassParamSchema, UpdateRetentionPolicyInput, UpdateRetentionPolicySchema } from './dto/retention.dto';

const KEY = 'organizations.retention.manage';
export const LegalHoldSchema = z.object({ enabled: z.boolean(), reason: z.string().trim().max(500).nullable().optional() }).strict();

/** Platform data retention + legal hold (01 §134). */
@ApiTags('Admin · Data retention')
@ApiBearerAuth()
@Controller('retention-policies')
@UseGuards(JwtGuard, PermissionsGuard)
export class RetentionController {
    constructor(private readonly retention: RetentionService) { }

    @Get()
    @RequirePermission(KEY)
    @ApiOperation({ summary: 'Policies for every platform data class (defaults when never saved) with an eligible-rows preview' })
    findAll(@CurrentOrg() ctx: OrgContext) {
        return this.retention.findAll(ctx);
    }

    @Put(':dataClass')
    @RequirePermission(KEY)
    @ApiOperation({ summary: 'Set the retention period / action / legal hold of one data class' })
    update(@CurrentOrg() ctx: OrgContext, @Param('dataClass', new ZodValidationPipe(DataClassParamSchema)) dataClass: OrganizationRetentionDataClass, @Body(AdminBody(UpdateRetentionPolicySchema)) dto: UpdateRetentionPolicyInput) {
        return this.retention.update(ctx, dataClass, dto);
    }

    @Post('legal-hold')
    @HttpCode(200)
    @RequirePermission(KEY)
    @ApiOperation({ summary: 'Suspend (or resume) every purge for the organization' })
    legalHold(@CurrentOrg() ctx: OrgContext, @Body(AdminBody(LegalHoldSchema)) dto: z.infer<typeof LegalHoldSchema>) {
        return this.retention.setLegalHold(ctx, dto.enabled, dto.reason);
    }

    @Post('run')
    @HttpCode(200)
    @RequirePermission(KEY)
    @ApiOperation({ summary: 'Apply the policies now (normally daily at 03:00)' })
    run(@CurrentOrg() ctx: OrgContext) {
        return this.retention.runNow(ctx);
    }
}
