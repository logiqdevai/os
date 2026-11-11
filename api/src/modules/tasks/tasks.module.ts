import { Module } from '@nestjs/common';
import { TasksController } from './controllers/tasks.controller';
import { CyclesController, ReleasesController, TaskConfigController } from './controllers/task-planning.controller';
import { TasksService } from './services/tasks.service';
import { TaskDetailsService } from './services/task-details.service';
import { TaskConfigService } from './services/task-config.service';
import { CyclesService } from './services/cycles.service';
import { ReleasesService } from './services/releases.service';
import { TasksMcp } from './tasks.mcp';

/**
 * 06 Task Management. Other modules import this module and use `TasksService.lookup / assertAccess / scopeWhere / create`.
 */
@Module({
    controllers: [TaskConfigController, CyclesController, ReleasesController, TasksController],
    providers: [TasksService, TaskDetailsService, TaskConfigService, CyclesService, ReleasesService, TasksMcp],
    exports: [TasksService, TaskDetailsService, TaskConfigService],
})
export class TasksModule { }
