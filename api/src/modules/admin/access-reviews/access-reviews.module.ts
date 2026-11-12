import { Module } from '@nestjs/common';
import { AccessReviewsController } from './access-reviews.controller';
import { AccessReviewsService } from './access-reviews.service';
import { AccessReviewsMcp } from './access-reviews.mcp';
import { AdminAccessService } from '../shared/admin-access.service';
import { MembersModule } from '../members/members.module';
import { PermissionsModule } from '../permissions/permissions.module';

/** Applying decisions goes through MembersService / PermissionsService (same audit + invalidation as the UI). */
@Module({
    imports: [MembersModule, PermissionsModule],
    controllers: [AccessReviewsController],
    providers: [AccessReviewsService, AccessReviewsMcp, AdminAccessService],
})
export class AccessReviewsModule { }
