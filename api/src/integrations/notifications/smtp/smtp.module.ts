import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TemplateService } from '../resend/utils/templates.utils';
import { SmtpConfig } from './config/smtp.config';
import { SmtpMailService } from './services/mail.service';
import { SmtpAdapter } from './smtp/smtp.adapter';

@Module({
    imports: [ConfigModule],
    providers: [SmtpMailService, SmtpConfig, SmtpAdapter, TemplateService, Logger],
    exports: [SmtpMailService],
})
export class SmtpModule {}
