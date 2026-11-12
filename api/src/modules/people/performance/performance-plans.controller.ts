import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { P } from '../common/people.utils';
import { PerformancePlansService } from './performance-plans.service';
import {
    CalibrateReviewDto, ClosePipDto, DeclineFeedbackRequestDto, FeedbackRequestDto, FeedbackRequestQuery, FeedbackRequestQuerySchema, PipDto, PipItemDto, PipQuery, PipQuerySchema,
    SubmitFeedbackRequestDto, UpdatePipDto, UpdatePipItemDto,
} from './performance-plans.dto';

const uuid = new ParseUUIDPipe();
const READ = [P.perfReadOwn, P.perfReadAll, P.perfManage];

@ApiTags('People · Performance')
@ApiBearerAuth()
@Controller('people/performance')
@UseGuards(JwtGuard, PermissionsGuard)
export class PerformancePlansController {
    constructor(private readonly plans: PerformancePlansService) { }

    // ------------------------------------------------------------ improvement plans

    @Get('improvement-plans')
    @RequireAnyPermission(...READ)
    @ApiOperation({ summary: 'Improvement plans visible to the caller (scope, manager / HR partner, or own once active)' })
    list(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(PipQuerySchema)) query: PipQuery) {
        return this.plans.plans(ctx, query);
    }

    @Get('improvement-plans/:id')
    @RequireAnyPermission(...READ)
    get(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.plans.plan(ctx, id);
    }

    @Post('improvement-plans')
    @RequirePermission(P.perfManage)
    @ApiOperation({ summary: 'Open an improvement plan (draft) with measurable items' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: PipDto) {
        return this.plans.createPlan(ctx, dto);
    }

    @Patch('improvement-plans/:id')
    @RequirePermission(P.perfManage)
    update(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: UpdatePipDto) {
        return this.plans.updatePlan(ctx, id, dto);
    }

    @Post('improvement-plans/:id/activate')
    @RequirePermission(P.perfManage)
    @ApiOperation({ summary: 'Share the plan with the employee (DRAFT → ACTIVE)' })
    activate(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.plans.activatePlan(ctx, id);
    }

    @Post('improvement-plans/:id/close')
    @RequirePermission(P.perfManage)
    @ApiOperation({ summary: 'Close with an outcome and a required note' })
    close(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: ClosePipDto) {
        return this.plans.closePlan(ctx, id, dto);
    }

    @Post('improvement-plans/:id/items')
    @RequirePermission(P.perfManage)
    addItem(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: PipItemDto) {
        return this.plans.addItem(ctx, id, dto);
    }

    @Patch('improvement-plans/:id/items/:itemId')
    @RequirePermission(P.perfManage)
    @ApiOperation({ summary: 'Edit or evaluate an item (OPEN / MET / NOT_MET)' })
    updateItem(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Param('itemId', uuid) itemId: string, @Body() dto: UpdatePipItemDto) {
        return this.plans.updateItem(ctx, id, itemId, dto);
    }

    // ------------------------------------------------------------ feedback requests

    @Get('feedback-requests')
    @RequireAnyPermission(...READ)
    @ApiOperation({ summary: 'Feedback requests: box=inbox (asked of me), sent (I asked), all (scope)' })
    requests(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(FeedbackRequestQuerySchema)) query: FeedbackRequestQuery) {
        return this.plans.requests(ctx, query);
    }

    @Post('feedback-requests')
    @RequireAnyPermission(P.perfManage, P.perfReadOwn)
    @ApiOperation({ summary: 'Ask colleagues for feedback about an employee (manager / HR, or the employee about themselves)' })
    createRequests(@CurrentOrg() ctx: OrgContext, @Body() dto: FeedbackRequestDto) {
        return this.plans.createRequests(ctx, dto);
    }

    @Post('feedback-requests/:id/submit')
    @RequireAnyPermission(...READ)
    @ApiOperation({ summary: 'Answer a request asked of me (creates PEER_FEEDBACK)' })
    submit(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: SubmitFeedbackRequestDto) {
        return this.plans.submitRequest(ctx, id, dto);
    }

    @Post('feedback-requests/:id/decline')
    @RequireAnyPermission(...READ)
    decline(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: DeclineFeedbackRequestDto) {
        return this.plans.declineRequest(ctx, id, dto);
    }

    @Post('feedback-requests/:id/cancel')
    @RequireAnyPermission(P.perfManage, P.perfReadOwn)
    cancel(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.plans.cancelRequest(ctx, id);
    }

    // ------------------------------------------------------------ calibration

    @Get('cycles/:id/calibration')
    @RequirePermission(P.perfManage)
    @ApiOperation({ summary: 'Ratings of a cycle in scope with distribution and calibration history' })
    calibration(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.plans.calibration(ctx, id);
    }

    @Post('reviews/:id/calibrate')
    @RequirePermission(P.perfManage)
    @ApiOperation({ summary: 'Calibrate a review rating (original kept in PerformanceCalibration; sensitive, audited)' })
    calibrate(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: CalibrateReviewDto) {
        return this.plans.calibrate(ctx, id, dto);
    }
}
