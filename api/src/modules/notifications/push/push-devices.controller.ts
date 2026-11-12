import { Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ZodBodyPipe } from '@/modules/finance-shared/zod-body.pipe';
import { MyDigestQuery, MyDigestQuerySchema, RegisterPushDeviceInput, RegisterPushDeviceSchema } from '../dto/notification-device.dto';
import { PushDevicesService } from './push-devices.service';

const PREFS = 'notifications.preferences.manage_own';

/**
 * 14 §5 — my push devices (mockup 14 "Devices", /notifications/preferences/devices). Own rows only: other users' devices are 404.
 * Registered before the inbox controller so `/notifications/devices` never hits `/notifications/:id`.
 */
@ApiTags('Notifications · Devices')
@ApiBearerAuth()
@Controller('notifications/devices')
@UseGuards(JwtGuard, PermissionsGuard)
export class NotificationDevicesController {
    constructor(private readonly devices: PushDevicesService) { }

    @Get('push-config')
    @RequirePermission(PREFS)
    @ApiOperation({ summary: 'Web Push public key (VAPID applicationServerKey) and whether the organization enabled push' })
    config(@CurrentOrg() ctx: OrgContext) {
        return this.devices.config(ctx);
    }

    @Get()
    @RequirePermission(PREFS)
    @ApiOperation({ summary: 'My registered push devices (tokens are never returned)' })
    list(@CurrentOrg() ctx: OrgContext) {
        return this.devices.list(ctx);
    }

    @Post()
    @RequirePermission(PREFS)
    @ApiOperation({ summary: 'Register this browser for push (PushSubscription from pushManager.subscribe)' })
    register(@CurrentOrg() ctx: OrgContext, @Body(new ZodBodyPipe(RegisterPushDeviceSchema)) dto: RegisterPushDeviceInput, @Headers('user-agent') ua?: string) {
        return this.devices.register(ctx, dto, ua);
    }

    @Delete(':id')
    @RequirePermission(PREFS)
    @ApiOperation({ summary: 'Remove one of my devices' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.devices.remove(ctx, id);
    }

    @Post(':id/test')
    @RequirePermission(PREFS)
    @ApiOperation({ summary: 'Send a test push to one of my devices' })
    test(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.devices.test(ctx, id);
    }
}

/** 14 §8 — my digest history (mockup 14 "Quiet hours and digests"). */
@ApiTags('Notifications · Preferences')
@ApiBearerAuth()
@Controller('notifications/digests')
@UseGuards(JwtGuard, PermissionsGuard)
export class MyNotificationDigestsController {
    constructor(private readonly devices: PushDevicesService) { }

    @Get()
    @RequirePermission(PREFS)
    @ApiOperation({ summary: 'My digests: period, frequency, items, status, sent time' })
    list(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(MyDigestQuerySchema)) q: MyDigestQuery) {
        return this.devices.digests(ctx, q);
    }
}
