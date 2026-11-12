import { Module } from '@nestjs/common';
import { SsoController } from './sso.controller';
import { SsoService } from './sso.service';
import { SsoMcp } from './sso.mcp';
import { AdminAccessService } from '../shared/admin-access.service';

@Module({
    controllers: [SsoController],
    providers: [SsoService, SsoMcp, AdminAccessService],
    exports: [SsoService],
})
export class SsoModule { }
