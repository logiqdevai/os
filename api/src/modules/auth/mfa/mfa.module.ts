import { Module } from '@nestjs/common';
import { MfaService } from './mfa.service';
import { AuthRateLimitService } from './auth-rate-limit.service';

/** MFA factors (TOTP + recovery codes) and auth rate limits; used by the auth flows and by Admin → Members (reset). */
@Module({
    providers: [MfaService, AuthRateLimitService],
    exports: [MfaService, AuthRateLimitService],
})
export class MfaModule { }
