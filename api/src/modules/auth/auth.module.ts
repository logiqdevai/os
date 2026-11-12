import { Logger, Module } from '@nestjs/common';
import { EmailAuthService } from './services/email.service';
import { EmailAuthController } from './controllers/email.controller';
import { PasswordService } from './services/password.service';
import { PasswordController } from './controllers/password.controller';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { CreateJwtServiceModule } from '@/shared/utils/jwt/jwt.module';
import { ResendModule } from '@/integrations/notifications/resend/resend.module';
import { OrganizationSetupService } from './services/organization-setup.service';
import { SecurityPolicyModule } from '../admin/security/security-policy.module';
import { MfaModule } from './mfa/mfa.module';
import { MfaController } from './controllers/mfa.controller';

@Module({
  imports: [PrismaModule, CreateJwtServiceModule, ResendModule, SecurityPolicyModule, MfaModule],
  providers: [EmailAuthService, PasswordService, OrganizationSetupService, Logger],
  controllers: [EmailAuthController, PasswordController, MfaController],
  exports: [OrganizationSetupService, EmailAuthService],
})
export class AuthModule { }
