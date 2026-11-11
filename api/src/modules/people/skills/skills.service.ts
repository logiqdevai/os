import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUrl, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ModuleKey, Prisma, SkillCategory, SkillProficiency } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { BaseListQuerySchema, boolish, csv, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import { PeopleAccessService } from '../common/people-access.service';
import { P, dates, defined, personName, userSelect } from '../common/people.utils';

// ------------------------------------------------------------ DTOs

export class SkillDto {
    @ApiProperty({ example: 'React' }) @IsString() @MinLength(1) @MaxLength(80) name: string;
    @ApiPropertyOptional({ enum: SkillCategory }) @IsOptional() @IsEnum(SkillCategory) category?: SkillCategory;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() parent_skill_id?: string;
}
export class UpdateSkillDto extends PartialType(SkillDto) { }

export class EmployeeSkillDto {
    @ApiProperty() @IsUUID() skill_id: string;
    @ApiPropertyOptional({ enum: SkillProficiency }) @IsOptional() @IsEnum(SkillProficiency) proficiency?: SkillProficiency;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(60) years_experience?: number;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() is_primary?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsDateString() last_used_on?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
export class UpdateEmployeeSkillDto extends PartialType(EmployeeSkillDto) { }

export class CertificationDto {
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(160) name: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() skill_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) issuer?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) credential_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsUrl() credential_url?: string;
    @ApiPropertyOptional() @IsOptional() @IsDateString() issued_on?: string;
    @ApiPropertyOptional() @IsOptional() @IsDateString() expires_on?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export const SkillQuerySchema = BaseListQuerySchema.extend({ category: z.nativeEnum(SkillCategory).optional(), archived: boolish });
export type SkillQuery = z.infer<typeof SkillQuerySchema>;

/** "Find people": every listed skill at a minimum proficiency (all-of), optionally only available people. */
export const SkillSearchSchema = BaseListQuerySchema.extend({
    skill_ids: csv(z.string().uuid()),
    min_proficiency: z.nativeEnum(SkillProficiency).optional(),
    match: z.enum(['all', 'any']).optional().default('all'),
});
export type SkillSearch = z.infer<typeof SkillSearchSchema>;

const LEVELS: SkillProficiency[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];

/** 10 "Skills Management" — the skill catalogue, skills per employee (self-declared or HR-verified) and certifications. */
@Injectable()
export class SkillsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: PeopleAccessService,
    ) { }

    async list(ctx: OrgContext, query: SkillQuery) {
        const where: Prisma.SkillWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(query.category && { category: query.category }),
            ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.skill.findMany({
                where, ...skipTake(query), orderBy: { name: 'asc' },
                include: { _count: { select: { employees: { where: { employee: { archived_at: null } } } } }, parent: { select: { id: true, name: true } } },
            }),
            this.prisma.skill.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async create(ctx: OrgContext, dto: SkillDto) {
        const slug = slugify(dto.name);
        if (await this.prisma.skill.count({ where: { organization_id: ctx.organization_id, slug } })) throw new ConflictException({ message: 'This skill already exists', code: 'skill_exists' });
        const row = await this.prisma.skill.create({ data: { ...dto, slug, organization_id: ctx.organization_id } });
        await this.audit.record(ctx, 'skill.created', { resource_type: 'skill', resource_id: row.id, metadata: { after: dto } });
        this.events.publish(ctx, { event_key: 'employees.skill.created', module: ModuleKey.EMPLOYEES, entity_kind: 'skill', entity_id: row.id, payload: { name: row.name } });
        return row;
    }

    async update(ctx: OrgContext, id: string, dto: UpdateSkillDto) {
        await this.skill(ctx, id);
        const row = await this.prisma.skill.update({ where: { id }, data: { ...defined(dto), ...(dto.name && { slug: slugify(dto.name) }) } }).catch((e) => {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ message: 'This skill already exists', code: 'skill_exists' });
            throw e;
        });
        await this.audit.record(ctx, 'skill.updated', { resource_type: 'skill', resource_id: id, metadata: { after: dto } });
        return row;
    }

    async archive(ctx: OrgContext, id: string, archived: boolean) {
        await this.skill(ctx, id);
        const row = await this.prisma.skill.update({ where: { id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'skill.archived' : 'skill.restored', { resource_type: 'skill', resource_id: id });
        return row;
    }

    /** Staffing search: employees holding the skills at the minimum level, with their skill rows. */
    async search(ctx: OrgContext, query: SkillSearch) {
        const ids = query.skill_ids ?? [];
        const levels = LEVELS.slice(LEVELS.indexOf(query.min_proficiency ?? 'BEGINNER'));
        const skillFilter = (skill_id: string): Prisma.EmployeeWhereInput => ({ skills: { some: { skill_id, proficiency: { in: levels } } } });
        const where: Prisma.EmployeeWhereInput = {
            organization_id: ctx.organization_id, archived_at: null, employment_status: { not: 'TERMINATED' },
            ...(ids.length && (query.match === 'any' ? { OR: ids.map(skillFilter) } : { AND: ids.map(skillFilter) })),
            ...(query.search && { OR: [{ preferred_name: { contains: query.search, mode: 'insensitive' } }, { job_title: { contains: query.search, mode: 'insensitive' } }, { membership: { user: { OR: [{ first_name: { contains: query.search, mode: 'insensitive' } }, { last_name: { contains: query.search, mode: 'insensitive' } }] } } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.employee.findMany({
                where, ...skipTake(query), orderBy: { preferred_name: 'asc' },
                include: {
                    membership: { select: { user: { select: userSelect } } },
                    department: { select: { id: true, name: true } },
                    skills: { include: { skill: { select: { id: true, name: true, category: true } } }, orderBy: [{ is_primary: 'desc' }, { proficiency: 'desc' }] },
                    certifications: { select: { id: true, name: true, expires_on: true } },
                },
            }),
            this.prisma.employee.count({ where }),
        ]);
        return paginate(items.map((e) => ({
            id: e.id, name: personName(e), photo_url: e.membership.user.profile_photo_url, job_title: e.job_title, department: e.department,
            availability_status: e.availability_status, skills: e.skills, certifications: e.certifications,
            matched: e.skills.filter((s) => ids.includes(s.skill_id)).map((s) => ({ skill_id: s.skill_id, proficiency: s.proficiency })),
        })), total, query);
    }

    // ------------------------------------------------------------ employee skills

    async employeeSkills(ctx: OrgContext, employeeId: string) {
        await this.employee(ctx, employeeId, P.skillsRead, true);
        const [skills, certifications] = await Promise.all([
            this.prisma.employeeSkill.findMany({ where: { employee_id: employeeId }, include: { skill: true }, orderBy: [{ is_primary: 'desc' }, { proficiency: 'desc' }] }),
            this.prisma.employeeCertification.findMany({ where: { employee_id: employeeId }, include: { skill: { select: { id: true, name: true } } }, orderBy: { issued_on: 'desc' } }),
        ]);
        return { skills, certifications };
    }

    /** HR (skills.manage) or the employee (profile.update_own) — self-declared skills are unverified. */
    async assign(ctx: OrgContext, employeeId: string, dto: EmployeeSkillDto) {
        const e = await this.employee(ctx, employeeId, P.skillsManage, ctx.can(P.profileOwn));
        await this.skill(ctx, dto.skill_id);
        const own = this.access.isOwn(ctx, e);
        const row = await this.prisma.employeeSkill.upsert({
            where: { employee_id_skill_id: { employee_id: e.id, skill_id: dto.skill_id } },
            update: { ...(dates(defined(dto), ['last_used_on']) as any), ...(own && { verified_at: null, verified_by_membership_id: null }) },
            create: { ...(dates(dto, ['last_used_on']) as any), employee_id: e.id },
            include: { skill: true },
        });
        await this.audit.record(ctx, 'employee_skill.assigned', { resource_type: 'employee', resource_id: e.id, metadata: { skill_id: dto.skill_id, proficiency: row.proficiency, self: own } });
        this.events.publish(ctx, { event_key: 'employees.skill.assigned', module: ModuleKey.EMPLOYEES, entity_kind: 'employee_skill', entity_id: row.id, payload: { employee_id: e.id, owner_membership_id: e.membership_id, skill: row.skill.name, proficiency: row.proficiency } });
        return row;
    }

    async updateEmployeeSkill(ctx: OrgContext, employeeSkillId: string, dto: UpdateEmployeeSkillDto) {
        const es = await this.employeeSkill(ctx, employeeSkillId);
        const e = await this.employee(ctx, es.employee_id, P.skillsManage, ctx.can(P.profileOwn));
        const own = this.access.isOwn(ctx, e);
        const { skill_id: _ignored, ...rest } = dto;
        const row = await this.prisma.employeeSkill.update({ where: { id: employeeSkillId }, data: { ...(dates(defined(rest), ['last_used_on']) as any), ...(own && { verified_at: null, verified_by_membership_id: null }) }, include: { skill: true } });
        await this.audit.record(ctx, 'employee_skill.updated', { resource_type: 'employee', resource_id: e.id, metadata: { employee_skill_id: employeeSkillId, after: rest } });
        return row;
    }

    async removeEmployeeSkill(ctx: OrgContext, employeeSkillId: string) {
        const es = await this.employeeSkill(ctx, employeeSkillId);
        const e = await this.employee(ctx, es.employee_id, P.skillsManage, ctx.can(P.profileOwn));
        await this.prisma.employeeSkill.delete({ where: { id: employeeSkillId } });
        await this.audit.record(ctx, 'employee_skill.removed', { resource_type: 'employee', resource_id: e.id, metadata: { skill_id: es.skill_id } });
        return { success: true };
    }

    async verify(ctx: OrgContext, employeeSkillId: string) {
        const es = await this.employeeSkill(ctx, employeeSkillId);
        const e = await this.employee(ctx, es.employee_id, P.skillsManage);
        if (this.access.isOwn(ctx, e)) throw new ConflictException({ message: 'You cannot verify your own skill', code: 'self_verification' });
        const row = await this.prisma.employeeSkill.update({ where: { id: employeeSkillId }, data: { verified_at: new Date(), verified_by_membership_id: ctx.membership_id }, include: { skill: true } });
        await this.audit.record(ctx, 'employee_skill.verified', { resource_type: 'employee', resource_id: e.id, metadata: { skill_id: es.skill_id } });
        return row;
    }

    async addCertification(ctx: OrgContext, employeeId: string, dto: CertificationDto) {
        const e = await this.employee(ctx, employeeId, P.skillsManage, ctx.can(P.profileOwn));
        if (dto.skill_id) await this.skill(ctx, dto.skill_id);
        const row = await this.prisma.employeeCertification.create({ data: { ...(dates(dto, ['issued_on', 'expires_on']) as any), employee_id: e.id } });
        await this.audit.record(ctx, 'employee_certification.added', { resource_type: 'employee', resource_id: e.id, metadata: { certification_id: row.id, name: row.name } });
        return row;
    }

    async removeCertification(ctx: OrgContext, certificationId: string) {
        const c = await this.prisma.employeeCertification.findFirst({ where: { id: certificationId, employee: { organization_id: ctx.organization_id } } });
        if (!c) throw new NotFoundException({ message: 'Certification not found', code: 'certification_not_found' });
        const e = await this.employee(ctx, c.employee_id, P.skillsManage, ctx.can(P.profileOwn));
        await this.prisma.employeeCertification.delete({ where: { id: certificationId } });
        await this.audit.record(ctx, 'employee_certification.removed', { resource_type: 'employee', resource_id: e.id, metadata: { certification_id: certificationId } });
        return { success: true };
    }

    // ------------------------------------------------------------ helpers

    private async skill(ctx: OrgContext, id: string) {
        const s = await this.prisma.skill.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!s) throw new NotFoundException({ message: 'Skill not found', code: 'skill_not_found' });
        return s;
    }

    private async employeeSkill(ctx: OrgContext, id: string) {
        const es = await this.prisma.employeeSkill.findFirst({ where: { id, employee: { organization_id: ctx.organization_id } } });
        if (!es) throw new NotFoundException({ message: 'Skill not found', code: 'employee_skill_not_found' });
        return es;
    }

    /** Skills of the org are visible to skills.read (organization-wide catalogue); writes need the scoped manage key or own record. */
    private async employee(ctx: OrgContext, id: string, key: string, allowOwn = false) {
        const e = await this.prisma.employee.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!e) throw new NotFoundException({ message: 'Employee not found', code: 'employee_not_found' });
        if (allowOwn && this.access.isOwn(ctx, e)) return e;
        const scope = this.access.scopeWhere(ctx, key);
        if (!scope || !(await this.prisma.employee.count({ where: { id, ...scope } }))) throw new NotFoundException({ message: 'Employee not found', code: 'employee_not_found' });
        return e;
    }
}
