import { Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, Matches, ValidateIf } from 'class-validator';
import type { Response } from 'express';
import { AppColorMode, AppTheme } from 'generated/prisma';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { Public } from '@/shared/authorization/decorators/require-permission.decorator';
import type { IncomingFile } from '@/modules/files/services/documents.service';
import { PROFILE_PHOTO_MAX_BYTES, ProfilePhotoService } from '../services/profile-photo.service';
import { AccountAppearanceService } from '../services/account-appearance.service';

class UpdateAppearanceDto {
    @ApiProperty({ enum: AppColorMode, required: false }) @IsOptional() @IsEnum(AppColorMode) color_mode?: AppColorMode;
    @ApiProperty({ enum: AppTheme, required: false }) @IsOptional() @IsEnum(AppTheme) theme?: AppTheme;
    /** #rrggbb custom primary color; null resets to the theme color. */
    @ApiProperty({ required: false, nullable: true, example: '#0891b2' }) @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Use a hex color like #0891b2' }) primary_color?: string | null;
}

/**
 * Own account: profile photo and per-organization appearance (01 §127). Self-service only — a user can never
 * change another user's photo or appearance, so these are scoped to the signed-in user instead of a permission key.
 */
@ApiTags('Authentication')
@Controller('auth')
@UseGuards(JwtGuard)
export class AccountController {
    constructor(
        private readonly photos: ProfilePhotoService,
        private readonly appearance: AccountAppearanceService,
    ) { }

    @Post('me/photo')
    @ApiBearerAuth()
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: PROFILE_PHOTO_MAX_BYTES, files: 1 } }))
    @ApiOperation({ summary: 'Upload or replace own profile photo (PNG, JPG, GIF or WebP, max 5 MB)' })
    uploadPhoto(@CurrentUser('id') userId: string, @UploadedFile() file: IncomingFile) {
        return this.photos.upload(userId, file);
    }

    @Delete('me/photo')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Remove own profile photo' })
    removePhoto(@CurrentUser('id') userId: string) {
        return this.photos.remove(userId);
    }

    @Get('photos/:userId/:photoId')
    @Public()
    @ApiOperation({ summary: 'Public profile photo by versioned id (replaced or removed photos return 404)' })
    async photo(@Param('userId', ParseUUIDPipe) userId: string, @Param('photoId', ParseUUIDPipe) photoId: string, @Res() res: Response) {
        const { stream, mime } = await this.photos.stream(userId, photoId);
        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        stream.on('error', () => { if (!res.headersSent) res.status(404); res.end(); });
        stream.pipe(res);
    }

    @Get('me/appearance')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Own appearance (color mode, theme, primary color) in the active organization' })
    getAppearance(@CurrentUser('id') userId: string, @Headers('x-organization-id') orgId?: string) {
        return this.appearance.get(userId, orgId || null);
    }

    @Patch('me/appearance')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update own appearance in the active organization (x-organization-id)' })
    updateAppearance(@CurrentUser('id') userId: string, @Body() dto: UpdateAppearanceDto, @Headers('x-organization-id') orgId?: string) {
        return this.appearance.update(userId, orgId || null, dto);
    }
}
