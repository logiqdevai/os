import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { CrmNotesService } from './notes.service';
import { CreateNoteDto, NoteQuery, NoteQuerySchema, UpdateNoteDto } from './dto/note.dto';

const ANY_READ = ['crm.companies.read', 'crm.contacts.read', 'crm.leads.read', 'crm.deals.read'];
const ANY_UPDATE = ['crm.companies.update', 'crm.contacts.update', 'crm.leads.update', 'crm.deals.update'];

/** The service checks the parent record's own read/update key and scope (02 §16). */
@ApiTags('CRM · Notes')
@ApiBearerAuth()
@Controller('crm/notes')
@UseGuards(JwtGuard, PermissionsGuard)
export class CrmNotesController {
    constructor(private readonly notes: CrmNotesService) { }

    @Get()
    @RequireAnyPermission(...ANY_READ)
    @ApiOperation({ summary: 'Notes of a record (private notes need crm.notes.private.read unless you wrote them)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(NoteQuerySchema)) query: NoteQuery) {
        return this.notes.findAll(ctx, query);
    }

    @Post()
    @RequireAnyPermission(...ANY_UPDATE)
    @ApiOperation({ summary: 'Add a note to a record (needs the record update key)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateNoteDto) {
        return this.notes.create(ctx, dto);
    }

    @Patch(':id')
    @RequireAnyPermission(...ANY_UPDATE)
    @ApiOperation({ summary: 'Edit your note (edit history kept)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateNoteDto) {
        return this.notes.update(ctx, id, dto);
    }

    @Delete(':id')
    @RequireAnyPermission(...ANY_UPDATE)
    @ApiOperation({ summary: 'Delete a note (author, or holder of the record delete key)' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.notes.remove(ctx, id);
    }
}
