import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { DocsPagesService } from './services/pages.service';
import { DocsSpacesService } from './services/spaces.service';
import { DocsChecklistsService } from './services/checklists.service';
import { DocsFormsService } from './services/forms.service';
import { CreateCommentSchema, DuplicatePageSchema, MovePageSchema, ReplaceContentSchema, CreatePageSchema, PageQuerySchema, SearchQuerySchema, UpdatePageSchema } from './dto/page.dto';
import { SpaceMemberSchema, SpaceQuerySchema } from './dto/space.dto';
import { ChecklistQuerySchema, StartChecklistRunSchema } from './dto/checklist.dto';
import { FormQuerySchema, SubmissionQuerySchema } from './dto/form.dto';
import { AskDocsSchema } from './dto/ai-transfer.dto';
import { DocsAiService } from './services/docs-ai.service';

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
        private readonly ai: DocsAiService,
    ) { }

    onModuleInit() {
        const M = ModuleKey.BUSINESS_DOCS;
        this.registry.registerMany([
            {
                name: 'docs_ai_ask', description: 'Ask a question about the company wiki. Answers cite only pages the caller can read ([1], [2] …); without an AI connection returns the best matching passages.',
                permission: 'docs.ai.query', module: M, resource_type: 'wiki_page', input: AskDocsSchema,
                handler: (ctx, args) => this.ai.ask(ctx, args),
            },
            {
                name: 'docs_pages_search', description: 'Keyword search over internal wiki pages (title + content). Returns snippets; only pages the caller may read.',
                permission: 'docs.pages.read', module: M, resource_type: 'wiki_page', input: SearchQuerySchema,
                handler: (ctx, args) => this.pages.search(ctx, args),
            },
            {
                name: 'docs_pages_list', description: 'List wiki pages, filtered by space, parent (use "root"), page type, owner or review state.',
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
                name: 'docs_pages_update', description: 'Update the title, icon, cover or markdown content of a wiki page; every edit is live and creates a new version.',
                permission: 'docs.pages.update', module: M, resource_type: 'wiki_page', input: UpdatePageSchema,
                handler: (ctx, { id: pageId, ...dto }) => this.pages.update(ctx, pageId, dto),
            },
            {
                name: 'docs_pages_reacknowledge', description: 'Ask readers to confirm a required-reading page again (the current version becomes the one to acknowledge).',
                permission: 'docs.pages.update', module: M, resource_type: 'wiki_page', input: id,
                handler: (ctx, args) => this.pages.requestReacknowledge(ctx, args.id),
            },
            {
                name: 'docs_pages_archive', description: 'Archive a wiki page.',
                permission: 'docs.pages.archive', module: M, resource_type: 'wiki_page', sensitive: true, input: id,
                handler: (ctx, args) => this.pages.setArchived(ctx, args.id, true),
            },
            {
                name: 'docs_pages_replace_content', description: 'Edit part of a page by exact text search-and-replace (Notion "update_content"). Each old_str must match exactly once unless replace_all. Prefer this over docs_pages_update for small edits.',
                permission: 'docs.pages.update', module: M, resource_type: 'wiki_page', input: ReplaceContentSchema,
                handler: (ctx, args) => this.pages.replaceContent(ctx, args.id, args.edits, args.change_summary),
            },
            {
                name: 'docs_pages_move', description: 'Move a page under another parent page, to the top level of a space (parent_page_id null) or to another space; optional sort_order.',
                permission: 'docs.pages.update', module: M, resource_type: 'wiki_page', input: MovePageSchema,
                handler: (ctx, { id: pageId, ...dto }) => this.pages.move(ctx, pageId, dto),
            },
            {
                name: 'docs_pages_duplicate', description: 'Duplicate a page, optionally with all its sub-pages, next to the original or under another parent/space.',
                permission: 'docs.pages.create', module: M, resource_type: 'wiki_page', input: DuplicatePageSchema,
                handler: (ctx, { id: pageId, ...dto }) => this.pages.duplicate(ctx, pageId, dto),
            },
            {
                name: 'docs_pages_trash', description: 'Move a page and its sub-pages to the trash (restorable).',
                permission: 'docs.pages.update', module: M, resource_type: 'wiki_page', sensitive: true, input: id,
                handler: (ctx, args) => this.pages.trash(ctx, args.id),
            },
            {
                name: 'docs_pages_restore', description: 'Restore a page from the trash.',
                permission: 'docs.pages.update', module: M, resource_type: 'wiki_page', input: id,
                handler: (ctx, args) => this.pages.restore(ctx, args.id),
            },
            {
                name: 'docs_pages_favorite', description: "Add or remove a page from the caller's favorites (sidebar).",
                permission: 'docs.pages.read', module: M, resource_type: 'wiki_page', input: z.object({ id: z.string().uuid(), favorite: z.boolean() }),
                handler: (ctx, args) => this.pages.setFavorite(ctx, args.id, args.favorite),
            },
            {
                name: 'docs_pages_comments_list', description: 'List the comments (threads, resolved state, block anchors) of a page.',
                permission: 'docs.pages.read', module: M, resource_type: 'wiki_page_comment', input: id,
                handler: (ctx, args) => this.pages.comments(ctx, args.id),
            },
            {
                name: 'docs_pages_comments_create', description: 'Comment on a page, reply to a thread (parent_comment_id) or anchor to a block (block_id); mention members by id.',
                permission: 'docs.pages.read', module: M, resource_type: 'wiki_page_comment', input: CreateCommentSchema,
                handler: (ctx, { id: pageId, ...dto }) => this.pages.addComment(ctx, pageId, dto),
            },
            {
                name: 'docs_pages_versions_list', description: 'Version history of a page (page history).',
                permission: 'docs.pages.read', module: M, resource_type: 'wiki_page_version', input: id,
                handler: (ctx, args) => this.pages.versions(ctx, args.id),
            },
            {
                name: 'docs_pages_version_restore', description: 'Restore an earlier version of a page (creates a new version).',
                permission: 'docs.pages.update', module: M, resource_type: 'wiki_page_version', input: z.object({ id: z.string().uuid(), version: z.number().int().min(1) }),
                handler: (ctx, args) => this.pages.restoreVersion(ctx, args.id, args.version),
            },
            {
                name: 'docs_pages_links_list', description: 'Backlinks and record links of a page.',
                permission: 'docs.pages.read', module: M, resource_type: 'wiki_page_link', input: id,
                handler: (ctx, args) => this.pages.links(ctx, args.id),
            },
            {
                name: 'docs_spaces_list', description: 'List wiki spaces the caller can read.',
                permission: 'docs.pages.read', module: M, resource_type: 'wiki_space', input: SpaceQuerySchema,
                handler: (ctx, args) => this.spaces.findAll(ctx, args),
            },
            {
                name: 'docs_spaces_members_list', description: 'List who has access to a space: members, teams (user groups), branches and roles, with their level.',
                permission: 'docs.pages.read', module: M, resource_type: 'wiki_space', input: id,
                handler: (ctx, args) => this.spaces.listMembers(ctx, args.id),
            },
            {
                name: 'docs_spaces_members_set', description: 'Give a member, team (group of users), branch or role access to a space (VIEW, COMMENT, EDIT, MANAGE) or change their level. Needs MANAGE on the space.',
                permission: 'docs.pages.read', module: M, resource_type: 'wiki_space', sensitive: true, input: SpaceMemberSchema,
                handler: (ctx, { id: spaceId, ...dto }) => this.spaces.upsertMember(ctx, spaceId, dto),
            },
            {
                name: 'docs_spaces_members_remove', description: 'Remove an access entry (member, team, branch or role) from a space.',
                permission: 'docs.pages.read', module: M, resource_type: 'wiki_space', sensitive: true, input: z.object({ id: z.string().uuid(), member_id: z.string().uuid() }),
                handler: (ctx, args) => this.spaces.removeMember(ctx, args.id, args.member_id),
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
