import { Body, Controller, Get, Param, Post, Req, StreamableFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { Public } from '@/shared/authorization/decorators/require-permission.decorator';
import { DocumentsService } from '../services/documents.service';
import { SharesService } from '../services/shares.service';
import { ShareAccessDto } from '../dto/shares.dto';
import { BigIntInterceptor } from '../utils/serialize.utils';
import { streamable } from '../utils/streamable.utils';

/**
 * Credential-less endpoints: signed download tokens (issued by the authenticated API) and share links.
 * Possession of the signed token / link token is the authorization; everything is re-checked on every request.
 */
@ApiTags('Public · Files')
@Controller('files/public')
@UseGuards(JwtGuard)
@UseInterceptors(BigIntInterceptor)
export class PublicFilesController {
    constructor(
        private readonly documents: DocumentsService,
        private readonly shares: SharesService,
    ) { }

    @Get('download/:token')
    @Public()
    @ApiOperation({ summary: 'Download or view a file through a signed, expiring token' })
    async download(@Param('token') token: string): Promise<StreamableFile> {
        return streamable(await this.documents.streamByToken(token));
    }

    @Get('shares/:token')
    @Public()
    @ApiOperation({ summary: 'Share link landing data (no file access before the password)' })
    resolve(@Param('token') token: string) {
        return this.shares.resolvePublic(token);
    }

    @Post('shares/:token/access')
    @Public()
    @ApiOperation({ summary: 'Open a share link (checks the password) and get signed preview/download paths' })
    access(@Param('token') token: string, @Body() dto: ShareAccessDto, @Req() req: Request) {
        return this.shares.accessPublic(token, dto.password, { ip: req.ip ?? null });
    }
}
