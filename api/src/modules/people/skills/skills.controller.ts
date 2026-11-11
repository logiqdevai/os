import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { P } from '../common/people.utils';
import {
    CertificationDto, EmployeeSkillDto, SkillDto, SkillQuery, SkillQuerySchema, SkillSearch, SkillSearchSchema, SkillsService, UpdateEmployeeSkillDto, UpdateSkillDto,
} from './skills.service';

const uuid = new ParseUUIDPipe();

@ApiTags('People · Skills')
@ApiBearerAuth()
@Controller('people')
@UseGuards(JwtGuard, PermissionsGuard)
export class SkillsController {
    constructor(private readonly skills: SkillsService) { }

    @Get('skills')
    @RequireAnyPermission(P.skillsRead, P.profileOwn)
    @ApiOperation({ summary: 'Skill catalogue' })
    list(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(SkillQuerySchema)) query: SkillQuery) {
        return this.skills.list(ctx, query);
    }

    @Get('skills/search')
    @RequirePermission(P.skillsRead)
    @ApiOperation({ summary: 'Find people by skills (all-of / any-of, minimum proficiency)' })
    search(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(SkillSearchSchema)) query: SkillSearch) {
        return this.skills.search(ctx, query);
    }

    @Post('skills')
    @RequirePermission(P.skillsManage)
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: SkillDto) {
        return this.skills.create(ctx, dto);
    }

    @Patch('skills/:id')
    @RequirePermission(P.skillsManage)
    update(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: UpdateSkillDto) {
        return this.skills.update(ctx, id, dto);
    }

    @Post('skills/:id/archive')
    @RequirePermission(P.skillsManage)
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.skills.archive(ctx, id, true);
    }

    @Post('skills/:id/restore')
    @RequirePermission(P.skillsManage)
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.skills.archive(ctx, id, false);
    }

    @Get('employees/:id/skills')
    @RequireAnyPermission(P.skillsRead, P.profileOwn)
    employeeSkills(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.skills.employeeSkills(ctx, id);
    }

    @Post('employees/:id/skills')
    @RequireAnyPermission(P.skillsManage, P.profileOwn)
    assign(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: EmployeeSkillDto) {
        return this.skills.assign(ctx, id, dto);
    }

    @Patch('employee-skills/:id')
    @RequireAnyPermission(P.skillsManage, P.profileOwn)
    updateEmployeeSkill(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: UpdateEmployeeSkillDto) {
        return this.skills.updateEmployeeSkill(ctx, id, dto);
    }

    @Delete('employee-skills/:id')
    @RequireAnyPermission(P.skillsManage, P.profileOwn)
    removeEmployeeSkill(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.skills.removeEmployeeSkill(ctx, id);
    }

    @Post('employee-skills/:id/verify')
    @RequirePermission(P.skillsManage)
    verify(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.skills.verify(ctx, id);
    }

    @Post('employees/:id/certifications')
    @RequireAnyPermission(P.skillsManage, P.profileOwn)
    addCertification(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: CertificationDto) {
        return this.skills.addCertification(ctx, id, dto);
    }

    @Delete('certifications/:id')
    @RequireAnyPermission(P.skillsManage, P.profileOwn)
    removeCertification(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.skills.removeCertification(ctx, id);
    }
}
