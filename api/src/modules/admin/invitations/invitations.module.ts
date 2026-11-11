import { Module } from '@nestjs/common';
import { ResendModule } from '@/integrations/notifications/resend/resend.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { InvitationsMcp } from './invitations.mcp';
import { AdminAccessService } from '../shared/admin-access.service';

@Module({
    imports: [ResendModule],
    controllers: [InvitationsController],
    providers: [InvitationsService, InvitationsMcp, AdminAccessService],
})
export class InvitationsModule { }
