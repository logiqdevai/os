import { Module } from '@nestjs/common';
import { TasksModule } from '@/modules/tasks/tasks.module';
import { ProjectsController } from './controllers/projects.controller';
import { ProjectItemsController } from './controllers/project-items.controller';
import { ProjectSettingsController } from './controllers/project-settings.controller';
import { ProjectTimelineController } from './controllers/project-timeline.controller';
import { ProjectsService } from './services/projects.service';
import { ProjectItemsService } from './services/project-items.service';
import { ProjectSettingsService } from './services/project-settings.service';
import { ProjectTimelineService } from './services/project-timeline.service';
import { ProjectsMcp } from './projects.mcp';

/**
 * 05 Project Management. Other modules (tasks, time, billing, support, home) import this module and use
 * `ProjectsService.lookup / assertAccess / accessibleProjectIds / scopeWhere`.
 * Static paths (timeline) are registered before ProjectsController's `:id` routes.
 */
@Module({
    imports: [TasksModule],
    controllers: [ProjectSettingsController, ProjectTimelineController, ProjectsController, ProjectItemsController],
    providers: [ProjectsService, ProjectItemsService, ProjectSettingsService, ProjectTimelineService, ProjectsMcp],
    exports: [ProjectsService, ProjectItemsService, ProjectSettingsService],
})
export class ProjectsModule { }
