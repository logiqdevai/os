import { Module } from '@nestjs/common';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';
import { PermissionsMcp } from './permissions.mcp';
import { AdminAccessService } from '../shared/admin-access.service';

@Module({
    controllers: [PermissionsController],
    providers: [PermissionsService, PermissionsMcp, AdminAccessService],
})
export class PermissionsModule { }
