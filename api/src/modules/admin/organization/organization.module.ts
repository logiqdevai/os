import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { OrganizationMcp } from './organization.mcp';

@Module({
    controllers: [OrganizationController],
    providers: [OrganizationService, OrganizationMcp],
})
export class OrganizationModule { }
