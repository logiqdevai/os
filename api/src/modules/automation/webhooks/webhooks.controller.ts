import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OutboundWebhookStatus } from 'generated/prisma';
import type { Request } from 'express';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, Public, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { WebhooksService } from './webhooks.service';
import { CreateInboundWebhookDto, CreateOutboundWebhookDto, DeliveryQuery, DeliveryQuerySchema, OutboundQuery, OutboundQuerySchema, UpdateInboundWebhookDto, UpdateOutboundWebhookDto } from './dto/webhook.dto';

/** The whole webhooks screen is sensitive (URLs, secrets): reads need automation.webhooks.read, writes .manage. */
@ApiTags('Automation · Webhooks')
@ApiBearerAuth()
@Controller('automation/webhooks')
@UseGuards(JwtGuard, PermissionsGuard)
export class WebhooksController {
    constructor(private readonly webhooks: WebhooksService) { }

    @Get('outbound')
    @RequirePermission('automation.webhooks.read')
    @ApiOperation({ summary: 'Outbound endpoints (secrets are never returned)' })
    listOutbound(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(OutboundQuerySchema)) query: OutboundQuery) {
        return this.webhooks.listOutbound(ctx, query);
    }

    @Post('outbound')
    @RequirePermission('automation.webhooks.manage')
    @ApiOperation({ summary: 'Create an endpoint; the signing secret is returned once' })
    createOutbound(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateOutboundWebhookDto) {
        return this.webhooks.createOutbound(ctx, dto);
    }

    @Get('outbound/:id')
    @RequirePermission('automation.webhooks.read')
    getOutbound(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.webhooks.getOutbound(ctx, id);
    }

    @Patch('outbound/:id')
    @RequirePermission('automation.webhooks.manage')
    updateOutbound(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOutboundWebhookDto) {
        return this.webhooks.updateOutbound(ctx, id, dto);
    }

    @Delete('outbound/:id')
    @RequirePermission('automation.webhooks.manage')
    removeOutbound(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.webhooks.removeOutbound(ctx, id);
    }

    @Post('outbound/:id/pause')
    @RequirePermission('automation.webhooks.manage')
    pause(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.webhooks.setOutboundStatus(ctx, id, OutboundWebhookStatus.PAUSED);
    }

    @Post('outbound/:id/resume')
    @RequirePermission('automation.webhooks.manage')
    resume(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.webhooks.setOutboundStatus(ctx, id, OutboundWebhookStatus.ACTIVE);
    }

    @Post('outbound/:id/rotate-secret')
    @RequirePermission('automation.webhooks.manage')
    @ApiOperation({ summary: 'New signing secret (returned once); the previous one stays valid for 24 h' })
    rotate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.webhooks.rotateOutboundSecret(ctx, id);
    }

    @Post('outbound/:id/test')
    @RequirePermission('automation.webhooks.manage')
    @ApiOperation({ summary: 'Send a signed test delivery now' })
    test(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.webhooks.sendTest(ctx, id);
    }

    @Get('deliveries')
    @RequirePermission('automation.webhooks.read')
    deliveries(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(DeliveryQuerySchema)) query: DeliveryQuery) {
        return this.webhooks.listDeliveries(ctx, query);
    }

    @Get('deliveries/:id')
    @RequirePermission('automation.webhooks.read')
    delivery(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.webhooks.getDelivery(ctx, id);
    }

    @Post('deliveries/:id/retry')
    @RequirePermission('automation.webhooks.manage')
    retryDelivery(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.webhooks.retryDelivery(ctx, id);
    }

    @Get('inbound')
    @RequirePermission('automation.webhooks.read')
    listInbound(@CurrentOrg() ctx: OrgContext) {
        return this.webhooks.listInbound(ctx);
    }

    @Post('inbound')
    @RequirePermission('automation.webhooks.manage')
    @ApiOperation({ summary: 'Create an inbound endpoint; the secret is returned once' })
    createInbound(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateInboundWebhookDto) {
        return this.webhooks.createInbound(ctx, dto);
    }

    @Get('inbound/:id')
    @RequirePermission('automation.webhooks.read')
    getInbound(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.webhooks.getInbound(ctx, id);
    }

    @Patch('inbound/:id')
    @RequirePermission('automation.webhooks.manage')
    updateInbound(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInboundWebhookDto) {
        return this.webhooks.updateInbound(ctx, id, dto);
    }

    @Post('inbound/:id/rotate-secret')
    @RequirePermission('automation.webhooks.manage')
    rotateInbound(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.webhooks.rotateInboundSecret(ctx, id);
    }

    @Post('inbound/:id/revoke')
    @RequirePermission('automation.webhooks.manage')
    revokeInbound(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.webhooks.revokeInbound(ctx, id);
    }
}

/** Public receiver for inbound webhooks: authenticated by the endpoint's signature / token, not a user credential. */
@ApiTags('Automation · Webhooks')
@Controller('automation/hooks')
export class InboundReceiverController {
    constructor(private readonly webhooks: WebhooksService) { }

    @Post('in/:slug')
    @Public()
    @HttpCode(202)
    @ApiOperation({ summary: 'Receive a signed inbound webhook (HMAC-SHA256 of the raw body in the configured header, or a bearer token)' })
    receive(@Param('slug') slug: string, @Req() req: Request & { rawBody?: Buffer }, @Body() body: unknown) {
        return this.webhooks.receive(slug, {
            rawBody: req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(body ?? {}),
            body,
            headers: req.headers,
            ip: req.ip ?? null,
        });
    }
}
