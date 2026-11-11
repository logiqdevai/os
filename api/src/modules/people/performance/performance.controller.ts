import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { BaseListQuery, BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';
import { P } from '../common/people.utils';
import { PerformanceService } from './performance.service';
import {
    CycleDto, FeedbackDto, FeedbackQuery, FeedbackQuerySchema, GoalDto, GoalQuery, GoalQuerySchema, GoalUpdateDto, LaunchCycleDto, ReviewDto, ReviewQuery, ReviewQuerySchema,
    UpdateCycleDto, UpdateGoalDto, UpdateReviewDto,
} from './performance.dto';

const uuid = new ParseUUIDPipe();
const READ = [P.perfReadOwn, P.perfReadAll, P.perfManage];

@ApiTags('People · Performance')
@ApiBearerAuth()
@Controller('people/performance')
@UseGuards(JwtGuard, PermissionsGuard)
export class PerformanceController {
    constructor(private readonly performance: PerformanceService) { }

    @Get('cycles')
    @RequireAnyPermission(P.perfReadAll, P.perfManage)
    cycles(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(BaseListQuerySchema)) query: BaseListQuery) {
        return this.performance.cycles(ctx, query);
    }

    @Post('cycles')
    @RequirePermission(P.perfManage)
    createCycle(@CurrentOrg() ctx: OrgContext, @Body() dto: CycleDto) {
        return this.performance.createCycle(ctx, dto);
    }

    @Patch('cycles/:id')
    @RequirePermission(P.perfManage)
    updateCycle(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: UpdateCycleDto) {
        return this.performance.updateCycle(ctx, id, dto);
    }

    @Post('cycles/:id/launch')
    @RequirePermission(P.perfManage)
    launch(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: LaunchCycleDto) {
        return this.performance.launch(ctx, id, dto);
    }

    @Get('reviews')
    @RequireAnyPermission(...READ)
    reviews(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ReviewQuerySchema)) query: ReviewQuery) {
        return this.performance.reviews(ctx, query);
    }

    @Get('reviews/:id')
    @RequireAnyPermission(...READ)
    review(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.performance.review(ctx, id);
    }

    @Post('reviews')
    @RequirePermission(P.perfManage)
    createReview(@CurrentOrg() ctx: OrgContext, @Body() dto: ReviewDto) {
        return this.performance.createReview(ctx, dto);
    }

    @Patch('reviews/:id')
    @RequireAnyPermission(...READ)
    updateReview(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: UpdateReviewDto) {
        return this.performance.updateReview(ctx, id, dto);
    }

    @Post('reviews/:id/submit-self')
    @RequirePermission(P.perfReadOwn)
    submitSelf(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.performance.transition(ctx, id, 'submit-self');
    }

    @Post('reviews/:id/submit')
    @RequirePermission(P.perfManage)
    submit(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.performance.transition(ctx, id, 'submit');
    }

    @Post('reviews/:id/complete')
    @RequirePermission(P.perfManage)
    complete(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.performance.transition(ctx, id, 'complete');
    }

    @Post('reviews/:id/acknowledge')
    @RequirePermission(P.perfReadOwn)
    acknowledge(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.performance.transition(ctx, id, 'acknowledge');
    }

    @Get('goals')
    @RequireAnyPermission(...READ)
    goals(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(GoalQuerySchema)) query: GoalQuery) {
        return this.performance.goals(ctx, query);
    }

    @Post('goals')
    @RequireAnyPermission(P.perfManage, P.perfReadOwn)
    createGoal(@CurrentOrg() ctx: OrgContext, @Body() dto: GoalDto) {
        return this.performance.createGoal(ctx, dto);
    }

    @Patch('goals/:id')
    @RequireAnyPermission(P.perfManage, P.perfReadOwn)
    updateGoal(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: UpdateGoalDto) {
        return this.performance.updateGoal(ctx, id, dto);
    }

    @Delete('goals/:id')
    @RequireAnyPermission(P.perfManage, P.perfReadOwn)
    removeGoal(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.performance.removeGoal(ctx, id);
    }

    @Post('goals/:id/updates')
    @RequireAnyPermission(P.perfManage, P.perfReadOwn)
    addGoalUpdate(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: GoalUpdateDto) {
        return this.performance.addGoalUpdate(ctx, id, dto);
    }

    @Get('feedback')
    @RequireAnyPermission(...READ)
    feedback(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(FeedbackQuerySchema)) query: FeedbackQuery) {
        return this.performance.feedback(ctx, query);
    }

    @Post('feedback')
    @RequireAnyPermission(...READ)
    addFeedback(@CurrentOrg() ctx: OrgContext, @Body() dto: FeedbackDto) {
        return this.performance.addFeedback(ctx, dto);
    }
}
