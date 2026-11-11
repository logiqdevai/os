import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ApprovalsService } from '../services/approvals.service';
import { ApprovalDecisionDto, ApprovalQuery, ApprovalQuerySchema, CreateApprovalDto } from '../dto/approvals.dto';
import { BigIntInterceptor } from '../utils/serialize.utils';

/** Document approvals bound to a version (17 §10). */
@ApiTags('Files · Approvals')
@ApiBearerAuth()
@Controller('files/approvals')
@UseGuards(JwtGuard, PermissionsGuard)
@UseInterceptors(BigIntInterceptor)
export class ApprovalsController {
    constructor(private readonly approvals: ApprovalsService) { }

    @Get()
    @RequirePermission('documents.documents.read')
    @ApiOperation({ summary: 'List approvals (mine = waiting for my decision, requested = asked by me)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ApprovalQuerySchema)) query: ApprovalQuery) {
        return this.approvals.findAll(ctx, query);
    }

    @Get(':id')
    @RequirePermission('documents.documents.read')
    @ApiOperation({ summary: 'Get an approval request' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.approvals.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('documents.documents.approve')
    @ApiOperation({ summary: 'Request approval of a document version' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateApprovalDto) {
        return this.approvals.create(ctx, dto);
    }

    @Post(':id/decision')
    @RequirePermission('documents.documents.approve')
    @ApiOperation({ summary: 'Approve, reject or request changes (as an approver)' })
    decide(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ApprovalDecisionDto) {
        return this.approvals.decide(ctx, id, dto);
    }

    @Post(':id/cancel')
    @RequirePermission('documents.documents.approve')
    @ApiOperation({ summary: 'Cancel a pending approval' })
    cancel(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.approvals.cancel(ctx, id);
    }
}
