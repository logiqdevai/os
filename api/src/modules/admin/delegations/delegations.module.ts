import { Module } from '@nestjs/common';
import { DelegationsController } from './delegations.controller';
import { DelegationsService } from './delegations.service';
import { DelegationsMcp } from './delegations.mcp';
import { AdminAccessService } from '../shared/admin-access.service';

@Module({
    controllers: [DelegationsController],
    providers: [DelegationsService, DelegationsMcp, AdminAccessService],
    exports: [DelegationsService],
})
export class DelegationsModule { }
