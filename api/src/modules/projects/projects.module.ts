import { Module } from '@nestjs/common';
import { ProjectsController } from './controllers/projects.controller';
import { ProjectItemsController } from './controllers/project-items.controller';
import { ProjectSettingsController } from './controllers/project-settings.controller';
import { ProjectsService } from './services/projects.service';
import { ProjectItemsService } from './services/project-items.service';
import { ProjectSettingsService } from './services/project-settings.service';
import { ProjectsMcp } from './projects.mcp';

/**
 * 05 Project Management. Other modules (tasks, time, billing, support, home) import this module and use
 * `ProjectsService.lookup / assertAccess / accessibleProjectIds / scopeWhere`.
 */
@Module({
    controllers: [ProjectSettingsController, ProjectsController, ProjectItemsController],
    providers: [ProjectsService, ProjectItemsService, ProjectSettingsService, ProjectsMcp],
    exports: [ProjectsService, ProjectItemsService, ProjectSettingsService],
})
export class ProjectsModule { }
