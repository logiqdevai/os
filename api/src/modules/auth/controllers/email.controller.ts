import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { EmailAuthService } from '../services/email.service';
import { RegisterEmailDto } from '../dto/register-email.dto';
import { LoginEmailDto } from '../dto/login-email.dto';
import { AuthResponse } from '../entities/auth-response.entity';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';

class TokenDto {
    @ApiProperty() @IsString() token: string;
}

class OrganizationNameDto {
    @ApiProperty({ example: 'Logiqdev' }) @IsString() @MinLength(2) @MaxLength(120) name: string;
}

class ProfileFieldsDto {
    @ApiProperty() @IsString() @MaxLength(80) first_name: string;
    @ApiProperty() @IsString() @MaxLength(80) last_name: string;
    @ApiProperty() @IsString() @MaxLength(120) display_name: string;
    @ApiProperty() @IsString() @MaxLength(64) timezone: string;
    @ApiProperty() @IsString() @MaxLength(16) locale: string;
    @ApiProperty() @IsString() @MaxLength(16) language: string;
    @ApiProperty() @IsString() @MaxLength(1000) profile_photo_url: string;
}
class UpdateProfileDto extends PartialType(ProfileFieldsDto) { }

class ChangePasswordDto {
    @ApiProperty() @IsString() current_password: string;
    @ApiProperty() @IsString() @MinLength(8) @MaxLength(128) new_password: string;
}

class PreferencesDto {
    @ApiProperty({ required: false }) @IsOptional() @IsString() theme?: string;
}

const meta = (req: any) => ({ ip_address: req.ip ?? null, user_agent: req.headers['user-agent'] ?? null });

@ApiTags('Authentication')
@Controller('auth')
export class EmailAuthController {
    constructor(private readonly authService: EmailAuthService) { }

    @Post('email/register')
    @ApiOperation({ summary: 'Create an account and an agency organization (or join through an invitation)' })
    @ApiResponse({ status: 201, type: AuthResponse })
    register(@Body() dto: RegisterEmailDto, @Req() req: any) {
        return this.authService.registerWithEmail(dto, meta(req));
    }

    @Post('email/login')
    @HttpCode(200)
    @ApiOperation({ summary: 'Sign in with email and password' })
    @ApiResponse({ status: 200, type: AuthResponse })
    login(@Body() dto: LoginEmailDto, @Req() req: any) {
        return this.authService.loginWithEmail(dto, meta(req));
    }

    @Get('invitations/:token')
    @ApiOperation({ summary: 'Public preview of an invitation (organization, role, whether the email has an account)' })
    invitation(@Param('token') token: string) {
        return this.authService.invitationPreview(token);
    }

    @Post('invitations/accept')
    @UseGuards(JwtGuard)
    @ApiBearerAuth()
    @HttpCode(200)
    @ApiOperation({ summary: 'Accept an invitation as the signed-in user' })
    accept(@CurrentUser('id') userId: string, @Body() dto: TokenDto) {
        return this.authService.acceptInvitation(userId, dto.token);
    }

    @Get('me')
    @UseGuards(JwtGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Session bootstrap: user, organizations, active organization, effective permissions, enabled modules' })
    me(@CurrentUser('id') userId: string, @Headers('x-organization-id') orgId?: string) {
        return this.authService.me(userId, orgId || null);
    }

    @Patch('me')
    @UseGuards(JwtGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update own profile' })
    updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
        return this.authService.updateProfile(userId, dto);
    }

    @Post('me/password')
    @UseGuards(JwtGuard)
    @ApiBearerAuth()
    @HttpCode(200)
    @ApiOperation({ summary: 'Change own password' })
    changePassword(@CurrentUser('id') userId: string, @Body() dto: ChangePasswordDto) {
        return this.authService.changePassword(userId, dto.current_password, dto.new_password);
    }

    @Patch('me/preferences')
    @UseGuards(JwtGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update own preferences (theme)' })
    preferences(@CurrentUser('id') userId: string, @Body() dto: PreferencesDto) {
        return this.authService.setPreferences(userId, dto);
    }

    @Post('switch-organization/:organizationId')
    @UseGuards(JwtGuard)
    @ApiBearerAuth()
    @HttpCode(200)
    @ApiOperation({ summary: 'Make another organization the default for the signed-in user' })
    switch(@CurrentUser('id') userId: string, @Param('organizationId') organizationId: string) {
        return this.authService.switchOrganization(userId, organizationId);
    }

    @Post('organizations')
    @UseGuards(JwtGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create another organization owned by the signed-in user' })
    createOrganization(@CurrentUser('id') userId: string, @Body() dto: OrganizationNameDto) {
        return this.authService.createOrganization(userId, dto.name);
    }

    @Get('sessions')
    @UseGuards(JwtGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Own active sessions' })
    sessions(@CurrentUser('id') userId: string, @CurrentUser('session_id') sessionId: string) {
        return this.authService.sessions(userId, sessionId);
    }

    @Delete('sessions/:id')
    @UseGuards(JwtGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Revoke one of own sessions' })
    revoke(@CurrentUser('id') userId: string, @Param('id') id: string) {
        return this.authService.revokeSession(userId, id);
    }

    @Post('logout')
    @UseGuards(JwtGuard)
    @ApiBearerAuth()
    @HttpCode(200)
    @ApiOperation({ summary: 'Sign out (revokes the current session)' })
    logout(@CurrentUser('id') userId: string, @CurrentUser('session_id') sessionId: string) {
        return this.authService.logout(userId, sessionId);
    }
}
