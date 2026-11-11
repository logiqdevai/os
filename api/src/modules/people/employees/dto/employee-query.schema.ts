import { z } from 'zod';
import { EmployeeAvailabilityStatus, EmployeeWorkLocation, EmploymentStatus, EmploymentType, SkillProficiency } from 'generated/prisma';
import { BaseListQuerySchema, boolish, csv } from '@/shared/utils/pagination/pagination.utils';

export const EmployeeQuerySchema = BaseListQuerySchema.extend({
    status: csv(z.nativeEnum(EmploymentStatus)),
    employment_type: z.nativeEnum(EmploymentType).optional(),
    department_team_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
    manager_employee_id: z.string().uuid().optional(),
    availability: z.nativeEnum(EmployeeAvailabilityStatus).optional(),
    work_location: z.nativeEnum(EmployeeWorkLocation).optional(),
    skill_id: z.string().uuid().optional(),
    min_proficiency: z.nativeEnum(SkillProficiency).optional(),
    archived: boolish,
});
export type EmployeeQuery = z.infer<typeof EmployeeQuerySchema>;

export const DirectoryQuerySchema = BaseListQuerySchema.extend({
    department_team_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
    skill_id: z.string().uuid().optional(),
    availability: z.nativeEnum(EmployeeAvailabilityStatus).optional(),
});
export type DirectoryQuery = z.infer<typeof DirectoryQuerySchema>;

export const ChangeRequestQuerySchema = BaseListQuerySchema.extend({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
    employee_id: z.string().uuid().optional(),
});
export type ChangeRequestQuery = z.infer<typeof ChangeRequestQuerySchema>;
