import { Module } from '@nestjs/common';
import { ResendModule } from '@/integrations/notifications/resend/resend.module';
import { SupportModule } from '@/modules/support/support.module';
import { PortalGuard } from './common/portal.guard';
import { PortalInvitationsService } from './common/portal-invitations.service';
import { PortalAdminService } from './admin/portal-admin.service';
import { PortalAdminController } from './admin/portal-admin.controller';
import { PortalCustomerService } from './customer/portal-customer.service';
import { PortalCustomerController, PortalSessionController } from './customer/portal-customer.controller';
import { PortalMcp } from './portal.mcp';

/** 07 Customer portal: agency administration (/portal/admin) and the customer-facing API (/portal). */
@Module({
    imports: [ResendModule, SupportModule],
    controllers: [PortalAdminController, PortalSessionController, PortalCustomerController],
    providers: [PortalGuard, PortalInvitationsService, PortalAdminService, PortalCustomerService, PortalMcp],
})
export class PortalModule { }
