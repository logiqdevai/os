import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyQuery, ApiKeyQuerySchema, CreateApiKeyDto } from './dto/api-key.dto';

@ApiTags('Admin · API keys')
@ApiBearerAuth()
@Controller('api-keys')
@UseGuards(JwtGuard, PermissionsGuard)
export class ApiKeysController {
    constructor(private readonly keys: ApiKeysService) { }

    @Get()
    @RequirePermission('organizations.api_keys.manage')
    @ApiOperation({ summary: 'List API keys (never returns secrets)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ApiKeyQuerySchema)) query: ApiKeyQuery) {
        return this.keys.findAll(ctx, query);
    }

    @Get(':id')
    @RequirePermission('organizations.api_keys.manage')
    @ApiOperation({ summary: 'API key detail' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.keys.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('organizations.api_keys.manage')
    @ApiOperation({ summary: 'Create an API key — the secret is returned once' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateApiKeyDto) {
        return this.keys.create(ctx, dto);
    }

    @Post(':id/rotate')
    @HttpCode(200)
    @RequirePermission('organizations.api_keys.manage')
    @ApiOperation({ summary: 'Replace the key (old one revoked) — the new secret is returned once' })
    rotate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.keys.rotate(ctx, id);
    }

    @Post(':id/revoke')
    @HttpCode(200)
    @RequirePermission('organizations.api_keys.manage')
    @ApiOperation({ summary: 'Revoke an API key' })
    revoke(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.keys.revoke(ctx, id);
    }
}
