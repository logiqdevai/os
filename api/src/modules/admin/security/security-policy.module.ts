import { Module } from '@nestjs/common';
import { SecurityPolicyController } from './security-policy.controller';
import { SecurityPolicyService } from './security-policy.service';
import { SecurityPolicyMcp } from './security-policy.mcp';

/** Exported so the auth module enforces the same policy (password rules, session lifetime, IP allow-list). */
@Module({
    controllers: [SecurityPolicyController],
    providers: [SecurityPolicyService, SecurityPolicyMcp],
    exports: [SecurityPolicyService],
})
export class SecurityPolicyModule { }
