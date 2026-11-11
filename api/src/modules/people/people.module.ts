import { Module } from '@nestjs/common';
import { NumberingModule } from '@/modules/numbering/numbering.module';
import { PeopleAccessService } from './common/people-access.service';
import { EmployeesController } from './employees/employees.controller';
import { EmployeesService } from './employees/employees.service';
import { EmployeeRecordsService } from './employees/employee-records.service';
import { LeaveController } from './leave/leave.controller';
import { LeaveService } from './leave/leave.service';
import { LeaveConfigService } from './leave/leave-config.service';
import { AttendanceController } from './attendance/attendance.controller';
import { AttendanceService } from './attendance/attendance.service';
import { CapacityService } from './capacity/capacity.service';
import { SkillsController } from './skills/skills.controller';
import { SkillsService } from './skills/skills.service';
import { PerformanceController } from './performance/performance.controller';
import { PerformanceService } from './performance/performance.service';
import { HrSettingsController, HrSettingsService } from './settings/hr-settings.controller';
import { PeopleReportsController } from './reports/people-reports.controller';
import { PeopleReportsService } from './reports/people-reports.service';
import { PeopleMcp } from './people.mcp';

/** 10 Employee Management (People / HR) — docs/features/10-employee-management-system.md. REST under /people/*. */
@Module({
    imports: [NumberingModule],
    controllers: [EmployeesController, LeaveController, AttendanceController, SkillsController, PerformanceController, HrSettingsController, PeopleReportsController],
    providers: [
        PeopleAccessService, EmployeesService, EmployeeRecordsService, LeaveService, LeaveConfigService, AttendanceService, CapacityService, SkillsService,
        PerformanceService, HrSettingsService, PeopleReportsService, PeopleMcp,
    ],
    exports: [PeopleAccessService, EmployeesService, LeaveService, CapacityService],
})
export class PeopleModule { }
