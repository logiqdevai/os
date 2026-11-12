import { Module } from '@nestjs/common';
import { AiIntegrationModule } from '@/integrations/ai/ai.module';
import { TasksController } from './controllers/tasks.controller';
import { CyclesController, ReleasesController, TaskConfigController } from './controllers/task-planning.controller';
import { TasksService } from './services/tasks.service';
import { TaskDetailsService } from './services/task-details.service';
import { TaskConfigService } from './services/task-config.service';
import { CyclesService } from './services/cycles.service';
import { ReleasesService } from './services/releases.service';
import { TasksMcp } from './tasks.mcp';
import { TaskReportsController } from './controllers/task-reports.controller';
import { TaskReportsService } from './services/task-reports.service';
import { ReleaseNotesController } from './controllers/release-notes.controller';
import { ReleaseNotesService } from './services/release-notes.service';

/**
 * 06 Task Management. Other modules import this module and use `TasksService.lookup / assertAccess / scopeWhere / create`.
 */
@Module({
    imports: [AiIntegrationModule],
    controllers: [TaskConfigController, CyclesController, ReleasesController, ReleaseNotesController, TaskReportsController, TasksController],
    providers: [TasksService, TaskDetailsService, TaskConfigService, CyclesService, ReleasesService, TaskReportsService, ReleaseNotesService, TasksMcp],
    exports: [TasksService, TaskDetailsService, TaskConfigService],
})
export class TasksModule { }
