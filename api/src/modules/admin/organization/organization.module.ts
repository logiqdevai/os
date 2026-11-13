import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { FilesModule } from '../../files/files.module';
import { OrganizationLogoService } from './organization-logo.service';
import { OrganizationMcp } from './organization.mcp';

@Module({
    imports: [FilesModule],
    controllers: [OrganizationController],
    providers: [OrganizationService, OrganizationLogoService, OrganizationMcp],
})
export class OrganizationModule { }
