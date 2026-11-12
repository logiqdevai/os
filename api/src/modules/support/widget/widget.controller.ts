import { Body, Controller, Get, Headers, NotFoundException, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '@/shared/authorization/decorators/require-permission.decorator';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { SupportWidgetService, WidgetRequestMeta } from './widget.service';
import { buildWidgetScript } from './widget-script';
import { StartWidgetConversationDto, WidgetMessageDto, WidgetMessagesQuery, WidgetMessagesQuerySchema } from './dto/widget.dto';

const meta = (req: Request): WidgetRequestMeta => ({
    ip: req.ip ?? null,
    user_agent: (req.headers['user-agent'] as string | undefined) ?? null,
    origin: (req.headers.origin as string | undefined) ?? null,
});

/**
 * Website chat widget — public endpoints (no login). The embed key identifies the channel; the visitor's
 * conversation token (X-Widget-Token) is the credential for one conversation. CORS for /support/widget/* allows
 * any origin at the HTTP layer (main.ts); the service enforces SupportChannel.allowed_origins.
 */
@ApiTags('Public · Support widget')
@Public()
@Controller('support/widget')
export class SupportWidgetController {
    constructor(
        private readonly widget: SupportWidgetService,
        private readonly config: ConfigService,
    ) { }

    @Get(':file')
    @ApiOperation({ summary: 'Embeddable widget script: <script src="…/support/widget/<key>.js" async></script>' })
    async script(@Param('file') file: string, @Res() res: Response) {
        if (!file.endsWith('.js')) throw new NotFoundException({ message: 'Not found', code: 'not_found' });
        const key = file.slice(0, -3);
        await this.widget.channelByKey(key);
        const apiBase = this.config.get<string>('API_URL') ?? `${res.req.protocol}://${res.req.get('host')}`;
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.send(buildWidgetScript(apiBase, key));
    }

    @Get(':key/config')
    @ApiOperation({ summary: 'Widget appearance (title, welcome text, colour, position)' })
    configFor(@Param('key') key: string, @Req() req: Request) {
        return this.widget.config(key, meta(req));
    }

    @Post(':key/conversations')
    @ApiOperation({ summary: 'Start a conversation; returns the visitor conversation token (store it, send it as X-Widget-Token)' })
    start(@Param('key') key: string, @Body() dto: StartWidgetConversationDto, @Req() req: Request) {
        return this.widget.start(key, dto, meta(req));
    }

    @Get(':key/conversation')
    @ApiHeader({ name: 'X-Widget-Token', required: true })
    @ApiOperation({ summary: "The visitor's conversation (public messages only)" })
    thread(@Param('key') key: string, @Headers('x-widget-token') token: string, @Query(new ZodValidationPipe(WidgetMessagesQuerySchema)) q: WidgetMessagesQuery, @Req() req: Request) {
        return this.widget.messages(key, token, q, meta(req));
    }

    @Post(':key/conversation/messages')
    @ApiHeader({ name: 'X-Widget-Token', required: true })
    @ApiOperation({ summary: 'Send a message as the visitor' })
    post(@Param('key') key: string, @Headers('x-widget-token') token: string, @Body() dto: WidgetMessageDto, @Req() req: Request) {
        return this.widget.post(key, token, dto.body, meta(req));
    }
}
