import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PasswordService } from '../services/password.service';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';

@ApiTags('Password Reset')
@Controller('auth')
export class PasswordController {
    constructor(private readonly passwordService: PasswordService) { }

    @Post('forgot-password')
    @ApiOperation({ summary: 'Request a password reset email' })
    @ApiBody({ type: ForgotPasswordDto })
    @ApiResponse({
        status: 200,
        description: 'Password reset email sent if account exists',
    })
    forgotPassword(@Body() dto: ForgotPasswordDto) {
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
    resetPassword(@Body() dto: ResetPasswordDto) {
        return this.passwordService.resetPassword(dto);
    }
}
