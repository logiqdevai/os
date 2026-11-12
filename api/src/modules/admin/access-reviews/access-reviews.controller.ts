import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { AdminBody } from '../shared/zod-body.pipe';
import { AccessReviewsService } from './access-reviews.service';
import {
    AccessReviewItemQuery,
    AccessReviewItemQuerySchema,
    AccessReviewQuery,
    AccessReviewQuerySchema,
    CreateAccessReviewInput,
    CreateAccessReviewSchema,
    DecideItemInput,
    DecideItemSchema,
    ReassignItemInput,
    ReassignItemSchema,
} from './dto/access-review.dto';

const VIEW = ['organizations.access_reviews.read', 'organizations.access_reviews.manage', 'organizations.access_reviews.decide'];
const MANAGE = 'organizations.access_reviews.manage';

/** Access reviews (01 §98). Reviewers only need `decide` and only see / decide their own items. */
@ApiTags('Admin · Access reviews')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtGuard, PermissionsGuard)
export class AccessReviewsController {
    constructor(private readonly reviews: AccessReviewsService) { }

    @Get('access-reviews')
    @RequireAnyPermission(...VIEW)
    @ApiOperation({ summary: 'List access reviews with progress' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(AccessReviewQuerySchema)) query: AccessReviewQuery) {
        return this.reviews.findAll(ctx, query);
    }

    @Get('access-reviews/:id')
    @RequireAnyPermission(...VIEW)
    @ApiOperation({ summary: 'Get a review with stats and reviewer progress' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.reviews.get(ctx, id);
    }

    @Get('access-reviews/:id/items')
    @RequireAnyPermission(...VIEW)
    @ApiOperation({ summary: 'Items of a review (reviewers see only theirs)' })
    items(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(AccessReviewItemQuerySchema)) query: AccessReviewItemQuery) {
        return this.reviews.items(ctx, id, query);
    }

    @Post('access-reviews')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Create an access review (draft, or `start: true`)' })
    create(@CurrentOrg() ctx: OrgContext, @Body(AdminBody(CreateAccessReviewSchema)) dto: CreateAccessReviewInput) {
        return this.reviews.create(ctx, dto);
    }

    @Post('access-reviews/:id/start')
    @HttpCode(200)
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Start: snapshot every in-scope member and assign reviewers' })
    start(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.reviews.start(ctx, id);
    }

    @Post('access-reviews/:id/apply')
    @HttpCode(200)
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Apply REVOKED / MODIFIED decisions' })
    apply(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.reviews.apply(ctx, id);
    }

    @Post('access-reviews/:id/complete')
    @HttpCode(200)
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Complete (every item decided and applied)' })
    complete(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.reviews.complete(ctx, id);
    }

    @Post('access-reviews/:id/cancel')
    @HttpCode(200)
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Cancel a draft or running review' })
    cancel(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.reviews.cancel(ctx, id);
    }

    @Patch('access-review-items/:id')
    @RequirePermission('organizations.access_reviews.decide')
    @ApiOperation({ summary: 'Record a decision on an item assigned to you' })
    decide(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(AdminBody(DecideItemSchema)) dto: DecideItemInput) {
        return this.reviews.decide(ctx, id, dto);
    }

    @Post('access-review-items/:id/reassign')
    @HttpCode(200)
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Give an item to another reviewer' })
    reassign(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(AdminBody(ReassignItemSchema)) dto: ReassignItemInput) {
        return this.reviews.reassign(ctx, id, dto);
    }
}
