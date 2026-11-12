import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { AdminBody } from '../shared/zod-body.pipe';
import { SecurityPolicyService } from './security-policy.service';
import { UpdateSecurityPolicyInput, UpdateSecurityPolicySchema } from './dto/security-policy.dto';

/** Organization security policy (01 §72–74). Manage-only screen: there is no read-only variant. */
@ApiTags('Admin · Security policy')
@ApiBearerAuth()
@Controller('security-policy')
@UseGuards(JwtGuard, PermissionsGuard)
export class SecurityPolicyController {
    constructor(private readonly policy: SecurityPolicyService) { }

    @Get()
    @RequirePermission('organizations.security.manage')
    @ApiOperation({ summary: 'Get the security policy (defaults when never saved)' })
    get(@CurrentOrg() ctx: OrgContext) {
        return this.policy.get(ctx);
    }

    @Patch()
    @RequirePermission('organizations.security.manage')
    @ApiOperation({ summary: 'Update the security policy (partial)' })
    update(@CurrentOrg() ctx: OrgContext, @Body(AdminBody(UpdateSecurityPolicySchema)) dto: UpdateSecurityPolicyInput) {
        return this.policy.update(ctx, dto);
    }
}
