/* =====================================================================================================================
   CLIENT PORTAL APP — module 07 (docs/features/07-customer-portal.md). TWO PARTS IN ONE APP:
     (A) AGENCY-SIDE ADMIN of the portal (routes without prefix): clients, portal users, invitations, requests, approvals, profile changes, access, branding, settings, activity.
     (B) "PREVIEW AS CUSTOMER" (routes cp-*): the customer-facing shell with customer roles, rendered inside a labelled frame so nobody confuses it with the agency app.
   =====================================================================================================================
   SCHEMA-ALIGNED to api/prisma/schema.prisma. Owned by 07: CustomerPortalSettings (organization_id, enabled, custom_domain, branding Json, features Json, default_role_slug, profile_changes_require_approval,
   widget_settings Json, welcome_message, support_email) and CustomerPortalProfileChangeRequest (company_id, contact_id, requested_by_user_id, changes Json, status, reviewed_by_membership_id, reviewed_at, review_note).
   Enum PortalProfileChangeStatus (PENDING, APPROVED, REJECTED, AUTO_APPLIED). Everything else is REUSED: CustomerPortalMembership + Invitation (01 §79: audience CUSTOMER_PORTAL, customer_id, portal_membership_id),
   CrmCompany/CrmContact (02), ProjectDeliverable + ProjectDeliverableReview + ProjectStatusUpdate(+Comment) + ProjectChangeRequest (05), Task.customer_visible (06), Ticket (13, source PORTAL),
   Document/Folder customer_visible (17), Invoice/Subscription (08), Proposal (03), Contract (04), Channel (12), AuditEvent (01), OrganizationDomain (01).
   Enums used verbatim: MembershipStatus (INVITED, ACTIVE, SUSPENDED, DEACTIVATED), InvitationStatus (PENDING, ACCEPTED, EXPIRED, CANCELLED, REJECTED), InvitationAudience (MEMBER, CUSTOMER_PORTAL),
   DeliverableStatus (PLANNED, IN_PROGRESS, READY_FOR_REVIEW, SUBMITTED, CHANGES_REQUESTED, ACCEPTED, REJECTED, CANCELLED), TicketType, TicketPriority (LOW, NORMAL, HIGH, URGENT),
   TicketStatusCategory (NEW, OPEN, PENDING_CUSTOMER, ON_HOLD, RESOLVED, CLOSED), TicketSource (… PORTAL …), ProjectHealth, ProjectStatusCategory, ProjectVisibility (INTERNAL, CUSTOMER_VISIBLE),
   InvoiceStatus, SubscriptionStatus, ProposalStatus, ContractStatus, CrmCompanyType.
   Permission keys (15 in the catalog, * = sensitive): portal.users.manage*, portal.settings.manage, portal.projects.read, portal.deliverables.approve, portal.requests.create, portal.documents.read, portal.documents.upload,
   portal.proposals.read, portal.proposals.accept*, portal.contracts.read, portal.contracts.sign*, portal.invoices.read, portal.invoices.pay*, portal.subscriptions.manage*, portal.conversations.participate.
   Customer role templates (RoleType CUSTOMER_PORTAL, scope CUSTOMER): customer-owner (portal.*), customer-administrator, customer-manager, customer-finance, customer-legal, customer-viewer.
   Comment tags (legend in README.md): @screen @route @perm @api @mcp @data @ui @states @audit @note @gap. Every screen ends with a "Data model" footer (REVIEW-ONLY, do not ship).

   RULES THAT APPLY TO EVERY SCREEN HERE:
     - VISIBILITY PRINCIPLE (07 §1): a record reaches the portal only when its owning module marks it customer-visible (Project.visibility CUSTOMER_VISIBLE, ProjectDeliverable.customer_visible, Task.customer_visible,
       TaskComment.visibility CUSTOMER_VISIBLE, ProjectStatusUpdate.customer_visible, Document/Folder.customer_visible, WikiPage.customer_visible, Release.customer_visible). The portal never owns or copies them.
       Internal notes, risks, margins, internal channels and employee data are never exposed. Every portal read re-evaluates permissions through the central authorization service (01 §136) and is scoped to the
       caller's CustomerPortalMembership.customer_id (tenant = organization_id, then customer).
     - IDENTITY is 01 §79: a portal user is a User + CustomerPortalMembership (organization_id, customer_id = CrmCompany, role_id of type CUSTOMER_PORTAL). Customers never create Tasks; a request is a Ticket (13).
     - AGENCY screens are gated by the agency's own portal.* keys (portal.users.manage*, portal.settings.manage) plus the owning module's keys for the data they show (support.tickets.*, projects.*, crm.*).
     - Every customer action (login, approve, accept, sign, pay, download of sensitive documents, user management) writes audit_events with the portal user as actor.
     - Light and dark: only semantic tokens; the branded customer frame derives from tokens, never hex.
   ===================================================================================================================== */
(function () {
  const U = window.UI;
  const { E, ES, head, btn, cd, sw, cb, sel, stat, search, who, tok, kv, muted, more, callout, dm, tabs, pane } = U;
  const I = (n, s) => LQ.icon(n, s);
  const th = (a) => "<thead><tr>" + a.map((x) => "<th" + (x[0] === ">" ? ' class="num"' : "") + ">" + x.replace(/^>/, "") + "</th>").join("") + "</tr></thead>";
  const tbl = (cols, rows) => '<div class="panel" style="margin-top:0"><table>' + th(cols) + "<tbody>" + rows.map((r) => "<tr>" + r.map((c, i) => "<td" + (cols[i][0] === ">" ? ' class="num"' : "") + ">" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  const bar = (p, tone) => '<span class="bar"><i style="width:' + p + "%" + (tone ? ";background:var(--" + tone + ")" : "") + '"></i></span>' + p + "%";
  const ink = (t) => '<span class="ink">' + t + "</span>";
  const f = (l, h, hint) => '<div class="fld"><label>' + l + "</label>" + h + (hint ? '<div class="sub-note">' + hint + "</div>" : "") + "</div>";
  const box = (t) => '<div class="input-fake">' + t + "</div>";
  const pager = (t) => '<div class="pager"><span class="muted">' + t + '</span><span style="flex:1"></span>' + btn("Previous", "", "sm") + btn("Next", "", "sm") + "</div>";
  const chip = (a, o, v) => '<span class="fchip"><b>' + a + "</b><i>" + o + "</i><span>" + v + "</span>" + I("x", 12) + "</span>";
  const fbar = (chips, extra) => '<div class="fbar"><div class="fchips">' + chips.map((c) => chip(c[0], c[1], c[2])).join("") + '<button class="btn sm ghost">' + I("plus", 13) + ' Add filter</button></div><div class="fright">' + (extra || "") + "</div></div>";
  const sp = (h) => '<div style="height:' + (h || 12) + 'px"></div>';
  const bulk = (n, acts) => '<div class="bulk"><span class="cb on"></span><b>' + n + ' selected</b><span class="muted">the bulk bar appears when rows are selected</span><span style="flex:1"></span>' + acts + "</div>";
  const lk = (k) => '<code class="pk">' + k + "</code>";

  /* people: agency (internal) and customer (portal users) */
  const P = {
    AM: ["Anna Meyer", ""], MS: ["Marco Silva", "g"], SJ: ["Sofia Jensen", "y"],
    LK: ["Lena Kovac", "p"], TB: ["Tom Becker", "g"], RO: ["Rita Okafor", "r"], DH: ["Dan Hughes", ""], PN: ["Priya Nair", "y"], SV: ["Sam Voss", "p"], EM: ["Eva Moll", "g"],
  };
  const wh = (a, sub) => who(a, P[a][1], P[a][0], sub || "");
  const av = (a) => LQ.av(a, P[a][1]);

  /* customer roles (RoleType CUSTOMER_PORTAL) with the real permission lists from the seed role templates */
  const KEYS = ["portal.users.manage", "portal.settings.manage", "portal.projects.read", "portal.deliverables.approve", "portal.requests.create", "portal.documents.read", "portal.documents.upload", "portal.proposals.read", "portal.proposals.accept", "portal.contracts.read", "portal.contracts.sign", "portal.invoices.read", "portal.invoices.pay", "portal.subscriptions.manage", "portal.conversations.participate"];
  const SENS = { "portal.users.manage": 1, "portal.proposals.accept": 1, "portal.contracts.sign": 1, "portal.invoices.pay": 1, "portal.subscriptions.manage": 1 };
  const ROLES = {
    "customer-owner": ["Customer Owner", KEYS],
    "customer-administrator": ["Customer Administrator", ["portal.users.manage", "portal.settings.manage", "portal.projects.read", "portal.requests.create", "portal.documents.read", "portal.documents.upload", "portal.proposals.read", "portal.contracts.read", "portal.invoices.read", "portal.conversations.participate", "portal.deliverables.approve"]],
    "customer-manager": ["Customer Manager", ["portal.projects.read", "portal.deliverables.approve", "portal.requests.create", "portal.documents.read", "portal.documents.upload", "portal.proposals.read", "portal.contracts.read", "portal.conversations.participate"]],
    "customer-finance": ["Customer Finance", ["portal.invoices.read", "portal.invoices.pay", "portal.subscriptions.manage", "portal.proposals.read", "portal.contracts.read", "portal.documents.read"]],
    "customer-legal": ["Customer Legal", ["portal.proposals.read", "portal.proposals.accept", "portal.contracts.read", "portal.contracts.sign", "portal.documents.read", "portal.conversations.participate"]],
    "customer-viewer": ["Customer Viewer", ["portal.projects.read", "portal.documents.read", "portal.proposals.read", "portal.contracts.read", "portal.invoices.read"]],
  };
  const RC = { "customer-owner": "purple", "customer-administrator": "blue", "customer-manager": "green", "customer-finance": "yellow", "customer-legal": "red", "customer-viewer": "" };
  const role = (s) => '<span class="badge ' + RC[s] + '" title="Role.slug ' + s + '">' + ROLES[s][0] + "</span>";
  const MSC = { INVITED: "blue", ACTIVE: "green", SUSPENDED: "yellow", DEACTIVATED: "" };
  const ISC = { PENDING: "blue", ACCEPTED: "green", EXPIRED: "yellow", CANCELLED: "", REJECTED: "red" };
  const DSC = { PLANNED: "", IN_PROGRESS: "blue", READY_FOR_REVIEW: "purple", SUBMITTED: "purple", CHANGES_REQUESTED: "yellow", ACCEPTED: "green", REJECTED: "red", CANCELLED: "" };
  const TSC = { NEW: "blue", OPEN: "blue", PENDING_CUSTOMER: "yellow", ON_HOLD: "", RESOLVED: "green", CLOSED: "" };
  const TPC = { LOW: "", NORMAL: "", HIGH: "yellow", URGENT: "red" };
  const HC = { HEALTHY: "green", AT_RISK: "yellow", BLOCKED: "red", CRITICAL: "red", UNKNOWN: "" };
  const PCS = { PENDING: "yellow", APPROVED: "green", REJECTED: "red", AUTO_APPLIED: "blue" };

  /* companies (CrmCompany type CUSTOMER). name, status of portal, users, role mix, projects, open requests, pending approvals, last active, account manager, customer_since */
  const CO = [
    ["Acme Corp", 1, 6, 3, 4, 2, "2 h ago", "AM", "Mar 2024"],
    ["Globex", 1, 3, 2, 1, 0, "Yesterday", "MS", "Aug 2024"],
    ["Northwind Traders", 1, 4, 1, 2, 1, "3 days ago", "AM", "Jan 2025"],
    ["Initech", 1, 2, 1, 0, 0, "12 days ago", "SJ", "Jun 2025"],
    ["Umbrella Studio", 0, 0, 0, 0, 0, "—", "MS", "Sep 2025"],
    ["Hooli Media", 1, 1, 0, 1, 0, "Never", "SJ", "Oct 2025"],
  ];

  /* the customer-frame banner and shell ----------------------------------------------------------------------------------------- */
  const PVNAV = [["cp-dashboard", "Dashboard", "home", ""], ["cp-projects", "Projects", "folder", "portal.projects.read"], ["cp-approvals", "Approvals", "check", "portal.deliverables.approve"], ["cp-requests", "Requests", "support", "portal.requests.create"], ["cp-agreements", "Proposals & contracts", "pen", "portal.proposals.read"], ["cp-billing", "Billing", "dollar", "portal.invoices.read"], ["cp-documents", "Documents", "file", "portal.documents.read"], ["cp-messages", "Messages", "chat", "portal.conversations.participate"], ["cp-team", "Company & team", "users", "portal.users.manage"]];
  /* @impl pv(active, body): wraps a customer screen. The banner is agency-only chrome ("Preview as customer" needs portal.settings.manage, is read-only and audited as portal.preview_started with the previewed membership);
       the framed part below it is exactly what the customer sees. Nav items are hidden (not greyed) when the previewed role lacks the key. */
  function pv(active, body, side) {
    return '<div class="a-page">' +
      '<div class="cpf-banner">' + I("shield", 16) + '<div class="grow"><b>Preview as customer</b> · customer-facing shell, read-only. Actions are disabled and nothing you click here is saved or audited as the customer.<small>The agency app is everything outside the frame below.</small></div>' +
      sel("Acme Corp", "building") + sel("Lena Kovac · Customer Owner", "users") + sel("Light", "sparkles") + btn("Exit preview", "x", "sm") + "</div>" +
      '<div class="cpf"><div class="cpf-top"><div class="cpf-brand"><span class="cpf-logo">L</span><b>Logiqdev Client Portal</b></div><div class="cpf-search">' + I("search", 14) + ' Search projects, documents, invoices</div><span style="flex:1"></span>' + I("bell", 16) + '<span class="cpf-who">' + LQ.av("LK", "p") + "<span><b>Lena Kovac</b><small>Acme Corp · Customer Owner</small></span></span></div>" +
      '<div class="cpf-nav">' + PVNAV.map((n) => '<a class="' + (n[0] === active ? "on" : "") + '" href="#portal/' + n[0] + '">' + I(n[2], 14) + n[1] + "</a>").join("") + "</div>" +
      '<div class="cpf-body">' + body + "</div>" +
      '<div class="cpf-foot">Powered by Logiqdev · <span class="muted">support@logiqdev.example</span> · Privacy · Terms</div></div>' + (side || "") + "</div>";
  }
  const pvh = (t, p, a) => '<div class="cpf-h"><div><h2>' + t + "</h2>" + (p ? "<p>" + p + "</p>" : "") + '</div><div class="acts">' + (a || "") + "</div></div>";
  const gate = (k, t) => '<span class="gate" title="Shown only with ' + k + '">' + I("lock", 11) + k + (t ? " · " + t : "") + "</span>";

  /* =====================================================================================================================
     OVERVIEW (agency)
     @screen Portal overview
     @route  /portal/dashboard
     @perm   VIEW portal.users.read or portal.activity.read (read-only agency users) or portal.settings.manage / portal.users.manage · counts of tickets/deliverables follow support.tickets.read / projects.deliverables.read
     @api    GET /portal/overview → { clients, users, invitations_by_status, pending_profile_changes, deliverables_awaiting_review, portal_requests_open } · built from counts over the owning modules
     @mcp    portal_overview_read
     @data   CustomerPortalSettings.enabled · CustomerPortalMembership (status, last_active_at) · Invitation (audience CUSTOMER_PORTAL, status) · CustomerPortalProfileChangeRequest (status PENDING) · ProjectDeliverable (status SUBMITTED) · Ticket (source PORTAL)
     @ui     Card, Badge, Progress, DropdownMenu, Table
     @states loading skeleton cards · portal disabled (CustomerPortalSettings.enabled = false: banner + Enable button) · no clients yet (empty with "Enable portal for a client") · error · no-access
     @audit  none for reads; enabling/disabling the portal writes portal.settings_changed
     @note   Nothing here is stored: it is aggregated from the owning modules. "Waiting on customer" = deliverables SUBMITTED and tickets PENDING_CUSTOMER; "Waiting on us" = profile changes PENDING and tickets NEW/OPEN.
     ===================================================================================================================== */
  function dashboard() {
    return '<div class="a-page">' + head("Client portal", "Everything customers see and do, and what needs your team.", btn("Preview as customer", "globe") + btn("Invite portal user", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Portal status", "Enabled", "portal.logiqdev.example") + stat("Clients with access", 5, "of 6 customers") + stat("Portal users", 16, "12 active") + stat("Pending invitations", 3, "1 expiring", 1) + stat("Waiting on us", 5, "profile changes + requests", 1) + stat("Waiting on customers", 4, "approvals + replies") + "</div>" +
      '<div class="g2">' +
      cd("<b>Waiting on us</b><span class='r muted'>needs an agency decision</span>", [
        ["Profile change · Acme Corp", "Tom Becker changed billing address and VAT number", "PENDING", "profile"],
        ["Request · SUP-2041", "Acme Corp · CSV export of invoices · FEATURE_REQUEST", "NEW", "requests"],
        ["Request · SUP-2038", "Northwind · Cannot see Q3 invoice · BILLING", "OPEN", "requests"],
        ["Invitation expiring", "p.nair@northwind.example · expires in 2 days", "PENDING", "invitations"]].map((r) => '<div class="rowx"><div class="grow"><b>' + r[0] + "</b><small>" + r[1] + "</small></div>" + E(r[2], r[2] === "NEW" ? "blue" : "yellow") + btn("Open", "", "sm") + "</div>").join(""), 1) +
      cd("<b>Waiting on customers</b><span class='r muted'>agency is blocked</span>", [
        ["Pricing page hero v3", "Acme Rebrand Website · submitted 3 days ago", "SUBMITTED"],
        ["Checkout flow prototype", "Northwind Storefront · submitted yesterday", "SUBMITTED"],
        ["Brand guidelines PDF", "Globex Brand Refresh · changes requested, resubmitted", "READY_FOR_REVIEW"],
        ["SUP-2029 · Login redirect loop", "Initech · agency replied 4 days ago", "PENDING_CUSTOMER"]].map((r) => '<div class="rowx"><div class="grow"><b>' + r[0] + "</b><small>" + r[1] + "</small></div>" + E(r[2], "purple") + "</div>").join(""), 1) + "</div>" + sp() +
      '<div class="g2">' + cd("<b>Adoption</b><span class='r muted'>last 30 days, from audit_events and last_active_at</span>", [["Weekly active portal users", 74], ["Deliverables reviewed within 3 days", 62], ["Invoices paid through the portal", 81], ["Requests opened in the portal vs email", 58]].map((r) => '<div class="bar-row"><span class="l">' + r[0] + '</span><span class="tr"><i style="width:' + r[1] + '%"></i></span><span class="v">' + r[1] + "%</span></div>").join("")) +
      cd("<b>Portal features</b><span class='r muted'>CustomerPortalSettings.features</span>", ["projects", "requests", "conversations", "documents", "proposals", "contracts", "billing", "calendar", "vault", "ai"].map((k, i) => '<div class="rowx"><div class="grow">' + tok(k) + "</div>" + sw(i < 7) + "</div>").join(""), 1) + "</div>" +
      dm(["CustomerPortalSettings · enabled, features, custom_domain", "CustomerPortalMembership · status, last_active_at · Invitation · audience, status", "CustomerPortalProfileChangeRequest · status · ProjectDeliverable · status · Ticket · source PORTAL, status category", "AuditEvent · event_type (adoption metrics)"], ["Adoption percentages are computed, nothing stored"]) + "</div>";
  }

  /* =====================================================================================================================
     CLIENTS — list
     @screen Portal clients
     @route  /portal/clients?q=&portal=&role=&owner=&activity=&view=
     @perm   VIEW portal.users.read (sees companies the caller's CRM scope allows: crm.companies.read) · enable/disable portal per client portal.settings.manage · bulk portal.users.manage*
     @api    GET /portal/clients?filter=&sort=&cursor= (CrmCompany type CUSTOMER joined with portal memberships) · POST /portal/clients/:companyId/enable · POST /portal/clients/bulk {company_ids|filter, action}
     @mcp    portal_clients_read · portal_clients_manage (sensitive: human confirmation when an AI agent calls it)
     @data   CrmCompany (name, type CUSTOMER, account_manager_membership_id, customer_since, archived_at) · CustomerPortalClientSettings (company_id, enabled, disabled_at) · CustomerPortalMembership (customer_id, status, last_active_at, role_id) · Invitation (customer_id, status) · SavedView (entity_type CRM_COMPANY, visibility)
     @ui     Table with column chooser, filter bar (Popover+Command, multi-select), saved-views Select, bulk action bar, DropdownMenu row actions, "Save view" Dialog
     @states loading skeleton · empty ("No client has portal access yet" + Enable portal for a client) · no results (clear filters) · error · no-access
     @audit  bulk actions write one audit event per company (portal.client_disabled / portal.client_enabled) plus a summary event
     @note   A "client" is a CrmCompany of type CUSTOMER (02). There is no portal table per client: "portal enabled" = at least one non-deactivated CustomerPortalMembership or a pending Invitation for that company.
             Disabling a client deactivates all its memberships (deactivated_at) and cancels pending invitations; it is reversible. Per-client switches live in CustomerPortalClientSettings (enabled, features, disabled_at).
     ===================================================================================================================== */
  function clients() {
    return '<div class="a-page">' + head("Clients", "Customers with access to the portal.", btn("Export", "file") + btn("Enable portal for a client", "plus", "primary")) +
      '<div class="toolbar">' + search("Search company, domain, contact email") + sel("Table", "grid") + sel("Sort: Last active ↓", "sort") + sel("Columns (9)", "settings") + sel("Views: Needs attention", "star") + "</div>" +
      fbar([["Company type", "is", "Customer"], ["Portal access", "is", "Enabled"], ["Account manager", "is any of", "Anna Meyer, Marco Silva"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      bulk(2, sel("Invite users…", "mail") + sel("Set default role…", "key") + btn("Disable portal", "lock", "sm")) +
      tbl(["", "Company", "Portal", ">Users", ">Pending invites", ">Visible projects", ">Open requests", ">Awaiting approval", "Last active", "Account manager", "Customer since", ""],
        CO.map((c, i) => [cb(i < 2), ink(c[0]) + "<small class='muted' style='display:block'>CrmCompany · CUSTOMER</small>", c[1] ? ES("ACTIVE", "green") : ES("DEACTIVATED"), c[2], c[0] === "Northwind Traders" ? "1" : c[0] === "Hooli Media" ? "1" : "0", [4, 1, 2, 0, 0, 1][i], c[4], c[5] ? '<span class="badge purple">' + c[5] + "</span>" : "0", c[6], wh(c[7]), c[8], more])) +
      pager("1–6 of 6 · 5 with portal access") +
      '<div class="sub-note">Row click opens the client page. Rows you cannot see (outside your CRM scope) are not counted anywhere.</div>' +
      dm(["CrmCompany · name, type, account_manager_membership_id, customer_since, archived_at", "CustomerPortalMembership · customer_id, status, last_active_at · Invitation · customer_id, status", "CustomerPortalClientSettings · company_id, enabled, disabled_at (no row = organization defaults)", "SavedView · entity_type CRM_COMPANY (filters, sorting, columns, visibility)"], []) + "</div>";
  }

  /* =====================================================================================================================
     ENABLE PORTAL FOR A CLIENT — create page
     @screen Enable portal for a client
     @route  /portal/enable?company=<crmCompanyId>
     @perm   portal.settings.manage + portal.users.manage* (it sends invitations) · crm.companies.read on the company
     @api    POST /portal/clients/:companyId/enable {default_role_slug, welcome_message?, invitations:[{email, contact_id?, role_slug, message?}], send_now, expires_in_days}
     @mcp    portal_clients_manage (sensitive)
     @data   CrmCompany (lookup) · CrmContact (prefill invitees: email, name, roles) · Invitation (audience CUSTOMER_PORTAL, customer_id, role_id, email, message, expires_at, source, invited_by_user_id, token_hash) · CustomerPortalSettings.default_role_slug
     @ui     Form in sections: Combobox (Popover+Command) for company and contacts, Select for role, DatePicker/Select for expiry, Textarea, Switch, "Send invitations" Button with Dialog confirmation
     @states validation inline (email format, duplicate pending invitation, existing membership) · sending · saved (toast + link to Invitations) · no-access · company already enabled (redirects to the client page)
     @audit  invitation.created per invitee (event carries customer_id, role slug, source) · portal.client_enabled
     @note   There is no "client portal record": enabling a client means creating its first invitations. Contacts without an email cannot be invited. A contact that is already a portal user of another company
             gets a separate CustomerPortalMembership (unique per organization + customer + user). Roles offered are RoleType CUSTOMER_PORTAL only.
     ===================================================================================================================== */
  function enable() {
    return '<div class="a-page">' + head("Enable portal for a client", "Choose the company, who gets access and with which role.", btn("Cancel") + btn("Send invitations", "send", "primary")) +
      '<div class="g2" style="grid-template-columns:1.6fr 1fr;align-items:start"><div>' +
      cd("<b>Company</b>", f("Customer (CRM company)", sel("Umbrella Studio · CUSTOMER · Marco Silva", "building"), "Only companies of type CUSTOMER you can see. The portal shows the company's customer-visible projects, documents, invoices and requests.") +
        f("Portal home message", '<div class="editor"><div class="ed-bar">' + ["B", "I", "Link"].map((x) => "<span>" + x + "</span>").join("") + '</div><div class="ed-body">Optional. Overrides the organization welcome message for this client only.</div></div>', "Stored in CustomerPortalClientSettings.welcome_message; empty = the organization welcome message applies.")) + sp() +
      cd("<b>People to invite</b><span class='r'>" + btn("Add person", "plus", "sm") + "</span>", tbl(["Contact (CrmContact)", "Email", "Role (Role.slug)", ""], [
        [wh("EM", "Studio director"), "eva.moll@umbrella.example", sel("Customer Owner"), more],
        [who("JS", "", "Jonas Sand", "Operations"), "j.sand@umbrella.example", sel("Customer Manager"), more],
        [who("NB", "y", "Nora Bell", "Accounts"), "accounts@umbrella.example", sel("Customer Finance"), more]]) +
        '<div class="rowx"><div class="grow muted">Add another contact from CRM or type an email address</div>' + sel("Pick contact…", "users") + "</div>", 1) + sp() +
      cd("<b>Message</b>", f("Personal note in the invitation email", '<div class="editor"><div class="ed-bar">' + ["B", "I", "Link"].map((x) => "<span>" + x + "</span>").join("") + '</div><div class="ed-body">Hi Eva, your project space is ready. Sign in to review designs and see invoices.</div></div>', "Invitation.message. The email is sent through Communication (11) with the organization branding.")) +
      "</div><div>" +
      cd("<b>Invitation</b>", f("Expires after", sel("14 days", "clock"), "Invitation.expires_at") + f("Default role for new people", sel("Customer Viewer · from settings", "key"), "CustomerPortalSettings.default_role_slug") + '<div class="rowx"><div class="grow"><b>Send now</b><small>Off saves them as pending drafts you can send later.</small></div>' + sw(1) + "</div>" + '<div class="rowx"><div class="grow"><b>Copy me on invitations</b></div>' + sw(0) + "</div>") + sp() +
      cd("<b>What they will see</b>", ["Projects marked customer-visible", "Deliverables, status updates, milestones", "Documents in customer-visible folders", "Invoices and subscriptions", "Requests (tickets) of their company"].map((t) => '<div class="rowx">' + I("check", 14) + '<div class="grow">' + t + "</div></div>").join("") + '<div class="sub-note">Visibility is decided by the owning modules. Nothing is exposed because of this invitation alone.</div>') + sp() +
      callout("shield", "<b>Sensitive permission.</b> Inviting portal users needs <code class='pk'>portal.users.manage</code> (sensitive). From the API or MCP it is a human-confirmed action.") +
      "</div></div>" +
      dm(["Invitation · audience CUSTOMER_PORTAL, customer_id, email, role_id, message, expires_at, source, invited_by_user_id, token_hash, status", "CrmCompany · CrmContact · Role (type CUSTOMER_PORTAL)", "CustomerPortalSettings · default_role_slug", "CustomerPortalClientSettings · enabled, default_role_slug, welcome_message (per-client override)"], []) + "</div>";
  }

  /* =====================================================================================================================
     CLIENT DETAIL
     @screen Client portal page
     @route  /portal/client?company=<id>&tab=overview|users|invitations|content|requests|approvals|profile|activity
     @perm   VIEW portal.users.manage · edit access portal.users.manage* · settings portal.settings.manage
     @api    GET /portal/clients/:companyId · GET /portal/clients/:companyId/{users|invitations|content|requests|approvals|profile-changes|activity} · POST /portal/clients/:companyId/disable
     @mcp    portal_clients_read · portal_clients_manage
     @data   CrmCompany · CrmContact · CustomerPortalClientSettings · CustomerPortalMembership (+ CustomerPortalMembershipProject) · Invitation · Project (visibility CUSTOMER_VISIBLE, customer_id) · Ticket (company_id, source PORTAL) · ProjectDeliverable/ProjectDeliverableReview · CustomerPortalProfileChangeRequest · AuditEvent (resource_type CrmCompany)
     @ui     Tabs (Overview, Portal users, Invitations, Visible content, Requests, Approvals, Profile changes, Activity), Card, Table, DropdownMenu, Dialog for role change
     @states loading · not found · portal not enabled for this client (call to action) · error · no-access (client outside scope)
     @audit  role change, deactivation, resend, cancel, disable client, profile change decision
     @note   "Visible content" is a read-only summary of what the owning modules expose; the toggles live in those modules (Project.visibility, Document.customer_visible, Folder.customer_visible, Task.customer_visible).
             This page only links to them. Acme Corp is shown because it is the richest sample.
     ===================================================================================================================== */
  function client() {
    const users = [["LK", "lena.kovac@acme.example", "customer-owner", "ACTIVE", "Mar 12, 2024", "2 h ago"], ["TB", "tom.becker@acme.example", "customer-finance", "ACTIVE", "Apr 2, 2024", "Yesterday"], ["RO", "rita.okafor@acme.example", "customer-legal", "ACTIVE", "May 20, 2024", "5 days ago"], ["DH", "dan.hughes@acme.example", "customer-manager", "SUSPENDED", "Jun 3, 2025", "41 days ago"]];
    return '<div class="a-page">' + head("Acme Corp", "CrmCompany · CUSTOMER since Mar 2024 · account manager Anna Meyer · portal.acme.example", btn("Preview as customer", "globe") + btn("Invite user", "plus") + sel("Manage", "settings")) +
      '<div class="tabset">' + tabs([["ov", "Overview"], ["us", "Portal users", 6], ["iv", "Invitations", 1], ["ct", "Visible content"], ["rq", "Requests", 2], ["ap", "Approvals", 3], ["pf", "Profile changes", 1], ["ac", "Activity"]], "ov") +
      pane("ov", 1, '<div class="mini-stats">' + stat("Portal users", 6, "5 active") + stat("Visible projects", 4, "of 6") + stat("Open requests", 2, "1 waiting on customer") + stat("Awaiting approval", 3, "oldest 3 days", 1) + stat("Outstanding", "€ 8,420", "2 invoices") + stat("Last active", "2 h ago", "Lena Kovac") + "</div>" +
        '<div class="g2">' + cd("<b>Access summary</b>", kv("Portal", ES("ACTIVE", "green")) + kv("Owner (customer-side)", "Lena Kovac · Customer Owner") + kv("Default role for new users", role("customer-viewer")) + kv("Profile changes", "Need agency approval " + muted("(org policy)")) + kv("Custom domain", "portal.acme.example " + E("VERIFIED", "green")) + kv("Features", "All organization features " + muted("(no per-client override: CustomerPortalClientSettings.features is null)"))) +
        cd("<b>Agency team shown to this customer</b><span class='r muted'>name, role and photo only (07 §3)</span>", [["AM", "Account manager"], ["MS", "Project manager"], ["SJ", "Designer"]].map((r) => '<div class="rowx">' + av(r[0]) + '<div class="grow"><b>' + P[r[0]][0] + "</b><small>" + r[1] + "</small></div></div>").join(""), 1) + "</div>") +
      pane("us", 0, tbl(["User", "Role", "Status", "Joined", "Last active", ""], users.map((u) => [wh(u[0], u[1]), role(u[2]), ES(u[3], MSC[u[3]]), u[4], u[5], more]))) +
      pane("iv", 0, tbl(["Email", "Role", "Status", "Invited by", "Expires", ""], [["m.krause@acme.example", role("customer-manager"), ES("PENDING", "blue"), "Anna Meyer", "in 9 days", more]])) +
      pane("ct", 0, tbl(["Content", "Visible to Acme", "Hidden", "Managed in"], [["Projects", "4 · CUSTOMER_VISIBLE", "2 · INTERNAL", "05 Projects"], ["Deliverables", "11", "5", "05"], ["Tasks", "23 · customer_visible", "88", "06 Tasks"], ["Folders / documents", "7 folders · 64 documents", "212", "17 Documents"], ["Status updates", "12 published", "3 drafts", "05"], ["Invoices", "9 · sent", "1 draft", "08 Finance"]])) +
      pane("rq", 0, tbl(["Ref", "Subject", "Type", "Status", "Priority"], [["SUP-2041", "CSV export of invoices", E("FEATURE_REQUEST"), E("NEW", "blue"), E("NORMAL")], ["SUP-2029", "Login redirect loop on mobile", E("BUG"), E("PENDING_CUSTOMER", "yellow"), E("HIGH", "yellow")]])) +
      pane("ap", 0, tbl(["Deliverable", "Project", "Status", "Waiting since"], [["Pricing page hero v3", "Acme Rebrand Website", E("SUBMITTED", "purple"), "3 days"], ["Brand guidelines PDF", "Acme Rebrand Website", E("READY_FOR_REVIEW", "purple"), "1 day"], ["Email template pack", "Acme Lifecycle Emails", E("SUBMITTED", "purple"), "6 hours"]])) +
      pane("pf", 0, tbl(["Requested by", "Changes", "Status", "Submitted"], [[wh("TB"), "Billing address, VAT number", ES("PENDING", "yellow"), "Nov 10"]])) +
      pane("ac", 0, '<div class="tl"><div class="ev"><b>Lena Kovac approved “Homepage wireframes”</b><small>deliverable.accepted · 2 h ago</small></div><div class="ev"><b>Tom Becker paid invoice INV-2026-0112</b><small>invoice.paid · Yesterday</small></div><div class="ev"><b>Dan Hughes suspended by Anna Meyer</b><small>membership.suspended · 41 days ago</small></div></div>') + "</div>" +
      dm(["CrmCompany · CrmContact · CustomerPortalMembership · Invitation", "Project.visibility · ProjectDeliverable.customer_visible · Task.customer_visible · Document/Folder.customer_visible (read-only counts)", "CustomerPortalClientSettings · enabled, features, default_role_slug, welcome_message, branding, disabled_at", "Ticket · ProjectDeliverableReview · CustomerPortalProfileChangeRequest · AuditEvent"], []) + "</div>";
  }

  /* =====================================================================================================================
     PORTAL USERS — list
     @screen Portal users
     @route  /portal/users?q=&company=&role=&status=&activity=&view=
     @perm   VIEW portal.users.read · invite/role/suspend/deactivate portal.users.manage* (every write is a sensitive, audited action; separation: you cannot change your own role)
     @api    GET /portal/users?filter=&sort=&cursor= · PATCH /portal/users/:membershipId {role_id|status} · POST /portal/users/bulk {ids|filter, action, role_id?}
     @mcp    portal_users_read · portal_users_manage (sensitive)
     @data   CustomerPortalMembership (customer_id, user_id, role_id, status, invited_by_user_id, joined_at, last_active_at, deactivated_at) · User (name, email) · Role (slug, type CUSTOMER_PORTAL) · CrmCompany (name) · SavedView
     @ui     Table, Popover+Command filters, multi-select with bulk bar, Select for role in bulk bar, DropdownMenu row actions (Change role, Resend invite, Suspend, Deactivate, Reset MFA, Open user), Dialog for confirmations
     @states loading skeleton · empty · no results · error · no-access
     @audit  membership.role_assigned, membership.suspended, membership.deactivated (one event per user, summary event for bulk)
     @note   Status values are MembershipStatus: INVITED (invitation accepted but membership not yet active is not a thing: INVITED rows come from Invitation acceptance flows), ACTIVE, SUSPENDED (can sign in? no, blocked with a message),
             DEACTIVATED (deactivated_at set; history kept). A user in several companies appears once per CustomerPortalMembership. The last Customer Owner of a company cannot be deactivated.
     ===================================================================================================================== */
  function users() {
    const R = [["LK", "Acme Corp", "customer-owner", "ACTIVE", "Mar 12, 2024", "2 h ago", "Anna Meyer"], ["TB", "Acme Corp", "customer-finance", "ACTIVE", "Apr 2, 2024", "Yesterday", "Anna Meyer"], ["RO", "Acme Corp", "customer-legal", "ACTIVE", "May 20, 2024", "5 days ago", "Anna Meyer"], ["DH", "Globex", "customer-manager", "ACTIVE", "Aug 30, 2024", "Yesterday", "Marco Silva"], ["PN", "Northwind Traders", "customer-administrator", "ACTIVE", "Jan 14, 2025", "3 days ago", "Anna Meyer"], ["SV", "Initech", "customer-viewer", "ACTIVE", "Jun 9, 2025", "12 days ago", "Sofia Jensen"], ["EM", "Hooli Media", "customer-owner", "INVITED", "—", "Never", "Sofia Jensen"], ["DH", "Acme Corp", "customer-manager", "SUSPENDED", "Jun 3, 2025", "41 days ago", "Anna Meyer"]];
    return '<div class="a-page">' + head("Portal users", "Customer people with a CustomerPortalMembership.", btn("Export", "file") + btn("Invite portal user", "plus", "primary")) +
      '<div class="toolbar">' + search("Search name or email") + sel("Table", "grid") + sel("Sort: Last active ↓", "sort") + sel("Columns (8)", "settings") + sel("Views: Inactive 30 days", "star") + "</div>" +
      fbar([["Status", "is any of", "Active, Invited, Suspended"], ["Role", "is any of", "Customer Owner, Customer Manager, Customer Finance"], ["Last active", "before", "30 days ago"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      bulk(2, sel("Change role…", "key") + btn("Resend invite", "mail", "sm") + btn("Suspend", "lock", "sm") + btn("Deactivate", "x", "sm")) +
      tbl(["", "User", "Company", "Role", "Status", "Joined", "Last active", "Invited by", ""], R.map((r, i) => [cb(i === 2 || i === 7), wh(r[0], r[0] === "EM" ? "eva.moll@hooli.example" : P[r[0]][0].toLowerCase().replace(" ", ".") + "@" + r[1].split(" ")[0].toLowerCase() + ".example"), r[1], role(r[2]), ES(r[3], MSC[r[3]]), r[4], r[5], r[6], more])) +
      pager("1–8 of 16") +
      dm(["CustomerPortalMembership · customer_id, user_id, role_id, status, invited_by_user_id, joined_at, last_active_at, deactivated_at", "User · name, email · Role · slug, type CUSTOMER_PORTAL · CrmCompany · name", "SavedView · filters, sorting, columns"], []) + "</div>";
  }

  /* =====================================================================================================================
     PORTAL USER — detail
     @screen Portal user
     @route  /portal/user?membership=<id>&tab=profile|access|activity|notifications
     @perm   VIEW portal.users.read · role/status/project-scope changes portal.users.manage* · reset MFA / revoke sessions portal.users.manage* (and 01 session keys)
     @api    GET /portal/users/:membershipId · PATCH /portal/users/:membershipId · POST /portal/users/:membershipId/{suspend|reactivate|deactivate|revoke-sessions|reset-mfa}
     @mcp    portal_users_read · portal_users_manage (sensitive)
     @data   CustomerPortalMembership · User · Role (permissions via RolePermission) · AuditEvent (actor_user_id) · NotificationPreference/NotificationRecipientSettings (membership relations, 14) · UserSession (01)
     @ui     Header card, Tabs, Select for role (Dialog confirms effective-permission diff), permission list (read-only), Switch for notification channels (read-only for agency)
     @states loading · not found · error · no-access
     @audit  membership.role_assigned (before/after), membership.suspended, membership.deactivated, user.sessions_revoked
     @note   Effective permissions = the role's keys only; a portal user has no per-user permission overrides; optional project scoping lives in CustomerPortalMembershipProject. Customer-side notification preferences are the user's own (14 §6):
             the agency can read, not change them.
     ===================================================================================================================== */
  function user() {
    return '<div class="a-page">' + head("Tom Becker", "tom.becker@acme.example · Acme Corp · CustomerPortalMembership", btn("Suspend", "lock") + btn("Change role", "key", "primary") + more) +
      '<div class="tabset">' + tabs([["pf", "Profile"], ["ac", "Access"], ["lg", "Activity"], ["nt", "Notifications"]], "pf") +
      pane("pf", 1, '<div class="g2">' + cd("<b>Membership</b>", kv("Status", ES("ACTIVE", "green")) + kv("Company", "Acme Corp") + kv("Role", role("customer-finance")) + kv("Invited by", "Anna Meyer") + kv("Joined", "Apr 2, 2024") + kv("Last active", "Yesterday 16:42") + kv("Deactivated", "—")) +
        cd("<b>Identity</b><span class='r muted'>User (01)</span>", kv("Name", "Tom Becker") + kv("Email", "tom.becker@acme.example " + E("VERIFIED", "green")) + kv("Language / time zone", "English · Europe/Berlin") + kv("MFA", "Enabled (authenticator app)") + kv("Sign-in method", "Password + MFA") + kv("Linked contact", "CrmContact · Tom Becker, Finance Manager")) + "</div>") +
      pane("ac", 0, '<div class="g2">' + cd("<b>Effective permissions</b><span class='r muted'>from role customer-finance</span>", KEYS.map((k) => '<div class="rowx">' + (ROLES["customer-finance"][1].indexOf(k) >= 0 ? I("check", 14) : I("x", 14)) + '<div class="grow">' + lk(k) + (SENS[k] ? " " + E("SENSITIVE", "red") : "") + "</div></div>").join(""), 1) +
        cd("<b>Scope</b>", kv("Scope type", "CUSTOMER (Role.default_scope)") + kv("Customer", "Acme Corp only") + kv("Projects", "All customer-visible " + muted("(no CustomerPortalMembershipProject rows = no per-user restriction)")) + kv("Organization", "Logiqdev") + '<div class="sub-note">Every request is checked against organization_id, then customer_id of this membership. A wrong customer returns 404.</div>') + "</div>") +
      pane("lg", 0, '<div class="tl"><div class="ev"><b>Paid invoice INV-2026-0112</b><small>invoice.paid · Yesterday 16:42 · IP 84.x.x.x</small></div><div class="ev"><b>Signed in</b><small>user.login · Yesterday 16:31 · Chrome on macOS</small></div><div class="ev"><b>Updated company billing address</b><small>portal.profile_change_requested · Nov 10</small></div><div class="ev"><b>Downloaded “MSA 2024.pdf”</b><small>document.downloaded (CONTRACTS category, sensitive) · Nov 2</small></div></div>') +
      pane("nt", 0, tbl(["Event", "In-app", "Email", "SMS"], [["Invoice created", sw(1), sw(1), sw(0)], ["Payment confirmation", sw(1), sw(1), sw(0)], ["Approval requests", sw(1), sw(1), sw(0)], ["Request updates", sw(1), sw(0), sw(0)]]) + '<div class="sub-note">Read-only for the agency. Source: NotificationPreference per CustomerPortalMembership (14).</div>') + "</div>" +
      dm(["CustomerPortalMembership · customer_id, user_id, role_id, status, last_active_at", "Role · RolePermission · User · UserSession", "CustomerPortalMembershipProject · portal_membership_id, project_id (empty = every customer-visible project of the company)", "AuditEvent · actor_user_id · NotificationPreference (membership)"], []) + "</div>";
  }

  /* =====================================================================================================================
     INVITATIONS — list
     @screen Portal invitations
     @route  /portal/invitations?status=&company=&role=&invited_by=&view=
     @perm   VIEW portal.users.read · send/resend/cancel portal.users.manage*
     @api    GET /invitations?audience=CUSTOMER_PORTAL&filter= · POST /invitations/:id/resend · POST /invitations/:id/cancel · POST /invitations/bulk
     @mcp    portal_invitations_read · portal_invitations_manage (sensitive)
     @data   Invitation (audience CUSTOMER_PORTAL, customer_id, email, role_id, status, source, message, invited_by_user_id, expires_at, last_sent_at, send_count, accepted_at, cancelled_at, rejected_at, portal_membership_id, created_at)
     @ui     Table with filter bar, bulk bar, DropdownMenu row actions, Dialog for confirmation
     @states loading · empty ("No invitations") · no results · error · no-access
     @audit  invitation.sent, invitation.resent, invitation.cancelled, invitation.accepted
     @note   Status values are InvitationStatus: PENDING, ACCEPTED, EXPIRED, CANCELLED, REJECTED. Resending creates a new token (token_hash) and pushes expires_at. Accepted rows link to the created membership.
     ===================================================================================================================== */
  function invitations() {
    const R = [["m.krause@acme.example", "Acme Corp", "customer-manager", "PENDING", "Anna Meyer", "Nov 2", "Nov 20"], ["p.nair@northwind.example", "Northwind Traders", "customer-finance", "PENDING", "Anna Meyer", "Oct 28", "Nov 13"], ["eva.moll@hooli.example", "Hooli Media", "customer-owner", "PENDING", "Sofia Jensen", "Nov 8", "Nov 22"], ["s.voss@initech.example", "Initech", "customer-viewer", "ACCEPTED", "Sofia Jensen", "Jun 2", "Jun 16"], ["old@globex.example", "Globex", "customer-viewer", "EXPIRED", "Marco Silva", "Sep 1", "Sep 15"], ["x@acme.example", "Acme Corp", "customer-viewer", "CANCELLED", "Anna Meyer", "Sep 10", "Sep 24"], ["jc@northwind.example", "Northwind Traders", "customer-manager", "REJECTED", "Anna Meyer", "Aug 4", "Aug 18"]];
    return '<div class="a-page">' + head("Invitations", "Customer portal invitations (Invitation.audience = CUSTOMER_PORTAL).", btn("Invite portal user", "plus", "primary")) +
      '<div class="toolbar">' + search("Search email") + sel("Table", "grid") + sel("Sort: Created ↓", "sort") + sel("Views: Expiring soon", "star") + "</div>" +
      fbar([["Status", "is any of", "Pending"], ["Company", "is any of", "Any"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      bulk(2, btn("Resend", "mail", "sm") + btn("Cancel invitation", "x", "sm")) +
      tbl(["", "Email", "Company", "Role", "Status", "Invited by", "Created", "Expires", ""], R.map((r, i) => [cb(i < 2), ink(r[0]), r[1], role(r[2]), ES(r[3], ISC[r[3]]), r[4], r[5], r[6], more])) +
      pager("1–7 of 11") +
      dm(["Invitation · audience, customer_id, email, role_id, status, source, message, invited_by_user_id, expires_at, last_sent_at, send_count (\"Sent\" column, resend limits), accepted_at, cancelled_at, rejected_at, portal_membership_id"], []) + "</div>";
  }

  /* =====================================================================================================================
     INVITE PORTAL USER — create page
     @screen Invite portal user
     @route  /portal/invite?company=<id>
     @perm   portal.users.manage* · the company must be in the caller's CRM scope (crm.companies.read)
     @api    POST /invitations {audience: "CUSTOMER_PORTAL", customer_id, emails[] | contact_ids[], role_id, message?, expires_at, source}
     @mcp    portal_invitations_manage (sensitive)
     @data   Invitation (all columns above) · CrmCompany · CrmContact · Role (type CUSTOMER_PORTAL)
     @ui     Form: Combobox for company, TagInput for emails + Command to pick CRM contacts, Select for role (with permission preview Popover), Textarea, Select for expiry, Switch
     @states validation inline (existing membership, duplicate pending, invalid domain when the company has allowed domains) · sending · sent (toast + Undo for 30 s) · error · no-access
     @audit  invitation.created
     @note   Role preview lists the role's portal.* keys and marks sensitive ones (accept, sign, pay, manage). Inviting an Owner is itself an elevated action and needs the caller to hold portal.users.manage at organization scope.
     ===================================================================================================================== */
  function invite() {
    return '<div class="a-page">' + head("Invite portal user", "Send an invitation to join a customer's portal.", btn("Cancel") + btn("Send invitation", "send", "primary")) +
      '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div>' +
      cd("<b>Who</b>", f("Company", sel("Acme Corp · CUSTOMER", "building")) + f("People", '<div class="input-fake">' + ["m.krause@acme.example", "k.lindt@acme.example"].map((e) => '<span class="seg on" style="margin-right:6px">' + e + "</span>").join("") + "type an email or pick from CRM contacts…</div>", "Invitation.email. One invitation per address.") + f("Or choose CRM contacts", sel("Add contacts…", "users"), "Contacts of this company with an email and no membership yet.")) + sp() +
      cd("<b>Role</b>", ["customer-viewer", "customer-manager", "customer-finance", "customer-legal", "customer-administrator", "customer-owner"].map((s, i) => '<div class="rowx rolepick' + (i === 1 ? " on" : "") + '"><div class="grow">' + role(s) + "<small>" + ROLES[s][1].length + " permissions" + (ROLES[s][1].filter((k) => SENS[k]).length ? " · " + ROLES[s][1].filter((k) => SENS[k]).length + " sensitive" : "") + "</small></div>" + (i === 1 ? I("check", 16) : "") + "</div>").join("")) + sp() +
      cd("<b>Message</b>", f("Personal note", '<div class="editor"><div class="ed-bar"><span>B</span><span>I</span><span>Link</span></div><div class="ed-body">Hi Maya, I added you to our client portal so you can review designs and approve deliverables.</div></div>')) +
      "</div><div>" +
      cd("<b>Options</b>", f("Expires after", sel("14 days", "clock")) + '<div class="rowx"><div class="grow"><b>Send copy to me</b></div>' + sw(0) + '</div><div class="rowx"><div class="grow"><b>Require MFA on first sign-in</b><small>Follows the organization security policy (01).</small></div>' + sw(1) + "</div>") + sp() +
      cd("<b>Customer Manager can</b>", ROLES["customer-manager"][1].map((k) => '<div class="rowx">' + I("check", 14) + '<div class="grow">' + lk(k) + "</div></div>").join(""), 1) + sp() +
      callout("shield", "Sensitive permissions (sign, accept, pay, manage users) are only granted by the roles that carry them. This invitation grants exactly the role's keys.") +
      "</div></div>" +
      dm(["Invitation · audience CUSTOMER_PORTAL, customer_id, email, role_id, message, expires_at, source MANUAL, invited_by_user_id", "Role · RolePermission (preview) · CrmContact · CrmCompany"], ["Requiring MFA per invitation is not a column (follows org policy, 01)"]) + "</div>";
  }

  /* =====================================================================================================================
     REQUESTS (tickets submitted through the portal)
     @screen Portal requests
     @route  /portal/requests?q=&status=&type=&priority=&company=&project=&assignee=&linked=&view=
     @perm   VIEW support.tickets.read (13) scoped to source PORTAL · assign/convert support.tickets.update · convert to task tasks.tasks.create · convert to change request projects.change_requests.create
     @api    GET /tickets?source=PORTAL&filter= · POST /tickets/:id/convert {to: "task" | "change_request"} · POST /tickets/bulk
     @mcp    support_tickets_read · support_tickets_update
     @data   Ticket (reference, subject, type, priority, status_id → status category, company_id, requester_user_id, requester_contact_id, project_id, assignee_membership_id, change_request_id, source PORTAL, created_at, first_response_due_at, sla_breached, last_customer_reply_at) · TicketTaskLink (task) · TicketStatus.category
     @ui     Table with filter bar and saved views, bulk bar (assign, priority, status, convert), Popover+Command pickers, Badge, DropdownMenu
     @states loading · empty · no results · error · no-access
     @audit  ticket.created (actor = portal user), ticket.assigned, ticket.converted (with permanent link to the Task / Change Request)
     @note   The portal never owns requests: this is the 13 ticket list pre-filtered to source PORTAL, and the real management lives in the Support app. Customers never create Tasks; an agency member converts a ticket
             into a Task (06, via TicketTaskLink) or a Project Change Request (05 §45, Ticket.change_request_id) and the customer sees the outcome status on the ticket.
     ===================================================================================================================== */
  function requests() {
    const R = [["SUP-2041", "CSV export of invoices", "FEATURE_REQUEST", "NORMAL", "NEW", "Acme Corp", "TB", "Acme Rebrand Website", "—", "Unassigned", "5 h left"], ["SUP-2038", "Cannot see Q3 invoice", "BILLING", "HIGH", "OPEN", "Northwind Traders", "PN", "—", "—", "AM", "SLA breached"], ["SUP-2036", "Logo too small on mobile header", "CHANGE_REQUEST", "NORMAL", "OPEN", "Acme Corp", "LK", "Acme Rebrand Website", "CR-12 · UNDER_REVIEW", "MS", "1 d left"], ["SUP-2029", "Login redirect loop on mobile", "BUG", "HIGH", "PENDING_CUSTOMER", "Initech", "SV", "—", "WEB-141 · IN_PROGRESS", "MS", "paused"], ["SUP-2022", "How do I add a team member?", "QUESTION", "LOW", "RESOLVED", "Globex", "DH", "—", "—", "SJ", "met"], ["SUP-2011", "Staging site down", "INCIDENT", "URGENT", "CLOSED", "Acme Corp", "LK", "Acme Rebrand Website", "—", "AM", "met"]];
    return '<div class="a-page">' + head("Requests from the portal", "Tickets created by customers (Ticket.source = PORTAL). Managed in Support.", btn("Open in Support", "support") + btn("Export", "file")) +
      '<div class="toolbar">' + search("Search reference, subject, requester") + sel("Table", "grid") + sel("Sort: Created ↓", "sort") + sel("Columns (10)", "settings") + sel("Views: Needs reply", "star") + "</div>" +
      fbar([["Source", "is", "Portal"], ["Status category", "is not", "Closed"], ["Type", "is any of", "Feature request, Change request, Bug"], ["Linked outcome", "is", "any"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      bulk(2, sel("Assign to…", "users") + sel("Priority…") + sel("Convert to…", "link") + btn("Close", "x", "sm")) +
      tbl(["", "Ref", "Subject", "Type", "Priority", "Status", "Company", "Requester", "Project", "Outcome", "Assignee", "SLA"], R.map((r, i) => [cb(i === 0), r[0], ink(r[1]), E(r[2]), E(r[3], TPC[r[3]]), ES(r[4], TSC[r[4]]), r[5], wh(r[6]), r[7], r[8], r[9] === "Unassigned" ? muted("Unassigned") : wh(r[9]), r[10] === "SLA breached" ? '<span class="badge red">Breached</span>' : r[10]])) +
      pager("1–6 of 38") +
      cd("<b>SUP-2041 · CSV export of invoices</b><span class='r muted'>peek</span>", '<div class="g2"><div><p>Hi, our finance team needs to export all invoices as CSV for the year-end close. Is that possible from the portal?</p><div class="sub-note">Requester Tom Becker · Acme Corp · portal.requests.create</div><div class="rowx" style="margin-top:8px">' + btn("Reply", "send", "sm primary") + btn("Convert to task", "tasks", "sm") + btn("Convert to change request", "flag", "sm") + "</div></div><div>" + kv("Type", E("FEATURE_REQUEST")) + kv("Linked project", "Acme Rebrand Website") + kv("Attachments", "1 · export-sample.xlsx (17)") + kv("Visible to customer", "Public replies only; internal notes stay internal") + "</div></div>") +
      dm(["Ticket · reference, subject, type, priority, status_id, company_id, requester_user_id, project_id, assignee_membership_id, change_request_id, source PORTAL, sla_breached", "TicketStatus.category · TicketTaskLink · ProjectChangeRequest (05) · Task (06)"], []) + "</div>";
  }

  /* =====================================================================================================================
     APPROVALS (deliverable reviews)
     @screen Deliverable approvals
     @route  /portal/approvals?status=&company=&project=&due=&view=
     @perm   VIEW projects.deliverables.read (05) · remind / withdraw projects.deliverables.update · record an acceptance on the customer's behalf needs projects.deliverables.accept_on_behalf* (sensitive; the acting member is kept in acceptance_record)
     @api    GET /deliverables?customer_visible=true&status=SUBMITTED,READY_FOR_REVIEW,CHANGES_REQUESTED&filter= · POST /deliverables/:id/remind · GET /deliverables/:id/reviews
     @mcp    projects_deliverables_read · portal_approvals_remind
     @data   ProjectDeliverable (name, status, approval_mode ANY_ONE|ALL, due_date, customer_visible, submitted_at, accepted_at, document_ids, acceptance_record, milestone_id) · ProjectDeliverableApprover (portal_membership_id, required, notified_at, reminded_at) · ProjectDeliverableReview (decision, comment, reviewer_user_id, reviewer_membership_id, document_version_ids, decided_at) · ProjectAcceptanceCriterion · DocumentApproval/DocumentApprover (kind PORTAL_USER)
     @ui     Table with filter bar, Tabs (Deliverables / Document approvals), Popover for the review history, Button for reminders
     @states loading · empty ("Nothing is waiting for a customer") · no results · error · no-access
     @audit  deliverable.reminder_sent, and (from the customer side) deliverable.accepted / changes_requested / rejected with the portal user as actor
     @note   Decision values are DeliverableStatus: ACCEPTED, CHANGES_REQUESTED, REJECTED; each decision is a ProjectDeliverableReview row and sets the deliverable's status. The agency cannot decide for the customer from here.
             Document approvals (17 §10) with DocumentApprover.kind PORTAL_USER are listed in the second tab.
     ===================================================================================================================== */
  function approvals() {
    const R = [["Pricing page hero v3", "Acme Rebrand Website", "Acme Corp", "SUBMITTED", "Nov 14", "3 days", 2, "Design handoff"], ["Brand guidelines PDF", "Acme Rebrand Website", "Acme Corp", "READY_FOR_REVIEW", "Nov 18", "1 day", 1, "Launch"], ["Email template pack", "Acme Lifecycle Emails", "Acme Corp", "SUBMITTED", "Nov 20", "6 h", 0, "Templates"], ["Checkout flow prototype", "Northwind Storefront", "Northwind Traders", "SUBMITTED", "Nov 15", "1 day", 0, "UX sign-off"], ["Homepage wireframes", "Acme Rebrand Website", "Acme Corp", "ACCEPTED", "Nov 5", "—", 2, "Design handoff"], ["Logo variants", "Globex Brand Refresh", "Globex", "CHANGES_REQUESTED", "Nov 8", "—", 1, "Brand"], ["Analytics report template", "Initech Data Setup", "Initech", "REJECTED", "Oct 30", "—", 2, "Reporting"]];
    return '<div class="a-page">' + head("Deliverable approvals", "What customers must review, and every decision they made.", btn("Remind selected", "bell") + btn("Export", "file")) +
      '<div class="mini-stats">' + stat("Waiting on customers", 4, "SUBMITTED / READY_FOR_REVIEW") + stat("Oldest", "3 days", "Pricing page hero v3", 1) + stat("Changes requested", 1, "open") + stat("Median time to decision", "1.8 d", "last 30 days") + stat("Accepted this month", 9, "of 12 submitted") + "</div>" +
      '<div class="tabset">' + tabs([["dl", "Deliverables", 7], ["da", "Document approvals", 2]], "dl") +
      pane("dl", 1, '<div class="toolbar">' + search("Search deliverable, project") + sel("Table", "grid") + sel("Sort: Waiting longest ↓", "sort") + sel("Views: Overdue review", "star") + "</div>" +
        fbar([["Status", "is any of", "Submitted, Ready for review, Changes requested"], ["Customer visible", "is", "true"], ["Due", "before", "Nov 30"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
        tbl(["", "Deliverable", "Project", "Company", "Status", "Due", "Waiting", ">Reviews", "Milestone", ""], R.map((r, i) => [cb(i === 0), ink(r[0]), r[1], r[2], E(r[3], DSC[r[3]]), r[4], r[5], r[6], r[7], more])) + pager("1–7 of 19")) +
      pane("da", 0, tbl(["Document", "Approver (DocumentApprover)", "Kind", "Status", "Requested"], [["Statement of work v2", wh("RO"), E("PORTAL_USER"), E("PENDING", "yellow"), "Nov 9"], ["Content guidelines", wh("DH"), E("PORTAL_USER"), E("PENDING", "yellow"), "Nov 7"]])) + "</div>" +
      dm(["ProjectDeliverable · status, due_date, customer_visible, submitted_at, accepted_at, acceptance_record, document_ids", "ProjectDeliverableReview · decision, comment, reviewer_user_id, document_version_ids, decided_at", "ProjectDeliverableApprover · required, notified_at, reminded_at · ProjectDeliverable.approval_mode", "DocumentApproval · DocumentApprover.kind PORTAL_USER"], []) + "</div>";
  }

  /* =====================================================================================================================
     APPROVAL — deliverable review detail
     @screen Deliverable review history
     @route  /portal/approval?deliverable=<id>
     @perm   VIEW projects.deliverables.read · remind projects.deliverables.update · comments from the agency need portal-visible comment rights in 05
     @api    GET /deliverables/:id · GET /deliverables/:id/reviews · POST /deliverables/:id/remind
     @mcp    projects_deliverables_read
     @data   ProjectDeliverable (status, acceptance_record, submitted_at, accepted_at, document_ids) · ProjectDeliverableReview (all columns) · ProjectAcceptanceCriterion (requirement, expected_outcome, verification_method, status PENDING/PASSED/…, reviewer_membership_id) · Document/DocumentVersion (17)
     @ui     Two-column page, Timeline, Checklist (read-only), Table, file preview
     @states loading · not found · error · no-access
     @audit  reminder sent; decisions are written by the customer-side action and appear here
     @note   Acceptance criteria are what the reviewer checks (05 §47). The history is the queryable list of ProjectDeliverableReview rows: which document versions were reviewed (document_version_ids) and the decision.
             acceptance_record on the deliverable stores only the final evidence (portal user id, contact id, comment).
     ===================================================================================================================== */
  function approval() {
    return '<div class="a-page">' + head("Pricing page hero v3", "Deliverable · Acme Rebrand Website · milestone Design handoff · due Nov 14", btn("Send reminder", "bell") + btn("Open in Projects", "folder") + E("SUBMITTED", "purple")) +
      '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div>' +
      cd("<b>Submitted files</b><span class='r muted'>document_ids (17)</span>", [["pricing-hero-v3.fig", "Figma · v3 · 4.2 MB"], ["pricing-hero-v3.pdf", "PDF · v3 · 1.1 MB"], ["Spec notes.md", "Markdown · v1"]].map((r) => '<div class="rowx">' + I("file", 16) + '<div class="grow"><b>' + r[0] + "</b><small>" + r[1] + "</small></div>" + btn("Preview", "", "sm") + "</div>").join(""), 1) + sp() +
      cd("<b>Acceptance criteria</b><span class='r muted'>ProjectAcceptanceCriterion</span>", [["Headline scale matches brand tokens", "Visual check", "PASSED"], ["Plan cards readable at 360 px", "Device review", "PASSED"], ["Annual toggle keeps price visible", "Walkthrough", "PENDING"]].map((r) => '<div class="rowx">' + cb(r[2] === "PASSED") + '<div class="grow"><b>' + r[0] + "</b><small>Verification: " + r[1] + "</small></div>" + E(r[2], r[2] === "PASSED" ? "green" : "yellow") + "</div>").join(""), 1) + sp() +
      cd("<b>Review history</b><span class='r muted'>ProjectDeliverableReview</span>", '<div class="tl"><div class="ev"><b>Submitted for review (v3)</b><small>Marco Silva · Nov 8 · SUBMITTED</small></div><div class="ev"><b>Changes requested</b> ' + E("CHANGES_REQUESTED", "yellow") + '<small>Lena Kovac · Nov 6 · reviewed v2 · “Keep the monthly price visible by default.”</small></div><div class="ev"><b>Submitted for review (v2)</b><small>Marco Silva · Nov 4</small></div><div class="ev"><b>Changes requested</b> ' + E("CHANGES_REQUESTED", "yellow") + "<small>Tom Becker · Nov 1 · reviewed v1 · “Contrast on the plan cards is too low.”</small></div></div>") +
      "</div><div>" +
      cd("<b>Details</b>", kv("Status", E("SUBMITTED", "purple")) + kv("Customer visible", sw(1)) + kv("Owner", "Marco Silva") + kv("Submitted", "Nov 8 (3 days ago)") + kv("Due", "Nov 14") + kv("Milestone", "Design handoff · Nov 20") + kv("Proposal reference", "Section 2.3 (03)") + kv("Reviews", "2 · both CHANGES_REQUESTED")) + sp() +
      cd("<b>Who can decide</b>", ["LK", "TB", "DH"].map((a) => '<div class="rowx">' + av(a) + '<div class="grow"><b>' + P[a][0] + "</b><small>" + (a === "TB" ? "Customer Finance: cannot approve deliverables (no portal.deliverables.approve)" : "portal.deliverables.approve") + "</small></div></div>").join("") + '<div class="sub-note">Derived from roles. Required approvers come from ProjectDeliverableApprover (approval_mode ANY_ONE | ALL); with none, any user holding portal.deliverables.approve may decide.</div>') +
      "</div></div>" +
      dm(["ProjectDeliverable · status, acceptance_record, submitted_at, accepted_at, document_ids, due_date, proposal_reference", "ProjectDeliverableReview · decision, comment, reviewer_user_id, reviewer_membership_id, document_version_ids, decided_at", "ProjectDeliverableApprover · portal_membership_id, required · ProjectDeliverable.approval_mode (ANY_ONE | ALL)", "ProjectAcceptanceCriterion · requirement, verification_method, status"], []) + "</div>";
  }

  /* =====================================================================================================================
     PROFILE CHANGE REQUESTS
     @screen Profile change requests
     @route  /portal/profile-changes?status=&company=&view=
     @perm   VIEW/DECIDE portal.profile_changes.review* (sensitive) · applying the change writes the CRM record, which needs crm.companies.update / crm.contacts.update from the service
     @api    GET /portal/profile-changes?filter= · POST /portal/profile-changes/:id/approve {review_note?} · POST /portal/profile-changes/:id/reject {review_note}
     @mcp    portal_profile_changes_read · portal_profile_changes_review (sensitive)
     @data   CustomerPortalProfileChangeRequest (company_id, contact_id, requested_by_user_id, changes {field:{from,to}}, status, reviewed_by_membership_id, reviewed_at, review_note, created_at) · CrmCompany/CrmContact (target) · CustomerPortalSettings.profile_changes_require_approval
     @ui     Table with filter bar, diff Card (from → to per field), Dialog for reject with required note, Tabs (Pending / Decided)
     @states loading · empty ("No profile changes waiting") · error · no-access
     @audit  portal.profile_change_requested, portal.profile_change_approved / rejected (before and after values), crm record update event
     @note   Status values are PortalProfileChangeStatus: PENDING, APPROVED, REJECTED, AUTO_APPLIED (policy off: the CRM write happens at once and the row is the history). Approving applies the diff to CrmCompany/CrmContact in one
             transaction and rejects stale diffs (the "from" values changed since). Rejection requires a review_note that the customer sees.
     ===================================================================================================================== */
  function profile() {
    return '<div class="a-page">' + head("Profile change requests", "Customer edits to company and contact details, awaiting agency approval.", btn("Settings", "settings")) +
      '<div class="tabset">' + tabs([["pe", "Pending", 3], ["de", "Decided", 14]], "pe") +
      pane("pe", 1, fbar([["Status", "is", "Pending"], ["Company", "is any of", "Any"]], btn("Save view", "plus", "sm")) +
        [["Acme Corp", "TB", "Nov 10", "Company", [["address.street", "Hauptstr. 12", "Königsallee 88"], ["address.city", "Berlin", "Düsseldorf"], ["vat_number", "DE812345678", "DE298765432"]]], ["Northwind Traders", "PN", "Nov 9", "Contact · Priya Nair", [["phone", "+44 20 7946 0001", "+44 20 7946 0188"], ["job_title", "Operations", "Head of Operations"]]], ["Globex", "DH", "Nov 6", "Company", [["website", "globex.com", "globex.example"]]]].map((r) =>
          cd("<b>" + r[0] + " · " + r[3] + "</b><span class='r muted'>requested by " + P[r[1]][0] + " · " + r[2] + "</span>", tbl(["Field", "Current (CRM)", "Proposed"], r[4].map((c) => [lk(c[0]), '<span class="old">' + c[1] + "</span>", '<span class="new">' + c[2] + "</span>"])) + '<div class="rowx" style="margin-top:8px"><div class="grow"><small>Applies to CrmCompany' + (r[3] !== "Company" ? "/CrmContact" : "") + " when approved</small></div>" + btn("Reject", "x", "sm") + btn("Approve", "check", "sm primary") + "</div>") + sp(8)).join("")) +
      pane("de", 0, tbl(["Company", "Requested by", "Fields", "Status", "Decided by", "Decided", "Note"], [["Acme Corp", wh("LK"), "phone", ES("APPROVED", "green"), "Anna Meyer", "Oct 30", "—"], ["Initech", wh("SV"), "legal_name", ES("REJECTED", "red"), "Sofia Jensen", "Oct 22", "Please send the registration certificate first"], ["Globex", wh("DH"), "email", ES("AUTO_APPLIED", "blue"), "—", "Sep 14", "Applied immediately (policy was off)"]])) + "</div>" +
      dm(["CustomerPortalProfileChangeRequest · company_id, contact_id, requested_by_user_id, changes, status, reviewed_by_membership_id, reviewed_at, review_note", "PortalProfileChangeStatus · PENDING, APPROVED, REJECTED, AUTO_APPLIED", "CrmCompany · CrmContact (target) · CustomerPortalSettings.profile_changes_require_approval"], []) + "</div>";
  }

  /* =====================================================================================================================
     ACCESS & ROLES
     @screen Customer roles and access
     @route  /portal/access?tab=roles|matrix|channels
     @perm   VIEW portal.users.read · edit roles/permissions portal.users.manage* (role administration itself is 01's roles.manage; this screen only shows CUSTOMER_PORTAL roles)
     @api    GET /roles?type=CUSTOMER_PORTAL · GET /permissions?module=CUSTOMER_PORTAL · PUT /roles/:id/permissions
     @mcp    roles_read · roles_manage (01)
     @data   Role (slug, name, type CUSTOMER_PORTAL, default_scope CUSTOMER, modules) · RolePermission · Permission (key, module CUSTOMER_PORTAL, is_sensitive) · CustomerPortalMembership (count per role) · CustomerPortalSettings.default_role_slug
     @ui     Table / permission matrix with Checkbox cells (disabled for system roles), Tabs, Dialog "Create custom customer role", Badge for sensitive keys
     @states loading · empty · error · no-access
     @audit  role.permissions_changed (before/after), role.created
     @note   The six default roles are role templates (customer-owner has portal.*). System roles are read-only here; copying one creates a custom CUSTOMER_PORTAL role. "Access channels": every key works on UI, REST, MCP, API keys and
             webhooks through the central authorization service; customer API keys are not offered, portal users use their session. Sensitive keys (*) require MFA re-prompt on use.
     ===================================================================================================================== */
  function access() {
    return '<div class="a-page">' + head("Roles & access", "What each customer role can do in the portal.", btn("Copy role", "plus") + btn("New custom role", "plus", "primary")) +
      '<div class="tabset">' + tabs([["ro", "Roles"], ["mx", "Permission matrix"], ["ch", "Access channels"]], "ro") +
      pane("ro", 1, tbl(["Role", "Slug", "Type", "Scope", ">Permissions", ">Sensitive", ">Users", "Default for invites", ""], Object.keys(ROLES).map((s, i) => [role(s), lk(s), E("CUSTOMER_PORTAL"), E("CUSTOMER"), ROLES[s][1].length, ROLES[s][1].filter((k) => SENS[k]).length, [2, 1, 7, 3, 2, 1][i], s === "customer-viewer" ? ES("DEFAULT", "blue") : "", more]))) +
      pane("mx", 0, '<div class="panel" style="margin-top:0"><table class="mx"><thead><tr><th>Permission key</th>' + Object.keys(ROLES).map((s) => "<th>" + ROLES[s][0].replace("Customer ", "") + "</th>").join("") + "</tr></thead><tbody>" +
        KEYS.map((k) => "<tr><td>" + lk(k) + (SENS[k] ? " " + E("SENSITIVE", "red") : "") + "</td>" + Object.keys(ROLES).map((s) => "<td>" + (ROLES[s][1].indexOf(k) >= 0 ? cb(1) : cb(0)) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>" +
        '<div class="sub-note">Customer Owner holds portal.* (all). System roles are locked; copy a role to customize. Rows are the 15 catalog keys.</div>') +
      pane("ch", 0, tbl(["Channel", "Customer-side", "Agency-side admin"], [["UI", "Navigation and buttons hidden by key; 403/404 state", "Screens in this app"], ["REST API", "Same endpoints, Customer Portal identity, scoped to customer_id", "/portal/* + owning module endpoints"], ["MCP", "Portal AI assistant tools, customer-scoped data only", "portal_* tools, sensitive ones human-confirmed"], ["API key / service account", "Not issued to customers", "Explicit portal.* keys, audit actor SERVICE_ACCOUNT"], ["Webhooks & automation", "Events: deliverable.accepted, invoice.paid, request.created…", "Registered with 20 Automation"]])) + "</div>" +
      dm(["Role · slug, type CUSTOMER_PORTAL, default_scope CUSTOMER, modules · RolePermission · Permission · is_sensitive", "CustomerPortalMembership · role_id (counts) · CustomerPortalSettings · default_role_slug"], []) + "</div>";
  }

  /* =====================================================================================================================
     BRANDING
     @screen Portal branding & domain
     @route  /portal/branding
     @perm   portal.settings.manage (domain verification also needs the 01 domain key)
     @api    GET/PUT /portal/settings {custom_domain, branding, welcome_message, support_email} · POST /portal/settings/domain/verify · POST /portal/settings/logo (upload to 17)
     @mcp    portal_settings_manage
     @data   CustomerPortalSettings (custom_domain, branding Json, welcome_message, support_email, updated_at) · Organization branding (01 §15: logo, colors, favicon, email branding) · OrganizationDomain (domain, status, verification_token, verified_at, dns_check Json, tls_status PENDING|ISSUED|FAILED, tls_expires_at, last_checked_at) · Branch branding (01 §120)
     @ui     Form with live preview (split layout), Input, color picker (Popover), file Dropzone (uploads to 17), Select, Switch, Badge for domain status, Dialog for DNS instructions
     @states loading · saving · saved (toast) · validation errors inline (contrast ratio below AA is a warning, invalid hostname is an error) · domain pending verification · error · no-access
     @audit  portal.settings_changed (before/after of branding keys, domain)
     @note   branding Json holds overrides ON TOP of organization branding: { logo_document_id, favicon_document_id, primary_token, accent_token, login_background_document_id, hide_powered_by, email_footer }.
             An empty key inherits the organization value. Branch-level branding applies when the customer belongs to a branch (01 §120): shown as inherited. The preview here uses tokens; real colors are stored as values.
     ===================================================================================================================== */
  function branding() {
    return '<div class="a-page">' + head("Branding & domain", "How the portal looks to customers. Overrides the organization branding.", btn("Reset to organization", "x") + btn("Save changes", "check", "primary")) +
      '<div class="g2" style="grid-template-columns:1.1fr 1fr;align-items:start"><div>' +
      cd("<b>Identity</b>", f("Logo", '<div class="drop">' + I("clip", 16) + " Logo.svg · inherited from organization · <b>Replace</b></div>") + f("Favicon", '<div class="drop">' + I("clip", 16) + " favicon.png · inherited</div>") + f("Primary color", '<div class="rowx" style="padding:0;gap:8px"><span class="swatch" style="background:var(--blue)"></span>' + box("#2F6FED") + "</div>", "Used for buttons and links. Contrast against white is checked (AA).") + f("Accent color", '<div class="rowx" style="padding:0;gap:8px"><span class="swatch" style="background:var(--purple)"></span>' + box("#7B5CE0") + "</div>") + f("Login background", '<div class="drop">' + I("clip", 16) + " Optional image</div>")) + sp() +
      cd("<b>Text</b>", f("Welcome message", '<div class="editor"><div class="ed-bar"><span>B</span><span>I</span><span>Link</span></div><div class="ed-body">Welcome to your project space. Review designs, approve work and see invoices in one place.</div></div>', "CustomerPortalSettings.welcome_message") + f("Support email", box("support@logiqdev.example"), "CustomerPortalSettings.support_email · shown in the footer and on error pages") + f("Email footer", box("Logiqdev GmbH · Königsallee 1, Düsseldorf"))) + sp() +
      cd("<b>Custom domain</b><span class='r'>" + E("PENDING", "yellow") + "</span>", f("Domain", box("portal.logiqdev.example"), "CustomerPortalSettings.custom_domain · unique across organizations") + '<div class="panel" style="margin-top:0"><table>' + th(["Type", "Name", "Value", "Status"]) + "<tbody><tr><td>CNAME</td><td>portal</td><td>cname.portal.logiqdev.example</td><td>" + E("PENDING", "yellow") + "</td></tr><tr><td>TXT</td><td>_verify.portal</td><td>lq-verify=8f2c…</td><td>" + E("VERIFIED", "green") + '</td></tr></tbody></table></div><div class="rowx">' + btn("Check DNS", "globe", "sm") + '<div class="grow muted">Verification uses OrganizationDomain. Certificate and DNS status: OrganizationDomain.tls_status, tls_expires_at, dns_check, last_checked_at.</div></div>') + sp() +
      '<div class="rowx"><div class="grow"><b>Hide “Powered by Logiqdev”</b><small>White-label (Phase 2)</small></div>' + sw(0) + "</div>" +
      "</div><div>" + '<div class="cpf-mini"><div class="cpf-mini-h">Preview · customer login</div><div class="cpf-mini-b"><div class="cpf-brand"><span class="cpf-logo">L</span><b>Logiqdev Client Portal</b></div><h3>Welcome back</h3><p class="muted">Welcome to your project space. Review designs, approve work and see invoices in one place.</p><div class="input-fake">Email</div><div class="input-fake" style="margin-top:6px">Password</div><button class="btn primary" style="margin-top:10px;width:100%">Sign in</button><div class="sub-note" style="text-align:center">Powered by Logiqdev</div></div></div>' + sp() +
      callout("sparkles", "Branch branding (01 §120) wins when a customer belongs to a branch: Düsseldorf branch customers see the branch logo. Shown as inherited here.") + "</div></div>" +
      dm(["CustomerPortalSettings · custom_domain, branding (Json), welcome_message, support_email", "OrganizationDomain · domain, status, verification_token, verified_at, dns_check, tls_status, tls_expires_at, last_checked_at · Organization branding (01 §15)"], []) + "</div>";
  }

  /* =====================================================================================================================
     SETTINGS
     @screen Portal settings
     @route  /portal/settings?tab=general|features|security|widget
     @perm   portal.settings.manage
     @api    GET/PUT /portal/settings {enabled, features, default_role_slug, profile_changes_require_approval, widget_settings}
     @mcp    portal_settings_manage
     @data   CustomerPortalSettings (enabled, features Json {projects, requests, conversations, documents, proposals, contracts, billing, calendar, vault, ai}, default_role_slug, profile_changes_require_approval, widget_settings Json, support_email, welcome_message)
     @ui     Tabs, Switch rows, Select for default role, Textarea / code block for widget snippet, Dialog to confirm disabling the portal
     @states loading · saving · saved · error · no-access · "Disable portal" confirmation lists how many users are signed in
     @audit  portal.settings_changed (before/after), portal.enabled / portal.disabled
     @note   Turning a feature OFF removes its navigation and returns 404 on its API for portal identities; the agency modules are untouched. Each feature depends on the owner module being enabled (billing needs ModuleKey FINANCE,
             contracts need CONTRACTS, vault and ai are Phase 2). widget_settings configures the embeddable widget for customer sites (13 §5).
     ===================================================================================================================== */
  function settings() {
    const FE = [["projects", "Projects", "05 · portal.projects.read", 1], ["requests", "Requests", "13 · portal.requests.create", 1], ["conversations", "Project conversations", "12 · portal.conversations.participate", 1], ["documents", "Documents", "17 · portal.documents.read/upload", 1], ["proposals", "Proposals", "03 · portal.proposals.read/accept", 1], ["contracts", "Contracts", "04 · portal.contracts.read/sign", 1], ["billing", "Billing", "08 · portal.invoices.*, portal.subscriptions.manage", 1], ["calendar", "Calendar & booking", "19 · Phase 2", 0], ["vault", "Vault access", "17 §12 · Phase 2", 0], ["ai", "Portal AI assistant", "Shared AI layer · Phase 2", 0]];
    return '<div class="a-page">' + head("Portal settings", "Organization-wide portal configuration.", btn("Save changes", "check", "primary")) +
      '<div class="tabset">' + tabs([["ge", "General"], ["fe", "Features"], ["se", "Security"], ["wi", "Widget"]], "ge") +
      pane("ge", 1, '<div class="g2">' + cd("<b>General</b>", '<div class="rowx"><div class="grow"><b>Portal enabled</b><small>Off blocks every customer sign-in. Agency data is untouched.</small></div>' + sw(1) + "</div>" + f("Default role for invited users", sel("Customer Viewer", "key"), "default_role_slug. A new invitation preselects it.") + '<div class="rowx"><div class="grow"><b>Profile changes need agency approval</b><small>profile_changes_require_approval. Off applies edits to the CRM immediately (AUTO_APPLIED).</small></div>' + sw(1) + "</div>") +
        cd("<b>Customer-facing contact</b>", f("Support email", box("support@logiqdev.example")) + f("Welcome message", box("Welcome to your project space…"), "Edited with the branding on the Branding screen.")) + "</div>") +
      pane("fe", 0, tbl(["Feature (key)", "Backed by", "Enabled"], FE.map((r) => [tok(r[0]) + " " + r[1], r[2], sw(r[3])])) + '<div class="sub-note">CustomerPortalSettings.features. Per-client overrides: CustomerPortalClientSettings.features (null = inherit).</div>') +
      pane("se", 0, '<div class="g2">' + cd("<b>Authentication</b><span class='r muted'>owned by 01 §79</span>", kv("Methods", "Email + password, magic link, SSO (OIDC)") + kv("MFA", "Required for Owner / Administrator / Finance / Legal") + kv("Session length", "12 hours · 30 days with remember me") + kv("Allowed email domains per company", "Optional (CRM company domains)") + '<div class="sub-note">Configured in Administration, shown here for reference.</div>') + cd("<b>Sensitive actions</b>", ["Accept proposal (portal.proposals.accept)", "Sign contract (portal.contracts.sign)", "Pay invoice (portal.invoices.pay)", "Manage subscription (portal.subscriptions.manage)", "Manage portal users (portal.users.manage)"].map((t) => '<div class="rowx"><div class="grow">' + t + "</div>" + E("MFA RE-PROMPT") + "</div>").join(""), 1) + "</div>") +
      pane("wi", 0, '<div class="g2">' + cd("<b>Embeddable widget</b><span class='r muted'>widget_settings · 13 §5</span>", '<div class="rowx"><div class="grow"><b>Support chat</b></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Request form</b></div>' + sw(1) + "</div>" + f("Allowed origins", box("https://acme.example, https://app.globex.example")) + f("Position", sel("Bottom right", "panel"))) + cd("<b>Install snippet</b>", '<div class="codeblk">&lt;script src="https://portal.logiqdev.example/widget.js" data-org="…" async&gt;&lt;/script&gt;</div>' + btn("Copy", "clip", "sm")) + "</div>") + "</div>" +
      dm(["CustomerPortalSettings · enabled, features, default_role_slug, profile_changes_require_approval, widget_settings, welcome_message, support_email", "CustomerPortalClientSettings · features, default_role_slug, welcome_message, branding (per-client overrides; null = inherit)"], []) + "</div>";
  }

  /* =====================================================================================================================
     ACTIVITY
     @screen Portal activity
     @route  /portal/activity?actor=&company=&event=&from=&to=&view=
     @perm   VIEW portal.activity.read (portal events only; full audit needs organizations.audit.read*) · export needs the audit export key
     @api    GET /audit-events?actor_type=USER&event_type=portal.*,deliverable.*,invoice.*&membership_scope=customer&filter=
     @mcp    audit_events_read
     @data   AuditEvent (event_type, actor_user_id, actor_type, resource_type, resource_id, metadata, ip_address, user_agent, created_at) · CustomerPortalMembership (to resolve the company)
     @ui     Table with filter bar and saved views, Popover for metadata JSON, DropdownMenu for export
     @states loading · empty · no results · error · no-access
     @audit  reading is not audited; exports are
     @note   Spec §17 audits login, approvals, signatures, payments, sensitive-category document downloads and user management by customer users. Rows are immutable. IP and user agent are shown only to users with the audit permission.
     ===================================================================================================================== */
  function activity() {
    const R = [["2 h ago", "LK", "Acme Corp", "deliverable.accepted", "ProjectDeliverable", "Homepage wireframes", "84.x.x.x"], ["Yesterday 16:42", "TB", "Acme Corp", "invoice.paid", "Invoice", "INV-2026-0112 · € 4,200", "84.x.x.x"], ["Yesterday 11:02", "DH", "Globex", "user.login", "User", "Password + MFA", "62.x.x.x"], ["Nov 9", "PN", "Northwind Traders", "portal.profile_change_requested", "CustomerPortalProfileChangeRequest", "2 fields", "81.x.x.x"], ["Nov 8", "RO", "Acme Corp", "contract.signed", "Contract", "MSA renewal 2026", "84.x.x.x"], ["Nov 2", "RO", "Acme Corp", "document.downloaded", "Document", "MSA 2024.pdf (sensitive)", "84.x.x.x"], ["Oct 30", "AM", "Acme Corp", "membership.suspended", "CustomerPortalMembership", "Dan Hughes", "agency"]];
    return '<div class="a-page">' + head("Portal activity", "Immutable audit trail of customer and agency actions on the portal.", btn("Export", "file")) +
      '<div class="toolbar">' + search("Search event, resource, actor") + sel("Table", "grid") + sel("Sort: Newest ↓", "sort") + sel("Views: Approvals and payments", "star") + "</div>" +
      fbar([["Event", "is any of", "login, approvals, signatures, payments"], ["Company", "is any of", "Any"], ["Date", "between", "Oct 12 – Nov 11"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      tbl(["When", "Actor", "Company", "Event (event_type)", "Resource", "Detail", "IP"], R.map((r) => [r[0], wh(r[1]), r[2], lk(r[3]), r[4], r[5], r[6]])) + pager("1–7 of 412") +
      dm(["AuditEvent · event_type, actor_type, actor_user_id, resource_type, resource_id, metadata, ip_address, user_agent, created_at", "CustomerPortalMembership (company resolution)"], []) + "</div>";
  }

  /* =====================================================================================================================
     ===== CUSTOMER-FACING SHELL (PREVIEW AS CUSTOMER) =====
     Shared notes for every cp-* screen:
     @perm   the previewed user's role (here Customer Owner, customer-owner = portal.*). The agency needs portal.preview.use to open the preview (read-only, every open is audited). Nav items are hidden when the role lacks the key.
     @api    the same REST API as the internal app, with the Customer Portal identity and scope customer_id; lists are filtered server-side to customer-visible records only.
     @mcp    portal AI assistant tools (phase 2) use the same permission layer, customer-scoped.
     @audit  login, approvals, signatures, payments, sensitive downloads, user management by the customer user
     ===================================================================================================================== */

  /* @screen Customer dashboard
     @route  /portal/cp-dashboard (customer URL: /)
     @perm   any signed-in portal user; each widget needs its key: portal.projects.read, portal.deliverables.approve, portal.invoices.read, portal.requests.create, portal.conversations.participate, portal.documents.read
     @api    GET /portal/me/dashboard (aggregates projects, approvals, tickets, invoices, messages, documents for customer_id)
     @mcp    portal_dashboard_read
     @data   Project (visibility CUSTOMER_VISIBLE, health, progress) · ProjectMilestone · ProjectDeliverable (customer_visible, status) · Proposal/Contract/DocumentApproval pending · Ticket (company_id) · Invoice/Subscription · Channel messages (12) · Document (customer_visible) · ProjectAssignment (name, role, photo only)
     @ui     Card grid, Progress, Badge, Avatar, Skeleton
     @states loading skeleton · empty per widget ("No outstanding invoices") · error per widget (one failing widget does not break the page) · no-access hides widget
     @note   Spec §3. Widgets are hidden, not greyed, when the role lacks the key. Agency team members expose name, role and photo only. */
  function cpDashboard() {
    return pv("cp-dashboard", pvh("Good morning, Lena", "Here is where things stand with Logiqdev.", btn("New request", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Active projects", 3, "1 at risk", 1) + stat("Waiting for you", 4, "3 approvals · 1 contract") + stat("Open requests", 2, "1 needs your reply") + stat("Outstanding", "€ 8,420", "2 invoices · 1 overdue", 1) + stat("Next milestone", "Nov 20", "Design handoff") + "</div>" +
      '<div class="g2"><div>' + cd("<b>Needs your attention</b>" + gate("portal.deliverables.approve"), [["Approve “Pricing page hero v3”", "Acme Rebrand Website · due Nov 14", "Review", "purple"], ["Approve “Brand guidelines PDF”", "Acme Rebrand Website · due Nov 18", "Review", "purple"], ["Sign MSA renewal 2026", "Contract · FULLY_SIGNED after your signature", "Sign", "red"], ["Pay INV-2026-0118 · € 4,200", "Overdue since Nov 3", "Pay", "yellow"]].map((r) => '<div class="rowx"><div class="grow"><b>' + r[0] + "</b><small>" + r[1] + "</small></div>" + btn(r[2], "", "sm primary") + "</div>").join(""), 1) + sp() +
      cd("<b>Projects</b>" + gate("portal.projects.read"), [["Acme Rebrand Website", "IN_PROGRESS", "HEALTHY", 62, "Nov 28"], ["Acme Lifecycle Emails", "IN_PROGRESS", "AT_RISK", 35, "Dec 12"], ["Brand Strategy Sprint", "COMPLETED", "HEALTHY", 100, "Oct 30"]].map((r) => '<div class="rowx"><div class="grow"><b>' + r[0] + "</b><small>" + E(r[1]) + " " + E(r[2], HC[r[2]]) + " · due " + r[4] + "</small></div>" + bar(r[3], r[3] === 35 ? "yellow" : "") + "</div>").join(""), 1) + "</div><div>" +
      cd("<b>Upcoming</b>", [["Nov 14", "Approval deadline · Pricing hero"], ["Nov 15", "Review call · 10:00"], ["Nov 20", "Milestone · Design handoff"]].map((r) => '<div class="rowx"><div class="when">' + r[0] + '</div><div class="grow">' + r[1] + "</div></div>").join(""), 1) + sp() +
      cd("<b>Latest messages</b>" + gate("portal.conversations.participate"), '<div class="rowx">' + av("MS") + '<div class="grow"><b>Marco Silva</b><small>#acme-rebrand · “Uploaded v3, ready when you are.” · 1 h ago</small></div></div><div class="rowx">' + av("AM") + '<div class="grow"><b>Anna Meyer</b><small>#acme-rebrand · “Call moved to 10:00.” · Yesterday</small></div></div>', 1) + sp() +
      cd("<b>Your Logiqdev team</b>", ["AM", "MS", "SJ"].map((a) => '<div class="rowx">' + av(a) + '<div class="grow"><b>' + P[a][0] + "</b><small>" + { AM: "Account manager", MS: "Project manager", SJ: "Designer" }[a] + "</small></div></div>").join(""), 1) + "</div></div>" +
      dm(["Project.visibility · ProjectMilestone · ProjectDeliverable.customer_visible · Ticket · Invoice/Subscription (08) · Channel (12) · Document.customer_visible", "CustomerPortalMembership (identity, customer scope)"], []) + "");
  }

  /* @screen Customer projects list
     @route  /portal/cp-projects (customer URL: /projects)
     @perm   portal.projects.read
     @api    GET /portal/projects?status=&health=&q= (Project where visibility = CUSTOMER_VISIBLE and customer_id = caller's)
     @mcp    portal_projects_read
     @data   Project (name, status_category, health, progress, start/end dates, visibility) · ProjectMilestone (next) · ProjectAssignment (team)
     @ui     Card grid or Table (toggle), filter Select (shadcn), Progress, Badge
     @states loading · empty ("No projects are shared with you yet") · error · no-access (feature off: nav item hidden)
     @note   Internal-only projects never appear and are not counted. Budget, margin and internal risks are never shown. */
  function cpProjects() {
    return pv("cp-projects", pvh("Projects", "Projects Logiqdev shares with Acme Corp.", sel("Status: All", "filter") + sel("Health: Any") + sel("Cards", "grid")) +
      '<div class="cpf-grid">' + [["Acme Rebrand Website", "IN_PROGRESS", "HEALTHY", 62, "Nov 28", "Design handoff · Nov 20", "MS"], ["Acme Lifecycle Emails", "IN_PROGRESS", "AT_RISK", 35, "Dec 12", "Template pack · Nov 20", "SJ"], ["Mobile App v2", "PLANNED", "UNKNOWN", 0, "Mar 2027", "Kickoff · Jan 12", "AM"], ["Brand Strategy Sprint", "COMPLETED", "HEALTHY", 100, "Oct 30", "Completed", "SJ"]].map((r) =>
        '<a class="cpf-card" href="#portal/cp-project"><div class="cpf-card-h"><b>' + r[0] + "</b>" + E(r[2], HC[r[2]]) + "</div><div class='muted'>" + E(r[1]) + " · due " + r[4] + "</div>" + '<div style="margin:10px 0">' + bar(r[3], r[2] === "AT_RISK" ? "yellow" : "") + "</div><small class='muted'>Next: " + r[5] + "</small><div class='cpf-card-f'>" + av(r[6]) + "<span class='muted'>" + P[r[6]][0] + "</span></div></a>").join("") + "</div>" +
      dm(["Project · name, status_category, health, visibility CUSTOMER_VISIBLE, planned dates, progress", "ProjectMilestone · ProjectAssignment (name/role/photo only)"], []));
  }

  /* @screen Customer project page
     @route  /portal/cp-project (customer URL: /projects/:id?tab=overview|timeline|deliverables|updates|tasks|changes|conversation)
     @perm   portal.projects.read · comment on updates portal.projects.read · approve deliverables portal.deliverables.approve · conversation portal.conversations.participate · approve change requests portal.deliverables.approve (agency routes the approval to the customer)
     @api    GET /portal/projects/:id · GET …/status-updates · POST …/status-updates/:id/comments {body} · GET …/deliverables · GET …/tasks (customer_visible) · GET …/change-requests (customer_visible)
     @mcp    portal_projects_read
     @data   Project · ProjectMilestone · ProjectDeliverable · ProjectStatusUpdate (customer_visible) · ProjectStatusUpdateComment (author_user_id) · Task (customer_visible) · TaskComment (visibility CUSTOMER_VISIBLE) · ProjectChangeRequest (customer_visible, status) · Channel (customer channel, 12 §27)
     @ui     Tabs, Timeline/Gantt (read-only), Table, Comment composer, Progress
     @states loading · not found / not shared (404, never 403) · error · empty tabs
     @audit  status_update.commented, deliverable.* decisions
     @note   Spec §4. Roadmap shows milestones and customer-visible deliverables only. Status updates are the published ones (customer_visible). */
  function cpProject() {
    return pv("cp-projects", pvh("Acme Rebrand Website", "In progress · healthy · due Nov 28 · project manager Marco Silva", btn("Message team", "chat")) +
      '<div class="tabset">' + tabs([["ov", "Overview"], ["tl", "Timeline"], ["dl", "Deliverables", 3], ["up", "Updates"], ["tk", "Tasks"], ["ch", "Changes", 1], ["cv", "Conversation"]], "ov") +
      pane("ov", 1, '<div class="mini-stats">' + stat("Progress", "62%", "") + stat("Health", "Healthy", "") + stat("Milestones", "3 of 5", "done") + stat("Deliverables", "8 of 11", "accepted") + stat("Next date", "Nov 14", "your approval") + "</div>" +
        '<div class="g2">' + cd("<b>Latest update</b><span class='r muted'>ProjectStatusUpdate · Nov 8</span>", "<p><b>On track.</b> Pricing page hero v3 is ready for review. Analytics tagging starts next week.</p>" + '<div class="tl"><div class="ev"><b>Lena Kovac</b><small>Nov 8 · “Great progress, thanks.”</small></div></div><div class="rowx"><div class="grow muted">Add a comment…</div>' + btn("Comment", "", "sm primary") + "</div>") +
          cd("<b>Milestones</b>", [["Kickoff", "Oct 1", 1], ["Design system", "Oct 20", 1], ["Design handoff", "Nov 20", 0], ["Build complete", "Dec 4", 0], ["Launch", "Dec 12", 0]].map((r) => '<div class="rowx">' + cb(r[2]) + '<div class="grow"><b>' + r[0] + "</b></div><span class='muted'>" + r[1] + "</span></div>").join(""), 1) + "</div>") +
      pane("tl", 0, '<div class="gantt"><div class="g-head" style="grid-template-columns:200px repeat(4,1fr)"><span class="g-l"></span><span>Oct</span><span>Nov</span><span>Dec</span><span>Jan</span></div>' + [["Discovery", 2, 22, "var(--green)"], ["Design", 18, 48, "var(--blue)"], ["Build", 40, 78, "var(--blue)"], ["Launch", 80, 92, "var(--mute)"]].map((r) => '<div class="g-row"><span class="g-l">' + r[0] + '</span><div class="g-track"><i class="g-bar" style="left:' + r[1] + "%;width:" + (r[2] - r[1]) + "%;background:" + r[3] + ';opacity:.35;border-color:' + r[3] + '"></i></div></div>').join("") + "</div>") +
      pane("dl", 0, tbl(["Deliverable", "Status", "Due", "Files", ""], [["Pricing page hero v3", E("SUBMITTED", "purple"), "Nov 14", "3", btn("Review", "", "sm primary")], ["Brand guidelines PDF", E("READY_FOR_REVIEW", "purple"), "Nov 18", "1", btn("Review", "", "sm primary")], ["Homepage wireframes", E("ACCEPTED", "green"), "Nov 5", "2", btn("History", "", "sm")], ["Analytics plan", E("IN_PROGRESS", "blue"), "Nov 25", "—", ""]])) +
      pane("up", 0, '<div class="tl"><div class="ev"><b>On track · Nov 8</b><small>Marco Silva · 1 comment</small></div><div class="ev"><b>Design system delivered · Oct 25</b><small>Marco Silva · 3 comments</small></div></div>') +
      pane("tk", 0, tbl(["Task", "Status", "Due"], [["Pricing page hero", E("IN_REVIEW", "purple"), "Nov 14"], ["Plan cards component", E("IN_PROGRESS", "yellow"), "Nov 18"], ["Annual toggle", E("TODO"), "Nov 20"]]) + '<div class="sub-note">Only tasks with customer_visible = true. Assignees show name only. Customers cannot create or edit tasks: use Requests.</div>') +
      pane("ch", 0, tbl(["Change request", "Status", "Impact", ""], [["Add pricing calculator page", E("AWAITING_APPROVAL", "yellow"), "+ 12 h · + € 1,440 · +4 days", btn("Approve", "check", "sm primary") + btn("Decline", "x", "sm")]]) + '<div class="sub-note">Approval is requested from you only when the agency routes it to the customer (ProjectChangeRequest.status AWAITING_APPROVAL).</div>') +
      pane("cv", 0, '<div class="msgs"><div class="rowx">' + av("MS") + '<div class="grow"><b>Marco Silva</b> <small>10:12</small><br>Uploaded v3 of the hero, ready when you are.</div></div><div class="rowx">' + av("LK") + '<div class="grow"><b>Lena Kovac</b> <small>10:30</small><br>Thanks, reviewing this afternoon.</div></div></div><div class="rowx"><div class="grow muted input-fake">Write a message to the project channel…</div>' + btn("Send", "send", "primary") + "</div>") + "</div>" +
      dm(["Project · ProjectMilestone · ProjectDeliverable · ProjectStatusUpdate(+Comment) · Task.customer_visible · ProjectChangeRequest · Channel (12)"], []));
  }

  /* @screen Customer approvals
     @route  /portal/cp-approvals (customer URL: /approvals)
     @perm   portal.deliverables.approve (list is hidden without it; read-only visibility of accepted history needs portal.projects.read)
     @api    GET /portal/approvals?status= · POST /portal/deliverables/:id/review {decision: ACCEPTED | CHANGES_REQUESTED | REJECTED, comment, criteria[], document_version_ids[]}
     @mcp    portal_deliverables_review (sensitive: human confirmation when an AI agent calls it)
     @data   ProjectDeliverable (status, document_ids, acceptance_record) · ProjectDeliverableReview (decision, comment, reviewer_user_id, reviewer_membership_id, document_version_ids) · ProjectAcceptanceCriterion · DocumentApproval/DocumentApprover (portal_user_id)
     @ui     Split view: list left, review panel right with file preview, Checkbox for criteria, RadioGroup for decision, Textarea (required for changes/reject), Dialog confirm
     @states loading · empty ("Nothing is waiting for you") · saving · decided (toast, row moves to History) · conflict (someone already decided: shows that decision) · error · no-access
     @audit  deliverable.accepted / changes_requested / rejected (portal user actor) + ProjectDeliverableReview row + acceptance_record on ACCEPTED
     @note   Decision values are DeliverableStatus. Comment is required for CHANGES_REQUESTED and REJECTED. The decision applies to the document versions shown (document_version_ids), so a resubmission is a new review. */
  function cpApprovals() {
    return pv("cp-approvals", pvh("Approvals", "Review what Logiqdev submitted and tell us your decision.") +
      '<div class="tabset">' + tabs([["wa", "Waiting for you", 3], ["hi", "History", 11]], "wa") +
      pane("wa", 1, '<div class="g2" style="grid-template-columns:.9fr 1.4fr;align-items:start"><div>' + [["Pricing page hero v3", "Acme Rebrand Website · due Nov 14", 1], ["Brand guidelines PDF", "Acme Rebrand Website · due Nov 18", 0], ["Email template pack", "Acme Lifecycle Emails · due Nov 20", 0]].map((r) => '<div class="rowx selrow' + (r[2] ? " on" : "") + '"><div class="grow"><b>' + r[0] + "</b><small>" + r[1] + "</small></div>" + E("SUBMITTED", "purple") + "</div>").join("") + '<div class="sub-note">Contracts and proposals waiting for you are under Proposals & contracts.</div></div>' +
        "<div>" + cd("<b>Pricing page hero v3</b><span class='r muted'>submitted Nov 8 by Marco Silva</span>", '<div class="cpf-preview">' + I("file", 28) + "<span>pricing-hero-v3.pdf · page 1 of 4</span></div>" + '<div class="rowx"><div class="grow"><b>Checklist</b></div></div>' + [["Headline scale matches brand tokens", 1], ["Plan cards readable at 360 px", 1], ["Annual toggle keeps price visible", 0]].map((r) => '<div class="rowx">' + cb(r[1]) + '<div class="grow">' + r[0] + "</div></div>").join("") +
          f("Your decision", '<div class="rowx" style="gap:8px;padding:0"><span class="seg on">Approve</span><span class="seg">Request changes</span><span class="seg">Reject</span></div>') + f("Comment", '<div class="editor"><div class="ed-bar"><span>B</span><span>I</span></div><div class="ed-body">Required when you request changes or reject.</div></div>') +
          '<div class="rowx"><div class="grow muted">You previously asked for changes on v1 and v2.</div>' + btn("Submit decision", "check", "primary") + "</div>") + "</div></div>") +
      pane("hi", 0, tbl(["Deliverable", "Your decision", "By", "Date", "Comment"], [["Homepage wireframes", E("ACCEPTED", "green"), wh("LK"), "Nov 5", "Looks good"], ["Pricing page hero v2", E("CHANGES_REQUESTED", "yellow"), wh("LK"), "Nov 6", "Keep the monthly price visible"], ["Logo variants", E("REJECTED", "red"), wh("TB"), "Oct 30", "Off brand"]])) + "</div>" +
      dm(["ProjectDeliverable · ProjectDeliverableReview · ProjectAcceptanceCriterion", "ProjectDeliverableApprover · required (who must approve) · ProjectDeliverable.approval_mode", "DocumentApproval · DocumentApprover.portal_user_id"], []));
  }

  /* @screen Customer requests
     @route  /portal/cp-requests (customer URL: /requests, /requests/:reference) · create form is cp-request-new
     @perm   portal.requests.create (list and replies; a Viewer without it does not see the nav item)
     @api    GET /portal/requests?status= · GET /portal/requests/:reference · POST /portal/requests · POST /portal/requests/:id/replies · PATCH /portal/requests/:id (only while unassigned)
     @mcp    portal_requests_create · portal_requests_read
     @data   Ticket (source PORTAL, company_id, requester_user_id, subject, description, type, priority, project_id, change_request_id) · TicketMessage (customer-visible replies only) · TicketTaskLink (status only) · Document attachments (17) · KnowledgeArticle (13 §6)
     @ui     Table, Tabs, Badge, comment composer, file Dropzone
     @states loading · empty ("No requests yet. Create your first.") · error · no-access
     @audit  ticket.created, ticket.replied by the portal user
     @note   Requests are tickets: customers never create Tasks. When the agency converts a request, the customer sees the linked outcome status (Task or Change Request) but not its internal details. Editable only while no assignee. */
  function cpRequests() {
    return pv("cp-requests", pvh("Requests", "Ask for changes, report problems or ask questions.", btn("New request", "plus", "primary")) +
      '<div class="toolbar">' + search("Search your requests") + sel("Status: Open", "filter") + sel("Type: Any") + sel("Project: Any", "folder") + "</div>" +
      tbl(["Ref", "Subject", "Type", "Status", "Priority", "Outcome", "Updated"], [["SUP-2041", ink("CSV export of invoices"), E("FEATURE_REQUEST"), E("NEW", "blue"), E("NORMAL"), "—", "5 h ago"], ["SUP-2036", ink("Logo too small on mobile header"), E("CHANGE_REQUEST"), E("OPEN", "blue"), E("NORMAL"), "Change request · under review", "Yesterday"], ["SUP-2029", ink("Login redirect loop on mobile"), E("BUG"), E("PENDING_CUSTOMER", "yellow") + " <b>Reply needed</b>", E("HIGH", "yellow"), "Fix in progress", "4 days ago"], ["SUP-2011", ink("Staging site down"), E("INCIDENT"), E("CLOSED"), E("URGENT", "red"), "Resolved", "Oct 21"]]) + sp() +
      cd("<b>SUP-2029 · Login redirect loop on mobile</b><span class='r muted'>conversation</span>", '<div class="tl"><div class="ev"><b>Marco Silva (Logiqdev)</b><small>Nov 7 · “Which phone and browser are you using? A screen recording would help.”</small></div><div class="ev"><b>You</b><small>Nov 6 · “After login the page reloads and sends me back to the login screen.”</small></div></div><div class="rowx"><div class="grow input-fake">Reply…</div>' + btn("Attach", "clip", "sm") + btn("Send", "send", "sm primary") + "</div>") + sp() +
      cd("<b>Help articles</b><span class='r muted'>KnowledgeArticle (13 §6)</span>", '<div class="rowx">' + I("book", 14) + '<div class="grow">How to export your invoices</div></div><div class="rowx">' + I("book", 14) + '<div class="grow">Adding people to your portal</div></div>', 1) +
      dm(["Ticket · source PORTAL, subject, type, priority, status category, project_id, change_request_id", "TicketMessage (public) · TicketTaskLink · KnowledgeArticle"], []));
  }

  /* @screen Customer new request
     @route  /portal/cp-request-new (customer URL: /requests/new?project=)
     @perm   portal.requests.create
     @api    POST /portal/requests {type, priority, subject, description, project_id?, document_ids[]} → Ticket (source PORTAL, requester_user_id, company_id taken from the membership, never from the body)
     @mcp    portal_requests_create (AI "draft a request from a description" fills the form, the user submits)
     @data   Ticket (type TicketType, priority TicketPriority, subject, description, project_id, source PORTAL) · Document (uploaded_via_portal) · KnowledgeArticle (suggested deflection)
     @ui     Form: RadioGroup/Select for type, Select for priority and project (projects of the customer only), Markdown editor, Dropzone (uploads to 17 with portal_upload permission), suggestion list
     @states validation inline · submitting · created (redirect to the request, notification to the agency) · error · attachment rejected (type/size)
     @audit  ticket.created
     @note   Type values are TicketType: QUESTION, BUG, FEATURE_REQUEST, CHANGE_REQUEST, BILLING, ACCOUNT, INCIDENT, OTHER. Priority values: LOW, NORMAL, HIGH, URGENT (URGENT is only offered for INCIDENT or per agency SLA rules). */
  function cpRequestNew() {
    return pv("cp-requests", pvh("New request", "Tell us what you need. We reply in your portal and by email.", btn("Cancel") + btn("Submit request", "send", "primary")) +
      '<div class="g2" style="grid-template-columns:1.6fr 1fr;align-items:start"><div>' + cd("<b>What do you need?</b>", f("Type", '<div class="rowx" style="gap:8px;padding:0;flex-wrap:wrap">' + ["Question", "Bug", "Feature request", "Change request", "Billing", "Account", "Incident", "Other"].map((t, i) => '<span class="seg' + (i === 2 ? " on" : "") + '">' + t + "</span>").join("") + "</div>") + f("Subject", box("Short summary")) + f("Description", '<div class="editor"><div class="ed-bar">' + ["B", "I", "•", "Link"].map((x) => "<span>" + x + "</span>").join("") + '</div><div class="ed-body">Describe what you need, what you expected and what happened. Screenshots help.</div></div>') + f("Attachments", '<div class="drop">' + I("clip", 16) + " Drop files or browse · up to 25 MB each</div>")) + "</div><div>" +
      cd("<b>Details</b>", f("Priority", sel("Normal")) + f("Related project", sel("Acme Rebrand Website", "folder"), "Only projects shared with you.") + f("Contact for this request", sel("Lena Kovac (you)", "users"))) + sp() +
      cd("<b>Maybe this helps</b>", '<div class="rowx">' + I("book", 14) + '<div class="grow">How to export your invoices</div></div>', 1) + sp() + callout("sparkles", "<b>Draft with AI</b><br>Describe the problem in your own words and we will fill the form for you. You review before sending.") + "</div></div>" +
      dm(["Ticket · subject, description, type, priority, project_id, source PORTAL, requester_user_id, company_id", "Document · uploaded_via_portal"], []));
  }

  /* @screen Customer proposals and contracts
     @route  /portal/cp-agreements (customer URL: /agreements?tab=proposals|contracts)
     @perm   portal.proposals.read / portal.contracts.read · accept portal.proposals.accept* · sign portal.contracts.sign*
     @api    GET /portal/proposals · POST /portal/proposals/:id/{accept|reject|request-changes|comments} · GET /portal/contracts · POST /portal/contracts/:id/sign (signature flow of 04, in-house e-signature, no external provider)
     @mcp    portal_proposals_read · portal_proposals_accept (sensitive) · portal_contracts_sign (sensitive: never by an AI agent without the human)
     @data   Proposal (status, valid_until, total) · Contract (status, parties, signature_requests) · SignatureRequest (04) · Document · ProposalComment/ContractComment
     @ui     Tabs, Table, Dialog for accept/sign (typed name + MFA re-prompt), PDF viewer
     @states loading · empty · expired (ProposalStatus EXPIRED: read-only) · signed (read-only, certificate download) · error · no-access
     @audit  proposal.accepted/rejected/changes_requested, contract.signed (with signature evidence)
     @note   Statuses are the real ProposalStatus and ContractStatus enums. Sensitive actions re-prompt MFA. */
  function cpAgreements() {
    return pv("cp-agreements", pvh("Proposals & contracts", "Review, comment on and sign.") +
      '<div class="tabset">' + tabs([["pr", "Proposals", 2], ["co", "Contracts", 3]], "pr") +
      pane("pr", 1, tbl(["Proposal", "Status", "Total", "Valid until", ""], [["Mobile App v2 · build and launch", E("SENT", "blue"), "€ 48,000", "Dec 15", btn("Review", "", "sm") + btn("Accept", "check", "sm primary") + gate("portal.proposals.accept")], ["Lifecycle emails · phase 2", E("CHANGES_REQUESTED", "yellow"), "€ 9,500", "Nov 30", btn("Open", "", "sm")], ["Website rebrand", E("ACCEPTED", "green"), "€ 31,200", "—", btn("Download", "", "sm")]])) +
      pane("co", 0, tbl(["Contract", "Status", "Signatures", "Expires", ""], [["MSA renewal 2026", E("READY_FOR_SIGNATURE", "purple"), "1 of 2 · waiting for you", "Dec 31", btn("Sign", "pen", "sm primary") + gate("portal.contracts.sign")], ["Statement of work · Rebrand", E("ACTIVE", "green"), "2 of 2", "Dec 2026", btn("Download", "", "sm")], ["DPA", E("FULLY_SIGNED", "green"), "2 of 2", "—", btn("Download", "", "sm")]])) + "</div>" +
      dm(["Proposal · status · Contract · status · SignatureRequest (04) · Document"], []));
  }

  /* @screen Customer billing
     @route  /portal/cp-billing (customer URL: /billing?tab=invoices|subscriptions|payments|methods)
     @perm   portal.invoices.read · pay portal.invoices.pay* · subscriptions portal.subscriptions.manage*
     @api    GET /portal/invoices?status= · POST /portal/invoices/:id/pay {provider} · GET /portal/subscriptions · POST /portal/subscriptions/:id/{upgrade|downgrade|cancel} · GET /portal/payment-methods
     @mcp    portal_invoices_read · portal_invoices_pay (sensitive)
     @data   Invoice (status InvoiceStatus, number, total, balance, due_date, hosted_invoice_url) · Payment · PaymentMethod · Subscription (status SubscriptionStatus, renewal) · Proposal (origin) · BillingProfile
     @ui     Tabs, Table, Dialog for pay (provider Select when more than one provider accepts the invoice, 08 "Payment Providers"), Badge
     @states loading · empty · payment pending/failed (retry) · error · no-access
     @audit  invoice.viewed, invoice.paid, subscription.changed
     @note   Only invoices already sent (not DRAFT/SCHEDULED/VOID) are visible. Rules and provider behavior belong to 08. Providers are the organization's own keys (BYOK, IntegrationConnection): STRIPE or VIVA_WALLET. */
  function cpBilling() {
    return pv("cp-billing", pvh("Billing", "Invoices, payments and subscriptions.") +
      '<div class="mini-stats">' + stat("Outstanding", "€ 8,420", "2 invoices") + stat("Overdue", "€ 4,200", "1 invoice", 1) + stat("Paid this year", "€ 42,900", "") + stat("Next renewal", "Dec 1", "Maintenance plan") + "</div>" +
      '<div class="tabset">' + tabs([["in", "Invoices", 12], ["su", "Subscriptions", 1], ["pa", "Payment history"], ["me", "Payment methods"]], "in") +
      pane("in", 1, tbl(["Invoice", "Project / origin", "Status", "Due", ">Total", ">Balance", ""], [["INV-2026-0118", "Acme Rebrand · milestone 2", E("OVERDUE", "red"), "Nov 3", "€ 4,200", "€ 4,200", btn("Pay", "dollar", "sm primary") + gate("portal.invoices.pay")], ["INV-2026-0121", "Lifecycle Emails · deposit", E("OPEN", "blue"), "Nov 30", "€ 4,220", "€ 4,220", btn("Pay", "dollar", "sm primary")], ["INV-2026-0112", "Acme Rebrand · milestone 1", E("PAID", "green"), "Oct 20", "€ 4,200", "€ 0", btn("Receipt", "", "sm")], ["INV-2026-0098", "Maintenance plan · Oct", E("PARTIALLY_PAID", "yellow"), "Oct 1", "€ 600", "€ 200", btn("Pay", "", "sm")]])) +
      pane("su", 0, tbl(["Plan", "Status", "Price", "Renews", ""], [["Maintenance plan · Standard", E("ACTIVE", "green"), "€ 600 / month", "Dec 1", btn("Change plan", "", "sm") + btn("Cancel", "x", "sm") + gate("portal.subscriptions.manage")]])) +
      pane("pa", 0, tbl(["Date", "Invoice", "Method", ">Amount", "Status"], [["Oct 20", "INV-2026-0112", "Visa ··4242", "€ 4,200", E("SUCCEEDED", "green")], ["Oct 12", "INV-2026-0098", "SEPA ··1130", "€ 400", E("SUCCEEDED", "green")]])) +
      pane("me", 0, tbl(["Method", "Default", ""], [["Visa ··4242 · exp 08/28", ES("DEFAULT", "blue"), btn("Remove", "x", "sm")], ["SEPA debit ··1130", "", btn("Make default", "", "sm")]]) + btn("Add payment method", "plus", "sm")) + "</div>" +
      dm(["Invoice · status, total, due_date, hosted_invoice_url · Payment · PaymentMethod · Subscription · status"], []));
  }

  /* @screen Customer documents
     @route  /portal/cp-documents (customer URL: /documents?folder=&q=)
     @perm   portal.documents.read · upload portal.documents.upload (only into folders with customer upload allowed and when DocumentSettings.portal_upload_enabled)
     @api    GET /portal/documents?folder=&q= · GET /portal/documents/:id/download · POST /portal/documents {folder_id, file}
     @mcp    portal_documents_read · portal_documents_upload
     @data   Folder (customer_visible, portal upload permission) · Document (customer_visible, uploaded_via_portal, category, version) · DocumentSettings.portal_upload_enabled · DocumentShare (explicit shares)
     @ui     Folder tree + Table, search Input, upload Dropzone, file preview Sheet
     @states loading · empty folder · upload progress / rejected (type, size, virus scan) · error · no-access
     @audit  document.downloaded (sensitive categories audited), document.uploaded via portal
     @note   Shows documents shared with the customer or scoped to a customer-visible project. Versioning, preview and search are 17 features. Uploads are tagged uploaded_via_portal and may need agency review. */
  function cpDocuments() {
    return pv("cp-documents", pvh("Documents", "Files shared with you.", btn("Upload", "plus", "primary") + gate("portal.documents.upload")) +
      '<div class="g2" style="grid-template-columns:.7fr 1.6fr;align-items:start">' + cd("<b>Folders</b>", ["Acme Rebrand Website", "Brand assets", "Contracts", "Invoices", "Meeting notes", "Release notes"].map((t, i) => '<div class="rowx selrow' + (i === 1 ? " on" : "") + '">' + I("folder", 14) + '<div class="grow">' + t + "</div></div>").join(""), 1) +
      "<div>" + '<div class="toolbar">' + search("Search documents") + sel("Type: Any", "filter") + sel("Sort: Updated ↓", "sort") + "</div>" +
      tbl(["Name", "Category", "Version", "Size", "Updated", ""], [["Brand guidelines v4.pdf", "Specification", "v4", "6.2 MB", "Nov 8", btn("Download", "", "sm")], ["Logo pack.zip", "Design asset", "v2", "18 MB", "Nov 2", btn("Download", "", "sm")], ["Meeting notes · kickoff.md", "Meeting notes", "v1", "12 KB", "Oct 1", btn("Open", "", "sm")], ["Brief from Acme.docx", "Brief · uploaded by you", "v1", "320 KB", "Sep 28", btn("Open", "", "sm")]]) + '<div class="drop" style="margin-top:10px">' + I("clip", 16) + " Drop files here to upload to Brand assets</div></div></div>" +
      dm(["Folder · customer_visible · Document · customer_visible, uploaded_via_portal · DocumentSettings · portal_upload_enabled"], []));
  }

  /* @screen Customer messages
     @route  /portal/cp-messages (customer URL: /messages/:channel)
     @perm   portal.conversations.participate
     @api    GET /portal/channels · GET /portal/channels/:id/messages · POST /portal/channels/:id/messages {body, attachments[]}
     @mcp    portal_conversations_participate
     @data   Channel (customer channel per project, 12 §27, with external participants) · ChannelMember (portal membership) · Message · MessageReaction · ChannelReadState · Document attachments
     @ui     Channel list + thread view, rich-text composer with mentions (agency people only by name), file Dropzone, unread badges
     @states loading · empty channel · sending · failed (retry) · error · no-access
     @audit  message.posted by the portal user
     @note   Internal channels and internal messages are never visible (12 §28). Support conversations (13) are separate from project channels and live under Requests / live chat widget. */
  function cpMessages() {
    return pv("cp-messages", pvh("Messages", "Project conversations with the Logiqdev team.") +
      '<div class="g2" style="grid-template-columns:.7fr 1.8fr;align-items:start">' + cd("<b>Channels</b>", [["# acme-rebrand", 2, 1], ["# acme-lifecycle-emails", 0, 0], ["# mobile-app-kickoff", 0, 0]].map((r) => '<div class="rowx selrow' + (r[2] ? " on" : "") + '"><div class="grow">' + r[0] + "</div>" + (r[1] ? '<span class="badge blue">' + r[1] + "</span>" : "") + "</div>").join("") + '<div class="sub-note" style="padding:8px 12px">Only channels shared with Acme Corp.</div>', 1) +
      cd("<b># acme-rebrand</b><span class='r muted'>4 people from Logiqdev · 3 from Acme</span>", '<div class="msgs"><div class="rowx">' + av("AM") + '<div class="grow"><b>Anna Meyer</b> <small>Yesterday 17:20</small><br>Call moved to 10:00 tomorrow.</div></div><div class="rowx">' + av("MS") + '<div class="grow"><b>Marco Silva</b> <small>10:12</small><br>Uploaded v3 of the hero, ready when you are. <span class="badge purple">Deliverable · Pricing page hero v3</span></div></div><div class="rowx">' + av("LK") + '<div class="grow"><b>Lena Kovac</b> <small>10:30</small><br>Thanks, reviewing this afternoon.</div></div></div><div class="rowx"><div class="grow input-fake">Message #acme-rebrand</div>' + btn("Attach", "clip", "sm") + btn("Send", "send", "primary") + "</div>") + "</div>" +
      dm(["Channel · customer channel (12 §27) · ChannelMember · Message · ChannelReadState"], []));
  }

  /* @screen Customer company and team
     @route  /portal/cp-team (customer URL: /company?tab=profile|team|notifications)
     @perm   portal.users.manage* for Team (invite, change role, deactivate); Profile editing needs portal.users.manage or portal.settings.manage (Owner/Administrator); every user can edit their own preferences
     @api    GET /portal/company · POST /portal/company/profile-changes {changes} → CustomerPortalProfileChangeRequest (or an immediate CRM write when AUTO_APPLIED) · GET/POST /portal/team · PATCH /portal/team/:membershipId · GET/PATCH /portal/me/preferences
     @mcp    portal_users_manage (sensitive)
     @data   CrmCompany/CrmContact (edited through) · CustomerPortalProfileChangeRequest (status, changes, review_note) · CustomerPortalMembership · Invitation (customer_id) · NotificationPreference (14 §6) · User (language, time zone)
     @ui     Tabs, Form with Input/Select, diff banner "Waiting for approval", Table, Dialog for invite, Switch for notification channels
     @states validation · saving · "Submitted for approval" (PENDING) or "Saved" (AUTO_APPLIED) · rejected with review_note shown · error · no-access
     @audit  portal.profile_change_requested, membership.role_assigned, invitation.created by the customer user
     @note   Owners/Administrators manage their own company's users within the roles Logiqdev allows (customer roles only; never agency roles). Company edits go through the agency approval policy
             (CustomerPortalSettings.profile_changes_require_approval). The last Customer Owner cannot be removed. */
  function cpTeam() {
    return pv("cp-team", pvh("Company & team", "Your company details and who has access.", btn("Invite colleague", "plus", "primary") + gate("portal.users.manage")) +
      '<div class="tabset">' + tabs([["pf", "Company profile"], ["tm", "Team", 6], ["nt", "My preferences"]], "pf") +
      pane("pf", 1, callout("clock", "<b>1 change waiting for approval.</b> Logiqdev will review your billing address and VAT number. Until then the current details stay in place.", "warn") + sp(8) +
        '<div class="g2">' + cd("<b>Company</b>", f("Legal name", box("Acme Corporation GmbH")) + f("Billing address", box("Hauptstr. 12, 10115 Berlin") + '<div class="sub-note"><span class="old">Hauptstr. 12</span> → <span class="new">Königsallee 88</span> pending</div>') + f("VAT number", box("DE812345678")) + f("Website", box("acme.example")) + btn("Submit changes", "check", "primary")) +
        cd("<b>Primary contact</b>", f("Name", box("Lena Kovac")) + f("Phone", box("+49 30 5550 1234")) + f("Job title", box("Head of Marketing")) + '<div class="sub-note">Writes go to your customer record at Logiqdev.</div>') + "</div>") +
      pane("tm", 0, tbl(["Person", "Role", "Status", "Last active", ""], [[wh("LK", "you"), role("customer-owner"), ES("ACTIVE", "green"), "Now", ""], [wh("TB"), role("customer-finance"), ES("ACTIVE", "green"), "Yesterday", more], [wh("RO"), role("customer-legal"), ES("ACTIVE", "green"), "5 days ago", more], [who("MK", "r", "m.krause@acme.example", "invited"), role("customer-manager"), ES("INVITED", "blue"), "—", more]])) +
      pane("nt", 0, tbl(["Event", "In-app", "Email", "SMS (opt-in)"], [["Approval requests", sw(1), sw(1), sw(0)], ["New messages", sw(1), sw(0), sw(0)], ["Invoices and payments", sw(1), sw(1), sw(0)], ["Request updates", sw(1), sw(1), sw(0)]]) + f("Language", sel("English", "globe")) + f("Time zone", sel("Europe/Berlin", "clock"))) + "</div>" +
      dm(["CrmCompany/CrmContact (via CustomerPortalProfileChangeRequest) · CustomerPortalMembership · Invitation · NotificationPreference · User (language, time zone)"], []));
  }

  const MAP = { dashboard, clients, enable, client, users, user, invitations, invite, requests, approvals, approval, profile, access, branding, settings, activity,
    "cp-dashboard": cpDashboard, "cp-projects": cpProjects, "cp-project": cpProject, "cp-approvals": cpApprovals, "cp-requests": cpRequests, "cp-request-new": cpRequestNew, "cp-agreements": cpAgreements, "cp-billing": cpBilling, "cp-documents": cpDocuments, "cp-messages": cpMessages, "cp-team": cpTeam };
  const CRUMB = { client: "Acme Corp", user: "Tom Becker", approval: "Pricing page hero v3", "cp-dashboard": "Preview as customer", "cp-projects": "Preview as customer", "cp-project": "Preview as customer", "cp-approvals": "Preview as customer", "cp-requests": "Preview as customer", "cp-request-new": "Preview as customer", "cp-agreements": "Preview as customer", "cp-billing": "Preview as customer", "cp-documents": "Preview as customer", "cp-messages": "Preview as customer", "cp-team": "Preview as customer" };
  window.VIEWS.portal = { html: function (s) { return (MAP[s || "dashboard"] || MAP.dashboard)(s); }, crumb: function (s) { return CRUMB[s] || ""; }, fill: false };
})();
