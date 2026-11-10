import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { EmailConfig } from '@/shared/config/email';
import { CreateEmail, EmailFromAddress, EmailTemplate } from '../../resend/interfaces/mail.interfaces';
import { TemplateService } from '../../resend/utils/templates.utils';
import { SmtpConfig } from '../config/smtp.config';

@Injectable()
export class SmtpAdapter {
    private readonly logger = new Logger(SmtpAdapter.name);
    private readonly emailFromAddresses: EmailFromAddress;

    constructor(
        private readonly smtpConfig: SmtpConfig,
        private readonly templateService: TemplateService,
    ) {
        this.emailFromAddresses = EmailConfig.email_addresses;
    }

    public async sendEmail(createEmail: CreateEmail) {
        try {
            const transporter = this.smtpConfig.getTransporter();
            let html = createEmail.html;

            if (createEmail.template_id) {
                html = await this.templateService.renderTemplate(
                    createEmail.template_id as EmailTemplate,
                    createEmail.dynamic_template_data ?? {},
                );
            }

            return await transporter.sendMail({
                from: createEmail.from || this.smtpConfig.getDefaultFrom() || this.emailFromAddresses.confirmation,
                to: createEmail.to,
                subject: createEmail.subject,
                text: createEmail.text,
                html,
                cc: createEmail.cc,
                bcc: createEmail.bcc,
                replyTo: createEmail.replyTo,
                headers: createEmail.headers,
                attachments: createEmail.attachments,
            });
        } catch (error) {
            this.logger.error(error);
            throw new InternalServerErrorException('Failed to send email with SMTP');
        }
    }
}
