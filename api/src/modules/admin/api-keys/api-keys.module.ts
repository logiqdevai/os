import { Module } from '@nestjs/common';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysMcp } from './api-keys.mcp';
import { AdminAccessService } from '../shared/admin-access.service';

@Module({
    controllers: [ApiKeysController],
    providers: [ApiKeysService, ApiKeysMcp, AdminAccessService],
})
export class ApiKeysModule { }
