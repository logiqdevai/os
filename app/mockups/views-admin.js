/* =====================================================================================================================
   ADMIN APP — module 01 (docs/features/01-users-organizations-permissions.md)
   =====================================================================================================================
   SCHEMA-ALIGNED to api/prisma/schema.prisma (incl. the additions of migration 20261111130000_module_01_access_reviews_and_gaps):
   every status/type is a real enum value (shown title-cased, raw value in the tooltip), permission keys come from
   api/prisma/seed/permission-catalog.ts, role names from ROLE_TEMPLATES, audit event types from
   api/src/shared/constants/audit-event-types.ts.

   HOW TO READ THE COMMENTS (full legend in README.md). Every screen function has a contract block, and notable elements carry
   inline @impl comments, using these tags:
     @route   production route (mock "#admin/<sub>" = "/admin/<sub>")
     @perm    VIEW = who may open the screen, ACTION = per control. Always checked by the central authorization service (01 §136);
              the UI hides/disables from the permission check result, never from the role name. 403/404 -> no-access state.
     @api     proposed REST endpoints. The organization ALWAYS comes from the credential/session, never from URL or body.
              Lists are filtered server-side by the caller's branch/team scope.
     @mcp     MCP tool `<module>_<resource>_<action>` per agent-useful action (thin adapter over the same service as REST).
     @data    Prisma models/fields read or written.   @ui  shadcn components to use.   @states  states to build.
     @audit   AuditEvent.event_type values to write.   @note  behavior/traps.   @gap  UI needs something the schema cannot back yet.

   MOCK-ONLY (do not ship): the helper functions below, `window.AD`, inline onclick handlers, sample arrays, the "Data model" footer (dm()).
   ===================================================================================================================== */
(function () {
  const I = (n, s) => LQ.icon(n, s);
  const AV = LQ.av;

  /* ---------- helpers ----------
     @impl en(v)/E()/ES()/S(): turn an ENUM value into a Badge. Production: ONE shared `enumLabel(enumName, value)` map (i18n-ready) and a
       `statusVariant(enumName, value)` map (green/blue/yellow/red/neutral) so every screen renders the same status the same way.
       Keep the raw enum value for filters and the API; only the label is localized. */
  const en = (v) => { const t = String(v).toLowerCase().replace(/_/g, " "); return t.charAt(0).toUpperCase() + t.slice(1); };
  const E = (v, c) => '<span class="badge ' + (c || "") + '" title="' + v + '">' + en(v) + "</span>";
  const ES = (v, c) => '<span class="badge ' + (c || "") + '" title="' + v + '"><span class="dot"></span>' + en(v) + "</span>";
  const MC = { ACTIVE: "green", PUBLISHED: "green", VERIFIED: "green", ACCEPTED: "green", COMPLETED: "green", CERTIFIED: "green", PENDING: "blue", INVITED: "blue", SCHEDULED: "blue", IN_PROGRESS: "blue", MODIFIED: "yellow", DRAFT: "yellow", PLANNED: "blue", PENDING_VERIFICATION: "yellow", SUSPENDED: "red", ERROR: "red", LOCKED: "red", OPEN: "blue", WON: "green", LOST: "red", ABANDONED: "", NO_SHOW: "red", REVOKED: "red", FAILED: "red", CANCELLED: "", EXPIRED: "", DEPRECATED: "", DEACTIVATED: "", REJECTED: "red", ARCHIVED: "", TEMPORARILY_CLOSED: "yellow" };
  const S = (v) => ES(v, MC[v] || "");
  /* @impl head(): page header = shadcn-style PageHeader (h1, description, primary actions right). Actions are gated individually by permission. */
  const head = (t, p, a) => '<div class="a-head"><div><h1>' + t + "</h1>" + (p ? "<p>" + p + "</p>" : "") + '</div><div class="acts">' + (a || "") + "</div></div>";
  /* @impl btn(): shadcn Button. Icon on the left, label text. Variants: default(primary) | outline | ghost. Destructive actions (Suspend, Offboard, Revoke) use
       `variant="destructive"` in production and open an AlertDialog that states the consequence and asks for confirmation (and a reason when audited). */
  const btn = (t, ic, cls) => '<button class="btn ' + (cls || "") + '">' + (ic ? I(ic, 14) : "") + t + "</button>";
  /* @impl cd(): shadcn Card (CardHeader + CardContent). `flush` = no padding, used when the card contains a Table or a row list. */
  const cd = (h, b, flush) => '<div class="cd">' + (h ? '<div class="cd-h">' + h + "</div>" : "") + '<div class="cd-b' + (flush ? " flush" : "") + '">' + b + "</div></div>";
  /* @impl sw(): shadcn Switch. In production it is controlled, optimistic with rollback on API error, and disabled when the caller lacks the manage permission. */
  const sw = (on) => '<span class="sw ' + (on ? "on" : "") + '"></span>';
  const chk = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  /* @impl cb(): shadcn Checkbox; state "mix" = `checked="indeterminate"` (group row whose children are partly selected). */
  const cb = (s) => '<span class="cb ' + (s === "mix" ? "mix" : s ? "on" : "") + '">' + (s === "mix" ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M6 12h12"/></svg>' : s ? chk : "") + "</span>";
  /* @impl sel(): shadcn Select (fixed small list) or Combobox = Popover + Command (searchable lists: members, branches, resources). NEVER a native <select> (app/AGENTS.md). */
  const sel = (t, ic) => '<div class="sel">' + (ic ? I(ic, 14) : "") + "<span>" + t + "</span>" + I("down", 14) + "</div>";
  /* @impl fld(): form field = label + control + optional hint/error (shadcn Form: FormField/FormLabel/FormMessage with react-hook-form + zod). */
  const fld = (l, h) => '<div class="fld"><label>' + l + "</label>" + h + "</div>";
  const stat = (l, v, s, neg) => '<div class="stat"><small>' + l + "</small><strong>" + v + "</strong><span" + (neg ? ' class="neg"' : "") + ">" + s + "</span></div>";
  /* @impl search(): shadcn Input with a search icon; debounce 250ms, sync to ?q= in the URL; server-side search (never filter only the loaded page). */
  const search = (ph) => '<div class="search-in">' + I("search", 14) + "<span>" + ph + "</span></div>";
  const who = (a, c, n, s, sz) => '<div class="who">' + AV(a, c, sz || "") + "<div><b>" + n + "</b>" + (s ? "<small>" + s + "</small>" : "") + "</div></div>";
  const tok = (t) => '<span class="tok">' + t + "</span>";
  const kv = (k, v) => '<div class="kvr"><span>' + k + "</span><b>" + v + "</b></div>";
  const muted = (t) => '<span class="muted">' + t + "</span>";
  /* @impl more(): row actions = shadcn DropdownMenu (kebab). Each item is gated by its own permission and destructive ones open an AlertDialog. */
  const more = '<button class="btn ghost sm icon">' + I("more", 15) + "</button>";
  const callout = (ic, t, cls) => '<div class="callout ' + (cls || "") + '">' + I(ic, 16) + "<div>" + t + "</div></div>";
  const keyc = (k) => '<span class="key">' + k + "</span>";
  /* "Data model" footer: models/fields the screen reads + gaps where the UI needs data the schema does not have.
     @impl REVIEW-ONLY: do not ship. It exists so a reviewer can check the screen against schema.prisma at a glance. */
  const dm = (models, gaps) => '<div class="dm"><div class="dm-h">' + I("box", 14) + "<b>Data model</b><span>api/prisma/schema.prisma</span></div>" +
    '<div class="dm-b"><div><h6>Reads</h6>' + models.map((m) => "<div>" + m + "</div>").join("") + "</div>" +
    (gaps && gaps.length ? '<div><h6 class="gap">Not backed by schema</h6>' + gaps.map((g) => "<div>" + g + "</div>").join("") + "</div>" : "") + "</div></div>";

  /* ModuleKey enum (19 values) with display labels.
     @impl Single source of truth in production: a `MODULE_LABELS: Record<ModuleKey, string>` shared by the app and the API (also used by role editor, invitations,
       module access, access reviews and the rail's visibility rule). Labels here are the product names used in the app. */
  const MOD = [["CRM", "CRM"], ["PROPOSALS", "Proposals"], ["CONTRACTS", "Contracts"], ["PROJECTS", "Projects"], ["TASKS", "Tasks"], ["CUSTOMER_PORTAL", "Customer portal"], ["FINANCE", "Billing & finance"], ["INCOME_EXPENSE", "Income & expenses"], ["EMPLOYEES", "Employees"], ["COMMUNICATION", "Communication (campaigns)"], ["MESSAGING", "Messaging"], ["SUPPORT", "Support"], ["NOTIFICATIONS", "Notifications"], ["BUSINESS_DOCS", "Business docs"], ["DOCUMENTS", "Documents & files"], ["TIME_TRACKING", "Time tracking"], ["CALENDAR", "Calendar"], ["AUTOMATION", "Automation"], ["ADMINISTRATION", "Administration"]];
  const modLabel = (k) => (MOD.find((m) => m[0] === k) || [k, k])[1];

  /* local tab switching.
     @impl shadcn Tabs. When a tab changes WHAT is loaded (not just what is visible) sync it to the URL (?tab=) so it is linkable and survives reload;
       lazy-load the tab's data on first open. */
  window.AD = { tab: function (b, pane) { const root = b.closest(".tabset"); root.querySelectorAll(".tabs-line button").forEach((x) => x.classList.toggle("on", x === b)); root.querySelectorAll(":scope > .pane").forEach((p) => p.classList.toggle("on", p.dataset.pane === pane)); } };
  const tabs = (arr, on) => '<div class="tabs-line">' + arr.map((t) => '<button class="' + (t[0] === on ? "on" : "") + '" onclick="AD.tab(this,\'' + t[0] + "')\">" + t[1] + (t[2] ? '<span class="count" style="margin-left:2px">' + t[2] + "</span>" : "") + "</button>").join("") + "</div>";
  const pane = (id, on, h) => '<div class="pane ' + (on ? "on" : "") + '" data-pane="' + id + '">' + h + "</div>";
  /* MOCK-ONLY: share the small UI helpers with the other app mock files (views-crm.js ...). Production uses the shadcn components listed in README.md instead. */
  window.UI = { en, E, ES, S, head, btn, cd, sw, cb, sel, fld, stat, search, who, tok, kv, muted, more, callout, keyc, dm, tabs, pane, modLabel };

  /* =====================================================================================================================
     OVERVIEW (spec §141)
     @route  /admin
     @perm   VIEW any of users.members.read | organizations.audit.read | organizations.security.manage. Each card is shown only if the caller may see its data
             (e.g. the Security card needs organizations.security.manage, the changes list needs organizations.audit.read).
     @api    GET /admin/overview  (one aggregate call: counts, security posture, module enablement, recent sensitive events, active access review)
     @mcp    organizations_audit_read (recent changes); counts are not exposed as an MCP tool
     @data   Membership(status) counts · Invitation(status=PENDING, expires_at) · Branch(status) · Team(kind) · User.mfa_enabled · OrganizationSecurityPolicy ·
             OrganizationModule · AuditEvent (sensitive types only) · AccessReview + AccessReviewItem (status IN_PROGRESS)
     @ui     Card, Progress, Badge, Alert; skeleton per card (cards load independently so one slow query does not block the page)
     @states loading per card · empty (new org: show the onboarding checklist instead, §129) · error per card · no-access per card
     @note   Counts are SCOPED: a Branch Admin sees only their branches' numbers. "MFA coverage" = share of ACTIVE memberships whose User.mfa_enabled is true.
             Module enablement shows OrganizationModule only; usage analytics (adoption %) belong to a reporting module, not module 01.
     ===================================================================================================================== */
  function overview() {
    const on = ["PROJECTS", "TASKS", "TIME_TRACKING", "CALENDAR", "MESSAGING", "CRM", "SUPPORT", "DOCUMENTS", "BUSINESS_DOCS", "NOTIFICATIONS", "ADMINISTRATION", "PROPOSALS", "CONTRACTS", "FINANCE"];
    /* event_type values are the canonical catalog names (api/src/shared/constants/audit-event-types.ts) */
    const chg = [
      ["membership.admin_promoted", "Elena Papadaki promoted to Admin", "Petros R. · 2h ago", "yellow"],
      ["membership.role_assigned", "Marco Silva → Developer (Organization)", "Anna Meyer · yesterday", ""],
      ["user.mfa_disabled", "Sofia Jensen disabled TOTP", "Sofia Jensen · yesterday", "red"],
      ["organization.module_enabled", "COMMUNICATION enabled", "Petros R. · 3d ago", ""],
    ];
    return '<div class="a-page">' + head("Admin overview", "Health of your organization: people, structure, access and security (§141).") +
      /* @impl KPI cards: shadcn Card. Each number links to the filtered list (e.g. Pending invitations -> /admin/invitations?status=PENDING). */
      '<div class="mini-stats">' + stat("Active members", 24, "Membership.status = ACTIVE") + stat("Pending invitations", 3, "1 expires in 2 days", 1) + stat("Branches", 6, "1 planned") + stat("Teams", 9, "6 departments") + stat("Admins", 3, "1 without MFA", 1) + stat("Suspended", 1, "Membership") + "</div>" +
      '<div class="g2">' +
      /* @impl Security card: reads OrganizationSecurityPolicy + User.mfa_enabled counts. The warning Alert comes from audit event user.mfa_disabled for an admin;
           its link opens the member. Hide the whole card without organizations.security.manage. */
      cd("<b>Security status</b><span class='r'><span class='badge yellow'>Needs attention</span></span>",
        '<div class="kvr"><span>Members with MFA (User.mfa_enabled)</span><b>20 of 24 · 83%</b></div><div class="meter y"><i style="width:83%"></i></div>' +
        '<div class="kvr" style="margin-top:8px"><span>Admins with MFA</span><b>2 of 3</b></div><div class="meter r"><i style="width:66%"></i></div>' +
        '<div style="margin-top:8px">' + kv("MFA policy", E("REQUIRED_FOR_ADMINS")) + kv("SSO required", "No · no SsoConfiguration enabled") + kv("Password", "min 12 chars · symbols required") + kv("Session", "14 days · idle 120 min") + "</div>" +
        callout("shield", "<b>Sofia Jensen disabled TOTP yesterday.</b> Policy requires MFA for admins. <a style='text-decoration:underline'>Review</a>", "warn")) +
      /* @impl Module enablement: OrganizationModule rows for all 19 ModuleKey values. Link to /admin/modules (needs organizations.modules.manage* to toggle). */
      cd("<b>Module enablement</b><span class='r muted'>OrganizationModule · 19 ModuleKey values</span>", MOD.map((m) => '<div style="display:flex;align-items:center;gap:10px;padding:3px 0"><span style="flex:1">' + m[1] + "</span>" + (on.includes(m[0]) ? '<span class="badge green">Enabled</span>' : '<span class="badge">Disabled</span>') + "</div>").join("")) +
      /* @impl Recent permission changes: last ~5 AuditEvent rows whose event_type is flagged `sensitive` in the audit catalog. Requires organizations.audit.read. */
      cd("<b>Recent permission changes</b><span class='r'>" + btn("View audit log", "", "ghost sm") + "</span>", chg.map((c) => '<div class="rowx"><span class="badge key ' + c[3] + '" style="min-width:196px;justify-content:center">' + c[0] + '</span><div class="grow"><b>' + c[1] + "</b><small>" + c[2] + "</small></div></div>").join(""), 1) +
      /* @impl Access review card: the IN_PROGRESS AccessReview (if any). Progress = AccessReviewItem rows with decision != PENDING / total. Needs organizations.access_reviews.read. */
      cd("<b>Access review · Q4 2026</b><span class='r'>" + S("IN_PROGRESS") + "</span>", '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>14 of 24 members decided</span><b class="ink">58%</b></div><div class="meter"><i style="width:58%"></i></div>' + kv("Due", "Dec 15") + kv("Reviewers", "Branch managers (3)") + kv("Revoke decisions", "2 members") + btn("Continue review", "check", "sm")) + "</div>" +
      dm(["Membership · status, type, joined_at", "User · status, mfa_enabled", "OrganizationSecurityPolicy · mfa_policy, password_*, session_*", "OrganizationModule · module, enabled", "Branch · status · Team · kind", "AuditEvent · event_type, actor_type, created_at", "AccessReview · status, due_at · AccessReviewItem · decision"], ["Module usage analytics (adoption %) belong to a reporting module, so only enablement is shown"]) + "</div>";
  }

  /* =====================================================================================================================
     MEMBERS (spec §24, §106)
     @route  /admin/members?q=&role=&branch=&team=&status=&type=&sort=&cursor=  ·  tab ?tab=members|customers|external
     @perm   VIEW users.members.read · ACTION invite users.members.invite · suspend/reactivate users.members.manage* · offboard users.members.offboard* ·
             external collaborators users.external_collaborators.manage* · customer portal users portal.users.manage*  (* = sensitive)
     @api    GET /members?...  ·  GET /portal-users?customer_id=  ·  POST /members/export (writes data.exported)
     @mcp    users_members_read, users_members_invite, users_members_manage (sensitive: needs human confirmation when an AI agent calls it)
     @data   Membership (type, status, provisioning_source, job_title, last_active_at) + User (display_name, email, mfa_enabled) + RoleAssignment->Role (several per member)
             + MembershipBranch (is_primary, include_children) + TeamMembership (team_role, is_lead). Customers tab: CustomerPortalMembership (customer_id, role, status).
     @ui     Table (server-side pagination/sort), row checkboxes + bulk-action bar, DropdownMenu (row actions), Select/Command filters, Tabs, Badge, Avatar
     @states loading skeleton rows · empty ("No members match") · error · no-access
     @note   LIST IS SCOPED: a caller with only a BRANCH-scoped role sees only members of those branches (MembershipBranch). The "Roles" cell is derived from RoleAssignment
             (a member can hold several, with different scopes). Whole row is a link to /admin/members/:id; checkbox and kebab must stop propagation.
             "Off" MFA pill = User.mfa_enabled false. Never show HR data here (salary etc.); it lives in Employees (10) behind its own permissions.
     ===================================================================================================================== */
  /* name, ini, color, email, job_title, MembershipType, MembershipStatus, ProvisioningSource, primary branch, team (team_role), roles, last_active, mfa */
  const M = [
    ["Petros Rodinos", "PR", "", "petros@logiqdev.example", "Founder", "INTERNAL", "ACTIVE", "MANUAL", "Athens", "Management · Lead", "Owner", "Now", 1],
    ["Anna Meyer", "AM", "", "anna@logiqdev.example", "Delivery Lead", "INTERNAL", "ACTIVE", "MANUAL", "Athens +1", "Delivery · Lead", "Project Manager, Branch Admin", "2m", 1],
    ["Marco Silva", "MS", "g", "marco@logiqdev.example", "Senior Developer", "INTERNAL", "ACTIVE", "MANUAL", "Athens", "Engineering", "Developer", "14m", 1],
    ["Sofia Jensen", "SJ", "y", "sofia@logiqdev.example", "Product Designer", "INTERNAL", "ACTIVE", "MANUAL", "Thessaloniki", "Design", "Employee", "1h", 0],
    ["Jon Kim", "JK", "r", "jon@logiqdev.example", "Mobile Developer", "INTERNAL", "ACTIVE", "BULK_IMPORT", "Thessaloniki", "Mobile squad", "Developer", "3h", 1],
    ["Kim Lund", "KL", "p", "kim@logiqdev.example", "Support Lead", "INTERNAL", "ACTIVE", "MANUAL", "Athens", "Support · Lead", "Support Agent", "5h", 1],
    ["Elena Papadaki", "EP", "", "elena@logiqdev.example", "Finance Lead", "INTERNAL", "ACTIVE", "MANUAL", "Athens", "Finance · Lead", "Admin", "Yesterday", 1],
    ["Nikos Georgiou", "NG", "g", "nikos@logiqdev.example", "Sales Manager", "INTERNAL", "ACTIVE", "INVITATION_LINK", "Limassol", "Sales · Lead", "Sales Manager", "Yesterday", 0],
    ["Dana Ortiz", "DO", "y", "dana@logiqdev.example", "Marketing Specialist", "INTERNAL", "INVITED", "MANUAL", "Athens", "—", "Employee", "—", 0],
    ["Tom Becker", "TB", "r", "tom@partner.example", "Freelance PM", "EXTERNAL_COLLABORATOR", "ACTIVE", "INVITATION_LINK", "—", "Web squad (guest)", "External Collaborator", "3d", 1],
    ["Ivan Petrov", "IP", "p", "ivan@logiqdev.example", "Developer", "INTERNAL", "SUSPENDED", "MANUAL", "Thessaloniki", "Engineering", "Developer", "12d", 0],
  ];
  const roleTone = (r) => (["Owner", "Admin"].includes(r) ? "purple" : ["Project Manager", "Sales Manager", "Branch Admin"].includes(r) ? "blue" : "");
  function members() {
    const cu = [["Lena Kovac", "LK", "p", "lena@acme.example", "Acme Corp", "CUSTOMER_OWNER", "ACTIVE", "2m"], ["Daniel Ortiz", "DO", "g", "daniel@globex.example", "Globex", "CUSTOMER_FINANCE", "ACTIVE", "14m"], ["Priya Nair", "PN", "", "priya@initech.example", "Initech", "CUSTOMER_MANAGER", "ACTIVE", "1d"], ["Tom Becker", "TB", "y", "tom@northwind.example", "Northwind", "CUSTOMER_VIEWER", "INVITED", "—"]];
    return '<div class="a-page">' + head("Members", "People with access to Logiqdev. A Membership links one global User to this organization (§24).", btn("Import CSV", "") + btn("Export", "") + lnk("Invite member", "plus", "primary", "invitenew")) +
      '<div class="tabset">' + tabs([["m", "Members", 24], ["c", "Customer portal users", 18], ["x", "External & guests", 3]], "m") +
      pane("m", 1,
        /* @impl Filter bar: each filter is a shadcn Popover+Command (multi-select) writing to the query string. "Scope: Entire organization" mirrors the active branch context
             of the session (UserSession.active_branch_ids): it is informational, the server applies it. */
        '<div class="toolbar">' + search("Search name or email…") + '<button class="btn">' + I("filter", 14) + ' Role</button><button class="btn">' + I("building", 14) + ' Branch</button><button class="btn">' + I("people", 14) + ' Team</button><button class="btn">Status</button><button class="btn">Type</button><span style="flex:1"></span><span class="sub-note">Scope: Entire organization</span></div>' +
        /* @impl Table columns map 1:1 to the data above. Sort server-side by display_name, joined_at, last_active_at. Row click -> member detail. Bulk actions (when rows are checked): change role, add to team, suspend, export. */
        '<div class="panel" style="margin-top:0"><div class="tbl-scroll"><table><thead><tr><th style="width:28px">' + cb(0) + "</th><th>Member</th><th>Job title</th><th>Roles</th><th>Type</th><th>Status</th><th>Primary branch</th><th>Team</th><th>MFA</th><th>Last active</th><th></th></tr></thead><tbody>" +
        M.map((m) => '<tr class="clk" onclick="location.hash=\'#admin/member\'"><td>' + cb(0) + "</td><td>" + who(m[1], m[2], m[0], m[3]) + "</td><td>" + m[4] + "</td><td>" + m[10].split(", ").map((r) => '<span class="badge ' + roleTone(r) + '">' + r + "</span>").join(" ") + "</td><td>" + (m[5] === "INTERNAL" ? muted("Internal") : E(m[5], "yellow")) + "</td><td>" + S(m[6]) + "</td><td>" + m[8] + "</td><td>" + m[9] + "</td><td>" + (m[12] ? '<span style="color:var(--green)">' + I("shield", 15) + "</span>" : '<span class="badge yellow">Off</span>') + '</td><td class="muted">' + m[11] + "</td><td>" + more + "</td></tr>").join("") +
        "</tbody></table></div></div>") +
      /* @impl Customer portal users tab: CustomerPortalMembership rows (NOT Membership). Needs portal.users.manage*. Inviting here creates an Invitation with audience CUSTOMER_PORTAL + customer_id. */
      pane("c", 0, callout("globe", "<b>Customer portal users</b> are " + keyc("CustomerPortalMembership") + " rows: a User linked to a customer company (CRM Company) with a CUSTOMER_PORTAL role (§79).") + '<div class="panel" style="margin-top:12px"><table><thead><tr><th>User</th><th>Customer</th><th>Role</th><th>Status</th><th>Last active</th></tr></thead><tbody>' + cu.map((c) => "<tr><td>" + who(c[1], c[2], c[0], c[3]) + "</td><td>" + c[4] + "</td><td>" + E(c[5]) + "</td><td>" + S(c[6]) + '</td><td class="muted">' + c[7] + "</td></tr>").join("") + "</tbody></table></div>") +
      /* @impl External tab: Membership.type EXTERNAL_COLLABORATOR | GUEST. Access = RoleAssignment with scope RESOURCE and valid_until (shown as "Valid until"). Needs users.external_collaborators.manage*.
           @audit external_collaborator.added */
      pane("x", 0, callout("link", "<b>External collaborators and guests</b> are Memberships with type EXTERNAL_COLLABORATOR or GUEST. Their access comes from role assignments with scope RESOURCE and an optional " + keyc("valid_until") + " (§77–78).") + '<div class="panel" style="margin-top:12px"><table><thead><tr><th>Member</th><th>Type</th><th>Role</th><th>Scope</th><th>Valid until</th></tr></thead><tbody><tr><td>' + who("TB", "r", "Tom Becker", "tom@partner.example") + "</td><td>" + E("EXTERNAL_COLLABORATOR", "yellow") + "</td><td>External Collaborator</td><td>" + E("RESOURCE") + " · Acme Rebrand Website</td><td>Jan 31, 2027</td></tr></tbody></table></div>") + "</div>" +
      dm(["Membership · type, status, provisioning_source, job_title, last_active_at", "User · email, display_name, mfa_enabled", "RoleAssignment → Role (one row per assigned role)", "MembershipBranch (is_primary, include_children) · TeamMembership (team_role, is_lead)", "CustomerPortalMembership · status, role, customer_id"], ["The “Roles” column is derived from RoleAssignment, since a member can hold several"]) + "</div>";
  }

  /* =====================================================================================================================
     MEMBER DETAIL (spec §107) + EFFECTIVE PERMISSIONS (spec §108)
     @route  /admin/members/:membershipId?tab=access|permissions|sessions|activity
     @perm   VIEW users.members.read · assign/remove roles users.roles.assign* · grants/denies users.permissions.grant* · per-member module access users.members.manage* ·
             suspend users.members.manage* · offboard users.members.offboard* · effective permissions users.permissions.read · sessions users.sessions.read* / users.sessions.revoke*
             HR fields (compensation, national id) are FIELD-LEVEL (employees.compensation.read etc.): hide, do not mask with asterisks.
     @api    GET /members/:id · GET /members/:id/access (assignments, grants, module access, branches, teams) · GET /members/:id/effective-permissions?scope_type=&scope_id=
             POST /members/:id/role-assignments {role_id, scope_type, scope_id, valid_until, reason} · DELETE /role-assignments/:id
             POST /members/:id/permission-grants {permission_key, effect, scope, valid_until, reason} · PUT /members/:id/module-access/:module {enabled}
             POST /members/:id/suspend|reactivate · POST /members/:id/offboard {reassign_to, ...} · GET /members/:id/sessions · DELETE /sessions/:id
     @mcp    users_members_read, users_roles_assign*, users_permissions_grant*, users_members_manage*, users_sessions_revoke*  (* needs human confirmation for AI callers)
     @data   User (status, mfa_enabled, password_changed_at, last_login_at, locale, timezone) · UserAuthMethod · Membership · RoleAssignment · PermissionGrant · MembershipBranch ·
             TeamMembership · BranchManager · MembershipModuleAccess · UserSession · AuditEvent (activity tab) · Invitation (history)
     @ui     Tabs, Card, Table, DropdownMenu, AlertDialog (suspend/offboard/revoke), Dialog+Form (assign role: role Combobox, scope Select, optional valid_until DatePicker, reason Textarea)
     @states loading · not found (404) · error · no-access · read-only banner when the member is the Owner and the caller is not (cannot edit an equal-or-higher role: privilege escalation rule §63)
     @audit  membership.role_assigned | membership.role_removed | membership.admin_promoted | membership.permission_granted | membership.permission_revoked |
             membership.module_enabled | membership.module_disabled | membership.suspended | membership.offboarded | session.revoked
     @note   PRIVILEGE ESCALATION: the server must reject assigning a role/permission the caller does not hold themselves (01 "Privilege escalation rules"). Separation of duties (§96)
             is enforced by DENY grants/rules, not by UI hiding. Effective permissions come from the authorization service (§136), never recomputed in the client; show the SOURCE of each result.
     ===================================================================================================================== */
  function member() {
    /* effective permission rows: [key, result, source, scope] — keys are real (seed catalog) */
    const eff = [
      ["projects.projects.read", "ALLOW", "Role Project Manager", "ORGANIZATION"],
      ["projects.projects.update", "ALLOW", "Role Project Manager", "ORGANIZATION"],
      ["projects.projects.delete*", "—", "Not granted by any role or grant", "—"],
      ["time.entries.approve", "ALLOW", "Role Project Manager", "ORGANIZATION"],
      ["crm.deals.read", "ALLOW", "PermissionGrant · valid until Dec 31", "ORGANIZATION"],
      ["finance.invoices.read", "—", "FINANCE disabled in MembershipModuleAccess", "—"],
      ["finance.invoices.approve*", "DENY", "PermissionGrant DENY · “separation of duties”", "ORGANIZATION"],
      ["users.members.invite", "—", "Not granted by any role or grant", "—"],
    ];
    const ma = [["PROJECTS", 1], ["TASKS", 1], ["TIME_TRACKING", 1], ["DOCUMENTS", 1], ["CALENDAR", 1], ["MESSAGING", 1], ["SUPPORT", 1], ["CRM", 1], ["FINANCE", 0], ["PROPOSALS", 0], ["COMMUNICATION", 0], ["ADMINISTRATION", 0]];
    return '<div class="a-page">' +
      /* @impl Header card: avatar, display_name, Membership.status badge (the User.status is shown inside Identity), job_title, type, joined_at. Actions: Suspend (AlertDialog),
           Offboard (multi-step Dialog: reassign owned records §133, revoke sessions/keys, transfer ownership if needed), Edit access (opens the Access tab in edit mode). */
      '<div class="cd" style="margin-bottom:14px"><div class="hdr-card">' + AV("AM", "", "xl") + '<div class="nm"><h2>Anna Meyer ' + S("ACTIVE") + '</h2><div class="muted">anna@logiqdev.example · Delivery Lead · ' + E("INTERNAL") + " · joined Mar 12, 2025 · Employee profile linked</div></div>" + btn("Suspend", "") + btn("Offboard", "x") + btn("Edit access", "edit", "primary") + "</div></div>" +
      '<div class="tabset">' + tabs([["a", "Access"], ["e", "Effective permissions"], ["s", "Sessions", 2], ["h", "Activity"]], "a") + '<div class="pane on" data-pane="a"><div class="g-main"><div class="stack">' +
      /* @impl Role assignments: RoleAssignment rows (role, scope_type + scope target, valid_from/until, granted_by, reason, revoked_at null). "Assign role" Dialog. Scope target is a Combobox
           of branches/teams/projects depending on scope_type. A row whose valid_until is in the past is shown as expired (greyed) until cleaned up. */
      cd("<b>Role assignments</b><span class='r'>" + btn("Assign role", "plus", "sm") + "</span>",
        '<table><thead><tr><th>Role</th><th>Scope</th><th>Valid</th><th>Granted by · reason</th><th></th></tr></thead><tbody>' +
        "<tr><td><b class='ink'>Project Manager</b></td><td>" + E("ORGANIZATION") + "</td><td>Always</td><td>Petros R. · onboarding</td><td>" + more + "</td></tr>" +
        "<tr><td><b class='ink'>Branch Admin</b></td><td>" + E("BRANCH") + " · Athens</td><td>Always</td><td>Petros R. · branch manager</td><td>" + more + "</td></tr>" +
        "<tr><td><b class='ink'>Developer</b></td><td>" + E("PROJECT") + " · Acme Rebrand</td><td>until Jan 31</td><td>Anna M. · cover</td><td>" + more + "</td></tr></tbody></table>", 1) +
      /* @impl Permission grants: PermissionGrant rows outside any role: effect ALLOW or DENY, scope, valid_until, reason. DENY wins over ALLOW (§53). Needs users.permissions.grant*. */
      cd("<b>Permission grants</b><span class='r muted'>PermissionGrant · outside any role</span>", '<table><thead><tr><th>Permission</th><th>Effect</th><th>Scope</th><th>Valid until</th><th>Reason</th></tr></thead><tbody><tr><td class="key">crm.deals.read</td><td>' + E("ALLOW", "green") + "</td><td>" + E("ORGANIZATION") + '</td><td>Dec 31</td><td class="muted">Q4 handover</td></tr><tr><td class="key">finance.invoices.approve</td><td>' + E("DENY", "red") + "</td><td>" + E("ORGANIZATION") + '</td><td>—</td><td class="muted">Separation of duties</td></tr></tbody></table>', 1) +
      /* @impl Branches & teams: MembershipBranch (is_primary, include_children, started_at/ended_at), TeamMembership (team_role, is_primary, is_lead), BranchManager (title). Add/remove inline;
           exactly one primary branch per member (enforced in the service). */
      cd("<b>Branches & teams</b>", '<div class="rowx"><div class="grow"><b>Athens</b><small>MembershipBranch · primary · include_children ✓ · since Mar 2025</small></div>' + E("OFFICE") + '</div><div class="rowx"><div class="grow"><b>Thessaloniki</b><small>MembershipBranch · not primary</small></div>' + E("OFFICE") + '</div><div class="rowx"><div class="grow"><b>Delivery</b><small>TeamMembership · lead · primary</small></div>' + E("DEPARTMENT") + '</div><div class="rowx"><div class="grow"><b>Web squad</b><small>TeamMembership · member</small></div>' + E("TEAM") + '</div><div class="rowx"><div class="grow"><b>Athens — branch manager</b><small>BranchManager · title “Delivery Lead”</small></div><span class="badge">Manager</span></div>', 1) +
      /* @impl Module access: MembershipModuleAccess per ModuleKey. A module disabled at ORGANIZATION level (OrganizationModule) cannot be enabled here (disable the switch and say why).
           Checked BEFORE feature permissions (§56). @audit membership.module_enabled / membership.module_disabled */
      cd("<b>Module access</b><span class='r muted'>MembershipModuleAccess · checked before permissions (§56)</span>", '<div class="g2" style="gap:0">' + ma.map((m) => '<div class="setting" style="padding:9px 16px"><div class="grow"><b>' + modLabel(m[0]) + "</b><small class='mono'>" + m[0] + "</small></div>" + sw(m[1]) + "</div>").join("") + "</div>", 1) +
      '</div><div class="stack">' +
      /* @impl Identity card: User fields. "Last password change" = User.password_changed_at (null for SSO-only users: hide the row). Phone/email verified marks from phone_verified_at / email_verified_at. */
      cd("<b>Identity (User)</b>", kv("User status", S("ACTIVE")) + kv("Email", "anna@logiqdev.example " + muted("✓ verified")) + kv("Phone", "+30 69… " + muted("✓ verified")) + kv("Locale · timezone", "en-GB · Europe/Athens") + kv("Last login", "Today 08:12") + kv("Last password change", "41 days ago") + kv("Default org / branch", "Logiqdev / Athens")) +
      /* @impl Sign-in methods: UserAuthMethod rows (type PASSWORD|MAGIC_LINK|PASSKEY|OAUTH|SSO|TOTP|SMS_OTP|EMAIL_OTP|RECOVERY_CODES, verified_at, last_used_at, disabled_at). NEVER expose secret_hash.
           An admin may reset a member's MFA (writes user.mfa_disabled with the admin as actor; notifies admins) but can never view a factor's secrets. */
      cd("<b>Sign-in methods</b><span class='r muted'>UserAuthMethod</span>", '<div class="rowx"><div class="grow"><b>Password</b><small>verified</small></div>' + E("PASSWORD", "green") + '</div><div class="rowx"><div class="grow"><b>Authenticator app</b><small>last used 2m ago</small></div>' + E("TOTP", "green") + '</div><div class="rowx"><div class="grow"><b>Passkey “MacBook”</b><small>last used 3d ago</small></div>' + E("PASSKEY", "green") + '</div><div class="rowx"><div class="grow"><b>Recovery codes</b><small>not set up</small></div>' + E("RECOVERY_CODES") + "</div>", 1) +
      cd("<b>Membership</b>", kv("Status", S("ACTIVE")) + kv("Type", E("INTERNAL")) + kv("Provisioning", E("MANUAL")) + kv("Invited by", "Petros R.") + kv("Offboarding", muted("none"))) +
      /* @impl Recent activity: last ~5 AuditEvent rows where resource is this membership/user. Link "View all" to /admin/audit?actor=&resource_id=. */
      cd("<b>Recent activity</b><span class='r muted'>AuditEvent</span>", '<div class="tl"><div class="ev"><b class="key">session.created</b><small>Chrome · Athens · 2m ago</small></div><div class="ev"><b class="key">membership.role_assigned</b><small>Developer · Acme Rebrand · yesterday</small></div><div class="ev"><b class="key">membership.permission_granted</b><small>crm.deals.read · 3d ago</small></div></div>') +
      callout("lock", "HR data such as compensation is hidden unless you hold " + keyc("employees.compensation.read") + " (field-level, §60).") + "</div></div></div>" +
      /* @impl Effective permissions tab: result of the authorization service for (member, scope) listing every permission key with ALLOW / DENY / not granted and its SOURCE
           (role, grant, module access, deny rule) + scope. Group by ModuleKey, filter "show only differences from role". Keys with * are sensitive (Permission.is_sensitive). Needs users.permissions.read. */
      pane("e", 0, callout("zap", "Calculated from role permissions, grants, scope and deny rules. Every result shows its source (§108). <a style='text-decoration:underline'>Open in access simulation</a>") + '<div class="panel" style="margin-top:12px"><table><thead><tr><th>Permission</th><th>Result</th><th>Source</th><th>Scope</th></tr></thead><tbody>' + eff.map((e) => '<tr><td class="key">' + e[0] + "</td><td>" + (e[1] === "ALLOW" ? E("ALLOW", "green") : e[1] === "DENY" ? E("DENY", "red") : '<span class="badge">Not granted</span>') + "</td><td>" + e[2] + "</td><td>" + (e[3] === "—" ? muted("—") : E(e[3])) + "</td></tr>").join("") + "</tbody></table></div><div class='sub-note' style='margin-top:8px'>* sensitive (Permission.is_sensitive)</div>") +
      /* @impl Sessions tab: UserSession rows (device, browser, ip_address, location_approx, active org/branch(es), last_activity_at, expires_at). Revoke sets revoked_at + revoked_reason
           and invalidates the token immediately. Needs users.sessions.read* / revoke*; a member may always see their OWN sessions unless OrganizationSecurityPolicy.members_can_view_sessions is false. */
      pane("s", 0, '<div class="panel" style="margin-top:0"><table><thead><tr><th>Device · browser</th><th>IP</th><th>Location (approx.)</th><th>Active org / branches</th><th>Signed in</th><th>Last activity</th><th>Expires</th><th></th></tr></thead><tbody><tr><td><b class="ink">MacBook · Chrome 131</b> <span class="badge green">This device</span></td><td class="mono">85.74.x.x</td><td>Athens, GR</td><td>Logiqdev / Athens +1</td><td>Today 08:12</td><td>Now</td><td class="muted">Nov 25</td><td></td></tr><tr><td><b class="ink">iPhone · Safari</b></td><td class="mono">85.74.x.x</td><td>Athens, GR</td><td>Logiqdev / all</td><td>Nov 9</td><td>2h ago</td><td class="muted">Nov 23</td><td>' + btn("Revoke", "", "sm") + "</td></tr></tbody></table></div>") +
      pane("h", 0, callout("file", "Full history lives in the <a href='#admin/audit' style='text-decoration:underline'>audit log</a>, filtered to this member.")) + "</div>" +
      dm(["User · status, mfa_enabled, password_changed_at, locale, timezone, last_login_at, email_verified_at", "UserAuthMethod · type, verified_at, last_used_at, disabled_at", "Membership · type, status, provisioning_source, joined_at, offboarding", "RoleAssignment · scope_type, scope_id, valid_until, reason · PermissionGrant · effect", "MembershipBranch · MembershipModuleAccess · TeamMembership (is_lead) · BranchManager", "UserSession · device, browser, ip_address, location_approx, active_branch_ids, expires_at"], []) + "</div>";
  }

  /* =====================================================================================================================
     ROLES (spec §44–45, §111) — real ROLE_TEMPLATES
     @route  /admin/roles?type=&status=&q=
     @perm   VIEW users.roles.read · create/clone/edit/publish/deprecate users.roles.manage* · assign users.roles.assign*
     @api    GET /roles?type=&status=&q= · POST /roles {name, template_role_id?} (clone) · GET /roles/:id
     @mcp    users_roles_read, users_roles_manage* (needs human confirmation for AI callers)
     @data   Role (name, slug, type, status, default_scope, modules, is_system, template_role_id, version, published_at) · RoleAssignment (count per role)
     @ui     Table, ToggleGroup (type filter), Badge, DropdownMenu (Clone, Deprecate), Dialog ("Browse templates" lists platform templates = Role rows with organization_id null)
     @states loading · empty (only templates) · error · no-access
     @note   SYSTEM (Owner) and platform templates are READ-ONLY: "Edit" becomes "Clone". Customizing = clone into the organization (sets template_role_id), edit the clone as DRAFT,
             then publish. CUSTOMER_PORTAL roles are listed separately in the UI filter and are only assignable to CustomerPortalMembership.
     ===================================================================================================================== */
  /* name, RoleType, default_scope, #modules, RoleStatus, origin, assignments, version */
  const R = [
    ["Owner", "SYSTEM", "ORGANIZATION", 19, "PUBLISHED", "System", 1, 1],
    ["Admin", "ORGANIZATION", "ORGANIZATION", 19, "PUBLISHED", "Template", 3, 2],
    ["Branch Admin", "BRANCH", "BRANCH", 12, "PUBLISHED", "Template", 2, 1],
    ["Manager", "ORGANIZATION", "ORGANIZATION", 14, "PUBLISHED", "Template", 2, 3],
    ["Project Manager", "ORGANIZATION", "ORGANIZATION", 8, "PUBLISHED", "Template", 4, 4],
    ["Sales Manager", "ORGANIZATION", "ORGANIZATION", 7, "PUBLISHED", "Template", 2, 1],
    ["Finance Manager", "ORGANIZATION", "ORGANIZATION", 6, "PUBLISHED", "Template", 1, 2],
    ["Support Agent", "ORGANIZATION", "ORGANIZATION", 6, "PUBLISHED", "Template", 3, 1],
    ["Developer", "ORGANIZATION", "ORGANIZATION", 7, "PUBLISHED", "Template", 6, 2],
    ["Employee", "ORGANIZATION", "ORGANIZATION", 10, "PUBLISHED", "Template", 4, 1],
    ["Viewer", "ORGANIZATION", "ORGANIZATION", 7, "PUBLISHED", "Template", 1, 1],
    ["External Collaborator", "ORGANIZATION", "RESOURCE", 4, "PUBLISHED", "Template", 2, 1],
    ["Contractor", "ORGANIZATION", "PROJECT", 3, "DRAFT", "Clone of Developer", 0, 1],
    ["Legacy Intern", "ORGANIZATION", "ORGANIZATION", 2, "DEPRECATED", "Custom", 0, 2],
    ["Customer Owner", "CUSTOMER_PORTAL", "CUSTOMER", 1, "PUBLISHED", "Template", 4, 1],
    ["Customer Administrator", "CUSTOMER_PORTAL", "CUSTOMER", 1, "PUBLISHED", "Template", 3, 1],
    ["Customer Manager", "CUSTOMER_PORTAL", "CUSTOMER", 1, "PUBLISHED", "Template", 6, 1],
    ["Customer Finance", "CUSTOMER_PORTAL", "CUSTOMER", 1, "PUBLISHED", "Template", 3, 1],
    ["Customer Legal", "CUSTOMER_PORTAL", "CUSTOMER", 1, "PUBLISHED", "Template", 1, 1],
    ["Customer Viewer", "CUSTOMER_PORTAL", "CUSTOMER", 1, "PUBLISHED", "Template", 1, 1],
  ];
  function roles() {
    return '<div class="a-page">' + head("Roles", "Reusable permission bundles. Platform templates are seeded; clone and customize per organization (§111).", btn("Browse templates", "layers") + lnk("Create role", "plus", "primary", "rolenew")) +
      /* @impl Type filter values = RoleType enum (SYSTEM|ORGANIZATION|BRANCH|TEAM|PROJECT|CUSTOMER_PORTAL). Writes ?type= */
      '<div class="toolbar">' + search("Search roles…") + '<div class="seg"><button class="on">All</button><button>System</button><button>Organization</button><button>Branch</button><button>Team</button><button>Project</button><button>Customer portal</button></div></div>' +
      /* @impl Columns: Type = Role.type · Default scope = Role.default_scope · Modules = count of Role.modules · Version = Role.version (vN) · Status = Role.status · Origin = is_system /
           template_role_id / organization_id null · Assigned = RoleAssignment count (not revoked, not expired). Row -> /admin/roles/:id. */
      '<div class="panel" style="margin-top:0"><table><thead><tr><th>Role</th><th>Type</th><th>Default scope</th><th class="num">Modules</th><th>Version</th><th>Status</th><th>Origin</th><th class="num">Assigned</th><th></th></tr></thead><tbody>' +
      R.map((r) => '<tr class="clk" onclick="location.hash=\'#admin/role\'"><td><div class="name">' + I("shield", 15) + r[0] + "</div></td><td>" + E(r[1], r[1] === "SYSTEM" ? "purple" : r[1] === "CUSTOMER_PORTAL" ? "blue" : "") + "</td><td>" + E(r[2]) + '</td><td class="num">' + r[3] + '</td><td class="mono">v' + r[7] + "</td><td>" + S(r[4]) + "</td><td>" + muted(r[5]) + '</td><td class="num">' + r[6] + "</td><td>" + more + "</td></tr>").join("") +
      "</tbody></table></div>" +
      dm(["Role · name, slug, type (RoleType), status (RoleStatus), default_scope (ScopeType), modules (ModuleKey[]), is_system, template_role_id, version, published_at", "RoleAssignment · count per role"], []) + "</div>";
  }

  /* =====================================================================================================================
     ROLE EDITOR (spec §109)
     @route  /admin/roles/:roleId
     @perm   VIEW users.roles.read · edit/save/publish/deprecate/duplicate users.roles.manage* · (cannot grant a permission the editor does not hold: privilege escalation rule)
     @api    GET /roles/:id (+permissions, versions) · PUT /roles/:id (draft fields + permission set) · POST /roles/:id/publish {note} · POST /roles/:id/deprecate · POST /roles/:id/duplicate
             GET /permissions?module= (catalog, to render the groups)
     @mcp    users_roles_read, users_roles_manage* (publish needs human confirmation for AI callers)
     @data   Role (name, description, type, status, default_scope, modules, restrictions JSON, version, published_at) · RolePermission (permission_id, effect ALLOW|DENY, conditions JSON) ·
             Permission (key, module, resource, action, is_sensitive, is_field_level) · RoleVersion (snapshot per publish) · RoleAssignment (assigned count)
     @ui     Accordion (one item per ModuleKey), Checkbox (group = indeterminate), toggle chips per action (ToggleGroup type multiple, 3rd state = DENY), Form (react-hook-form + zod),
             AlertDialog on publish ("N members will receive these permissions"), Sheet for version history diff
     @states loading · not found · error · no-access · conflict (409 when the role changed since it was loaded: show a reload prompt) · read-only for SYSTEM/template roles
     @audit  role.created | role.updated | role.published | role.deprecated
     @note   Editing a PUBLISHED role does not change what members have until you publish again: work on the draft, publish creates RoleVersion (version + 1, published_at set) and the
             authorization cache is invalidated (§135). `modules` on the role is the set of ModuleKeys granted when the role is assigned (it does NOT bypass OrganizationModule).
             Role.restrictions is a JSON object with a FIXED set of keys defined by the API (e.g. require_mfa, hide_rates): validate it with zod on both sides.
             Chips: green = ALLOW, red x = DENY (RolePermission.effect), outline = not granted, yellow * = sensitive. Per-permission `conditions` are edited in a popover on the chip.
     ===================================================================================================================== */
  function role() {
    /* real keys from ROLE_TEMPLATES 'project-manager'. state: 1 = ALLOW, 0 = not granted, 2 = DENY. [action, state, sensitive] */
    const crud = (g) => [["read", g[0]], ["create", g[1]], ["update", g[2]], ["delete", g[3], 1], ["archive", g[4]], ["export", g[5], 1]];
    const chips = (a) => '<div class="acts">' + a.map((x) => '<span class="ac ' + (x[1] === 2 ? "deny" : x[1] ? "on" : "") + '">' + (x[1] === 1 ? I("check", 11) : x[1] === 2 ? I("x", 11) : "") + x[0] + (x[2] ? '<span class="sens">*</span>' : "") + "</span>").join("") + "</div>";
    const grp = (mk, open, rows) => { const all = rows.flatMap((r) => r[1]), n = all.filter((a) => a[1] === 1).length; return '<div class="pg ' + (open ? "open" : "") + '"><div class="pg-h" onclick="this.parentElement.classList.toggle(\'open\')">' + I("right", 13).replace('class="ico"', 'class="ico chv"') + cb(n === all.length ? 1 : n ? "mix" : 0) + "<b>" + modLabel(mk) + '</b><span class="mono muted">' + mk + '</span><span class="muted" style="margin-left:auto">' + n + " of " + all.length + " granted</span></div><div class=\"pg-b\">" + rows.map((r) => '<div class="pr"><span class="nm key">' + r[0] + "</span>" + chips(r[1]) + "</div>").join("") + "</div></div>"; };
    return '<div class="a-page">' + head("Project Manager", "Role editor · slug " + keyc("project-manager") + " · version 4 · published Nov 2 · platform template", btn("Duplicate", "layers") + btn("Deprecate", "archive") + btn("Save draft", "") + btn("Publish", "check", "primary")) +
      '<div class="g-main"><div class="stack">' +
      /* @impl Permission groups: one Accordion item per ModuleKey that has permissions; rows = resource prefix (e.g. projects.projects) with one chip per action. Group checkbox toggles all
           chips in the group. Only show modules listed in Role.modules by default, with an "Add module" action (adds the ModuleKey to Role.modules). Data from GET /permissions. */
      cd("<b>Permissions</b><span class='r'>" + search("Filter keys…") + "</span>",
        grp("PROJECTS", 1, [["projects.projects", crud([1, 1, 1, 0, 0, 0]).concat([["manage_members", 1], ["manage_budgets", 1], ["complete", 0], ["reopen", 0]])], ["projects.milestones", [["manage", 0]]], ["projects.portfolio", [["read", 0]]]]) +
        grp("TASKS", 0, [["tasks.tasks", crud([1, 1, 1, 1, 1, 1]).concat([["assign", 1]])]]) +
        grp("TIME_TRACKING", 0, [["time.entries", [["read_all", 1], ["approve", 1], ["unlock", 0, 1]]]]) +
        grp("DOCUMENTS", 0, [["documents.documents", crud([1, 1, 1, 0, 0, 0]).concat([["share", 1], ["approve", 0]])]]) +
        grp("CRM", 0, [["crm.companies", [["read", 1], ["create", 0]]], ["crm.contacts", [["read", 1], ["create", 0]]], ["crm.deals", [["read", 1], ["create", 0], ["delete", 0, 1]]]]) +
        grp("SUPPORT", 0, [["support.tickets", [["read", 1], ["create", 0], ["assign", 0]]]]) +
        grp("ADMINISTRATION", 0, [["users.members", [["read", 1], ["invite", 0], ["manage", 0, 1]]], ["organizations.teams", [["read", 1], ["manage", 0]]]]), 1) +
      '<div class="sub-note" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' + chips([["ALLOW", 1], ["DENY", 2], ["not granted", 0], ["sensitive", 0, 1]]) + "<span>RolePermission.effect is ALLOW or DENY. Optional " + keyc("conditions") + " (JSON) can narrow a single permission.</span></div>" +
      /* @impl Version history: RoleVersion rows (version, published_by, published_at, note). "Compare" opens a diff of `permissions`/`modules`/`restrictions` between two versions;
           "Restore as draft" copies a version back into the draft (never rewrites history). Append-only table. */
      cd("<b>Version history</b><span class='r muted'>RoleVersion · one row per publish</span>", '<table><thead><tr><th>Version</th><th>Published</th><th>By</th><th>Note</th><th></th></tr></thead><tbody><tr><td class="mono">v4 <span class="badge green">Current</span></td><td>Nov 2, 2026</td><td>Petros R.</td><td class="muted">Added time.entries.approve</td><td>' + btn("Compare", "", "ghost sm") + '</td></tr><tr><td class="mono">v3</td><td>Aug 14, 2026</td><td>Petros R.</td><td class="muted">Removed projects.projects.delete</td><td>' + btn("Compare", "", "ghost sm") + '</td></tr><tr><td class="mono">v2</td><td>Mar 20, 2026</td><td>Elena P.</td><td class="muted">Added CRM read</td><td>' + btn("Compare", "", "ghost sm") + '</td></tr><tr><td class="mono">v1</td><td>Mar 12, 2025</td><td>Platform</td><td class="muted">Cloned from template</td><td></td></tr></tbody></table>', 1) +
      "</div>" + '<div class="stack">' +
      /* @impl Details form (react-hook-form + zod): name (unique per org: unique(organization_id, slug)), description, type (SYSTEM only for platform roles), status (transitions DRAFT->PUBLISHED->DEPRECATED
           via the buttons, not via this select), default_scope (ScopeType), modules (multi-select of ModuleKey). Origin is read-only (template_role_id / organization_id). */
      cd("<b>Details</b>", fld("Name", '<div class="inp ink">Project Manager</div>') + fld("Description", '<div class="inp tall">Project Manager bundle (01 §112).</div>') +
        fld("Type", sel(en("ORGANIZATION"), "shield")) + fld("Status", sel(en("PUBLISHED"), "check")) + fld("Default scope", sel(en("ORGANIZATION"), "building")) +
        fld("Modules (ModuleKey[])", '<div style="display:flex;gap:6px;flex-wrap:wrap">' + ["PROJECTS", "TASKS", "TIME_TRACKING", "DOCUMENTS", "CALENDAR", "MESSAGING", "SUPPORT", "CRM"].map(tok).join("") + '<span class="tok" style="border-style:dashed;color:var(--ash)">+ Add</span></div>') + fld("Origin", '<div class="inp">Platform template (organization_id = null)</div>')) +
      /* @impl Restrictions = Role.restrictions JSON (fixed keys, validated). Shown as switches; unknown keys must never be written by the client. */
      cd("<b>Restrictions</b><span class='r muted'>Role.restrictions (JSON)</span>", '<div class="setting" style="padding:8px 0;border:0"><div class="grow"><b>Require MFA</b><small>require_mfa</small></div>' + sw(1) + '</div><div class="setting" style="padding:8px 0;border:0"><div class="grow"><b>Hide billing rates</b><small>hide_rates</small></div>' + sw(1) + "</div>") +
      cd("<b>Assigned to</b><span class='r muted'>RoleAssignment</span>", '<div class="avs" style="margin-bottom:8px">' + AV("AM", "") + AV("MS", "g") + AV("JK", "r") + AV("KL", "p") + '</div><div class="muted">4 members · scopes: Organization ×3, Project ×1</div>') +
      callout("shield", "<b>Sensitive permissions</b> marked <span class='sens'>*</span> require " + keyc("users.roles.assign") + " to hand out and are audited.", "warn") + "</div></div>" +
      dm(["Role · name, slug, description, type, status, default_scope, modules, restrictions, version, published_at, template_role_id", "RolePermission · permission_id, effect (ALLOW/DENY), conditions (JSON)", "Permission · key, module, resource, action, is_sensitive, is_field_level", "RoleVersion · version, permissions, restrictions, note, published_by, published_at"], []) + "</div>";
  }

  /* =====================================================================================================================
     PERMISSION CATALOG (spec §46–48, §110) — real keys
     @route  /admin/permissions?module=&q=&sensitive=1
     @perm   VIEW users.permissions.read (read-only screen; the catalog is seeded by code, never edited in the UI)
     @api    GET /permissions?module=&q=&sensitive=&field_level=&cursor= (includes `roles_using` count)
     @mcp    users_permissions_read
     @data   Permission (key, module, resource, action, description, is_sensitive, is_field_level) · RolePermission (count of roles per key)
     @ui     Table grouped by ModuleKey (Collapsible sections), ToggleGroup (All/Sensitive/Field-level/Unused), Command-style search
     @states loading · empty search · error · no-access
     @note   Keys are registered by modules through the seed (api/prisma/seed/permission-catalog.ts): this screen NEVER creates them. "Unused" = no RolePermission row (candidates for cleanup).
             Spec §110 groups by product name; the schema groups by Permission.module (ModuleKey), which this screen follows. Field-level keys hide FIELDS, not records.
     ===================================================================================================================== */
  function catalog() {
    /* [key, description, sensitive, field-level, roles using] */
    const G = [
      ["ADMINISTRATION", [["users.members.read", "Read members", 0, 0, 9], ["users.members.invite", "Invite members", 0, 0, 4], ["users.members.manage", "Manage members", 1, 0, 2], ["users.members.offboard", "Offboard members", 1, 0, 2], ["users.roles.assign", "Assign roles", 1, 0, 2], ["users.permissions.simulate", "Run access simulation", 0, 0, 3], ["users.sessions.revoke", "Revoke sessions", 1, 0, 2], ["organizations.audit.read", "Read audit log", 1, 0, 3], ["organizations.api_keys.manage", "Manage API keys", 1, 0, 2], ["organizations.sso.manage", "Manage SSO", 1, 0, 2], ["organizations.branches.manage", "Manage branches", 1, 0, 2], ["organizations.access_reviews.decide", "Decide assigned access-review items", 1, 0, 3]]],
      ["PROJECTS", [["projects.projects.read", "Read projects", 0, 0, 11], ["projects.projects.update", "Update projects", 0, 0, 6], ["projects.projects.delete", "Delete projects", 1, 0, 3], ["projects.projects.manage_budgets", "Manage project budgets", 0, 0, 4], ["projects.finance.read", "Read project finance", 1, 0, 3]]],
      ["FINANCE", [["finance.invoices.read", "Read invoices", 0, 0, 5], ["finance.invoices.approve", "Approve invoices", 1, 0, 2], ["finance.payments.refund", "Refund payments", 1, 0, 2]]],
      ["EMPLOYEES", [["employees.compensation.read", "Read compensation", 1, 1, 2], ["employees.compensation.manage", "Manage compensation", 1, 1, 1], ["employees.hr_notes.read", "Read HR notes", 1, 0, 2]]],
      ["CONTRACTS", [["contracts.confidential_terms.read", "Read confidential terms", 1, 1, 3]]],
    ];
    return '<div class="a-page">' + head("Permission catalog", "Every permission key registered by a module. Grouped by " + keyc("Permission.module") + " (ModuleKey).", btn("Export", "")) +
      '<div class="toolbar">' + search("Search permission keys…") + '<div class="seg"><button class="on">All</button><button>Sensitive</button><button>Field-level</button><button>Unused</button></div><button class="btn">' + I("layers", 14) + " Module</button></div>" +
      /* @impl One table per ModuleKey. `Sensitive` -> yellow Badge (needs human confirmation via MCP and is audited); `Field-level` -> purple Badge (hides fields). "Roles" links to /admin/roles?permission=<key>. */
      G.map((g) => '<div class="cd" style="margin-bottom:14px"><div class="cd-h"><b>' + modLabel(g[0]) + '</b><span class="mono muted">' + g[0] + '</span><span class="r muted">' + g[1].length + ' shown</span></div><table><thead><tr><th>Key</th><th>Description</th><th>Sensitive</th><th>Field-level</th><th class="num">Roles</th></tr></thead><tbody>' + g[1].map((k) => '<tr><td class="key">' + k[0] + "</td><td>" + k[1] + "</td><td>" + (k[2] ? '<span class="badge yellow">Sensitive</span>' : muted("—")) + "</td><td>" + (k[3] ? '<span class="badge purple">Field-level</span>' : muted("—")) + '</td><td class="num">' + k[4] + "</td></tr>").join("") + "</tbody></table></div>").join("") +
      dm(["Permission · key, module, resource, action, description, is_sensitive, is_field_level", "RolePermission · count of roles per key"], ["Spec §110 groups by product name; the schema groups by ModuleKey, which this screen follows"]) + "</div>";
  }

  /* =====================================================================================================================
     PERMISSION MATRIX (spec §143–144)
     @route  /admin/matrix?view=modules|branches
     @perm   VIEW users.roles.read (+ users.permissions.read)
     @api    GET /permissions/matrix?view=modules|branches (server computes levels from RolePermission, grouped by ModuleKey; branch view from RoleAssignment scopes)
     @mcp    users_permissions_read
     @data   Role → RolePermission → Permission (module, action, effect) · RoleAssignment (scope_type BRANCH | BRANCH_HIERARCHY, scope_id) · Branch (tree)
     @ui     Table with sticky first column + header, Badge cells, Tabs, Tooltip on a cell listing the keys behind the level
     @states loading · empty · error · no-access
     @note   GENERATED, never hard-coded (§143). Level rule (define once in the API): Full = all actions of the module ALLOW; Manage = create/update + manage_* ; Edit = create/update;
             Read = read only; None = nothing. A DENY on any key lowers the level and shows a marker. Cell click -> role editor scrolled to that module. Export CSV respects the caller's scope.
     ===================================================================================================================== */
  function matrix() {
    const lv = (v) => '<span class="lv ' + v.toLowerCase() + '">' + v + "</span>";
    const cols = ["CRM", "PROPOSALS", "CONTRACTS", "PROJECTS", "TASKS", "SUPPORT", "FINANCE", "EMPLOYEES", "DOCUMENTS", "ADMINISTRATION"];
    const rows = [
      ["Owner", ["Full", "Full", "Full", "Full", "Full", "Full", "Full", "Full", "Full", "Full"]],
      ["Admin", ["Full", "Full", "Full", "Full", "Full", "Full", "Full", "Full", "Full", "Manage"]],
      ["Branch Admin", ["Full", "None", "None", "Full", "Full", "Full", "None", "None", "Full", "Edit"]],
      ["Manager", ["Full", "Full", "Edit", "Full", "Full", "Full", "Read", "Read", "Full", "Read"]],
      ["Project Manager", ["Read", "None", "None", "Manage", "Full", "Read", "None", "None", "Edit", "Read"]],
      ["Sales Manager", ["Full", "Full", "Edit", "None", "Full", "None", "None", "None", "Edit", "Read"]],
      ["Finance Manager", ["Read", "None", "Read", "Read", "None", "None", "Full", "None", "Read", "None"]],
      ["Support Agent", ["Read", "None", "None", "None", "Edit", "Full", "None", "None", "Read", "None"]],
      ["Developer", ["None", "None", "None", "Read", "Edit", "None", "None", "None", "Edit", "None"]],
      ["Employee", ["Read", "None", "Read", "Edit", "Edit", "Read", "None", "None", "Read", "None"]],
      ["Viewer", ["Read", "None", "Read", "Read", "Read", "Read", "None", "None", "Read", "None"]],
      ["External Collaborator", ["None", "None", "None", "Read", "Edit", "None", "None", "None", "Read", "None"]],
    ];
    const bcols = ["Athens", "Thessaloniki", "Greece (+children)", "Limassol", "Organization"];
    const brow = [["Branch Admin · BRANCH Athens", ["Full", "None", "None", "None", "None"]], ["Branch Admin · BRANCH Thessaloniki", ["None", "Full", "None", "None", "None"]], ["Branch Admin · BRANCH_HIERARCHY Greece", ["Full", "Full", "Full", "None", "None"]], ["Admin · ORGANIZATION", ["Full", "Full", "Full", "Full", "Full"]]];
    const tbl = (c, r, mono) => '<div class="panel" style="margin-top:0"><div class="tbl-scroll"><table class="mx"><thead><tr><th>Role</th>' + c.map((x) => '<th title="' + x + '">' + (mono ? modLabel(x).split(" ")[0] : x) + "</th>").join("") + "</tr></thead><tbody>" + r.map((x) => "<tr><td><b class='ink' style='font-weight:500'>" + x[0] + "</b></td>" + x[1].map((v) => "<td>" + lv(v) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div></div>";
    return '<div class="a-page">' + head("Permission matrix", "Computed from RolePermission rows, never hardcoded (§143). Levels summarize the ALLOW keys of each module.", btn("Export CSV", "")) +
      '<div class="tabset">' + tabs([["m", "By module"], ["b", "By branch scope"]], "m") +
      /* @impl By module: columns = ModuleKey (header shows the label, tooltip the raw key). Legend badges use the same level -> variant map as the cells. */
      pane("m", 1, '<div style="display:flex;gap:6px;margin-bottom:12px;align-items:center"><span class="sub-note">Legend</span>' + lv("Full") + lv("Manage") + lv("Edit") + lv("Read") + lv("None") + "</div>" + tbl(cols, rows, 1)) +
      /* @impl By branch scope: how RoleAssignment.scope_type BRANCH vs BRANCH_HIERARCHY covers the Branch tree (§144). Columns = branches (+ hierarchy nodes + organization). */
      pane("b", 0, callout("building", "RoleAssignment.scope_type BRANCH covers one branch. BRANCH_HIERARCHY covers it and every child (§144).") + '<div style="height:12px"></div>' + tbl(bcols, brow)) + "</div>" +
      dm(["Role → RolePermission → Permission (module, action, effect)", "RoleAssignment · scope_type (BRANCH vs BRANCH_HIERARCHY), scope_id"], ["Level labels (Full/Manage/Edit/Read) are a UI summary computed by the API, not stored"]) + "</div>";
  }

  /* =====================================================================================================================
     ACCESS SIMULATION (spec §145, §54)
     @route  /admin/simulate?member=&branch=&resource=&permission=
     @perm   VIEW + ACTION users.permissions.simulate (read-only: never changes data and is not recorded as access)
     @api    POST /permissions/simulate {membership_id, branch_id?, resource_type?, resource_id?, permission_key}  -> { allowed, reason, steps[], role, scope, deny_rule }
     @mcp    users_permissions_simulate
     @data   Membership · OrganizationModule · MembershipModuleAccess · RoleAssignment → Role → RolePermission → Permission · PermissionGrant · Delegation (valid ones)
     @ui     Form (Combobox for member/branch/resource, Combobox of permission keys), Card result with a Stepper-like trace
     @states idle (before first run) · running · result · error · no-access
     @note   Runs the SAME function the real authorization service uses (§136) with a "trace" flag, so the explanation can never drift from real behavior.
             Evaluation order (stop at first failure): membership ACTIVE and tenant match -> OrganizationModule enabled -> MembershipModuleAccess enabled -> scope match ->
             DENY rules/grants -> ALLOW via roles/grants/delegations. The trace shows skipped steps greyed out.
     ===================================================================================================================== */
  function simulate() {
    const step = (cls, ic, t, s) => '<div class="ts"><span class="dotc ' + cls + '">' + I(ic, 12) + "</span><div><b>" + t + "</b><small>" + s + "</small></div></div>";
    return '<div class="a-page">' + head("Access simulation", "Ask: can this member perform this action? Nothing is changed.", btn("Share result", "link")) +
      '<div class="g-main" style="grid-template-columns:380px minmax(0,1fr)"><div class="stack">' +
      /* @impl Question form. Resource Combobox searches records of any module the caller can see (resource_type + resource_id); permission key Combobox lists Permission.key. */
      cd("<b>Question</b>", fld("Member", sel("Marco Silva · Developer", "users")) + fld("Organization", sel("Logiqdev", "building")) + fld("Branch", sel("Athens", "building")) + fld("Resource", sel("Invoice INV-2058 · Acme Corp", "dollar")) + fld("Permission key", sel("finance.invoices.approve", "key")) + '<button class="btn primary" style="width:100%">' + I("zap", 14) + " Run simulation</button>") +
      '</div><div class="stack">' +
      /* @impl Verdict banner: allowed (green) or denied (red) + one-line reason. */
      '<div class="verdict"><span class="big">' + I("x", 20) + '</span><div><b>Denied</b><small>Marco Silva cannot approve invoices.</small></div></div>' +
      cd("<b>Why</b>", kv("Blocked by", "MembershipModuleAccess: FINANCE is disabled for Marco") + kv("Role responsible", "Developer — no " + keyc("finance.*") + " keys") + kv("Scope responsible", E("BRANCH") + " Athens (in scope)") + kv("Deny rule", "None") + kv("To allow", "Enable FINANCE, then assign <b>Finance Manager</b> or add a PermissionGrant")) +
      /* @impl Evaluation trace: ordered steps from the API; each step = {name, status: pass|fail|skipped, detail}. Render fail in red and stop; skipped in grey. */
      cd("<b>Evaluation trace</b>", '<div class="trace">' +
        step("", "check", "Membership", "status ACTIVE · tenant matches the resource") +
        step("", "check", "OrganizationModule · FINANCE", "enabled for the organization") +
        step("no", "x", "MembershipModuleAccess · FINANCE", "disabled for this member — evaluation stops") +
        step("skip", "minus", "RoleAssignment → RolePermission", "skipped") +
        step("skip", "minus", "PermissionGrant / DENY rules", "skipped") + "</div>") + "</div></div>" +
      dm(["Membership · OrganizationModule · MembershipModuleAccess", "RoleAssignment → Role → RolePermission → Permission (effect)", "PermissionGrant (effect, scope, valid_until) · Delegation"], ["The result is computed by the authorization service (§136), so there is no table for it"]) + "</div>";
  }

  /* =====================================================================================================================
     BRANCHES (spec §16–22, §120–125, §142)
     @route  /admin/branches/:branchId  (tree on the left, detail on the right; /admin/branches selects the first node)
     @perm   VIEW organizations.branches.read · create/edit/archive organizations.branches.manage* · managers/members organizations.branches.members.manage ·
             localization, hours, holidays organizations.branches.settings.manage
     @api    GET /branches (tree via parent_branch_id; include counts) · GET /branches/:id · POST /branches · PATCH /branches/:id · POST /branches/:id/archive ·
             PUT /branches/:id/managers · POST/DELETE /branches/:id/holidays
     @mcp    organizations_branches_read, organizations_branches_manage*
     @data   Branch (name, code, kind BranchKind, status BranchStatus, parent_branch_id, path, depth, is_headquarters, country/region/city/address, phone, email, cost_center_code, currency, timezone,
             locale, language, date_format, week_start, working_days, business_hours) · BranchManager (membership, title) · BranchHoliday (name, date, recurring) · MembershipBranch (member counts)
     @ui     Tree (Collapsible list, keyboard navigable, drag to re-parent in a later phase), Card, Form, Badge, Dialog (create), AlertDialog (archive)
     @states loading · empty (org without branches: explain branches are optional, §148) · error · no-access
     @audit  branch.created | branch.updated | branch.archived | branch.manager_changed
     @note   `path` and `depth` are maintained by the API on create/move; never trust the client. At most ONE headquarters per organization (is_headquarters), enforced in the service.
             Archiving is blocked while the branch has ACTIVE members or open records, or requires reassignment (§104). Localization fields OVERRIDE the organization defaults; show
             "inherited" placeholders when null. The dashboard counters (projects, customers, tasks) are owned by modules 05/02/06: fetch them from those APIs, do not join across modules here.
     ===================================================================================================================== */
  function branches() {
    const tn = (ic, n, c, on, ind, tag) => '<div class="tn ' + (on ? "on" : "") + '" style="margin-left:' + ind * 18 + 'px">' + I(ic, 15) + "<span>" + n + "</span>" + (tag ? '<span class="badge" style="height:18px;font-size:11px">' + tag + "</span>" : "") + '<span class="n">' + c + "</span></div>";
    return '<div class="a-page">' + head("Branches", "Organizational units inside Logiqdev. A branch is never a tenant (§16). Hierarchy via parent_branch_id, path and depth.", lnk("Create branch", "plus", "primary", "branchnew")) +
      '<div class="g-main" style="grid-template-columns:320px minmax(0,1fr)">' +
      /* @impl Tree: root = the organization (not a Branch row). Node = Branch (icon by kind: REGIONAL_UNIT = layers, OFFICE/others = building, REMOTE = globe), tag = kind or "Planned"/"Archived"
           (status), right number = active members (MembershipBranch). Indent by `depth`. */
      '<div class="cd"><div class="cd-b tree">' +
      tn("globe", "Logiqdev", 24, 0, 0) + tn("layers", "Greece", 20, 0, 1, "Regional unit") + tn("building", "Athens", 14, 1, 2, "HQ") + tn("building", "Thessaloniki", 6, 0, 2, "Office") + tn("building", "Patras", 0, 0, 2, "Planned") + tn("layers", "Cyprus", 4, 0, 1, "Regional unit") + tn("building", "Limassol", 4, 0, 2, "Office") + tn("globe", "Remote", 0, 0, 1, "Remote") + "</div></div>" +
      '<div class="stack">' +
      /* @impl Branch header: name, BranchStatus badge, BranchKind badge, Headquarters badge (Branch.is_headquarters), code, path, depth, parent. Actions: Edit (Dialog/Form), Archive (AlertDialog). */
      '<div class="cd"><div class="hdr-card"><span class="avatar xl sq n">' + I("building", 20) + '</span><div class="nm"><h2>Athens ' + S("ACTIVE") + E("OFFICE") + '<span class="badge purple">Headquarters</span></h2><div class="muted">code ' + keyc("ATH") + " · path " + keyc("/greece/athens") + " · depth 2 · parent: Greece</div></div>" + btn("Archive", "archive") + btn("Edit", "edit") + "</div></div>" +
      '<div class="g2">' + cd("<b>Location & contact</b>", kv("Country · region · city", "GR · Attica · Athens") + kv("Address", "12 Ermou St, 10563") + kv("Phone", "+30 21 0000 0000") + kv("Email", "athens@logiqdev.example") + kv("Cost center", "CC-ATH-01")) +
      /* @impl Localization card = Branch overrides of Organization defaults (currency, timezone, locale, language, date_format, week_start, working_days, business_hours). Null = inherited:
           show the organization value in muted text with an "Inherited" tag. Business hours drive SLA timers (13), calendar (19) and leave (10). */
      cd("<b>Localization</b><span class='r muted'>overrides organization defaults (§120)</span>", kv("Currency", "EUR") + kv("Timezone", "Europe/Athens") + kv("Locale · language", "el-GR · en") + kv("Date format · week start", "DD/MM/YYYY · Monday") + kv("Working days", "Mon–Fri") + kv("Business hours", "09:00–18:00")) + "</div>" +
      '<div class="g2">' +
      /* @impl Managers: BranchManager rows (membership + free-text title). Adding a manager does NOT grant permissions by itself: assign the Branch Admin role with BRANCH scope in the same flow (offer it). @audit branch.manager_changed */
      cd("<b>Branch managers</b><span class='r'>" + btn("Add", "plus", "sm") + "</span>", '<div class="rowx">' + who("AM", "", "Anna Meyer", "title: Delivery Lead") + '<span class="badge" style="margin-left:auto">BranchManager</span></div><div class="rowx">' + who("EP", "", "Elena Papadaki", "title: Finance Lead") + '<span class="badge" style="margin-left:auto">BranchManager</span></div>', 1) +
      /* @impl Holidays: BranchHoliday rows (name, date, recurring). Consumed by Calendar (19) and Employees (10). Offer "Import national holidays" per country. */
      cd("<b>Holidays</b><span class='r'>" + btn("Add", "plus", "sm") + "</span>", '<div class="rowx"><div class="grow"><b>New Year’s Day</b><small>Jan 1 · recurring</small></div></div><div class="rowx"><div class="grow"><b>Greek Independence Day</b><small>Mar 25 · recurring</small></div></div><div class="rowx"><div class="grow"><b>Orthodox Easter Monday</b><small>Apr 13, 2026 · one-off</small></div></div>', 1) + "</div>" +
      '<div class="mini-stats" style="margin-bottom:0">' + stat("Members", 14, "MembershipBranch") + stat("Teams", 5, "Team.branch_id") + stat("Projects", 9, "from Projects (05)") + stat("Customers", 12, "from CRM (02)") + stat("Open tasks", 118, "from Tasks (06)") + "</div>" +
      "</div></div>" +
      dm(["Branch · name, code, kind, status, parent_branch_id, path, depth, is_headquarters, country/region/city/address, cost_center_code, currency, timezone, locale, language, date_format, week_start, working_days, business_hours", "BranchManager (title) · BranchHoliday (name, date, recurring) · MembershipBranch"], ["Dashboard metrics (projects, customers, tasks) belong to modules 02 / 05 / 06 and are fetched from them"]) + "</div>";
  }

  /* =====================================================================================================================
     TEAMS (spec §40–43, §82)
     @route  /admin/teams?kind=&branch=&q=
     @perm   VIEW organizations.teams.read · create/edit/archive organizations.teams.manage · members organizations.teams.members.manage
     @api    GET /teams?kind=&branch_id=&q= (tree via parent_team_id) · POST /teams · PATCH /teams/:id · PUT /teams/:id/members
     @mcp    organizations_teams_read, organizations_teams_manage
     @data   Team (name, slug, description, kind TeamKind, parent_team_id, branch_id, archived_at) · TeamMembership (team_role, is_primary, is_lead, started_at, ended_at)
     @ui     Table with indented rows (tree), ToggleGroup (kind), Dialog+Form (create/edit), Combobox (parent, branch, lead)
     @states loading · empty · error · no-access
     @audit  team.created | team.updated | team.archived | membership.team_assigned | membership.team_removed
     @note   Teams are NOT branches (§82). branch_id null = organization-wide team; a branch-restricted team (§88) only accepts members of that branch. Departments = kind DEPARTMENT and are what
             Finance/HR/Employees reference as "department". Lead = TeamMembership.is_lead (several leads allowed; team_role stays a free label). Permissions never come from team membership
             alone: they come from RoleAssignment scoped to the team (scope_type TEAM).
     ===================================================================================================================== */
  function teams() {
    /* name, TeamKind, parent, branch, lead (TeamMembership.is_lead), member count, indent */
    const T = [
      ["Engineering", "DEPARTMENT", "—", "Organization-wide", "Marco Silva", 8, 0],
      ["Web squad", "TEAM", "Engineering", "Organization-wide", "Marco Silva", 5, 1],
      ["Mobile squad", "TEAM", "Engineering", "Thessaloniki", "Jon Kim", 3, 1],
      ["Delivery", "DEPARTMENT", "—", "Organization-wide", "Anna Meyer", 4, 0],
      ["Acme Rebrand team", "PROJECT_TEAM", "Delivery", "Athens", "Anna Meyer", 6, 1],
      ["Design", "DEPARTMENT", "—", "Thessaloniki", "Sofia Jensen", 3, 0],
      ["Support", "DEPARTMENT", "—", "Athens", "Kim Lund", 3, 0],
      ["Sales", "BUSINESS_UNIT", "—", "Organization-wide", "Nikos Georgiou", 3, 0],
      ["Finance", "DEPARTMENT", "—", "Athens", "Elena Papadaki", 2, 0],
    ];
    return '<div class="a-page">' + head("Teams", "Functional groups with a hierarchy (parent_team_id). Departments are teams of kind DEPARTMENT (§43). Teams are not branches (§82).", lnk("Create team", "plus", "primary", "teamnew")) +
      /* @impl Kind filter = TeamKind enum (TEAM|DEPARTMENT|BUSINESS_UNIT|PROJECT_TEAM). */
      '<div class="toolbar">' + search("Search teams…") + '<div class="seg"><button class="on">All</button><button>Team</button><button>Department</button><button>Business unit</button><button>Project team</button></div></div>' +
      '<div class="panel" style="margin-top:0"><table><thead><tr><th>Team</th><th>Kind</th><th>Parent</th><th>Branch</th><th>Lead</th><th class="num">Members</th><th></th></tr></thead><tbody>' +
      T.map((t) => '<tr class="clk" onclick="location.hash=\'#admin/team\'"><td><div class="name" style="padding-left:' + t[6] * 22 + 'px">' + I("people", 15) + t[0] + "</div></td><td>" + E(t[1], t[1] === "DEPARTMENT" ? "blue" : "") + "</td><td>" + (t[2] === "—" ? muted("—") : t[2]) + "</td><td>" + (t[3] === "Organization-wide" ? muted(t[3]) : t[3]) + "</td><td>" + t[4] + '</td><td class="num">' + t[5] + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div>" +
      dm(["Team · name, slug, description, kind (TeamKind), parent_team_id, branch_id, archived_at", "TeamMembership · team_role, is_primary, is_lead, started_at, ended_at"], []) + "</div>";
  }

  /* =====================================================================================================================
     INVITATIONS (spec §65–67)
     @route  /admin/invitations?status=&q=
     @perm   VIEW users.members.read · send users.members.invite (further limited by OrganizationSecurityPolicy.invitation_policy: ADMINS_ONLY needs an admin role) ·
             external/guest invites users.external_collaborators.manage* · portal invites portal.users.manage*
     @api    GET /invitations?status= · POST /invitations {emails[], audience, type, role_id, branch_id, team_id, modules[], customer_id?, message, expires_in_days} ·
             POST /invitations/:id/resend|cancel · GET /invitations/link (copy invite link, source INVITATION_LINK) · POST /invitations/import (CSV, source BULK_IMPORT)
     @mcp    users_members_invite
     @data   Invitation (email, audience, type, role_id, branch_id, team_id, modules, source, status, message, expires_at, accepted/cancelled/rejected_at, customer_id, invited_by_user_id)
     @ui     Table, ToggleGroup (status), Sheet or inline form (the mock shows it as a side card), Combobox (role, branch, team, customer), Textarea for emails (comma/line separated) with chips
     @states loading · empty · error · no-access · per-email validation errors (invalid email, already a member, domain not allowed)
     @audit  invitation.sent | invitation.cancelled | invitation.accepted | invitation.rejected | invitation.expired (system) | invitation.bulk_imported
     @note   Tokens are single-use, stored only as token_hash; the raw token appears once in the email/link. Expiry is a background job (writes invitation.expired with actor SYSTEM). If
             OrganizationSecurityPolicy.restrict_invitations_to_domains is on, reject emails outside allowed_email_domains server-side. audience MEMBER uses role/branch/team/modules; audience
             CUSTOMER_PORTAL uses customer_id + a CUSTOMER_PORTAL role and creates a CustomerPortalMembership on accept. History is preserved (never delete rows).
     ===================================================================================================================== */
  function invitations() {
    /* email, audience, MembershipType, customer, role, branch, team, source, InvitationStatus, expires, invited_by */
    const Rw = [
      ["dana@logiqdev.example", "MEMBER", "INTERNAL", "", "Employee", "Athens", "Marketing", "MANUAL", "PENDING", "in 5 days", "Petros R."],
      ["lucas@acme.example", "CUSTOMER_PORTAL", "INTERNAL", "Acme Corp", "Customer Viewer", "—", "—", "MANUAL", "PENDING", "in 2 days", "Anna Meyer"],
      ["freelancer@mail.example", "MEMBER", "EXTERNAL_COLLABORATOR", "", "External Collaborator", "—", "Web squad", "INVITATION_LINK", "PENDING", "in 12 days", "Anna Meyer"],
      ["maria@logiqdev.example", "MEMBER", "INTERNAL", "", "Support Agent", "Athens", "Support", "BULK_IMPORT", "ACCEPTED", "Nov 3", "Petros R."],
      ["peter@mail.example", "MEMBER", "INTERNAL", "", "Developer", "Thessaloniki", "Engineering", "MANUAL", "EXPIRED", "Oct 20", "Jon Kim"],
      ["old@mail.example", "MEMBER", "GUEST", "", "Viewer", "Athens", "—", "API", "CANCELLED", "—", "Petros R."],
      ["spam@mail.example", "MEMBER", "INTERNAL", "", "Employee", "Athens", "—", "INVITATION_LINK", "REJECTED", "—", "Petros R."],
    ];
    return '<div class="a-page">' + head("Invitations", "Invite by email, link, bulk import, SSO/SCIM provisioning or API (§65). History is kept (§66).", btn("Copy invite link", "link") + btn("Bulk import", "")) +
      '<div class="g-main"><div class="stack">' +
      /* @impl Status filter = InvitationStatus enum (PENDING|ACCEPTED|EXPIRED|CANCELLED|REJECTED). Count badge on Pending only. */
      '<div class="seg" style="align-self:flex-start"><button class="on">All</button><button>Pending 3</button><button>Accepted</button><button>Expired</button><button>Cancelled</button><button>Rejected</button></div>' +
      /* @impl Columns: Invitee (email; customer shown under it for portal invites) · Type = audience + MembershipType · Source = ProvisioningSource · Expires = expires_at (relative while pending, date after).
           Resend only for PENDING (rotates token_hash and extends expiry). */
      '<div class="panel" style="margin-top:0"><div class="tbl-scroll"><table><thead><tr><th>Invitee</th><th>Type</th><th>Role</th><th>Branch</th><th>Team</th><th>Source</th><th>Status</th><th>Expires</th><th>Invited by</th><th></th></tr></thead><tbody>' +
      Rw.map((r) => "<tr><td class='ink'>" + r[0] + (r[3] ? '<div class="sub-note">Customer: ' + r[3] + "</div>" : "") + "</td><td>" + (r[1] === "CUSTOMER_PORTAL" ? E("CUSTOMER_PORTAL", "blue") : r[2] === "INTERNAL" ? muted("Internal") : E(r[2], "yellow")) + "</td><td>" + r[4] + "</td><td>" + r[5] + "</td><td>" + r[6] + "</td><td>" + E(r[7]) + "</td><td>" + S(r[8]) + '</td><td class="muted">' + r[9] + "</td><td>" + r[10] + "</td><td>" + (r[8] === "PENDING" ? btn("Resend", "", "sm") : "") + "</td></tr>").join("") + "</tbody></table></div></div></div>" +
      /* @impl Invite form (react-hook-form + zod). Audience toggles which fields apply: MEMBER -> type, role, branch, team, modules; CUSTOMER_PORTAL -> customer + portal role. Module access defaults to the
           chosen role's Role.modules and can be narrowed. Validate emails per row and show inline errors; submit is a single call returning per-email results. */
      cd("<b>Invite members</b>", fld("Emails", '<div class="inp tall">name@company.com, …</div>') + fld("Audience", '<div class="seg"><button class="on">Member</button><button>Customer portal</button></div>') + fld("Type", sel("Internal", "users")) + fld("Role", sel("Developer", "shield")) + fld("Branch", sel("Athens", "building")) + fld("Team", sel("Engineering", "people")) + fld("Module access", sel("From role · 7 modules", "layers")) + fld("Customer (portal invites)", sel("— none —", "building")) + fld("Message", '<div class="inp">Optional note</div>') + fld("Expires", sel("7 days", "clock")) + '<button class="btn primary" style="width:100%">' + I("send", 14) + " Send invitations</button>") + "</div>" +
      dm(["Invitation · email, audience (InvitationAudience), type (MembershipType), branch_id, team_id, role_id, modules (ModuleKey[]), status, source (ProvisioningSource), message, expires_at, accepted_at, cancelled_at, rejected_at, customer_id, invited_by_user_id"], []) + "</div>";
  }

  /* =====================================================================================================================
     SECURITY (spec §72–74)
     @route  /admin/security
     @perm   VIEW organizations.security.manage* (the screen is manage-only; there is no read-only variant) · ACTION save: same key
     @api    GET /security-policy · PATCH /security-policy {fields}  (partial updates; each control saves on change with optimistic UI, or one Save button for the whole form)
     @mcp    organizations_security_manage* (needs human confirmation for AI callers)
     @data   OrganizationSecurityPolicy (mfa_policy, portal_mfa_policy, password_min_length, password_require_symbols, password_max_age_days, session_duration_minutes, idle_timeout_minutes,
             allowed_email_domains, restrict_invitations_to_domains, allowed_ip_ranges, allowed_countries, invitation_policy, members_can_view_sessions, sso_required)
     @ui     Card + setting rows, ToggleGroup (enums), Select (durations; store MINUTES), Switch, tag input (domains, IPs, countries), AlertDialog for risky changes
     @states loading · error · saving · no-access
     @audit  organization.security_policy_changed (metadata = before/after)
     @note   RISKY CHANGES need a confirmation that states the blast radius and a safety net: enabling MFA "for all" or sso_required can lock users out; allowed_ip_ranges / allowed_countries must be
             validated against the CALLER'S current IP/country before saving so an admin cannot lock themselves out. sso_required can only be turned on when an SsoConfiguration is enabled and
             a domain is VERIFIED. Policy changes apply to NEW sessions immediately and to existing ones at next refresh. Durations are stored in minutes: convert for display.
             Security notifications (new admin, MFA disabled, large permission change) are delivered by module 14, not configured here.
     ===================================================================================================================== */
  function security() {
    const row = (t, s, ctl) => '<div class="setting"><div class="grow"><b>' + t + "</b><small>" + s + "</small></div>" + ctl + "</div>";
    const w = (t) => sel(t).replace('class="sel"', 'class="sel" style="width:170px"');
    return '<div class="a-page">' + head("Sign-in & MFA", "OrganizationSecurityPolicy (§73–74). Applies to every member.", btn("View security events", "bell")) +
      '<div class="g-main"><div class="stack">' +
      /* @impl MFA policy enum = MfaPolicy (OPTIONAL | REQUIRED_FOR_ADMINS | REQUIRED_FOR_ALL | REQUIRED_FOR_SENSITIVE_MODULES). "Sensitive modules" = modules containing sensitive permission keys; the API decides. */
      cd("<b>Multi-factor authentication</b>", row("MFA policy", keyc("mfa_policy"), '<div class="seg"><button>Optional</button><button class="on">Required for admins</button><button>Required for all</button><button>Sensitive modules</button></div>') + row("Customer portal MFA", keyc("portal_mfa_policy"), '<div class="seg"><button class="on">Optional</button><button>Required for all</button></div>'), 1) +
      cd("<b>Password & sessions</b>", row("Minimum length", keyc("password_min_length"), w("12 characters")) + row("Require symbols", keyc("password_require_symbols"), sw(1)) + row("Password max age", keyc("password_max_age_days") + " · empty = never", w("90 days")) + row("Session duration", keyc("session_duration_minutes"), w("14 days")) + row("Idle timeout", keyc("idle_timeout_minutes"), w("120 minutes")) + row("Members can view and revoke their own sessions", keyc("members_can_view_sessions") + " · §72", sw(1)), 1) +
      /* @impl Access restrictions: allowed_email_domains / allowed_ip_ranges (CIDR) / allowed_countries (ISO alpha-2) are tag inputs with format validation. invitation_policy enum = InvitationPolicy
           (PERMISSION_HOLDERS | ADMINS_ONLY). Remember the lock-out check described in @note above. */
      cd("<b>Access restrictions</b>", row("Allowed email domains", keyc("allowed_email_domains"), tok("logiqdev.example")) + row("Restrict invitations to these domains", keyc("restrict_invitations_to_domains"), sw(1)) + row("Who can invite", keyc("invitation_policy"), '<div class="seg"><button class="on">Permission holders</button><button>Admins only</button></div>') + row("Allowed IP ranges", keyc("allowed_ip_ranges") + " · empty = anywhere", '<span class="badge">None set</span>') + row("Allowed sign-in countries", keyc("allowed_countries") + " · empty = anywhere", tok("GR") + " " + tok("CY")) + row("Require SSO", keyc("sso_required"), sw(0)), 1) +
      "</div><div class=\"stack\">" +
      callout("bell", "<b>Security notifications</b> (new admin, MFA disabled, large permission change…) are delivered by module 14 Notifications and are not configured here (§146).") + "</div></div>" +
      dm(["OrganizationSecurityPolicy · mfa_policy, portal_mfa_policy, password_min_length, password_require_symbols, password_max_age_days, session_duration_minutes, idle_timeout_minutes, allowed_email_domains, restrict_invitations_to_domains, allowed_ip_ranges, allowed_countries, invitation_policy, members_can_view_sessions, sso_required"], []) + "</div>";
  }

  /* =====================================================================================================================
     SSO & DOMAINS (spec §68–71)
     @route  /admin/sso
     @perm   VIEW + ACTION organizations.sso.manage* · domains organizations.domains.manage*
     @api    GET/PUT /sso-configurations · POST /sso-configurations/:id/test · POST /sso-configurations/:id/enable|disable · POST /sso-configurations/:id/scim/token (rotate; returns token ONCE) ·
             GET/POST /domains · POST /domains/:id/verify · GET/PUT /sso-configurations/:id/group-mappings
     @mcp    organizations_sso_manage*, organizations_domains_manage* (need human confirmation for AI callers)
     @data   SsoConfiguration (name, protocol SAML|OIDC, enabled, config JSON, auto_provision, scim_enabled, scim_token_hash, scim_last_synced_at) · OrganizationDomain (domain, status
             DomainVerificationStatus, verification_token, verified_at, allow_discovery, auto_provision) · SsoGroupMapping (external_group, role_id, team_id, branch_id, modules)
     @ui     Card, Form (provider config differs by protocol), Switch, Table (mappings), Dialog (add domain / add mapping), CopyButton for DNS records / SCIM endpoint
     @states loading · not configured (empty state with "Add provider") · testing · error (show provider error verbatim, no secrets) · no-access
     @audit  sso.configuration_changed | domain.verified | domain.revoked
     @note   SECRETS: `config` holds issuer, entity id, metadata URL, client id, certificates. Client secrets/private keys are stored ENCRYPTED and NEVER returned by the API (write-only fields).
             scim_token_hash is a hash: show the SCIM token once at creation. A provider can only be enabled when at least one domain is VERIFIED and a successful "Test connection" ran.
             Group mappings give provisioned members their role/team/branch/modules (provisioning_source SSO or SCIM). scim_last_synced_at is written by the SCIM endpoint on each sync.
     ===================================================================================================================== */
  function sso() {
    return '<div class="a-page">' + head("SSO & domains", "Identity provider, SCIM, verified domains and group mappings.", btn("Test connection", "zap") + btn("Add provider", "plus", "primary")) +
      callout("shield", "<b>SSO is not enabled.</b> Members sign in with password + MFA. Verify a domain, then enable the provider.", "warn") + '<div style="height:14px"></div>' +
      '<div class="g2">' +
      /* @impl Provider card: fields shown are SsoConfiguration columns + keys inside `config` JSON (labelled "(config JSON)"). Different fields per protocol (SAML: entity id, SSO URL, certificate;
           OIDC: issuer, client id/secret). The enabled flag is a Switch guarded by the preconditions in @note. */
      cd("<b>Okta</b><span class='r'>" + E("SAML") + "<span class='badge'>enabled = false</span></span>", kv("Name", "Okta") + kv("Protocol", E("SAML")) + kv("Entity ID <small class='muted'>(config JSON)</small>", '<span class="key">urn:logiqdev:os:org_8f3a</span>') + kv("Sign-in URL <small class='muted'>(config JSON)</small>", '<span class="key">https://logiqdev.okta.example/sso</span>') + kv("Auto-provision users", sw(1))) +
      /* @impl SCIM card: scim_enabled Switch, endpoint (read-only, copy), token (rotate -> shown once), last sync = scim_last_synced_at (relative time, "Never" when null). */
      cd("<b>SCIM</b><span class='r'>" + sw(0) + "</span>", kv("scim_enabled", "false") + kv("Endpoint", '<span class="key">/scim/v2</span>') + kv("Token", '<span class="key">stored as hash only</span>') + kv("Last sync", "Never") + callout("link", "SCIM-provisioned members get <b>provisioning_source = SCIM</b> and a membership from group mappings.")) + "</div>" +
      '<div class="g2" style="margin-top:14px">' +
      /* @impl Domains: OrganizationDomain rows with status badge (PENDING shows the TXT record to add: name + verification_token; FAILED/REVOKED allow retry). allow_discovery = users with this email domain
           can find the org on sign-in; auto_provision = create membership on first SSO sign-in. */
      cd("<b>Domains</b><span class='r'>" + btn("Add domain", "plus", "sm") + "</span>", '<div class="rowx"><div class="grow"><b>logiqdev.example</b><small>verified Mar 2025 · discovery on · auto-provision off</small></div>' + S("VERIFIED") + '</div><div class="rowx"><div class="grow"><b>logiqdev.cy</b><small>TXT <span class="key">lq-verify=8f3a…</span></small></div>' + S("PENDING") + '</div><div class="rowx"><div class="grow"><b>old-agency.example</b><small>verification failed</small></div>' + S("FAILED") + "</div>", 1) +
      cd("<b>Group mappings</b><span class='r'>" + btn("Add mapping", "plus", "sm") + "</span>", '<table><thead><tr><th>external_group</th><th>Role</th><th>Team</th><th>Branch</th><th>Modules</th></tr></thead><tbody><tr><td class="key">eng-athens</td><td>Developer</td><td>Engineering</td><td>Athens</td><td>7</td></tr><tr><td class="key">sales-cy</td><td>Sales Manager</td><td>Sales</td><td>Limassol</td><td>7</td></tr><tr><td class="key">finance</td><td>Finance Manager</td><td>Finance</td><td>—</td><td>6</td></tr></tbody></table>', 1) + "</div>" +
      dm(["SsoConfiguration · name, protocol (SAML|OIDC), enabled, config (JSON), auto_provision, scim_enabled, scim_token_hash, scim_last_synced_at", "OrganizationDomain · domain, status, verification_token, verified_at, allow_discovery, auto_provision", "SsoGroupMapping · external_group, role_id, team_id, branch_id, modules"], []) + "</div>";
  }

  /* =====================================================================================================================
     SESSIONS (spec §72)
     @route  /admin/sessions?member=&q=
     @perm   VIEW users.sessions.read* · revoke users.sessions.revoke*
     @api    GET /sessions?member_id= (active only by default) · DELETE /sessions/:id {reason} · POST /sessions/revoke-all {except_current: true}
     @mcp    users_sessions_read*, users_sessions_revoke*
     @data   UserSession (device, browser, ip_address, location_approx, active_organization_id, active_branch_id, active_branch_ids, last_activity_at, expires_at, revoked_at, revoked_reason) + User/Membership
     @ui     Table, AlertDialog (revoke / revoke all), Badge ("This device")
     @states loading · empty · error · no-access
     @audit  session.revoked
     @note   Revoke = set revoked_at + revoked_reason and make the token invalid immediately (check revoked_at on every request or via a denylist cache). Never return token_hash.
             "Active branches" shows the session's context (active_branch_ids, falling back to active_branch_id; empty = all). Location is approximate (GeoIP): label it as such.
     ===================================================================================================================== */
  function sessions() {
    const Rw = [["Petros Rodinos", "MacBook · Chrome 131", "85.74.x.x", "Athens, GR", "Athens", "Now", "Nov 25"], ["Anna Meyer", "MacBook · Chrome 131", "85.74.x.x", "Athens, GR", "Athens +1", "2m ago", "Nov 25"], ["Marco Silva", "Windows · Edge 130", "94.66.x.x", "Athens, GR", "Athens", "14m ago", "Nov 24"], ["Sofia Jensen", "iPad · Safari", "79.131.x.x", "Thessaloniki, GR", "All", "1h ago", "Nov 22"], ["Nikos Georgiou", "MacBook · Chrome 131", "212.x.x.x", "Limassol, CY", "Limassol", "Yesterday", "Nov 20"]];
    return '<div class="a-page">' + head("Sessions", "Active UserSessions in this organization. Revoking signs the device out.", btn("Revoke all except mine", "x")) +
      '<div class="panel" style="margin-top:0"><table><thead><tr><th>Member</th><th>Device · browser</th><th>IP</th><th>Location</th><th>Active branches</th><th>Last activity</th><th>Expires</th><th></th></tr></thead><tbody>' + Rw.map((r) => "<tr><td><b class='ink'>" + r[0] + "</b></td><td>" + r[1] + '</td><td class="mono">' + r[2] + "</td><td>" + r[3] + "</td><td>" + r[4] + '</td><td class="muted">' + r[5] + '</td><td class="muted">' + r[6] + "</td><td>" + btn("Revoke", "", "sm") + "</td></tr>").join("") + "</tbody></table></div>" +
      dm(["UserSession · device, browser, ip_address, location_approx, active_organization_id, active_branch_id, active_branch_ids, last_activity_at, expires_at, revoked_at, revoked_reason"], []) + "</div>";
  }

  /* =====================================================================================================================
     API KEYS + SERVICE ACCOUNTS (spec §75–76)
     @route  /admin/api-keys?tab=keys|service-accounts
     @perm   VIEW + ACTION organizations.api_keys.manage* (keys) · organizations.service_accounts.manage* (service accounts)
     @api    GET /api-keys · POST /api-keys {name, owner (membership|service_account), scope_type, scope_id, scopes[], expires_at, rotation_due_at} (returns the SECRET ONCE) ·
             POST /api-keys/:id/rotate (creates a new key with rotated_from_id, old key stays valid for a grace period) · POST /api-keys/:id/revoke ·
             GET/POST /service-accounts · PATCH /service-accounts/:id · POST /service-accounts/:id/suspend|revoke · role assignments via /service-accounts/:id/role-assignments
     @mcp    organizations_api_keys_manage*, organizations_service_accounts_manage* (need human confirmation for AI callers)
     @data   ApiKey (name, key_prefix, key_hash, scopes[] permission keys, scope_type, scope_id, expires_at, rotation_due_at, last_used_at, rotated_from_id, revoked_at; owner = membership_id | service_account_id) ·
             ServiceAccount (name, purpose, owner_membership_id, status ACTIVE|SUSPENDED|REVOKED, expires_at) · RoleAssignment (service_account_id: where a service account's permissions come from)
     @ui     Tabs, Table, Dialog+Form (create), "show once" Dialog with CopyButton, AlertDialog (rotate/revoke), DropdownMenu
     @states loading · empty · error · no-access
     @audit  api_key.created | api_key.rotated | api_key.revoked | service_account.created | service_account.suspended | service_account.revoked
     @note   NEVER inherits a human's full access (§75): effective permissions = owner's permissions ∩ key.scopes (if set) ∩ key scope (scope_type/scope_id). Only the key_prefix is stored for display;
             the secret is shown ONCE at creation. No status column on ApiKey: derive Active / Expires soon (expires_at or rotation_due_at within 14 days) / Expired / Revoked in the API.
             Keys work on REST and MCP identically (same authorization service). Service accounts are non-human: audit actor_type SERVICE_ACCOUNT; they do not count as employees or seats.
     ===================================================================================================================== */
  function apikeys(s) {
    /* name, key_prefix, owner, scope (scope_type + target), scopes[] (permission keys), expires, rotation due, last_used, rotated_from, derived status, tone */
    const keys = [
      ["Zapier sync", "lq_live_4f9a…", "Anna Meyer", "Organization", ["tasks.tasks.read", "tasks.tasks.create"], "Dec 31, 2026", "Dec 1", "2m ago", "—", "Active", "green"],
      ["Website lead form", "lq_live_c21d…", "SA · Lead intake", "Organization", ["crm.leads.create"], "Mar 1, 2027", "Feb 1", "1h ago", "rotated from lq_live_77b0…", "Active", "green"],
      ["Reporting export", "lq_live_9e03…", "Elena Papadaki", "Branch · Athens", ["finance.invoices.read"], "Nov 30, 2026", "Nov 20", "Never", "—", "Expires soon", "yellow"],
      ["Old CI key", "lq_live_1a8c…", "Marco Silva", "Organization", ["projects.projects.read"], "Oct 1, 2026", "—", "Oct 14", "—", "Expired", ""],
      ["Test key", "lq_live_5d77…", "Marco Silva", "Project · Acme Rebrand", ["tasks.tasks.read"], "—", "—", "Sep 2", "—", "Revoked", "red"],
    ];
    /* name, purpose, owner, RoleAssignments, ServiceAccountStatus, expires, #keys */
    const sa = [
      ["Lead intake", "Creates CRM leads from the website form", "Anna Meyer", "Sales Manager (ORGANIZATION)", "ACTIVE", "—", 1],
      ["AI assistant agent", "Drafts replies and summaries; sensitive actions need human confirmation", "Petros R.", "Support Agent (ORGANIZATION)", "ACTIVE", "—", 1],
      ["Invoice reminder bot", "Runs the overdue invoice automation", "Elena Papadaki", "Finance Manager (BRANCH · Athens)", "SUSPENDED", "Dec 31, 2026", 2],
      ["Legacy importer", "One-off CRM import", "Petros R.", "Admin (ORGANIZATION)", "REVOKED", "Mar 1, 2026", 0],
    ];
    const on = s === "service" ? "s" : "k";
    return '<div class="a-page">' + head("API keys & service accounts", "Credentials never inherit a human’s full access (§75). They work on REST and MCP, checked by the same authorization service.", lnk("Create service account", "plus", "", "servicenew") + lnk("Create API key", "plus", "primary", "apikeynew")) +
      '<div class="tabset">' + tabs([["k", "API keys", 5], ["s", "Service accounts", 4]], on) +
      /* @impl API keys table: Key = key_prefix only · Scope = scope_type + target (ApiKey.scope_type/scope_id) · Permissions = scopes[] (permission keys, "all of owner's" when empty) · Rotation due = rotation_due_at ·
           Status is DERIVED (see @note). Row actions: Rotate, Revoke, Edit scopes (not the owner). */
      pane("k", on === "k", '<div class="panel" style="margin-top:0"><div class="tbl-scroll"><table><thead><tr><th>Name</th><th>Key</th><th>Owner</th><th>Scope</th><th>Permissions</th><th>Expires</th><th>Rotate by</th><th>Last used</th><th>Status</th><th></th></tr></thead><tbody>' + keys.map((k) => '<tr><td><div class="name">' + I("link", 15) + k[0] + "</div>" + (k[8] !== "—" ? '<div class="sub-note">' + k[8] + "</div>" : "") + '</td><td class="key">' + k[1] + "</td><td>" + k[2] + "</td><td>" + k[3] + "</td><td>" + k[4].map(keyc).join("<br>") + '</td><td class="muted">' + k[5] + '</td><td class="muted">' + k[6] + '</td><td class="muted">' + k[7] + '</td><td><span class="badge ' + k[10] + '">' + k[9] + "</span></td><td>" + more + "</td></tr>").join("") + '</tbody></table></div></div><div class="sub-note" style="margin-top:8px">Status is derived from expires_at / rotation_due_at / revoked_at; ApiKey has no status column.</div>') +
      /* @impl Service accounts table: Role assignments = RoleAssignment rows with service_account_id (role + scope). API keys = count of non-revoked ApiKey. Status = ServiceAccountStatus. */
      pane("s", on === "s", '<div class="panel" style="margin-top:0"><div class="tbl-scroll"><table><thead><tr><th>Service account</th><th>Purpose</th><th>Owner</th><th>Role assignments</th><th class="num">API keys</th><th>Expires</th><th>Status</th><th></th></tr></thead><tbody>' + sa.map((k) => '<tr><td><div class="name"><span class="avatar sq n">' + I("bot", 13) + "</span>" + k[0] + '</div></td><td class="muted" style="white-space:normal;max-width:260px">' + k[1] + "</td><td>" + k[2] + "</td><td>" + k[3] + '</td><td class="num">' + k[6] + '</td><td class="muted">' + k[5] + "</td><td>" + S(k[4]) + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div></div>") + "</div>" +
      dm(["ApiKey · name, key_prefix, scopes (permission keys), scope_type, scope_id, expires_at, rotation_due_at, last_used_at, rotated_from_id, revoked_at; owner = membership_id or service_account_id", "ServiceAccount · name, purpose, owner_membership_id, status (ACTIVE|SUSPENDED|REVOKED), expires_at", "RoleAssignment · service_account_id (permissions come from roles + scope)"], ["Key status is derived from dates (no status column), by design"]) + "</div>";
  }

  /* =====================================================================================================================
     AUDIT LOG (spec §99–100, §139)
     @route  /admin/audit?q=&event_type=&actor_type=&resource_type=&branch=&from=&to=&cursor=
     @perm   VIEW organizations.audit.read* (event types flagged `sensitive` are hidden from callers without it) · export writes data.exported
     @api    GET /audit-events?... (cursor, newest first) · GET /audit-events/:id · POST /audit-events/export
     @mcp    organizations_audit_read*
     @data   AuditEvent (actor_type, actor_user_id, actor_service_account_id, event_type, resource_type, resource_id, branch_id, metadata JSON, ip_address, user_agent, created_at)
     @ui     Table (cursor pagination, newest first), filter bar (Popover+Command), side Sheet/aside with the detail, JSON diff viewer for `metadata.before/after`
     @states loading · empty filter result · error · no-access
     @note   IMMUTABLE: no update/delete endpoints, ever. The Event type filter options and labels come from api/src/shared/constants/audit-event-types.ts (AUDIT_EVENT_TYPES), grouped by resource.
             Scope column = AuditEvent.branch_id (resolve to the branch NAME at read time; the id is a plain value because audit rows survive branch deletion); null = organization-wide. Branch-scoped
             callers only see events whose branch_id is within their scope. Never display secrets: the API must strip them from `metadata` before writing. IP/user agent are personal data: respect
             the organization's retention policy (§100) and show only to callers with the audit permission.
     ===================================================================================================================== */
  function audit() {
    /* when, initials, color, actor name, AuditActorType, event_type (canonical), resource, branch (AuditEvent.branch_id resolved), ip, tone */
    const Ev = [
      ["2h ago", "PR", "", "Petros R.", "USER", "membership.admin_promoted", "membership · Elena Papadaki", "—", "85.74.x.x", "yellow"],
      ["Yesterday", "AM", "", "Anna Meyer", "USER", "membership.role_assigned", "membership · Marco Silva", "Athens", "85.74.x.x", ""],
      ["Yesterday", "SJ", "y", "Sofia Jensen", "USER", "user.mfa_disabled", "user_auth_method · TOTP", "—", "79.131.x.x", "red"],
      ["Yesterday", "⚡", "n", "Lead intake", "SERVICE_ACCOUNT", "api_key.created", "api_key · lq_live_c21d…", "—", "—", ""],
      ["3d ago", "PR", "", "Petros R.", "USER", "organization.module_enabled", "organization_module · COMMUNICATION", "—", "85.74.x.x", ""],
      ["3d ago", "AM", "", "Anna Meyer", "USER", "session.revoked", "user_session · iPad", "Athens", "85.74.x.x", ""],
      ["4d ago", "⚙", "n", "System", "SYSTEM", "invitation.expired", "invitation · peter@mail.example", "Thessaloniki", "—", ""],
      ["5d ago", "PA", "n", "Platform admin", "PLATFORM_ADMIN", "organization.status_changed", "organization · SETUP → ACTIVE", "—", "—", "blue"],
    ];
    return '<div class="a-page">' + head("Audit log", "Immutable AuditEvents. Identity and access changes are written by module 01; other modules append theirs (§99–100).", btn("Export", "") + btn("Retention policy", "settings")) +
      /* @impl Filter chips: event_type (multi-select grouped by resource, from the catalog), actor_type (AuditActorType), resource_type, branch, date range. Persist in the query string. */
      '<div class="toolbar">' + search("Search event type, actor, resource…") + '<button class="btn">' + I("sort", 14) + ' event_type</button><button class="btn">actor_type</button><button class="btn">resource_type</button><button class="btn">' + I("building", 14) + ' branch</button><button class="btn">' + I("calendar", 14) + " Last 30 days</button></div>" +
      '<div class="g-main"><div class="panel" style="margin-top:0"><div class="tbl-scroll"><table><thead><tr><th>When</th><th>Actor</th><th>Event type</th><th>Resource</th><th>Scope</th><th>IP</th></tr></thead><tbody>' +
      Ev.map((e, i) => '<tr class="clk" ' + (i === 0 ? 'style="background:var(--elevated)"' : "") + '><td class="muted">' + e[0] + "</td><td>" + who(e[1], e[2], e[3], en(e[4])) + '</td><td><span class="badge key ' + e[9] + '">' + e[5] + "</span></td><td>" + e[6] + '</td><td class="muted">' + e[7] + '</td><td class="mono muted">' + e[8] + "</td></tr>").join("") + "</tbody></table></div></div>" +
      /* @impl Detail aside: all AuditEvent columns + `metadata` rendered as a diff when it has before/after, otherwise as a formatted JSON tree. Copy-id button for support. */
      cd("<b class='key'>membership.admin_promoted</b><span class='r muted'>2h ago</span>", kv("actor_type", E("USER")) + kv("actor_user_id", "Petros R.") + kv("resource_type", "membership") + kv("resource_id", '<span class="key">mem_7c1…</span>') + kv("branch_id", muted("— (organization-wide)")) + kv("ip_address", '<span class="mono">85.74.x.x</span>') + kv("user_agent", "Chrome 131 · macOS") + '<div class="muted" style="margin:10px 0 6px">metadata (JSON)</div><div class="diff"><div class="ctxl">{</div><div class="ctxl">  "role": "Admin",</div><div class="ctxl">  "scope_type": "ORGANIZATION",</div><div class="del">-  "previous_role": "Finance Manager"</div><div class="add">+  "reason": "Takes over billing admin"</div><div class="ctxl">}</div></div>') + "</div>" +
      dm(["AuditEvent · actor_type (USER|SERVICE_ACCOUNT|SYSTEM|PLATFORM_ADMIN), actor_user_id, actor_service_account_id, event_type, resource_type, resource_id, branch_id, metadata (JSON), ip_address, user_agent, created_at", "api/src/shared/constants/audit-event-types.ts · canonical event_type catalog"], []) + "</div>";
  }

  /* =====================================================================================================================
     ACCESS REVIEWS (spec §98) — new tables AccessReview + AccessReviewItem
     @route  /admin/access-reviews, /admin/access-reviews/:reviewId (master/detail; the mock shows both on one page)
     @perm   VIEW organizations.access_reviews.read* · create/start/complete/cancel/apply organizations.access_reviews.manage* · a REVIEWER decides ONLY the items assigned to them with
             organizations.access_reviews.decide* (a reviewer does not need manage)
     @api    GET /access-reviews · POST /access-reviews {name, scope_type, scope_id, modules[], due_at, reviewer_strategy} · GET /access-reviews/:id (+items) ·
             POST /access-reviews/:id/start (snapshots every in-scope member into AccessReviewItem) · PATCH /access-review-items/:id {decision, comment} ·
             POST /access-reviews/:id/apply (applies REVOKED/MODIFIED decisions) · POST /access-reviews/:id/complete|cancel
     @mcp    organizations_access_reviews_read*, organizations_access_reviews_manage*, organizations_access_reviews_decide* (need human confirmation for AI callers)
     @data   AccessReview (name, description, status, scope_type, scope_id, modules, starts_at, due_at, completed_at, created_by_membership_id) ·
             AccessReviewItem (review_id, membership_id, reviewer_membership_id, decision, decided_at, comment, access_snapshot JSON, applied_at)
     @ui     master list (Card rows or Table), detail Table with inline decision buttons (ToggleGroup: Certify / Revoke / Modify), Progress, Dialog for "Modify" (pick what to change), AlertDialog for Apply
     @states loading · empty ("No access reviews yet") · error · no-access · "not assigned to you" (a reviewer sees only their items)
     @audit  access_review.created | access_review.started | access_review.decision_recorded | access_review.decision_applied | access_review.completed | access_review.cancelled
     @note   Lifecycle: DRAFT -> IN_PROGRESS (start creates one item per in-scope member with an access_snapshot of roles, grants, module access and branch scopes) -> COMPLETED (all items decided and applied).
             Reviewers default to branch managers / team leads of the member's branch (strategy chosen at creation). A reviewer can NEVER review themselves (separation of duties §96).
             REVOKED / MODIFIED decisions take effect only on Apply (writes the changes through the normal services so audit and cache invalidation happen) and set applied_at.
             The snapshot makes the decision auditable even if roles change later. Scope ORGANIZATION / BRANCH / BRANCH_HIERARCHY / TEAM + optional `modules` narrow who is included.
     ===================================================================================================================== */
  function reviews() {
    /* name, AccessReviewStatus, scope label, due, decided, total */
    const L = [["Q4 2026 access review", "IN_PROGRESS", "Organization", "Dec 15", 14, 24], ["Finance module review", "DRAFT", "Modules: FINANCE", "Jan 10", 0, 4], ["Athens branch review (Q3)", "COMPLETED", "Branch · Athens", "Sep 30", 14, 14], ["Contractor check", "CANCELLED", "Team · Mobile squad", "Aug 1", 0, 3]];
    /* member, ini, color, reviewer, AccessReviewDecision, comment, snapshot summary (from access_snapshot), applied */
    const It = [
      ["Marco Silva", "MS", "g", "Anna Meyer", "CERTIFIED", "", "Developer · 7 modules", "—"],
      ["Sofia Jensen", "SJ", "y", "Anna Meyer", "MODIFIED", "Remove Finance module access", "Employee · 10 modules", "Pending apply"],
      ["Ivan Petrov", "IP", "p", "Anna Meyer", "REVOKED", "Left the team in October", "Developer · 7 modules (suspended)", "Pending apply"],
      ["Jon Kim", "JK", "r", "Anna Meyer", "PENDING", "", "Developer · 7 modules", "—"],
      ["Kim Lund", "KL", "p", "Elena Papadaki", "CERTIFIED", "", "Support Agent · 6 modules", "—"],
      ["Nikos Georgiou", "NG", "g", "Elena Papadaki", "PENDING", "", "Sales Manager · 7 modules", "—"],
    ];
    const dcls = { CERTIFIED: "green", REVOKED: "red", MODIFIED: "yellow", PENDING: "" };
    return '<div class="a-page">' + head("Access reviews", "Periodic certification of who has what (§98). Reviewers certify, revoke or modify each member’s access; decisions are applied in one step.", lnk("New access review", "plus", "primary", "reviewnew")) +
      '<div class="g-main" style="grid-template-columns:340px minmax(0,1fr)"><div class="stack">' +
      /* @impl Review list: AccessReview rows. Progress = items with decision != PENDING / total items. Selected row = open detail. Filter by status (AccessReviewStatus). */
      L.map((r, i) => '<div class="cd" style="' + (i === 0 ? "box-shadow:inset 2px 0 0 var(--primary)" : "") + '"><div class="cd-b"><div style="display:flex;align-items:center;gap:8px"><b class="ink" style="font-weight:500;flex:1">' + r[0] + "</b>" + S(r[1]) + '</div><div class="muted" style="margin:4px 0 8px">' + r[2] + " · due " + r[3] + '</div><div class="meter"><i style="width:' + (r[5] ? Math.round((r[4] / r[5]) * 100) : 0) + '%"></i></div><div class="sub-note" style="margin-top:4px">' + r[4] + " of " + r[5] + " decided</div></div></div>").join("") + "</div>" +
      '<div class="stack">' +
      /* @impl Review summary: scope_type + scope target, modules filter, dates, creator. Buttons depend on status: DRAFT -> Start · IN_PROGRESS -> Apply decisions / Complete (enabled when no PENDING items) / Cancel. */
      '<div class="cd"><div class="hdr-card"><div class="nm"><h2>Q4 2026 access review ' + S("IN_PROGRESS") + '</h2><div class="muted">scope ' + E("ORGANIZATION") + " · all modules · starts Nov 1 · due Dec 15 · created by Petros R.</div></div>" + btn("Cancel review", "x") + btn("Apply decisions (2)", "check") + btn("Complete", "check", "primary") + "</div></div>" +
      /* @impl Items table: one AccessReviewItem per member. Subject = membership; Access = summary of access_snapshot (roles + module count; click opens the full snapshot in a Sheet); Reviewer =
           reviewer_membership_id. Decision cell: for the assigned reviewer an inline ToggleGroup (Certify | Revoke | Modify); for everyone else a read-only Badge. Comment required for Revoke/Modify.
           Applied = applied_at (or "Pending apply" when decision is REVOKED/MODIFIED and applied_at is null). */
      '<div class="panel" style="margin-top:0"><div class="tbl-scroll"><table><thead><tr><th>Member</th><th>Access at review time</th><th>Reviewer</th><th>Decision</th><th>Comment</th><th>Applied</th></tr></thead><tbody>' +
      It.map((r) => "<tr><td>" + who(r[1], r[2], r[0], "") + "</td><td>" + r[6] + "</td><td>" + r[3] + "</td><td>" + (r[4] === "PENDING" ? '<div class="seg"><button>Certify</button><button>Revoke</button><button>Modify</button></div>' : E(r[4], dcls[r[4]])) + '</td><td class="muted" style="white-space:normal;min-width:190px;max-width:240px">' + (r[5] || "—") + '</td><td class="muted">' + r[7] + "</td></tr>").join("") + "</tbody></table></div></div>" +
      callout("shield", "Decisions of type <b>Revoked</b> or <b>Modified</b> change nothing until someone with " + keyc("organizations.access_reviews.manage") + " applies them. The reviewer cannot review their own access.", "warn") +
      "</div></div>" +
      dm(["AccessReview · name, status (AccessReviewStatus), scope_type, scope_id, modules, starts_at, due_at, completed_at, created_by_membership_id", "AccessReviewItem · membership_id, reviewer_membership_id, decision (AccessReviewDecision), decided_at, comment, access_snapshot (JSON), applied_at"], []) + "</div>";
  }

  /* =====================================================================================================================
     MODULE ACCESS (spec §56–57)
     @route  /admin/modules
     @perm   VIEW organizations.modules.manage* (manage-only) · per-member access is edited on the member page (users.members.manage*)
     @api    GET /modules (OrganizationModule for all 19 ModuleKey + member counts) · PUT /modules/:module {enabled} · GET /modules/:module/members
     @mcp    organizations_modules_manage*
     @data   OrganizationModule (module, enabled, enabled_at, disabled_at, settings) · MembershipModuleAccess (counts)
     @ui     Table, Switch (AlertDialog on disable), Button -> Sheet listing members with access
     @states loading · error · no-access
     @audit  organization.module_enabled | organization.module_disabled
     @note   Disabling a module hides it for EVERYONE immediately (rail, API, MCP tools) but keeps its data; re-enabling restores it. Warn with the number of members and active records affected.
             ADMINISTRATION cannot be disabled. Provisioning defaults (which modules a new organization starts with) are described in 01 §11; do not hard-code them in the UI.
     ===================================================================================================================== */
  function modules() {
    const on = ["PROJECTS", "TASKS", "TIME_TRACKING", "CALENDAR", "MESSAGING", "CRM", "SUPPORT", "DOCUMENTS", "BUSINESS_DOCS", "NOTIFICATIONS", "ADMINISTRATION", "PROPOSALS", "CONTRACTS", "FINANCE", "COMMUNICATION"];
    const n = { PROJECTS: 22, TASKS: 22, TIME_TRACKING: 20, CALENDAR: 24, MESSAGING: 24, CRM: 12, SUPPORT: 8, DOCUMENTS: 18, BUSINESS_DOCS: 24, NOTIFICATIONS: 24, ADMINISTRATION: 3, PROPOSALS: 6, CONTRACTS: 7, FINANCE: 4, COMMUNICATION: 5 };
    return '<div class="a-page">' + head("Module access", "Which products are enabled for the organization (OrganizationModule) and for each member (MembershipModuleAccess). Evaluated before any permission (§56–57).") +
      '<div class="panel" style="margin-top:0"><table><thead><tr><th>Module</th><th>ModuleKey</th><th>Organization</th><th>Enabled since</th><th class="num">Members with access</th><th></th></tr></thead><tbody>' +
      MOD.map((m) => "<tr><td><b class='ink'>" + m[1] + '</b></td><td class="key">' + m[0] + "</td><td>" + sw(on.includes(m[0])) + '</td><td class="muted">' + (on.includes(m[0]) ? "Mar 2025" : "—") + '</td><td class="num">' + (n[m[0]] || 0) + "</td><td>" + btn("Manage members", "", "ghost sm") + "</td></tr>").join("") + "</tbody></table></div>" +
      dm(["OrganizationModule · module, enabled, enabled_at, disabled_at, settings", "MembershipModuleAccess · module, enabled"], []) + "</div>";
  }

  /* =====================================================================================================================
     DELEGATIONS (spec §94)
     @route  /admin/delegations?status=
     @perm   VIEW users.delegations.manage · create/revoke users.delegations.manage (a delegator can only delegate permissions they hold)
     @api    GET /delegations?status= · POST /delegations {delegate_membership_id, permission_keys[], role_ids[], scope_type, scope_id, starts_at, ends_at, reason} · POST /delegations/:id/revoke
     @mcp    users_delegations_manage
     @data   Delegation (delegator_membership_id, delegate_membership_id, permission_keys[], role_ids[], scope_type, scope_id, status DelegationStatus, starts_at, ends_at, reason)
     @ui     Table, Dialog+Form (date range, permission multi-select Command), Badge, AlertDialog (revoke)
     @states loading · empty · error · no-access
     @audit  delegation.created | delegation.revoked
     @note   Status is time-driven: SCHEDULED (starts_at in the future) -> ACTIVE -> EXPIRED (ends_at passed, by a job) or REVOKED (manual). The authorization service honors only ACTIVE delegations,
             limited to the listed permission_keys/role_ids and scope; it never lets the delegate re-delegate. Sensitive permissions can require approval (§95).
     ===================================================================================================================== */
  function delegations() {
    const Rw = [["Anna Meyer", "AM", "", "Marco Silva", "MS", "g", "tasks.tasks.assign, projects.projects.manage_members", "PROJECT · Acme Rebrand", "ACTIVE", "Nov 1 → Nov 30", "Holiday cover"], ["Petros R.", "PR", "", "Elena Papadaki", "EP", "", "finance.invoices.approve (role: Finance Manager)", "ORGANIZATION", "SCHEDULED", "Dec 20 → Jan 5", "Founder away"], ["Kim Lund", "KL", "p", "Jon Kim", "JK", "r", "support.tickets.assign", "ORGANIZATION", "EXPIRED", "Oct 1 → Oct 10", "Sick leave"], ["Petros R.", "PR", "", "Nikos Georgiou", "NG", "g", "crm.deals.update", "BRANCH · Limassol", "REVOKED", "Sep 1 → Sep 30", "Reassigned"]];
    return '<div class="a-page">' + head("Delegations", "Temporary delegation of selected responsibilities (§94). Keeps full audit history.", lnk("New delegation", "plus", "primary", "delegationnew")) +
      '<div class="panel" style="margin-top:0"><table><thead><tr><th>Delegator</th><th>Delegate</th><th>Permissions / roles</th><th>Scope</th><th>Status</th><th>Period</th><th>Reason</th></tr></thead><tbody>' + Rw.map((r) => "<tr><td>" + who(r[1], r[2], r[0], "") + "</td><td>" + who(r[4], r[5], r[3], "") + '</td><td class="key" style="white-space:normal;max-width:260px">' + r[6] + "</td><td>" + r[7] + "</td><td>" + S(r[8]) + "</td><td>" + r[9] + '</td><td class="muted">' + r[10] + "</td></tr>").join("") + "</tbody></table></div>" +
      dm(["Delegation · delegator_membership_id, delegate_membership_id, permission_keys[], role_ids[], scope_type, scope_id, status (SCHEDULED|ACTIVE|EXPIRED|REVOKED), starts_at, ends_at, reason"], []) + "</div>";
  }

  /* =====================================================================================================================
     PROFILE & BRANDING (spec §14–15, §128)
     @route  /admin/profile
     @perm   VIEW organizations.settings.manage* · branding block organizations.branding.manage · save: same keys
     @api    GET /organization · PATCH /organization {fields} · POST /organization/logo (multipart; store in Documents module 17, keep logo_url)
     @mcp    organizations_settings_manage*
     @data   Organization (legal_name, display_name, short_name, slug, logo_url, website, country, contact_email, contact_phone, address, tax_identifiers, status, default_currency, default_timezone,
             default_language, default_locale, date_format, number_format, week_start, working_days, business_hours, branding JSON)
     @ui     Form (react-hook-form + zod), Input, Select/Combobox (country, currency, timezone, language via Intl lists), file upload (logo), color picker for branding
     @states loading · saving · error (field-level) · no-access
     @audit  organization.updated
     @note   Branding (Organization.branding JSON) is the fallback for proposals, invoices, the portal and emails; modules may override it (ProposalTemplate.branding, CustomerPortalSettings.branding).
             `slug` is unique and changing it breaks URLs: confirm. Defaults here are inherited by branches (Branch fields override when set) and members (UserPreference). Tax identifiers are a JSON map by country.
             Deleting the organization (§103) is a separate, owner-only flow: organizations.organization.delete*.
     ===================================================================================================================== */
  function profile() {
    const row = (l, v) => fld(l, '<div class="inp ink">' + v + "</div>");
    return '<div class="a-page">' + head("Profile & branding", "Organization fields (§14–15) and defaults inherited by branches and members (§128).", btn("Save changes", "check", "primary")) +
      '<div class="g2">' + cd("<b>Organization</b><span class='r'>" + S("ACTIVE") + "</span>", '<div style="display:flex;gap:14px;align-items:center;margin-bottom:14px"><span class="logo" style="width:56px;height:56px;border-radius:14px;font-size:22px">L</span>' + btn("Change logo", "") + "</div>" + row("Display name", "Logiqdev") + row("Legal name", "Logiqdev Ltd") + row("Short name · slug", "Logiqdev · logiqdev") + row("Website", "https://logiqdev.example") + row("Country", "Greece (GR)") + row("Contact email · phone", "hello@logiqdev.example · +30 21 0000 0000") + row("Tax identifiers", "VAT EL123456789 (JSON)")) +
      '<div class="stack">' + cd("<b>Defaults</b><span class='r muted'>branches can override</span>", kv("default_currency", "EUR") + kv("default_timezone", "Europe/Athens") + kv("default_language · default_locale", "en · en-GB") + kv("date_format · number_format", "DD/MM/YYYY · 1.234,56") + kv("week_start", "1 (Monday)") + kv("working_days", "Mon–Fri") + kv("business_hours", "09:00–18:00")) +
      cd("<b>Branding</b><span class='r muted'>Organization.branding (JSON)</span>", kv("Primary color", '<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:14px;height:14px;border-radius:4px;background:linear-gradient(135deg,#ff5757,#a1131a)"></span>#E0343A</span>') + kv("Used by", "Proposals, invoices, portal, emails")) + "</div></div>" +
      dm(["Organization · legal_name, display_name, short_name, slug, logo_url, website, country, contact_email, contact_phone, address, tax_identifiers, status, default_currency, default_timezone, default_language, default_locale, date_format, number_format, week_start, working_days, business_hours, branding"], []) + "</div>";
  }

  /* =====================================================================================================================
     INTEGRATIONS (spec §156–§161) — organizations bring their OWN provider keys (OpenAI, Resend, Stripe, Twilio ...)
     @route  /admin/integrations?category=&status=&q=
     @perm   VIEW organizations.integrations.read (connections, status, key HINTS, usage; never a secret) · ACTION connect / replace key / edit limits / set default / enable / disable /
             disconnect: organizations.integrations.manage* (sensitive). Connect, replace key and disconnect additionally need a RECENT MFA confirmation (step-up auth).
             Branch-scoped admins see and manage only connections restricted to their branches.
     @api    GET /integrations?category=&status=&q= · GET /integrations/providers (the registry, see @data) · POST /integrations {provider, name, mode, secrets{}, config{}, usage_limits, branch_id, make_default}
             (verifies against the provider BEFORE activating; returns metadata only) · POST /integrations/:id/verify · PUT /integrations/:id/secrets {field: value} (replace, write-only) ·
             PATCH /integrations/:id {name, config, usage_limits, branch_id} · POST /integrations/:id/enable|disable|default · DELETE /integrations/:id (disconnect: destroys the secret)
     @mcp    organizations_integrations_read (metadata only) · organizations_integrations_manage* (connect/rotate/disconnect are sensitive: ALWAYS a human confirmation, never an AI agent alone)
     @data   IntegrationConnection (provider, category, name, status, mode, credential_source, secret_hints, config, capabilities, usage_limits, is_default, branch_id, last_verified_at, last_used_at,
             last_error, last_error_at, rotated_at, expires_at) · IntegrationUsageDaily (usage over 30 days) · domain links: PaymentProviderConnection (08), CommProviderAccount (11) -> "Used by".
             The FORM FIELDS come from api/src/shared/constants/integration-providers.ts (INTEGRATION_PROVIDERS[provider].secrets / .config): render them from that registry, do not hard-code per provider.
     @ui     Card/Table grouped by category, ToggleGroup (category filter), Badge (status, mode, "Included with plan"), DropdownMenu (row actions), Dialog+Form (connect; react-hook-form + zod built from
             the registry), password Input (autocomplete=off, no paste restrictions, show/hide toggle off by default), AlertDialog (disable/disconnect lists the dependent records), Tooltip, CopyButton
     @states loading · empty (new org: checklist of the categories the enabled modules need) · error per connection (sanitized provider error + Test again) · no-access · verification running
     @audit  integration.connected | integration.updated | integration.secret_rotated | integration.verified | integration.verification_failed | integration.enabled | integration.disabled |
             integration.default_changed | integration.disconnected   (NEVER put a secret, ciphertext or hint in metadata; only ids, provider, category, mode, status and the names of the fields that changed)
     @note   SECRETS ARE WRITE-ONLY. The API returns `secret_hints` ("sk-...a3f9": prefix + last 4 at most) and, per field, whether it is set. There is no reveal. Replacing a secret verifies the new one first and then
             swaps it atomically (the old secret is destroyed). A connection becomes ACTIVE only after a successful verification call; until then it is PENDING and nothing may use it.
             NO SILENT FALLBACK to a platform key (§159/§160): with no ACTIVE connection a module shows "Connect <category> in Admin > Integrations" and disables the dependent actions.
             credential_source PLATFORM = key supplied by Logiqdev (plan/trial/local seed): shown as "Included with plan", no key hint, cannot be edited, only replaced by the organization's own connection.
             Defaults: at most ONE default per organization + category + mode (enforced in the service); a branch-restricted connection beats an organization-wide one for that branch (§159).
             Test vs live: show a prominent TEST badge; test connections can never be the default for live payments.
             Tool integrations (GitHub, Linear, Slack ...) are managed in Messaging (12) and only LINKED from here. Per-member OAuth (calendar) stays in Calendar (19).
     ===================================================================================================================== */
  const CAT = [["AI", "AI", "sparkles"], ["EMAIL", "Email", "mail"], ["SMS", "SMS", "sms"], ["PAYMENTS", "Payments", "dollar"]];
  /* provider, label, tile text, tile tone, category, name, IntegrationMode, credential_source, IntegrationStatus, key hint, is_default, branch, last verified, last used, usage 30d, last_error */
  const IC = [
    ["OPENAI", "OpenAI", "OA", "green", "AI", "OpenAI production", "LIVE", "ORGANIZATION", "ACTIVE", "sk-…a3f9", 1, "Organization", "2h ago", "4m ago", "1.2M tokens · ≈ $18.40", ""],
    ["RESEND", "Resend", "Re", "blue", "EMAIL", "Resend (campaigns)", "LIVE", "ORGANIZATION", "ERROR", "re_…8c21", 1, "Organization", "3d ago", "2h ago", "8,214 emails", "401 Invalid API key"],
    ["RESEND", "Resend", "Re", "blue", "EMAIL", "Athens notifications", "LIVE", "ORGANIZATION", "ACTIVE", "re_…19fe", 0, "Athens", "1d ago", "1d ago", "312 emails", ""],
    ["TWILIO", "Twilio", "Tw", "red", "SMS", "Twilio SMS (trial)", "LIVE", "PLATFORM", "ACTIVE", "Included", 1, "Organization", "—", "5h ago", "412 messages", ""],
    ["STRIPE", "Stripe", "St", "purple", "PAYMENTS", "Stripe EU live", "LIVE", "ORGANIZATION", "ACTIVE", "sk_live_…x9Qa", 1, "Organization", "1h ago", "12m ago", "€48.2k processed", ""],
    ["STRIPE", "Stripe", "St", "purple", "PAYMENTS", "Stripe EU test", "TEST", "ORGANIZATION", "PENDING", "sk_test_…41bd", 0, "Organization", "Never", "Never", "—", ""],
  ];
  const pv = (t, tone) => '<span class="pv ' + (tone || "") + '">' + t + "</span>";

  function integrations() {
    /* @impl Connected list, one section per IntegrationCategory. Row = IntegrationConnection. Whole row opens /admin/integrations/:id. Columns map to fields (see @data). "Key" = secret_hints of the
         PRIMARY secret field only. Usage = IntegrationUsageDaily summed over 30 days (units meaning depends on the category: tokens, messages, minor currency units). The red error line = last_error
         (sanitized provider message) with last_error_at; it appears only while status = ERROR. */
    const sections = CAT.map((c) => {
      const rows = IC.filter((r) => r[4] === c[0]);
      if (!rows.length) {
        /* @impl Empty category row: tells the admin what this category enables and what happens WITHOUT a connection (no fallback to a platform key, 01 §159). */
        const empty = "Not connected: the features that need this stay switched off until you connect a provider.";
        return '<div class="cat-h">' + I(c[2], 13) + c[1] + '</div><div class="rowx"><div class="grow"><b class="muted" style="font-weight:400">' + empty + "</b></div>" + btn("Connect", "plus", "sm") + "</div>";
      }
      return '<div class="cat-h">' + I(c[2], 13) + c[1] + "</div>" + rows.map((r) =>
        '<div class="rowx clk" style="cursor:pointer" onclick="location.hash=\'#admin/integration\'">' + pv(r[2], r[3]) +
        '<div class="grow"><b>' + r[5] + (r[10] ? ' <span class="badge">Default</span>' : "") + (r[6] === "TEST" ? ' <span class="badge yellow">Test</span>' : "") + (r[7] === "PLATFORM" ? ' <span class="badge purple">Included with plan</span>' : "") + (r[11] !== "Organization" ? ' <span class="badge">Branch · ' + r[11] + "</span>" : "") + "</b><small>" + r[1] + " · key " + r[9] + " · verified " + r[12] + " · last used " + r[13] + " · " + r[14] + "</small>" + (r[8] === "ERROR" ? '<div class="err-line">' + r[15] + " · 2h ago</div>" : "") + "</div>" + S(r[8]) + more + "</div>").join("");
    }).join("");

    /* @impl Available catalog: providers from INTEGRATION_PROVIDERS that the org has not connected yet, grouped/filtered by category. "Connect" opens the connect Dialog for that provider. */
    const av = [["VIVA_WALLET", "Viva Wallet", "VW", "Payments"]];

    return '<div class="a-page">' + head("Integrations", "Connect your own accounts for AI, email, SMS, payments and more. Keys are encrypted, write-only and used only for your organization (§156).", lnk("Add integration", "plus", "primary", "integrationnew")) +
      /* @impl Info Alert (dismissible per user): states the BYO-key principle and that nothing falls back to a shared platform key. Link "How credentials are protected" -> help article (§158). */
      '<div class="callout" style="margin-bottom:14px">' + I("lock", 16) + "<div><b>Your keys, your costs.</b> Logiqdev OS calls these providers with the accounts you connect here. Secrets are encrypted per organization and can never be viewed again after saving; replace them any time. If a category has no connection, the features that need it stay switched off instead of using a shared key.</div></div>" +
      '<div class="g-main"><div class="stack">' +
      /* @impl Filter bar: category ToggleGroup (values = IntegrationCategory), status select (IntegrationStatus), search by name/provider. Sync to the query string. */
      '<div class="toolbar">' + search("Search integrations…") + '<div class="seg"><button class="on">All</button><button>AI</button><button>Email</button><button>SMS</button><button>Payments</button></div><button class="btn">Status</button></div>' +
      '<div class="cd"><div class="cd-h"><b>Connected</b><span class="r muted">IntegrationConnection · ' + IC.length + " connections</span></div><div class=\"cd-b flush\">" + sections + "</div></div>" +
      cd("<b>Available</b><span class='r muted'>more providers are added as their adapters ship</span>", '<div class="prov-grid">' + av.map((a) => '<div class="prov">' + pv(a[2]) + "<div><b>" + a[1] + "</b><small>" + a[3] + "</small></div>" + btn("Connect", "", "sm") + "</div>").join("") + "</div>", 1) +
      callout("link", "<b>Tool integrations</b> (GitHub, GitLab, Jira, Linear, Notion, Slack) are managed in Messaging settings. <a style='text-decoration:underline'>Open Messaging integrations</a>") +
      "</div><div class=\"stack\">" +
      /* @impl CONNECT FORM (Dialog in production; shown as a card here). Generated from INTEGRATION_PROVIDERS['OPENAI']: secrets[] -> write-only password inputs (required ones validated for format, e.g. prefix "sk-"),
           config[] -> plain inputs/selects. Generic fields on every provider: Name (unique per org), Mode (only when hasTestMode), Branch (optional), Usage limits (only when supportsUsageLimits), "Make default".
           Submit = "Test and save": POST /integrations verifies with the provider (OpenAI: GET /v1/models) and ONLY THEN activates. Show the provider error inline on failure and keep the dialog open.
           The key field clears itself after submit and is never kept in React state longer than needed, never put in the URL, localStorage, logs or analytics. */
      cd("<b>Connect OpenAI</b><span class='r'><span class='badge green'>AI</span></span>",
        fld("Name", '<div class="inp ink">OpenAI production</div>') +
        fld("Mode", '<div class="seg"><button class="on">Live</button><button>Test</button></div>') +
        fld("API key <span class='sens'>*</span>", '<div class="pwd">••••••••••••••••<span style="margin-left:auto;letter-spacing:0;color:var(--ash)">' + I("lock", 13) + "</span></div><div class='sub-note'>Stored encrypted. You will see only “sk-…a3f9” afterwards.</div>") +
        fld("Organization ID (optional)", '<div class="inp">org-…</div>') + fld("Default model", sel("gpt-4.1", "sparkles")) +
        fld("Monthly spend limit", '<div class="inp">$ 30.00</div><div class="sub-note">Notifies admins at 80% and 100%; features degrade at 100%.</div>') +
        fld("Available to", sel("Entire organization", "building")) +
        '<div class="setting" style="padding:6px 0;border:0"><div class="grow"><b>Make default for AI</b><small>Modules resolve the default connection of a category</small></div>' + sw(1) + "</div>" +
        '<div style="display:flex;gap:8px;margin-top:10px">' + btn("Cancel", "") + '<button class="btn primary" style="flex:1">' + I("check", 14) + " Test and save</button></div>") +
      /* @impl Coverage card = the RESOLUTION result per category (§159): which ACTIVE connection each category resolves to right now, and which modules depend on it. A category that an ENABLED module needs
           but that resolves to nothing (or to an ERROR connection) is flagged red. Data: resolveConnection(org, category) for each category + OrganizationModule to know which modules are enabled. */
      cd("<b>What modules will use</b><span class='r muted'>resolution per category</span>",
        '<div class="rowx"><div class="grow"><b>AI</b><small>Support agent, Docs, Proposals, Automation</small></div><span class="muted">OpenAI production</span></div>' +
        '<div class="rowx"><div class="grow"><b>Email</b><small>Campaigns, notifications, invoices</small></div><span class="badge red">Resend: error</span></div>' +
        '<div class="rowx"><div class="grow"><b>SMS</b><small>Campaigns, reminders</small></div><span class="muted">Twilio SMS</span></div>' +
        '<div class="rowx"><div class="grow"><b>Payments</b><small>Billing, client portal checkout</small></div><span class="muted">Stripe EU live</span></div>' +
        '<div class="rowx"><div class="grow"><b>Payments (test)</b><small>Sandbox checkout</small></div><span class="muted">Stripe EU test: pending</span></div>', 1) +
      "</div></div>" +
      dm(["IntegrationConnection · provider, category, name, status, mode, credential_source, secret_hints, config, capabilities, usage_limits, is_default, branch_id, last_verified_at, last_used_at, last_error, last_error_at", "IntegrationUsageDaily · requests, failures, units, cost_micros (30-day sums)", "api/src/shared/constants/integration-providers.ts · INTEGRATION_PROVIDERS (form fields, verification), MIGRATED_ENV_KEYS"], ["Secrets are never read by the UI: only secret_hints and per-field set/unset", "Tool integrations (12 MessagingIntegration) are separate and only linked"]) + "</div>";
  }

  /* =====================================================================================================================
     INTEGRATION DETAIL (spec §157–§158, §161) — one connection (Stripe EU live shown)
     @route  /admin/integrations/:connectionId?tab=overview|credentials|configuration|webhook|usage|activity
     @perm   VIEW organizations.integrations.read · replace key / edit configuration / enable / disable / disconnect / set default: organizations.integrations.manage* (+ recent MFA for secrets)
     @api    GET /integrations/:id (metadata, hints, capabilities, "used by") · PUT /integrations/:id/secrets · PATCH /integrations/:id · POST /integrations/:id/verify|enable|disable|default · DELETE /integrations/:id ·
             GET /integrations/:id/usage?from=&to= · GET /integrations/:id/webhook-events?cursor= · GET /audit-events?resource_type=integration_connection&resource_id=
     @mcp    organizations_integrations_read · organizations_integrations_manage* (human confirmation)
     @data   IntegrationConnection (all fields) · IntegrationUsageDaily · ProviderWebhookEvent (08, recent deliveries; matched by webhook_token) · AuditEvent (activity) ·
             PaymentProviderConnection (08) rows pointing here ("Used by": routing, currencies, priority) · registry entry INTEGRATION_PROVIDERS[provider]
     @ui     Tabs, Card, Table, Badge, Dialog (replace key: one field per secret, password inputs), AlertDialog (disable / disconnect), CopyButton (callback URL), DropdownMenu
     @states loading · not found · error banner with sanitized provider message · no-access · verifying
     @audit  integration.secret_rotated | integration.verified | integration.verification_failed | integration.updated | integration.disabled | integration.enabled | integration.disconnected | integration.default_changed
     @note   Credentials tab never shows values. Each secret field shows: set/unset, hint, and Replace. Replacing triggers re-verification. The webhook callback URL is
             {API_URL}/webhooks/integrations/{webhook_token}: unguessable, per connection, and the ONLY way an inbound provider event is tied to this organization. Inbound events are signature-verified with the
             stored webhook secret, de-duplicated (ProviderWebhookEvent) and handed to the owning module (08 for Stripe). Disconnect lists dependent records first and destroys the ciphertext.
             Account id / country / capabilities shown in Overview are `capabilities` from the LAST verification (stale-while-error), not live calls from the browser.
     ===================================================================================================================== */
  function integration() {
    const ev = [["invoice.paid", "Processed", "12m ago"], ["payment_intent.succeeded", "Processed", "12m ago"], ["charge.refunded", "Processed", "3h ago"], ["customer.subscription.updated", "Duplicate (ignored)", "5h ago"]];
    const us = [["Nov 10", 212, 0, "€4,820", "—"], ["Nov 9", 188, 1, "€3,940", "—"], ["Nov 8", 64, 0, "€1,210", "—"], ["Nov 7", 301, 0, "€7,880", "—"]];
    return '<div class="a-page">' +
      /* @impl Header card: provider tile, connection name, status, mode, default/platform badges, branch scope. Actions: Test connection (POST verify), Replace keys (Dialog), Disable/Enable, Disconnect (AlertDialog). */
      '<div class="cd" style="margin-bottom:14px"><div class="hdr-card">' + pv("St", "purple") + '<div class="nm"><h2>Stripe EU live ' + S("ACTIVE") + E("LIVE", "green") + '<span class="badge">Default</span></h2><div class="muted">Payments · Stripe · organization-wide · connected Mar 2025 by Petros R.</div></div>' + btn("Test connection", "zap") + btn("Disable", "") + btn("Disconnect", "x") + "</div></div>" +
      '<div class="tabset">' + tabs([["o", "Overview"], ["c", "Credentials"], ["f", "Configuration"], ["w", "Webhook"], ["u", "Usage"], ["a", "Activity"]], "o") +
      /* @impl Overview: health (status, last_verified_at, last_used_at, last_error), `capabilities` from the last verification, and "Used by" = domain rows pointing at this connection. */
      pane("o", 1, '<div class="g2">' + cd("<b>Health</b>", kv("Status", S("ACTIVE")) + kv("Last verified", "1h ago (GET /v1/account)") + kv("Last used", "12m ago") + kv("Last error", muted("none")) + kv("Expires", muted("no expiry")) + kv("Last key change", "41 days ago · Petros R.")) +
        cd("<b>Discovered at verification</b><span class='r muted'>capabilities</span>", kv("Account ID", '<span class="key">acct_1Q…Yz</span>') + kv("Country · default currency", "GR · EUR") + kv("Charges enabled", "Yes") + kv("Payouts enabled", "Yes") + kv("Supports", "Cards, SEPA, wallets, refunds, subscriptions")) + "</div>" +
        cd("<b>Used by</b><span class='r muted'>domain rows pointing at this connection</span>", '<div class="rowx"><div class="grow"><b>Billing · payment connection “Stripe EU”</b><small>PaymentProviderConnection · EUR · priority 100 · default · all methods</small></div><a style="text-decoration:underline">Open in Billing</a></div><div class="rowx"><div class="grow"><b>Client portal checkout</b><small>Pays invoices through the default payments connection</small></div></div>', 1)) +
      /* @impl Credentials: one row per field of INTEGRATION_PROVIDERS[provider].secrets. NO values: state + hint + Replace (Dialog with a password input, then re-verification). The Replace/Add actions
           require recent MFA. */
      pane("c", 0, '<div class="callout" style="margin-bottom:12px">' + I("lock", 16) + "<div><b>Secrets are write-only.</b> They are encrypted under your organization key and cannot be viewed again. To change one, replace it: the new value is verified, then swaps the old one atomically.</div></div>" +
        '<div class="cd"><div class="cd-b flush"><div class="secret-row"><div class="grow"><b>Secret key</b><small>secret_key · sk_live_…</small></div><span class="key">sk_live_…x9Qa</span>' + E("Set", "green") + btn("Replace", "key", "sm") + '</div><div class="secret-row"><div class="grow"><b>Webhook signing secret</b><small>webhook_signing_secret · whsec_…</small></div><span class="key">whsec_…2b1c</span>' + E("Set", "green") + btn("Replace", "key", "sm") + "</div></div></div>") +
      /* @impl Configuration: non-secret fields (INTEGRATION_PROVIDERS[provider].config) saved with PATCH. publishable_key is NOT a secret (shown in the checkout). Branch scope = branch_id (organization-wide when empty).
           Usage limits = usage_limits JSON; only shown when the provider supports them (Stripe does not: fees are charged by Stripe, not metered here). */
      pane("f", 0, '<div class="g2">' + cd("<b>Settings</b>", fld("Name", '<div class="inp ink">Stripe EU live</div>') + fld("Publishable key", '<div class="inp ink">pk_live_51Q…KdA</div>') + fld("Statement descriptor", '<div class="inp ink">LOGIQDEV</div>') + fld("Account ID (from verification)", '<div class="inp">acct_1Q…Yz</div>')) +
        cd("<b>Availability</b>", fld("Available to", sel("Entire organization", "building")) + '<div class="setting" style="padding:6px 0;border:0"><div class="grow"><b>Default for Payments (live)</b><small>One default per category and mode</small></div>' + sw(1) + "</div>" + callout("shield", "Test connections can never be the default for live payments.", "warn")) + "</div>") +
      /* @impl Webhook: callback URL = {API_URL}/webhooks/integrations/{webhook_token} (copy button). Recent deliveries from ProviderWebhookEvent (event type, outcome: Processed | Duplicate | Failed, time) with a "Resend / replay"
           action for failed ones. The signing secret is configured on the Credentials tab. Only shown when the provider has `webhook: true`. */
      pane("w", 0, cd("<b>Callback URL</b>", '<div class="pwd" style="letter-spacing:0;color:var(--ink)"><span class="key">https://api.logiqdev.example/webhooks/integrations/wh_9f3a1c…</span><span style="margin-left:auto">' + btn("Copy", "", "sm") + "</span></div><div class='sub-note' style='margin-top:6px'>Add this URL in your provider dashboard. Events are verified with the signing secret, de-duplicated and handed to Billing.</div>") + '<div style="height:12px"></div>' +
        '<div class="panel" style="margin-top:0"><table><thead><tr><th>Event</th><th>Outcome</th><th>Received</th></tr></thead><tbody>' + ev.map((e) => '<tr><td class="key">' + e[0] + "</td><td>" + (e[1].startsWith("Processed") ? E("Processed", "green") : E("Duplicate", "")) + '</td><td class="muted">' + e[2] + "</td></tr>").join("") + "</tbody></table></div>") +
      /* @impl Usage: IntegrationUsageDaily rows (date, requests, failures, units, cost). Units for PAYMENTS = minor currency units processed (shown formatted). Chart (requests + failures per day) above the table in production. */
      pane("u", 0, '<div class="panel" style="margin-top:0"><table><thead><tr><th>Day</th><th class="num">Requests</th><th class="num">Failures</th><th>Processed</th><th>Est. cost</th></tr></thead><tbody>' + us.map((u) => "<tr><td>" + u[0] + '</td><td class="num">' + u[1] + '</td><td class="num">' + u[2] + "</td><td>" + u[3] + '</td><td class="muted">' + u[4] + "</td></tr>").join("") + "</tbody></table></div>") +
      /* @impl Activity: AuditEvent rows with resource_type integration_connection and this id. The events never contain secrets or hints, only "secret_key rotated". */
      pane("a", 0, cd("<b>Recent activity</b><span class='r muted'>AuditEvent</span>", '<div class="tl"><div class="ev"><b class="key">integration.verified</b><small>System · 1h ago</small></div><div class="ev"><b class="key">integration.secret_rotated</b><small>secret_key · Petros R. · 41 days ago</small></div><div class="ev"><b class="key">integration.default_changed</b><small>Petros R. · Mar 2025</small></div><div class="ev"><b class="key">integration.connected</b><small>Petros R. · Mar 2025</small></div></div>')) + "</div>" +
      dm(["IntegrationConnection · status, mode, secret_hints, config, capabilities, webhook_token, is_default, branch_id, last_verified_at, last_used_at, rotated_at", "IntegrationUsageDaily · requests, failures, units, cost_micros", "PaymentProviderConnection (08) · integration_connection_id", "ProviderWebhookEvent (08) · recent deliveries", "AuditEvent · integration.*"], ["The secret values: never read, by design"]) + "</div>";
  }

const lnk = (t, ic, cls, h) => '<a href="#admin/' + h + '" class="btn ' + (cls || "") + '">' + (ic ? I(ic, 14) : "") + t + "</a>";

  /* =====================================================================================================================
     DEEPENING PASS (01b) — creation pages, detail depth, filters. Everything below reuses the helpers above and the shared
     filter bar `window.UI.filters` (views-tasks.js). New routes are added to MAP at the bottom.
     REAL DATA: PERMS = permission-catalog.ts grouped by module -> key prefix -> [action, flags] (flags: 1 sensitive, 2 field-level);
                AUDIT_TYPES = audit-event-types.ts [event_type, resource, description, flags] (1 sensitive, 2 notifyAdmins).
     ===================================================================================================================== */
  const PERMS = {"ADMINISTRATION":{"organizations.settings":[["manage",1]],"organizations.branding":[["manage",0]],"organizations.security":[["manage",1]],"organizations.billing":[["manage",1]],"organizations.integrations":[["read",0],["manage",1]],"organizations.modules":[["manage",1]],"organizations.organization":[["delete",1]],"organizations.domains":[["manage",1]],"organizations.sso":[["manage",1]],"organizations.api_keys":[["manage",1]],"organizations.service_accounts":[["manage",1]],"organizations.audit":[["read",1]],"organizations.access_reviews":[["read",1],["manage",1],["decide",1]],"users.members":[["read",0],["invite",0],["manage",1],["offboard",1],["transfer_ownership",1]],"users.external_collaborators":[["manage",1]],"users.sessions":[["read",1],["revoke",1]],"users.roles":[["read",0],["manage",1],["assign",1]],"users.permissions":[["read",0],["grant",1],["simulate",0]],"users.delegations":[["manage",0]],"organizations.branches":[["read",0],["manage",1]],"organizations.branches.members":[["manage",0]],"organizations.branches.settings":[["manage",0]],"organizations.teams":[["read",0],["manage",0]],"organizations.teams.members":[["manage",0]],"platform.custom_fields":[["manage",1]],"platform.tags":[["manage",0]],"platform.saved_views":[["manage_shared",0]]},"CUSTOMER_PORTAL":{"portal.users":[["manage",1]],"portal.projects":[["read",0]],"portal.deliverables":[["approve",0]],"portal.requests":[["create",0]],"portal.documents":[["read",0],["upload",0]],"portal.proposals":[["read",0],["accept",1]],"portal.contracts":[["read",0],["sign",1]],"portal.invoices":[["read",0],["pay",1]],"portal.subscriptions":[["manage",1]],"portal.conversations":[["participate",0]],"portal.settings":[["manage",0]]},"CRM":{"crm.notes.private":[["read",1]],"crm.financials":[["read",1]],"crm.pipelines":[["manage",0]],"crm.settings":[["manage",0]],"crm.records":[["import",1],["export",1]],"crm.dashboards":[["read",0],["manage",0]],"crm.forecast":[["read",0]],"crm.targets":[["read",0],["manage",1]],"crm.scoring_rules":[["manage",0]]},"PROJECTS":{"projects.finance":[["read",1]],"projects.milestones":[["manage",0]],"projects.workstreams":[["manage",0]],"projects.deliverables":[["manage",0]],"projects.risks":[["manage",0]],"projects.issues":[["manage",0]],"projects.dependencies":[["manage",0]],"projects.change_requests":[["manage",0],["approve",1]],"projects.gates":[["decide",1]],"projects.status_updates":[["publish",0]],"projects.internal_notes":[["read",0]],"projects.settings":[["manage",0]],"projects.portfolio":[["read",0]],"projects.members":[["manage",0]]},"TASKS":{"tasks.comments.internal":[["read",0]],"tasks.workflows":[["manage",0]],"tasks.cycles":[["manage",0]],"tasks.releases":[["manage",0]],"tasks.bulk":[["execute",0]],"tasks.workload":[["read",0]]},"CONTRACTS":{"contracts.confidential_terms":[["read",3]],"contracts.versions":[["create",0]],"contracts.signatures":[["send",1],["cancel",1]],"contracts.templates":[["manage",1]],"contracts.clauses":[["manage",1]],"contracts.types":[["manage",0]],"contracts.approval_rules":[["manage",1]],"contracts.obligations":[["manage",0]],"contracts.comments.internal":[["read",0]],"contracts.knowledge":[["search",0]]},"PROPOSALS":{"proposals.templates":[["manage",0]],"proposals.comments.internal":[["read",0]],"proposals.analytics":[["read",0]],"proposals.ai":[["generate",0]],"proposals.approval_rules":[["manage",1]]},"FINANCE":{"finance.payments":[["read",1],["record",1],["refund",1]],"finance.credit_notes":[["manage",1]],"finance.subscriptions":[["read",0],["manage",1]],"finance.billing_profiles":[["manage",1]],"finance.catalog":[["read",0],["manage",0]],"finance.dunning":[["manage",0]],"finance.project_billing":[["manage",0]],"finance.reports":[["read",1]],"finance.payment_providers":[["manage",1]],"finance.dashboard":[["read",1]],"finance.invoice_templates":[["manage",0]],"finance.adjustments":[["manage",1]]},"EMPLOYEES":{"employees.compensation":[["read",3],["manage",3]],"employees.leave":[["approve",0],["read_own",0],["read_all",0],["request_own",0],["manage_policies",1],["manage_balances",1]],"employees.attendance":[["read_own",0],["read_all",0],["record_own",0],["manage",1]],"employees.skills":[["read",0],["manage",0]],"employees.performance":[["read_own",0],["read_all",1],["manage",1]],"employees.documents":[["read",1],["manage",1]],"employees.hr_notes":[["read",1],["manage",1]],"employees.capacity":[["read",0]],"employees.directory":[["read",0]],"employees.availability":[["manage",0]],"employees.profile":[["update_own",0]]},"DOCUMENTS":{"documents.vault":[["read",1],["reveal",1],["manage",1]],"documents.folders":[["manage",0]],"documents.retention":[["manage",1]],"documents.categories":[["manage",0]],"documents.deletions":[["approve",1]],"documents.storage":[["manage",1]]},"MESSAGING":{"messaging.channels":[["manage",0],["read",0],["create",0]],"messaging.messages":[["delete_any",1],["read",0],["post",0],["pin",0]],"messaging.external_users":[["manage",1]],"messaging.settings":[["manage",1]],"messaging.users":[["manage",0]],"messaging.retention":[["manage",1]],"messaging.integrations":[["manage",1]],"messaging.audit":[["read",1]],"messaging.data":[["export",1]],"messaging.channel_members":[["manage",0]]},"CALENDAR":{"calendar.events":[["read",0],["manage",0],["create",0],["delete_own",0],["read_own",0],["update_own",0]],"calendar.availability":[["read",0]],"calendar.booking_links":[["manage",0]],"calendar.calendars":[["manage",0],["read_team",0]],"calendar.sync":[["manage_own",0]],"calendar.resources":[["manage",0]]},"TIME_TRACKING":{"time.entries":[["read_all",0],["approve",0],["create_own",0],["read_own",0],["read_team",0],["update_own",0],["unlock",1]],"time.rates":[["read",1],["manage",1]],"time.reports":[["read",0]],"time.timesheets":[["submit_own",0],["approve",0]],"time.settings":[["manage",0]]},"NOTIFICATIONS":{"notifications.defaults":[["manage",0]],"notifications.templates":[["manage",0]],"notifications.audit":[["read",1]],"notifications.preferences":[["manage_own",0]],"notifications.delivery_rules":[["manage",0]]},"AUTOMATION":{"automation.rules":[["manage",1],["read",0],["create",0],["update",0],["delete",1],["enable",1]],"automation.runs":[["read",0]],"automation.service_accounts":[["manage",1]],"automation.actions.destructive":[["enable",1]],"automation.webhooks":[["manage",1]],"automation.jobs":[["read",0],["manage",1]],"automation.settings":[["manage",1]]},"BUSINESS_DOCS":{"docs.pages":[["read",0],["publish",0],["create",0],["update",0],["archive",0],["delete",1]],"docs.spaces":[["manage",0]],"docs.forms.anonymous_responses":[["read",1]],"docs.ai":[["query",0]],"docs.checklists":[["manage",0]]},"INCOME_EXPENSE":{"finance.categories":[["manage",0]],"finance.vat":[["read",0],["manage",1]],"finance.periods":[["manage",1]],"finance.payroll":[["read",1],["manage",1]],"finance.recurring_expenses":[["manage",0]],"finance.invoice_imports":[["review",0]],"finance.profit_loss":[["read",1]],"finance.profitability":[["read",1]],"finance.ledger_settings":[["manage",1]]},"COMMUNICATION":{"communications.sender_identities":[["manage",1]],"communications.suppressions":[["manage",1]],"communications.analytics":[["read",0]],"communications.settings":[["manage",1]]},"SUPPORT":{"support.tickets":[["merge",0],["escalate",0],["convert_to_task",0]],"support.sla_policies":[["manage",0]],"support.canned_responses":[["manage",0]],"support.inboxes":[["manage",0]],"support.automation":[["manage",0]],"support.ai":[["configure",1],["use",0]],"support.analytics":[["read",0]],"support.settings":[["manage",0]],"support.csat":[["read",0]]}};
  const AUDIT_TYPES = [["user.login","user","User signed in",0],["user.logout","user","User signed out",0],["user.login_failed","user","Failed sign-in attempt",1],["user.password_changed","user","Password changed",0],["user.mfa_enabled","user_auth_method","MFA factor added",0],["user.mfa_disabled","user_auth_method","MFA factor disabled",3],["user.suspended","user","User suspended",1],["user.deactivated","user","User deactivated",1],["session.created","user_session","Session started",0],["session.revoked","user_session","Session revoked",1],["organization.switched","user_session","Active organization / branch context changed",0],["organization.created","organization","Organization created",0],["organization.updated","organization","Profile, branding or defaults changed",0],["organization.status_changed","organization","Lifecycle status changed (e.g. SETUP to ACTIVE)",1],["organization.module_enabled","organization_module","Product module enabled for the organization",0],["organization.module_disabled","organization_module","Product module disabled for the organization",1],["organization.security_policy_changed","organization_security_policy","Security policy changed",3],["organization.deletion_requested","organization","Organization deletion requested",3],["domain.verified","organization_domain","Domain verified",0],["domain.revoked","organization_domain","Domain revoked",1],["membership.created","membership","Member joined the organization",0],["membership.suspended","membership","Member suspended",1],["membership.reactivated","membership","Member reactivated",0],["membership.offboarded","membership","Member offboarded",1],["membership.ownership_transferred","membership","Organization ownership transferred",3],["membership.role_assigned","role_assignment","Role assigned",1],["membership.role_removed","role_assignment","Role removed",1],["membership.admin_promoted","role_assignment","Member promoted to an administrator role",3],["membership.admin_removed","role_assignment","Administrator role removed",3],["membership.permission_granted","permission_grant","Explicit permission grant or deny added",1],["membership.permission_revoked","permission_grant","Explicit permission grant or deny removed",1],["membership.module_enabled","membership_module_access","Module enabled for a member",0],["membership.module_disabled","membership_module_access","Module disabled for a member",0],["membership.branch_assigned","membership_branch","Member added to a branch",0],["membership.branch_removed","membership_branch","Member removed from a branch",0],["membership.team_assigned","team_membership","Member added to a team",0],["membership.team_removed","team_membership","Member removed from a team",0],["delegation.created","delegation","Delegation created",1],["delegation.revoked","delegation","Delegation revoked",0],["role.created","role","Role created or cloned",0],["role.updated","role","Role draft edited",0],["role.published","role_version","Role published (new RoleVersion)",3],["role.deprecated","role","Role deprecated",0],["branch.created","branch","Branch created",0],["branch.updated","branch","Branch settings changed",0],["branch.archived","branch","Branch archived",1],["branch.manager_changed","branch_manager","Branch manager added or removed",3],["team.created","team","Team created",0],["team.updated","team","Team changed",0],["team.archived","team","Team archived",0],["invitation.sent","invitation","Invitation sent",0],["invitation.accepted","invitation","Invitation accepted",0],["invitation.cancelled","invitation","Invitation cancelled",0],["invitation.rejected","invitation","Invitation rejected by the invitee",0],["invitation.expired","invitation","Invitation expired (written by the system)",0],["invitation.bulk_imported","invitation","Bulk import or SCIM provisioning created members",3],["sso.configuration_changed","sso_configuration","SSO / SCIM configuration changed",3],["api_key.created","api_key","API key created",1],["api_key.rotated","api_key","API key rotated",1],["api_key.revoked","api_key","API key revoked",1],["service_account.created","service_account","Service account created",1],["service_account.suspended","service_account","Service account suspended",1],["service_account.revoked","service_account","Service account revoked",1],["external_collaborator.added","membership","External collaborator or guest added",3],["access_review.created","access_review","Access review created",0],["access_review.started","access_review","Access review started",0],["access_review.decision_recorded","access_review_item","Reviewer certified, revoked or modified a member\\",0],["access_review.decision_applied","access_review_item","A REVOKED / MODIFIED decision was applied to roles, grants or module access",1],["access_review.completed","access_review","Access review completed",0],["access_review.cancelled","access_review","Access review cancelled",0],["integration.connected","integration_connection","Integration connected with the organization\\",0],["integration.updated","integration_connection","Integration settings, limits or branch scope changed",1],["integration.secret_rotated","integration_connection","Integration secret replaced",3],["integration.verified","integration_connection","Integration credentials verified against the provider",0],["integration.verification_failed","integration_connection","Integration verification or a provider call failed",3],["integration.enabled","integration_connection","Integration enabled",1],["integration.disabled","integration_connection","Integration disabled (secret kept)",3],["integration.default_changed","integration_connection","Default integration of a category changed",1],["integration.disconnected","integration_connection","Integration disconnected and secret destroyed",3],["data.exported","export","Sensitive data export",1]];

  /* @impl FB(): the shared filter bar (UI.filters.filterBar, defined by views-tasks.js, which loads AFTER this file, so it is resolved at render time).
       Fallback below only exists so this app never breaks when loaded alone. Production: one <FilterBar> + <SavedViews> component fed by SavedView.filters (JSON tree). */
  const FB = (chips, extra) => {
    const f = window.UI && window.UI.filters;
    if (f) return f.filterBar(chips, extra);
    return '<div class="fbar"><div class="fchips">' + chips.map((c) => '<span class="fchip"><b>' + c[0] + "</b><i>" + c[1] + "</i><span>" + c[2] + "</span>" + I("x", 12) + "</span>").join("") + '<button class="btn sm ghost">' + I("plus", 13) + ' Add filter</button></div><div class="fright">' + (extra || "") + "</div></div>";
  };
  const back = (hash, label) => '<a class="backlink" href="#admin/' + hash + '">' + I("left", 13) + label + "</a>";
  const inp = (v) => '<div class="inp ink">' + v + "</div>";
  const ph = (v) => '<div class="inp">' + v + "</div>";
  const ta = (v) => '<div class="inp tall">' + v + "</div>";
  const fl = (l, c, hint, req) => fld(l + (req ? ' <span class="sens">*</span>' : ""), c + (hint ? '<div class="sub-note">' + hint + "</div>" : ""));
  const foot = (note, acts) => '<div class="fa-bar"><span class="l">' + (note || "") + "</span>" + acts + "</div>";
  const sw2 = (t, s, on) => '<div class="setting" style="padding:9px 0;border:0"><div class="grow"><b>' + t + "</b><small>" + s + "</small></div>" + sw(on) + "</div>";
  const th2 = (a) => "<thead><tr>" + a.map((x) => "<th" + (x[0] === ">" ? ' class="num"' : "") + ">" + x.replace(/^>/, "") + "</th>").join("") + "</tr></thead>";
  const tb = (cols, rows, noPanel) => (noPanel ? "" : '<div class="panel" style="margin-top:0"><div class="tbl-scroll">') + "<table>" + th2(cols) + "<tbody>" + rows.map((r) => (r.cls ? '<tr class="' + r.cls + '"' + (r.go ? " onclick=\"location.hash='#admin/" + r.go + "'\"" : "") + ">" : "<tr>") + (r.cells || r).map((c) => "<td>" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table>" + (noPanel ? "" : "</div></div>");
  const clk = (go, cells) => ({ cls: "clk", go, cells });
  const stepper = (steps, on) => '<div class="stepper">' + steps.map((s, i) => '<span class="st ' + (i < on ? "done" : i === on ? "on" : "") + '"><i>' + (i < on ? I("check", 11) : i + 1) + "</i>" + s + "</span>").join("") + "</div>";
  const AVS = { PR: ["Petros Rodinos", ""], AM: ["Anna Meyer", ""], MS: ["Marco Silva", "g"], SJ: ["Sofia Jensen", "y"], JK: ["Jon Kim", "r"], KL: ["Kim Lund", "p"], EP: ["Elena Papadaki", ""], NG: ["Nikos Georgiou", "g"] };
  const wp = (a, s) => who(a, AVS[a][1], AVS[a][0], s || "");
  const keyList = (a) => a.map(keyc).join(" ");
  const sc = (l, m) => '<span class="badge ' + (m || "") + '" title="ScopeType">' + l + "</span>";
  /* permission chip state: 1 ALLOW, 2 DENY, 0 none. flags: 1 sensitive, 2 field-level */
  const chip = (a, st, fg) => '<span class="ac ' + (st === 2 ? "deny" : st ? "on" : "") + '" title="' + a + '">' + (st === 1 ? I("check", 11) : st === 2 ? I("x", 11) : "") + a + (fg & 1 ? '<span class="sens">*</span>' : "") + (fg & 2 ? '<span class="fl">F</span>' : "") + "</span>";
  const permCount = () => Object.values(PERMS).reduce((n, d) => n + Object.values(d).reduce((m, a) => m + a.length, 0), 0);

  /* =====================================================================================================================
     INVITE MEMBER (full page)
     @screen Invite member
     @route  /admin/invitations/new   (primary button "Invite member" in the Admin header)
     @perm   VIEW + ACTION users.members.invite · type EXTERNAL_COLLABORATOR / GUEST also needs users.external_collaborators.manage* · audience CUSTOMER_PORTAL needs portal.users.manage* ·
             invitation_policy ADMINS_ONLY (OrganizationSecurityPolicy) additionally requires an admin role. The role list only offers roles the caller may assign (privilege escalation rule, users.roles.assign*).
     @api    POST /invitations {emails[], audience, type, role_id, scope_type, scope_id, branch_id, team_id, modules[], customer_id?, message, expires_in_days} -> per-email result array ·
             POST /invitations/validate (dry run: invalid / already member / domain not allowed) · GET /invitations/link (source INVITATION_LINK) · POST /invitations/import (CSV, source BULK_IMPORT)
     @mcp    users_members_invite (sensitive types need human confirmation)
     @data   Invitation (email, type, audience, role_id, branch_id, team_id, modules[], status, source, message, expires_at, customer_id, invited_by_user_id) · OrganizationSecurityPolicy (restrict_invitations_to_domains,
             allowed_email_domains, invitation_policy) · Role (modules default) · Branch · Team
     @ui     Form (react-hook-form + zod), Textarea turned into email chips, ToggleGroup (audience), Select (type, expiry), Combobox = Popover+Command (role, branch, team, customer), Checkbox grid (modules), Alert, Button
     @states idle · validating (per-chip spinner) · per-email errors · submitting · partial success (some sent, some failed) · no-access · policy blocks (ADMINS_ONLY)
     @audit  invitation.sent (one per email) · invitation.bulk_imported
     @note   Tokens are single-use, only token_hash is stored. Module access defaults to Role.modules and may only be NARROWED, never widened beyond the role. External collaborators need a RESOURCE scope and an end date.
     @gap    Invitation has no scope_type / scope_id / valid_until: an external collaborator invite cannot carry "only project X until Jan 31" (see gaps-01b.md #1).
     ===================================================================================================================== */
  function inviteNew() {
    const mods = ["PROJECTS", "TASKS", "TIME_TRACKING", "DOCUMENTS", "CALENDAR", "MESSAGING", "SUPPORT", "CRM", "FINANCE", "PROPOSALS", "CONTRACTS", "COMMUNICATION"];
    const fromRole = ["PROJECTS", "TASKS", "TIME_TRACKING", "DOCUMENTS", "CALENDAR", "MESSAGING", "SUPPORT"];
    const chipE = (t, s, m) => '<span class="tok ' + (s ? "bad" : "") + '">' + (m ? I("x", 12) : I("check", 12)) + t + (s ? ' <small class="muted">' + s + "</small>" : "") + "</span>";
    return '<div class="a-page">' + back("invitations", "Invitations") + head("Invite members", "Send one invitation per email. Access is decided now, by role, scope and modules (§65–67).", btn("Bulk import CSV", "file") + btn("Copy invite link", "link")) +
      '<div class="g-main"><div class="stack">' +
      cd("<b>1 · Who</b><span class='r muted'>Invitation.email</span>", fl("Email addresses", ta(chipE("dana@logiqdev.example") + chipE("lucas@gmail.example", "domain not allowed", 1) + chipE("anna@logiqdev.example", "already a member", 1) + chipE("new.hire@logiqdev.example") + chipE("not-an-email", "invalid", 1)), "Paste comma, space or line separated emails (max 100). Each chip is validated server-side: format, existing Membership, allowed_email_domains.", 1) +
        fl("Audience", '<div class="seg"><button class="on">Member</button><button>Customer portal user</button></div>', "Member = internal staff, external collaborator or guest. Customer portal user = CustomerPortalMembership of a customer company (§79).") +
        '<div class="g2">' + fl("Membership type", sel("Internal", "users"), "MembershipType: INTERNAL | EXTERNAL_COLLABORATOR | GUEST") + fl("Customer (portal audience only)", sel("— not applicable —", "building"), "CRM Company, required when audience is CUSTOMER_PORTAL") + "</div>") +
      cd("<b>2 · Access</b><span class='r muted'>role · scope · modules</span>",
        '<div class="g2">' + fl("Role", sel("Developer · v2", "shield"), "Only roles you may assign are listed (RoleStatus PUBLISHED).", 1) + fl("Role scope", '<div class="seg"><button class="on">Organization</button><button>Branch</button><button>Team</button><button>Project</button></div>', "Scope of the first RoleAssignment") + "</div>" +
        '<div class="g2">' + fl("Primary branch", sel("Athens", "building"), "MembershipBranch.is_primary") + fl("Team", sel("Engineering", "people"), "TeamMembership (team_role = Member)") + "</div>" +
        fl("Module access (MembershipModuleAccess)", '<div class="modgrid">' + mods.map((m) => '<label class="mg ' + (fromRole.includes(m) ? "" : "off") + '">' + cb(fromRole.includes(m)) + "<span>" + modLabel(m) + "</span>" + (fromRole.includes(m) ? "" : '<small class="muted">not in role</small>') + "</label>").join("") + "</div>", "Defaults to Role.modules (7). You can narrow it; modules the role does not include cannot be added here.") +
        callout("shield", "Sensitive role permissions in <b>Developer</b>: none. Inviting as <b>Admin</b> would need " + keyc("users.roles.assign") + " and is audited as " + keyc("membership.admin_promoted") + ".")) +
      cd("<b>3 · Message & expiry</b>", fl("Personal message", ta("Welcome to the team! You will start on the Web squad."), "Shown in the email; max 500 characters. Never put secrets here.") + '<div class="g2">' + fl("Expires after", sel("7 days", "clock"), "Invitation.expires_at") + fl("Send", '<div class="seg"><button class="on">Now</button><button>Schedule</button></div>') + "</div>") +
      foot("Nothing is sent until you press Send. 3 valid, 2 need fixing.", btn("Cancel", "") + btn("Save as draft", "") + btn("Send 3 invitations", "send", "primary")) +
      '</div><div class="stack">' +
      cd("<b>Summary</b>", kv("Recipients", "3 valid · 2 errors") + kv("Audience", E("MEMBER")) + kv("Type", E("INTERNAL")) + kv("Role", "Developer") + kv("Primary branch", "Athens") + kv("Team", "Engineering") + kv("Modules", "7 of 12") + kv("Expires", "in 7 days") + kv("Invited by", "Petros R.")) +
      cd("<b>Organization policy</b><span class='r muted'>OrganizationSecurityPolicy</span>", kv("Who can invite", E("PERMISSION_HOLDERS")) + kv("Restrict to domains", "On · logiqdev.example") + kv("MFA policy", E("REQUIRED_FOR_ADMINS")) + callout("lock", "Invitees outside <b>logiqdev.example</b> are rejected server-side (restrict_invitations_to_domains).", "warn")) +
      cd("<b>Email preview</b><span class='r muted'>NotificationTemplate</span>", '<div class="mailprev"><b>Petros invited you to Logiqdev</b><p>Welcome to the team! You will start on the Web squad.</p><span class="btn primary sm">Accept invitation</span><small class="muted">Link valid for 7 days. Single-use token.</small></div>') + "</div></div>" +
      dm(["Invitation · email, type, audience, role_id, branch_id, team_id, modules, status, source, message, expires_at, customer_id, invited_by_user_id", "OrganizationSecurityPolicy · invitation_policy, restrict_invitations_to_domains, allowed_email_domains", "Role · modules (defaults)"], ["Invitation has no scope_type / scope_id / valid_until (external collaborator invite to one project until a date)"]) + "</div>";
  }

  /* =====================================================================================================================
     MEMBER DETAIL with tabs (replaces the old single-page member screen; the old one stays reachable as #admin/member-access)
     @screen Member detail
     @route  /admin/members/:membershipId?tab=profile|roles|branches|teams|sessions|devices|audit|api
     @perm   VIEW users.members.read · edit profile users.members.manage* · roles users.roles.assign* · branches organizations.branches.members.manage · teams organizations.teams.members.manage ·
             sessions users.sessions.read* / users.sessions.revoke* · devices users.sessions.read* · audit organizations.audit.read* · API access organizations.api_keys.manage* · suspend users.members.manage* · offboard users.members.offboard*
             HR fields stay hidden without employees.* field-level keys.
     @api    GET /members/:id · PATCH /members/:id {job_title, ...} · GET /members/:id/role-assignments · POST /members/:id/role-assignments · PUT /members/:id/branches · PUT /members/:id/teams ·
             GET /members/:id/sessions · DELETE /sessions/:id · GET /members/:id/devices · GET /audit-events?actor_user_id=|resource_id= · GET /api-keys?membership_id= · GET /service-accounts?owner_membership_id=
     @mcp    users_members_read · users_members_manage* · users_roles_assign* · users_sessions_revoke* · organizations_audit_read* · organizations_api_keys_manage*
     @data   Membership · User · UserAuthMethod · RoleAssignment · PermissionGrant · MembershipBranch · BranchManager · TeamMembership · MembershipModuleAccess · UserSession · NotificationPushDevice · AuditEvent · ApiKey · ServiceAccount
     @ui     Tabs (URL synced), Card, Table, Dialog (assign role, add branch/team), AlertDialog (suspend, offboard, revoke), DropdownMenu, Switch, Badge
     @states loading per tab · 404 · error · no-access (tab hidden) · read-only banner for Owner when the caller is not an Owner
     @audit  membership.updated · membership.role_assigned | role_removed · membership.branch_assigned · membership.team_assigned | team_removed · session.revoked · membership.suspended | membership.offboarded
     @note   Each tab loads lazily. Tabs the caller may not see are removed, not disabled. Exactly one primary branch. "Devices" = push/desktop registrations (NotificationPushDevice) next to the browser sessions.
     @gap    No table for trusted/known devices of a user (fingerprint, first seen, trusted_at): Devices shows push registrations only (gaps-01b.md #6).
     ===================================================================================================================== */
  function memberDetail() {
    const sessions = [["MacBook · Chrome 131", "85.74.x.x", "Athens, GR", "Athens +1", "Today 08:12", "Now", "Nov 25", 1], ["iPhone · Safari", "85.74.x.x", "Athens, GR", "All", "Nov 9", "2h ago", "Nov 23", 0], ["Windows · Edge 130", "94.66.x.x", "Athens, GR", "Athens", "Nov 2", "6d ago", "Nov 16", 0]];
    const devices = [["IOS", "Anna’s iPhone 15", "APNs", "5.12.1", "2h ago", 0, ""], ["WEB", "Chrome · MacBook", "WebPush", "web", "Now", 0, ""], ["ANDROID", "Pixel 8 (old)", "FCM", "5.9.0", "Sep 14", 6, "Disabled Sep 20"]];
    const audit = [["Today 08:12", "session.created", "user_session · MacBook", "yellow-"], ["Yesterday", "membership.role_assigned", "Developer · PROJECT Acme Rebrand", ""], ["3d ago", "membership.permission_granted", "crm.deals.read", ""], ["6d ago", "user.password_changed", "user · self", ""], ["12d ago", "api_key.created", "api_key · lq_live_4f9a…", ""]];
    return '<div class="a-page">' + back("members", "Members") +
      '<div class="cd" style="margin-bottom:14px"><div class="hdr-card">' + AV("AM", "", "xl") + '<div class="nm"><h2>Anna Meyer ' + S("ACTIVE") + E("INTERNAL") + '</h2><div class="muted">anna@logiqdev.example · Delivery Lead · joined Mar 12, 2025 · last active 2m ago · MFA on</div></div>' + btn("Suspend", "") + btn("Offboard", "x") + btn("Send password reset", "mail") + "</div></div>" +
      '<div class="tabset">' + tabs([["p", "Profile"], ["r", "Roles & scopes", 3], ["b", "Branches", 2], ["t", "Teams", 2], ["s", "Sessions", 3], ["d", "Devices", 3], ["a", "Audit"], ["k", "API access", 2]], "p") +
      /* @impl Profile: Membership.job_title is editable here; display_name/email/phone belong to the global User and are edited by the user themself (an admin can only trigger a reset). Shows UserAuthMethod state, never secrets. */
      pane("p", 1, '<div class="g2">' + cd("<b>Membership</b><span class='r'>" + btn("Edit", "edit", "sm") + "</span>", kv("Display name", "Anna Meyer " + muted("User.display_name")) + kv("Job title", "Delivery Lead") + kv("Type", E("INTERNAL")) + kv("Status", S("ACTIVE")) + kv("Provisioning", E("MANUAL")) + kv("Invited by", "Petros R. · Mar 2025") + kv("Joined", "Mar 12, 2025") + kv("Employee profile", "<a style='text-decoration:underline'>Open in Employees</a>")) +
        cd("<b>Identity (User)</b>", kv("Email", "anna@logiqdev.example " + muted("verified")) + kv("Phone", "+30 69… " + muted("verified")) + kv("Locale · timezone", "en-GB · Europe/Athens") + kv("Last login", "Today 08:12") + kv("Password changed", "41 days ago") + kv("MFA", "TOTP + passkey") + kv("Default organization / branch", "Logiqdev / Athens")) + "</div>" +
        '<div style="height:14px"></div>' + cd("<b>Sign-in methods</b><span class='r muted'>UserAuthMethod · secrets never shown</span>", '<div class="rowx"><div class="grow"><b>Password</b><small>verified</small></div>' + E("PASSWORD", "green") + '</div><div class="rowx"><div class="grow"><b>Authenticator app</b><small>last used 2m ago</small></div>' + E("TOTP", "green") + btn("Reset MFA", "", "sm") + '</div><div class="rowx"><div class="grow"><b>Passkey “MacBook”</b><small>last used 3d ago</small></div>' + E("PASSKEY", "green") + "</div>", 1) +
        callout("lock", "HR data (compensation, national id) is hidden unless you hold " + keyc("employees.compensation.read") + " (field-level).")) +
      /* @impl Roles & scopes: RoleAssignment rows + inline "Assign role" form (Dialog in production) + PermissionGrant + module access. Scope target Combobox depends on scope_type. valid_until DatePicker. Reason is required for sensitive roles. */
      pane("r", 0, '<div class="g-main"><div class="stack">' + cd("<b>Role assignments</b><span class='r'>" + btn("Assign role", "plus", "sm") + "</span>", tb(["Role", "Scope", "Valid", "Granted by · reason", ""], [["<b class='ink'>Project Manager</b>", E("ORGANIZATION"), "Always", "Petros R. · onboarding", more], ["<b class='ink'>Branch Admin</b>", E("BRANCH") + " · Athens", "Always", "Petros R. · branch manager", more], ["<b class='ink'>Developer</b>", E("PROJECT") + " · Acme Rebrand", "until Jan 31", "Anna M. · cover", more]], 1), 1) +
        cd("<b>Permission grants</b><span class='r muted'>PermissionGrant</span>", tb(["Permission", "Effect", "Scope", "Valid until", "Reason"], [['<span class="key">crm.deals.read</span>', E("ALLOW", "green"), E("ORGANIZATION"), "Dec 31", muted("Q4 handover")], ['<span class="key">finance.invoices.approve</span>', E("DENY", "red"), E("ORGANIZATION"), "—", muted("Separation of duties")]], 1), 1) +
        cd("<b>Module access</b><span class='r muted'>MembershipModuleAccess</span>", '<div class="g2" style="gap:0">' + [["PROJECTS", 1], ["TASKS", 1], ["TIME_TRACKING", 1], ["CRM", 1], ["FINANCE", 0], ["PROPOSALS", 0]].map((m) => '<div class="setting" style="padding:9px 16px"><div class="grow"><b>' + modLabel(m[0]) + "</b><small class='mono'>" + m[0] + "</small></div>" + sw(m[1]) + "</div>").join("") + "</div>", 1) + "</div>" +
        '<div class="stack">' + cd("<b>Assign role</b><span class='r muted'>Dialog</span>", fl("Role", sel("Finance Manager", "shield"), "", 1) + fl("Scope", '<div class="seg"><button class="on">Organization</button><button>Branch</button><button>Team</button><button>Project</button></div>') + fl("Scope target", sel("— entire organization —", "building")) + '<div class="g2">' + fl("Valid from", sel("Today", "calendar")) + fl("Valid until", sel("No end", "calendar")) + "</div>" + fl("Reason", ta("Required for sensitive roles"), "Stored on RoleAssignment.reason and in the audit event.", 1) + callout("shield", "You hold every permission in this role, so you may assign it.") + '<button class="btn primary" style="width:100%">' + I("check", 14) + " Assign role</button>") + "</div></div>") +
      /* @impl Branches tab: MembershipBranch (is_primary, include_children, started_at, ended_at) + BranchManager (title). One primary per member. */
      pane("b", 0, cd("<b>Branches</b><span class='r'>" + btn("Add branch", "plus", "sm") + "</span>", tb(["Branch", "Primary", "Include children", "Since", "Until", "Manager title", ""], [["<b class='ink'>Athens</b> " + E("OFFICE"), '<span class="radio on"></span>', cb(1), "Mar 2025", "—", "Delivery Lead", more], ["<b class='ink'>Thessaloniki</b> " + E("OFFICE"), '<span class="radio"></span>', cb(0), "Jun 2025", "—", "—", more]], 1), 1) + callout("building", "Exactly one primary branch per member. Include children = the membership also covers sub-branches (MembershipBranch.include_children).")) +
      pane("t", 0, cd("<b>Teams</b><span class='r'>" + btn("Add to team", "plus", "sm") + "</span>", tb(["Team", "Kind", "Team role (label)", "Lead", "Primary", "Since", ""], [["<b class='ink'>Delivery</b>", E("DEPARTMENT", "blue"), "Delivery Lead", cb(1), cb(1), "Mar 2025", more], ["<b class='ink'>Web squad</b>", E("TEAM"), "Member", cb(0), cb(0), "Jun 2025", more]], 1), 1) + callout("people", "Team membership gives context, not permissions. Permissions come from a RoleAssignment with scope TEAM.")) +
      pane("s", 0, cd("<b>Sessions</b><span class='r'>" + btn("Revoke all except current", "x", "sm") + "</span>", tb(["Device · browser", "IP", "Location (approx.)", "Active branches", "Signed in", "Last activity", "Expires", ""], sessions.map((s) => [(s[0].includes("MacBook") ? "<b class='ink'>" + s[0] + "</b> " : "<b class='ink'>" + s[0] + "</b>") + (s[7] ? '<span class="badge green">This device</span>' : ""), '<span class="mono">' + s[1] + "</span>", s[2], s[3], s[4], s[5], muted(s[6]), s[7] ? "" : btn("Revoke", "", "sm")]), 1), 1)) +
      pane("d", 0, cd("<b>Devices</b><span class='r muted'>NotificationPushDevice</span>", tb(["Platform", "Device", "Provider", "App version", "Last seen", "Failures", "State", ""], devices.map((d) => [E(d[0]), "<b class='ink'>" + d[1] + "</b>", d[2], d[3], d[4], d[5], d[6] ? E("DISABLED", "red") : S("ACTIVE"), btn("Remove", "", "sm")]), 1), 1) + callout("bell", "Push registrations are created by the mobile and desktop apps. Removing one stops notifications on that device only.")) +
      pane("a", 0, FB([["Actor or resource", "is", "Anna Meyer"], ["Date", "in", "Last 30 days"]], sel("Event type") + btn("Open full audit log", "file", "sm")) + tb(["When", "Event type", "Resource"], audit.map((a) => [muted(a[0]), '<span class="badge key">' + a[1] + "</span>", a[2]])) ) +
      /* @impl API access: ApiKey rows owned by this membership + ServiceAccounts where owner_membership_id = member. Effective permissions of a key = owner permissions ∩ key.scopes ∩ key scope (01 §75). Offboarding must revoke these first. */
      pane("k", 0, cd("<b>API keys owned by Anna</b><span class='r'>" + btn("Create key for Anna", "plus", "sm") + "</span>", tb(["Name", "Key", "Scope", "Permissions", "Expires", "Last used", ""], [["<b class='ink'>Zapier sync</b>", '<span class="key">lq_live_4f9a…</span>', "Organization", keyList(["tasks.tasks.read", "tasks.tasks.create"]), "Dec 31, 2026", "2m ago", more], ["<b class='ink'>Reporting export</b>", '<span class="key">lq_live_9e03…</span>', "Branch · Athens", keyList(["finance.invoices.read"]), "Nov 30, 2026", "Never", more]], 1), 1) +
        '<div style="height:12px"></div>' + cd("<b>Service accounts owned</b>", '<div class="rowx"><div class="grow"><b>Lead intake</b><small>ServiceAccount.owner_membership_id · Sales Manager (ORGANIZATION) · 1 key</small></div>' + S("ACTIVE") + "</div>", 1) +
        callout("shield", "Offboarding Anna requires reassigning these credentials first (§133). A key never gets more than its owner holds.", "warn")) + "</div>" +
      dm(["Membership · User · UserAuthMethod", "RoleAssignment · PermissionGrant · MembershipModuleAccess", "MembershipBranch · BranchManager · TeamMembership", "UserSession · NotificationPushDevice (platform, device_name, app_version, last_seen_at, failure_count, disabled_at)", "AuditEvent · ApiKey (membership_id) · ServiceAccount (owner_membership_id)"], ["Trusted / known devices per user: no table, only sessions and push registrations (gaps-01b.md #6)"]) + "</div>";
  }

  /* =====================================================================================================================
     CREATE / EDIT ROLE with the full permission matrix
     @screen Role editor (create + edit)
     @route  /admin/roles/new?template=<roleId>  ·  /admin/roles/:id/edit
     @perm   VIEW users.roles.read · create/save/publish users.roles.manage* · the editor can only ALLOW permissions they hold themselves (others render locked) · sensitive keys need users.roles.assign* to hand out
     @api    GET /permissions (full catalog, grouped by module) · POST /roles {name, description, type, default_scope, modules[], restrictions, template_role_id?, permissions:[{key, effect, conditions}]} ·
             PUT /roles/:id · POST /roles/:id/publish {note}
     @mcp    users_roles_manage* (publish needs human confirmation)
     @data   Role (name, slug, description, type, status, default_scope, modules, restrictions, template_role_id, version) · RolePermission (effect ALLOW|DENY, conditions) · Permission (key, module, resource, action, is_sensitive, is_field_level)
     @ui     Accordion per ModuleKey, ToggleGroup chips (ALLOW / DENY / none, cycle on click), Checkbox (group, indeterminate), Command search, Form + zod, Sheet (diff before publish), AlertDialog (publish)
     @states loading · conflict 409 · validation (name taken: unique(organization_id, slug)) · read-only for SYSTEM/template roles · locked chips for permissions the editor does not hold
     @audit  role.created · role.updated · role.published
     @note   Counts here come from the REAL seeded catalog (249 keys). Chip legend: green = ALLOW, red x = DENY (DENY always wins), outline = not granted, * = sensitive (Permission.is_sensitive), F = field-level (hides fields, not records).
             Scope: Role.default_scope is the scope a new assignment starts with; the actual scope is chosen per RoleAssignment. A role can only grant keys of modules listed in Role.modules.
     @gap    Per-permission scope limits (e.g. "invoices.read only for BRANCH") are not modelled: RolePermission has only effect + conditions JSON (gaps-01b.md #7).
     ===================================================================================================================== */
  function roleNew() {
    const mods = Object.keys(PERMS);
    const allowMods = ["PROJECTS", "TASKS", "TIME_TRACKING", "DOCUMENTS", "CALENDAR", "MESSAGING"], readMods = ["CRM", "SUPPORT", "NOTIFICATIONS"];
    const state = (mod, k, a, fg) => (k === "finance.invoices.approve" ? 2 : fg & 1 ? 0 : allowMods.includes(mod) && /^(read|create|update|comment|assign|log|view|manage_own|submit|share)/.test(a) ? 1 : readMods.includes(mod) && a === "read" ? 1 : 0);
    let allow = 0, deny = 0, sens = 0;
    const groups = mods.map((mod, gi) => {
      const rows = Object.keys(PERMS[mod]);
      let g = 0, tot = 0;
      const body = rows.map((p) => '<div class="pr"><span class="nm key">' + p + '</span><div class="acts">' + PERMS[mod][p].map((x) => { const st = state(mod, p + "." + x[0], x[0], x[1]); tot++; if (st === 1) { g++; allow++; } if (st === 2) { deny++; } if (x[1] & 1) sens++; return chip(x[0], st, x[1]); }).join("") + "</div></div>").join("");
      return '<div class="pg ' + (gi < 2 ? "open" : "") + '"><div class="pg-h" onclick="this.parentElement.classList.toggle(\'open\')">' + I("right", 13).replace('class="ico"', 'class="ico chv"') + cb(g === tot ? 1 : g ? "mix" : 0) + "<b>" + modLabel(mod) + '</b><span class="mono muted">' + mod + '</span><span class="muted" style="margin-left:auto">' + g + " of " + tot + " granted</span></div><div class=\"pg-b\">" + body + "</div></div>";
    }).join("");
    return '<div class="a-page">' + back("roles", "Roles") + head("Create role", "Clone a template, then adjust. A new role starts as DRAFT; publishing creates version 1 (§44–45, §109).", btn("Cancel", "") + btn("Save draft", "") + btn("Publish role", "check", "primary")) +
      '<div class="g-main" style="grid-template-columns:minmax(0,1fr) 340px"><div class="stack">' +
      cd("<b>Permissions</b><span class='r'>" + search("Filter " + permCount() + " keys…") + "</span>",
        '<div class="toolbar" style="margin:0;border-bottom:1px solid var(--hairline);padding:10px 16px"><div class="seg"><button class="on">All modules</button><button>Selected only</button><button>Sensitive</button><button>Field-level</button><button>DENY</button></div><span style="flex:1"></span><button class="btn sm">' + I("layers", 13) + ' Copy from role</button><button class="btn sm">Clear all</button></div>' + groups, 1) +
      '<div class="sub-note" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' + chip("ALLOW", 1, 0) + chip("DENY", 2, 0) + chip("not granted", 0, 0) + chip("sensitive", 0, 1) + chip("field-level", 0, 2) + "<span>Click a chip to cycle: not granted → ALLOW → DENY. DENY always wins (§53). Open a chip for " + keyc("conditions") + " (JSON).</span></div></div>" +
      '<div class="stack">' +
      cd("<b>Details</b>", fl("Name", inp("Contractor (read-only)"), "unique per organization · slug contractor-read-only", 1) + fl("Description", ta("Limited access for external contractors on one project."), "") + '<div class="g2">' + fl("Type", sel(en("ORGANIZATION"), "shield"), "RoleType") + fl("Status", sel(en("DRAFT"), "check")) + "</div>" + fl("Default scope", sel(en("PROJECT"), "building"), "ScopeType the assignment dialog starts with") + fl("Start from template", sel("Developer (platform template)", "layers"), "sets template_role_id; permissions are copied") + fl("Modules (ModuleKey[])", '<div style="display:flex;gap:6px;flex-wrap:wrap">' + ["PROJECTS", "TASKS", "TIME_TRACKING", "DOCUMENTS", "CALENDAR", "MESSAGING"].map(tok).join("") + '<span class="tok" style="border-style:dashed;color:var(--ash)">+ Add</span></div>', "Only keys of these modules are active; it never bypasses OrganizationModule.")) +
      cd("<b>Summary</b>", '<div class="mini-stats" style="grid-template-columns:repeat(3,1fr);margin:0">' + stat("Allowed", allow, "keys") + stat("Denied", deny, "keys") + stat("Sensitive", 0, sens + " in catalog") + "</div>" + kv("Modules with grants", "6 of " + mods.length) + kv("Members who will get it", "0 (draft)")) +
      cd("<b>Restrictions</b><span class='r muted'>Role.restrictions (JSON)</span>", sw2("Require MFA", "require_mfa", 1) + sw2("Hide billing rates", "hide_rates", 1) + sw2("Hide customer contact details", "hide_customer_contacts", 0)) +
      cd("<b>Who can assign this role</b>", kv("Assign permission", keyc("users.roles.assign")) + kv("Assignable scopes", sc("Organization") + " " + sc("Branch") + " " + sc("Team") + " " + sc("Project")) + callout("shield", "Privilege escalation: you can only ALLOW permissions you hold yourself. Locked chips are permissions you do not have.", "warn")) + "</div></div>" +
      dm(["Role · name, slug, description, type, status, default_scope, modules, restrictions, template_role_id, version", "RolePermission · permission_id, effect, conditions", "Permission · key, module, resource, action, is_sensitive, is_field_level (" + permCount() + " seeded keys)"], ["Per-permission scope (e.g. read only within BRANCH): RolePermission has no scope column (gaps-01b.md #7)"]) + "</div>";
  }

  /* =====================================================================================================================
     CREATE TEAM / CREATE BRANCH (full pages) + TEAM DETAIL
     @screen Create team · Team detail · Create branch
     @route  /admin/teams/new · /admin/teams/:id · /admin/branches/new
     @perm   organizations.teams.manage · organizations.teams.members.manage · organizations.branches.manage* · organizations.branches.settings.manage (localization, hours) · organizations.branches.members.manage
     @api    POST /teams {name, slug, kind, parent_team_id, branch_id, task_key, description, members[]} · GET /teams/:id · PUT /teams/:id/members · POST /branches {name, code, kind, parent_branch_id, is_headquarters, ...} · POST /branches/:id/holidays
     @mcp    organizations_teams_manage · organizations_branches_manage*
     @data   Team (name, slug, task_key, description, kind, parent_team_id, branch_id, archived_at) · TeamMembership (team_role, is_primary, is_lead) · Branch (all columns) · BranchManager · BranchHoliday
     @ui     Form + zod, Select (kind), Combobox (parent, branch, lead, members), Switch, Table, Alert, Button
     @states idle · validation (slug/code taken, cycle in hierarchy, second headquarters) · saving · no-access
     @audit  team.created | team.updated | team.archived | membership.team_assigned · branch.created | branch.updated | branch.manager_changed
     @note   Team.task_key (e.g. WEB) is read by Tasks (06) to build task keys: unique per organization, 2-6 uppercase letters. path/depth of a Branch are computed by the API. Only ONE headquarters.
     ===================================================================================================================== */
  function teamNew() {
    return '<div class="a-page">' + back("teams", "Teams") + head("Create team", "A functional group. Teams are not branches (§82). Departments are teams of kind DEPARTMENT (§43).", btn("Cancel", "") + btn("Create team", "check", "primary")) +
      '<div class="g-main"><div class="stack">' +
      cd("<b>Team</b>", '<div class="g2">' + fl("Name", inp("Mobile squad"), "", 1) + fl("Slug", inp("mobile-squad"), "unique per organization") + "</div>" + fl("Description", ta("Builds and ships the iOS and Android apps."), "") + '<div class="g2">' + fl("Kind", '<div class="seg"><button class="on">Team</button><button>Department</button><button>Business unit</button><button>Project team</button></div>', "TeamKind") + fl("Task key", inp("MOB"), "Team.task_key · prefix of task keys (MOB-87). Used by Tasks (06).") + "</div>") +
      cd("<b>Placement</b>", '<div class="g2">' + fl("Parent team", sel("Engineering", "people"), "parent_team_id · no cycles allowed") + fl("Branch restriction", sel("Thessaloniki", "building"), "empty = organization-wide; a branch-restricted team only accepts members of that branch (§88)") + "</div>") +
      cd("<b>Members</b><span class='r'>" + btn("Add member", "plus", "sm") + "</span>", tb(["Member", "Team role (label)", "Lead", "Primary", ""], [[wp("JK"), "Mobile Developer", cb(1), cb(1), more], [wp("SJ"), "Designer", cb(0), cb(0), more], [wp("MS"), "Reviewer", cb(0), cb(0), more]], 1), 1) +
      callout("shield", "Members of a team do not receive permissions by being in it. To give the whole team access, assign a role with scope TEAM (Members > Roles & scopes)." ) +
      foot("Audited as team.created", btn("Cancel", "") + btn("Create team", "check", "primary")) + "</div>" +
      '<div class="stack">' + cd("<b>Preview</b>", '<div class="rowx"><div class="grow"><b>Mobile squad</b><small>under Engineering · Thessaloniki</small></div>' + E("TEAM") + "</div>" + kv("Task key", keyc("MOB-1")) + kv("Members", 3) + kv("Leads", 1)) + "</div></div>" +
      dm(["Team · name, slug, task_key, description, kind, parent_team_id, branch_id", "TeamMembership · team_role, is_primary, is_lead"], []) + "</div>";
  }
  function team() {
    return '<div class="a-page">' + back("teams", "Teams") + '<div class="cd" style="margin-bottom:14px"><div class="hdr-card"><span class="avatar xl sq n">' + I("people", 20) + '</span><div class="nm"><h2>Mobile squad ' + E("TEAM") + '</h2><div class="muted">slug ' + keyc("mobile-squad") + " · task key " + keyc("MOB") + " · parent Engineering · branch Thessaloniki</div></div>" + btn("Archive", "archive") + btn("Edit", "edit") + "</div></div>" +
      '<div class="tabset">' + tabs([["m", "Members", 3], ["r", "Role assignments", 1], ["c", "Child teams", 0], ["a", "Audit"]], "m") +
      pane("m", 1, cd("<b>Members</b><span class='r'>" + btn("Add member", "plus", "sm") + "</span>", tb(["Member", "Team role", "Lead", "Primary", "Since", ""], [[wp("JK", "jon@logiqdev.example"), "Mobile Developer", E("LEAD", "purple"), cb(1), "Jun 2025", more], [wp("SJ", "sofia@logiqdev.example"), "Designer", muted("—"), cb(0), "Aug 2025", more], [wp("MS", "marco@logiqdev.example"), "Reviewer", muted("—"), cb(0), "Sep 2025", more]], 1), 1)) +
      pane("r", 0, cd("<b>Roles scoped to this team</b><span class='r muted'>RoleAssignment · scope_type TEAM</span>", tb(["Role", "Assigned to", "Valid", "Granted by"], [["<b class='ink'>Project Manager</b>", wp("JK"), "Always", "Petros R."]], 1), 1)) +
      pane("c", 0, callout("people", "No child teams. Create one with this team as parent (parent_team_id).")) +
      pane("a", 0, tb(["When", "Event type", "Detail"], [[muted("Sep 2"), '<span class="badge key">membership.team_assigned</span>', "Marco Silva → Mobile squad"], [muted("Jun 3"), '<span class="badge key">team.created</span>', "Mobile squad"]])) + "</div>" +
      dm(["Team · TeamMembership", "RoleAssignment · scope_type TEAM, scope_id", "AuditEvent · team.* / membership.team_*"], []) + "</div>";
  }
  function branchNew() {
    return '<div class="a-page">' + back("branches", "Branches") + head("Create branch", "An organizational unit, never a tenant (§16). The hierarchy (path, depth) is computed by the API.", btn("Cancel", "") + btn("Create branch", "check", "primary")) +
      '<div class="g-main"><div class="stack">' +
      cd("<b>Identity</b>", '<div class="g2">' + fl("Name", inp("Patras"), "", 1) + fl("Code", inp("PAT"), "unique per organization, 2–6 chars", 1) + "</div>" + '<div class="g2">' + fl("Kind", sel(en("OFFICE"), "building"), "BranchKind: OPERATIONAL | OFFICE | REGIONAL_UNIT | SUBSIDIARY_REFERENCE | SERVICE_CENTER | REMOTE") + fl("Parent branch", sel("Greece", "layers"), "parent_branch_id") + "</div>" + sw2("Headquarters", "Branch.is_headquarters · only one per organization (Athens is HQ today)", 0) + sw2("Create as planned", "status PLANNED until it opens", 1)) +
      cd("<b>Location & contact</b>", '<div class="g2">' + fl("Country", sel("Greece", "globe")) + fl("Region · city", inp("Western Greece · Patras")) + "</div>" + fl("Address", inp("Agiou Andreou 40, 26221")) + '<div class="g2">' + fl("Phone", ph("+30 …")) + fl("Email", ph("patras@logiqdev.example")) + "</div>" + fl("Cost center code", ph("CC-PAT-01"), "used by Finance (08) and Employees (10)")) +
      cd("<b>Localization</b><span class='r muted'>empty = inherit organization defaults (§120)</span>", '<div class="g2">' + fl("Currency", sel("Inherit · EUR", "dollar")) + fl("Timezone", sel("Inherit · Europe/Athens", "clock")) + fl("Locale · language", sel("Inherit · en-GB · en", "globe")) + fl("Date format · week start", sel("Inherit · DD/MM/YYYY · Monday", "calendar")) + fl("Working days", sel("Inherit · Mon–Fri", "calendar")) + fl("Business hours", sel("Inherit · 09:00–18:00", "clock"), "drives SLA timers (13), calendar (19), leave (10)") + "</div>") +
      cd("<b>People</b>", fl("Branch managers", '<div style="display:flex;gap:6px;flex-wrap:wrap">' + tok("Anna Meyer") + '<span class="tok" style="border-style:dashed;color:var(--ash)">+ Add</span></div>', "BranchManager rows. Adding a manager does not grant permissions: tick below to also assign Branch Admin scoped to this branch.") + sw2("Also assign the Branch Admin role (scope BRANCH)", "writes a RoleAssignment and audits it", 1)) +
      foot("Audited as branch.created", btn("Cancel", "") + btn("Create branch", "check", "primary")) + "</div>" +
      '<div class="stack">' + cd("<b>Resulting position</b>", kv("path", keyc("/greece/patras")) + kv("depth", "2") + kv("Parent", "Greece") + kv("Status", S("PLANNED")) + callout("building", "Archiving a branch later is blocked while it has active members or open records (§104).")) + "</div></div>" +
      dm(["Branch · name, code, kind, status, parent_branch_id, path, depth, is_headquarters, country, region, city, address, phone, email, cost_center_code, currency, timezone, locale, language, date_format, week_start, working_days, business_hours", "BranchManager · RoleAssignment (scope BRANCH)"], []) + "</div>";
  }

  /* =====================================================================================================================
     CREATE API KEY · CREATE SERVICE ACCOUNT · API KEY DETAIL  (one-time secret reveal)
     @screen Create API key · Create service account · API key detail
     @route  /admin/api-keys/new · /admin/api-keys/:id · /admin/service-accounts/new
     @perm   organizations.api_keys.manage* · organizations.service_accounts.manage* · the creator can only select permission keys they hold; a key can never exceed its owner
     @api    POST /api-keys {name, owner:{membership_id|service_account_id}, scope_type, scope_id, scopes[], expires_at, rotation_due_at} -> 201 {id, key_prefix, secret} (secret returned ONCE) ·
             POST /api-keys/:id/rotate · POST /api-keys/:id/revoke · POST /service-accounts {name, purpose, owner_membership_id, expires_at, role_assignments[{role_id, scope_type, scope_id}]}
     @mcp    organizations_api_keys_manage* · organizations_service_accounts_manage* (human confirmation, never an AI alone)
     @data   ApiKey (name, key_prefix, key_hash, scopes[], scope_type, scope_id, expires_at, rotation_due_at, last_used_at, rotated_from_id, revoked_at, membership_id | service_account_id) · ServiceAccount (name, purpose, owner_membership_id, status, expires_at) · RoleAssignment (service_account_id)
     @ui     Form + zod, RadioGroup (owner kind), Combobox (owner, scope target), Command multi-select grouped by module (scopes), DatePicker/Select (expiry), TagInput (IP allow-list), Dialog "show once" with CopyButton + acknowledgement Checkbox, AlertDialog
     @states idle · validation · creating · SECRET REVEAL (state 2, shown below the form in this mock) · error · no-access
     @audit  api_key.created | api_key.rotated | api_key.revoked | service_account.created | service_account.suspended | service_account.revoked
     @note   The secret is displayed exactly once, in a modal that cannot be dismissed until the admin ticks "I have stored it". Only key_prefix + key_hash persist. A key works for REST and MCP identically.
             Effective permissions = owner permissions ∩ scopes ∩ scope_type/scope_id. Empty scopes = all of the owner's (warn loudly, and forbid it for keys owned by Owner/Admin roles).
     @gap    IP allow-list per key and a per-key usage/request log have no columns/tables (ApiKey has no allowed_ip_ranges; only last_used_at). See gaps-01b.md #2 and #3.
     ===================================================================================================================== */
  function apikeyNew() {
    const pick = [["tasks.tasks", [["read", 1], ["create", 1], ["update", 0], ["delete", 0, 1]]], ["crm.leads", [["read", 1], ["create", 1], ["update", 0]]], ["projects.projects", [["read", 1], ["update", 0]]], ["finance.invoices", [["read", 0], ["approve", 0, 1]]]];
    return '<div class="a-page">' + back("apikeys", "API keys") + head("Create API key", "A credential for REST and MCP. It never inherits a person’s full access (§75).", btn("Cancel", "") + btn("Create key", "key", "primary")) +
      stepper(["Configure", "Copy secret"], 0) +
      '<div class="g-main"><div class="stack">' +
      cd("<b>Identity & owner</b>", fl("Name", inp("Website lead form"), "Shown in lists and audit events. Describe the integration, not the person.", 1) + fl("Owner", '<div class="seg"><button>Member</button><button class="on">Service account</button></div>', "The key can never do more than its owner may.") + fl("Service account", sel("Lead intake · Sales Manager (ORGANIZATION)", "bot"), "ServiceAccount, with its RoleAssignments") + fl("Environment label", '<div class="seg"><button class="on">Live</button><button>Test</button></div>', "Becomes part of the prefix: lq_live_ / lq_test_")) +
      cd("<b>Scope</b><span class='r muted'>ApiKey.scope_type / scope_id</span>", fl("Limit to", '<div class="seg"><button class="on">Organization</button><button>Branch</button><button>Team</button><button>Project</button><button>Customer</button></div>') + fl("Target", sel("— whole organization —", "building"))) +
      cd("<b>Permissions (scopes)</b><span class='r'>" + search("Search keys…") + "</span>",
        '<div style="padding:10px 16px;border-bottom:1px solid var(--hairline)">' + callout("shield", "Only keys the service account already holds are listed. Empty selection = <b>all</b> of its permissions (not recommended).", "warn") + "</div>" +
        pick.map((p) => '<div class="pr"><span class="nm key">' + p[0] + '</span><div class="acts">' + p[1].map((x) => chip(x[0], x[1], x[2] ? 1 : 0)).join("") + "</div></div>").join("") +
        '<div class="sub-note" style="padding:10px 16px">Selected: ' + keyList(["tasks.tasks.read", "tasks.tasks.create", "crm.leads.read", "crm.leads.create", "projects.projects.read"]) + "</div>", 1) +
      cd("<b>Lifetime & network</b>", '<div class="g2">' + fl("Expires", sel("In 90 days · Feb 9, 2027", "calendar"), "ApiKey.expires_at · none is allowed only with a rotation date") + fl("Rotate by", sel("In 60 days · Jan 10, 2027", "calendar"), "rotation_due_at: reminder via Notifications") + "</div>" +
        fl("IP allow-list <span class='badge yellow'>gap</span>", '<div style="display:flex;gap:6px;flex-wrap:wrap">' + tok("203.0.113.0/24") + tok("198.51.100.17") + '<span class="tok" style="border-style:dashed;color:var(--ash)">+ Add CIDR</span></div>', "Requests from other addresses get 403. Needs ApiKey.allowed_ip_ranges (not in the schema yet); org-wide ranges live in the security policy.") +
        sw2("Notify me when the key is used from a new IP", "NotificationEventType · api_key.new_ip (module 14)", 1)) +
      foot("The secret is shown once after creating.", btn("Cancel", "") + btn("Create key", "key", "primary")) + "</div>" +
      '<div class="stack">' +
      cd("<b>Effective access preview</b>", kv("Owner", "Lead intake") + kv("Owner holds", "Sales Manager · 41 keys") + kv("Key scopes", "5 keys") + kv("Scope", E("ORGANIZATION")) + callout("check", "Result: 5 permissions, organization-wide, from allowed IPs only.")) +
      /* @impl STATE 2 — secret reveal Dialog. Not dismissable by outside click/Escape until the acknowledgement checkbox is ticked. The full secret is held in memory only; never logged, never put in the URL, never fetched again. */
      cd("<b>State 2 · Secret created</b><span class='r'><span class='badge green'>Shown once</span></span>", '<div class="reveal"><small>Your new API key</small><div class="secret">lq_live_4f9a2c81d0e7b3a65f12c8e94d07ab3e<span>' + btn("Copy", "", "sm") + "</span></div></div>" + callout("lock", "<b>Copy it now.</b> Logiqdev stores only a hash, so this value cannot be shown again. If you lose it, rotate the key.", "warn") + '<div class="setting" style="padding:10px 0;border:0"><div class="grow"><b>I have stored this key safely</b><small>Enables “Done”</small></div>' + cb(1) + '</div><button class="btn primary" style="width:100%">Done</button>') + "</div></div>" +
      dm(["ApiKey · name, key_prefix, key_hash, scopes, scope_type, scope_id, expires_at, rotation_due_at, membership_id | service_account_id", "ServiceAccount · RoleAssignment (what the owner may do)"], ["Per-key IP allow-list (gaps-01b.md #2)", "Per-key usage log / request counts (gaps-01b.md #3)"]) + "</div>";
  }
  function apikey() {
    const use = [["Today", 412, 0], ["Yesterday", 388, 2], ["Nov 9", 301, 0], ["Nov 8", 94, 0]];
    return '<div class="a-page">' + back("apikeys", "API keys") + '<div class="cd" style="margin-bottom:14px"><div class="hdr-card"><span class="avatar xl sq n">' + I("link", 18) + '</span><div class="nm"><h2>Website lead form <span class="badge green">Active</span></h2><div class="muted"><span class="key">lq_live_c21d…</span> · owner Lead intake (service account) · created Nov 3 · rotated from <span class="key">lq_live_77b0…</span></div></div>' + btn("Edit scopes", "edit") + btn("Rotate", "zap") + btn("Revoke", "x") + "</div></div>" +
      '<div class="g-main"><div class="stack">' +
      cd("<b>Permissions</b><span class='r muted'>ApiKey.scopes ∩ owner permissions</span>", '<div class="pr"><span class="nm key">crm.leads</span><div class="acts">' + chip("create", 1, 0) + chip("read", 0, 0) + "</div></div>" + kv("Scope", E("ORGANIZATION")) + kv("IP allow-list", muted("not set") + " <span class='badge yellow'>gap</span>")) +
      cd("<b>Requests · last 4 days</b><span class='r muted'>ApiKey.last_used_at only · usage log is a gap</span>", tb(["Day", ">Requests", ">Rejected (403/429)"], use.map((u) => [u[0], '<span class="num">' + u[1] + "</span>", '<span class="num">' + u[2] + "</span>"]), 1), 1) +
      cd("<b>Rotation history</b><span class='r muted'>rotated_from_id</span>", '<div class="tl"><div class="ev"><b class="key">api_key.rotated</b><small>lq_live_77b0… → lq_live_c21d… · Petros R. · Nov 3 · old key valid for 24h grace</small></div><div class="ev"><b class="key">api_key.created</b><small>lq_live_77b0… · Anna M. · Mar 2026</small></div></div>') + "</div>" +
      '<div class="stack">' + cd("<b>Lifetime</b>", kv("Expires", "Mar 1, 2027") + kv("Rotate by", "Feb 1") + kv("Last used", "1h ago") + kv("Status", "Derived: Active")) + cd("<b>Owner</b>", '<div class="rowx"><div class="grow"><b>Lead intake</b><small>ServiceAccount · Sales Manager (ORGANIZATION)</small></div>' + S("ACTIVE") + "</div>", 1) + "</div></div>" +
      dm(["ApiKey · all columns except key_hash", "ServiceAccount · RoleAssignment", "AuditEvent · api_key.*"], ["Per-key request log (gaps-01b.md #3)"]) + "</div>";
  }
  function serviceNew() {
    return '<div class="a-page">' + back("apikeys", "API keys & service accounts") + head("Create service account", "A non-human identity for integrations and automation. Not an employee and not a seat (§76).", btn("Cancel", "") + btn("Create service account", "check", "primary")) +
      '<div class="g-main"><div class="stack">' +
      cd("<b>Identity</b>", fl("Name", inp("Invoice reminder bot"), "unique per organization", 1) + fl("Purpose", ta("Runs the overdue-invoice automation (module 20)."), "Shown to auditors; keep it factual", 1) + fl("Owner (accountable human)", sel("Elena Papadaki", "users"), "ServiceAccount.owner_membership_id · notified before expiry and on suspension", 1) + fl("Expires", sel("Dec 31, 2026", "calendar"), "empty = never; a review reminder is sent 14 days before")) +
      cd("<b>Role assignments</b><span class='r'>" + btn("Add role", "plus", "sm") + "</span>", tb(["Role", "Scope", "Target", ""], [["<b class='ink'>Finance Manager</b>", E("BRANCH"), "Athens", more]], 1) + '<div style="padding:12px 16px">' + callout("shield", "A service account gets permissions only from these assignments (RoleAssignment.service_account_id). You can only assign roles you hold. Prefer a narrow custom role over Admin.", "warn") + "</div>", 1) +
      cd("<b>First credential</b>", sw2("Create an API key now", "opens the one-time secret dialog after saving", 1) + fl("Key name", inp("Invoice reminder bot · key 1")) + fl("Permission scopes", '<div style="display:flex;gap:6px;flex-wrap:wrap">' + keyList(["finance.invoices.read"]) + "</div>", "narrow further than the role, optional")) +
      foot("Audited as service_account.created, actor type SERVICE_ACCOUNT afterwards.", btn("Cancel", "") + btn("Create service account", "check", "primary")) + "</div>" +
      '<div class="stack">' + cd("<b>How it behaves</b>", kv("Audit actor_type", E("SERVICE_ACCOUNT")) + kv("Counts as seat", "No") + kv("MFA / sessions", "None (keys only)") + kv("Statuses", E("ACTIVE") + " " + E("SUSPENDED") + " " + E("REVOKED"))) + "</div></div>" +
      dm(["ServiceAccount · name, purpose, owner_membership_id, status, expires_at", "RoleAssignment · service_account_id, role_id, scope_type, scope_id", "ApiKey (optional first key)"], []) + "</div>";
  }

  /* =====================================================================================================================
     WEBHOOKS: list · create · detail with delivery log (OutboundWebhook + WebhookDelivery, owned by module 20, administered here)
     @screen Webhooks · Create webhook · Webhook detail
     @route  /admin/webhooks · /admin/webhooks/new · /admin/webhooks/:id?tab=overview|deliveries|settings
     @perm   automation.webhooks.manage* (the only webhook key in the catalog; there is no read-only key, see gap) · secrets shown once
     @api    GET/POST /webhooks · GET/PATCH/DELETE /webhooks/:id · POST /webhooks/:id/test · POST /webhooks/:id/rotate-secret · GET /webhooks/:id/deliveries?status= · POST /webhook-deliveries/:id/retry
     @mcp    automation_webhooks_manage*
     @data   OutboundWebhook (name, description, url, secret, signing_algorithm, subscribed_events[], headers, content_type, api_version, status ACTIVE|PAUSED|DISABLED, max_attempts, retry_backoff_seconds, timeout_seconds, disable_after_failures, consecutive_failures, last_*_at, disabled_reason) ·
             WebhookDelivery (event_key, status PENDING|RETRY_SCHEDULED|SUCCEEDED|FAILED|DEAD_LETTERED, payload, request_headers, attempt, max_attempts, next_retry_at, response_status_code, response_body, error_message, duration_ms, delivery_key)
     @ui     Table, Form, Command multi-select (events), Dialog (secret once), Tabs, Sheet (delivery payload), Badge, AlertDialog
     @states loading · empty · error · auto-disabled banner (consecutive_failures >= disable_after_failures) · no-access
     @audit  webhook.created | webhook.updated | webhook.secret_rotated | webhook.paused | webhook.deleted
     @note   Signature: HMAC (signing_algorithm) over the body with `secret`, header carries delivery_key as idempotency id. URL must be https and not resolve to a private network (SSRF guard). Headers may hold a bearer token: write-only like secrets.
     @gap    No "read webhooks" key and no secret rotation grace (only one `secret` column): see gaps-01b.md #8.
     ===================================================================================================================== */
  function webhooks() {
    const W = [["CRM to Slack bridge", "https://hooks.partner.example/lq/crm", ["crm.deal.won", "crm.lead.created"], "ACTIVE", 0, "12m ago", "99.8%"], ["Billing sync", "https://erp.acme.example/api/lq", ["finance.invoice.paid", "finance.invoice.overdue"], "ACTIVE", 2, "1h ago", "97.1%"], ["Zapier catch hook", "https://hooks.zapier.example/abc", ["tasks.task.created"], "PAUSED", 0, "Nov 2", "—"], ["Old staging", "https://staging.old.example/hook", ["*"], "DISABLED", 50, "Oct 14", "0%"]];
    return '<div class="a-page">' + head("Webhooks", "Signed outbound HTTP calls for platform events. Managed in Automation (20) and administered here with the same authorization (§75).", btn("Delivery log", "list") + '<a href="#admin/webhooknew" class="btn primary">' + I("plus", 14) + "Create webhook</a>") +
      FB([["Status", "is any of", "Active, Paused"], ["Event", "contains", "crm."]], sel("Sort: Last delivery")) +
      tb(["Webhook", "URL", "Events", "Status", ">Failures in a row", "Last delivery", "Success (7d)", ""], W.map((w) => clk("webhook", ["<b class='ink'>" + w[0] + "</b>", '<span class="key">' + w[1] + "</span>", keyList(w[2]), S(w[3]), '<span class="num">' + w[4] + "</span>", muted(w[5]), w[6], more]))) +
      dm(["OutboundWebhook · name, url, subscribed_events, status, consecutive_failures, last_delivery_at, disabled_reason", "WebhookDelivery · status (7-day success rate)"], ["No read-only permission key; secret rotation grace (gaps-01b.md #8)"]) + "</div>";
  }
  function webhookNew() {
    const evs = [["crm.deal.won", 1], ["crm.lead.created", 1], ["finance.invoice.paid", 0], ["projects.project.completed", 0], ["tasks.task.created", 0], ["support.ticket.created", 0]];
    return '<div class="a-page">' + back("webhooks", "Webhooks") + head("Create webhook", "Receive events as signed JSON. Each delivery is retried with backoff and logged.", btn("Cancel", "") + btn("Send test event", "zap") + btn("Create webhook", "check", "primary")) +
      '<div class="g-main"><div class="stack">' +
      cd("<b>Endpoint</b>", fl("Name", inp("CRM to Slack bridge"), "", 1) + fl("Description", ph("What receives this and why")) + fl("URL", inp("https://hooks.partner.example/lq/crm"), "https only. Private and internal addresses are rejected (SSRF guard).", 1) + '<div class="g2">' + fl("Content type", sel("application/json", "file")) + fl("API version", sel("2026-10 (latest)", "layers"), "payload shape is pinned to a version") + "</div>") +
      cd("<b>Events</b><span class='r'>" + search("Search events…") + "</span>", '<div class="evgrid">' + evs.map((e) => '<label class="mg">' + cb(e[1]) + '<span class="key">' + e[0] + "</span></label>").join("") + "</div>" + '<div class="sub-note" style="padding:0 16px 12px">subscribed_events[] · events are PlatformEvent keys; the receiver only gets what the key’s owner may see.</div>', 1) +
      cd("<b>Delivery policy</b>", '<div class="g3">' + fl("Max attempts", sel("5", "zap"), "max_attempts") + fl("Backoff", sel("60 s, exponential", "clock"), "retry_backoff_seconds") + fl("Timeout", sel("10 s", "clock"), "timeout_seconds") + "</div>" + fl("Auto-disable after", sel("50 consecutive failures", "x"), "disable_after_failures · status becomes DISABLED and admins are notified") + sw2("Include direct messages", "include_direct_messages · off by default for privacy", 0)) +
      cd("<b>Custom headers</b><span class='r muted'>write-only</span>", '<div class="rowx"><div class="grow"><b>Authorization</b><small>value hidden after save</small></div><div class="pwd" style="width:200px">••••••••</div></div><div class="rowx"><div class="grow"><b>X-Source</b></div><div class="inp ink" style="width:200px">logiqdev</div></div>', 1) +
      foot("The signing secret is shown once after creation.", btn("Cancel", "") + btn("Create webhook", "check", "primary")) + "</div>" +
      '<div class="stack">' + cd("<b>Signing</b>", kv("Algorithm", "hmac-sha256") + kv("Header", keyc("X-Logiq-Signature")) + kv("Idempotency", keyc("delivery_key")) + callout("lock", "A secret like <span class='key'>whsec_…</span> is generated and shown <b>once</b>. Rotate it any time from the detail page.")) + "</div></div>" +
      dm(["OutboundWebhook · name, description, url, secret, signing_algorithm, subscribed_events, headers, content_type, api_version, max_attempts, retry_backoff_seconds, timeout_seconds, disable_after_failures, include_direct_messages"], []) + "</div>";
  }
  function webhook() {
    const D = [["finance.invoice.paid", "SUCCEEDED", "200", "184 ms", 1, "12m ago", ""], ["finance.invoice.overdue", "RETRY_SCHEDULED", "503", "10,000 ms", 2, "1h ago", "next retry in 4 min"], ["finance.invoice.paid", "SUCCEEDED", "200", "201 ms", 1, "3h ago", ""], ["finance.invoice.overdue", "FAILED", "—", "—", 5, "Nov 9", "timeout"], ["crm.deal.won", "DEAD_LETTERED", "410", "88 ms", 5, "Nov 8", "endpoint gone"]];
    return '<div class="a-page">' + back("webhooks", "Webhooks") + '<div class="cd" style="margin-bottom:14px"><div class="hdr-card"><span class="avatar xl sq n">' + I("plug", 18) + '</span><div class="nm"><h2>Billing sync ' + S("ACTIVE") + '</h2><div class="muted"><span class="key">https://erp.acme.example/api/lq</span> · hmac-sha256 · 2 events · created by Elena P.</div></div>' + btn("Send test", "zap") + btn("Pause", "") + btn("Rotate secret", "key") + btn("Delete", "x") + "</div></div>" +
      '<div class="mini-stats">' + stat("Deliveries (7d)", 214, "all attempts") + stat("Success rate", "97.1%", "6 failed", 1) + stat("Consecutive failures", 2, "disables at 50", 1) + stat("Avg duration", "212 ms", "p95 1.1 s") + "</div>" +
      '<div class="tabset">' + tabs([["d", "Deliveries", 214], ["o", "Overview"], ["s", "Settings"]], "d") +
      pane("d", 1, FB([["Status", "is any of", "Failed, Retry scheduled"], ["Event", "is", "finance.invoice.overdue"], ["Date", "in", "Last 7 days"]], sel("HTTP status") + btn("Retry selected", "zap", "sm")) +
        '<div class="g-main" style="grid-template-columns:minmax(0,1fr) 360px"><div>' + tb(["", "Event", "Status", "HTTP", "Duration", ">Attempt", "When", "Note"], D.map((d, i) => ({ cls: "clk", cells: [cb(0), '<span class="key">' + d[0] + "</span>", S(d[1]), d[2], d[3], '<span class="num">' + d[4] + "/5</span>", muted(d[5]), muted(d[6])] }))) + "</div>" +
        /* @impl Delivery detail (Sheet): everything WebhookDelivery stores. `response_body` is truncated by the API; request headers have the signature but never the secret. "Retry" only for FAILED/DEAD_LETTERED. */
        cd("<b class='key'>finance.invoice.overdue</b><span class='r'>" + S("RETRY_SCHEDULED") + "</span>", kv("delivery_key", '<span class="key">9c1e…b72</span>') + kv("Attempt", "2 of 5") + kv("Next retry", "in 4 min") + kv("Response", "503 Service Unavailable") + kv("Duration", "10,000 ms (timeout 10 s)") + '<div class="muted" style="margin:10px 0 6px">payload</div><div class="diff"><div class="ctxl">{ "event": "finance.invoice.overdue",</div><div class="ctxl">  "invoice": "INV-2058", "days_overdue": 7,</div><div class="ctxl">  "amount_minor": 480000, "currency": "EUR" }</div></div><div class="muted" style="margin:10px 0 6px">response_body</div><div class="diff"><div class="del">Service temporarily unavailable</div></div>' + btn("Retry now", "zap", "sm")) + "</div>") +
      pane("o", 0, '<div class="g2">' + cd("<b>Subscribed events</b>", keyList(["finance.invoice.paid", "finance.invoice.overdue"]) + '<div style="height:8px"></div>' + kv("Last success", "12m ago") + kv("Last failure", "1h ago") + kv("Disabled", muted("no"))) + cd("<b>Policy</b>", kv("Attempts", 5) + kv("Backoff", "60 s") + kv("Timeout", "10 s") + kv("Auto-disable", "50 failures")) + "</div>") +
      pane("s", 0, callout("edit", "Same fields as the create page. The secret is never displayed: use <b>Rotate secret</b> (the old one stops working immediately, see gap #8).")) + "</div>" +
      dm(["OutboundWebhook · all columns except secret", "WebhookDelivery · event_key, status, payload, request_headers, attempt, response_status_code, response_body, error_message, duration_ms, next_retry_at, delivery_key"], ["Secret rotation grace period (gaps-01b.md #8)"]) + "</div>";
  }

  /* =====================================================================================================================
     AUDIT LOG with full filters + event detail + event type catalog
     @screen Audit log (filters) · Audit event detail · Event types
     @route  /admin/audit?actor=&actor_type=&event_type=&resource_type=&resource_id=&branch=&ip=&from=&to=&q= · /admin/audit/:eventId · tab ?tab=events|types
     @perm   organizations.audit.read* (sensitive event types are hidden without it) · export writes data.exported · scope: branch callers see only events whose branch_id is in their scope
     @api    GET /audit-events (cursor) · GET /audit-events/:id · GET /audit-events/:id/related · POST /audit-events/export {filters, format} · GET /audit-event-types
     @mcp    organizations_audit_read*
     @data   AuditEvent (actor_type, actor_user_id, actor_service_account_id, event_type, resource_type, resource_id, branch_id, metadata, ip_address, user_agent, created_at) · audit-event-types.ts (80 types: resource, description, sensitive, notifyAdmins)
     @ui     Filter bar (UI.filters), Popover+Command (event type grouped by resource), DateRangePicker, Table (cursor), Sheet/aside, Tabs, JSON diff viewer
     @states loading · empty result · error · no-access · export queued
     @note   IMMUTABLE. Filters persist to the URL; saved views use SavedView. The "outcome" filter is DERIVED from the event type (…_failed, login_failed, denied) because AuditEvent has no outcome column.
             Metadata never contains secrets (stripped on write). IP and user agent are personal data: shown only with the audit permission, retention applies.
     @gap    AuditEvent.outcome (SUCCESS|FAILURE|DENIED) missing; SavedView.entity_type has no AUDIT_EVENT value (gaps-01b.md #4).
     ===================================================================================================================== */
  function audit2() {
    const Ev = [
      ["2h ago", "PR", "", "Petros R.", "USER", "membership.admin_promoted", "membership · Elena Papadaki", "—", "85.74.x.x", "yellow", "OK"],
      ["Yesterday", "AM", "", "Anna Meyer", "USER", "membership.role_assigned", "membership · Marco Silva", "Athens", "85.74.x.x", "", "OK"],
      ["Yesterday", "SJ", "y", "Sofia Jensen", "USER", "user.mfa_disabled", "user_auth_method · TOTP", "—", "79.131.x.x", "red", "OK"],
      ["Yesterday", "NG", "g", "Nikos Georgiou", "USER", "user.login_failed", "user · nikos@…", "Limassol", "212.x.x.x", "red", "Failed"],
      ["Yesterday", "⚡", "n", "Lead intake", "SERVICE_ACCOUNT", "api_key.created", "api_key · lq_live_c21d…", "—", "—", "", "OK"],
      ["3d ago", "PR", "", "Petros R.", "USER", "organization.module_enabled", "organization_module · COMMUNICATION", "—", "85.74.x.x", "", "OK"],
      ["4d ago", "⚙", "n", "System", "SYSTEM", "invitation.expired", "invitation · peter@mail.example", "Thessaloniki", "—", "", "OK"],
      ["5d ago", "PA", "n", "Platform admin", "PLATFORM_ADMIN", "organization.status_changed", "organization · SETUP → ACTIVE", "—", "—", "blue", "OK"],
    ];
    const grouped = {}; AUDIT_TYPES.forEach((t) => { (grouped[t[1]] = grouped[t[1]] || []).push(t); });
    return '<div class="a-page">' + head("Audit log", "Immutable AuditEvents from every module (§99–100, §139). Filter, inspect, export.", btn("Export", "file") + btn("Retention policy", "settings")) +
      '<div class="tabset">' + tabs([["e", "Events"], ["t", "Event types", AUDIT_TYPES.length]], "e") +
      pane("e", 1,
        /* @impl Filter fields: Actor (member / service account Combobox) · Actor type (AuditActorType) · Event type (multi, grouped by resource) · Resource type + id · Branch · IP · Date range · Outcome (derived). Saved views = SavedView (gap #4). */
        FB([["Actor type", "is any of", "User, Service account"], ["Event type", "is any of", "membership.*, user.mfa_disabled"], ["Date", "between", "Nov 1 – Nov 11"], ["Outcome", "is", "Failure"]], sel("Branch: Any", "building") + btn("Save view", "plus", "sm")) +
        '<div class="g-main" style="grid-template-columns:minmax(0,1fr) 380px"><div class="panel" style="margin-top:0"><div class="tbl-scroll"><table><thead><tr><th>When</th><th>Actor</th><th>Event type</th><th>Resource</th><th>Scope</th><th>Outcome</th><th>IP</th></tr></thead><tbody>' +
        Ev.map((e, i) => '<tr class="clk" onclick="location.hash=\'#admin/auditevent\'" ' + (i === 0 ? 'style="background:var(--elevated)"' : "") + '><td class="muted">' + e[0] + "</td><td>" + who(e[1], e[2], e[3], en(e[4])) + '</td><td><span class="badge key ' + e[9] + '">' + e[5] + "</span></td><td>" + e[6] + '</td><td class="muted">' + e[7] + "</td><td>" + (e[10] === "OK" ? '<span class="badge green">Success</span>' : '<span class="badge red">Failure</span>') + '</td><td class="mono muted">' + e[8] + "</td></tr>").join("") + "</tbody></table></div></div>" +
        cd("<b class='key'>membership.admin_promoted</b><span class='r'><a href='#admin/auditevent' style='text-decoration:underline'>Open</a></span>", kv("actor_type", E("USER")) + kv("actor_user_id", "Petros R.") + kv("resource", "membership · mem_7c1…") + kv("branch_id", muted("— organization-wide")) + kv("ip_address", '<span class="mono">85.74.x.x</span>') + '<div class="muted" style="margin:10px 0 6px">metadata</div><div class="diff"><div class="del">-  "role": "Finance Manager"</div><div class="add">+  "role": "Admin"</div></div>') + "</div>") +
      pane("t", 0, callout("lock", "These are the canonical <span class='key'>event_type</span> values (audit-event-types.ts). <span class='badge yellow'>Sensitive</span> types are hidden without " + keyc("organizations.audit.read") + "; <span class='badge purple'>Notifies admins</span> raise a security notification (§146).") + '<div style="height:12px"></div>' +
        Object.keys(grouped).map((r) => '<div class="cd" style="margin-bottom:12px"><div class="cd-h"><b class="mono">' + r + '</b><span class="r muted">' + grouped[r].length + ' types</span></div><div class="cd-b flush">' + tb(["event_type", "Description", "Flags"], grouped[r].map((t) => ['<span class="key">' + t[0] + "</span>", t[2], (t[3] & 1 ? '<span class="badge yellow">Sensitive</span> ' : "") + (t[3] & 2 ? '<span class="badge purple">Notifies admins</span>' : "") || muted("—")]), 1) + "</div></div>").join("")) + "</div>" +
      dm(["AuditEvent · all columns", "api/src/shared/constants/audit-event-types.ts · " + AUDIT_TYPES.length + " event types"], ["AuditEvent.outcome (success / failure / denied) is derived from the type name (gaps-01b.md #4)", "Saved audit views: SavedView.entity_type has no audit value"]) + "</div>";
  }
  function auditEvent() {
    return '<div class="a-page">' + back("audit", "Audit log") + '<div class="cd" style="margin-bottom:14px"><div class="hdr-card"><span class="avatar xl sq n">' + I("file", 18) + '</span><div class="nm"><h2><span class="key">membership.admin_promoted</span> <span class="badge yellow">Sensitive</span> <span class="badge purple">Notifies admins</span></h2><div class="muted">Nov 11, 2026 09:41:07 UTC · evt_3b9f2c… · membership resource</div></div>' + btn("Copy event id", "") + btn("Open member", "users") + "</div></div>" +
      '<div class="g-main"><div class="stack">' +
      cd("<b>Event</b>", kv("event_type", '<span class="key">membership.admin_promoted</span>') + kv("Description", "Member promoted to an administrator role") + kv("created_at", "2026-11-11T09:41:07Z") + kv("resource_type · resource_id", "membership · " + keyc("mem_7c1a…")) + kv("branch_id", muted("null · organization-wide")) + kv("organization_id", muted("from the session, same tenant"))) +
      cd("<b>Actor</b>", kv("actor_type", E("USER")) + kv("actor_user_id", "Petros Rodinos · petros@logiqdev.example") + kv("ip_address", '<span class="mono">85.74.x.x</span> ' + muted("personal data")) + kv("user_agent", "Chrome 131 · macOS") + kv("Session", "MacBook · Chrome 131 " + muted("(active)"))) +
      cd("<b>metadata (JSON)</b><span class='r muted'>before / after, secrets stripped</span>", '<div class="diff"><div class="ctxl">{</div><div class="ctxl">  "scope_type": "ORGANIZATION",</div><div class="del">-  "role": "Finance Manager",</div><div class="add">+  "role": "Admin",</div><div class="add">+  "reason": "Takes over billing admin"</div><div class="ctxl">}</div></div>') + "</div>" +
      '<div class="stack">' + cd("<b>Related events</b><span class='r muted'>same resource</span>", '<div class="tl"><div class="ev"><b class="key">membership.role_assigned</b><small>Finance Manager · Mar 2026</small></div><div class="ev"><b class="key">membership.created</b><small>Elena Papadaki · Mar 2025</small></div></div>') +
      cd("<b>Notifications sent</b>", kv("Security notification", "To 3 admins · in-app + email") + kv("Module", "Notifications (14)")) + callout("lock", "Audit events cannot be edited or deleted by anyone, including admins.") + "</div></div>" +
      dm(["AuditEvent · every column", "audit-event-types.ts · membership.admin_promoted (sensitive, notifyAdmins)"], []) + "</div>";
  }

  /* =====================================================================================================================
     ORGANIZATION SETTINGS: Branding · Domains (+ add domain) · Data retention · Billing & plan · Organization lifecycle
     @screen Branding · Domains · Add domain · Data retention · Billing & plan · Danger zone
     @route  /admin/branding · /admin/domains · /admin/domains/new · /admin/retention · /admin/billing · /admin/lifecycle
     @perm   branding organizations.branding.manage · domains organizations.domains.manage* · retention organizations.settings.manage* (+ documents.retention.manage* / messaging.retention.manage* for those modules) ·
             billing organizations.billing.manage* · lifecycle: transfer users.members.transfer_ownership*, delete organizations.organization.delete* (Owner only)
     @api    PATCH /organization {branding} · POST /organization/logo · GET/POST /domains · POST /domains/:id/verify · PATCH /domains/:id · POST /organization/delete-request · POST /organization/cancel-deletion
     @mcp    organizations_settings_manage* · organizations_domains_manage* · organizations_organization_delete* (never by an AI alone)
     @data   Organization (branding, logo_url, status, deletion_requested_at, deletion_scheduled_at, deleted_at, settings) · OrganizationDomain (domain, status, verification_token, verified_at, allow_discovery, auto_provision) · DocumentRetentionPolicy (17) · MessagingRetentionPolicy (12)
     @ui     Form, color picker, file upload, Switch, Table, CopyButton, Stepper (domain verify), AlertDialog with typed confirmation ("delete logiqdev"), Progress
     @states loading · saving · error · verification pending / failed · deletion pending (banner everywhere) · no-access
     @audit  organization.updated · domain.verified | domain.revoked · organization.status_changed · organization.deletion_requested
     @note   Branding is the FALLBACK of proposals, invoices, portal and emails (modules may override). Deleting needs the Owner, a typed name, recent MFA and a 30-day grace: status PENDING_DELETION (OrganizationStatus).
     @gap    Data retention for audit events, sessions and invitations has no table/columns (only documents and messaging have retention policies); a plan/subscription of the ORGANIZATION itself (seats, limits, invoices from Logiqdev) has no model (gaps-01b.md #5 and #9).
     ===================================================================================================================== */
  function branding() {
    return '<div class="a-page">' + head("Branding", "Organization.branding (JSON). Used by proposals, invoices, the customer portal and emails unless a module overrides it.", btn("Discard", "") + btn("Save branding", "check", "primary")) +
      '<div class="g-main"><div class="stack">' +
      cd("<b>Logo & marks</b>", '<div class="g2"><div>' + fl("Logo (light backgrounds)", '<div class="drop">' + I("file", 18) + "<b>logiqdev-logo.svg</b><small>SVG/PNG · max 2 MB · Organization.logo_url</small></div>") + "</div><div>" + fl("Logo (dark backgrounds)", '<div class="drop">' + I("plus", 18) + "<b>Upload</b><small>optional · branding.logo_dark_url</small></div>") + "</div></div>" + fl("Favicon", '<div class="drop">' + I("plus", 18) + "<b>Upload 512×512 PNG</b></div>")) +
      cd("<b>Colors & typography</b>", '<div class="g2">' + fl("Primary color", '<div class="inp ink"><span class="swatch"></span>#E0343A</div>', "must keep 4.5:1 contrast with text on buttons") + fl("Accent color", '<div class="inp ink"><span class="swatch b"></span>#2563EB</div>') + "</div>" + fl("Heading font", sel("Inter", "pen")) + fl("Dark mode", sw2("Use a separate dark palette", "branding.dark.*; otherwise colors are adapted automatically", 0))) +
      cd("<b>Documents & emails</b>", fl("Email footer", ta("Logiqdev Ltd · 12 Ermou St, Athens · VAT EL123456789"), "") + fl("Invoice / proposal footer", ta("Payment terms: 14 days. Thank you for your business."), "") + sw2("Show “Powered by Logiqdev”", "branding.show_powered_by", 1)) + "</div>" +
      '<div class="stack">' + cd("<b>Live preview</b>", '<div class="mailprev"><b style="color:var(--primary)">Logiqdev</b><p>Invoice INV-2058 is ready.</p><span class="btn primary sm">View invoice</span><small class="muted">Logiqdev Ltd · 12 Ermou St, Athens</small></div>') + callout("globe", "Modules may override: ProposalTemplate.branding, CustomerPortalSettings.branding.") + "</div></div>" +
      dm(["Organization · logo_url, branding (JSON), legal_name, display_name", "CustomerPortalSettings.branding (override, module 07)"], []) + "</div>";
  }
  function domains() {
    return '<div class="a-page">' + head("Domains", "Email domains the organization owns. Verified domains enable SSO discovery and domain restrictions (§68–71).", '<a href="#admin/domainnew" class="btn primary">' + I("plus", 14) + "Add domain</a>") +
      FB([["Status", "is any of", "Verified, Pending"]], sel("Sort: Added")) +
      tb(["Domain", "Status", "Verified", "Discovery", "Auto-provision", "Members using it", ""], [[ "<b class='ink'>logiqdev.example</b>", S("VERIFIED"), "Mar 2025", sw(1), sw(0), "22", more], ["<b class='ink'>logiqdev.cy</b>", S("PENDING"), muted("—"), sw(0), sw(0), "0", btn("Verify now", "", "sm")], ["<b class='ink'>old-agency.example</b>", S("FAILED"), muted("—"), sw(0), sw(0), "0", btn("Retry", "", "sm")]]) +
      dm(["OrganizationDomain · domain, status, verification_token, verified_at, allow_discovery, auto_provision"], []) + "</div>";
  }
  function domainNew() {
    return '<div class="a-page">' + back("domains", "Domains") + head("Add domain", "Prove you own it with a DNS TXT record. Nothing changes for members until it is verified.", btn("Cancel", "") + btn("Check DNS", "zap", "primary")) + stepper(["Enter domain", "Add DNS record", "Verified"], 1) +
      '<div class="g-main"><div class="stack">' + cd("<b>1 · Domain</b>", fl("Domain", inp("logiqdev.cy"), "No protocol, no path. Unique across the platform (OrganizationDomain.domain).", 1)) +
      cd("<b>2 · Add this DNS record</b>", tb(["Type", "Name", "Value", ""], [["TXT", '<span class="key">_logiq-verify.logiqdev.cy</span>', '<span class="key">lq-verify=8f3a1c9e7b</span>', btn("Copy", "", "sm")]], 1) + '<div class="sub-note" style="padding:10px 16px">verification_token is generated once per domain. DNS changes can take up to 24 h. The check is repeated automatically every 15 minutes for 3 days, then the status becomes FAILED.</div>', 1) +
      cd("<b>3 · Options</b>", sw2("Allow discovery", "people with this email domain can find the organization when signing in", 1) + sw2("Auto-provision members", "create a membership on first SSO sign-in (needs SSO enabled)", 0) + sw2("Restrict invitations to verified domains", "OrganizationSecurityPolicy.restrict_invitations_to_domains", 1)) +
      foot("Audited as domain.verified on success.", btn("Cancel", "") + btn("Check DNS", "zap", "primary")) + "</div><div class='stack'>" + cd("<b>Status</b>", kv("Current", S("PENDING")) + kv("Last check", "2 min ago: record not found") + kv("Next check", "in 13 min")) + "</div></div>" +
      dm(["OrganizationDomain · domain, status, verification_token, allow_discovery, auto_provision", "OrganizationSecurityPolicy · restrict_invitations_to_domains"], []) + "</div>";
  }
  function retention() {
    const row = (t, s, v, g) => '<div class="setting"><div class="grow"><b>' + t + "</b><small>" + s + (g ? " <span class='badge yellow'>gap</span>" : "") + "</small></div>" + sel(v).replace('class="sel"', 'class="sel" style="width:190px"') + "</div>";
    return '<div class="a-page">' + head("Data retention", "How long data is kept before it is removed or anonymized (§100, §103). Some modules own their policy.", btn("Save", "check", "primary")) +
      callout("lock", "Audit events are immutable: retention only <b>archives</b> them after the period; legal holds suspend deletion.", "warn") + '<div style="height:12px"></div>' +
      '<div class="g-main"><div class="stack">' +
      cd("<b>Platform data (this module)</b><span class='r'><span class='badge yellow'>not in schema</span></span>", row("Audit events", "AuditEvent · IP address and user agent are scrubbed after the period", "2 years", 1) + row("Sessions", "UserSession · revoked and expired rows", "90 days", 1) + row("Invitations", "Invitation · non-pending rows", "1 year", 1) + row("Webhook deliveries", "WebhookDelivery · payloads and responses", "30 days", 1), 1) +
      cd("<b>Owned by other modules</b>", '<div class="rowx"><div class="grow"><b>Documents</b><small>DocumentRetentionPolicy · documents.retention.manage*</small></div><a style="text-decoration:underline">Open in Documents</a></div><div class="rowx"><div class="grow"><b>Messaging</b><small>MessagingRetentionPolicy · messaging.retention.manage*</small></div><a style="text-decoration:underline">Open in Messaging</a></div>', 1) + "</div>" +
      '<div class="stack">' + cd("<b>Legal hold</b>", sw2("Suspend all deletion", "e.g. during a dispute", 0) + callout("shield", "Turning this on is audited and notifies admins.")) + "</div></div>" +
      dm(["DocumentRetentionPolicy (17) · MessagingRetentionPolicy (12)"], ["Retention for AuditEvent, UserSession, Invitation, WebhookDelivery: no table (gaps-01b.md #5)"]) + "</div>";
  }
  function billing() {
    return '<div class="a-page">' + head("Billing & plan", "Your Logiqdev OS subscription: plan, seats and invoices from the platform (not your customers’ billing).", btn("Change plan", "layers") + btn("Update payment method", "dollar")) +
      callout("dollar", "<b>No schema yet.</b> Billing here means the organization’s own plan. The Billing module (08) is about invoicing YOUR customers; its Subscription table is customer-facing. See gaps-01b.md #9.", "warn") + '<div style="height:12px"></div>' +
      '<div class="mini-stats">' + stat("Plan", "Business", "€15 / seat / month") + stat("Seats used", "24 / 30", "service accounts are free") + stat("Next invoice", "€360", "Dec 1") + stat("Included integrations", "Twilio SMS trial", "IntegrationConnection PLATFORM") + "</div>" +
      '<div class="g2">' + cd("<b>Usage vs. limits</b>", '<div class="kvr"><span>Seats</span><b>24 of 30</b></div><div class="meter"><i style="width:80%"></i></div><div class="kvr" style="margin-top:8px"><span>Storage</span><b>212 GB of 500 GB</b></div><div class="meter g"><i style="width:42%"></i></div><div class="kvr" style="margin-top:8px"><span>Automation runs</span><b>8.4k of 10k</b></div><div class="meter y"><i style="width:84%"></i></div>') +
      cd("<b>Invoices from Logiqdev</b>", tb(["Invoice", "Period", ">Amount", "Status", ""], [["LQ-2026-11", "Nov 2026", '<span class="num">€360.00</span>', S("COMPLETED"), btn("PDF", "", "sm")], ["LQ-2026-10", "Oct 2026", '<span class="num">€345.00</span>', S("COMPLETED"), btn("PDF", "", "sm")]], 1), 1) + "</div>" +
      dm(["Organization.settings (JSON, unspecified)"], ["Organization plan / subscription / seats / limits / platform invoices: no model", "Permission organizations.billing.manage exists but nothing implements it"]) + "</div>";
  }
  function lifecycle() {
    return '<div class="a-page">' + head("Organization lifecycle", "Status, ownership transfer, export and deletion. Owner only (§103).") +
      '<div class="g-main"><div class="stack">' +
      cd("<b>Status</b><span class='r'>" + S("ACTIVE") + "</span>", kv("Status", "ACTIVE · OrganizationStatus: SETUP, ACTIVE, SUSPENDED, READ_ONLY, ARCHIVED, PENDING_DELETION, DELETED") + kv("Created", "Mar 12, 2025") + kv("Owner", "Petros Rodinos")) +
      cd("<b>Transfer ownership</b>", fl("New owner", sel("Select an admin member…", "users"), "must be an ACTIVE Admin with MFA · users.members.transfer_ownership*") + '<button class="btn">' + I("send", 14) + " Start transfer (needs recipient to accept)</button>") +
      cd("<b>Export all data</b>", '<div class="rowx"><div class="grow"><b>Full export (JSON + files)</b><small>Prepared in the background, link expires in 7 days · writes data.exported</small></div>' + btn("Request export", "file") + "</div>", 1) +
      '<div class="cd danger"><div class="cd-h"><b>Delete organization</b></div><div class="cd-b">' + callout("lock", "Schedules deletion in <b>30 days</b>. All members are signed out and the organization becomes read-only. You can cancel any time before then.", "warn") + fl("Type the organization slug to confirm", ph("logiqdev")) + sw2("I exported the data I need", "", 0) + '<button class="btn danger">' + I("x", 14) + " Request deletion</button></div></div>" + "</div>" +
      '<div class="stack">' + cd("<b>If deletion is pending</b>", kv("Status", S("PENDING_DELETION")) + kv("deletion_requested_at", "Nov 11") + kv("deletion_scheduled_at", "Dec 11") + '<button class="btn" style="width:100%">Cancel deletion</button>') + "</div></div>" +
      dm(["Organization · status, deletion_requested_at, deletion_scheduled_at, deleted_at"], []) + "</div>";
  }

  /* =====================================================================================================================
     ACCESS REVIEW: create + detail
     @screen New access review · Access review detail
     @route  /admin/access-reviews/new · /admin/access-reviews/:id
     @perm   organizations.access_reviews.manage* (create/start/apply/complete/cancel) · .read* · .decide* (only items assigned to the reviewer)
     @api    POST /access-reviews {name, description, scope_type, scope_id, modules[], starts_at, due_at} · POST /access-reviews/:id/start · GET /access-reviews/:id/items?decision=&reviewer= · PATCH /access-review-items/:id {decision, comment} · POST /access-reviews/:id/apply
     @mcp    organizations_access_reviews_manage* · _decide*
     @data   AccessReview · AccessReviewItem (access_snapshot JSON: roles, grants, module access, branch scopes) · Membership · RoleAssignment
     @ui     Form, Select, DatePicker, Table + ToggleGroup, Sheet (snapshot), AlertDialog (apply), Progress
     @states draft · in progress · reviewer sees only own items · completed read-only · cancelled
     @audit  access_review.created | started | decision_recorded | decision_applied | completed | cancelled
     @note   Reviewer can never review themselves (separation of duties). Items are created on Start from the in-scope members.
     @gap    AccessReview has no reviewer_strategy column (who reviews whom: branch managers / team leads / manager / custom): the choice cannot be stored (gaps-01b.md #10).
     ===================================================================================================================== */
  function reviewNew() {
    return '<div class="a-page">' + back("reviews", "Access reviews") + head("New access review", "Periodic certification (§98). Define who is reviewed, by whom, and by when.", btn("Cancel", "") + btn("Save as draft", "") + btn("Create and start", "check", "primary")) +
      '<div class="g-main"><div class="stack">' +
      cd("<b>Review</b>", fl("Name", inp("Q1 2027 access review"), "", 1) + fl("Description", ta("Quarterly certification of all members and their module access.")) + '<div class="g2">' + fl("Starts", sel("Jan 4, 2027", "calendar")) + fl("Due", sel("Jan 31, 2027", "calendar"), "reminders go to reviewers at 7 and 1 day before", 1) + "</div>") +
      cd("<b>Scope: who is reviewed</b>", fl("Scope", '<div class="seg"><button class="on">Organization</button><button>Branch</button><button>Branch + children</button><button>Team</button></div>', "AccessReview.scope_type: ORGANIZATION | BRANCH | BRANCH_HIERARCHY | TEAM") + fl("Target", sel("— whole organization —", "building")) + fl("Only members with access to modules", '<div style="display:flex;gap:6px;flex-wrap:wrap">' + tok("FINANCE") + tok("EMPLOYEES") + '<span class="tok" style="border-style:dashed;color:var(--ash)">+ Add</span></div>', "AccessReview.modules[] · empty = everyone") + callout("users", "<b>24 members</b> match. Owner and the reviewers themselves are included but reviewed by someone else.")) +
      cd("<b>Reviewers</b><span class='r'><span class='badge yellow'>gap</span></span>", fl("Who reviews each member", '<div class="seg"><button class="on">Branch managers</button><button>Team leads</button><button>Line manager</button><button>Specific people</button></div>', "Not stored in the schema today (gap #10). The start action would write reviewer_membership_id per item.") + kv("Resolved reviewers", "Anna Meyer (14), Elena Papadaki (8), Petros R. (2)") + callout("shield", "A reviewer never reviews themselves. Members without a manager fall back to an Admin.", "warn")) +
      foot("Starting snapshots the current access of every member into AccessReviewItem.access_snapshot.", btn("Cancel", "") + btn("Create and start", "check", "primary")) + "</div>" +
      '<div class="stack">' + cd("<b>What reviewers see</b>", tb(["Member", "Access snapshot"], [["Marco Silva", "Developer · 7 modules · Athens"], ["Sofia Jensen", "Employee · 10 modules"]], 1), 1) + "</div></div>" +
      dm(["AccessReview · name, description, scope_type, scope_id, modules, starts_at, due_at", "AccessReviewItem · created on start"], ["reviewer_strategy (gaps-01b.md #10)"]) + "</div>";
  }
  function review() {
    const It = [["Marco Silva", "MS", "g", "Anna Meyer", "CERTIFIED", "", "Developer · 7 modules · Athens"], ["Sofia Jensen", "SJ", "y", "Anna Meyer", "MODIFIED", "Remove Finance module access", "Employee · 10 modules"], ["Ivan Petrov", "IP", "p", "Anna Meyer", "REVOKED", "Left the team in October", "Developer · suspended"], ["Jon Kim", "JK", "r", "Anna Meyer", "PENDING", "", "Developer · 7 modules"], ["Nikos Georgiou", "NG", "g", "Elena Papadaki", "PENDING", "", "Sales Manager · 7 modules"]];
    const dc = { CERTIFIED: "green", REVOKED: "red", MODIFIED: "yellow", PENDING: "" };
    return '<div class="a-page">' + back("reviews", "Access reviews") + '<div class="cd" style="margin-bottom:14px"><div class="hdr-card"><div class="nm"><h2>Q4 2026 access review ' + S("IN_PROGRESS") + '</h2><div class="muted">scope ' + E("ORGANIZATION") + " · all modules · Nov 1 → due Dec 15 · created by Petros R.</div></div>" + btn("Cancel review", "x") + btn("Apply decisions (2)", "check") + btn("Complete", "check", "primary") + "</div></div>" +
      '<div class="mini-stats">' + stat("Progress", "58%", "14 of 24 decided") + stat("Certified", 9, "kept as is") + stat("Revoked", 2, "pending apply", 1) + stat("Modified", 3, "pending apply", 1) + stat("Overdue reviewers", 1, "Elena P.", 1) + "</div>" +
      '<div class="tabset">' + tabs([["i", "Items", 24], ["r", "By reviewer"], ["a", "Activity"]], "i") +
      pane("i", 1, FB([["Decision", "is", "Pending"], ["Reviewer", "is", "Anna Meyer"]], sel("Branch: Any", "building") + btn("Remind reviewers", "bell", "sm")) +
        '<div class="g-main" style="grid-template-columns:minmax(0,1fr) 360px"><div>' + tb(["Member", "Access at review time", "Reviewer", "Decision", "Comment", "Applied"], It.map((r) => ({ cls: "clk", cells: [who(r[1], r[2], r[0], ""), r[6], r[3], r[4] === "PENDING" ? '<div class="seg"><button>Certify</button><button>Revoke</button><button>Modify</button></div>' : E(r[4], dc[r[4]]), '<span class="muted">' + (r[5] || "—") + "</span>", r[4] === "REVOKED" || r[4] === "MODIFIED" ? muted("Pending apply") : muted("—")] }))) + "</div>" +
        cd("<b>Sofia Jensen</b><span class='r'>" + E("MODIFIED", "yellow") + "</span>", '<div class="muted" style="margin-bottom:6px">access_snapshot (frozen at start)</div>' + kv("Roles", "Employee (ORGANIZATION)") + kv("Grants", "none") + kv("Branches", "Thessaloniki (primary)") + kv("Modules", "10 · incl. FINANCE") + kv("Last active", "1h ago") + kv("MFA", '<span class="badge yellow">Off</span>') + '<div class="muted" style="margin:10px 0 6px">Decision</div>' + '<div class="seg"><button>Certify</button><button>Revoke</button><button class="on">Modify</button></div>' + fl("Comment (required)", inp("Remove Finance module access"), "") + fl("Change to apply", sel("MembershipModuleAccess · FINANCE = off", "layers"), "applied through the normal services") + btn("Save decision", "check", "sm")) + "</div>") +
      pane("r", 0, tb(["Reviewer", ">Assigned", ">Decided", "Progress", "Status"], [["Anna Meyer", '<span class="num">14</span>', '<span class="num">10</span>', '<span class="bar"><i style="width:71%"></i></span> 71%', E("IN_PROGRESS", "blue")], ["Elena Papadaki", '<span class="num">8</span>', '<span class="num">3</span>', '<span class="bar"><i style="width:38%"></i></span> 38%', '<span class="badge red">Overdue reminder</span>'], ["Petros R.", '<span class="num">2</span>', '<span class="num">1</span>', '<span class="bar"><i style="width:50%"></i></span> 50%', E("IN_PROGRESS", "blue")]])) +
      pane("a", 0, cd("<b>Activity</b><span class='r muted'>AuditEvent</span>", '<div class="tl"><div class="ev"><b class="key">access_review.decision_recorded</b><small>Anna M. · Ivan Petrov REVOKED · 2h ago</small></div><div class="ev"><b class="key">access_review.started</b><small>Petros R. · Nov 1 · 24 items</small></div><div class="ev"><b class="key">access_review.created</b><small>Petros R. · Oct 28</small></div></div>')) + "</div>" +
      dm(["AccessReview · status, scope_type, scope_id, modules, starts_at, due_at, completed_at", "AccessReviewItem · membership_id, reviewer_membership_id, decision, decided_at, comment, access_snapshot, applied_at"], ["reviewer_strategy (gaps-01b.md #10)"]) + "</div>";
  }

  /* =====================================================================================================================
     CONNECT INTEGRATION (provider picker + write-only forms for the 5 supported providers)
     @screen Connect integration
     @route  /admin/integrations/new?provider=OPENAI|RESEND|TWILIO|STRIPE|VIVA_WALLET
     @perm   organizations.integrations.manage* + recent MFA (step-up)
     @api    GET /integrations/providers · POST /integrations {provider, name, mode, secrets{}, config{}, usage_limits, branch_id, make_default} (verifies first, activates only on success)
     @mcp    organizations_integrations_manage* (always a human confirmation)
     @data   IntegrationConnection · INTEGRATION_PROVIDERS registry (integration-providers.ts: secrets[], config[]) 
     @ui     Card picker, Form generated from the registry, password Input (no paste block, autocomplete off), Select, Switch, Button "Test and save"
     @states idle · verifying · verification failed (sanitized provider error, form kept, secrets cleared) · success -> connection detail · MFA step-up required
     @audit  integration.connected | integration.verification_failed
     @note   Secrets are WRITE-ONLY: after saving only secret_hints exist. The form clears secret fields on submit and never keeps them in the URL, storage or logs. Only five providers exist (BYOK, 01 §156).
     ===================================================================================================================== */
  function integrationNew() {
    const P = [["OPENAI", "OpenAI", "OA", "green", "AI", [["API key", "sk-…", 1]], [["Organization ID", "org-…"], ["Default model", "gpt-4.1"]], 1], ["RESEND", "Resend", "Re", "blue", "Email", [["API key", "re_…", 1], ["Webhook signing secret", "whsec_… (optional)", 0]], [["From address", "no-reply@logiqdev.example"], ["Reply-to", ""]], 1], ["TWILIO", "Twilio", "Tw", "red", "SMS", [["Account SID", "AC…", 1], ["Auth token", "", 1]], [["Messaging service SID", "MG…"], ["From number", "+30…"]], 0], ["STRIPE", "Stripe", "St", "purple", "Payments", [["Secret key", "sk_live_… / sk_test_…", 1], ["Webhook signing secret", "whsec_…", 1]], [["Publishable key", "pk_live_…"], ["Statement descriptor", "LOGIQDEV"]], 1], ["VIVA_WALLET", "Viva Wallet", "VW", "", "Payments", [["Client ID", "", 1], ["Client secret", "", 1], ["API key", "", 1]], [["Merchant ID", ""], ["Source code", ""]], 1]];
    return '<div class="a-page">' + back("integrations", "Integrations") + head("Connect an integration", "Bring your own account. The key is verified with the provider, encrypted, and never shown again (§156).", btn("Cancel", "")) + stepper(["Choose provider", "Enter credentials", "Verify and save"], 1) +
      '<div class="prov-grid" style="margin-bottom:14px">' + P.map((p, i) => '<div class="prov" style="' + (i === 1 ? "border-color:var(--primary)" : "") + '">' + pv(p[2], p[3]) + "<div><b>" + p[1] + "</b><small>" + p[4] + "</small></div>" + (i === 1 ? '<span class="badge green">Selected</span>' : "") + "</div>").join("") + "</div>" +
      '<div class="tabset">' + tabs(P.map((p, i) => [p[0], p[1]]), "RESEND") +
      P.map((p) => pane(p[0], p[0] === "RESEND", '<div class="g-main"><div class="stack">' +
        cd("<b>Connect " + p[1] + "</b><span class='r'><span class='badge'>" + p[4] + "</span></span>", fl("Connection name", inp(p[1] + " production"), "unique per organization", 1) + (p[7] ? fl("Mode", '<div class="seg"><button class="on">Live</button><button>Test</button></div>', "test connections can never be the default for live payments") : "") +
          p[5].map((f) => fl(f[0] + " <span class='sens'>*</span>", '<div class="pwd">••••••••••••<span style="margin-left:auto;letter-spacing:0;color:var(--ash)">' + I("lock", 13) + "</span></div>" + (f[1] ? "<div class='sub-note'>Format " + f[1] + "</div>" : ""), "", f[2])).join("") +
          p[6].map((f) => fl(f[0], ph(f[1] || "optional"))).join("") + fl("Available to", sel("Entire organization", "building"), "or restrict to one branch") + sw2("Make default for " + p[4], "one default per category and mode", 1) +
          '<div style="display:flex;gap:8px;margin-top:6px">' + btn("Cancel", "") + '<button class="btn primary" style="flex:1">' + I("check", 14) + " Test and save</button></div>") + "</div>" +
        '<div class="stack">' + cd("<b>What happens next</b>", '<div class="tl"><div class="ev"><b>1 · Verify</b><small>We call ' + p[1] + ' with your key. Nothing is stored if this fails.</small></div><div class="ev"><b>2 · Encrypt</b><small>Secrets are encrypted per organization. You see only a hint like “…a3f9”.</small></div><div class="ev"><b>3 · Activate</b><small>Status goes from PENDING to ACTIVE; modules start using it.</small></div></div>') + callout("lock", "Step-up: you will be asked to confirm with MFA before the key is saved.", "warn") + "</div></div>")).join("") + "</div>" +
      dm(["IntegrationConnection · provider, category, name, mode, secret_hints, config, usage_limits, branch_id, is_default", "integration-providers.ts · secrets[] and config[] per provider (5 providers)"], []) + "</div>";
  }

  /* =====================================================================================================================
     NOTIFICATION PREFERENCES (self + organization defaults) · owned by module 14, surfaced in Admin
     @screen Notification preferences
     @route  /admin/notifications?tab=mine|defaults
     @perm   own preferences: notifications.preferences.manage_own (every role) · organization defaults: notifications.defaults.manage-class permission of module 14 (see note)
     @api    GET/PATCH /me/notification-settings · PUT /me/notification-preferences {event_type_id|module, channel, enabled, level, delivery_mode} · GET/PUT /notification-defaults
     @mcp    notifications_preferences_manage_own
     @data   NotificationRecipientSettings (level, channel switches, dnd_*, timezone, digest_frequency, digest_channel) · NotificationPreference (event_type_id|module, channel, enabled, level, delivery_mode, muted_until) · NotificationOrgDefault (channels, portal_channels, delivery_mode, digest_frequency, is_mandatory) · NotificationEventType (forced_channels, mandatory_by_default)
     @ui     Switch grid (event × channel), ToggleGroup (level), Select (digest), TimePicker (DND), Tabs
     @states loading · saving optimistic · mandatory cells locked with a lock icon · no-access for the defaults tab
     @audit  notification.preference_changed (self) · notification.defaults_changed
     @note   Security notifications are MANDATORY by default: the cell is locked ("forced by organization"). Channels not connected (SMS without a Twilio connection) are disabled with a link to Integrations.
     ===================================================================================================================== */
  function notifPrefs() {
    const EV = [["Mentioned in a comment", "MESSAGING", [1, 1, 0, 1, 1, 0], 0], ["Task assigned to me", "TASKS", [1, 1, 0, 1, 0, 0], 0], ["Invoice overdue", "FINANCE", [1, 1, 1, 0, 0, 0], 0], ["New support ticket assigned", "SUPPORT", [1, 1, 0, 1, 1, 1], 0], ["New admin added", "ADMINISTRATION", [1, 1, 0, 0, 0, 0], 1], ["MFA disabled for a member", "ADMINISTRATION", [1, 1, 0, 1, 0, 0], 1], ["Access review assigned to me", "ADMINISTRATION", [1, 1, 0, 0, 0, 0], 1]];
    const ch = ["IN_APP", "EMAIL", "SMS", "PUSH", "DESKTOP", "SLACK"];
    const grid = (def) => '<div class="panel" style="margin-top:0"><div class="tbl-scroll"><table class="mx"><thead><tr><th>Event</th>' + ch.map((c) => '<th title="' + c + '">' + en(c) + "</th>").join("") + (def ? "<th>Mandatory</th>" : "<th>Delivery</th>") + "</tr></thead><tbody>" + EV.map((e) => "<tr><td><b class='ink' style='font-weight:500'>" + e[0] + '</b><div class="sub-note">' + modLabel(e[1]) + "</div></td>" + e[2].map((v, i) => "<td>" + (e[3] && i < 2 ? '<span title="forced by organization" style="color:var(--ash)">' + I("lock", 14) + "</span>" : sw(v)) + "</td>").join("") + "<td>" + (def ? sw(e[3]) : sel(e[3] ? "Immediate" : "Immediate · daily digest").replace('class="sel"', 'class="sel" style="width:150px"')) + "</td></tr>").join("") + "</tbody></table></div></div>";
    return '<div class="a-page">' + head("Notification preferences", "Choose how you are notified, and what the organization sends by default (module 14).", btn("Reset to defaults", "")) +
      '<div class="tabset">' + tabs([["m", "My preferences"], ["d", "Organization defaults"], ["p", "Portal users"]], "m") +
      pane("m", 1, '<div class="g-main"><div class="stack">' + grid(0) + "</div>" + '<div class="stack">' + cd("<b>Level</b><span class='r muted'>NotificationRecipientSettings.level</span>", '<div class="seg" style="flex-wrap:wrap"><button class="on">All</button><button>Important only</button><button>Mentions and direct</button><button>None</button></div>') +
        cd("<b>Do not disturb</b>", sw2("Enabled", "dnd_enabled", 1) + fl("Hours", sel("22:00 to 07:00", "clock")) + fl("Days", sel("Every day", "calendar")) + sw2("Allow critical", "dnd_allow_critical", 1)) +
        cd("<b>Digest</b>", fl("Frequency", sel("Daily", "mail"), "NotificationDigestFrequency: IMMEDIATE | HOURLY | DAILY | WEEKLY") + fl("Channel", sel("Email", "mail")) + fl("Hour", sel("08:00", "clock"))) + cd("<b>Channels</b>", sw2("In-app", "in_app_enabled", 1) + sw2("Email", "email_enabled", 1) + sw2("SMS", "Needs a Twilio connection · <a style='text-decoration:underline'>Connect</a>", 0) + sw2("Push", "push_enabled", 1) + sw2("Sound", "sound_enabled", 1)) + "</div></div>") +
      pane("d", 0, callout("shield", "Organization defaults (NotificationOrgDefault) apply to members who have not chosen otherwise. <b>Mandatory</b> events cannot be switched off by members.") + '<div style="height:12px"></div>' + grid(1)) +
      pane("p", 0, callout("globe", "Portal users have their own channels (<span class='key'>portal_channels</span>, default In-app + Email). Customer-visible event types only.") + '<div style="height:12px"></div>' + tb(["Event", "Customer visible", "Portal channels"], [["Proposal ready to review", cb(1), tok("IN_APP") + " " + tok("EMAIL")], ["Invoice issued", cb(1), tok("IN_APP") + " " + tok("EMAIL")], ["Ticket reply", cb(1), tok("IN_APP") + " " + tok("EMAIL")]])) + "</div>" +
      dm(["NotificationRecipientSettings · NotificationPreference · NotificationOrgDefault · NotificationEventType", "NotificationDigest (frequency)"], ["The permission for editing ORGANIZATION defaults is not in the Admin catalog: confirm the module 14 key"]) + "</div>";
  }

  /* =====================================================================================================================
     CUSTOMER PORTAL IDENTITY (01 §79): portal users list · invite portal user · portal user detail
     @screen Portal users · Invite portal user · Portal user detail
     @route  /admin/portal-users?customer=&role=&status= · /admin/portal-users/new · /admin/portal-users/:id
     @perm   portal.users.manage* (everything here) · the CUSTOMER_OWNER / CUSTOMER_ADMINISTRATOR roles can manage their own company's users from the portal itself (portal.users.manage)
     @api    GET /portal-users?... · POST /invitations {audience: CUSTOMER_PORTAL, customer_id, role_id, emails[]} · GET/PATCH /portal-users/:id {role_id, status} · POST /portal-users/:id/deactivate|reactivate
     @mcp    portal_users_manage*
     @data   CustomerPortalMembership (customer_id, user_id, role_id, status, invited_by_user_id, joined_at, last_active_at, deactivated_at) · Invitation (audience CUSTOMER_PORTAL, customer_id, portal_membership_id) · Role (type CUSTOMER_PORTAL) · User · CrmCompany (02) · OrganizationSecurityPolicy.portal_mfa_policy · NotificationRecipientSettings (PORTAL_USER)
     @ui     Table, Filter bar, Form, Combobox (customer), Select (role), Switch, AlertDialog (deactivate)
     @states loading · empty · error · no-access · last CUSTOMER_OWNER cannot be deactivated
     @audit  portal_user.invited | portal_user.role_changed | portal_user.deactivated
     @note   A portal user is a User (global identity) + CustomerPortalMembership (one per customer company). The SAME email can belong to several customers. They NEVER get a Membership or internal roles; permissions come only from CUSTOMER_PORTAL roles scoped to the customer.
             Data they may see is further limited by customer_visible flags in each module. Portal MFA follows portal_mfa_policy.
     ===================================================================================================================== */
  function portalUsers() {
    const P = [["Lena Kovac", "LK", "p", "lena@acme.example", "Acme Corp", "CUSTOMER_OWNER", "ACTIVE", "2m ago", "On"], ["Daniel Ortiz", "DO", "g", "daniel@globex.example", "Globex", "CUSTOMER_FINANCE", "ACTIVE", "14m ago", "On"], ["Priya Nair", "PN", "", "priya@initech.example", "Initech", "CUSTOMER_MANAGER", "ACTIVE", "1d ago", "Off"], ["Tom Becker", "TB", "y", "tom@northwind.example", "Northwind", "CUSTOMER_VIEWER", "INVITED", "—", "—"], ["Sara Lind", "SL", "r", "sara@acme.example", "Acme Corp", "CUSTOMER_LEGAL", "SUSPENDED", "Oct 3", "On"]];
    return '<div class="a-page">' + head("Customer portal users", "People from your customers who can sign in to the portal (§79). Separate from members.", btn("Export", "") + '<a href="#admin/portalinvite" class="btn primary">' + I("plus", 14) + "Invite portal user</a>") +
      FB([["Customer", "is any of", "Acme Corp, Globex"], ["Status", "is not", "Deactivated"]], sel("Role: Any") + btn("Save view", "plus", "sm")) +
      tb(["User", "Customer", "Role", "Status", "MFA", "Last active", ""], P.map((p) => clk("portaluser", [who(p[1], p[2], p[0], p[3]), p[4], E(p[5], "blue"), S(p[6]), p[8] === "On" ? '<span style="color:var(--green)">' + I("shield", 15) + "</span>" : p[8] === "Off" ? '<span class="badge yellow">Off</span>' : muted("—"), muted(p[7]), more]))) +
      dm(["CustomerPortalMembership · customer_id, user_id, role_id, status, joined_at, last_active_at, deactivated_at", "Role · type CUSTOMER_PORTAL (6 templates)"], []) + "</div>";
  }
  function portalInvite() {
    return '<div class="a-page">' + back("portalusers", "Portal users") + head("Invite portal user", "Creates an Invitation with audience CUSTOMER_PORTAL. On accept, a CustomerPortalMembership is created.", btn("Cancel", "") + btn("Send invitation", "send", "primary")) +
      '<div class="g-main"><div class="stack">' + cd("<b>Person</b>", fl("Email addresses", ta("lucas@acme.example"), "", 1) + fl("Customer company", sel("Acme Corp", "building"), "CRM Company · they will only see this company’s data", 1)) +
      cd("<b>Portal role</b>", fl("Role", sel("Customer Viewer", "shield"), "RoleType CUSTOMER_PORTAL: Owner, Administrator, Manager, Finance, Legal, Viewer", 1) + tb(["Role", "Can do"], [["Customer Owner", keyList(["portal.users.manage", "portal.settings.manage", "portal.invoices.pay"])], ["Customer Finance", keyList(["portal.invoices.read", "portal.invoices.pay", "portal.subscriptions.manage"])], ["Customer Viewer", keyList(["portal.projects.read", "portal.documents.read", "portal.invoices.read"])]], 1) + callout("lock", "Portal roles are never mixed with internal roles. Sensitive keys (<span class='sens'>*</span>) such as " + keyc("portal.contracts.sign") + " are only in Legal/Owner.", "warn")) +
      cd("<b>Message & expiry</b>", fl("Message", ta("You now have access to your project portal.")) + fl("Expires after", sel("14 days", "clock")) + sw2("Require MFA at first sign-in", "follows portal_mfa_policy (currently Optional)", 0)) +
      foot("Audited as invitation.sent.", btn("Cancel", "") + btn("Send invitation", "send", "primary")) + "</div>" + '<div class="stack">' + cd("<b>Existing portal users at Acme Corp</b>", '<div class="rowx"><div class="grow"><b>Lena Kovac</b><small>Customer Owner</small></div></div><div class="rowx"><div class="grow"><b>Sara Lind</b><small>Customer Legal · suspended</small></div></div>', 1) + "</div></div>" +
      dm(["Invitation · audience CUSTOMER_PORTAL, customer_id, role_id, email, expires_at", "Role · type CUSTOMER_PORTAL"], []) + "</div>";
  }
  function portalUser() {
    return '<div class="a-page">' + back("portalusers", "Portal users") + '<div class="cd" style="margin-bottom:14px"><div class="hdr-card">' + AV("LK", "p", "xl") + '<div class="nm"><h2>Lena Kovac ' + S("ACTIVE") + E("CUSTOMER_OWNER", "blue") + '</h2><div class="muted">lena@acme.example · Acme Corp · joined Apr 2025 · last active 2m ago</div></div>' + btn("Change role", "shield") + btn("Deactivate", "x") + btn("Resend invitation", "mail") + "</div></div>" +
      '<div class="tabset">' + tabs([["i", "Identity"], ["p", "Portal access"], ["s", "Sessions", 1], ["n", "Notifications"], ["a", "Audit"]], "i") +
      pane("i", 1, '<div class="g2">' + cd("<b>Identity</b>", kv("Name", "Lena Kovac") + kv("Email", "lena@acme.example " + muted("verified")) + kv("Linked customers", "Acme Corp, Acme Labs " + muted("same User, 2 memberships")) + kv("Internal membership", muted("none, by design")) + kv("MFA", "TOTP on")) + cd("<b>Membership</b><span class='r muted'>CustomerPortalMembership</span>", kv("Customer", "Acme Corp (CRM Company)") + kv("Role", E("CUSTOMER_OWNER", "blue")) + kv("Status", S("ACTIVE")) + kv("Invited by", "Anna Meyer") + kv("Joined", "Apr 2, 2025")) + "</div>") +
      pane("p", 0, cd("<b>What this person can do in the portal</b><span class='r muted'>from the role</span>", '<div class="acts" style="padding:12px 16px;gap:6px;flex-wrap:wrap">' + [["portal.projects.read", 1], ["portal.proposals.accept", 1, 1], ["portal.contracts.sign", 1, 1], ["portal.invoices.pay", 1, 1], ["portal.users.manage", 1, 1]].map((k) => chip(k[0].replace("portal.", ""), 1, k[2] ? 1 : 0)).join("") + "</div>", 1) + callout("globe", "Everything is limited to Acme Corp and to records flagged customer-visible in their modules.")) +
      pane("s", 0, tb(["Device", "IP", "Location", "Last activity", ""], [["Windows · Chrome", '<span class="mono">91.x.x.x</span>', "Nicosia, CY", "2m ago", btn("Revoke", "", "sm")]])) +
      pane("n", 0, callout("bell", "Portal notification settings: In-app + Email, daily digest off. Managed by the user (NotificationRecipientSettings, recipient_type PORTAL_USER).")) +
      pane("a", 0, tb(["When", "Event", "Detail"], [[muted("2m ago"), '<span class="badge key">user.login</span>', "portal"], [muted("Apr 2"), '<span class="badge key">invitation.accepted</span>', "audience CUSTOMER_PORTAL"]])) + "</div>" +
      dm(["CustomerPortalMembership · User · Role (CUSTOMER_PORTAL) · UserSession · AuditEvent"], []) + "</div>";
  }

  /* =====================================================================================================================
     NEW DELEGATION
     @screen New delegation
     @route  /admin/delegations/new
     @perm   users.delegations.manage (delegator can only delegate what they hold; sensitive keys may need approval §95)
     @api    POST /delegations {delegate_membership_id, permission_keys[], role_ids[], scope_type, scope_id, starts_at, ends_at, reason}
     @mcp    users_delegations_manage
     @data   Delegation (delegator_membership_id, delegate_membership_id, permission_keys, role_ids, scope_type, scope_id, status, starts_at, ends_at, reason)
     @ui     Form, Combobox, Command multi-select, DateRangePicker, Textarea, Alert
     @states idle · validation (end before start, delegating a permission not held) · saving
     @audit  delegation.created
     @note   Status is time-driven (SCHEDULED → ACTIVE → EXPIRED) or REVOKED. A delegate can never re-delegate.
     ===================================================================================================================== */
  function delegationNew() {
    return '<div class="a-page">' + back("delegations", "Delegations") + head("New delegation", "Temporarily hand selected responsibilities to someone else (§94).", btn("Cancel", "") + btn("Create delegation", "check", "primary")) +
      '<div class="g-main"><div class="stack">' + cd("<b>Who</b>", fl("Delegate", sel("Marco Silva · Developer", "users"), "", 1) + fl("On behalf of", sel("You · Anna Meyer", "users"), "Admins may delegate on behalf of another member")) +
      cd("<b>What</b>", fl("Permissions", '<div style="display:flex;gap:6px;flex-wrap:wrap">' + keyList(["tasks.tasks.assign", "projects.projects.manage_members"]) + '<span class="tok" style="border-style:dashed;color:var(--ash)">+ Add</span></div>', "only keys you hold; sensitive keys marked * may need approval") + fl("Roles (optional)", sel("— none —", "shield")) + fl("Scope", '<div class="seg"><button>Organization</button><button>Branch</button><button class="on">Project</button></div>') + fl("Target", sel("Acme Rebrand Website", "folder"))) +
      cd("<b>When & why</b>", '<div class="g2">' + fl("Starts", sel("Nov 20", "calendar")) + fl("Ends", sel("Nov 30", "calendar")) + "</div>" + fl("Reason", ta("Holiday cover"), "", 1)) +
      foot("Starts SCHEDULED; becomes ACTIVE automatically.", btn("Cancel", "") + btn("Create delegation", "check", "primary")) + "</div><div class='stack'>" + cd("<b>Rules</b>", callout("shield", "The delegate gets only the listed keys, only inside the scope, only during the period. They cannot delegate further. Every use is audited with the delegator.")) + "</div></div>" +
      dm(["Delegation · all columns"], []) + "</div>";
  }

  /* Enhanced MEMBERS list: same data as members(), with the shared filter bar, saved views, sort, bulk actions. @route /admin/members?... @perm users.members.read
     @note Saved views = SavedView (entity_type = MEMBERSHIP is not in RecordEntityType: gap #4). Bulk actions need the per-action permission for each selected row. */
  function members2() {
    const base = members();
    const bar = FB([["Role", "is any of", "Developer, Project Manager"], ["Branch", "is", "Athens"], ["MFA", "is", "Off"]], sel("Sort: Last active") + btn("Save view", "plus", "sm")) +
      '<div class="seg" style="margin:0 0 10px"><button class="on">All 24</button><button>Admins 3</button><button>MFA off 4</button><button>Invited 3</button><button>Suspended 1</button><button>+ Saved view</button></div>' +
      '<div class="bulk" style="margin-bottom:10px"><span class="ink"><b>2 selected</b></span>' + btn("Change role", "shield", "sm") + btn("Add to team", "people", "sm") + btn("Set branch", "building", "sm") + btn("Suspend", "", "sm") + btn("Export", "file", "sm") + "</div>";
    return base.replace('<div class="toolbar">', bar + '<div class="toolbar">');
  }
  /* Router map: sub-page key (hash "#admin/<key>") -> screen. Production: one route per entry under /admin (see @route on each screen). `service` is the API-keys page opened on the service-accounts tab.
     01b additions: invitenew, member (tabs; old single page = member-access), rolenew, team/teamnew, branchnew, apikeynew/apikey/servicenew, webhooks*, audit (filters) + auditevent, branding, domains/domainnew, retention, billing,
     lifecycle, reviewnew/review, integrationnew, notifprefs, portalusers/portalinvite/portaluser, delegationnew. */
  const MAP = { overview, members: members2, member: memberDetail, "member-access": member, roles, role, rolenew: roleNew, catalog, matrix, simulate, branches, branchnew: branchNew, teams, team, teamnew: teamNew, invitations, invitenew: inviteNew, security, sso, sessions, apikeys, apikey, apikeynew: apikeyNew, servicenew: serviceNew, service: () => apikeys("service"), webhooks, webhooknew: webhookNew, webhook, audit: audit2, "audit-classic": audit, auditevent: auditEvent, modules, delegations, delegationnew: delegationNew, profile, branding, domains, domainnew: domainNew, retention, billing, lifecycle, reviews, reviewnew: reviewNew, review, integrations, integrationnew: integrationNew, integration, notifprefs: notifPrefs, portalusers: portalUsers, portalinvite: portalInvite, portaluser: portalUser };
  const CRUMB = { member: "Anna Meyer", role: "Project Manager", rolenew: "Create role", team: "Mobile squad", teamnew: "Create team", branchnew: "Create branch", invitenew: "Invite members", apikeynew: "Create API key", apikey: "Website lead form", servicenew: "Create service account", service: "Service accounts", webhooknew: "Create webhook", webhook: "Billing sync", auditevent: "Event", domainnew: "Add domain", reviewnew: "New access review", review: "Q4 2026 access review", integration: "Stripe EU live", integrationnew: "Connect", portalinvite: "Invite portal user", portaluser: "Lena Kovac", delegationnew: "New delegation" };
  window.VIEWS.admin = { html: function (s) { return (MAP[s || "overview"] || MAP.overview)(s); }, crumb: function (s) { return CRUMB[s] || ""; } };
})();
