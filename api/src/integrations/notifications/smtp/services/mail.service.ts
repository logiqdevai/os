import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { CreateEmail } from '../../resend/interfaces/mail.interfaces';
import { SmtpAdapter } from '../smtp/smtp.adapter';

@Injectable()
export class SmtpMailService {
    private readonly logger = new Logger(SmtpMailService.name);

    constructor(private readonly smtpAdapter: SmtpAdapter) {}

    public async sendEmail(createEmail: CreateEmail) {
        try {
            return await this.smtpAdapter.sendEmail(createEmail);
        } catch (error) {
            this.logger.error(error);
            throw new InternalServerErrorException('Failed to send email with SMTP');
        }
    }

    public async sendBulkEmails(createEmails: CreateEmail[]) {
        try {
            const promises = createEmails.map(async (createEmail) => this.sendEmail(createEmail));
            return await Promise.all(promises);
        } catch (error) {
            this.logger.error(error);
            throw new InternalServerErrorException('Failed to send bulk emails with SMTP');
        }
    }
}
