import { Module } from '@nestjs/common';
import { ServiceAccountsController } from './service-accounts.controller';
import { ServiceAccountsService } from './service-accounts.service';
import { ServiceAccountsMcp } from './service-accounts.mcp';
import { AdminAccessService } from '../shared/admin-access.service';

@Module({
    controllers: [ServiceAccountsController],
    providers: [ServiceAccountsService, ServiceAccountsMcp, AdminAccessService],
})
export class ServiceAccountsModule { }
