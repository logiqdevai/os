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

### Owned tables (26)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| **Providers & sender identities** | | | |
| `CommProviderAccount` | `comm_provider_accounts` | [L9425](../../api/prisma/schema.prisma#L9425) | 11 "Email Management", "SMS Management" — a configured delivery provider account (API key stored encrypted / as a secret reference). One default per channel … |
| `CommSenderDomain` | `comm_sender_domains` | [L9456](../../api/prisma/schema.prisma#L9456) | 11 "Email Management" — a sending domain with DNS verification (SPF / DKIM / DMARC / return-path). Distinct from organization_domains (01 §70), which are log… |
| `CommSenderIdentity` | `comm_sender_identities` | [L9488](../../api/prisma/schema.prisma#L9488) | 11 "Email Management", "SMS Management" — a verified from-address (email) or sender number / alphanumeric sender id (SMS). May be scoped to a Branch (01 §120… |
| `CommSignature` | `comm_signatures` | [L9526](../../api/prisma/schema.prisma#L9526) | 11 "Email Management" — email signatures; organization-wide when membership_id is null, personal otherwise. |
| **Templates** | | | |
| `CommTemplate` | `comm_templates` | [L9549](../../api/prisma/schema.prisma#L9549) | 11 "Communication Templates" — reusable email / SMS template. Content lives in versions; the published version is pointed to by current_version_id. Variables… |
| `CommTemplateVersion` | `comm_template_versions` | [L9600](../../api/prisma/schema.prisma#L9600) | 11 "Communication Templates" — immutable content snapshot per version: subject, preheader, HTML body, plain-text body, editor design JSON. Conditional conten… |
| `CommTemplateTranslation` | `comm_template_translations` | [L9637](../../api/prisma/schema.prisma#L9637) | 11 "Communication Templates" — multiple languages: a localized subject/body for a template version, selected by recipient language (02 CrmContact.language, 0… |
| **Messages** | | | |
| `CommThread` | `comm_threads` | [L9663](../../api/prisma/schema.prisma#L9663) | 11 "Email Management", "Conversation threads" — groups outbound emails and their inbound replies (captured by 13 and linked by support_conversation_id) under… |
| `CommMessage` | `comm_messages` | [L9699](../../api/prisma/schema.prisma#L9699) | 11 "Email Management", "SMS Management", "Communication History", "Scheduling", "Delivery Tracking" — one outbound email or SMS to one primary recipient (cc/… |
| `CommMessageRecipient` | `comm_message_recipients` | [L9861](../../api/prisma/schema.prisma#L9861) | 11 "Email Management" — every recipient of a message (the primary TO is duplicated here so per-recipient delivery status is uniform), plus cc / bcc. |
| `CommMessageAttachment` | `comm_message_attachments` | [L9896](../../api/prisma/schema.prisma#L9896) | 11 "Email Management" — file attachments and inline images. Files are Documents (17); id only. |
| `CommMessageLink` | `comm_message_links` | [L9921](../../api/prisma/schema.prisma#L9921) | 11 "Customer Communication", "Communication History" — polymorphic link from a message to the records it concerns (CRM_COMPANY / CRM_CONTACT / PROJECT / INVO… |
| `CommDeliveryEvent` | `comm_delivery_events` | [L9939](../../api/prisma/schema.prisma#L9939) | 11 "Delivery Tracking" — append-only provider events (webhooks and sync). Idempotent through provider_webhook_events (08) and the (provider, provider_event_i… |
| `CommTrackedLink` | `comm_tracked_links` | [L9977](../../api/prisma/schema.prisma#L9977) | 11 "Delivery Tracking", "Analytics & Reporting" — rewritten links for click tracking, per message (one-off sends) or per campaign (shared across its messages). |
| **Recipients, segments, consent & suppression** | | | |
| `CommRecipientList` | `comm_recipient_lists` | [L10004](../../api/prisma/schema.prisma#L10004) | 11 "Recipients" — a static recipient list of CRM contacts and/or members. Dynamic audiences are Segments. |
| `CommRecipientListMember` | `comm_recipient_list_members` | [L10027](../../api/prisma/schema.prisma#L10027) | 11 "Recipients" — list membership: a CRM contact, a member, or an external address. |
| `Segment` | `segments` | [L10052](../../api/prisma/schema.prisma#L10052) | 11 "Customer Segmentation" — a saved filter over CRM companies/contacts (02 §29 saved views, §24 custom fields, §36 tags) combined with billing state (08) an… |
| `CommConsent` | `comm_consents` | [L10086](../../api/prisma/schema.prisma#L10086) | 11 "Recipients" — consent / opt-in / unsubscribe state per CRM contact and channel, with evidence. Source of truth for marketing sends; CrmContact.consent (0… |
| `CommSuppression` | `comm_suppressions` | [L10118](../../api/prisma/schema.prisma#L10118) | 11 "Recipients", "Delivery Tracking" — suppression list: addresses that must not be contacted on a channel (unsubscribes, hard bounces, complaints, manual). … |
| **Campaigns** | | | |
| `Campaign` | `campaigns` | [L10157](../../api/prisma/schema.prisma#L10157) | 11 "Marketing Campaigns", "Scheduling", "Internal Collaboration", "Analytics & Reporting" — a bulk email or SMS send to an audience built from lists and segm… |
| `CampaignAudience` | `campaign_audiences` | [L10265](../../api/prisma/schema.prisma#L10265) | 11 "Marketing Campaigns", "Customer Segmentation" — audience sources of a campaign: recipient lists and segments, included or excluded. Resolved into Campaig… |
| `CampaignRecipient` | `campaign_recipients` | [L10286](../../api/prisma/schema.prisma#L10286) | 11 "Marketing Campaigns", "Delivery Tracking" — resolved audience: one row per recipient per campaign (per run for recurring campaigns). Links to the CommMes… |
| `CampaignRun` | `campaign_runs` | [L10321](../../api/prisma/schema.prisma#L10321) | 11 "Scheduling" — one execution of a campaign (recurring campaigns have many; one-off campaigns one). |
| `CampaignApproval` | `campaign_approvals` | [L10348](../../api/prisma/schema.prisma#L10348) | 11 "Internal Collaboration" — campaign review / approval by a member before sending. |
| **Analytics & AI** | | | |
| `CommDailyStat` | `comm_daily_stats` | [L10369](../../api/prisma/schema.prisma#L10369) | 11 "Analytics & Reporting" — daily rollup per organization / channel / kind (and per campaign) used for sent counts, open / click / reply / bounce / delivery… |
| `CommAiGeneration` | `comm_ai_generations` | [L10400](../../api/prisma/schema.prisma#L10400) | 11 "AI Communication Assistant" — a request to the assistant and its output (draft, rewrite, translation, subject lines, summary). Linked to the message / te… |

**Owned enums (26):** `CommChannel`, `CommMessageKind`, `CommMessageSource`, `CommMessageStatus`, `CommDeliveryEventType`, `CommBounceType`, `CommRecipientKind`, `CommRecipientRole`, `CommRecipientStatus`, `CommTemplateCategory`, `CommTemplateKind`, `CommTemplateStatus`, `CommTemplateVersionStatus`, `CommProviderKind`, `CommProviderAccountStatus`, `CommSenderDomainStatus`, `CommSenderIdentityStatus`, `CampaignStatus`, `CampaignApprovalDecision`, `CampaignAudienceMode`, `CampaignRunStatus`, `SegmentEntityType`, `CommConsentStatus`, `CommConsentSource`, `CommSuppressionReason`, `CommAiTaskKind`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `Branch` (`branches`) | `Campaign.branch`, `CommMessage.branch`, `CommSenderIdentity.branch`, `CommTemplate.branch` |
| [01](./01-users-organizations-permissions.md) | `Membership` (`memberships`) | `Campaign.approved_by`, `Campaign.created_by`, `Campaign.owner`, `CampaignApproval.approver` +13 more |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `Campaign.organization`, `CommAiGeneration.organization`, `CommConsent.organization`, `CommDailyStat.organization` +12 more |
| [02](./02-crm-sales-management.md) | `CrmCompany` (`crm_companies`) | `CommMessage.company`, `CommThread.company` |
| [02](./02-crm-sales-management.md) | `CrmContact` (`crm_contacts`) | `CampaignRecipient.contact`, `CommConsent.contact`, `CommMessage.recipient_contact`, `CommMessageRecipient.contact` +3 more |
| [02](./02-crm-sales-management.md) | `SavedView` (`saved_views`) | `Segment.saved_view` |
| [05](./05-project-management.md) | `Project` (`projects`) | `CommMessage.project`, `CommThread.project` |
| [08](./08-financial-management-stripe-integration.md) | `ProviderWebhookEvent` (`provider_webhook_events`) | `CommDeliveryEvent.provider_webhook_event` |

**Reused enums:** `RecordEntityType` ([02](./02-crm-sales-management.md))

### Referenced by other modules

- [03](./03-proposal-quotation-generator.md): `ProposalDelivery`
- [08](./08-financial-management-stripe-integration.md): `InvoiceReminder`

### Plain-id references from other modules

Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.

- `CrmContact.consent` ([02](./02-crm-sales-management.md), [L2154](../../api/prisma/schema.prisma#L2154)) — Marketing consent per channel (consumed by 11 Communication Center).
- `ProposalDelivery.communication_id` ([03](./03-proposal-quotation-generator.md), [L3026](../../api/prisma/schema.prisma#L3026)) — Communication record id (11); id only.
- `SupportChannel.sender_identity_id` ([13](./13-customer-support-communication-hub.md), [L12094](../../api/prisma/schema.prisma#L12094)) — 11 SenderIdentity used for outbound replies from this channel; id only.
- `SupportCsatRating.token` ([13](./13-customer-support-communication-hub.md), [L12761](../../api/prisma/schema.prisma#L12761)) — Opaque token for the rating link in emails (11).
- `NotificationDelivery.comm_message_id` ([14](./14-notifications-activity-center.md), [L13392](../../api/prisma/schema.prisma#L13392)) — 11 CommMessage id for EMAIL / SMS deliveries.
- `NotificationOrgSettings.email_sender_identity_id` ([14](./14-notifications-activity-center.md), [L13490](../../api/prisma/schema.prisma#L13490)) — 11 SenderIdentity used for notification emails / SMS.
- `NotificationDigest.comm_message_id` ([14](./14-notifications-activity-center.md), [L13682](../../api/prisma/schema.prisma#L13682)) — 11 CommMessage id of the sent digest (EMAIL / SMS).

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

**Permission keys in the catalog today** (`api/prisma/seed/permission-catalog.ts`, 31 keys; `*` = sensitive):

| Resource key prefix | Actions |
| -- | -- |
| `communications.analytics` | read |
| `communications.campaigns` | read, create, update, delete*, archive, export*, send*, approve* |
| `communications.messages` | read, create, update, delete*, archive, export*, send* |
| `communications.segments` | read, create, update, delete*, archive, export* |
| `communications.sender_identities` | manage* |
| `communications.settings` | manage* |
| `communications.suppressions` | manage* |
| `communications.templates` | read, create, update, delete*, archive, export* |

Definition of done for each resource of this module: permission keys in the catalog and in the role templates, seed re-run, REST endpoint, MCP tool, service-account and API-key access verified, webhook events and automation triggers declared, audit events written, tests for allow / deny / wrong scope / wrong organization.

<!-- access-channels:end -->

## Email Management

<!-- schema-section:start -->
> **Schema:** `CommMessage` ([comm_messages](../../api/prisma/schema.prisma#L9699)) · `CommMessageAttachment` ([comm_message_attachments](../../api/prisma/schema.prisma#L9896)) · `CommMessageRecipient` ([comm_message_recipients](../../api/prisma/schema.prisma#L9861)) · `CommProviderAccount` ([comm_provider_accounts](../../api/prisma/schema.prisma#L9425)) · `CommSenderDomain` ([comm_sender_domains](../../api/prisma/schema.prisma#L9456)) · `CommSenderIdentity` ([comm_sender_identities](../../api/prisma/schema.prisma#L9488)) · `CommSignature` ([comm_signatures](../../api/prisma/schema.prisma#L9526)) · `CommThread` ([comm_threads](../../api/prisma/schema.prisma#L9663)) · enum `CommChannel` ([L9149](../../api/prisma/schema.prisma#L9149)) · enum `CommProviderKind` ([L9297](../../api/prisma/schema.prisma#L9297)) · enum `CommRecipientRole` ([L9219](../../api/prisma/schema.prisma#L9219)) · enum `CommSenderDomainStatus` ([L9317](../../api/prisma/schema.prisma#L9317)) · enum `CommSenderIdentityStatus` ([L9325](../../api/prisma/schema.prisma#L9325))
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
> **Schema:** `CommMessage` ([comm_messages](../../api/prisma/schema.prisma#L9699)) · `CommProviderAccount` ([comm_provider_accounts](../../api/prisma/schema.prisma#L9425)) · `CommSenderIdentity` ([comm_sender_identities](../../api/prisma/schema.prisma#L9488)) · enum `CommChannel` ([L9149](../../api/prisma/schema.prisma#L9149)) · enum `CommSenderIdentityStatus` ([L9325](../../api/prisma/schema.prisma#L9325))
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
> **Schema:** `CommTemplate` ([comm_templates](../../api/prisma/schema.prisma#L9549)) · `CommTemplateTranslation` ([comm_template_translations](../../api/prisma/schema.prisma#L9637)) · `CommTemplateVersion` ([comm_template_versions](../../api/prisma/schema.prisma#L9600)) · enum `CommTemplateCategory` ([L9241](../../api/prisma/schema.prisma#L9241)) · enum `CommTemplateKind` ([L9276](../../api/prisma/schema.prisma#L9276)) · enum `CommTemplateVersionStatus` ([L9290](../../api/prisma/schema.prisma#L9290))
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
> **Schema:** `CommMessageLink` ([comm_message_links](../../api/prisma/schema.prisma#L9921))
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
> **Schema:** `Campaign` ([campaigns](../../api/prisma/schema.prisma#L10157)) · `CampaignAudience` ([campaign_audiences](../../api/prisma/schema.prisma#L10265)) · `CampaignRecipient` ([campaign_recipients](../../api/prisma/schema.prisma#L10286)) · enum `CampaignAudienceMode` ([L9353](../../api/prisma/schema.prisma#L9353)) · enum `CampaignStatus` ([L9333](../../api/prisma/schema.prisma#L9333))
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

---

## Recipients

<!-- schema-section:start -->
> **Schema:** `CommConsent` ([comm_consents](../../api/prisma/schema.prisma#L10086)) · `CommRecipientList` ([comm_recipient_lists](../../api/prisma/schema.prisma#L10004)) · `CommRecipientListMember` ([comm_recipient_list_members](../../api/prisma/schema.prisma#L10027)) · `CommSuppression` ([comm_suppressions](../../api/prisma/schema.prisma#L10118)) · enum `CommBounceType` ([L9205](../../api/prisma/schema.prisma#L9205)) · enum `CommConsentSource` ([L9383](../../api/prisma/schema.prisma#L9383)) · enum `CommConsentStatus` ([L9375](../../api/prisma/schema.prisma#L9375)) · enum `CommRecipientKind` ([L9211](../../api/prisma/schema.prisma#L9211)) · enum `CommSuppressionReason` ([L9394](../../api/prisma/schema.prisma#L9394))
<!-- schema-section:end -->

> Defined by → [02 CRM](./02-crm-sales-management.md) §2–3 (Companies, Contacts), §3 contact roles · Linear LOG-404.

Recipients are CRM Contacts (customers, leads, billing and technical contacts, stakeholders) and, for internal announcements, Members (01). This module does not maintain a separate contact database. It owns:

* Recipient lists and saved segments built on CRM fields and tags
* Consent, opt-in and unsubscribe state per channel
* Suppression lists and bounce handling

---

## Customer Segmentation

<!-- schema-section:start -->
> **Schema:** `CampaignAudience` ([campaign_audiences](../../api/prisma/schema.prisma#L10265)) · `Segment` ([segments](../../api/prisma/schema.prisma#L10052)) · enum `SegmentEntityType` ([L9368](../../api/prisma/schema.prisma#L9368))
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

---

## Automation

<!-- schema-section:start -->
> **Schema:** `CommMessage` ([comm_messages](../../api/prisma/schema.prisma#L9699)): `automation_rule_id`
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

---

## Scheduling

<!-- schema-section:start -->
> **Schema:** `Campaign` ([campaigns](../../api/prisma/schema.prisma#L10157)) · `CampaignRun` ([campaign_runs](../../api/prisma/schema.prisma#L10321)) · `CommMessage` ([comm_messages](../../api/prisma/schema.prisma#L9699)) · enum `CampaignRunStatus` ([L9359](../../api/prisma/schema.prisma#L9359)) · enum `CampaignStatus` ([L9333](../../api/prisma/schema.prisma#L9333)) · enum `CommMessageStatus` ([L9175](../../api/prisma/schema.prisma#L9175))
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

---

## Delivery Tracking

<!-- schema-section:start -->
> **Schema:** `CampaignRecipient` ([campaign_recipients](../../api/prisma/schema.prisma#L10286)) · `CommDeliveryEvent` ([comm_delivery_events](../../api/prisma/schema.prisma#L9939)) · `CommMessage` ([comm_messages](../../api/prisma/schema.prisma#L9699)) · `CommSuppression` ([comm_suppressions](../../api/prisma/schema.prisma#L10118)) · `CommTrackedLink` ([comm_tracked_links](../../api/prisma/schema.prisma#L9977)) · enum `CommDeliveryEventType` ([L9189](../../api/prisma/schema.prisma#L9189)) · enum `CommMessageStatus` ([L9175](../../api/prisma/schema.prisma#L9175)) · enum `CommRecipientStatus` ([L9226](../../api/prisma/schema.prisma#L9226))
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
> **Schema:** `CommMessage` ([comm_messages](../../api/prisma/schema.prisma#L9699)): `search_vector` · `CommMessageLink` ([comm_message_links](../../api/prisma/schema.prisma#L9921)) · enum `CommMessageKind` ([L9156](../../api/prisma/schema.prisma#L9156)) · enum `CommMessageSource` ([L9165](../../api/prisma/schema.prisma#L9165))
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
> **Schema:** `Campaign` ([campaigns](../../api/prisma/schema.prisma#L10157)) · `CampaignApproval` ([campaign_approvals](../../api/prisma/schema.prisma#L10348)) · enum `CampaignApprovalDecision` ([L9346](../../api/prisma/schema.prisma#L9346)) · enum `CampaignStatus` ([L9333](../../api/prisma/schema.prisma#L9333))
<!-- schema-section:end -->

Allow employees to:

* Review communications
* Approve campaigns
* Leave internal notes
* Track communication ownership

---

## Notification Delivery Provider

<!-- schema-section:start -->
> **Schema:** enum `CommMessageKind` ([L9156](../../api/prisma/schema.prisma#L9156)) · enum `CommTemplateKind` ([L9276](../../api/prisma/schema.prisma#L9276))
<!-- schema-section:end -->

> Notification engine defined by → [14 Notifications & Activity Center](./14-notifications-activity-center.md) · Linear LOG-403.

This module does not define notification events, preferences or an inbox. It provides the **email and SMS delivery channels** that 14 uses: branded notification templates, sending, delivery tracking and bounce handling. Notification emails and SMS are logged separately from customer communications and campaigns.

---

## Analytics & Reporting

<!-- schema-section:start -->
> **Schema:** `Campaign` ([campaigns](../../api/prisma/schema.prisma#L10157)) · `CommDailyStat` ([comm_daily_stats](../../api/prisma/schema.prisma#L10369)) · `CommTrackedLink` ([comm_tracked_links](../../api/prisma/schema.prisma#L9977))
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
> **Schema:** `CommAiGeneration` ([comm_ai_generations](../../api/prisma/schema.prisma#L10400)) · `CommTemplate` ([comm_templates](../../api/prisma/schema.prisma#L9549)): `ai_generation_id` · enum `CommAiTaskKind` ([L9405](../../api/prisma/schema.prisma#L9405))
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
