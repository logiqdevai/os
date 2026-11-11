import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { DocsPagesService } from './services/pages.service';
import { DocsSpacesService } from './services/spaces.service';
import { DocsChecklistsService } from './services/checklists.service';
import { DocsFormsService } from './services/forms.service';
import { CreatePageSchema, PageQuerySchema, SearchQuerySchema, UpdatePageSchema } from './dto/page.dto';
import { SpaceQuerySchema } from './dto/space.dto';
import { ChecklistQuerySchema, StartChecklistRunSchema } from './dto/checklist.dto';
import { FormQuerySchema, SubmissionQuerySchema } from './dto/form.dto';

const id = z.object({ id: z.string().uuid() });

/** MCP tools for Business Docs (15 §10) — same services and validation as the REST controllers. */
@Injectable()
export class DocsMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly pages: DocsPagesService,
        private readonly spaces: DocsSpacesService,
        private readonly checklists: DocsChecklistsService,
        private readonly forms: DocsFormsService,
    ) { }

    onModuleInit() {
        const M = ModuleKey.BUSINESS_DOCS;
        this.registry.registerMany([
            {
                name: 'docs_pages_search', description: 'Keyword search over internal wiki pages (title + content). Returns snippets; only pages the caller may read.',
                permission: 'docs.pages.read', module: M, resource_type: 'wiki_page', input: SearchQuerySchema,
                handler: (ctx, args) => this.pages.search(ctx, args),
            },
            {
                name: 'docs_pages_list', description: 'List wiki pages, filtered by space, parent (use "root"), status, page type, owner or review state.',
                permission: 'docs.pages.read', module: M, resource_type: 'wiki_page', input: PageQuerySchema,
                handler: (ctx, args) => this.pages.findAll(ctx, args),
            },
            {
                name: 'docs_pages_get', description: 'Get one wiki page with its markdown content, breadcrumbs and child pages.',
                permission: 'docs.pages.read', module: M, resource_type: 'wiki_page', input: id,
                handler: (ctx, args) => this.pages.findOne(ctx, args.id),
            },
            {
                name: 'docs_pages_create', description: 'Create a wiki page (markdown content) in a space, optionally under a parent page or from a template.',
                permission: 'docs.pages.create', module: M, resource_type: 'wiki_page', input: CreatePageSchema,
                handler: (ctx, args) => this.pages.create(ctx, args),
            },
            {
                name: 'docs_pages_update', description: 'Update the title or markdown content of a wiki page; creates a new version.',
                permission: 'docs.pages.update', module: M, resource_type: 'wiki_page', input: UpdatePageSchema,
                handler: (ctx, { id: pageId, ...dto }) => this.pages.update(ctx, pageId, dto),
            },
            {
                name: 'docs_pages_publish', description: 'Publish the current version of a wiki page.',
                permission: 'docs.pages.publish', module: M, resource_type: 'wiki_page', sensitive: true,
                input: z.object({ id: z.string().uuid(), change_summary: z.string().max(500).optional() }),
                handler: (ctx, args) => this.pages.publish(ctx, args.id, args.change_summary),
            },
            {
                name: 'docs_pages_archive', description: 'Archive a wiki page.',
                permission: 'docs.pages.archive', module: M, resource_type: 'wiki_page', sensitive: true, input: id,
                handler: (ctx, args) => this.pages.setArchived(ctx, args.id, true),
            },
            {
                name: 'docs_spaces_list', description: 'List wiki spaces the caller can read.',
                permission: 'docs.pages.read', module: M, resource_type: 'wiki_space', input: SpaceQuerySchema,
                handler: (ctx, args) => this.spaces.findAll(ctx, args),
            },
            {
                name: 'docs_spaces_tree', description: 'Page tree (flat list with parent ids) of a space, by id or slug.',
                permission: 'docs.pages.read', module: M, resource_type: 'wiki_space', input: z.object({ space: z.string().min(1) }),
                handler: (ctx, args) => this.pages.tree(ctx, args.space),
            },
            {
                name: 'docs_checklists_list', description: 'List onboarding / offboarding checklists.',
                permission: 'docs.pages.read', module: M, resource_type: 'wiki_checklist', input: ChecklistQuerySchema,
                handler: (ctx, args) => this.checklists.findAll(ctx, args),
            },
            {
                name: 'docs_checklists_run_start', description: 'Start an onboarding / offboarding checklist run for a member.',
                permission: 'docs.checklists.manage', module: M, resource_type: 'wiki_checklist_run', input: StartChecklistRunSchema,
                handler: (ctx, args) => this.checklists.startRun(ctx, args.checklist_id, { subject_membership_id: args.subject_membership_id, due_at: args.due_at }),
            },
            {
                name: 'docs_forms_list', description: 'List custom forms (surveys, requests, check-ins).',
                permission: 'docs.forms.read', module: M, resource_type: 'custom_form', input: FormQuerySchema,
                handler: (ctx, args) => this.forms.findAll(ctx, args),
            },
            {
                name: 'docs_forms_responses_list', description: 'List responses of a form (anonymous forms need docs.forms.anonymous_responses.read).',
                permission: 'docs.forms.read', module: M, resource_type: 'form_submission', input: SubmissionQuerySchema.extend({ id: z.string().uuid() }),
                handler: (ctx, { id: formId, ...query }) => this.forms.submissions(ctx, formId, query),
            },
            {
                name: 'docs_forms_summary', description: 'Per-question summary of a form\'s responses.',
                permission: 'docs.forms.read', module: M, resource_type: 'custom_form', input: id,
                handler: (ctx, args) => this.forms.summary(ctx, args.id),
            },
        ]);
    }
}
