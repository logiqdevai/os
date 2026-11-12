import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { Public } from '@/shared/authorization/decorators/require-permission.decorator';
import { RequestPrincipal } from '@/shared/authorization/interfaces/org-context.interface';
import { MfaService } from '../mfa/mfa.service';
import { EmailAuthService } from '../services/email.service';

class TotpCodeDto {
    @ApiProperty({ example: '123456' }) @IsString() @Length(6, 8)
    code: string;
}

class MfaFactorDto {
    @ApiProperty({ required: false, example: '123456', description: 'Code from the authenticator app' }) @IsOptional() @IsString() @Length(6, 8)
    code?: string;

    @ApiProperty({ required: false, example: 'abcde-fghjk', description: 'One of the recovery codes (each works once)' }) @IsOptional() @IsString() @MaxLength(24)
    recovery_code?: string;
}

class MfaVerifyDto extends MfaFactorDto {
    @ApiProperty({ description: 'mfa_token returned by POST /auth/email/login' }) @IsString() @MaxLength(2000)
    mfa_token: string;
}

const meta = (req: { ip?: string; headers: Record<string, string | string[] | undefined> }) => ({ ip_address: req.ip ?? null, user_agent: (req.headers['user-agent'] as string) ?? null });

/** Personal factors are managed by the person themselves, signed in with a user session (not an API key). */
function assertUser(principal: RequestPrincipal) {
    if (principal?.kind !== 'user') throw new ForbiddenException({ message: 'Two-step verification is managed with a user session', code: 'user_session_required' });
    return principal.id as string;
}

/**
 * Two-step verification (01 §74): TOTP enrolment with recovery codes, and the second sign-in step.
 * Self-service: no organization permission (the person's own factors), so these routes work while the security
 * policy still blocks the rest of the API for someone who must enrol.
 */
@ApiTags('Authentication · MFA')
@Controller('auth/mfa')
export class MfaController {
    constructor(
        private readonly mfa: MfaService,
        private readonly auth: EmailAuthService,
    ) { }

    @Post('verify')
    @Public()
    @HttpCode(200)
    @ApiOperation({ summary: 'Second sign-in step: exchange mfa_token + code (or recovery code) for a session. Rate limited.' })
    verify(@Body() dto: MfaVerifyDto, @Req() req: any) {
        return this.auth.completeMfaLogin(dto, meta(req));
    }

    @Get()
    @UseGuards(JwtGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Own MFA status: enabled, recovery codes left, and whether the organization requires it' })
    status(@CurrentUser() principal: RequestPrincipal, @Headers('x-organization-id') orgId?: string) {
        return this.mfa.status(assertUser(principal), orgId || null);
    }

    @Post('totp/setup')
    @UseGuards(JwtGuard)
    @ApiBearerAuth()
    @HttpCode(200)
    @ApiOperation({ summary: 'Start authenticator enrolment: returns the secret and otpauth:// URI (QR code). Pending until confirmed.' })
    setup(@CurrentUser() principal: RequestPrincipal) {
        return this.mfa.startTotp(assertUser(principal));
    }

    @Post('totp/confirm')
    @UseGuards(JwtGuard)
    @ApiBearerAuth()
    @HttpCode(200)
    @ApiOperation({ summary: 'Confirm enrolment with the first code; turns MFA on and returns 10 recovery codes once' })
    confirm(@CurrentUser() principal: RequestPrincipal, @Body() dto: TotpCodeDto) {
        return this.mfa.confirmTotp(assertUser(principal), dto.code);
    }

    @Post('recovery-codes')
    @UseGuards(JwtGuard)
    @ApiBearerAuth()
    @HttpCode(200)
    @ApiOperation({ summary: 'Replace the recovery codes (needs a current code); the new codes are returned once' })
    regenerate(@CurrentUser() principal: RequestPrincipal, @Body() dto: MfaFactorDto) {
        return this.mfa.regenerateRecoveryCodes(assertUser(principal), dto);
    }

    @Post('disable')
    @UseGuards(JwtGuard)
    @ApiBearerAuth()
    @HttpCode(200)
    @ApiOperation({ summary: 'Turn MFA off (needs a current code). Refused while an organization policy requires MFA.' })
    disable(@CurrentUser() principal: RequestPrincipal, @Body() dto: MfaFactorDto) {
        return this.mfa.disable(assertUser(principal), dto);
    }
}
