/* App registry. Every rail entry is a standalone product area with its own panel (and its own main layout in core/views.js).
   Panel item keys: l label · i icon · c count · alert · dot (color) · pre ('#' etc.) · av [initials,cls,pres] · bold (unread) · tag · active · children[]
   Extra keys: k = routable sub-page (hash #app/k) · open = expanded by default.

   @impl HOW THIS FILE MAPS TO PRODUCTION
     - One entry = one top-level route group in `app/` (`/projects`, `/tasks`, `/messages`, `/support`, `/campaigns`, ...). `/admin` is reached
       from the gear at the bottom of the rail, not from the app list (`hidden: 1`).
     - `panel` = the contextual sidebar of that app. Build it as a per-app `<AppSidebar>` fed by a typed config (like this one) so the shell stays dumb.
     - VISIBILITY RULE for every rail entry (evaluate on the server and return the list; do not hard-code in the client):
         show only if  OrganizationModule(module).enabled  AND  MembershipModuleAccess(module).enabled  AND  the caller holds the VIEW permission below.
       The same rule hides the app from MCP tool listings and from the command palette.
     - Counts (`c`) are live numbers: unread/open counts come from the owning module's API (Notifications 14 for the inbox, Support 13 for open
       conversations...). Refresh via the notifications channel, not by polling every panel.
     - `newLabel` = the primary action in the app bar; it must be gated by the CREATE permission of the app (e.g. `tasks.tasks.create`).
     - `sep: 1` draws the thin divider that separates app families on the rail. It is purely visual, there is no grouping in the data model.
   @note Each app below names its ModuleKey (schema enum) and the VIEW permission. Verify every key against api/prisma/seed/permission-catalog.ts before use. */
(function () {
  const P = (title, blocks, action) => ({ title, blocks, action });
  const items = (arr) => ({ items: arr });
  const sec = (label, arr, action) => ({ label, items: arr, action });
  const simple = (title, subs, action) => P(title, [items(subs.map((s, i) => ({ l: s, active: i === 0 })))], action);

  const APPS = [
    /* @impl Home — no ModuleKey. Personal dashboard (my work, inbox, recent). Aggregates other modules; shows only what the caller may see. */
    { id: "home", label: "Home", icon: "home", newLabel: "New task",
      alias: { recent: "favorites" },
      panel: P("Home", [
        items([{ l: "Overview", i: "home", k: "overview" }, { l: "My work", i: "tasks", k: "my-work", c: 4 }, { l: "Favorites & recent", i: "star", k: "favorites" }]),
      ], "plus") },

    /* ---- work ---- */
    /* @impl Projects — ModuleKey PROJECTS · docs/features/05 · VIEW projects.projects.read · CREATE projects.projects.create · portfolio views need projects.portfolio.read
       @data Project (+30 child tables of 05), ProjectFavorite (per-member starred projects).
       @note "Favorites" = ProjectFavorite rows of the signed-in member. "By customer" groups by Project.company_id (CrmCompany, 02). The workspace of one project is /projects/:id (alias of "All projects" in this mockup). */
    { id: "projects", label: "Projects", icon: "folder", newLabel: "New project", newRoute: "create", sep: 1,
      alias: { detail: "list" },
      panel: P("Projects", [
        items([{ l: "Overview", i: "home", k: "overview" }, { l: "All projects", i: "folder", k: "list" }, { l: "New project", i: "plus", k: "create" }, { l: "Milestones", i: "flag", k: "milestones" }, { l: "Timeline", i: "calendar", k: "timeline" }, { l: "RAID log", i: "flag", k: "raid", c: 9 }, { l: "Workload", i: "users", k: "workload" }, { l: "Status update", i: "send", k: "updateNew" }]),
        sec("Favorites", [{ l: "Mobile App v2", dot: "yellow", k: "detail" }, { l: "Acme Rebrand Website", dot: "green" }, { l: "Customer Portal Build", dot: "red" }]),
        sec("By customer", [{ l: "Acme Corp", i: "building" }, { l: "Northwind", i: "building" }, { l: "Globex", i: "building" }, { l: "Initech", i: "building" }]),
        items([{ l: "Setup", i: "settings", k: "settings" }, { l: "Archive", i: "archive" }]),
      ], "plus") },
    /* @impl Tasks — ModuleKey TASKS · docs/features/06 · VIEW tasks.tasks.read · CREATE tasks.tasks.create
       @data Task, TaskStatus, TaskType, TaskLabel, Cycle (sprints), Release, ReleaseDeployment, Team.task_key (key prefix).
       @note "Teams" are Team rows of module 01 (kind TEAM/DEPARTMENT) that have a task_key; "Views" are SavedView rows (entity_type TASK, module 02 platform table). The page of one task is /tasks/WEB-142 (alias of "My tasks" here).
             Linear-style: the panel is the filter; keep URLs shareable (`/tasks/teams/web/board?cycle=14`). */
    { id: "tasks", label: "Tasks", icon: "tasks", newLabel: "New task", newRoute: "create",
      alias: { detail: "mine" },
      panel: P("Tasks", [
        items([{ l: "My tasks", i: "tasks", k: "mine" }, { l: "All tasks", i: "list", k: "all" }, { l: "New task", i: "plus", k: "create" }, { l: "Workload", i: "users", k: "workload" }, { l: "Reports", i: "chart", k: "reports" }]),
        sec("Web team", [{ l: "Board", i: "layers", k: "board" }, { l: "Backlog", i: "inbox", k: "backlog", c: 2 }, { l: "Timeline", i: "calendar", k: "timeline" }, { l: "Cycles", i: "time", k: "cycles" }, { l: "Task page", i: "file", k: "detail" }]),
        sec("Organization", [{ l: "Releases", i: "flag", k: "releases" }]),
        sec("Views", [{ l: "Overdue", i: "filter" }, { l: "Unassigned", i: "filter" }, { l: "Client requests", i: "filter" }, { l: "Blocked", i: "filter" }], "plus"),
        items([{ l: "Setup", i: "settings", k: "settings" }]),
      ], "edit") },
    /* @impl Time — ModuleKey TIME_TRACKING · docs/features/18 · VIEW time.entries.read_own (read_team / read_all widen the scope) · CREATE time.entries.create_own */
    { id: "time", label: "Time", icon: "clock", newLabel: "Add entry", newRoute: "create",
      alias: { entry: "entries", sheet: "team", rateNew: "rates", projectEdit: "projects" },
      panel: P("Time tracking", [
        items([{ l: "Timer", i: "time", k: "timer" }, { l: "My timesheet", i: "calendar", k: "week" }, { l: "Daily list", i: "list", k: "day" }, { l: "Add entry", i: "plus", k: "create" }, { l: "Suggestions", i: "sparkles", k: "suggestions", c: 4 }]),
        sec("Team", [{ l: "Team timesheets", i: "users", k: "team" }, { l: "Approvals", i: "check", k: "approvals", c: 2 }, { l: "All entries", i: "grid", k: "entries" }]),
        sec("Billing", [{ l: "Ready to invoice", i: "receipt", k: "unbilled" }, { l: "Billing rates", i: "dollar", k: "rates" }, { l: "Project settings", i: "folder", k: "projects" }]),
        sec("Insights", [{ l: "Reports", i: "chart", k: "reports" }, { l: "Import & export", i: "file", k: "io" }]),
        items([{ l: "Setup", i: "settings", k: "settings" }]),
      ], "plus") },
    /* @impl Calendar — ModuleKey CALENDAR · docs/features/19 · VIEW calendar.events.read · CREATE calendar.events.manage */
    { id: "calendar", label: "Calendar", icon: "calendar", newLabel: "New event", newRoute: "create",
      alias: { },
      panel: P("Calendar", [
        items([{ l: "Week", i: "calendar", k: "week" }, { l: "Day", i: "clock", k: "day" }, { l: "Month", i: "grid", k: "month" }, { l: "Agenda", i: "list", k: "agenda" }, { l: "New event", i: "plus", k: "create" }, { l: "Quick create", i: "zap", k: "quick" }, { l: "Event page", i: "file", k: "detail" }]),
        sec("Plan", [{ l: "Team availability", i: "users", k: "team" }, { l: "Rooms and resources", i: "building", k: "resources" }, { l: "Time off and holidays", i: "flag", k: "timeoff" }, { l: "My availability", i: "clock", k: "availability" }]),
        sec("Scheduling", [{ l: "Booking links", i: "link", k: "bookings" }, { l: "Bookings", i: "inbox", k: "bookingList", c: 2 }, { l: "Booking page", i: "file", k: "bookingDetail" }, { l: "New booking link", i: "plus", k: "bookingNew" }, { l: "Public page preview", i: "globe", k: "bookingPublic" }]),
        sec("Calendars", [{ l: "Anna Meyer", dot: "blue", k: "calendars" }, { l: "Web team", dot: "green", k: "calendarDetail" }, { l: "Mobile App v2", dot: "purple", k: "calendars" }, { l: "Acme Corp", dot: "yellow", k: "calendars" }, { l: "New calendar", i: "plus", k: "calendarNew" }], "plus"),
        items([{ l: "Sync and integrations", i: "plug", k: "sync" }, { l: "Setup", i: "settings", k: "settings" }]),
      ], "plus") },

    /* ---- sales ---- */
    /* @impl CRM — ModuleKey CRM · docs/features/02 · VIEW crm.deals.read (companies/contacts/leads have their own read keys) · CREATE crm.deals.create
       @data CrmDeal, CrmLead, CrmCompany, CrmContact, CrmPipeline, CrmActivity. Sub-pages show only if the matching *.read key is held. */
    { id: "crm", label: "CRM", icon: "crm", newLabel: "New deal", newRoute: "deal-new", sep: 1,
      /* alias: create/detail/wizard routes keep their list highlighted in the panel. Every route is a screen of modules/02-crm/views.js. */
      alias: { deal: "deals", "deals-list": "deals", "deal-new": "deals", "deal-edit": "deals", "deal-products": "deals", "deal-close": "deals",
        lead: "leads", "lead-new": "leads", "lead-edit": "leads", "lead-convert": "leads", "bulk-assign": "leads",
        company: "companies", "company-new": "companies", "company-edit": "companies", "company-merge": "duplicates",
        contact: "contacts", "contact-new": "contacts", "contact-edit": "contacts", "contact-merge": "duplicates",
        "vendor-new": "vendors", "partner-new": "partners",
        "activity-new": "activities", "activity-meeting": "activities", "activity-email": "activities", "activity-followup": "activities",
        "import-map": "imports", "import-dupes": "imports", "import-preview": "imports", "import-run": "imports" },
      panel: P("CRM", [
        items([{ l: "Dashboard", i: "chart", k: "dashboard" }, { l: "Deals", i: "crm", k: "deals", c: 9 }, { l: "Leads", i: "inbox", k: "leads", c: 7 }, { l: "Companies", i: "building", k: "companies" }, { l: "Contacts", i: "users", k: "contacts" }, { l: "Activities", i: "phone", k: "activities", c: 3 }, { l: "Forecast", i: "zap", k: "forecast" }, { l: "Reports", i: "chart", k: "reports" }]),
        sec("Records", [{ l: "Vendors", i: "box", k: "vendors" }, { l: "Partners", i: "link", k: "partners" }, { l: "Duplicates", i: "layers", k: "duplicates", c: 28 }]),
        sec("Saved views", [{ l: "My open deals", i: "star" }, { l: "Closing this month", i: "calendar" }, { l: "Stale deals", i: "clock" }, { l: "Hot leads", i: "filter" }, { l: "Customers", i: "building" }], "plus"),
        sec("Setup", [{ l: "Pipelines & stages", i: "layers", k: "pipelines" }, { l: "Custom fields", i: "list", k: "custom-fields" }, { l: "Tags", i: "tag", k: "tags" }, { l: "Saved views", i: "star", k: "saved-views" }, { l: "Import & export", i: "box", k: "imports" }]),
      ], "plus") },
    /* @impl Proposals — ModuleKey PROPOSALS · docs/features/03 · VIEW proposals.proposals.read · CREATE proposals.proposals.create */
    { id: "proposals", label: "Proposals", icon: "file", newLabel: "New proposal", newRoute: "create",
      alias: { editor: "list", customer: "list", accept: "list", signed: "list", send: "list", compare: "list", "review-request": "list", approval: "list", comments: "list", convert: "list", ai: "list", template: "templates", "template-new": "templates", rule: "templates", "rule-new": "templates", "analytics-pipeline": "analytics" },
      panel: P("Proposals", [
        items([{ l: "All proposals", i: "file", k: "list", c: 14 }, { l: "New proposal", i: "plus", k: "create" }, { l: "Tracking", i: "globe", k: "tracking" }, { l: "Analytics", i: "chart", k: "analytics" }, { l: "Pipeline & engagement", i: "layers", k: "analytics-pipeline" }]),
        sec("Views", [{ l: "Drafts", i: "edit" }, { l: "Awaiting approval", i: "check", c: 2 }, { l: "Sent, not viewed", i: "mail" }, { l: "Viewed", i: "globe" }, { l: "Expiring soon", i: "clock" }], "plus"),
        sec("Working on a proposal", [{ l: "Editor", i: "edit", k: "editor" }, { l: "AI assistant", i: "sparkles", k: "ai" }, { l: "Send", i: "send", k: "send" }, { l: "Compare versions", i: "layers", k: "compare" }, { l: "Request review", i: "users", k: "review-request" }, { l: "Approve (approver)", i: "check", k: "approval" }, { l: "Comments", i: "chat", k: "comments" }, { l: "Convert accepted", i: "zap", k: "convert" }]),
        sec("Customer pages", [{ l: "Customer view", i: "globe", k: "customer" }, { l: "Customer decision", i: "check", k: "accept" }, { l: "Link states", i: "lock", k: "signed" }]),
        sec("Setup", [{ l: "Templates & rules", i: "layers", k: "templates" }, { l: "Template editor", i: "edit", k: "template" }, { l: "Approval rule", i: "shield", k: "rule" }, { l: "Pricing library", i: "dollar" }]),
      ], "plus") },
    /* @impl Contracts — ModuleKey CONTRACTS · docs/features/04 · VIEW contracts.contracts.read · CREATE contracts.contracts.create
       @note contracts.confidential_terms.read is FIELD-LEVEL: hide those fields, do not just grey them out. */
    { id: "contracts", label: "Contracts", icon: "pen", newLabel: "New contract", newRoute: "create",
      alias: { detail: "list", editor: "list", compare: "list", "review-request": "list", negotiation: "list", approval: "list", rule: "templates", "rule-new": "templates", "send-signature": "signatures", "sign-verify": "signatures", "sign-document": "signatures", "sign-done": "signatures", certificate: "signatures", "sign-invalid": "signatures", obligation: "obligations", "obligation-new": "obligations", extraction: "obligations", renew: "renewals", amend: "list", terminate: "list", template: "templates", "template-new": "templates", clause: "templates", "clause-new": "templates", type: "templates", "type-new": "templates", "ai-review": "list" },
      panel: P("Contracts", [
        items([{ l: "Dashboard", i: "chart", k: "dashboard" }, { l: "All contracts", i: "pen", k: "list" }, { l: "New contract", i: "plus", k: "create" }, { l: "Signature requests", i: "send", k: "signatures", c: 3 }, { l: "Obligations", i: "check", k: "obligations", c: 5 }, { l: "Renewals", i: "calendar", k: "renewals", c: 3 }, { l: "Analytics", i: "chart", k: "analytics" }]),
        sec("Views", [{ l: "Drafts", i: "edit" }, { l: "In review", i: "users" }, { l: "Awaiting signature", i: "pen", c: 2 }, { l: "Active", i: "check" }, { l: "Expiring", i: "clock", c: 3 }, { l: "Amendments", i: "layers" }, { l: "Terminated", i: "x" }], "plus"),
        sec("Working on a contract", [{ l: "Contract page", i: "file", k: "detail" }, { l: "Editor", i: "edit", k: "editor" }, { l: "Compare versions", i: "layers", k: "compare" }, { l: "Request review", i: "users", k: "review-request" }, { l: "Negotiation", i: "chat", k: "negotiation" }, { l: "Approve (approver)", i: "check", k: "approval" }, { l: "AI review", i: "sparkles", k: "ai-review" }, { l: "Send for signature", i: "send", k: "send-signature" }]),
        sec("Lifecycle", [{ l: "Renew", i: "reply", k: "renew" }, { l: "Amend", i: "layers", k: "amend" }, { l: "Terminate", i: "x", k: "terminate" }, { l: "New obligation", i: "plus", k: "obligation-new" }, { l: "Extraction review", i: "sparkles", k: "extraction" }]),
        sec("Signing pages (public)", [{ l: "1 Verify identity", i: "lock", k: "sign-verify" }, { l: "2 Review and sign", i: "pen", k: "sign-document" }, { l: "3 Done", i: "check", k: "sign-done" }, { l: "Audit certificate", i: "shield", k: "certificate" }, { l: "Link states", i: "flag", k: "sign-invalid" }]),
        sec("Library", [{ l: "Templates & clauses", i: "book", k: "templates" }, { l: "Template editor", i: "edit", k: "template" }, { l: "Clause", i: "pin", k: "clause" }, { l: "Contract type", i: "tag", k: "type" }, { l: "Approval rule", i: "shield", k: "rule" }]),
      ], "plus") },
    /* @impl Client portal admin — ModuleKey CUSTOMER_PORTAL · docs/features/07 · this is the AGENCY-side admin of the portal
       (VIEW/MANAGE portal.settings.manage, portal.users.manage). The client-facing portal itself is a separate shell with the customer-portal roles. */
    { id: "portal", label: "Client portal", icon: "globe", newLabel: "Invite portal user", newRoute: "invite",
      alias: { client: "clients", user: "users", approval: "approvals", "cp-project": "cp-projects", "cp-request-new": "cp-requests" },
      panel: P("Client portal", [
        items([{ l: "Overview", i: "chart", k: "dashboard" }, { l: "Clients", i: "building", k: "clients" }, { l: "Enable for a client", i: "plus", k: "enable" }, { l: "Portal users", i: "users", k: "users" }, { l: "Invitations", i: "mail", k: "invitations", c: 3 }, { l: "Invite portal user", i: "send", k: "invite" }]),
        sec("Work from customers", [{ l: "Requests", i: "support", k: "requests", c: 2 }, { l: "Approvals", i: "check", k: "approvals", c: 4 }, { l: "Profile changes", i: "edit", k: "profile", c: 3 }, { l: "Client page", i: "file", k: "client" }, { l: "Portal user page", i: "people", k: "user" }, { l: "Review history", i: "clock", k: "approval" }]),
        sec("Setup", [{ l: "Roles & access", i: "key", k: "access" }, { l: "Branding & domain", i: "sparkles", k: "branding" }, { l: "Settings", i: "settings", k: "settings" }, { l: "Activity", i: "list", k: "activity" }]),
        sec("Preview as customer", [{ l: "Dashboard", i: "home", k: "cp-dashboard" }, { l: "Projects", i: "folder", k: "cp-projects" }, { l: "Project page", i: "file", k: "cp-project" }, { l: "Approvals", i: "check", k: "cp-approvals" }, { l: "Requests", i: "support", k: "cp-requests" }, { l: "New request", i: "plus", k: "cp-request-new" }, { l: "Proposals & contracts", i: "pen", k: "cp-agreements" }, { l: "Billing", i: "dollar", k: "cp-billing" }, { l: "Documents", i: "box", k: "cp-documents" }, { l: "Messages", i: "chat", k: "cp-messages" }, { l: "Company & team", i: "users", k: "cp-team" }]),
      ], "plus") },

    /* ---- communication (three separate products) ---- */
    /* @impl Messages — ModuleKey MESSAGING · docs/features/12 · VIEW messaging.channels.read · POST messaging.messages.post · CREATE messaging.channels.create
       @data Channel, ChannelMember, Message, MessageReaction, MessageThreadFollower, ChannelReadState, MessagingPresence.
       @note "Client channels" are Channels with external participants (customer portal users, 01 §79). Unread counts come from ChannelReadState. */
    { id: "messages", label: "Messages", icon: "chat", newLabel: "New channel", newRoute: "create", sep: 1, fill: 1,
      panel: P("Logiqdev", [
        items([{ l: "Home", i: "home", k: "home" }, { l: "Threads", i: "chat", k: "threads" }, { l: "Mentions & reactions", i: "at", c: 3, k: "mentions" }, { l: "Drafts & sent", i: "send", k: "drafts" }, { l: "Saved", i: "star", k: "saved" }, { l: "Search", i: "search", k: "search" }, { l: "Huddles & calls", i: "video", k: "calls" }]),
        sec("Channels", [
          { l: "announcements", pre: "#", k: "c-announce" }, { l: "dev", pre: "#", bold: 1, c: 6, k: "c-dev" }, { l: "acme-rebrand", pre: "#", k: "c-acme" },
          { l: "Browse channels", i: "list", k: "directory" }, { l: "Create channel", i: "plus", k: "create" },
        ], "plus"),
        sec("Client channels", [{ l: "acme-corp", pre: "#", tag: "Shared", bold: 1, c: 1, k: "c-client" }]),
        sec("Direct messages", [
          { l: "Marco Silva", av: ["MS", "g", "on"], bold: 1, c: 2, k: "dm" }, { l: "Jonas, Kim, Sofia", av: ["3", "n"], k: "gdm" },
        ], "plus"),
        sec("Manage", [{ l: "My preferences", i: "bell", k: "prefs" }, { l: "Channel settings", i: "settings", k: "chset" }, { l: "Templates", i: "layers", k: "templates" }, { l: "Message actions", i: "zap", k: "actions" }, { l: "Thread page", i: "chat", k: "thread" }]),
        sec("Admin", [{ l: "Overview", i: "chart", k: "admin" }, { l: "Moderation", i: "shield", k: "moderation", c: 3 }, { l: "Guests & external", i: "globe", k: "guests" }, { l: "Retention & export", i: "clock", k: "retention" }, { l: "Settings", i: "settings", k: "settings" }, { l: "Integrations", i: "plug", k: "integrations" }]),
      ], "edit") },
    /* @impl Support — ModuleKey SUPPORT · docs/features/13 · VIEW support.conversations.read (+ support.tickets.read for Tickets) · REPLY support.conversations.reply
       @data SupportConversation, SupportMessage, Ticket, TicketStatus, SlaPolicy, SupportInbox, SupportChannel, SupportCannedResponse, KnowledgeArticle.
       @note "Unassigned" red counter = conversations with no assignee in the caller's inboxes (SupportInbox membership/scope). */
    { id: "support", label: "Support", icon: "support", newLabel: "New ticket", newRoute: "ticket-create",
      alias: { conversation: "inbox", ticket: "tickets", article: "knowledge", "sla-edit": "sla", "channel-create": "channels", widget: "channels" },
      panel: P("Support", [
        items([{ l: "Inbox", i: "inbox", k: "inbox", c: 12 }, { l: "Conversation page", i: "chat", k: "conversation" }, { l: "Tickets", i: "tag", k: "tickets", c: 47 }, { l: "Ticket page", i: "file", k: "ticket" }, { l: "New ticket", i: "plus", k: "ticket-create" }]),
        sec("Views", [{ l: "Waiting on customer", i: "clock" }, { l: "Snoozed", i: "snooze" }, { l: "SLA at risk", i: "flag", c: 3, alert: 1 }, { l: "VIP clients", i: "star" }], "plus"),
        sec("Help center", [{ l: "Articles", i: "book", k: "knowledge" }, { l: "Article editor", i: "edit", k: "article" }, { l: "Categories", i: "folder", k: "kb-categories" }]),
        sec("Operations", [{ l: "Incidents", i: "zap", k: "incidents", c: 2 }, { l: "SLA policies", i: "clock", k: "sla" }, { l: "SLA editor", i: "edit", k: "sla-edit" }, { l: "Macros", i: "send", k: "macros" }, { l: "Automation", i: "plug", k: "automation" }, { l: "AI support", i: "sparkles", k: "ai", c: 9 }]),
        sec("Reports", [{ l: "Analytics", i: "chart", k: "analytics" }, { l: "Satisfaction (CSAT)", i: "star", k: "csat" }]),
        sec("Setup", [{ l: "Inboxes & channels", i: "inbox", k: "channels" }, { l: "Connect channel", i: "plus", k: "channel-create" }, { l: "Chat widget", i: "chat", k: "widget" }, { l: "Ticket setup", i: "tag", k: "setup" }, { l: "Settings", i: "settings", k: "settings" }]),
      ], "settings") },
    /* @impl Campaigns (email + SMS) — ModuleKey COMMUNICATION · docs/features/11 · VIEW communications.campaigns.read · SEND communications.campaigns.send (sensitive)
       @data Campaign, CommMessage, CommRecipientList, Segment, CommTemplate, CommSenderDomain, CommSenderIdentity, CommSuppression, CommConsent, CommDailyStat.
       @note Separate from Messages on purpose: outbound marketing vs team chat. Consent/suppression must be enforced server-side on every send. */
    { id: "campaigns", label: "Campaigns", icon: "mail", newLabel: "New campaign", newRoute: "create",
      alias: { "segment-new": "segment-new" },
      panel: P("Campaigns", [
        items([{ l: "Overview", i: "home", k: "overview" }, { l: "All campaigns", i: "layers", k: "list" }, { l: "New campaign", i: "plus", k: "create" }, { l: "Campaign page", i: "file", k: "detail" }, { l: "Analytics", i: "chart", k: "analytics" }]),
        sec("Audience", [{ l: "Segments", i: "filter", k: "segments" }, { l: "Segment page", i: "file", k: "segment" }, { l: "New segment", i: "plus", k: "segment-new" }, { l: "Recipient lists", i: "list", k: "lists" }, { l: "Consent", i: "check", k: "consent" }, { l: "Suppressions", i: "x", k: "suppressions" }]),
        sec("Content", [{ l: "Templates", i: "file", k: "templates" }, { l: "Template editor", i: "pen", k: "template" }, { l: "Automations", i: "zap", k: "automations" }]),
        sec("Messages", [{ l: "Message log", i: "mail", k: "messages" }, { l: "Message page", i: "file", k: "message" }, { l: "Threads", i: "chat", k: "threads" }]),
        sec("Setup", [{ l: "Senders & domains", i: "globe", k: "senders" }, { l: "Settings", i: "settings", k: "settings" }]),
      ], "settings") },

    /* ---- money ---- */
    /* @impl Billing — ModuleKey FINANCE · docs/features/08 · VIEW finance.invoices.read · CREATE finance.invoices.create · APPROVE finance.invoices.approve (sensitive, separation of duties 01 §96) */
    { id: "billing", label: "Billing", icon: "dollar", newLabel: "New invoice", newRoute: "create", sep: 1,
      alias: { },
      panel: P("Billing", [
        items([{ l: "Dashboard", i: "chart", k: "dashboard" }, { l: "Invoices", i: "receipt", k: "invoices" }, { l: "New invoice", i: "plus", k: "create" }, { l: "Invoice page", i: "file", k: "invoice" }, { l: "Approvals", i: "shield", k: "approvals", c: 3 }, { l: "Credit notes", i: "receipt", k: "credits" }]),
        sec("Collect", [{ l: "Subscriptions", i: "zap", k: "subscriptions" }, { l: "Subscription page", i: "file", k: "subscription" }, { l: "Payments", i: "dollar", k: "payments" }, { l: "Payment page", i: "file", k: "payment" }, { l: "Payment links", i: "link", k: "links" }, { l: "Reminders & dunning", i: "bell", k: "dunning" }]),
        sec("Customers & catalog", [{ l: "Customer billing", i: "building", k: "customers" }, { l: "Billing profile", i: "file", k: "customer" }, { l: "Catalog", i: "box", k: "catalog" }, { l: "Project billing", i: "folder", k: "projectbilling" }]),
        sec("Insights", [{ l: "Reports", i: "chart", k: "reports" }]),
        sec("Setup", [{ l: "Payment providers", i: "plug", k: "providers" }, { l: "Provider page", i: "file", k: "provider" }, { l: "Tax settings", i: "receipt", k: "tax" }, { l: "Numbering & templates", i: "hash", k: "numbering" }]),
      ], "plus") },
    /* @impl Income & expenses — ModuleKey INCOME_EXPENSE · docs/features/09 · VIEW finance.income.read / finance.expenses.read · CREATE finance.expenses.create */
    { id: "expenses", label: "Income & expenses", icon: "receipt", newLabel: "Add expense", newRoute: "create",
      alias: { detail: "ledger", "import-review": "imports", "recurring-new": "recurring", vendor: "vendors", "payroll-new": "payroll" },
      panel: P("Income & expenses", [
        items([{ l: "Overview", i: "home", k: "overview" }, { l: "Ledger", i: "list", k: "ledger" }, { l: "Add expense", i: "plus", k: "create" }, { l: "Record page", i: "file", k: "detail" }, { l: "Approvals", i: "check", k: "approvals", c: 6 }]),
        sec("Intake", [{ l: "Invoice imports", i: "clip", k: "imports", c: 2 }, { l: "Recurring", i: "clock", k: "recurring" }, { l: "New recurring", i: "plus", k: "recurring-new" }, { l: "Vendors", i: "building", k: "vendors" }, { l: "Vendor profile", i: "file", k: "vendor" }]),
        sec("People", [{ l: "Payroll & costs", i: "users", k: "payroll" }, { l: "New payroll entry", i: "plus", k: "payroll-new" }]),
        sec("Analysis", [{ l: "Budgets", i: "flag", k: "budgets" }, { l: "Profitability", i: "chart", k: "profitability" }, { l: "Profit & loss", i: "dollar", k: "pnl" }, { l: "VAT", i: "receipt", k: "vat" }, { l: "Reports", i: "layers", k: "reports" }, { l: "Insights", i: "sparkles", k: "insights", c: 5 }]),
        sec("Setup", [{ l: "Periods", i: "calendar", k: "periods" }, { l: "Categories & methods", i: "tag", k: "categories" }, { l: "Ledger settings", i: "settings", k: "settings" }]),
      ], "plus") },

    /* ---- company ---- */
    /* @impl People — ModuleKey EMPLOYEES · docs/features/10 · VIEW employees.directory.read (HR detail needs employees.employees.read; compensation = employees.compensation.read, field-level) */
    { id: "people", label: "People", icon: "people", newLabel: "Add employee", newRoute: "create", sep: 1,
      alias: { profile: "directory", restricted: "directory", review: "performance" },
      /* @note Sub-pages show only if the caller holds the matching key: Directory/Company directory (employees.directory.read; HR table needs employees.employees.read), Leave (employees.leave.*),
         Attendance (employees.attendance.*), Capacity (employees.capacity.read), Performance (employees.performance.*), Payroll (finance.payroll.read + employees.compensation.read), Settings (employees.leave.manage_policies / settings key @gap). */
      panel: P("People", [
        items([{ l: "Dashboard", i: "chart", k: "dashboard" }, { l: "Employees", i: "users", k: "directory", c: 84 }, { l: "Company directory", i: "book", k: "cards" }, { l: "Add employee", i: "plus", k: "create" }, { l: "Org chart", i: "people", k: "orgchart" }, { l: "Change requests", i: "edit", k: "changes", c: 2 }]),
        sec("Employee profile", [{ l: "Profile (full access)", i: "file", k: "profile" }, { l: "Profile (restricted view)", i: "lock", k: "restricted" }, { l: "Onboarding", i: "check", k: "onboarding", c: 4 }, { l: "Offboarding", i: "x", k: "offboarding" }]),
        sec("Leave", [{ l: "Requests", i: "calendar", k: "leave", c: 3 }, { l: "Request leave", i: "plus", k: "leavenew" }, { l: "Leave calendar", i: "grid", k: "leavecal" }, { l: "Balances", i: "list", k: "balances" }]),
        sec("Time & workload", [{ l: "Attendance", i: "clock", k: "attendance" }, { l: "Capacity", i: "layers", k: "capacity" }, { l: "Payroll entries", i: "dollar", k: "payroll" }]),
        sec("Growth", [{ l: "Skills", i: "tag", k: "skills" }, { l: "Performance", i: "star", k: "performance" }, { l: "Review page", i: "file", k: "review" }, { l: "Goals & feedback", i: "flag", k: "goals" }]),
        items([{ l: "Settings", i: "settings", k: "settings" }]),
      ], "edit") },
    /* @impl Docs (wiki, forms) — ModuleKey BUSINESS_DOCS · docs/features/15 · VIEW docs.pages.read · CREATE docs.pages.create */
    /* @data WikiSpace, WikiPage (+ versions, comments, permissions, links, acknowledgements), WikiPageTemplate, WikiChecklist/Run, CustomForm/FormAssignment/FormSubmission, WikiAiIndexEntry/WikiAiSuggestion.
       @note "Favorites" = WikiPageFavorite of the signed-in member. Spaces = WikiSpace rows. The page of one document is /docs/p/:slug (alias of "Page" here). Create-space needs docs.spaces.manage; forms need docs.forms.read. */
    { id: "docs", label: "Docs", icon: "book", newLabel: "New page", newRoute: "pageNew",
      alias: { },
      panel: P("Docs", [
        items([{ l: "Home", i: "home", k: "home" }, { l: "Search", i: "search", k: "search" }, { l: "Spaces", i: "layers", k: "spaces" }, { l: "New page", i: "plus", k: "pageNew" }, { l: "Templates", i: "file", k: "templates" }, { l: "Ask AI", i: "sparkles", k: "ai", c: 4 }]),
        sec("Favorites", [{ l: "Production deploy runbook", i: "star", k: "page" }, { l: "Security baseline", i: "star" }, { l: "Expense policy", i: "star" }]),
        sec("Spaces", [{ l: "Engineering", i: "layers", k: "space" }, { l: "Operations", i: "settings" }, { l: "People and HR", i: "people" }, { l: "Sales playbook", i: "dollar" }, { l: "Company handbook", i: "book" }], "plus"),
        sec("Knowledge", [{ l: "Runbooks", i: "zap", k: "runbooks" }, { l: "Onboarding docs", i: "users", k: "onboarding" }, { l: "Checklists", i: "check", k: "checklists" }, { l: "Checklist runs", i: "list", k: "runs", c: 6 }, { l: "Reviews", i: "flag", k: "reviews", c: 9 }, { l: "Forms", i: "receipt", k: "forms" }]),
        sec("Page tools", [{ l: "Space settings", i: "settings", k: "spaceSettings" }, { l: "Version history", i: "time", k: "history" }, { l: "Sharing", i: "send", k: "share" }, { l: "Edit template", i: "edit", k: "templateEdit" }, { l: "New space", i: "plus", k: "spaceNew" }, { l: "New checklist", i: "plus", k: "checklistEdit" }, { l: "Run detail", i: "list", k: "runDetail" }, { l: "Form builder", i: "edit", k: "formBuilder" }, { l: "Form responses", i: "inbox", k: "formResponses" }]),
        items([{ l: "Analytics", i: "chart", k: "analytics" }, { l: "Import and export", i: "inbox", k: "importExport" }, { l: "Archive and trash", i: "archive", k: "trash" }]),
      ], "plus") },
    /* @impl Files — ModuleKey DOCUMENTS · docs/features/17 · VIEW documents.documents.read · CREATE documents.documents.create */
    { id: "files", label: "Files", icon: "box", newLabel: "Upload", newRoute: "upload",
      alias: { doc: "browse", upload: "browse", sharenew: "shares", vaultentry: "vault", vaultnew: "vault" },
      panel: P("Files", [
        items([{ l: "Browse", i: "box", k: "browse" }, { l: "Recent and favorites", i: "clock", k: "recent" }, { l: "Shared", i: "link", k: "shares" }, { l: "Search", i: "search", k: "search" }, { l: "Upload", i: "plus", k: "upload" }, { l: "Document page", i: "file", k: "doc" }]),
        sec("Folders", [{ l: "New folder", i: "folder", k: "foldernew" }, { l: "Folder templates", i: "layers", k: "tpl" }, { l: "Document templates", i: "file", k: "templates" }]),
        sec("Workflow", [{ l: "Approvals", i: "check", k: "approvals", c: 2 }, { l: "Signatures", i: "pen", k: "signatures", c: 6 }]),
        sec("Vault", [{ l: "Credentials", i: "key", k: "vault" }, { l: "New credential", i: "plus", k: "vaultnew" }, { l: "Entry page", i: "lock", k: "vaultentry" }]),
        sec("Lifecycle", [{ l: "Retention and holds", i: "shield", k: "retention" }, { l: "Trash", i: "x", k: "trash" }, { l: "Storage", i: "chart", k: "storage" }]),
        items([{ l: "Setup", i: "settings", k: "settings" }]),
      ]) },
    /* @impl Notifications & Activity Center — ModuleKey NOTIFICATIONS · docs/features/14 · own inbox for every member · preferences notifications.preferences.manage_own · admin notifications.defaults.manage / templates.manage / delivery_rules.manage / audit.read (sensitive)
       @data Notification, NotificationEvent, NotificationEventType, NotificationDelivery, NotificationTemplate, NotificationOrgSettings, NotificationOrgDefault, NotificationRecipientSettings, NotificationPreference, NotificationKeyword, NotificationDigest, NotificationPushDevice, NotificationDeliveryRule; activity feed reads AuditEvent.
       @note Admin items show only with the matching key. The bell popover is a component screen (k: bell), it lives in the top bar everywhere. */
    { id: "notifications", label: "Notifications", icon: "bell", newLabel: "Preferences", newRoute: "prefs",
      alias: { notification: "detail" },
      panel: P("Notifications", [
        items([{ l: "Inbox", i: "inbox", k: "inbox", c: 6 }, { l: "Waiting on you", i: "check", k: "approvals", c: 2 }, { l: "Notification page", i: "file", k: "detail" }, { l: "Bell popover", i: "bell", k: "bell" }]),
        sec("Activity", [{ l: "Organization", i: "globe", k: "activity" }, { l: "Project", i: "folder", k: "activity-project" }, { l: "Customer", i: "building", k: "activity-customer" }]),
        sec("My settings", [{ l: "Preferences", i: "settings", k: "prefs" }, { l: "Quiet hours & digests", i: "clock", k: "schedule" }, { l: "Keyword alerts", i: "hash", k: "keywords" }, { l: "Following & muted", i: "star", k: "follows" }, { l: "Devices", i: "phone", k: "devices" }]),
        sec("Administration", [{ l: "Event catalog", i: "list", k: "catalog" }, { l: "Templates", i: "mail", k: "templates" }, { l: "Organization defaults", i: "layers", k: "defaults" }, { l: "Delivery rules", i: "filter", k: "rules" }, { l: "Delivery log", i: "receipt", k: "log" }, { l: "Announcements", i: "sparkles", k: "announcements" }, { l: "Settings", i: "settings", k: "settings" }]),
      ], "plus") },
    /* @impl Automation — ModuleKey AUTOMATION · docs/features/20 · MANAGE automation.rules.manage (sensitive). Rules run as a service account or membership with the same checks. */
    { id: "automation", label: "Automation", icon: "zap", newLabel: "New workflow", newRoute: "create",
      panel: P("Automation", [
        items([{ l: "Overview", i: "home", k: "overview" }, { l: "Workflows", i: "zap", k: "workflows" }, { l: "New workflow", i: "plus", k: "create" }, { l: "Builder", i: "layers", k: "builder" }, { l: "Workflow page", i: "file", k: "workflow" }, { l: "Templates", i: "grid", k: "templates" }]),
        sec("Executions", [{ l: "Runs", i: "list", k: "runs" }, { l: "Run page", i: "file", k: "run" }, { l: "Approvals", i: "check", k: "approvals", c: 3 }, { l: "Dead letter", i: "flag", k: "deadletter", c: 2 }, { l: "Event log", i: "inbox", k: "events" }]),
        sec("Schedules", [{ l: "Scheduled jobs", i: "clock", k: "jobs" }, { l: "New job", i: "plus", k: "jobNew" }, { l: "Job page", i: "file", k: "job" }]),
        sec("Catalog", [{ l: "Triggers", i: "zap", k: "triggers" }, { l: "Actions", i: "plug", k: "actions" }]),
        sec("Integrations", [{ l: "Webhooks", i: "globe", k: "webhooks" }, { l: "New endpoint", i: "plus", k: "webhookNew" }, { l: "AI agents and MCP", i: "sparkles", k: "agents" }]),
        items([{ l: "Usage and limits", i: "chart", k: "usage" }, { l: "Settings", i: "settings", k: "settings" }]),
      ]) },

    /* ---- Admin (module 01: users, organizations, branches, permissions) — opened from the gear at the bottom of the rail ----
       @impl Admin — ModuleKey ADMINISTRATION · docs/features/01 · routes /admin/<k>. Every sub-page has its own VIEW permission (listed per screen in
         modules/01-admin/views.js); show a sidebar item only if the caller holds it, so a Branch Admin sees Members/Teams/Branches but not SSO or API keys.
       @note `alias` keeps the parent item highlighted on detail routes (/admin/members/:id -> Members). In production use nested routes instead. */
    { id: "admin", label: "Admin", icon: "shield", newLabel: "Invite member", newRoute: "invitenew", hidden: 1,
      alias: { member: "members", "member-access": "members", portaluser: "portalusers", portalinvite: "portalusers", role: "roles", rolenew: "roles", team: "teams", teamnew: "teams", branchnew: "branches", invitenew: "invitations", service: "apikeys", servicenew: "apikeys", apikey: "apikeys", apikeynew: "apikeys", webhook: "webhooks", webhooknew: "webhooks", auditevent: "audit", "audit-classic": "audit", domainnew: "domains", reviewnew: "reviews", review: "reviews", delegationnew: "delegations", integration: "integrations", integrationnew: "integrations" },
      panel: P("Admin", [
        items([{ l: "Overview", i: "home", k: "overview" }]),
        sec("People & structure", [{ l: "Members", i: "users", k: "members", c: 24 }, { l: "Invitations", i: "mail", k: "invitations", c: 3 }, { l: "Teams", i: "people", k: "teams" }, { l: "Branches", i: "building", k: "branches" }, { l: "Customer portal users", i: "globe", k: "portalusers", c: 18 }]),
        sec("Access control", [{ l: "Roles", i: "shield", k: "roles" }, { l: "Permission catalog", i: "list", k: "catalog" }, { l: "Permission matrix", i: "grid", k: "matrix" }, { l: "Module access", i: "layers", k: "modules" }, { l: "Delegations", i: "reply", k: "delegations" }, { l: "Access simulation", i: "zap", k: "simulate" }, { l: "Access reviews", i: "check", k: "reviews", c: 2 }]),
        sec("Security", [{ l: "Sign-in & MFA", i: "lock", k: "security" }, { l: "SSO & identity provider", i: "globe", k: "sso" }, { l: "Domains", i: "globe", k: "domains" }, { l: "Sessions", i: "clock", k: "sessions" }]),
        sec("Developers", [{ l: "Integrations", i: "plug", k: "integrations", c: 6 }, { l: "API keys", i: "link", k: "apikeys" }, { l: "Webhooks", i: "zap", k: "webhooks" }]),
        sec("Organization", [{ l: "Profile", i: "building", k: "profile" }, { l: "Branding", i: "pen", k: "branding" }, { l: "Data retention", i: "archive", k: "retention" }, { l: "Billing & plan", i: "dollar", k: "billing" }, { l: "Notification preferences", i: "bell", k: "notifprefs" }, { l: "Audit log", i: "file", k: "audit" }, { l: "Lifecycle", i: "settings", k: "lifecycle" }]),
      ]) },
  ];

  window.APPS = APPS;
  window.appById = (id) => APPS.find((a) => a.id === id);
})();
