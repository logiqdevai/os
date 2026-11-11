import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { BranchesService } from './branches.service';
import { BranchQuery, BranchQuerySchema, CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

@ApiTags('Admin · Branches')
@ApiBearerAuth()
@Controller('branches')
@UseGuards(JwtGuard, PermissionsGuard)
export class BranchesController {
    constructor(private readonly branches: BranchesService) { }

    @Get()
    @RequirePermission('organizations.branches.read')
    @ApiOperation({ summary: 'List branches (flat; build the tree from parent_branch_id / depth)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(BranchQuerySchema)) query: BranchQuery) {
        return this.branches.findAll(ctx, query);
    }

    @Get(':id')
    @RequirePermission('organizations.branches.read')
    @ApiOperation({ summary: 'Branch detail with children, managers, members and teams' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.branches.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('organizations.branches.manage')
    @ApiOperation({ summary: 'Create a branch' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateBranchDto) {
        return this.branches.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('organizations.branches.manage')
    @ApiOperation({ summary: 'Update a branch (moving it re-roots its children)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBranchDto) {
        return this.branches.update(ctx, id, dto);
    }

    @Post(':id/archive')
    @HttpCode(200)
    @RequirePermission('organizations.branches.manage')
    @ApiOperation({ summary: 'Archive a branch' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.branches.archive(ctx, id);
    }

    @Post(':id/restore')
    @HttpCode(200)
    @RequirePermission('organizations.branches.manage')
    @ApiOperation({ summary: 'Restore an archived branch' })
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.branches.restore(ctx, id);
    }
}
