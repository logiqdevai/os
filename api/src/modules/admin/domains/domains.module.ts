import { Module } from '@nestjs/common';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';
import { DomainsMcp } from './domains.mcp';

@Module({
    controllers: [DomainsController],
    providers: [DomainsService, DomainsMcp],
    exports: [DomainsService],
})
export class DomainsModule { }
