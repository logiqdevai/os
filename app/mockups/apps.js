/* App registry. Every rail entry is a standalone product area with its own panel (and its own main layout in views.js).
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
    { id: "home", label: "Home", icon: "home", newLabel: "New", panel: simple("Home", ["Overview", "My work", "Inbox", "Recent", "Favorites"]) },

    /* ---- work ---- */
    /* @impl Projects — ModuleKey PROJECTS · docs/features/05 · VIEW projects.projects.read · CREATE projects.projects.create
       @data Project, ProjectStatus, ProjectMember, ProjectBranch (cross-branch), Milestone/Gate models of 05.
       @note "By client" groups by Project.customer (CRM Company); "Favorites" = per-member pinned projects (SavedView or favorites table of 05, confirm). */
    { id: "projects", label: "Projects", icon: "folder", newLabel: "New project", sep: 1,
      panel: P("Projects", [
        items([{ l: "Overview", i: "home", active: 1 }, { l: "Portfolio", i: "layers" }, { l: "Timeline", i: "calendar" }, { l: "Milestones", i: "flag" }, { l: "Workload", i: "users" }, { l: "Budgets", i: "dollar" }]),
        sec("Favorites", [{ l: "Acme Rebrand Website", dot: "blue" }, { l: "Mobile App v2", dot: "yellow" }, { l: "Customer Portal Build", dot: "red" }]),
        sec("By client", [{ l: "Acme Corp", i: "building" }, { l: "Northwind", i: "building" }, { l: "Globex", i: "building" }, { l: "Initech", i: "building" }]),
        items([{ l: "Archive", i: "archive" }]),
      ], "plus") },
    /* @impl Tasks — ModuleKey TASKS · docs/features/06 · VIEW tasks.tasks.read · CREATE tasks.tasks.create
       @data Task, TaskStatus, TaskLabel, Cycle (sprints), Release, TaskAssignee, TaskWatcher.
       @note "Teams" in this panel are Team rows of module 01 (kind TEAM/DEPARTMENT), "Views" are SavedView rows (module 02 platform table).
             Linear-style: the panel is the filter; keep URLs shareable (`/tasks?team=web&view=active`). */
    { id: "tasks", label: "Tasks", icon: "tasks", newLabel: "New task",
      panel: P("Tasks", [
        items([{ l: "Inbox", i: "inbox", c: 4 }, { l: "My tasks", i: "tasks", active: 1 }]),
        sec("Teams", [
          { l: "Web", dot: "blue", open: 1, children: ["Active", "Backlog", "Sprints", "Board"] },
          { l: "Mobile", dot: "green", children: ["Active", "Backlog", "Sprints", "Board"] },
          { l: "Design", dot: "yellow", children: ["Active", "Backlog", "Board"] },
        ]),
        sec("Views", [{ l: "Overdue", i: "filter" }, { l: "Unassigned", i: "filter" }, { l: "Client requests", i: "filter" }, { l: "Blocked", i: "filter" }], "plus"),
      ], "edit") },
    /* @impl Time — ModuleKey TIME_TRACKING · docs/features/18 · VIEW time.entries.read_own (read_team / read_all widen the scope) · CREATE time.entries.create_own */
    { id: "time", label: "Time", icon: "clock", newLabel: "Start timer", panel: simple("Time tracking", ["Timer", "My timesheet", "Team timesheets", "Approvals", "Reports"]) },
    /* @impl Calendar — ModuleKey CALENDAR · docs/features/19 · VIEW calendar.events.read · CREATE calendar.events.manage */
    { id: "calendar", label: "Calendar", icon: "calendar", newLabel: "New event", panel: simple("Calendar", ["My calendar", "Team", "Bookings", "Availability", "Integrations"]) },

    /* ---- sales ---- */
    /* @impl CRM — ModuleKey CRM · docs/features/02 · VIEW crm.deals.read (companies/contacts/leads have their own read keys) · CREATE crm.deals.create
       @data CrmDeal, CrmLead, CrmCompany, CrmContact, CrmPipeline, CrmActivity. Sub-pages show only if the matching *.read key is held. */
    { id: "crm", label: "CRM", icon: "crm", newLabel: "New deal", sep: 1, panel: simple("CRM", ["Deals", "Leads", "Companies", "Contacts", "Pipelines", "Forecast", "Activities"]) },
    /* @impl Proposals — ModuleKey PROPOSALS · docs/features/03 · VIEW proposals.proposals.read · CREATE proposals.proposals.create */
    { id: "proposals", label: "Proposals", icon: "file", newLabel: "New proposal", panel: simple("Proposals", ["All proposals", "Drafts", "Sent", "Accepted", "Templates", "Pricing library"]) },
    /* @impl Contracts — ModuleKey CONTRACTS · docs/features/04 · VIEW contracts.contracts.read · CREATE contracts.contracts.create
       @note contracts.confidential_terms.read is FIELD-LEVEL: hide those fields, do not just grey them out. */
    { id: "contracts", label: "Contracts", icon: "pen", newLabel: "New contract", panel: simple("Contracts", ["All contracts", "Awaiting signature", "Active", "Renewals", "Amendments", "Templates"]) },
    /* @impl Client portal admin — ModuleKey CUSTOMER_PORTAL · docs/features/07 · this is the AGENCY-side admin of the portal
       (VIEW/MANAGE portal.settings.manage, portal.users.manage). The client-facing portal itself is a separate shell with the customer-portal roles. */
    { id: "portal", label: "Client portal", icon: "globe", newLabel: "Invite client", panel: simple("Client portal", ["Clients", "Requests", "Approvals", "Branding", "Access"]) },

    /* ---- communication (three separate products) ---- */
    /* @impl Messages — ModuleKey MESSAGING · docs/features/12 · VIEW messaging.channels.read · POST messaging.messages.post · CREATE messaging.channels.create
       @data Channel, ChannelMember, Message, MessageReaction, MessageThreadFollower, ChannelReadState, MessagingPresence.
       @note "Client channels" are Channels with external participants (customer portal users, 01 §79). Unread counts come from ChannelReadState. */
    { id: "messages", label: "Messages", icon: "chat", newLabel: "New message", sep: 1,
      panel: P("Logiqdev", [
        items([{ l: "Threads", i: "chat" }, { l: "Mentions & reactions", i: "at", c: 3 }, { l: "Drafts & sent", i: "send" }, { l: "Saved", i: "star" }]),
        sec("Channels", [
          { l: "general", pre: "#" }, { l: "announcements", pre: "#" }, { l: "dev", pre: "#", bold: 1, c: 6 },
          { l: "design", pre: "#" }, { l: "acme-rebrand", pre: "#", active: 1 }, { l: "sales", pre: "#" },
        ], "plus"),
        sec("Client channels", [{ l: "acme-corp", pre: "#", tag: "Shared" }, { l: "globex-portal", pre: "#", tag: "Shared", bold: 1, c: 1 }, { l: "northwind", pre: "#", tag: "Shared" }]),
        sec("Direct messages", [
          { l: "Anna Meyer", av: ["AM", "", "on"] }, { l: "Marco Silva", av: ["MS", "g", "on"], bold: 1, c: 2 }, { l: "Sofia Jensen", av: ["SJ", "y", "off"] },
          { l: "Jon, Kim, Sofia", av: ["3", "n"] },
        ], "plus"),
      ], "edit") },
    /* @impl Support — ModuleKey SUPPORT · docs/features/13 · VIEW support.conversations.read (+ support.tickets.read for Tickets) · REPLY support.conversations.reply
       @data SupportConversation, SupportMessage, Ticket, TicketStatus, SlaPolicy, SupportInbox, SupportChannel, SupportCannedResponse, KnowledgeArticle.
       @note "Unassigned" red counter = conversations with no assignee in the caller's inboxes (SupportInbox membership/scope). */
    { id: "support", label: "Support", icon: "support", newLabel: "New conversation",
      panel: P("Support", [
        items([{ l: "Your inbox", i: "inbox", c: 12, active: 1 }, { l: "Mentions", i: "at", c: 2 }, { l: "Unassigned", i: "users", c: 4, alert: 1 }, { l: "All conversations", i: "layers" }]),
        sec("Views", [{ l: "Waiting on customer", i: "clock" }, { l: "Snoozed", i: "snooze" }, { l: "VIP clients", i: "star" }, { l: "Closed today", i: "check" }], "plus"),
        sec("Channels", [{ l: "Live chat", i: "chat" }, { l: "Email", i: "mail" }, { l: "Client portal", i: "globe" }]),
        sec("Manage", [{ l: "Tickets", i: "tag" }, { l: "Help center", i: "book" }, { l: "Macros & SLAs", i: "zap" }, { l: "Reports", i: "chart" }]),
      ], "settings") },
    /* @impl Campaigns (email + SMS) — ModuleKey COMMUNICATION · docs/features/11 · VIEW communications.campaigns.read · SEND communications.campaigns.send (sensitive)
       @data Campaign, CommMessage, CommRecipientList, Segment, CommTemplate, CommSenderDomain, CommSenderIdentity, CommSuppression, CommConsent, CommDailyStat.
       @note Separate from Messages on purpose: outbound marketing vs team chat. Consent/suppression must be enforced server-side on every send. */
    { id: "campaigns", label: "Campaigns", icon: "mail", newLabel: "New campaign",
      panel: P("Campaigns", [
        items([{ l: "All campaigns", i: "layers", active: 1 }, { l: "Email", i: "mail" }, { l: "SMS", i: "sms" }, { l: "Scheduled", i: "calendar", c: 3 }, { l: "Drafts", i: "edit", c: 2 }]),
        sec("Audience", [{ l: "Segments", i: "filter" }, { l: "Lists", i: "list" }, { l: "Contacts", i: "users" }, { l: "Unsubscribes", i: "x" }]),
        sec("Content", [{ l: "Templates", i: "file" }, { l: "Assets", i: "box" }]),
        sec("Insights", [{ l: "Analytics", i: "chart" }, { l: "Deliverability", i: "shield" }]),
        sec("Setup", [{ l: "Sender domains", i: "globe" }, { l: "Phone numbers", i: "phone" }]),
      ], "settings") },

    /* ---- money ---- */
    /* @impl Billing — ModuleKey FINANCE · docs/features/08 · VIEW finance.invoices.read · CREATE finance.invoices.create · APPROVE finance.invoices.approve (sensitive, separation of duties 01 §96) */
    { id: "billing", label: "Billing", icon: "dollar", newLabel: "New invoice", sep: 1, panel: simple("Billing", ["Invoices", "Subscriptions", "Payments", "Customers", "Stripe", "Tax / VAT"]) },
    /* @impl Income & expenses — ModuleKey INCOME_EXPENSE · docs/features/09 · VIEW finance.income.read / finance.expenses.read · CREATE finance.expenses.create */
    { id: "expenses", label: "Expenses", icon: "receipt", newLabel: "Add expense", panel: simple("Income & expenses", ["Income", "Expenses", "Budgets", "Profitability", "Categories"]) },

    /* ---- company ---- */
    /* @impl People — ModuleKey EMPLOYEES · docs/features/10 · VIEW employees.directory.read (HR detail needs employees.employees.read; compensation = employees.compensation.read, field-level) */
    { id: "people", label: "People", icon: "people", newLabel: "Add employee", sep: 1, panel: simple("People", ["Directory", "Leave", "Attendance", "Skills", "Performance", "Org chart"]) },
    /* @impl Docs (wiki, forms) — ModuleKey BUSINESS_DOCS · docs/features/15 · VIEW docs.pages.read · CREATE docs.pages.create */
    { id: "docs", label: "Docs", icon: "book", newLabel: "New page", panel: simple("Docs", ["Pages", "Wikis", "Templates", "Shared with me", "Trash"]) },
    /* @impl Files — ModuleKey DOCUMENTS · docs/features/17 · VIEW documents.documents.read · CREATE documents.documents.create */
    { id: "files", label: "Files", icon: "box", newLabel: "Upload", panel: simple("Files", ["All files", "Shared", "Signatures", "Recent", "Trash"]) },
    /* @impl Automation — ModuleKey AUTOMATION · docs/features/20 · MANAGE automation.rules.manage (sensitive). Rules run as a service account or membership with the same checks. */
    { id: "automation", label: "Automation", icon: "zap", newLabel: "New workflow", panel: simple("Automation", ["Workflows", "Triggers", "Runs", "AI agents", "Templates"]) },

    /* ---- Admin (module 01: users, organizations, branches, permissions) — opened from the gear at the bottom of the rail ----
       @impl Admin — ModuleKey ADMINISTRATION · docs/features/01 · routes /admin/<k>. Every sub-page has its own VIEW permission (listed per screen in
         views-admin.js); show a sidebar item only if the caller holds it, so a Branch Admin sees Members/Teams/Branches but not SSO or API keys.
       @note `alias` keeps the parent item highlighted on detail routes (/admin/members/:id -> Members). In production use nested routes instead. */
    { id: "admin", label: "Admin", icon: "shield", newLabel: "Invite member", hidden: 1,
      alias: { member: "members", role: "roles", service: "apikeys", domains: "sso", integration: "integrations" },
      panel: P("Admin", [
        items([{ l: "Overview", i: "home", k: "overview" }]),
        sec("People & structure", [{ l: "Members", i: "users", k: "members", c: 24 }, { l: "Invitations", i: "mail", k: "invitations", c: 3 }, { l: "Teams", i: "people", k: "teams" }, { l: "Branches", i: "building", k: "branches" }]),
        sec("Access control", [{ l: "Roles", i: "shield", k: "roles" }, { l: "Permission catalog", i: "list", k: "catalog" }, { l: "Permission matrix", i: "grid", k: "matrix" }, { l: "Module access", i: "layers", k: "modules" }, { l: "Delegations", i: "reply", k: "delegations" }, { l: "Access simulation", i: "zap", k: "simulate" }, { l: "Access reviews", i: "check", k: "reviews", c: 2 }]),
        sec("Security", [{ l: "Sign-in & MFA", i: "lock", k: "security" }, { l: "SSO & domains", i: "globe", k: "sso" }, { l: "Sessions", i: "clock", k: "sessions" }]),
        sec("Developers", [{ l: "Integrations", i: "plug", k: "integrations", c: 6 }, { l: "API keys", i: "link", k: "apikeys" }]),
        sec("Organization", [{ l: "Profile & branding", i: "building", k: "profile" }, { l: "Audit log", i: "file", k: "audit" }]),
      ]) },
  ];

  window.APPS = APPS;
  window.appById = (id) => APPS.find((a) => a.id === id);
})();
