import { Module } from '@nestjs/common';
import { TasksModule } from '@/modules/tasks/tasks.module';
import { AiIntegrationModule } from '@/integrations/ai/ai.module';
import { ProjectsController } from './controllers/projects.controller';
import { ProjectItemsController } from './controllers/project-items.controller';
import { ProjectSettingsController } from './controllers/project-settings.controller';
import { ProjectTimelineController } from './controllers/project-timeline.controller';
import { ProjectGovernanceController } from './controllers/project-governance.controller';
import { ProjectAiController } from './controllers/project-ai.controller';
import { ProjectsService } from './services/projects.service';
import { ProjectItemsService } from './services/project-items.service';
import { ProjectSettingsService } from './services/project-settings.service';
import { ProjectTimelineService } from './services/project-timeline.service';
import { ProjectGovernanceService } from './services/project-governance.service';
import { ProjectAiService } from './services/project-ai.service';
import { ProjectsMcp } from './projects.mcp';

/**
 * 05 Project Management. Other modules (tasks, time, billing, support, home) import this module and use
 * `ProjectsService.lookup / assertAccess / accessibleProjectIds / scopeWhere`.
 * Static paths (timeline) are registered before ProjectsController's `:id` routes.
 */
@Module({
    imports: [TasksModule, AiIntegrationModule],
    controllers: [ProjectSettingsController, ProjectTimelineController, ProjectsController, ProjectAiController, ProjectItemsController, ProjectGovernanceController],
    providers: [ProjectsService, ProjectItemsService, ProjectSettingsService, ProjectTimelineService, ProjectGovernanceService, ProjectAiService, ProjectsMcp],
    exports: [ProjectsService, ProjectItemsService, ProjectSettingsService, ProjectGovernanceService],
})
export class ProjectsModule { }
