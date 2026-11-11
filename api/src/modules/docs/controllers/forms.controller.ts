import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireOrgMember, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { DocsFormsService } from '../services/forms.service';
import {
    CreateAssignmentDto,
    CreateFormDto,
    FormQuery,
    FormQuerySchema,
    PublishFormDto,
    ReviewSubmissionDto,
    SubmissionQuery,
    SubmissionQuerySchema,
    SubmitFormDto,
    UpdateFormDto,
} from '../dto/form.dto';

@ApiTags('Docs · Forms')
@ApiBearerAuth()
@Controller('docs/forms')
@UseGuards(JwtGuard, PermissionsGuard)
export class DocsFormsController {
    constructor(private readonly forms: DocsFormsService) { }

    @Get()
    @RequirePermission('docs.forms.read')
    @ApiOperation({ summary: 'List forms' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(FormQuerySchema)) query: FormQuery) {
        return this.forms.findAll(ctx, query);
    }

    @Get('assigned')
    @RequireOrgMember()
    @ApiOperation({ summary: 'Forms assigned to me that still need a response' })
    assigned(@CurrentOrg() ctx: OrgContext) {
        return this.forms.myAssignments(ctx);
    }

    @Get(':id')
    @RequirePermission('docs.forms.read')
    @ApiOperation({ summary: 'Get a form (draft schema + versions)' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.forms.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('docs.forms.create')
    @ApiOperation({ summary: 'Create a form' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateFormDto) {
        return this.forms.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('docs.forms.update')
    @ApiOperation({ summary: 'Update a form (fields, settings)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFormDto) {
        return this.forms.update(ctx, id, dto);
    }

    @Post(':id/publish')
    @RequirePermission('docs.forms.update')
    @ApiOperation({ summary: 'Publish: freeze the schema as a new version and accept responses' })
    publish(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PublishFormDto) {
        return this.forms.publish(ctx, id, dto.change_summary);
    }

    @Post(':id/close')
    @RequirePermission('docs.forms.update')
    @ApiOperation({ summary: 'Stop accepting responses' })
    close(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.forms.setStatus(ctx, id, 'CLOSED');
    }

    @Post(':id/reopen')
    @RequirePermission('docs.forms.update')
    @ApiOperation({ summary: 'Accept responses again' })
    reopen(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.forms.setStatus(ctx, id, 'PUBLISHED');
    }

    @Post(':id/archive')
    @RequirePermission('docs.forms.archive')
    @ApiOperation({ summary: 'Archive a form' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.forms.setStatus(ctx, id, 'ARCHIVED');
    }

    @Post(':id/unarchive')
    @RequirePermission('docs.forms.archive')
    @ApiOperation({ summary: 'Unarchive a form (it comes back closed)' })
    unarchive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.forms.setStatus(ctx, id, 'DRAFT');
    }

    @Delete(':id')
    @RequirePermission('docs.forms.delete')
    @ApiOperation({ summary: 'Delete a form and its responses (sensitive)' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.forms.remove(ctx, id);
    }

    // --- Assignments -----------------------------------------------------------------------

    @Get(':id/assignments')
    @RequirePermission('docs.forms.read')
    @ApiOperation({ summary: 'Assignments of a form' })
    assignments(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.forms.assignments(ctx, id);
    }

    @Get(':id/recipients')
    @RequirePermission('docs.forms.read')
    @ApiOperation({ summary: 'Recipients and their completion status' })
    recipients(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.forms.recipients(ctx, id);
    }

    @Post(':id/assignments')
    @RequirePermission('docs.forms.assign')
    @ApiOperation({ summary: 'Assign the form to a member, team, department, branch or everyone' })
    assign(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateAssignmentDto) {
        return this.forms.assign(ctx, id, dto);
    }

    @Post(':id/assignments/:assignmentId/cancel')
    @RequirePermission('docs.forms.assign')
    @ApiOperation({ summary: 'Cancel an assignment' })
    cancelAssignment(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('assignmentId', ParseUUIDPipe) assignmentId: string) {
        return this.forms.cancelAssignment(ctx, id, assignmentId);
    }

    // --- Filling ---------------------------------------------------------------------------

    @Get(':id/fill')
    @RequireOrgMember()
    @ApiOperation({ summary: 'Published form for a respondent (assigned members or forms readers)' })
    fill(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.forms.forFilling(ctx, id);
    }

    @Post(':id/submissions')
    @RequireOrgMember()
    @ApiOperation({ summary: 'Submit a response' })
    submit(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitFormDto) {
        return this.forms.submit(ctx, id, dto.answers);
    }

    // --- Responses -------------------------------------------------------------------------

    @Get(':id/responses')
    @RequirePermission('docs.forms.read')
    @ApiOperation({ summary: 'Responses (anonymous forms need docs.forms.anonymous_responses.read)' })
    responses(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(SubmissionQuerySchema)) query: SubmissionQuery) {
        return this.forms.submissions(ctx, id, query);
    }

    @Get(':id/summary')
    @RequirePermission('docs.forms.read')
    @ApiOperation({ summary: 'Per-question summary' })
    summary(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.forms.summary(ctx, id);
    }

    @Patch(':id/responses/:submissionId')
    @RequirePermission('docs.forms.review')
    @ApiOperation({ summary: 'Review a response' })
    review(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('submissionId', ParseUUIDPipe) submissionId: string, @Body() dto: ReviewSubmissionDto) {
        return this.forms.review(ctx, id, submissionId, dto);
    }

    @Post(':id/export')
    @RequirePermission('docs.forms.export')
    @ApiOperation({ summary: 'Export responses as CSV (sensitive, audited)' })
    export(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.forms.exportCsv(ctx, id);
    }
}
