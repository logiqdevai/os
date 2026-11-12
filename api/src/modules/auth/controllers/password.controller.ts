import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PasswordService } from '../services/password.service';
import { AuthRateLimitService } from '../mfa/auth-rate-limit.service';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';

@ApiTags('Password Reset')
@Controller('auth')
export class PasswordController {
    constructor(
        private readonly passwordService: PasswordService,
        private readonly rateLimit: AuthRateLimitService,
    ) { }

    @Post('forgot-password')
    @ApiOperation({ summary: 'Request a password reset email' })
    @ApiBody({ type: ForgotPasswordDto })
    @ApiResponse({
        status: 200,
        description: 'Password reset email sent if account exists',
    })
    async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: { ip?: string }) {
        await this.rateLimit.consume(`forgot-password:${req.ip ?? 'unknown'}`, 10, 900);
        return this.passwordService.forgotPassword(dto);
    }

    @Post('reset-password')
    @ApiOperation({ summary: 'Reset password with token from email' })
    @ApiBody({ type: ResetPasswordDto })
    @ApiResponse({
        status: 200,
        description: 'Password reset successfully',
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid or expired reset token',
    })
    async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: { ip?: string }) {
        await this.rateLimit.consume(`reset-password:${req.ip ?? 'unknown'}`, 20, 900);
        return this.passwordService.resetPassword(dto);
    }
}
