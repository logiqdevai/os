import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZBody } from '@/modules/finance-shared/zod-body.pipe';
import { BulkActionInput, BulkActionSchema, CrmBulkService } from './bulk.service';

const ANY = ['companies', 'contacts', 'leads', 'deals'].flatMap((r) => [`crm.${r}.update`, `crm.${r}.assign`, `crm.${r}.archive`]).concat('crm.deals.change_stage');

/** 02 §20, §29 — bulk actions from list selections (assign, tag, status/stage, lifecycle, archive). */
@ApiTags('CRM · Bulk actions')
@ApiBearerAuth()
@Controller('crm/bulk')
@UseGuards(JwtGuard, PermissionsGuard)
export class CrmBulkController {
    constructor(private readonly bulk: CrmBulkService) { }

    @Post()
    @RequireAnyPermission(...ANY)
    @ApiOperation({ summary: 'Run one action on up to 200 records; each record is checked for permission and scope (partial success)' })
    run(@CurrentOrg() ctx: OrgContext, @Body(ZBody(BulkActionSchema)) dto: BulkActionInput) {
        return this.bulk.run(ctx, dto);
    }
}
