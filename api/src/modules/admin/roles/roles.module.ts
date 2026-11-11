import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { RolesMcp } from './roles.mcp';
import { AdminAccessService } from '../shared/admin-access.service';

@Module({
    controllers: [RolesController],
    providers: [RolesService, RolesMcp, AdminAccessService],
    exports: [RolesService],
})
export class RolesModule { }
