import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { P } from './common/people.utils';
import { EmployeesService } from './employees/employees.service';
import { CreateEmployeeSchema, UpdateEmployeeSchema } from './employees/dto/employee.dto';
import { DirectoryQuerySchema, EmployeeQuerySchema } from './employees/dto/employee-query.schema';
import { LeaveService } from './leave/leave.service';
import { LeaveBalanceQuerySchema, LeaveRequestQuerySchema, LeaveRequestSchema } from './leave/dto/leave.dto';
import { AttendanceService } from './attendance/attendance.service';
import { CapacityQuerySchema, CapacityService } from './capacity/capacity.service';
import { SkillSearchSchema, SkillsService } from './skills/skills.service';
import { PerformanceService } from './performance/performance.service';
import { GoalQuerySchema, ReviewQuerySchema } from './performance/performance.dto';
import { PeopleReportsService } from './reports/people-reports.service';

const id = z.object({ id: z.string().uuid() });
const decide = z.object({ id: z.string().uuid(), note: z.string().max(1000).optional() });

/** MCP adapter for module 10 — same service methods and validation as REST; tools are listed only to holders of the key. */
@Injectable()
export class PeopleMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly employees: EmployeesService,
        private readonly leave: LeaveService,
        private readonly attendance: AttendanceService,
        private readonly capacity: CapacityService,
        private readonly skills: SkillsService,
        private readonly performance: PerformanceService,
        private readonly reports: PeopleReportsService,
    ) { }

    onModuleInit() {
        const m = ModuleKey.EMPLOYEES;
        this.registry.registerMany([
            { name: 'employees_employees_list', description: 'List employees (HR view; search, status, department, branch, skill filters). Personal fields are stripped without the key.', permission: P.read, module: m, resource_type: 'employee', input: EmployeeQuerySchema, handler: (ctx, a) => this.employees.findAll(ctx, a) },
            { name: 'employees_employees_get', description: 'Get one employee profile (restricted_fields lists what the caller may not see).', permission: P.read, module: m, resource_type: 'employee', input: id, handler: (ctx, a) => this.employees.findOne(ctx, a.id) },
            { name: 'employees_employees_create', description: 'Create an employee record from an existing member (membership_id) or a new hire (email, first_name, last_name).', permission: P.create, module: m, resource_type: 'employee', input: CreateEmployeeSchema, handler: (ctx, a) => this.employees.create(ctx, a as any) },
            { name: 'employees_employees_update', description: 'Update job, department, manager, status or profile fields of an employee.', permission: P.update, module: m, resource_type: 'employee', input: UpdateEmployeeSchema, handler: (ctx, { id: employeeId, ...dto }) => this.employees.update(ctx, employeeId, dto as any) },
            { name: 'employees_directory_read', description: 'Search the company directory (name, title, department, availability, work contact).', permission: P.directoryRead, module: m, resource_type: 'employee', input: DirectoryQuerySchema, handler: (ctx, a) => this.employees.directory(ctx, a) },
            { name: 'employees_leave_list', description: 'List leave requests in scope (status, employee, dates; to_approve=true for the approval queue).', permission: P.leaveReadAll, module: m, resource_type: 'leave_request', input: LeaveRequestQuerySchema, handler: (ctx, a) => this.leave.list(ctx, a) },
            { name: 'employees_leave_my_requests', description: 'List my own leave requests.', permission: P.leaveReadOwn, module: m, resource_type: 'leave_request', input: LeaveRequestQuerySchema, handler: (ctx, a) => this.leave.list(ctx, { ...a, mine: true }) },
            { name: 'employees_leave_preview', description: 'Preview a leave request: working days, balance after, conflicts, warnings.', permission: P.leaveRequestOwn, module: m, resource_type: 'leave_request', input: LeaveRequestSchema, handler: (ctx, a) => this.leave.preview(ctx, a as any) },
            { name: 'employees_leave_request_create', description: 'Request leave for yourself (or for an employee with manage_balances). submit=false saves a draft.', permission: P.leaveRequestOwn, module: m, resource_type: 'leave_request', input: LeaveRequestSchema, handler: (ctx, a) => this.leave.create(ctx, a as any) },
            { name: 'employees_leave_approve', description: 'Approve a pending leave request (never your own).', permission: P.leaveApprove, module: m, resource_type: 'leave_request', sensitive: true, input: decide, handler: (ctx, a) => this.leave.approve(ctx, a.id, { note: a.note }) },
            { name: 'employees_leave_reject', description: 'Reject a pending leave request with a note.', permission: P.leaveApprove, module: m, resource_type: 'leave_request', sensitive: true, input: decide, handler: (ctx, a) => this.leave.reject(ctx, a.id, { note: a.note }) },
            { name: 'employees_leave_balances_read', description: 'Leave balances per employee and leave type (own, or all in scope).', permission: P.leaveReadOwn, module: m, resource_type: 'leave_balance', input: LeaveBalanceQuerySchema, handler: (ctx, a) => this.leave.balances(ctx, a) },
            { name: 'employees_attendance_clock_in', description: 'Clock in now.', permission: P.attRecordOwn, module: m, resource_type: 'attendance_record', input: z.object({ work_location: z.enum(['OFFICE', 'REMOTE', 'HYBRID', 'CLIENT_SITE', 'TRAVEL']).optional(), note: z.string().max(500).optional() }), handler: (ctx, a) => this.attendance.clockIn(ctx, { ...a, source: 'WEB' }) },
            { name: 'employees_attendance_clock_out', description: 'Clock out now.', permission: P.attRecordOwn, module: m, resource_type: 'attendance_record', input: z.object({ note: z.string().max(500).optional() }), handler: (ctx, a) => this.attendance.clockOut(ctx, a) },
            { name: 'employees_attendance_read', description: 'Who is in today (clocked in, on break, on leave, not in).', permission: P.attReadAll, module: m, resource_type: 'attendance_record', input: z.object({ date: z.string().date().optional(), team_id: z.string().uuid().optional() }), handler: (ctx, a) => this.attendance.board(ctx, a) },
            { name: 'employees_capacity_read', description: 'Weekly capacity per employee: available, planned and logged hours with status.', permission: P.capacity, module: m, resource_type: 'employee_capacity', input: CapacityQuerySchema, handler: (ctx, a) => this.capacity.weeks(ctx, a) },
            { name: 'employees_skills_search', description: 'Find people with given skills (skill_ids, min_proficiency, match all|any) for staffing.', permission: P.skillsRead, module: m, resource_type: 'skill', input: SkillSearchSchema, handler: (ctx, a) => this.skills.search(ctx, a) },
            { name: 'employees_performance_reviews_list', description: 'List performance reviews visible to the caller.', permission: P.perfReadAll, module: m, resource_type: 'performance_review', input: ReviewQuerySchema, handler: (ctx, a) => this.performance.reviews(ctx, a) },
            { name: 'employees_performance_goals_list', description: 'List goals and key results visible to the caller.', permission: P.perfReadOwn, module: m, resource_type: 'performance_goal', input: GoalQuerySchema, handler: (ctx, a) => this.performance.goals(ctx, a) },
            { name: 'employees_reports_read', description: 'People dashboard numbers (headcount, leave, attendance, capacity, performance) the caller may read.', permission: P.read, module: m, resource_type: 'employee', input: z.object({}), handler: (ctx) => this.reports.overview(ctx) },
        ]);
    }
}
