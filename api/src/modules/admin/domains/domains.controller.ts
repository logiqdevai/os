import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { AdminBody } from '../shared/zod-body.pipe';
import { DomainsService } from './domains.service';
import { CreateDomainInput, CreateDomainSchema, DomainQuery, DomainQuerySchema, UpdateDomainInput, UpdateDomainSchema } from './dto/domain.dto';

/** Verified email domains (01 §70). Every action needs organizations.domains.manage. */
@ApiTags('Admin · Domains')
@ApiBearerAuth()
@Controller('domains')
@UseGuards(JwtGuard, PermissionsGuard)
export class DomainsController {
    constructor(private readonly domains: DomainsService) { }

    @Get()
    @RequirePermission('organizations.domains.manage')
    @ApiOperation({ summary: 'List the organization’s domains' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(DomainQuerySchema)) query: DomainQuery) {
        return this.domains.findAll(ctx, query);
    }

    @Get(':id')
    @RequirePermission('organizations.domains.manage')
    @ApiOperation({ summary: 'Get one domain with its DNS record' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.domains.get(ctx, id);
    }

    @Post()
    @RequirePermission('organizations.domains.manage')
    @ApiOperation({ summary: 'Add a domain (returns the TXT record to publish)' })
    create(@CurrentOrg() ctx: OrgContext, @Body(AdminBody(CreateDomainSchema)) dto: CreateDomainInput) {
        return this.domains.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('organizations.domains.manage')
    @ApiOperation({ summary: 'Change discovery / auto-provision' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(AdminBody(UpdateDomainSchema)) dto: UpdateDomainInput) {
        return this.domains.update(ctx, id, dto);
    }

    @Post(':id/verify')
    @HttpCode(200)
    @RequirePermission('organizations.domains.manage')
    @ApiOperation({ summary: 'Check the DNS TXT record now' })
    verify(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.domains.verify(ctx, id);
    }

    @Delete(':id')
    @RequirePermission('organizations.domains.manage')
    @ApiOperation({ summary: 'Remove a domain' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.domains.remove(ctx, id);
    }
}
