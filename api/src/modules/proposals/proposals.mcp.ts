import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey, ProposalApprovalDecision, ProposalLostReason } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { ProposalsService } from './proposals.service';
import { ProposalFlowService } from './proposal-flow.service';
import { ContentSchema, CreateProposalSchema, SendProposalSchema } from './dto/proposal.dto';
import { ProposalAnalyticsQuerySchema, ProposalQuerySchema } from './dto/proposal-query.schema';

const id = z.object({ id: z.string().uuid() });

/** MCP adapter — same service methods and validation as the REST endpoints. Sends, approvals and conversions are sensitive. */
@Injectable()
export class ProposalsMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly proposals: ProposalsService,
        private readonly flow: ProposalFlowService,
    ) { }

    onModuleInit() {
        const base = { module: ModuleKey.PROPOSALS, resource_type: 'proposal' };
        this.registry.registerMany([
            {
                ...base,
                name: 'proposals_proposals_list',
                description: 'List proposals. Filter by status (comma separated ProposalStatus), owner=me, company_id, deal_id, expiring_within_days, search.',
                permission: 'proposals.proposals.read',
                input: ProposalQuerySchema,
                handler: (ctx, args) => this.proposals.findAll(ctx, args),
            },
            {
                ...base,
                name: 'proposals_proposals_get',
                description: 'Get one proposal with its versions and the content (sections, line items, payment schedule, approvals) of a version (default current).',
                permission: 'proposals.proposals.read',
                input: id.extend({ version_id: z.string().uuid().optional() }),
                handler: (ctx, args) => this.proposals.findOne(ctx, args.id, args.version_id),
            },
            {
                ...base,
                name: 'proposals_proposals_create',
                description: 'Create a draft proposal for a CRM company/contact/deal, optionally from a template and with initial sections and line items. Totals are computed by the server.',
                permission: 'proposals.proposals.create',
                input: CreateProposalSchema,
                handler: (ctx, args) => this.proposals.create(ctx, args),
            },
            {
                ...base,
                name: 'proposals_proposals_update_content',
                description: 'Replace sections, line items and/or the payment schedule of a DRAFT version (sent versions are locked; create a version first).',
                permission: 'proposals.proposals.update',
                input: ContentSchema.extend({ id: z.string().uuid(), version_id: z.string().uuid() }),
                handler: (ctx, { id: pid, version_id, ...content }) => this.proposals.saveContent(ctx, pid, version_id, content),
            },
            {
                ...base,
                name: 'proposals_versions_create',
                description: 'Create a new draft version from the current version (or restore from from_version_id).',
                permission: 'proposals.proposals.update',
                input: id.extend({ from_version_id: z.string().uuid().optional(), change_summary: z.string().max(500).optional() }),
                handler: (ctx, { id: pid, ...dto }) => this.proposals.createVersion(ctx, pid, dto),
            },
            {
                ...base,
                name: 'proposals_proposals_submit_for_review',
                description: 'Submit the current draft version for internal approval (approval rules decide the steps).',
                permission: 'proposals.proposals.update',
                input: id.extend({ version_id: z.string().uuid(), approver_membership_ids: z.array(z.string().uuid()).max(10).optional(), note: z.string().max(2000).optional() }),
                handler: (ctx, { id: pid, version_id, ...dto }) => this.flow.submitForReview(ctx, pid, version_id, dto),
            },
            {
                ...base,
                name: 'proposals_proposals_approve',
                description: 'Decide an approval step assigned to the caller: APPROVED, REJECTED or CHANGES_REQUESTED (comment required unless approving).',
                permission: 'proposals.proposals.approve',
                sensitive: true,
                input: id.extend({ approval_id: z.string().uuid(), decision: z.enum([ProposalApprovalDecision.APPROVED, ProposalApprovalDecision.REJECTED, ProposalApprovalDecision.CHANGES_REQUESTED]), comment: z.string().max(4000).optional() }),
                handler: (ctx, { id: pid, approval_id, ...dto }) => this.flow.decide(ctx, pid, approval_id, dto),
            },
            {
                ...base,
                name: 'proposals_proposals_send_preview',
                description: 'Pre-send checklist for a proposal (what blocks sending).',
                permission: 'proposals.proposals.send',
                input: id.extend({ version_id: z.string().uuid().optional() }),
                handler: (ctx, args) => this.flow.sendPreview(ctx, args.id, args.version_id),
            },
            {
                ...base,
                name: 'proposals_proposals_send',
                description: 'Send a proposal to the customer (locks the version, creates the public link and email deliveries). Requires human confirmation.',
                permission: 'proposals.proposals.send',
                sensitive: true,
                input: SendProposalSchema.extend({ id: z.string().uuid() }),
                handler: (ctx, { id: pid, ...dto }) => this.flow.send(ctx, pid, dto),
            },
            {
                ...base,
                name: 'proposals_proposals_cancel',
                description: 'Cancel a proposal (the customer link stops working).',
                permission: 'proposals.proposals.cancel',
                sensitive: true,
                input: id,
                handler: (ctx, args) => this.proposals.cancel(ctx, args.id),
            },
            {
                ...base,
                name: 'proposals_proposals_mark_lost',
                description: 'Record that a proposal was lost, with a reason.',
                permission: 'proposals.proposals.update',
                input: id.extend({ lost_reason: z.nativeEnum(ProposalLostReason), note: z.string().max(2000).optional() }),
                handler: (ctx, { id: pid, ...dto }) => this.proposals.markLost(ctx, pid, dto),
            },
            {
                ...base,
                name: 'proposals_proposals_convert',
                description: 'Convert an accepted proposal into a draft contract (needs contracts.contracts.create too).',
                permission: 'proposals.proposals.convert',
                sensitive: true,
                input: id.extend({ contract_template_id: z.string().uuid().optional(), contract_type_id: z.string().uuid().optional(), contract_title: z.string().max(300).optional() }),
                handler: (ctx, { id: pid, ...dto }) => this.flow.convert(ctx, pid, dto),
            },
            {
                ...base,
                name: 'proposals_proposals_activity',
                description: 'Customer tracking for a proposal: views, comments, decisions and deliveries.',
                permission: 'proposals.proposals.read',
                input: id,
                handler: (ctx, args) => this.proposals.activity(ctx, args.id),
            },
            {
                ...base,
                name: 'proposals_analytics_read',
                description: 'Proposal analytics: sent, accepted, win rate, values, monthly trend, owners, lost reasons.',
                permission: 'proposals.analytics.read',
                input: ProposalAnalyticsQuerySchema,
                handler: (ctx, args) => this.flow.analytics(ctx, args),
            },
        ]);
    }
}
