import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class SmtpConfig {
    private transporter: Transporter | null = null;
    private readonly logger = new Logger(SmtpConfig.name);

    constructor(private readonly configService: ConfigService) {
        this.initSmtp();
    }

    private initSmtp() {
        const host = this.configService.get<string>('SMTP_HOST');
        const port = this.configService.get<number>('SMTP_PORT');
        const user = this.configService.get<string>('SMTP_USER');
        const password = this.configService.get<string>('SMTP_PASSWORD');

        if (!host || !port || !user || !password) {
            this.logger.error('SMTP_HOST, SMTP_PORT, SMTP_USER, or SMTP_PASSWORD is not configured');
            return;
        }

        const secure = this.configService.get<string>('SMTP_SECURE') === 'true';

        this.transporter = nodemailer.createTransport({
            host,
            port,
            secure,
            auth: {
                user,
                pass: password,
            },
        });

        this.logger.debug('SMTP initialized');
    }

    getTransporter(): Transporter {
        if (!this.transporter) {
            throw new Error('SMTP transporter is not initialized');
        }

        return this.transporter;
    }

    getDefaultFrom(): string {
        const from = this.configService.get<string>('SMTP_FROM');
        const fromName = this.configService.get<string>('SMTP_FROM_NAME');
        const user = this.configService.get<string>('SMTP_USER');

        const address = from || user;

        if (!address) {
            throw new Error('SMTP_FROM or SMTP_USER is not configured');
        }

        if (fromName) {
            return `"${fromName}" <${address}>`;
        }

        return address;
    }
}
