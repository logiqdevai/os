import { Body, Controller, Get, HttpException, HttpStatus, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '@/shared/authorization/decorators/require-permission.decorator';
import { DocsFormsService } from '../services/forms.service';
import { SubmitFormDto } from '../dto/form.dto';

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;

/**
 * Public link for anonymous, published forms (15 §5). No credential; the organization comes from the form.
 * Basic per-IP rate limit (10 submissions / minute) and a 64 KB answers cap in the service.
 */
@ApiTags('Docs · Public forms')
@Controller('public/forms')
export class DocsPublicFormsController {
    private readonly hits = new Map<string, number[]>();

    constructor(private readonly forms: DocsFormsService) { }

    @Get(':id')
    @Public()
    @ApiOperation({ summary: 'Public form definition (anonymous published forms only)' })
    get(@Param('id', ParseUUIDPipe) id: string) {
        return this.forms.publicForm(id);
    }

    @Post(':id/submissions')
    @Public()
    @ApiOperation({ summary: 'Submit an anonymous response on the public link' })
    submit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitFormDto, @Req() req: Request) {
        this.rateLimit(`${req.ip}:${id}`);
        return this.forms.submitPublic(id, dto.answers, { ip: null, user_agent: null });
    }

    private rateLimit(key: string) {
        const now = Date.now();
        const recent = (this.hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
        if (recent.length >= MAX_PER_WINDOW) throw new HttpException({ message: 'Too many submissions. Try again in a minute.', code: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
        recent.push(now);
        this.hits.set(key, recent);
        if (this.hits.size > 5000) for (const [k, v] of this.hits) if (!v.some((t) => now - t < WINDOW_MS)) this.hits.delete(k);
    }
}
