/* App registry. Every rail entry is a standalone product area with its own panel (and its own main layout in views.js).
   Panel item keys: l label · i icon · c count · alert · dot (color) · pre ('#' etc.) · av [initials,cls,pres] · bold (unread) · tag · active · children[] */
(function () {
  const P = (title, blocks, action) => ({ title, blocks, action });
  const items = (arr) => ({ items: arr });
  const sec = (label, arr, action) => ({ label, items: arr, action });
  const simple = (title, subs, action) => P(title, [items(subs.map((s, i) => ({ l: s, active: i === 0 })))], action);

  const APPS = [
    { id: "home", label: "Home", icon: "home", newLabel: "New", panel: simple("Home", ["Overview", "My work", "Inbox", "Recent", "Favorites"]) },

    /* ---- work ---- */
    { id: "projects", label: "Projects", icon: "folder", newLabel: "New project", sep: 1,
      panel: P("Projects", [
        items([{ l: "Overview", i: "home", active: 1 }, { l: "Portfolio", i: "layers" }, { l: "Timeline", i: "calendar" }, { l: "Milestones", i: "flag" }, { l: "Workload", i: "users" }, { l: "Budgets", i: "dollar" }]),
        sec("Favorites", [{ l: "Acme Rebrand Website", dot: "blue" }, { l: "Mobile App v2", dot: "yellow" }, { l: "Customer Portal Build", dot: "red" }]),
        sec("By client", [{ l: "Acme Corp", i: "building" }, { l: "Northwind", i: "building" }, { l: "Globex", i: "building" }, { l: "Initech", i: "building" }]),
        items([{ l: "Archive", i: "archive" }]),
      ], "plus") },
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
    { id: "time", label: "Time", icon: "clock", newLabel: "Start timer", panel: simple("Time tracking", ["Timer", "My timesheet", "Team timesheets", "Approvals", "Reports"]) },
    { id: "calendar", label: "Calendar", icon: "calendar", newLabel: "New event", panel: simple("Calendar", ["My calendar", "Team", "Bookings", "Availability", "Integrations"]) },

    /* ---- sales ---- */
    { id: "crm", label: "CRM", icon: "crm", newLabel: "New deal", sep: 1, panel: simple("CRM", ["Deals", "Leads", "Companies", "Contacts", "Pipelines", "Forecast", "Activities"]) },
    { id: "proposals", label: "Proposals", icon: "file", newLabel: "New proposal", panel: simple("Proposals", ["All proposals", "Drafts", "Sent", "Accepted", "Templates", "Pricing library"]) },
    { id: "contracts", label: "Contracts", icon: "pen", newLabel: "New contract", panel: simple("Contracts", ["All contracts", "Awaiting signature", "Active", "Renewals", "Amendments", "Templates"]) },
    { id: "portal", label: "Client portal", icon: "globe", newLabel: "Invite client", panel: simple("Client portal", ["Clients", "Requests", "Approvals", "Branding", "Access"]) },

    /* ---- communication (three separate products) ---- */
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
    { id: "support", label: "Support", icon: "support", newLabel: "New conversation",
      panel: P("Support", [
        items([{ l: "Your inbox", i: "inbox", c: 12, active: 1 }, { l: "Mentions", i: "at", c: 2 }, { l: "Unassigned", i: "users", c: 4, alert: 1 }, { l: "All conversations", i: "layers" }]),
        sec("Views", [{ l: "Waiting on customer", i: "clock" }, { l: "Snoozed", i: "snooze" }, { l: "VIP clients", i: "star" }, { l: "Closed today", i: "check" }], "plus"),
        sec("Channels", [{ l: "Live chat", i: "chat" }, { l: "Email", i: "mail" }, { l: "Client portal", i: "globe" }]),
        sec("Manage", [{ l: "Tickets", i: "tag" }, { l: "Help center", i: "book" }, { l: "Macros & SLAs", i: "zap" }, { l: "Reports", i: "chart" }]),
      ], "settings") },
    { id: "campaigns", label: "Campaigns", icon: "mail", newLabel: "New campaign",
      panel: P("Campaigns", [
        items([{ l: "All campaigns", i: "layers", active: 1 }, { l: "Email", i: "mail" }, { l: "SMS", i: "sms" }, { l: "Scheduled", i: "calendar", c: 3 }, { l: "Drafts", i: "edit", c: 2 }]),
        sec("Audience", [{ l: "Segments", i: "filter" }, { l: "Lists", i: "list" }, { l: "Contacts", i: "users" }, { l: "Unsubscribes", i: "x" }]),
        sec("Content", [{ l: "Templates", i: "file" }, { l: "Assets", i: "box" }]),
        sec("Insights", [{ l: "Analytics", i: "chart" }, { l: "Deliverability", i: "shield" }]),
        sec("Setup", [{ l: "Sender domains", i: "globe" }, { l: "Phone numbers", i: "phone" }]),
      ], "settings") },

    /* ---- money ---- */
    { id: "billing", label: "Billing", icon: "dollar", newLabel: "New invoice", sep: 1, panel: simple("Billing", ["Invoices", "Subscriptions", "Payments", "Customers", "Stripe", "Tax / VAT"]) },
    { id: "expenses", label: "Expenses", icon: "receipt", newLabel: "Add expense", panel: simple("Income & expenses", ["Income", "Expenses", "Budgets", "Profitability", "Categories"]) },

    /* ---- company ---- */
    { id: "people", label: "People", icon: "people", newLabel: "Add employee", sep: 1, panel: simple("People", ["Directory", "Leave", "Attendance", "Skills", "Performance", "Org chart"]) },
    { id: "docs", label: "Docs", icon: "book", newLabel: "New page", panel: simple("Docs", ["Pages", "Wikis", "Templates", "Shared with me", "Trash"]) },
    { id: "files", label: "Files", icon: "box", newLabel: "Upload", panel: simple("Files", ["All files", "Shared", "Signatures", "Recent", "Trash"]) },
    { id: "automation", label: "Automation", icon: "zap", newLabel: "New workflow", panel: simple("Automation", ["Workflows", "Triggers", "Runs", "AI agents", "Templates"]) },
  ];

  window.APPS = APPS;
  window.appById = (id) => APPS.find((a) => a.id === id);
})();
