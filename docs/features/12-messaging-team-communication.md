# Messaging & Team Communication

> Linear: [LOG-313](https://linear.app/logiqdev/issue/LOG-313/messaging-and-team-communication) · Status: Backlog

> **Canonical for:** internal real-time messaging: direct messages, channels (public, private, project, customer, announcement), threads, reactions, mentions, record sharing and previews, contextual conversations on business records, presence, saved messages, pinning, search inside messaging, moderation, retention and export of messages.
>
> **Boundaries:** [13 Customer Support](./13-customer-support-communication-hub.md) owns customer support conversations, live chat and inbound email. [11 Communication Center](./11-communication-center.md) owns outbound email/SMS and campaigns. [14 Notifications](./14-notifications-activity-center.md) owns notification channels, preferences and the inbox. [17 Documents](./17-documents-file-management.md) owns attachments. [01](./01-users-organizations-permissions.md) owns identity, Teams, guests, external collaborators and Customer Portal Users.
>
> **Depends on:** 01 (LOG-406) · 14 (LOG-403) · 17 (LOG-407) · [20 Automation Engine](./20-automation-engine.md) (LOG-410) for channel lifecycle rules and system events · [19 Calendar](./19-calendar.md) (LOG-409) for calls and huddles.
>
> **Consumed by:** 05 Projects (§62 project channels), 06 Tasks (§7 task discussions), 07 Customer Portal (§6 project communication), 13 Support (§11 internal discussion of tickets), 02 CRM (§58 record conversations).

<!-- schema-refs:start -->

## Data model (Prisma)

> Generated from [`api/prisma/schema.prisma`](../../api/prisma/schema.prisma) by `node docs/scripts/sync-feature-schema-refs.mjs` — do not edit by hand.
> Before implementing API or app code for this module, read these models in the schema and reuse the existing
> tables, enums and services of the modules listed under "Reuses". Never redefine a table owned by another module.

**Platform tables to reuse, not rebuild:** `audit_events` (activity & change history, [01](./01-users-organizations-permissions.md)) · `custom_field_definitions` (custom fields, [02](./02-crm-sales-management.md)) · `taggings` (tags, [02](./02-crm-sales-management.md)) · `saved_views` (saved views, [02](./02-crm-sales-management.md)) · `crm_notes` (notes, polymorphic by entity type, [02](./02-crm-sales-management.md)) · `number_sequences` (document numbering, [03](./03-proposal-quotation-generator.md)) · `signature_requests` (e-signatures, [04](./04-contracts.md)) · `provider_webhook_events` (idempotent provider webhooks, [08](./08-financial-management-stripe-integration.md))

**Owned tables:** none yet — this module is not modelled in the schema. Add its tables in a new banner section
`// NN Module name — docs/features/12-messaging-team-communication.md` and re-run the script.

### Plain-id references from other modules

Plain-string ids (no Prisma relation) that other modules already store for records this module will own. Turn them into relations when this module is modelled.

- `Project.channel_id` ([05](./05-project-management.md), [L3850](../../api/prisma/schema.prisma#L3850)) — Messaging project channel (12 §26); id only.
- `ProjectDecision.source_message_id` ([05](./05-project-management.md), [L4260](../../api/prisma/schema.prisma#L4260)) — Source message permalink (12 §63) when converted from a conversation.

<!-- schema-refs:end -->

## 1. Overview

Build a first-class internal messaging and collaboration system comparable to Slack, designed as a core module of the Agency Operating System.

The messaging module provides real-time communication between employees, teams, project members, customers where explicitly enabled, and other authorized users.

The system should support both persistent team communication and contextual communication attached to business records such as projects, tasks, deals, customers, proposals, contracts, and support tickets.

The messaging system must be independent from the CRM's marketing/campaign functionality and from the separate email/SMS communications module.

### Primary goals

* Replace fragmented internal communication across chat applications.
* Provide organized communication instead of one large message stream.
* Connect conversations directly to agency work.
* Make project and business context available without requiring users to search multiple systems.
* Support fast real-time communication while preserving searchable history.
* Provide strong permissions, notifications, moderation, retention, and audit capabilities.
* Support extensibility for future integrations and external communication channels.

---

## 2. Messaging Architecture

The messaging system should contain several communication primitives:

* Direct messages
* Group direct messages
* Public channels
* Private channels
* Project channels
* Customer channels
* Announcement channels
* Temporary/group conversations
* Threaded discussions
* Contextual comments attached to business records

A user should be able to move from a message to the related project, customer, task, deal, ticket, proposal, contract, or other record.

### Core hierarchy

**Organization → Team → Channel → Message → Thread → Attachments/Reactions/Mentions/Links**

Direct messaging exists alongside the channel hierarchy.

---

## 3. Organizations & Teams

> Defined by → [01](./01-users-organizations-permissions.md) §8 (Organization), §16 (Branch), §40 (Team) · Linear LOG-406.

The messaging system operates within an Organization. Channels can be scoped to a Team or Branch. There is no separate "workspace" concept; where earlier drafts said workspace, read Organization or Team.

## 4. Users & Presence

The messaging identity is the Member (01 §24). Employee profile data stays in 10; messaging only adds presence and status.

### Presence states

* Active
* Away
* Do Not Disturb
* Offline
* Custom status

### Custom status

Users can configure:

* Status text
* Optional emoji/icon
* Expiration
* Start/end date
* Automatic expiration

Examples:

* In a meeting
* Working remotely
* On vacation
* Focusing
* Out of office

Presence should be visible according to organization privacy settings.

---

## 5. Direct Messages

Users can communicate privately through direct messages.

### Supported types

* One-to-one DM
* Group DM
* Multi-person conversation

### DM functionality

* Send messages
* Edit messages
* Delete messages subject to policy
* Reply in threads
* React
* Mention users
* Attach files
* Share links
* Search conversation
* Pin messages
* Save/bookmark messages
* Mark unread
* Add reminders
* Start huddle/call if supported
* View participants
* Leave group DM where applicable

### DM history

Messages remain available according to organization retention policies.

---

## 6. Channels

Channels are persistent spaces for team communication.

### Channel types

#### Public channel

Visible and discoverable by all authorized Members of the Organization (or Team/Branch scope).

#### Private channel

Visible only to explicitly invited members.

#### Project channel

Automatically associated with a project.

#### Customer channel

Associated with a specific customer and optionally accessible by external customer users.

#### Announcement channel

Restricted posting permissions for controlled company-wide communication.

#### Archived channel

Read-only or restricted channel preserved for historical access.

---

## 7. Channel Properties

Each channel should support:

* Channel name
* Unique identifier
* Display name
* Description
* Purpose
* Channel type
* Visibility
* Owner
* Admins
* Members
* Created date
* Created by
* Associated project
* Associated customer
* Associated team
* Associated business record
* Topic
* Icon/avatar
* Notification defaults
* Posting permissions
* Retention policy
* Archive status
* External access status
* Custom fields where appropriate

---

## 8. Channel Lifecycle

Channels should support:

* Create
* Rename
* Configure
* Invite members
* Remove members
* Leave
* Archive
* Unarchive
* Delete where permitted
* Convert channel type where permitted

Archived channels should preserve historical messages and files while preventing normal new activity.

---

## 9. Channel Membership

Channel membership should support:

* Manual invitation
* Team-based membership
* Role-based membership
* Project-based automatic membership
* Customer-based membership
* Optional automatic membership for organization-wide channels

### Membership roles

* Owner
* Admin
* Member
* Guest
* External participant
* Read-only participant

Membership changes should be recorded in channel history.

---

## 10. Messages

Messages are the fundamental communication unit.

### Message properties

* Message ID
* Channel/conversation ID
* Sender
* Message content
* Created timestamp
* Updated timestamp
* Edited timestamp
* Thread relationship
* Reply count
* Attachments
* Reactions
* Mentions
* Links
* Shared records
* Saved/bookmarked state
* Pin state
* Deleted state
* Metadata
* Message version/history where required

---

## 11. Message Composer

The composer should provide a rich messaging experience.

### Supported capabilities

* Plain text
* Rich text
* Markdown
* Bold
* Italic
* Strikethrough
* Inline code
* Code blocks
* Block quotes
* Bulleted lists
* Numbered lists
* Links
* Mentions
* Channel mentions
* Emoji
* Reactions
* Attachments
* Record links
* Message previews
* Drag-and-drop files
* Paste images
* Voice messages if enabled

### Composer actions

* Send
* Schedule message
* Save draft
* Cancel
* Edit
* Reply
* Quote
* Forward/share where permitted

---

## 12. Threads

Threads provide focused discussions underneath a parent message.

### Thread functionality

* Start thread
* Reply
* Mention users
* Attach files
* React
* Quote
* Mark unread
* Follow/unfollow thread
* Subscribe/unsubscribe
* View participants
* View reply count

Users should be able to follow a thread without receiving all channel activity.

---

## 13. Message Editing & Deletion

Users should be able to edit messages according to permissions.

### Editing

* Edit own message
* Record edited timestamp
* Optionally preserve edit history
* Display edited indicator

### Deletion

Organizations should configure whether users can:

* Delete own messages
* Delete messages within a time limit
* Delete messages at any time
* Allow admins to delete messages

Deleted messages should follow organization retention and audit rules.

---

## 14. Message Reactions

Users should be able to react to messages.

### Features

* Emoji reactions
* Multiple reactions
* Reaction counts
* Add/remove own reaction
* View users who reacted

Organizations may define allowed reaction sets.

---

## 15. Mentions

Messaging should support contextual mentions.

### Mention types

* Individual user
* Team
* Channel
* Organization-wide mention
* Group/role mention

Examples:

* @Petros
* @Developers
* @Sales
* @channel
* @everyone

Mentions should trigger notifications according to recipient notification preferences and channel rules.

---

## 16. Notifications

> Engine defined by → [14 Notifications & Activity Center](./14-notifications-activity-center.md) · Linear LOG-403. Messaging emits the events below; 14 owns channels, global preferences, inbox and delivery. Sections 17–18 describe only the messaging-specific settings layered on top of 14.

### Notification events emitted

* Direct message
* Mention
* Thread reply
* Reaction
* New channel message
* Channel invitation
* Added to group DM
* Message reminder
* Pinned message
* Shared record update
* Customer message
* Announcement

Channels (in-app, desktop, browser, push, email) are provided by 14 §5.

---

## 17. Notification Preferences

Global preferences, Do Not Disturb and digest settings live in 14 §6. Messaging adds **per-channel and per-conversation** settings:

### Preferences

* All messages
* Mentions and direct messages
* Only direct messages
* Nothing
* Custom per-channel settings

Additional settings:

* Thread notifications
* Reaction notifications
* Keyword notifications
* Desktop notifications
* Mobile notifications
* Email notifications
* Sound
* Notification schedule
* Do Not Disturb schedule

---

## 18. Notification Inbox

The inbox is the Activity Center of 14 §7. Messaging contributes these categories and actions to it rather than building a separate inbox:

### Categories

* Mentions
* Replies
* Direct messages
* Reactions
* Channel activity
* Invitations
* Reminders
* Shared record events

### Actions

* Mark read
* Mark unread
* Mark all read
* Open source message
* Filter
* Search
* Clear notification

---

## 19. Unread Management

Users should be able to manage unread content.

### Features

* Unread message indicators
* Unread channel count
* Unread DM count
* Mention count
* Mark channel read
* Mark conversation read
* Mark message unread
* Jump to first unread
* Global unread inbox

---

## 20. Saved Messages & Bookmarks

Users should be able to save important messages.

### Saved message features

* Save message
* Remove save
* Add personal reminder
* Add note
* Filter saved messages
* Search saved messages
* Open original conversation

Saved messages are personal unless explicitly shared.

---

## 21. Message Reminders

Users should be able to create reminders from messages.

### Reminder options

* Later today
* Tomorrow
* Next week
* Custom date/time

When triggered, the user receives a notification linking back to the original message.

---

## 22. File & Attachment Sharing

Messaging should support file sharing.

### Supported attachment types

* Images
* PDFs
* Documents
* Spreadsheets
* Presentations
* Videos
* Audio
* Archives
* Other configured file types

### Attachment metadata

* File name
* Type
* Size
* Uploader
* Upload date
* Associated message
* Associated conversation
* Preview
* Download/access permissions

Attachments are Documents owned by [17 Documents & File Management](./17-documents-file-management.md) (LOG-407), linked to the message and conversation. Vault entries (17 §12) cannot be attached; only a reference link is shared.

---

## 23. Link Sharing & Previews

Messages containing URLs should support link previews.

### Preview data

* Title
* Description
* Image
* Domain
* URL

Internal application links should generate rich previews for:

* Projects
* Tasks
* Customers
* Contacts
* Deals
* Proposals
* Contracts
* Invoices
* Payments
* Tickets
* Documents

Users should not receive access to a record they are not authorized to view.

---

## 24. Business Record Sharing

Messaging should be deeply connected to the Agency OS.

Users should be able to share records directly inside conversations.

### Supported records

* Project
* Task
* Milestone
* Customer
* Contact
* Lead
* Deal
* Proposal
* Contract
* Invoice
* Payment
* Support ticket
* Employee
* Document

### Shared record preview

A shared record should display:

* Record name
* Type
* Status
* Owner
* Relevant summary
* Key metadata
* Open record action

---

## 25. Contextual Messaging

Business records should optionally contain a dedicated conversation area.

Examples:

* Project discussion
* Task discussion
* Deal discussion
* Customer discussion
* Support ticket discussion
* Proposal discussion

### Requirements

* Conversation history linked to the record
* Record members inherit access according to permissions
* Messages remain searchable
* Record activity can surface relevant messages
* Notifications follow normal messaging rules

---

## 26. Project Channels

Projects should be able to create a dedicated communication channel.

When a project is created, the system may optionally create:

`#project-project-name`

The channel can automatically include:

* Project manager
* Assigned employees
* Project stakeholders

Customers should not automatically gain access unless explicitly configured.

### Project channel content

* Project discussions
* Decisions
* Status updates
* File sharing
* Task links
* Milestone discussions
* Meeting notes
* Change requests
* Project announcements

---

## 27. Customer / External Messaging

The system should optionally support external participants.

This allows customers to participate in selected conversations without accessing internal channels.

Ownership rule for customer communication:

* **Project collaboration** (ongoing discussion about a project with the customer) is a Messaging project customer channel, shown in 07 Customer Portal §6.
* **Support** (questions, problems, requests) is a Support conversation and Ticket in 13, including live chat and inbound email. Messaging does not implement a support inbox.
* External participants are Customer Portal Users (01 §79) or guests/external collaborators (01 §77–78); Messaging does not create its own external identities.

### External participant capabilities

* Secure login
* Access assigned customer channels
* Send messages
* Reply to threads
* Upload permitted files
* View permitted shared records
* Receive notifications
* Leave conversation

### External participant restrictions

External users must not automatically see:

* Internal channels
* Internal notes
* Private employee discussions
* Internal CRM information
* Financial records
* Employee information
* Other customers

---

## 28. Internal vs External Messages

Customer-facing channels should clearly distinguish:

* Internal messages
* External messages

The UI should make external visibility obvious before sending.

The system should prevent accidental posting of internal content into customer-facing conversations through clear permission boundaries and confirmation where appropriate.

---

## 29. Announcements

Organizations should be able to create announcement channels.

### Functionality

* Restricted posting
* Organization-wide visibility
* Important message styling
* Optional acknowledgement
* Pinning
* Scheduled announcements
* Read tracking where configured

Potential uses:

* Company announcements
* Policy changes
* Product releases
* Holiday notices
* Operational updates

---

## 30. Search

Messaging requires powerful global search.

### Search scope

* Messages
* Channels
* DMs
* Threads
* Attachments
* Shared records
* Users

### Search filters

* Sender
* Channel
* Conversation
* Date
* Message type
* Has attachment
* Has link
* Has reaction
* Mentioned user
* Record type
* Keyword
* Exact phrase

Selecting a result should open the conversation at the exact message.

---

## 31. Global Search Integration

Messaging search should integrate with the Agency OS global search.

A global search may return:

* CRM records
* Projects
* Tasks
* Documents
* Contracts
* Proposals
* Invoices
* Support tickets
* Messages
* Channels
* Employees

All results must respect permissions.

---

## 32. Keywords & Custom Notifications

Users should optionally subscribe to specific keywords.

Users should be able to:

* Create keyword
* Edit keyword
* Delete keyword
* Disable temporarily

When the term appears in an authorized conversation, the user receives a notification.

---

## 33. Channel Organization

Users should be able to organize channels.

### Features

* Favorites
* Custom sections
* Recently viewed
* Unread
* Direct messages
* Channels
* Projects
* Customer channels
* Archived

### Custom channel sections

Users may create sections such as:

* My Projects
* Sales
* Management
* Important Customers
* Internal

---

## 34. Channel Discovery

Users should be able to discover authorized channels.

### Discovery options

* Browse channels
* Search channels
* Filter by department
* Filter by project
* Filter by topic
* View member count
* View channel description
* Join public channels where allowed

Private channels should not expose sensitive metadata to unauthorized users.

---

## 35. Message Formatting

The messaging editor should support rich formatting without becoming unnecessarily complex.

### Formatting

* Bold
* Italic
* Strikethrough
* Inline code
* Code blocks
* Lists
* Quotes
* Links
* Headings where supported
* Tables where supported
* Emoji

Keyboard shortcuts should be supported for common actions.

---

## 37. Integrations

The messaging system should support integrations with the rest of the Agency OS and external tools.

### Internal integrations

* CRM
* Projects
* Tasks
* Customers
* Proposals
* Contracts
* Finance
* Support
* Employees
* Documents
* Calendar

### External integrations

Potential integrations:

* GitHub
* GitLab
* Jira
* Linear
* Google Drive
* Notion
* Microsoft 365
* Google Workspace
* Slack
* Discord
* Webhooks
* Custom API integrations

External integrations should be implemented as controlled event/message sources rather than tightly coupling the messaging core to a single provider.

---

## 38. Integration Messages

External systems may create messages or notifications inside designated channels.

Examples:

* New GitHub pull request
* Pull request merged
* Deployment failed
* Customer ticket created
* Payment failed
* Proposal accepted
* Contract signed
* New lead created

Integration messages should clearly indicate their external source.

---

## 39. Webhooks & API

Messaging must expose an extensible API.

### Core API capabilities

* Create conversation
* Retrieve conversation
* List conversations
* Add/remove members
* Send message
* Edit message
* Delete message
* Retrieve message
* Search messages
* Create thread
* Reply to thread
* Add reaction
* Remove reaction
* Upload attachment
* Create channel
* Update channel
* Archive channel
* Manage channel membership
* Read notification state
* Create reminders

### API principles

* Stable resource IDs
* Predictable resource relationships
* Authentication and authorization
* Idempotent write operations where appropriate
* Pagination
* Filtering
* Rate limiting
* Versioning strategy
* Auditability

---

## 40. Messaging Webhooks

Support events such as:

* `message.created`
* `message.updated`
* `message.deleted`
* `message.reaction_added`
* `message.reaction_removed`
* `thread.created`
* `thread.reply_created`
* `channel.created`
* `channel.updated`
* `channel.archived`
* `member.added`
* `member.removed`
* `mention.created`
* `attachment.created`
* `external_user.added`

Webhook delivery should support retries, signatures, event IDs, and idempotency.

---

## 41. Real-Time Communication

Messaging should be real-time.

### Real-time requirements

* New messages appear without page refresh
* Typing indicators
* Presence updates
* Read state updates
* Reaction updates
* Thread updates
* Channel membership updates
* Notification updates

### Connection handling

The client should gracefully handle:

* Network interruptions
* Reconnection
* Duplicate events
* Missed events
* Offline state
* Connection recovery

Messages should not be lost because of temporary connectivity issues.

---

## 42. Typing Indicators

Support typing indicators for:

* DMs
* Group DMs
* Channels
* Threads

Typing indicators should be ephemeral and should not be stored as permanent message records.

---

## 43. Read Receipts

Read receipts may be enabled depending on conversation type.

### Possible behavior

* DMs: read state
* Group conversations: read state
* Channels: unread state rather than per-user message receipts
* Customer conversations: configurable

Organizations should be able to configure privacy settings.

---

## 44. Voice & Video Communication

Messaging should provide an extensible foundation for calls.

### Optional functionality

* Start voice call
* Start video call
* Screen sharing
* Group calls
* Meeting links
* Call history
* Call participants

Calls may integrate with external providers rather than requiring the messaging system to implement a complete video infrastructure.

---

## 45. Audio / Voice Messages

Optional support for short audio messages.

### Features

* Record
* Preview
* Send
* Playback
* Pause/resume
* Duration
* Download where permitted

Audio messages should follow the same retention and permission rules as other attachments.

---

## 46. Drafts

Users should be able to save unsent messages.

### Draft properties

* Conversation
* User
* Content
* Attachments
* Created time
* Updated time

Drafts are private to the author and should persist across sessions.

---

## 47. Message Pinning

Authorized users should be able to pin important messages.

### Functionality

* Pin
* Unpin
* View pinned messages
* Pin notification
* Permission control

Pinned content may include:

* Announcements
* Project decisions
* Important links
* Procedures
* Meeting outcomes

---

## 48. Channel Topic & Description

Channels should provide lightweight contextual information.

### Topic

Short current focus or status.

### Description

Longer explanation of channel purpose.

---

## 49. Channel Moderation

Channel owners/admins should have moderation controls.

### Controls

* Restrict posting
* Remove members
* Manage permissions
* Delete messages
* Pin messages
* Archive channel
* Change channel topic
* Change description
* Manage external access

Moderation actions should be auditable.

---

## 50. Organization Moderation

Administrators should have organization-level controls.

### Administrative capabilities

* Search messages where policy permits
* Manage channels
* Manage users
* Remove users
* Manage retention
* Manage external access
* Manage file policies
* Manage integrations
* Review audit logs
* Configure moderation policies

Administrative access to private messages should be governed by explicit organizational policy and appropriate access controls.

---

## 51. Audit Log

Messaging actions should generate audit events where appropriate.

### Audit events

* Channel created
* Channel archived
* Channel deleted
* Member added
* Member removed
* Message edited
* Message deleted
* Message pinned
* Message unpinned
* External user added
* Permission changed
* Retention policy changed
* Integration connected/disconnected
* Admin action performed

Audit logs should be immutable and accessible only to authorized administrators.

---

## 52. Security

> Authentication, authorization, RBAC, organization isolation and session management are defined by → [01](./01-users-organizations-permissions.md) · Linear LOG-406.

Messaging consumes the central authorization service and adds:

### Requirements

* Authentication
* Authorization
* Role-based access control
* Organization isolation
* Channel-level permissions
* Secure file access
* Encryption in transit
* Encryption at rest where supported
* Session management
* Rate limiting
* Abuse prevention
* Secure API authentication
* Webhook signature verification
* Access logging

Users must never be able to retrieve messages or attachments outside their authorization scope.

---

## 53. Privacy

Privacy controls should include:

* Private channels
* Private DMs
* External participant restrictions
* Message retention settings
* Data export controls
* Administrative access controls
* User visibility controls
* Presence privacy
* Read receipt controls

The organization should clearly define how long messages and attachments are retained.

---

## 54. Retention Policies

Organizations should be able to configure message retention.

### Retention scopes

* Organization-wide
* Team or Branch
* Channel
* Conversation type

### Possible retention behavior

* Unlimited
* Fixed period
* Archive after period
* Delete after period

Retention policies should apply consistently to:

* Messages
* Threads
* Attachments
* Reactions
* Metadata where legally and technically appropriate

---

## 55. Data Export

Authorized administrators should be able to export messaging data.

### Export options

* Organization
* Team or Branch
* Channel
* Date range
* Conversation type
* User

Export should preserve:

* Message content
* Sender
* Timestamp
* Threads
* Attachments metadata
* Reactions
* Channel information

Export permissions should be tightly controlled.

---

## 57. Customer Communication Boundaries

Customer-facing messaging must remain clearly separated from internal company communication.

The platform should support:

* Internal-only channels
* Customer-visible channels
* Customer-specific workspaces
* External users
* Customer permissions
* Customer-specific file access
* Internal-only threads where explicitly supported

The system should make visibility obvious in the interface.

---

## 58. Messaging & CRM Integration

Messaging should integrate with CRM without becoming a CRM replacement.

### CRM links

Messages may reference:

* Lead
* Contact
* Company
* Deal
* Customer

The CRM record may display relevant linked conversations.

CRM users should be able to navigate:

**CRM Record → Related Conversations**

Messaging users should be able to navigate:

**Message → Related CRM Record**

---

## 59. Messaging & Project Management Integration

Projects should be able to surface communication context.

### Integration

* Project → Project Channel
* Task → Task Discussion
* Milestone → Milestone Discussion
* Change Request → Change Request Discussion

The project interface should show recent relevant messages without duplicating the complete messaging experience.

---

## 60. Messaging & Support Integration

Support tickets may have linked conversations.

Example:

Customer creates support ticket → system creates or links support conversation → authorized internal support staff discuss the issue → customer sees only the customer-facing portion.

Internal support notes remain private.

---

## 61. Messaging & Finance Integration

Financial events may optionally be posted to channels as system messages through a 20 Automation Engine rule ("post message to channel" action).

Examples:

* Invoice paid
* Payment failed
* Subscription canceled
* Refund processed

These should be system-generated events rather than manually written messages.

---

## 62. Messaging & Employee Management

Employee records should link to messaging identity.

### Employee profile may show

* Messaging status
* Department
* Team
* Recent activity where authorized
* Joined channels
* Direct message action

Messaging permissions should remain independent from HR permissions.

---

## 63. Searchable Decision History

The messaging system should preserve business context over time.

Users should be able to locate decisions through:

* Search
* Project channels
* Threads
* Pinned messages
* Record-linked conversations
* Saved messages

Important decisions may optionally be converted into structured records such as:

* Task
* Decision
* Note
* Project update
* Change request

This should be a user-controlled action.

---

## 64. Conversation Actions

Every message should expose contextual actions.

### Standard actions

* Reply
* React
* Edit
* Delete
* Copy
* Link to message
* Save
* Remind me
* Pin
* Share
* Forward where allowed
* Mark unread
* Open related record
* Report

---

## 65. Message Permalinks

Every message should have a stable internal URL.

A user can:

* Copy message link
* Share link with authorized users
* Open exact message
* Use message URL in project/task records

Permission checks must occur when the URL is opened.

---

## 66. Reporting & Analytics

Provide organization-level messaging analytics without turning the module into employee surveillance.

### Metrics

* Active users
* Active channels
* Messages sent
* Messages by channel
* DMs
* Threads
* Average response time where appropriate
* Unread volume
* Most active channels
* External conversations
* File sharing volume

Metrics should focus on system usage and collaboration patterns rather than simplistic employee productivity scoring.

---

## 67. Admin Dashboard

Administrators should have a messaging administration area.

### Dashboard sections

* Users
* Channels
* Guests
* External users
* Storage
* Retention
* Integrations
* Permissions
* Audit log
* Usage
* Security
* Moderation

---

## 69. Rate Limits & Abuse Prevention

The messaging API and UI should include protections against abuse.

### Controls

* Message rate limits
* File upload limits
* API rate limits
* Spam detection
* Repeated message protection
* Suspicious activity monitoring
* Integration rate limits

Administrators should receive alerts for significant abuse events.

---

## 71. Mobile & Responsive Experience

Messaging should work effectively on:

* Desktop
* Tablet
* Mobile web
* Native mobile app if implemented

Mobile priorities:

* DMs
* Notifications
* Mentions
* Quick replies
* File/image sharing
* Search
* Channel switching
* Voice messages
* Push notifications

---

## 72. Desktop Experience

The desktop UI should support a Slack-like three-column workflow.

### Suggested layout

**Left sidebar**

* Organization
* Search
* Home
* DMs
* Channels
* Favorites
* Custom sections

**Center**

* Conversation
* Message history
* Composer

**Right panel**

* Thread
* Conversation details
* Members
* Shared files
* Pinned messages
* Related records

The interface should remain configurable and responsive.

---

## 73. Keyboard Shortcuts

Support common shortcuts such as:

* New message
* Search
* Navigate channels
* Navigate DMs
* Jump to unread
* Open thread
* Mark read
* Send
* New line
* Focus composer

Shortcut configuration should avoid conflicts with browser and OS shortcuts.

---

## 74. Draft & Offline Behavior

The client should preserve drafts during temporary network outages.

### Offline behavior

Where technically feasible:

* View recently cached conversations
* Compose messages
* Save drafts
* Queue messages for delivery
* Synchronize when connectivity returns

The system must clearly indicate message delivery status.

---

## 75. Message Delivery States

Messages may have states such as:

* Draft
* Sending
* Sent
* Delivered
* Failed
* Retrying
* Deleted

The UI should provide clear feedback when a message fails to send.

---

## 76. Reliability

Messaging is a real-time operational system and should prioritize reliability.

### Requirements

* No duplicate messages
* No silent message loss
* Ordered message display where possible
* Reliable event delivery
* Automatic reconnect
* Retry mechanisms
* Idempotent API operations
* Consistent unread state
* Consistent thread state

---

## 77. Performance

The system should remain responsive with large organizations and high message volume.

### Requirements

* Pagination/infinite scrolling
* Lazy loading
* Virtualized message lists where needed
* Efficient search
* Attachment lazy loading
* Cached conversations
* Incremental synchronization
* Efficient unread tracking
* Efficient notification delivery

Large channels should not require loading the entire message history.

---

## 78. Message History Loading

Messages should load incrementally.

### Navigation

* Latest messages
* Scroll upward for history
* Jump to date
* Jump to unread
* Jump to message
* Search result navigation

When opening a permalink, the client should load enough surrounding context to make the message understandable.

---

## 79. Notification Rules Engine

The notification system should support configurable rules.

### Rule examples

* Notify me for all messages in channel
* Notify only when mentioned
* Notify for threads I follow
* Notify for messages containing keyword
* Do not notify during working hours
* Do not notify during DND
* Notify immediately for customer messages

Rules should be evaluated consistently across web and mobile clients.

---

## 80. Customization

Organizations should be able to customize:

* Channel naming rules
* Default channels
* Default notification settings
* Message retention
* File limits
* External access
* Guest access
* Mention permissions
* Announcement permissions
* Emoji/reaction availability
* Branding (consumed from 01 §15)
* Channel sections and defaults

---

## 81. Permissions Model

> Catalog, roles and scopes defined by → [01](./01-users-organizations-permissions.md) §44–52 · Linear LOG-406. Keys follow 01 §46 (`messaging.channels.manage`, `messaging.messages.delete_any`, `messaging.external_users.manage`).

Messaging permissions apply at organization, channel and conversation levels.

### Organization permissions

* Manage messaging
* Manage channels
* Manage users
* Manage external users
* Manage retention
* Manage integrations
* View audit logs
* Export data

### Channel permissions

* View
* Join
* Post
* Reply
* Edit own messages
* Delete own messages
* Pin
* Manage members
* Manage channel
* Archive

### External permissions

* View assigned channels
* Send messages
* Reply
* Upload files
* View shared records

---

## 82. Guest Users

Support limited guest users.

### Guest types

* Single-channel guest
* Multi-channel guest
* Customer guest
* Partner guest
* Temporary guest

Guest access should automatically expire when configured.

---

## 83. External Identity

External users should have a clear identity marker.

Example:

`Maria Papadopoulou — ACME Corp — Guest`

This prevents confusion between employees and external participants.

---

## 85. Sensitive Information Controls

The platform should provide configurable controls for sensitive content.

Potential future capabilities:

* Sensitive data detection
* External sharing warnings
* Restricted file types
* Confidential channel labels
* Prevent external forwarding
* DLP integrations

These should be optional and configurable rather than mandatory.

---

## 86. Search & Permissions

Search must never reveal unauthorized information.

For every result, the system must verify:

* Organization membership
* Team or Branch scope
* Channel access
* Conversation access
* Record access
* Attachment access

A user should not be able to infer private message contents through search metadata.

---

## 87. Notifications & Privacy

Notifications must also respect permissions.

Do not expose sensitive message content through:

* Push notifications
* Email notifications
* Desktop previews
* Browser notifications

Users should be able to configure whether notification previews contain message text.

---

## 88. Message Thread Following

Users should be able to follow important threads.

### Thread following

* Follow thread
* Unfollow thread
* Notify on replies
* Show followed threads in inbox
* Mark thread read

Thread following should not automatically subscribe users to the entire channel.

---

## 90. Channel Digest

Optional digest functionality may summarize activity for channels where users do not need real-time notifications.

Possible digest periods:

* Hourly
* Daily
* Weekly

The digest should link directly to the relevant messages.

---

## 91. System Messages

The platform should support system-generated messages.

Examples:

* User joined channel
* User left channel
* Channel renamed
* Channel archived
* Integration connected
* Project linked
* Customer added

System messages should be visually distinct from user messages.

---

## 92. Automated System Events

Internal modules may publish operational events to messaging.

Examples:

**CRM**

* New qualified lead
* Deal won

**Projects**

* Project created
* Milestone completed

**Finance**

* Invoice paid

**Contracts**

* Contract signed

**Support**

* Ticket escalated

These events should be configurable and should not create excessive noise.

---

## 93. Conversation Templates

Organizations may define templates for recurring communication spaces.

### New project channel

Automatically create:

* Project channel
* Standard description
* Required members
* Pinned project overview
* Links to project dashboard
* Standard discussion sections

### Customer onboarding channel

Automatically include:

* Customer
* Account manager
* Project manager
* Relevant internal team
* Onboarding documentation

---

## 94. Channel Naming & Conventions

Organizations may define naming conventions.

Examples:

* `#general`
* `#announcements`
* `#engineering`
* `#sales`
* `#project-website-redesign`
* `#customer-acme`
* `#support-1234`

Naming rules should prevent duplicate/confusing channel names.

---

## 95. Archival & Lifecycle Automation

> Engine defined by → [20 Automation Engine](./20-automation-engine.md) · Linear LOG-410. Messaging exposes "create channel", "archive channel" and "post message" actions.

Channels may be automatically archived based on rules.

Examples:

* Project completed → archive project channel after configured period
* Customer inactive → archive customer channel
* Temporary channel → archive after expiration

Archived conversations remain searchable according to retention policies.

---

## 96. Cross-Organization Messaging

Cross-organization messaging may be supported in the future.

Potential use cases:

* Agency ↔ Partner
* Agency ↔ Contractor
* Agency ↔ Customer

Cross-organization access must use explicit invitations and isolated permissions.

---

## 97. API Extensibility

Messaging resources should behave as first-class API objects.

Conceptual resources:

* `/users`
* `/conversations`
* `/channels`
* `/messages`
* `/threads`
* `/reactions`
* `/attachments`
* `/members`
* `/notifications`
* `/reminders`
* `/webhooks`

The exact API structure can evolve, but resource IDs should remain stable.

---

## 100. Cross-Module Navigation

The messaging system should support deep navigation.

Examples:

* Message → Project
* Message → Customer
* Message → Deal
* Message → Task
* Message → Ticket
* Message → Proposal
* Message → Contract
* Project → Project Channel
* Customer → Customer Conversations
* Deal → Deal Discussion
* Ticket → Support Conversation

This should make messaging part of the operating system rather than an isolated chat application.

---

## 101. Home / Messaging Dashboard

Provide a messaging home page.

### Suggested sections

* Unread
* Mentions
* DMs
* Favorites
* Recent conversations
* Followed threads
* Saved messages
* Reminders
* Customer conversations
* Project conversations

Users should be able to continue work quickly without manually navigating through channels.

---

## 102. Recent Conversations

Show recently active conversations.

Each item may display:

* Conversation name
* Latest message
* Sender
* Timestamp
* Unread state
* Mention indicator
* Related project/customer

---

## 103. Conversation Information Panel

A conversation details panel should show:

* Members
* Channel description
* Topic
* Files
* Pinned messages
* Shared records
* Notification settings
* Channel settings
* Related project/customer
* Integrations

---

## 104. Message Analytics

Per-channel analytics may include:

* Message volume
* Active participants
* Thread count
* Response patterns
* File volume
* Usage over time

Analytics should avoid being presented as a simplistic employee performance score.

---

## 105. Internationalization

Support:

* Multiple languages
* Timezones
* Locale-aware dates
* Locale-aware timestamps
* Unicode
* RTL languages where required

Search should handle multilingual text correctly.

---

## 106. Compliance

The messaging module should provide configurable controls for applicable organizational and legal requirements.

Potential requirements:

* Data retention
* Data export
* Access logging
* Deletion policies
* Consent/guest access
* Administrative controls
* Audit trails

Specific compliance requirements should be configurable based on the organization's jurisdiction and policies.

---

## 108. Multi-Tenant Isolation

> Defined by → [01](./01-users-organizations-permissions.md) §3, §9 · Linear LOG-406.

The Agency OS is multi-tenant. Messaging data is isolated by Organization.

No user, API request, search operation, notification, file URL, or integration event should cross organization boundaries without explicit authorization.

---

## 109. Core User Journeys

### Journey 1 — Send a DM

User opens colleague profile → clicks Message → enters message → sends → recipient receives real-time notification → conversation appears in DM history.

### Journey 2 — Create a project channel

Project manager creates project → system offers to create project channel → members are added → channel appears in project and messaging navigation.

### Journey 3 — Discuss a task

User opens task → opens discussion → sends message → task-linked conversation is visible to authorized project members.

### Journey 4 — Customer conversation

Account manager creates customer channel → invites customer → customer receives secure invitation → customer communicates with agency → internal-only channels remain inaccessible.

### Journey 5 — Share a deal

Sales user shares CRM deal into sales channel → users see deal preview → authorized users can open CRM record.

### Journey 6 — Follow a thread

User replies to message → follows thread → receives notifications only for thread replies rather than all channel activity.

---

## 110. Non-Goals

The messaging module should not become a replacement for every other communication or business system.

### Not part of the core messaging module

* Email marketing campaigns
* Bulk SMS campaigns
* Email CRM sequences
* Marketing automation
* Full CRM functionality
* Full project management
* Full helpdesk
* Full document management
* Full video conferencing infrastructure
* Payroll/HR management

The messaging system should integrate with these modules rather than duplicate their responsibilities.

---

## 114. Success Criteria

The messaging module should achieve the following:

* Employees can communicate without leaving the Agency OS.
* Users can quickly find historical conversations.
* Projects have contextual communication.
* Customers can participate in controlled external conversations.
* Messages are linked to business records.
* Notifications are reliable but configurable.
* Search respects permissions.
* Real-time communication feels immediate.
* High-volume channels remain performant.
* Administrative controls are sufficient for an agency environment.
* Messaging data remains secure and auditable.
* The module can integrate with external systems through APIs and webhooks.
* The messaging system can scale from a small agency to larger organizations.

---

## 115. Module Relationship

The Messaging module should sit alongside the other Agency OS modules.

**CRM**
→ Sales relationships and pipeline

**Messaging**
→ Real-time internal/external collaboration

**Projects**
→ Work execution

**Tasks**
→ Individual work items

**Customer Portal**
→ Customer-facing access

**Contracts**
→ Commercial/legal agreements

**Finance**
→ Invoices, payments, expenses, profitability

**Support**
→ Customer issue management

**Communications**
→ Email/SMS and outbound communication

**Employees**
→ People, HR and organizational management

**Documents**
→ Centralized business documentation

Messaging acts as the communication layer connecting these modules while keeping ownership of business data inside the appropriate module.
