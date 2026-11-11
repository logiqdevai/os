import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { RetentionService } from '../services/retention.service';
import { FoldersService } from '../services/folders.service';
import { CreateRetentionPolicyDto, DeletionQuery, DeletionQuerySchema, RejectDeletionDto, RequestDeletionDto, UpdateRetentionPolicyDto } from '../dto/retention.dto';
import { BigIntInterceptor } from '../utils/serialize.utils';

/** Retention policies, legal holds overview and permanent deletion requests (17 §13). */
@ApiTags('Files · Retention')
@ApiBearerAuth()
@Controller('files/retention')
@UseGuards(JwtGuard, PermissionsGuard)
@UseInterceptors(BigIntInterceptor)
export class RetentionController {
    constructor(
        private readonly retention: RetentionService,
        private readonly folders: FoldersService,
    ) { }

    @Get('policies')
    @RequirePermission('documents.retention.manage')
    @ApiOperation({ summary: 'Retention policies' })
    policies(@CurrentOrg() ctx: OrgContext) {
        return this.retention.listPolicies(ctx);
    }

    @Post('policies')
    @RequirePermission('documents.retention.manage')
    @ApiOperation({ summary: 'Create a retention policy' })
    createPolicy(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateRetentionPolicyDto) {
        return this.retention.createPolicy(ctx, dto);
    }

    @Patch('policies/:id')
    @RequirePermission('documents.retention.manage')
    @ApiOperation({ summary: 'Update a retention policy' })
    updatePolicy(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRetentionPolicyDto) {
        return this.retention.updatePolicy(ctx, id, dto);
    }

    @Post('policies/:id/archive')
    @RequirePermission('documents.retention.manage')
    @ApiOperation({ summary: 'Archive a retention policy' })
    archivePolicy(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.retention.archivePolicy(ctx, id);
    }

    @Get('holds')
    @RequireAnyPermission('documents.legal_hold.manage', 'documents.retention.manage')
    @ApiOperation({ summary: 'Documents and folders on legal hold' })
    holds(@CurrentOrg() ctx: OrgContext) {
        return this.folders.holds(ctx);
    }

    @Get('deletion-requests')
    @RequireAnyPermission('documents.deletions.approve', 'documents.documents.delete')
    @ApiOperation({ summary: 'Permanent deletion requests' })
    deletionRequests(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(DeletionQuerySchema)) query: DeletionQuery) {
        return this.retention.listDeletionRequests(ctx, query);
    }

    @Post('deletion-requests')
    @RequirePermission('documents.documents.delete')
    @ApiOperation({ summary: 'Request permanent deletion of a document in the trash' })
    requestDeletion(@CurrentOrg() ctx: OrgContext, @Body() dto: RequestDeletionDto) {
        return this.retention.requestPermanent(ctx, dto);
    }

    @Post('deletion-requests/:id/approve')
    @RequirePermission('documents.deletions.approve')
    @ApiOperation({ summary: 'Approve and execute a permanent deletion (a different person than the requester)' })
    approve(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.retention.approve(ctx, id);
    }

    @Post('deletion-requests/:id/reject')
    @RequirePermission('documents.deletions.approve')
    @ApiOperation({ summary: 'Reject a permanent deletion request' })
    reject(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectDeletionDto) {
        return this.retention.reject(ctx, id, dto.reason);
    }

    @Post('deletion-requests/:id/cancel')
    @RequirePermission('documents.documents.delete')
    @ApiOperation({ summary: 'Cancel my permanent deletion request' })
    cancel(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.retention.cancel(ctx, id);
    }
}
