import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ResendMailService } from '@/integrations/notifications/resend/services/mail.service';
import { EmailConfig } from '@/shared/constants/email';
import { AppUrls } from '@/shared/config/app-urls';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

@Injectable()
export class PasswordService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mailService: ResendMailService,
    ) { }

    async forgotPassword(dto: ForgotPasswordDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (user && user.password) {
            const token = randomBytes(32).toString('hex');
            const tokenHash = this.hashToken(token);
            const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

            await this.prisma.passwordResetToken.updateMany({
                where: {
                    user_uuid: user.id,
                    used_at: null,
                },
                data: {
                    used_at: new Date(),
                },
            });

            await this.prisma.passwordResetToken.create({
                data: {
                    token_hash: tokenHash,
                    user_uuid: user.id,
                    expires_at: expiresAt,
                },
            });

            setImmediate(async () => {
                try {
                    await this.mailService.sendEmail({
                        to: user.email,
                        from: EmailConfig.email_addresses.alert,
                        subject: EmailConfig.templates.password_reset.subject,
                        template_id: EmailConfig.templates.password_reset.template_id,
                        dynamic_template_data: {
                            resetUrl: AppUrls.resetPassword(token),
                        },
                    });
                } catch { }
            });
        }

        return {
            message: 'If an account with that email exists, a password reset link has been sent.',
        };
    }

    async resetPassword(dto: ResetPasswordDto) {
        const tokenHash = this.hashToken(dto.token);

        const resetToken = await this.prisma.passwordResetToken.findUnique({
            where: { token_hash: tokenHash },
        });

        if (!resetToken || resetToken.used_at || resetToken.expires_at < new Date()) {
            throw new BadRequestException('Invalid or expired reset token');
        }

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: resetToken.user_uuid },
                data: { password: hashedPassword },
            }),
            this.prisma.passwordResetToken.update({
                where: { id: resetToken.id },
                data: { used_at: new Date() },
            }),
            this.prisma.passwordResetToken.updateMany({
                where: {
                    user_uuid: resetToken.user_uuid,
                    used_at: null,
                    id: { not: resetToken.id },
                },
                data: { used_at: new Date() },
            }),
        ]);

        return { message: 'Password has been reset successfully' };
    }

    private hashToken(token: string): string {
        return createHash('sha256').update(token).digest('hex');
    }
}
