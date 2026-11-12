# Communication Center

> Linear: [LOG-106](https://linear.app/logiqdev/issue/LOG-106/communication-center) · Status: Backlog

> **Canonical for:** outbound email and SMS: sending, templates, campaigns, segmentation, scheduling, delivery tracking, communication history and analytics. It is also the **delivery provider** for the email and SMS channels of 14 Notifications.
>
> **Boundaries:** [12 Messaging](./12-messaging-team-communication.md) owns internal chat and project/customer channels. [13 Customer Support](./13-customer-support-communication-hub.md) owns inbound customer conversations, including inbound email and email-to-ticket. [14 Notifications](./14-notifications-activity-center.md) owns notification events, preferences and inbox. [02 CRM](./02-crm-sales-management.md) owns contacts and companies. This module does not own contacts, notifications or conversations.
>
> **Depends on:** [01](./01-users-organizations-permissions.md) (LOG-406) for permissions, branding (01 §15) and localization · [02 CRM](./02-crm-sales-management.md) (LOG-404) for recipients and segmentation fields · [08 Finance](./08-financial-management-stripe-integration.md) (LOG-104) for billing state in segments and invoice emails · [20 Automation Engine](./20-automation-engine.md) (LOG-410) for triggered communications · [17 Documents](./17-documents-file-management.md) (LOG-407) for attachments.
>
> **Consumed by:** 03 Proposals (delivery emails), 04 Contracts (signature emails via provider or 11), 08 Finance (invoice and reminder emails), 13 Support (outbound replies by email), 14 Notifications (email and SMS channels), 10 Employees (announcements).

Develop a centralized **Communication Center** that enables agencies to manage all customer communications from a single platform. The module should support email and SMS messaging for both individual customers and bulk campaigns while integrating seamlessly with projects, billing, support, and customer management.

The Communication Center should serve as the agency's primary communication hub, allowing users to send personalized, automated, and AI-assisted messages throughout the customer lifecycle.

---

<!-- schema-refs:start -->

## Data model (Prisma)

> Generated from [`api/prisma/schema.prisma`](../../api/prisma/schema.prisma) by `node docs/scripts/sync-feature-schema-refs.mjs` — do not edit by hand.
> Before implementing API or app code for this module, read these models in the schema and reuse the existing
> tables, enums and services of the modules listed under "Reuses". Never redefine a table owned by another module.

**Platform tables to reuse, not rebuild:** `audit_events` (activity & change history, [01](./01-users-organizations-permissions.md)) · `custom_field_definitions` (custom fields, [02](./02-crm-sales-management.md)) · `taggings` (tags, [02](./02-crm-sales-management.md)) · `saved_views` (saved views, [02](./02-crm-sales-management.md)) · `crm_notes` (notes, polymorphic by entity type, [02](./02-crm-sales-management.md)) · `number_sequences` (document numbering, [03](./03-proposal-quotation-generator.md)) · `signature_requests` (e-signatures, [04](./04-contracts.md)) · `provider_webhook_events` (idempotent provider webhooks, [08](./08-financial-management-stripe-integration.md))

### Owned tables (30)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| **Providers & sender identities** | | | |
| `CommProviderAccount` | `comm_provider_accounts` | [L11752](../../api/prisma/schema.prisma#L11752) | 11 "Email Management", "SMS Management" — a configured delivery provider account (API key stored encrypted / as a secret reference). One default per channel … |
| `CommSenderDomain` | `comm_sender_domains` | [L11783](../../api/prisma/schema.prisma#L11783) | 11 "Email Management" — a sending domain with DNS verification (SPF / DKIM / DMARC / return-path). Distinct from organization_domains (01 §70), which are log… |
| `CommSenderIdentity` | `comm_sender_identities` | [L11815](../../api/prisma/schema.prisma#L11815) | 11 "Email Management", "SMS Management" — a verified from-address (email) or sender number / alphanumeric sender id (SMS). May be scoped to a Branch (01 §120… |
| `CommSignature` | `comm_signatures` | [L11853](../../api/prisma/schema.prisma#L11853) | 11 "Email Management" — email signatures; organization-wide when membership_id is null, personal otherwise. |
| **Templates** | | | |
| `CommTemplate` | `comm_templates` | [L11876](../../api/prisma/schema.prisma#L11876) | 11 "Communication Templates" — reusable email / SMS template. Content lives in versions; the published version is pointed to by current_version_id. Variables… |
| `CommTemplateVersion` | `comm_template_versions` | [L11927](../../api/prisma/schema.prisma#L11927) | 11 "Communication Templates" — immutable content snapshot per version: subject, preheader, HTML body, plain-text body, editor design JSON. Conditional conten… |
| `CommTemplateTranslation` | `comm_template_translations` | [L11964](../../api/prisma/schema.prisma#L11964) | 11 "Communication Templates" — multiple languages: a localized subject/body for a template version, selected by recipient language (02 CrmContact.language, 0… |
| **Messages** | | | |
| `CommThread` | `comm_threads` | [L11990](../../api/prisma/schema.prisma#L11990) | 11 "Email Management", "Conversation threads" — groups outbound emails and their inbound replies (captured by 13 and linked by support_conversation_id) under… |
| `CommMessage` | `comm_messages` | [L12026](../../api/prisma/schema.prisma#L12026) | 11 "Email Management", "SMS Management", "Communication History", "Scheduling", "Delivery Tracking" — one outbound email or SMS to one primary recipient (cc/… |
| `CommMessageRecipient` | `comm_message_recipients` | [L12190](../../api/prisma/schema.prisma#L12190) | 11 "Email Management" — every recipient of a message (the primary TO is duplicated here so per-recipient delivery status is uniform), plus cc / bcc. |
| `CommMessageAttachment` | `comm_message_attachments` | [L12225](../../api/prisma/schema.prisma#L12225) | 11 "Email Management" — file attachments and inline images. Files are Documents (17); id only. |
| `CommMessageLink` | `comm_message_links` | [L12250](../../api/prisma/schema.prisma#L12250) | 11 "Customer Communication", "Communication History" — polymorphic link from a message to the records it concerns (CRM_COMPANY / CRM_CONTACT / PROJECT / INVO… |
| `CommDeliveryEvent` | `comm_delivery_events` | [L12268](../../api/prisma/schema.prisma#L12268) | 11 "Delivery Tracking" — append-only provider events (webhooks and sync). Idempotent through provider_webhook_events (08) and the (provider, provider_event_i… |
| `CommTrackedLink` | `comm_tracked_links` | [L12306](../../api/prisma/schema.prisma#L12306) | 11 "Delivery Tracking", "Analytics & Reporting" — rewritten links for click tracking, per message (one-off sends) or per campaign (shared across its messages). |
| **Recipients, segments, consent & suppression** | | | |
| `CommRecipientList` | `comm_recipient_lists` | [L12333](../../api/prisma/schema.prisma#L12333) | 11 "Recipients" — a static recipient list of CRM contacts and/or members. Dynamic audiences are Segments. |
| `CommRecipientListMember` | `comm_recipient_list_members` | [L12356](../../api/prisma/schema.prisma#L12356) | 11 "Recipients" — list membership: a CRM contact, a member, or an external address. |
| `Segment` | `segments` | [L12381](../../api/prisma/schema.prisma#L12381) | 11 "Customer Segmentation" — a saved filter over CRM companies/contacts (02 §29 saved views, §24 custom fields, §36 tags) combined with billing state (08) an… |
| `CommConsent` | `comm_consents` | [L12415](../../api/prisma/schema.prisma#L12415) | 11 "Recipients" — consent / opt-in / unsubscribe state per CRM contact and channel, with evidence. Source of truth for marketing sends; CrmContact.consent (0… |
| `CommSuppression` | `comm_suppressions` | [L12447](../../api/prisma/schema.prisma#L12447) | 11 "Recipients", "Delivery Tracking" — suppression list: addresses that must not be contacted on a channel (unsubscribes, hard bounces, complaints, manual). … |
| **Campaigns** | | | |
| `Campaign` | `campaigns` | [L12486](../../api/prisma/schema.prisma#L12486) | 11 "Marketing Campaigns", "Scheduling", "Internal Collaboration", "Analytics & Reporting" — a bulk email or SMS send to an audience built from lists and segm… |
| `CampaignAudience` | `campaign_audiences` | [L12609](../../api/prisma/schema.prisma#L12609) | 11 "Marketing Campaigns", "Customer Segmentation" — audience sources of a campaign: recipient lists and segments, included or excluded. Resolved into Campaig… |
| `CampaignRecipient` | `campaign_recipients` | [L12630](../../api/prisma/schema.prisma#L12630) | 11 "Marketing Campaigns", "Delivery Tracking" — resolved audience: one row per recipient per campaign (per run for recurring campaigns). Links to the CommMes… |
| `CampaignRun` | `campaign_runs` | [L12669](../../api/prisma/schema.prisma#L12669) | 11 "Scheduling" — one execution of a campaign (recurring campaigns have many; one-off campaigns one). |
| `CampaignApproval` | `campaign_approvals` | [L12696](../../api/prisma/schema.prisma#L12696) | 11 "Internal Collaboration" — campaign review / approval by a member before sending. |
| **Analytics & AI** | | | |
| `CommDailyStat` | `comm_daily_stats` | [L12717](../../api/prisma/schema.prisma#L12717) | 11 "Analytics & Reporting" — daily rollup per organization / channel / kind (and per campaign) used for sent counts, open / click / reply / bounce / delivery… |
| `CommAiGeneration` | `comm_ai_generations` | [L12748](../../api/prisma/schema.prisma#L12748) | 11 "AI Communication Assistant" — a request to the assistant and its output (draft, rewrite, translation, subject lines, summary). Linked to the message / te… |
| `CampaignVariant` | `campaign_variants` | [L12787](../../api/prisma/schema.prisma#L12787) | 11 "Marketing Campaigns" — an A/B test variant of a campaign (subject / content). The test is configured on the campaign (ab_test_enabled, ab_metric, ab_test… |
| `CommTopic` | `comm_topics` | [L12815](../../api/prisma/schema.prisma#L12815) | 11 "Customer Communication", "Recipients" — a preference-center topic (newsletter, product news, billing notices) a contact can subscribe to. |
| `CommTopicSubscription` | `comm_topic_subscriptions` | [L12840](../../api/prisma/schema.prisma#L12840) | 11 "Customer Communication", "Recipients" — a contact's per-topic opt-in state. Channel-level consent stays in CommConsent; a topic send requires both. |
| `CommSettings` | `comm_settings` | [L12862](../../api/prisma/schema.prisma#L12862) | 11 "Email Management", "Scheduling", "Customer Communication" — organization-wide communication policy: approval, quiet hours, frequency cap, footer address,… |

**Owned enums (27):** `CommChannel`, `CommMessageKind`, `CommMessageSource`, `CommMessageStatus`, `CommDeliveryEventType`, `CommBounceType`, `CommRecipientKind`, `CommRecipientRole`, `CommRecipientStatus`, `CommTemplateCategory`, `CommTemplateKind`, `CommTemplateStatus`, `CommTemplateVersionStatus`, `CommProviderKind`, `CommProviderAccountStatus`, `CommSenderDomainStatus`, `CommSenderIdentityStatus`, `CampaignStatus`, `CampaignApprovalDecision`, `CampaignAudienceMode`, `CampaignRunStatus`, `SegmentEntityType`, `CommConsentStatus`, `CommConsentSource`, `CommSuppressionReason`, `CommAiTaskKind`, `CampaignAbMetric`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `Branch` (`branches`) | `Campaign.branch`, `CommMessage.branch`, `CommSenderIdentity.branch`, `CommTemplate.branch` |
| [01](./01-users-organizations-permissions.md) | `IntegrationConnection` (`integration_connections`) | `CommProviderAccount.integration_connection` |
| [01](./01-users-organizations-permissions.md) | `Membership` (`memberships`) | `Campaign.approved_by`, `Campaign.created_by`, `Campaign.owner`, `CampaignApproval.approver` +13 more |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `Campaign.organization`, `CommAiGeneration.organization`, `CommConsent.organization`, `CommDailyStat.organization` +15 more |
| [02](./02-crm-sales-management.md) | `CrmCompany` (`crm_companies`) | `CommMessage.company`, `CommThread.company` |
| [02](./02-crm-sales-management.md) | `CrmContact` (`crm_contacts`) | `CampaignRecipient.contact`, `CommConsent.contact`, `CommMessage.recipient_contact`, `CommMessageRecipient.contact` +4 more |
| [02](./02-crm-sales-management.md) | `SavedView` (`saved_views`) | `Segment.saved_view` |
| [05](./05-project-management.md) | `Project` (`projects`) | `CommMessage.project`, `CommThread.project` |
| [08](./08-financial-management-stripe-integration.md) | `ProviderWebhookEvent` (`provider_webhook_events`) | `CommDeliveryEvent.provider_webhook_event` |

**Reused enums:** `RecordEntityType` ([02](./02-crm-sales-management.md))

### Referenced by other modules

- [01](./01-users-organizations-permissions.md): `Organization`
- [02](./02-crm-sales-management.md): `CrmActivity`
- [03](./03-proposal-quotation-generator.md): `ProposalDelivery`
- [08](./08-financial-management-stripe-integration.md): `Invoice`, `InvoiceReminder`

### Plain-id references from other modules

Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.

- `CrmContact.consent` ([02](./02-crm-sales-management.md), [L2922](../../api/prisma/schema.prisma#L2922)) — Marketing consent per channel (consumed by 11 Communication Center).
- `CrmActivity.comm_message_id` ([02](./02-crm-sales-management.md), [L3238](../../api/prisma/schema.prisma#L3238)) — 02 §13 — logged EMAIL: the real message in Communication Center (11); id only.
- `ProposalDelivery.communication_id` ([03](./03-proposal-quotation-generator.md), [L4217](../../api/prisma/schema.prisma#L4217)) — Communication record id (11); id only.
- `Invoice.sent_communication_id` ([08](./08-financial-management-stripe-integration.md), [L7588](../../api/prisma/schema.prisma#L7588)) — 08 "Invoicing" — the e-mail (11) that delivered the invoice; id of the CommMessage.
- `SupportChannel.sender_identity_id` ([13](./13-customer-support-communication-hub.md), [L14711](../../api/prisma/schema.prisma#L14711)) — 11 SenderIdentity used for outbound replies from this channel; id only.
- `SupportCsatRating.token` ([13](./13-customer-support-communication-hub.md), [L15391](../../api/prisma/schema.prisma#L15391)) — Opaque token for the rating link in emails (11).
- `NotificationDelivery.comm_message_id` ([14](./14-notifications-activity-center.md), [L16087](../../api/prisma/schema.prisma#L16087)) — 11 CommMessage id for EMAIL / SMS deliveries.
- `NotificationOrgSettings.email_sender_identity_id` ([14](./14-notifications-activity-center.md), [L16186](../../api/prisma/schema.prisma#L16186)) — 11 SenderIdentity used for notification emails / SMS.
- `NotificationDigest.comm_message_id` ([14](./14-notifications-activity-center.md), [L16380](../../api/prisma/schema.prisma#L16380)) — 11 CommMessage id of the sent digest (EMAIL / SMS).

<!-- schema-refs:end -->

<!-- access-channels:start -->

## Access channels & permissions

> Generated by `node docs/scripts/sync-feature-schema-refs.mjs` — do not edit by hand. Standard: [Product Specification §4a](../Product_Specification.md). Rules: `.cursor/rules/roles-and-permissions-in-every-feature.mdc`.

Every capability of this module is built for **all access channels at once**. Each channel goes through the central authorization service ([01 §136](./01-users-organizations-permissions.md)) and the same permission keys, so roles and permissions exist from the first commit and are never added later.

| Channel | Required for this module |
| -- | -- |
| UI | Routes, navigation, buttons and fields gated by permission key; no-access state for `403`/`404` |
| REST API | One endpoint per resource action with `@RequirePermission`, organization taken from the credential, lists filtered by branch/team/project scope |
| MCP | A tool `<module>_<resource>_<action>` per agent-useful action, a thin adapter over the same service and validation, listed only to callers holding the key; sensitive tools need human confirmation when an AI agent calls them |
| API key / service account | Explicit permission keys and scope, never a human's full access; usable on every endpoint and MCP tool of this module; audit actor `SERVICE_ACCOUNT` |
| Webhooks and automation | Events, triggers and actions registered with [20](./20-automation-engine.md); automation runs as a service account or membership with the same checks |

**Permission keys in the catalog today** (`api/prisma/seed/permission-catalog.ts`, 40 keys; `*` = sensitive):

| Resource key prefix | Actions |
| -- | -- |
| `communications.ai` | use |
| `communications.analytics` | read |
| `communications.campaigns` | read, create, update, delete*, archive, export*, send*, approve* |
| `communications.consents` | read, manage* |
| `communications.messages` | read, create, update, delete*, archive, export*, send* |
| `communications.recipient_lists` | read, create, update, delete*, archive, export* |
| `communications.segments` | read, create, update, delete*, archive, export* |
| `communications.sender_identities` | manage* |
| `communications.settings` | manage* |
| `communications.suppressions` | manage* |
| `communications.templates` | read, create, update, delete*, archive, export* |

Definition of done for each resource of this module: permission keys in the catalog and in the role templates, seed re-run, REST endpoint, MCP tool, service-account and API-key access verified, webhook events and automation triggers declared, audit events written, tests for allow / deny / wrong scope / wrong organization.

<!-- access-channels:end -->

## Email Management

<!-- schema-section:start -->
> **Schema:** `CommMessage` ([comm_messages](../../api/prisma/schema.prisma#L12026)) · `CommMessageAttachment` ([comm_message_attachments](../../api/prisma/schema.prisma#L12225)) · `CommMessageRecipient` ([comm_message_recipients](../../api/prisma/schema.prisma#L12190)) · `CommProviderAccount` ([comm_provider_accounts](../../api/prisma/schema.prisma#L11752)) · `CommSenderDomain` ([comm_sender_domains](../../api/prisma/schema.prisma#L11783)) · `CommSenderIdentity` ([comm_sender_identities](../../api/prisma/schema.prisma#L11815)) · `CommSettings` ([comm_settings](../../api/prisma/schema.prisma#L12862)) · `CommSignature` ([comm_signatures](../../api/prisma/schema.prisma#L11853)) · `CommThread` ([comm_threads](../../api/prisma/schema.prisma#L11990)) · enum `CommChannel` ([L11476](../../api/prisma/schema.prisma#L11476)) · enum `CommProviderKind` ([L11624](../../api/prisma/schema.prisma#L11624)) · enum `CommRecipientRole` ([L11546](../../api/prisma/schema.prisma#L11546)) · enum `CommSenderDomainStatus` ([L11644](../../api/prisma/schema.prisma#L11644)) · enum `CommSenderIdentityStatus` ([L11652](../../api/prisma/schema.prisma#L11652))
<!-- schema-section:end -->

> **Provider credentials (email and SMS).** An organization sends with its own provider accounts. At launch: Resend for email and Twilio for SMS; the other `CommProviderKind` values (SendGrid, Postmark, Mailgun, Amazon SES, SMTP, Vonage, MessageBird) are reserved until their adapter and an Integration provider value are added. The API keys and webhook secrets are entered in Admin → Integrations (01 §156–§161) and stored encrypted in an Integration Connection of category Email or SMS. A `CommProviderAccount` points at that connection and holds only the channel, defaults, sender domains and identities. No provider key is read from the platform `.env` for organization messages (01 §160), and a channel with no Active connection shows "connect a provider" instead of sending.

<!-- schema-section:start -->
> **Schema:** `CommMessage` ([comm_messages](../../api/prisma/schema.prisma#L9951)) · `CommMessageAttachment` ([comm_message_attachments](../../api/prisma/schema.prisma#L10148)) · `CommMessageRecipient` ([comm_message_recipients](../../api/prisma/schema.prisma#L10113)) · `CommProviderAccount` ([comm_provider_accounts](../../api/prisma/schema.prisma#L9677)) · `CommSenderDomain` ([comm_sender_domains](../../api/prisma/schema.prisma#L9708)) · `CommSenderIdentity` ([comm_sender_identities](../../api/prisma/schema.prisma#L9740)) · `CommSignature` ([comm_signatures](../../api/prisma/schema.prisma#L9778)) · `CommThread` ([comm_threads](../../api/prisma/schema.prisma#L9915)) · enum `CommChannel` ([L9401](../../api/prisma/schema.prisma#L9401)) · enum `CommProviderKind` ([L9549](../../api/prisma/schema.prisma#L9549)) · enum `CommRecipientRole` ([L9471](../../api/prisma/schema.prisma#L9471)) · enum `CommSenderDomainStatus` ([L9569](../../api/prisma/schema.prisma#L9569)) · enum `CommSenderIdentityStatus` ([L9577](../../api/prisma/schema.prisma#L9577))
<!-- schema-section:end -->

Support professional email communication including:

* Individual email sending
* Bulk email campaigns
* Rich HTML emails
* Plain text emails
* Responsive email templates
* Branded email layouts
* Email signatures
* File attachments
* Inline images
* Scheduled sending
* Draft emails
* Email previews
* Email history
* Email search
* Conversation threads
* Email archiving

---

## SMS Management

<!-- schema-section:start -->
> **Schema:** `CommMessage` ([comm_messages](../../api/prisma/schema.prisma#L12026)) · `CommProviderAccount` ([comm_provider_accounts](../../api/prisma/schema.prisma#L11752)) · `CommSenderIdentity` ([comm_sender_identities](../../api/prisma/schema.prisma#L11815)) · enum `CommChannel` ([L11476](../../api/prisma/schema.prisma#L11476)) · enum `CommSenderIdentityStatus` ([L11652](../../api/prisma/schema.prisma#L11652))
<!-- schema-section:end -->

Support SMS communication including:

* Individual SMS
* Bulk SMS campaigns
* Scheduled SMS
* SMS templates
* Personalized messages
* Delivery tracking
* Failed delivery tracking
* SMS history
* SMS search
* Campaign management

---

## Communication Templates

<!-- schema-section:start -->
> **Schema:** `CommTemplate` ([comm_templates](../../api/prisma/schema.prisma#L11876)) · `CommTemplateTranslation` ([comm_template_translations](../../api/prisma/schema.prisma#L11964)) · `CommTemplateVersion` ([comm_template_versions](../../api/prisma/schema.prisma#L11927)) · enum `CommTemplateCategory` ([L11568](../../api/prisma/schema.prisma#L11568)) · enum `CommTemplateKind` ([L11603](../../api/prisma/schema.prisma#L11603)) · enum `CommTemplateVersionStatus` ([L11617](../../api/prisma/schema.prisma#L11617))
<!-- schema-section:end -->

Provide reusable templates for common communications.

Support templates for:

* Project updates
* Milestone completion
* Invoice notifications
* Payment confirmations
* Payment reminders
* Subscription renewals
* Welcome emails
* Customer onboarding
* Meeting reminders
* Maintenance announcements
* Service interruptions
* Support responses
* Marketing campaigns
* Holiday greetings

Templates should support:

* Variables and placeholders
* Dynamic customer data (02), project information (05), billing information (08)
* Conditional content
* Organization and branch branding consumed from 01 §15 and §120
* Multiple languages
* Template categories

---

## Customer Communication

<!-- schema-section:start -->
> **Schema:** `CommMessageLink` ([comm_message_links](../../api/prisma/schema.prisma#L12250)) · `CommSettings` ([comm_settings](../../api/prisma/schema.prisma#L12862)) · `CommTopic` ([comm_topics](../../api/prisma/schema.prisma#L12815)) · `CommTopicSubscription` ([comm_topic_subscriptions](../../api/prisma/schema.prisma#L12840))
<!-- schema-section:end -->

Allow agencies to communicate directly with customers regarding:

* Project progress
* Development updates
* Milestone completion
* Feature releases
* Bug fixes
* Maintenance windows
* Downtime notifications
* Meeting invitations
* Approval requests
* Feedback requests
* Support updates
* Contract renewals
* General announcements

All communication should be linked to the relevant customer and project for complete history and traceability.

---

## Marketing Campaigns

<!-- schema-section:start -->
> **Schema:** `Campaign` ([campaigns](../../api/prisma/schema.prisma#L12486)) · `CampaignAudience` ([campaign_audiences](../../api/prisma/schema.prisma#L12609)) · `CampaignRecipient` ([campaign_recipients](../../api/prisma/schema.prisma#L12630)) · `CampaignVariant` ([campaign_variants](../../api/prisma/schema.prisma#L12787)) · enum `CampaignAbMetric` ([L12780](../../api/prisma/schema.prisma#L12780)) · enum `CampaignAudienceMode` ([L11680](../../api/prisma/schema.prisma#L11680)) · enum `CampaignStatus` ([L11660](../../api/prisma/schema.prisma#L11660))
<!-- schema-section:end -->

Support marketing communication through:

* Email campaigns
* SMS campaigns
* Customer segmentation
* Audience targeting
* Campaign scheduling
* Campaign duplication
* Campaign templates
* Promotional announcements
* Product launches
* Newsletter distribution


> **A/B tests, pre-send check and topics.** A campaign can test subject / content variants: `Campaign.ab_test_enabled`, `ab_metric` (OPEN or CLICK), `ab_test_percent`, `ab_wait_hours` plus `CampaignVariant` rows (`label`, `subject`, `preheader`, bodies, `share_percent`, counters, `is_winner`); each `CampaignRecipient.variant_id` records the variant sent, and the winner goes to the rest of the audience after the wait. Editing variants needs `communications.campaigns.update`. The last pre-send check (broken links, spam score, missing unsubscribe link) is kept in `Campaign.preflight` / `preflight_checked_at` for approvers. `Campaign.topic_id` ties a campaign to a preference-center topic. Saved views, tags and notes use the platform tables with `RecordEntityType` CAMPAIGN.
---

## Recipients

<!-- schema-section:start -->
> **Schema:** `CommConsent` ([comm_consents](../../api/prisma/schema.prisma#L12415)) · `CommRecipientList` ([comm_recipient_lists](../../api/prisma/schema.prisma#L12333)) · `CommRecipientListMember` ([comm_recipient_list_members](../../api/prisma/schema.prisma#L12356)) · `CommSuppression` ([comm_suppressions](../../api/prisma/schema.prisma#L12447)) · `CommTopic` ([comm_topics](../../api/prisma/schema.prisma#L12815)) · `CommTopicSubscription` ([comm_topic_subscriptions](../../api/prisma/schema.prisma#L12840)) · enum `CommBounceType` ([L11532](../../api/prisma/schema.prisma#L11532)) · enum `CommConsentSource` ([L11710](../../api/prisma/schema.prisma#L11710)) · enum `CommConsentStatus` ([L11702](../../api/prisma/schema.prisma#L11702)) · enum `CommRecipientKind` ([L11538](../../api/prisma/schema.prisma#L11538)) · enum `CommSuppressionReason` ([L11721](../../api/prisma/schema.prisma#L11721))
<!-- schema-section:end -->

> Defined by → [02 CRM](./02-crm-sales-management.md) §2–3 (Companies, Contacts), §3 contact roles · Linear LOG-404.

Recipients are CRM Contacts (customers, leads, billing and technical contacts, stakeholders) and, for internal announcements, Members (01). This module does not maintain a separate contact database. It owns:

* Recipient lists and saved segments built on CRM fields and tags
* Consent, opt-in and unsubscribe state per channel
* Suppression lists and bounce handling


> **Recipient list and consent permissions, topics.** `CommRecipientList` uses `communications.recipient_lists.*` (read, create, update, archive, delete, export). Consent (`CommConsent`) is read with `communications.consents.read` and changed or imported with `communications.consents.manage` (sensitive). The preference center is made of `CommTopic` rows (name, slug, channel, `default_opt_in`) and per-contact `CommTopicSubscription` rows (`status`, `source`); a topic campaign needs channel consent and an OPTED_IN topic subscription, and topics are managed with `communications.consents.manage`.
---

## Customer Segmentation

<!-- schema-section:start -->
> **Schema:** `CampaignAudience` ([campaign_audiences](../../api/prisma/schema.prisma#L12609)) · `Segment` ([segments](../../api/prisma/schema.prisma#L12381)) · enum `SegmentEntityType` ([L11695](../../api/prisma/schema.prisma#L11695))
<!-- schema-section:end -->

Segments are saved filters over CRM Companies and Contacts (02 §29 saved views and §24 custom fields) combined with billing state from 08 and project state from 05. Criteria such as:

* Customer
* Organization
* Project
* Subscription plan
* Active projects
* Billing status
* Outstanding invoices
* Customer tags
* Industry
* Region
* Language
* Account status
* Last activity


> **Field catalog.** `GET /communications/segments/fields` is a service contract owned by 11: it lists the filter fields a `Segment.definition` can use, with providers in 02 (CRM, custom fields, tags), 05 (active projects) and 08 (subscription plan, outstanding invoices, billing status). The definition stores field keys only; the values are read from the owning module at resolution time. No table.
---

## Automation

<!-- schema-section:start -->
> **Schema:** `CommMessage` ([comm_messages](../../api/prisma/schema.prisma#L12026)): `automation_rule_id`
<!-- schema-section:end -->

> Engine defined by → [20 Automation Engine](./20-automation-engine.md) · Linear LOG-410. This module exposes "send email from template" and "send SMS from template" as actions and does not run its own rules engine.

Typical triggered communications:

* Welcome messages
* Customer onboarding
* Project creation notifications
* Milestone completion notifications
* Invoice generation notifications
* Payment confirmations
* Payment reminders
* Failed payment notifications
* Subscription renewal reminders
* Contract expiration reminders
* Maintenance notifications
* Project completion messages
* Customer follow-ups

Triggers come from platform events published to 20.


> **Journeys are owned by 20.** Multi-step journeys with waits, branches and goals are `AutomationRule` versions with wait / branch steps; each enrolled contact is an `AutomationRun` (`AutomationRunStep.wait_until`, `branch_taken`) and managed with `automation.rules.*`. 11 stores no journey tables: it reports what they sent through `CommMessage.automation_rule_id` / `automation_run_id`.
---

## Scheduling

<!-- schema-section:start -->
> **Schema:** `Campaign` ([campaigns](../../api/prisma/schema.prisma#L12486)) · `CampaignRun` ([campaign_runs](../../api/prisma/schema.prisma#L12669)) · `CommMessage` ([comm_messages](../../api/prisma/schema.prisma#L12026)) · `CommSettings` ([comm_settings](../../api/prisma/schema.prisma#L12862)) · enum `CampaignRunStatus` ([L11686](../../api/prisma/schema.prisma#L11686)) · enum `CampaignStatus` ([L11660](../../api/prisma/schema.prisma#L11660)) · enum `CommMessageStatus` ([L11502](../../api/prisma/schema.prisma#L11502))
<!-- schema-section:end -->

Allow users to:

* Schedule emails
* Schedule SMS
* Delay sending
* Recurring campaigns
* Time-zone aware delivery
* Campaign calendars
* Draft scheduling
* Queue management


> **Organization communication settings.** `CommSettings` (one row per organization) holds the approval policy (`approval_required`, `approval_min_recipients`), quiet hours, `max_marketing_per_week` frequency cap, `footer_address`, `double_opt_in_default`, retention periods for message bodies and event PII, and default language / time zone; edited with `communications.settings.manage`. Default senders are `CommSenderIdentity.is_default` per channel.
---

## Delivery Tracking

<!-- schema-section:start -->
> **Schema:** `CampaignRecipient` ([campaign_recipients](../../api/prisma/schema.prisma#L12630)) · `CommDeliveryEvent` ([comm_delivery_events](../../api/prisma/schema.prisma#L12268)) · `CommMessage` ([comm_messages](../../api/prisma/schema.prisma#L12026)) · `CommSuppression` ([comm_suppressions](../../api/prisma/schema.prisma#L12447)) · `CommTrackedLink` ([comm_tracked_links](../../api/prisma/schema.prisma#L12306)) · enum `CommDeliveryEventType` ([L11516](../../api/prisma/schema.prisma#L11516)) · enum `CommMessageStatus` ([L11502](../../api/prisma/schema.prisma#L11502)) · enum `CommRecipientStatus` ([L11553](../../api/prisma/schema.prisma#L11553))
<!-- schema-section:end -->

Track communication performance including:

### Email

* Delivered
* Opened
* Clicked
* Replied
* Bounced
* Failed
* Unsubscribed

### SMS

* Sent
* Delivered
* Failed
* Queued
* Read (where supported)

---

## Communication History

<!-- schema-section:start -->
> **Schema:** `CommMessage` ([comm_messages](../../api/prisma/schema.prisma#L12026)): `search_vector` · `CommMessageLink` ([comm_message_links](../../api/prisma/schema.prisma#L12250)) · enum `CommMessageKind` ([L11483](../../api/prisma/schema.prisma#L11483)) · enum `CommMessageSource` ([L11492](../../api/prisma/schema.prisma#L11492))
<!-- schema-section:end -->

Maintain complete outbound communication records for every customer. Entries are contributed to the Customer 360 timeline (02 §18). Inbound replies to support addresses are captured by 13 and linked to the same customer.

Include:

* Email history
* SMS history
* Attachments
* Delivery status
* Conversation history
* Searchable archive
* Project association
* User who sent the communication
* Automation source
* Timestamp history

---

## Internal Collaboration

<!-- schema-section:start -->
> **Schema:** `Campaign` ([campaigns](../../api/prisma/schema.prisma#L12486)) · `CampaignApproval` ([campaign_approvals](../../api/prisma/schema.prisma#L12696)) · enum `CampaignApprovalDecision` ([L11673](../../api/prisma/schema.prisma#L11673)) · enum `CampaignStatus` ([L11660](../../api/prisma/schema.prisma#L11660))
<!-- schema-section:end -->

Allow employees to:

* Review communications
* Approve campaigns
* Leave internal notes
* Track communication ownership

---

## Notification Delivery Provider

<!-- schema-section:start -->
> **Schema:** enum `CommMessageKind` ([L11483](../../api/prisma/schema.prisma#L11483)) · enum `CommTemplateKind` ([L11603](../../api/prisma/schema.prisma#L11603))
<!-- schema-section:end -->

> Notification engine defined by → [14 Notifications & Activity Center](./14-notifications-activity-center.md) · Linear LOG-403.

This module does not define notification events, preferences or an inbox. It provides the **email and SMS delivery channels** that 14 uses: branded notification templates, sending, delivery tracking and bounce handling. Notification emails and SMS are logged separately from customer communications and campaigns.

---

## Analytics & Reporting

<!-- schema-section:start -->
> **Schema:** `Campaign` ([campaigns](../../api/prisma/schema.prisma#L12486)) · `CommDailyStat` ([comm_daily_stats](../../api/prisma/schema.prisma#L12717)) · `CommTrackedLink` ([comm_tracked_links](../../api/prisma/schema.prisma#L12306))
<!-- schema-section:end -->

Provide communication analytics including:

* Emails sent
* SMS sent
* Open rate
* Click-through rate
* Reply rate
* Bounce rate
* Delivery rate
* Campaign performance

Support exporting communication reports.

---

## AI Communication Assistant

<!-- schema-section:start -->
> **Schema:** `CommAiGeneration` ([comm_ai_generations](../../api/prisma/schema.prisma#L12748)) · `CommTemplate` ([comm_templates](../../api/prisma/schema.prisma#L11876)): `ai_generation_id` · enum `CommAiTaskKind` ([L11732](../../api/prisma/schema.prisma#L11732))
<!-- schema-section:end -->

Integrate AI throughout the Communication Center to improve efficiency and consistency.

AI should be capable of:

* Writing professional emails
* Writing SMS messages
* Personalizing communications
* Generating project updates
* Drafting payment reminders
* Creating marketing campaigns
* Summarizing long conversations
* Translating communications into multiple languages
* Improving tone and grammar
* Suggesting subject lines
* Generating reusable templates
* Automatically responding to common customer inquiries
* Generating executive communication summaries

The Communication Center should provide a unified messaging experience that centralizes all customer communications, automates repetitive messaging workflows, enables targeted campaigns, and leverages AI to produce high-quality, personalized communications while maintaining a complete communication history for every customer and project.

> **Permission.** Using the assistant (`CommAiGeneration`) needs `communications.ai.use` in addition to the permission to edit the target template or campaign; generated text is never applied automatically.
