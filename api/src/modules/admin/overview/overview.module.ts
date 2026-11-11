import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { OverviewService } from './overview.service';

@ApiTags('Admin · Overview')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtGuard, PermissionsGuard)
export class OverviewController {
    constructor(private readonly overview: OverviewService) { }

    @Get('overview')
    @RequireAnyPermission('users.members.read', 'organizations.audit.read', 'organizations.settings.manage', 'users.roles.read', 'organizations.teams.read', 'organizations.branches.read')
    @ApiOperation({ summary: 'Admin overview: counts, security posture, developer access, recent sensitive events' })
    get(@CurrentOrg() ctx: OrgContext) {
        return this.overview.get(ctx);
    }
}

@Module({
    controllers: [OverviewController],
    providers: [OverviewService],
})
export class OverviewModule { }
