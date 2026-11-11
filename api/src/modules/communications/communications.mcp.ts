import { Injectable, OnModuleInit } from '@nestjs/common';
import { CommChannel, CommConsentStatus, ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { CampaignsService } from './campaigns/campaigns.service';
import { CampaignQuerySchema, CreateCampaignSchema, SetAudienceSchema } from './campaigns/dto/campaign.dto';
import { TemplatesService } from './templates/templates.service';
import { CreateTemplateSchema, TemplateContentSchema, TemplateQuerySchema } from './templates/dto/template.dto';
import { SegmentsService } from './audience/segments.service';
import { ListsService } from './audience/lists.service';
import { ComplianceService } from './audience/compliance.service';
import { ConsentQuerySchema, CreateRecipientListSchema, CreateSegmentSchema, CreateSuppressionSchema, ListMemberInputSchema, ListQuerySchema, SegmentQuerySchema } from './audience/dto/audience.dto';
import { SegmentNodeSchema } from './audience/segment-definition';
import { MessagesService } from './messages/messages.service';
import { MessageQuerySchema, SendMessageSchema } from './messages/dto/message.dto';
import { AnalyticsQuerySchema, AnalyticsService } from './analytics/analytics.service';
import { SendersService } from './senders/senders.service';

const M = ModuleKey.COMMUNICATION;
const id = z.object({ id: z.string().uuid() });

/** MCP adapter of module 11 — same service methods and validation as the REST controllers. */
@Injectable()
export class CommunicationsMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly campaigns: CampaignsService,
        private readonly templates: TemplatesService,
        private readonly segments: SegmentsService,
        private readonly lists: ListsService,
        private readonly compliance: ComplianceService,
        private readonly messages: MessagesService,
        private readonly analytics: AnalyticsService,
        private readonly senders: SendersService,
    ) { }

    onModuleInit() {
        this.registry.registerMany([
            // --- campaigns
            { name: 'communications_campaigns_list', description: 'List email / SMS campaigns (filter by status, channel, search).', permission: 'communications.campaigns.read', module: M, resource_type: 'campaign', input: CampaignQuerySchema, handler: (ctx, a) => this.campaigns.findAll(ctx, a) },
            { name: 'communications_campaigns_get', description: 'Get one campaign with its audience, approvals and runs.', permission: 'communications.campaigns.read', module: M, resource_type: 'campaign', input: id, handler: (ctx, a) => this.campaigns.findOne(ctx, a.id) },
            { name: 'communications_campaigns_stats', description: 'Delivery, open, click, bounce and unsubscribe numbers of a campaign.', permission: 'communications.campaigns.read', module: M, resource_type: 'campaign', input: id, handler: (ctx, a) => this.campaigns.stats(ctx, a.id) },
            { name: 'communications_campaigns_create', description: 'Create a draft campaign. Use {{first_name}}-style variables in subject / body. Audiences: [{ mode: INCLUDE|EXCLUDE, list_id | segment_id }].', permission: 'communications.campaigns.create', module: M, resource_type: 'campaign', input: CreateCampaignSchema, handler: (ctx, a) => this.campaigns.create(ctx, a) },
            { name: 'communications_campaigns_update', description: 'Update a draft campaign (content, sender, settings).', permission: 'communications.campaigns.update', module: M, resource_type: 'campaign', input: CreateCampaignSchema.partial().extend({ id: z.string().uuid() }), handler: (ctx, { id: cid, ...a }) => this.campaigns.update(ctx, cid, a) },
            { name: 'communications_campaigns_set_audience', description: 'Replace the audience of a draft campaign.', permission: 'communications.campaigns.update', module: M, resource_type: 'campaign', input: SetAudienceSchema, handler: (ctx, a) => this.campaigns.setAudience(ctx, a.id, a.audiences) },
            { name: 'communications_campaigns_preflight', description: 'Run the pre-send checks and count the audience after suppression and consent.', permission: 'communications.campaigns.read', module: M, resource_type: 'campaign', input: id, handler: (ctx, a) => this.campaigns.preflight(ctx, a.id) },
            { name: 'communications_campaigns_submit', description: 'Submit a draft campaign for approval.', permission: 'communications.campaigns.update', module: M, resource_type: 'campaign', input: id.extend({ comment: z.string().max(2000).optional() }), handler: (ctx, a) => this.campaigns.submit(ctx, a.id, { comment: a.comment }) },
            { name: 'communications_campaigns_approve', description: 'Approve (approve=true) or reject a campaign waiting for approval.', permission: 'communications.campaigns.approve', module: M, resource_type: 'campaign', sensitive: true, input: id.extend({ approve: z.boolean(), comment: z.string().max(2000).optional() }), handler: (ctx, a) => this.campaigns.decide(ctx, a.id, a.approve, a.comment) },
            { name: 'communications_campaigns_send', description: 'Send a campaign now, or schedule it with scheduled_at (ISO). Sends real email / SMS to customers.', permission: 'communications.campaigns.send', module: M, resource_type: 'campaign', sensitive: true, input: id.extend({ scheduled_at: z.string().datetime().optional() }), handler: (ctx, a) => this.campaigns.schedule(ctx, a.id, { scheduled_at: a.scheduled_at }) },
            { name: 'communications_campaigns_cancel', description: 'Cancel a scheduled, sending or paused campaign.', permission: 'communications.campaigns.send', module: M, resource_type: 'campaign', sensitive: true, input: id, handler: (ctx, a) => this.campaigns.cancel(ctx, a.id) },
            { name: 'communications_campaigns_archive', description: 'Archive a campaign.', permission: 'communications.campaigns.archive', module: M, resource_type: 'campaign', input: id, handler: (ctx, a) => this.campaigns.archive(ctx, a.id, true) },
            // --- templates
            { name: 'communications_templates_list', description: 'List email / SMS templates.', permission: 'communications.templates.read', module: M, resource_type: 'comm_template', input: TemplateQuerySchema, handler: (ctx, a) => this.templates.findAll(ctx, a) },
            { name: 'communications_templates_get', description: 'Get a template with its versions.', permission: 'communications.templates.read', module: M, resource_type: 'comm_template', input: id, handler: (ctx, a) => this.templates.findOne(ctx, a.id) },
            { name: 'communications_templates_create', description: 'Create a template (draft version 1). Variables: {{first_name}}, {{company_name}}, {{unsubscribe_url}} …', permission: 'communications.templates.create', module: M, resource_type: 'comm_template', input: CreateTemplateSchema, handler: (ctx, a) => this.templates.create(ctx, a) },
            { name: 'communications_templates_update', description: 'Save new content into the draft version of a template.', permission: 'communications.templates.update', module: M, resource_type: 'comm_template', input: TemplateContentSchema.extend({ id: z.string().uuid() }), handler: (ctx, { id: tid, ...a }) => this.templates.saveDraft(ctx, tid, a) },
            { name: 'communications_templates_publish', description: 'Publish a template version so campaigns and messages can use it.', permission: 'communications.templates.update', module: M, resource_type: 'comm_template', input: id.extend({ version_id: z.string().uuid() }), handler: (ctx, a) => this.templates.publish(ctx, a.id, a.version_id) },
            { name: 'communications_templates_preview', description: 'Render content with sample or contact values; reports missing variables and SMS segments.', permission: 'communications.templates.read', module: M, resource_type: 'comm_template', input: TemplateContentSchema.extend({ version_id: z.string().uuid().optional(), contact_id: z.string().uuid().optional() }), handler: (ctx, a) => this.templates.preview(ctx, a) },
            // --- audience
            { name: 'communications_segments_list', description: 'List saved segments.', permission: 'communications.segments.read', module: M, resource_type: 'segment', input: SegmentQuerySchema, handler: (ctx, a) => this.segments.findAll(ctx, a) },
            { name: 'communications_segments_fields', description: 'Fields and operators available for segment definitions.', permission: 'communications.segments.read', module: M, resource_type: 'segment', input: z.object({}), handler: async () => this.segments.fields() },
            { name: 'communications_segments_preview', description: 'Count contacts matching a definition { and: [ { field, op, value } ] } without saving.', permission: 'communications.segments.read', module: M, resource_type: 'segment', input: z.object({ definition: SegmentNodeSchema, channel: z.nativeEnum(CommChannel).optional() }), handler: (ctx, a) => this.segments.preview(ctx, { definition: a.definition as Record<string, unknown>, channel: a.channel }) },
            { name: 'communications_segments_create', description: 'Save a segment.', permission: 'communications.segments.create', module: M, resource_type: 'segment', input: CreateSegmentSchema, handler: (ctx, a) => this.segments.create(ctx, { ...a, definition: a.definition as Record<string, unknown> }) },
            { name: 'communications_recipient_lists_read', description: 'List recipient lists.', permission: 'communications.recipient_lists.read', module: M, resource_type: 'comm_recipient_list', input: ListQuerySchema, handler: (ctx, a) => this.lists.findAll(ctx, a) },
            { name: 'communications_recipient_lists_create', description: 'Create a recipient list.', permission: 'communications.recipient_lists.create', module: M, resource_type: 'comm_recipient_list', input: CreateRecipientListSchema, handler: (ctx, a) => this.lists.create(ctx, a) },
            { name: 'communications_recipient_lists_update', description: 'Add members (CRM contacts, members or external addresses) to a list.', permission: 'communications.recipient_lists.update', module: M, resource_type: 'comm_recipient_list', input: id.extend({ members: z.array(ListMemberInputSchema).max(5000) }), handler: (ctx, a) => this.lists.addMembers(ctx, a.id, a.members) },
            { name: 'communications_consents_read', description: 'List consent records (filter by channel / status).', permission: 'communications.consents.read', module: M, resource_type: 'comm_consent', input: ConsentQuerySchema, handler: (ctx, a) => this.compliance.consents(ctx, a) },
            { name: 'communications_consents_manage', description: 'Set the consent of a contact on a channel.', permission: 'communications.consents.manage', module: M, resource_type: 'comm_consent', sensitive: true, input: z.object({ contact_id: z.string().uuid(), channel: z.nativeEnum(CommChannel), status: z.nativeEnum(CommConsentStatus), notes: z.string().max(2000).optional() }), handler: (ctx, a) => this.compliance.setConsent(ctx, a.contact_id, a.channel, { status: a.status, notes: a.notes, source: 'API' }) },
            { name: 'communications_suppressions_manage', description: 'Add an address to the suppression list.', permission: 'communications.suppressions.manage', module: M, resource_type: 'comm_suppression', sensitive: true, input: CreateSuppressionSchema, handler: (ctx, a) => this.compliance.addSuppression(ctx, a) },
            // --- messages
            { name: 'communications_messages_read', description: 'Search the message log (email / SMS history).', permission: 'communications.messages.read', module: M, resource_type: 'comm_message', input: MessageQuerySchema, handler: (ctx, a) => this.messages.findAll(ctx, a) },
            { name: 'communications_messages_get', description: 'Get one message with delivery events.', permission: 'communications.messages.read', module: M, resource_type: 'comm_message', input: id, handler: (ctx, a) => this.messages.findOne(ctx, a.id) },
            { name: 'communications_messages_send', description: 'Send a one-off email or SMS to a contact or address (optionally from a template, or scheduled).', permission: 'communications.messages.send', module: M, resource_type: 'comm_message', sensitive: true, input: SendMessageSchema, handler: (ctx, a) => this.messages.create(ctx, a) },
            // --- analytics & senders
            { name: 'communications_analytics_read', description: 'Sent, delivery, open, click and bounce totals for a period (from / to YYYY-MM-DD).', permission: 'communications.analytics.read', module: M, resource_type: 'comm_daily_stat', input: AnalyticsQuerySchema, handler: (ctx, a) => this.analytics.summary(ctx, a) },
            { name: 'communications_sender_identities_manage', description: 'List sender identities and their verification status.', permission: 'communications.sender_identities.manage', module: M, resource_type: 'comm_sender_identity', input: z.object({ channel: z.nativeEnum(CommChannel).optional() }), handler: (ctx, a) => this.senders.listIdentities(ctx, a.channel) },
        ]);
    }
}
