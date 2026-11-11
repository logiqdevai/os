import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { ModuleKey, Prisma } from 'generated/prisma';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { AnalyticsQuery, AnalyticsQuerySchema, AnalyticsService } from './analytics.service';
import { CommProviderService } from '../delivery/comm-provider.service';

export class UpdateCommSettingsDto {
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() approval_required?: boolean;
    @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsInt() @Min(1) approval_min_recipients?: number | null;
    @ApiProperty({ required: false, example: '21:00' }) @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) quiet_hours_start?: string | null;
    @ApiProperty({ required: false, example: '08:00' }) @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) quiet_hours_end?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(1) max_marketing_per_week?: number | null;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) footer_address?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() double_opt_in_default?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(12) default_language?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(60) default_timezone?: string | null;
}

@ApiTags('Communications · Analytics & settings')
@ApiBearerAuth()
@Controller('communications')
@UseGuards(JwtGuard, PermissionsGuard)
export class AnalyticsController {
    constructor(
        private readonly analytics: AnalyticsService,
        private readonly providers: CommProviderService,
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    @Get('overview')
    @RequireAnyPermission('communications.campaigns.read', 'communications.messages.read')
    @ApiOperation({ summary: 'Campaigns overview: counts by status, upcoming, recent, provider status' })
    overview(@CurrentOrg() ctx: OrgContext) {
        return this.analytics.overview(ctx);
    }

    @Get('analytics/summary')
    @RequirePermission('communications.analytics.read')
    @ApiOperation({ summary: 'Totals, rates, previous period and daily series (from=YYYY-MM-DD&to=…&channel&kind&campaign_id)' })
    summary(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(AnalyticsQuerySchema)) query: AnalyticsQuery) {
        return this.analytics.summary(ctx, query);
    }

    @Get('provider-status')
    @RequireAnyPermission('communications.campaigns.read', 'communications.messages.read', 'communications.settings.manage', 'communications.sender_identities.manage')
    @ApiOperation({ summary: 'Email / SMS provider connection status (never secrets)' })
    providerStatus(@CurrentOrg() ctx: OrgContext) {
        return this.providers.status(ctx.organization_id);
    }

    @Get('settings')
    @RequireAnyPermission('communications.settings.manage', 'communications.campaigns.read')
    @ApiOperation({ summary: 'Organization communication policy (approval, quiet hours, footer)' })
    async settings(@CurrentOrg() ctx: OrgContext) {
        return (await this.prisma.commSettings.findUnique({ where: { organization_id: ctx.organization_id } })) ?? {
            organization_id: ctx.organization_id, approval_required: false, approval_min_recipients: null, quiet_hours_start: null, quiet_hours_end: null,
            max_marketing_per_week: null, footer_address: null, double_opt_in_default: true, retention_days_bodies: null, retention_days_event_pii: null, default_language: null, default_timezone: null,
        };
    }

    @Patch('settings')
    @RequirePermission('communications.settings.manage')
    @ApiOperation({ summary: 'Update the communication policy' })
    async updateSettings(@CurrentOrg() ctx: OrgContext, @Body() dto: UpdateCommSettingsDto) {
        const before = await this.prisma.commSettings.findUnique({ where: { organization_id: ctx.organization_id } });
        const data = { ...dto, updated_by_membership_id: ctx.membership_id } as Prisma.CommSettingsUncheckedUpdateInput;
        const row = await this.prisma.commSettings.upsert({
            where: { organization_id: ctx.organization_id },
            update: data,
            create: { ...(data as Prisma.CommSettingsUncheckedCreateInput), organization_id: ctx.organization_id },
        });
        await this.audit.record(ctx, 'communications.settings.updated', { resource_type: 'comm_settings', resource_id: ctx.organization_id, metadata: { before, after: dto, sensitive: true } });
        this.events.publish(ctx, { event_key: 'communications.settings.updated', module: ModuleKey.COMMUNICATION, entity_kind: 'comm_settings', entity_id: ctx.organization_id, payload: {}, changes: dto as Record<string, unknown> });
        return row;
    }
}
