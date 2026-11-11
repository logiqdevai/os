/* =====================================================================================================================
   DOCS APP — module 15 Business Docs (docs/features/15-notion-business-docs.md). Notion-style wiki: spaces, nested pages, block editor,
   versions, comments, review cadence, acknowledgements, onboarding checklists (generate Tasks), custom forms, AI knowledge, search.
   =====================================================================================================================
   SCHEMA-ALIGNED to api/prisma/schema.prisma: WikiSpace, WikiSpaceMember, WikiPageTemplate, WikiPage, WikiPageReviewer, WikiPageVersion, WikiPagePermission, WikiPageLink, WikiPageAttachment, WikiPageComment,
   WikiPageFavorite, WikiPageAcknowledgement, WikiChecklist, WikiChecklistItem, WikiChecklistRun, WikiChecklistRunItem, CustomForm, CustomFormVersion, FormAssignment, FormAssignmentRecipient, FormSubmission,
   FormSubmissionFile, WikiAiIndexEntry, WikiAiSuggestion. Enums are real values: WikiSpaceKind (DEPARTMENT, TEAM, BRANCH, PROJECT, TOPIC), WikiPageStatus (DRAFT, PUBLISHED, NEEDS_REVIEW, ARCHIVED), WikiPageType (GENERAL,
   POLICY, PROCEDURE, RUNBOOK, MEETING_NOTES, DECISION_RECORD, HANDBOOK_CHAPTER, ONBOARDING_GUIDE, OFFBOARDING_GUIDE, FAQ), WikiVisibility (ORGANIZATION, BRANCH, TEAM, ROLE, MEMBERS), WikiPermissionLevel (VIEW, COMMENT, EDIT,
   MANAGE), WikiPrincipalType (MEMBERSHIP, TEAM, BRANCH, ROLE, DEPARTMENT), WikiChecklistKind (ONBOARDING, OFFBOARDING), WikiChecklistAssigneeKind (SUBJECT, MANAGER, CHECKLIST_OWNER, SPECIFIC_MEMBER), WikiChecklistRunStatus
   (NOT_STARTED, IN_PROGRESS, COMPLETED, CANCELLED), WikiChecklistTrigger (MEMBER_ONBOARDING, MEMBER_OFFBOARDING, MANUAL, AUTOMATION), WikiChecklistItemStatus (PENDING, IN_PROGRESS, COMPLETED, SKIPPED), CustomFormStatus
   (DRAFT, PUBLISHED, CLOSED, ARCHIVED), CustomFormKind (FEEDBACK_SURVEY, CHECK_IN, EQUIPMENT_REQUEST, INCIDENT_REPORT, COMPLIANCE_ACKNOWLEDGEMENT, EXIT_INTERVIEW, CUSTOM), CustomFormFieldType (SHORT_TEXT, LONG_TEXT, NUMBER,
   EMAIL, SINGLE_CHOICE, MULTI_CHOICE, CHECKBOX, SCALE, DATE, FILE_UPLOAD, SIGNATURE, SECTION), FormAssignmentTargetType, FormAssignmentRecipientStatus, FormSubmissionStatus, WikiAiSourceType, WikiAiIndexStatus,
   WikiAiSuggestionKind, WikiAiSuggestionStatus.
   Permission keys (catalog): docs.pages.read / create / update / publish / archive / delete*, docs.spaces.manage, docs.checklists.manage, docs.forms.read / create / update / delete* / archive / export* / assign / review,
   docs.forms.anonymous_responses.read*, docs.ai.query. (* sensitive). Gaps (page views/analytics, trash retention, import/export jobs, ack audience, page follow) are in gaps-15.md and marked @gap.
   Comment tags (legend in README.md): @screen @route @perm @api @mcp @data @ui @states @audit @note @gap. Every screen ends with a "Data model" footer (REVIEW-ONLY, do not ship).

   RULES THAT APPLY TO EVERY SCREEN HERE:
     - Pages are structured content (WikiPage.content = block tree Json, content_markdown = derived plain text for search and AI). Files and images embedded in a page are Documents (17, WikiPageAttachment.document_id);
       links to platform records are WikiPageLink (entity_type = RecordEntityType). Customer-facing help center articles belong to 13: a page only flags customer_visible and the help center publishes a VIEW of it.
     - Status lifecycle is WikiPageStatus. Every save writes an immutable WikiPageVersion (current_version_number). Publishing sets published_version_number (readers see the published snapshot, editors the draft).
       Editing a PUBLISHED page creates a draft on top; "Publish changes" needs docs.pages.publish.
     - Access = space default_visibility + WikiSpaceMember levels + WikiPagePermission grants (VIEW < COMMENT < EDIT < MANAGE), narrowed by branch/team scope. The UI never lists a page, a search hit, a mention or an AI
       citation the caller may not read: the server filters, the client never post-filters. Restricted pages show a lock icon, never their title to non-members.
     - Review cadence: next_review_at = last_reviewed_at + review_interval_days. A scheduled job sets status NEEDS_REVIEW and stale_flagged_at when overdue and notifies the owner and reviewers (14).
     - Required reading: WikiPage.requires_acknowledgement + WikiPageAcknowledgement rows; a new published version older than acknowledged_version_number requires re-acknowledgement.
     - Onboarding/offboarding: WikiChecklist (definition) -> WikiChecklistRun (one member) -> WikiChecklistRunItem; each item generates a Task (06) assigned by assignee_kind. Progress is progress_percent.
     - Every mutation writes audit_events; webhooks docs.page_published, docs.page_updated, docs.form_assigned, docs.form_submitted (20).
   ===================================================================================================================== */
(function () {
  const U = window.UI;
  const { E, ES, head, btn, cd, sw, cb, sel, stat, search, who, tok, kv, muted, more, callout, dm, tabs, pane } = U;
  const I = (n, s) => LQ.icon(n, s);
  const AV = LQ.av;
  const th = (a) => "<thead><tr>" + a.map((x) => "<th" + (x[0] === ">" ? ' class="num"' : "") + ">" + x.replace(/^>/, "") + "</th>").join("") + "</tr></thead>";
  const tbl = (cols, rows) => '<div class="panel" style="margin-top:0"><table>' + th(cols) + "<tbody>" + rows.map((r) => "<tr>" + r.map((c, i) => "<td" + (cols[i][0] === ">" ? ' class="num"' : "") + ">" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  const bar = (p, tone) => '<span class="bar"><i style="width:' + p + "%" + (tone ? ";background:var(--" + tone + ")" : "") + '"></i></span> ' + p + "%";
  const ink = (t) => '<span class="ink">' + t + "</span>";
  const gap = (h) => '<div style="height:' + (h || 12) + 'px"></div>';
  const PEOPLE = { AM: ["Anna Meyer", ""], MS: ["Marco Silva", "g"], SJ: ["Sofia Jensen", "y"], JK: ["Jonas Koch", "r"], KL: ["Kim Lund", "p"], LN: ["Lena Novak", "g"] };
  const av = (a) => AV(a, PEOPLE[a][1]);
  const wh = (a, s) => who(a, PEOPLE[a][1], PEOPLE[a][0], s || "");
  const f = (l, h, hint) => '<div class="fld"><label>' + l + "</label>" + h + (hint ? '<div class="sub-note">' + hint + "</div>" : "") + "</div>";
  const box = (t) => '<div class="input-fake">' + t + "</div>";
  const row2 = (a, b) => '<div class="rowx" style="gap:8px;padding:0">' + a + b + "</div>";
  const filt = (chips, extra) => window.UI.filters.filterBar(chips, extra);
  const pager = (t) => '<div class="pager"><span class="muted">' + t + '</span><span style="flex:1"></span>' + btn("Previous", "", "sm") + btn("Next", "", "sm") + "</div>";

  /* @impl statusBadge(WikiPageStatus): DRAFT yellow, PUBLISHED green, NEEDS_REVIEW red, ARCHIVED neutral. Same map everywhere (page tree, lists, search, analytics). */
  const PS = { DRAFT: "yellow", PUBLISHED: "green", NEEDS_REVIEW: "red", ARCHIVED: "" };
  const pst = (s) => ES(s, PS[s]);
  const PT = { GENERAL: "", POLICY: "purple", PROCEDURE: "blue", RUNBOOK: "red", MEETING_NOTES: "", DECISION_RECORD: "yellow", HANDBOOK_CHAPTER: "green", ONBOARDING_GUIDE: "blue", OFFBOARDING_GUIDE: "yellow", FAQ: "green" };
  const ptp = (t) => E(t, PT[t]);
  const pico = (t) => ({ POLICY: "shield", PROCEDURE: "list", RUNBOOK: "zap", MEETING_NOTES: "calendar", DECISION_RECORD: "flag", HANDBOOK_CHAPTER: "book", ONBOARDING_GUIDE: "users", OFFBOARDING_GUIDE: "users", FAQ: "help", GENERAL: "file" }[t] || "file");

  /* Spaces: name, slug, kind, scope label, default_visibility, pages, members, owner, icon, tone, archived */
  const SP = [
    ["Engineering", "engineering", "DEPARTMENT", "Department: Engineering", "ORGANIZATION", 86, 24, "MS", "layers", "", 0],
    ["Operations", "operations", "DEPARTMENT", "Department: Operations", "ORGANIZATION", 41, 12, "AM", "settings", "g", 0],
    ["People and HR", "people-hr", "DEPARTMENT", "Department: People", "TEAM", 58, 9, "SJ", "people", "p", 0],
    ["Sales playbook", "sales", "TEAM", "Team: Sales", "TEAM", 33, 11, "JK", "dollar", "y", 0],
    ["Berlin office", "berlin", "BRANCH", "Branch: Berlin", "BRANCH", 17, 18, "KL", "building", "", 0],
    ["Acme Rebrand Website", "proj-acme-rebrand", "PROJECT", "Project: Acme Rebrand Website", "MEMBERS", 12, 7, "MS", "folder", "r", 0],
    ["Company handbook", "handbook", "TOPIC", "Topic", "ORGANIZATION", 64, 42, "AM", "book", "g", 0],
    ["Legacy intranet", "legacy-intranet", "TOPIC", "Topic", "ORGANIZATION", 120, 0, "AM", "box", "", 1],
  ];

  /* Page tree of the Engineering space: title, type, status, depth, children count, icon override, flags */
  const TREE = [
    ["Engineering home", "GENERAL", "PUBLISHED", 0, 4, "home"],
    ["Runbooks", "GENERAL", "PUBLISHED", 0, 3, "zap"],
    ["Production deploy runbook", "RUNBOOK", "PUBLISHED", 1, 0, "zap", "on"],
    ["Database failover runbook", "RUNBOOK", "NEEDS_REVIEW", 1, 0, "zap"],
    ["Incident response", "PROCEDURE", "PUBLISHED", 1, 0, "list"],
    ["Engineering handbook", "HANDBOOK_CHAPTER", "PUBLISHED", 0, 5, "book"],
    ["Code review guidelines", "POLICY", "PUBLISHED", 1, 0, "shield"],
    ["Branching and releases", "PROCEDURE", "PUBLISHED", 1, 0, "list"],
    ["Security baseline", "POLICY", "PUBLISHED", 1, 0, "shield"],
    ["Architecture decisions", "GENERAL", "PUBLISHED", 0, 12, "flag"],
    ["Meeting notes", "GENERAL", "PUBLISHED", 0, 38, "calendar"],
    ["Drafts", "GENERAL", "DRAFT", 0, 2, "edit"],
  ];
  const pg = (t, on) => '<div class="tr-row' + (on ? " on" : "") + '"><span class="ch">' + I("down", 12) + '</span><span class="em">' + I("file", 14) + '</span><span class="t">' + t + "</span></div>";
  /* @impl PageTree: lazy, one level per request (GET /docs/spaces/:id/pages?parent=), drag to reorder (PATCH sort_order, parent_page_id; path and depth are maintained by the server), keyboard: arrows expand/collapse,
       Enter opens, Alt+Up/Down reorders. A page the caller cannot read is omitted together with its subtree unless a child grants access (then shown as "Restricted page"). */
  function tree(active) {
    return TREE.map((r) => '<div class="tr-row' + (r[0] === active ? " on" : "") + '" style="padding-left:' + (8 + r[3] * 16) + 'px"><span class="ch">' + (r[4] ? I("down", 12) : "") + '</span><span class="em">' + I(r[5] || pico(r[1]), 14) + '</span><span class="t">' + r[0] + "</span>" + (r[2] === "NEEDS_REVIEW" ? '<span class="badge red" title="WikiPageStatus NEEDS_REVIEW">Review</span>' : r[2] === "DRAFT" ? '<span class="badge yellow" title="WikiPageStatus DRAFT">Draft</span>' : "") + "</div>").join("");
  }
  const sideTree = (active, space) => '<div class="dk-side"><div class="dk-h">' + I("star", 12) + " Favorites</div>" +
    '<div class="tr-row"><span class="em">' + I("zap", 14) + '</span><span class="t">Production deploy runbook</span></div><div class="tr-row"><span class="em">' + I("shield", 14) + '</span><span class="t">Security baseline</span></div>' +
    '<div class="dk-h">' + I("layers", 12) + " " + (space || "Engineering") + '<span class="r">' + btn("", "plus", "ghost sm icon") + "</span></div>" + tree(active) +
    '<div class="dk-h">' + I("time", 12) + ' Recent</div><div class="tr-row"><span class="em">' + I("file", 14) + '</span><span class="t">Expense policy</span></div><div class="tr-row"><span class="em">' + I("file", 14) + '</span><span class="t">Brand voice guide</span></div></div>';

  /* =====================================================================================================================
     DOCS HOME (spec §2, §3, §7)
     @route  /docs
     @perm   VIEW docs.pages.read (lists only pages the caller may read) · New page docs.pages.create · New space docs.spaces.manage
     @api    GET /docs/home (favorites, recent, needs-my-review, required reading, spaces) · GET /docs/pages?filter=
     @mcp    docs_pages_read · docs_pages_search
     @data   WikiSpace · WikiPage (status, next_review_at, requires_acknowledgement, owner_membership_id, last_edited_at) · WikiPageFavorite (membership_id, sort_order) · WikiPageAcknowledgement (membership_id, acknowledged_at)
             · WikiPageReviewer · WikiChecklistRun (subject_membership_id = me)
     @ui     Card, Table, Badge, Avatar, Command trigger (search), Tabs for Recent | Created by me | Shared with me
     @states loading skeleton · empty ("No spaces yet" + create space for docs.spaces.manage holders) · error · no-access
     @audit  none for reads
     @note   "Recent" = pages the member opened or edited most recently.
     @gap    There is no per-member page view log, so "Recent" cannot be backed today; see gaps-15.md (WikiPageView).
     ===================================================================================================================== */
  function home() {
    const rec = [["Production deploy runbook", "Engineering", "RUNBOOK", "PUBLISHED", "Edited 2 h ago by Marco Silva"], ["Expense policy", "Operations", "POLICY", "PUBLISHED", "Viewed yesterday"], ["Brand voice guide", "Company handbook", "HANDBOOK_CHAPTER", "PUBLISHED", "Viewed Nov 9"], ["Sprint 14 retro notes", "Engineering", "MEETING_NOTES", "DRAFT", "Edited Nov 8 by you"], ["Q4 sales kickoff", "Sales playbook", "MEETING_NOTES", "PUBLISHED", "Viewed Nov 7"]];
    return '<div class="a-page">' + head("Docs", "Company knowledge: how the business works, written once.", btn("Import", "inbox") + btn("New page", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Published pages", 431, "across 7 spaces") + stat("Needs review", 9, "overdue by cadence", 1) + stat("Required reading", "3 open", "you must acknowledge") + stat("My onboarding", "62%", "checklist run") + stat("AI answers", 128, "last 30 days") + "</div>" +
      '<div class="toolbar">' + search("Search pages, forms and linked records  (Ctrl+K)") + sel("All spaces", "layers") + sel("Any type", "file") + btn("Ask AI", "sparkles") + "</div>" +
      '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div>' +
      '<div class="tabset">' + tabs([["r", "Recent"], ["m", "Created by me", 14], ["s", "Shared with me", 6]], "r") +
      pane("r", 1, '<div class="panel" style="margin-top:0">' + rec.map((r) => '<div class="rowx">' + I(pico(r[2]), 16) + '<div class="grow"><b>' + r[0] + "</b><small>" + r[1] + " · " + r[4] + "</small></div>" + ptp(r[2]) + pst(r[3]) + "</div>").join("") + "</div>") +
      pane("m", 0, tbl(["Page", "Space", "Status", "Edited"], [[ink("Sprint 14 retro notes"), "Engineering", pst("DRAFT"), "Nov 8"], [ink("Hotfix process"), "Engineering", pst("PUBLISHED"), "Nov 2"]])) +
      pane("s", 0, tbl(["Page", "Space", "Your access", "Shared by"], [[ink("Client NDA checklist"), "Sales playbook", E("COMMENT", "blue"), "Jonas Koch"], [ink("Berlin office rules"), "Berlin office", E("VIEW"), "Kim Lund"]])) + "</div>" +
      gap() + cd("<b>Needs your attention</b><span class='r muted'>WikiPage.status NEEDS_REVIEW and unacknowledged required reading</span>",
        [["Database failover runbook", "Review overdue by 12 days · you are a reviewer", "NEEDS_REVIEW"], ["Security baseline", "Required reading: version 4 changed since you acknowledged v3", "PUBLISHED"], ["Remote work policy", "Required reading due Nov 15", "PUBLISHED"]].map((r) => '<div class="rowx"><div class="grow"><b>' + r[0] + "</b><small>" + r[1] + "</small></div>" + pst(r[2]) + btn(r[2] === "NEEDS_REVIEW" ? "Review" : "Read and acknowledge", "", "sm") + "</div>").join(""), 1) +
      "</div><div>" +
      cd("<b>Favorites</b><span class='r muted'>WikiPageFavorite</span>", [["Production deploy runbook", "Engineering"], ["Security baseline", "Engineering"], ["Expense policy", "Operations"], ["Client NDA checklist", "Sales playbook"]].map((r) => '<div class="rowx">' + I("star", 14) + '<div class="grow"><b>' + r[0] + "</b><small>" + r[1] + "</small></div></div>").join(""), 1) + gap() +
      cd("<b>Spaces</b><span class='r'>" + btn("All spaces", "", "sm") + "</span>", SP.filter((s) => !s[10]).slice(0, 5).map((s) => '<div class="rowx">' + I(s[8], 14) + '<div class="grow"><b>' + s[0] + "</b><small>" + s[5] + " pages</small></div></div>").join(""), 1) + gap() +
      cd("<b>My onboarding</b><span class='r muted'>WikiChecklistRun</span>", '<div class="rowx"><div class="ring" style="--p:62%"><span>62%</span></div><div class="grow"><b>Engineer onboarding</b><small>8 of 13 items done · due Nov 21</small></div>' + btn("Open", "", "sm") + "</div>", 1) +
      "</div></div>" +
      dm(["WikiSpace · name, slug, kind, default_visibility, archived_at", "WikiPage · title, page_type, status, next_review_at, requires_acknowledgement, last_edited_at, owner_membership_id", "WikiPageFavorite · membership_id, sort_order", "WikiPageAcknowledgement · membership_id, acknowledged_version_number", "WikiChecklistRun · progress_percent, due_at"], ["Recent pages: no per-member view log (WikiPageView)"]) + "</div>";
  }

  /* =====================================================================================================================
     SPACES LIST (spec §2)
     @route  /docs/spaces?kind=&q=&archived=
     @perm   VIEW docs.pages.read (only spaces with a readable page or membership) · create / edit / archive docs.spaces.manage
     @api    GET /docs/spaces?kind=&q=&archived= · PATCH /docs/spaces/:id {archived_at} · POST /docs/spaces/:id/duplicate
     @mcp    docs_spaces_read · docs_spaces_manage
     @data   WikiSpace (name, slug, description, icon, color, kind, team_id, branch_id, department_id, project_id, owner_membership_id, default_visibility, is_private, sort_order, archived_at) · WikiSpaceMember (count) · WikiPage (count)
     @ui     Card grid + Table toggle (ToggleGroup), Tabs by kind, filter bar, DropdownMenu per row
     @states loading skeleton cards · empty ("No spaces yet") · error · no-access
     @audit  space created, renamed, archived, visibility changed
     @note   Exactly one of team_id / branch_id / department_id / project_id is normally set, matching kind (TOPIC has none). A PROJECT space is created from the project workspace (05) and its runbook page is
             Project.runbook_page_id. is_private hides the space from non-members completely (name too).
     ===================================================================================================================== */
  function spaces() {
    return '<div class="a-page">' + head("Spaces", "A space groups pages per department, team, branch, project or topic.", btn("Import", "inbox") + btn("New space", "plus", "primary")) +
      '<div class="toolbar">' + search("Search spaces") + sel("Card view", "grid") + sel("Sort: Order", "sort") + "</div>" +
      filt([["Kind", "is any of", "Department, Team"], ["Archived", "is", "No"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="sp-grid">' + SP.map((s) => '<div class="sp-card"><div class="top"><span class="sp-ic ' + s[9] + '">' + I(s[8], 18) + "</span><div><b>" + s[0] + "</b><small>/" + s[1] + "</small></div><span style='margin-left:auto'>" + more + "</span></div>" +
        '<div class="meta">' + E(s[2], "blue") + E(s[4]) + (s[10] ? E("ARCHIVED") : "") + "</div><div class='muted'>" + s[3] + '</div><div class="meta"><span>' + I("file", 12) + " " + s[5] + " pages</span><span>" + I("users", 12) + " " + s[6] + " members</span><span>Owner " + PEOPLE[s[7]][0] + "</span></div></div>").join("") + "</div>" +
      gap() + cd("<b>Table view</b><span class='r muted'>same data, sortable</span>", "<table>" + th(["Space", "Kind", "Scope", "Default visibility", ">Pages", ">Members", "Owner", "Private", ""]) + "<tbody>" + SP.map((s) => "<tr><td>" + ink(s[0]) + "</td><td>" + E(s[2], "blue") + "</td><td>" + s[3].replace(/^[A-Za-z]+: ?/, "") + "</td><td>" + E(s[4]) + "</td><td class='num'>" + s[5] + "</td><td class='num'>" + s[6] + "</td><td>" + wh(s[7]) + "</td><td>" + sw(s[4] === "MEMBERS") + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table>", 1) +
      pager("1–8 of 8") +
      dm(["WikiSpace · name, slug, kind, team_id, branch_id, department_id, project_id, owner_membership_id, default_visibility, is_private, sort_order, archived_at", "WikiSpaceMember · count per space", "WikiPage · count per space"], []) + "</div>";
  }

  /* =====================================================================================================================
     CREATE SPACE — full page (spec §2, §8)
     @route  /docs/spaces/new?kind=&project=
     @perm   docs.spaces.manage
     @api    POST /docs/spaces {name, slug, description, icon, color, kind, team_id|branch_id|department_id|project_id, owner_membership_id, default_visibility, is_private, members[{membership_id, level}], template_ids[]}
     @mcp    docs_spaces_manage
     @data   WikiSpace · WikiSpaceMember (initial members) · WikiPageTemplate (starter pages copied into the space)
     @ui     Form: Input, Textarea, Select, Popover+Command for team/department/branch/project/member pickers, ColorPicker, Switch, RadioGroup for visibility
     @states validation (slug unique per organization) · saving · saved (opens the space) · permission error
     @audit  space created with its members
     @note   Choosing a KIND reveals exactly one scope picker (department, team, branch or project); TOPIC reveals none. The default visibility of new pages follows default_visibility; ROLE and MEMBERS visibility
             enumerates principals through WikiPagePermission on each page. Starter pages are copies of selected templates (WikiPageTemplate), they never stay linked.
     ===================================================================================================================== */
  function spaceNew() {
    return '<div class="a-page">' + head("New space", "Spaces own pages, templates and access defaults.", btn("Cancel") + btn("Create space", "plus", "primary")) +
      '<div class="g2" style="grid-template-columns:1.6fr 1fr;align-items:start"><div>' +
      cd("<b>Identity</b>", f("Name", box("Engineering")) + f("URL slug", box("engineering"), "WikiSpace.slug, unique per organization. Used in /docs/s/engineering.") + f("Description", '<div class="editor"><div class="ed-body">What this space is for and who should use it.</div></div>') + row2(f("Icon", sel("Pick icon", "layers")), f("Colour", sel("Blue")))) + gap() +
      cd("<b>Kind and scope</b>", f("Kind", '<div class="rowx" style="gap:8px;padding:0">' + ["DEPARTMENT", "TEAM", "BRANCH", "PROJECT", "TOPIC"].map((t, i) => '<span class="seg' + (i === 0 ? " on" : "") + '" title="WikiSpaceKind ' + t + '">' + U.en(t) + "</span>").join("") + "</div>", "Department, team, branch or project spaces link to that record. Topic spaces have no owner scope.") + f("Department", sel("Engineering", "building"), "WikiSpace.department_id (Team of kind DEPARTMENT, 01). Replaced by Team, Branch or Project picker for the other kinds.") + f("Owner", sel("Marco Silva", "users"), "owner_membership_id: accountable for review cadence and space settings.")) + gap() +
      cd("<b>Members</b><span class='r'>" + btn("Add", "plus", "sm") + "</span>", [["MS", "MANAGE"], ["AM", "EDIT"], ["SJ", "COMMENT"]].map((r) => '<div class="rowx">' + av(r[0]) + '<div class="grow"><b>' + PEOPLE[r[0]][0] + "</b></div>" + sel(U.en(r[1])) + more + "</div>").join("") + '<div class="sub-note" style="padding:8px 16px">WikiSpaceMember.level: VIEW, COMMENT, EDIT, MANAGE. Add a team or department to add all its members as VIEW.</div>', 1) +
      "</div><div>" +
      cd("<b>Access defaults</b>", f("Default page visibility", sel("Organization", "globe"), "WikiVisibility: ORGANIZATION, BRANCH, TEAM, ROLE, MEMBERS. Applied to new pages, changeable per page.") + '<div class="rowx"><div class="grow"><b>Private space</b><small>Hidden from everyone who is not a member (is_private)</small></div>' + sw(0) + "</div>" + '<div class="rowx"><div class="grow"><b>Allow customer-visible pages</b><small>Pages may be flagged customer_visible (07, 13)</small></div>' + sw(0) + "</div>") + gap() +
      cd("<b>Starter pages</b><span class='r muted'>WikiPageTemplate</span>", ["Space home", "Handbook chapter", "Runbook", "Meeting notes"].map((t, i) => '<div class="rowx">' + cb(i < 2) + '<div class="grow">' + t + "</div></div>").join(""), 1) + gap() +
      callout("shield", "<b>Permission check</b> You need docs.spaces.manage to create a space. Creating a PROJECT space also needs projects.projects.update on that project (05).") +
      "</div></div>" +
      dm(["WikiSpace · every column written on create", "WikiSpaceMember · space_id, membership_id, level", "WikiPageTemplate · starter pages (copied)", "Team (department/team) · Branch · Project · Membership (read-only pickers)"], ["'Allow customer-visible pages' per space: no WikiSpace column (gaps-15.md #7)"]) + "</div>";
  }

  /* =====================================================================================================================
     SPACE OVERVIEW — page tree + page table (spec §2)
     @route  /docs/s/:spaceSlug · /docs/s/:spaceSlug/pages?status=&type=&owner=
     @perm   VIEW docs.pages.read · New page docs.pages.create · reorder docs.pages.update · space settings docs.spaces.manage
     @api    GET /docs/spaces/:id · GET /docs/spaces/:id/pages?status=&page_type=&owner=&review=&cursor= · PATCH /docs/pages/:id {parent_page_id, sort_order} · POST /docs/pages/bulk
     @mcp    docs_pages_read · docs_pages_update
     @data   WikiSpace · WikiPage (title, slug, icon, page_type, status, parent_page_id, path, depth, sort_order, owner_membership_id, next_review_at, word_count, last_edited_at, visibility, customer_visible) · WikiPageFavorite
     @ui     Tree (ARIA treeview) + Table with column chooser, filter bar, multi-select with bulk bar (move, change owner, set review interval, archive), DropdownMenu
     @states loading · empty ("This space has no pages. Start from a template") · error · no-access (404 for private spaces)
     @audit  page moved, archived (bulk writes one event per page)
     @note   Moving a page rewrites path and depth of its subtree in one transaction. Bulk archive needs docs.pages.archive.
     ===================================================================================================================== */
  function space() {
    const rows = [["Production deploy runbook", "RUNBOOK", "PUBLISHED", "MS", "Nov 11", "Mar 11", 1, "ORGANIZATION", 1240], ["Database failover runbook", "RUNBOOK", "NEEDS_REVIEW", "JK", "Aug 2", "Overdue", 0, "TEAM", 860], ["Incident response", "PROCEDURE", "PUBLISHED", "MS", "Oct 20", "Apr 20", 1, "ORGANIZATION", 1530], ["Code review guidelines", "POLICY", "PUBLISHED", "AM", "Sep 14", "Dec 14", 1, "ORGANIZATION", 720], ["Security baseline", "POLICY", "PUBLISHED", "KL", "Nov 3", "May 3", 1, "ORGANIZATION", 2010], ["Branching and releases", "PROCEDURE", "DRAFT", "MS", "Nov 9", "None", 0, "TEAM", 480]];
    return '<div class="a-page">' + head("Engineering", "Space · Department: Engineering · 86 pages · 24 members", btn("Space settings", "settings") + btn("Templates", "file") + btn("New page", "plus", "primary")) +
      '<div class="dk-2">' + sideTree("") + '<div class="dk-main">' +
      '<div class="toolbar">' + search("Search in this space") + sel("Table", "grid") + sel("Sort: Edited ↓", "sort") + sel("Columns (8)", "settings") + sel("View: Needs review", "star") + "</div>" +
      filt([["Status", "is any of", "Published, Draft, Needs review"], ["Type", "is any of", "Runbook, Policy, Procedure"], ["Owner", "is", "Anyone"], ["Review due", "before", "Dec 31"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="bulk"><span class="cb on"></span><b>2 selected</b><span class="muted">bulk bar appears on selection</span><span style="flex:1"></span>' + sel("Move to…", "folder") + sel("Owner…", "users") + sel("Review every…", "time") + btn("Archive", "archive", "sm") + "</div>" +
      '<div class="panel" style="margin-top:0"><table>' + th(["", "Page", "Type", "Status", "Owner", ">Words", "Edited", "Next review", "Visibility", "Ack", ""]) + "<tbody>" + rows.map((r, i) => "<tr><td>" + cb(i < 2) + "</td><td>" + I(pico(r[1]), 14) + " " + ink(r[0]) + "</td><td>" + ptp(r[1]) + "</td><td>" + pst(r[2]) + "</td><td>" + wh(r[3]) + "</td><td class='num'>" + r[8] + "</td><td>" + r[4] + "</td><td>" + (r[5] === "Overdue" ? '<span class="badge red">Overdue</span>' : r[5]) + "</td><td>" + E(r[7]) + "</td><td>" + cb(r[6]) + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div>" +
      pager("1–6 of 86") + "</div></div>" +
      dm(["WikiPage · title, page_type, status, parent_page_id, path, depth, sort_order, owner_membership_id, next_review_at, word_count, last_edited_at, visibility, requires_acknowledgement", "SavedView · entity_type WIKI_PAGE (filters, sorting, columns)", "WikiSpace · name, kind, member count"], []) + "</div>";
  }

  /* =====================================================================================================================
     SPACE SETTINGS & PERMISSIONS (spec §2, §8)
     @route  /docs/s/:spaceSlug/settings?tab=general|members|permissions|templates|danger
     @perm   docs.spaces.manage (space MANAGE level members may edit members of that space)
     @api    PATCH /docs/spaces/:id · GET/POST/PATCH/DELETE /docs/spaces/:id/members · POST /docs/spaces/:id/archive · DELETE /docs/spaces/:id (docs.pages.delete*)
     @mcp    docs_spaces_manage
     @data   WikiSpace (all columns) · WikiSpaceMember (membership_id, level, added_by_user_id) · WikiPageTemplate (space_id) · WikiPage (visibility counts)
     @ui     Tabs, Form, Table with Select level per member, Popover+Command member picker, AlertDialog for archive/delete
     @states loading · saving · error · no-access
     @audit  visibility changed, member added/removed/level changed, archived, deleted
     @note   Effective access = max(space membership level, page grants) narrowed by branch/team scope. "Preview as member" shows exactly what a given member sees (server evaluates the same rule). Archiving a space
             archives its pages (archived_at) and keeps versions. A space with pages cannot be deleted without choosing to archive or move them.
     ===================================================================================================================== */
  function spaceSettings() {
    const mem = [["MS", "MANAGE", "Space owner"], ["AM", "EDIT", "Added Oct 3"], ["JK", "EDIT", "Added Oct 3"], ["SJ", "COMMENT", "Added Nov 1"], ["KL", "VIEW", "Added Nov 4"]];
    return '<div class="a-page">' + head("Engineering · settings", "Details, members and access for the space.", btn("Preview as member", "users") + btn("Save changes", "check", "primary")) +
      '<div class="tabset">' + tabs([["g", "General"], ["m", "Members", 24], ["p", "Permissions"], ["t", "Templates", 4], ["d", "Danger zone"]], "g") +
      pane("g", 1, '<div class="g2" style="align-items:start">' + cd("<b>Details</b>", f("Name", box("Engineering")) + f("Slug", box("engineering")) + f("Description", box("Engineering runbooks, standards and decisions.")) + row2(f("Icon", sel("Layers", "layers")), f("Colour", sel("Blue"))) + f("Owner", sel("Marco Silva", "users"))) +
        cd("<b>Scope</b>", f("Kind", sel("Department")) + f("Department", sel("Engineering", "building")) + f("Team", sel("—", "users")) + f("Branch", sel("—", "building")) + f("Project", sel("—", "folder"), "Exactly one scope field is set, matching the kind.")) + "</div>") +
      pane("m", 0, '<div class="toolbar">' + search("Find member") + sel("Level: any") + btn("Add member or team", "plus", "primary") + "</div>" + cd("<b>Members</b><span class='r muted'>WikiSpaceMember</span>", mem.map((r) => '<div class="rowx">' + av(r[0]) + '<div class="grow"><b>' + PEOPLE[r[0]][0] + "</b><small>" + r[2] + "</small></div>" + sel(U.en(r[1])) + more + "</div>").join("") + '<div class="rowx"><div class="grow muted">+ 19 more members through Team: Engineering</div></div>', 1)) +
      pane("p", 0, '<div class="g2" style="align-items:start">' + cd("<b>Default visibility</b>", f("New pages are visible to", sel("Organization", "globe")) + '<div class="rowx"><div class="grow"><b>Private space</b><small>is_private: hidden from non-members</small></div>' + sw(0) + "</div>" + '<div class="rowx"><div class="grow"><b>Members may publish</b><small>Otherwise only holders of docs.pages.publish publish</small></div>' + sw(1) + "</div>" + '<div class="rowx"><div class="grow"><b>Require review before publish</b><small>A reviewer must approve changes</small></div>' + sw(0) + "</div>") +
        cd("<b>Level matrix</b>", tbl(["Level", "Read", "Comment", "Edit", "Share and delete"], [["VIEW", "Yes", "No", "No", "No"], ["COMMENT", "Yes", "Yes", "No", "No"], ["EDIT", "Yes", "Yes", "Yes", "No"], ["MANAGE", "Yes", "Yes", "Yes", "Yes"]]).replace('class="panel"', 'class="panel" data-flush="1"')) + "</div>" + gap() + callout("shield", "Space levels combine with the global keys: a member with EDIT here but without docs.pages.update at the organization level cannot edit. The stricter of the two wins.")) +
      pane("t", 0, tbl(["Template", "Type", "Review cycle", "Used", ""], [[ink("Runbook"), ptp("RUNBOOK"), "180 days", 14, more], [ink("Incident postmortem"), ptp("PROCEDURE"), "None", 9, more], [ink("Architecture decision"), ptp("DECISION_RECORD"), "None", 21, more], [ink("Sprint retro"), ptp("MEETING_NOTES"), "None", 28, more]])) +
      pane("d", 0, cd("<b>Archive space</b>", '<div class="rowx"><div class="grow"><b>Archive Engineering</b><small>Hides the space and its 86 pages. Versions and audit stay. Reversible.</small></div>' + btn("Archive", "archive") + "</div>" + '<div class="rowx"><div class="grow"><b>Delete space</b><small>Permanent. Needs docs.pages.delete (sensitive) and typing the space name.</small></div>' + btn("Delete", "x") + "</div>", 1)) + "</div>" +
      dm(["WikiSpace · name, slug, description, icon, color, kind, scope ids, owner_membership_id, default_visibility, is_private, archived_at", "WikiSpaceMember · membership_id, level, added_by_user_id", "WikiPageTemplate · space_id"], ["Members may publish / Require review before publish: no WikiSpace columns (gaps-15.md #8)"]) + "</div>";
  }

  /* =====================================================================================================================
     PAGE — view and block editor (spec §2, §3, §4, §6)
     @route  /docs/p/:pageSlug?v=<version>&comment=<id> (one URL for read and edit; Edit toggles in place)
     @perm   VIEW docs.pages.read + level VIEW · comment level COMMENT · edit docs.pages.update + level EDIT · publish docs.pages.publish · archive docs.pages.archive · delete docs.pages.delete* · share level MANAGE
     @api    GET /docs/pages/:id · PATCH /docs/pages/:id {title, icon, content, page_type, owner_membership_id, review_interval_days, visibility, customer_visible, requires_acknowledgement, reviewer_ids[]} (autosave, debounced 800 ms,
             If-Match on current_version_number) · POST /docs/pages/:id/publish {change_summary} · POST /docs/pages/:id/lock · POST/PATCH/DELETE /docs/pages/:id/comments · POST /docs/pages/:id/links · POST /docs/pages/:id/attachments {document_id}
             · POST /docs/pages/:id/favorite · POST /docs/pages/:id/review (mark reviewed) · POST /docs/pages/:id/acknowledge
     @mcp    docs_pages_read · docs_pages_update · docs_pages_publish · docs_comments_create
     @data   WikiPage (all columns) · WikiPageVersion · WikiPageComment (block_id, mentions[], resolved_at) · WikiPageLink (entity_type, entity_id, label, block_id) · WikiPageAttachment (document_id, block_id) · WikiPageReviewer
             · WikiPageFavorite · WikiPageAcknowledgement · WikiPagePermission · Project.runbook_page_id (05) · custom fields (WIKI_PAGE) · taggings (tags)
     @ui     Block editor (Tiptap/ProseMirror) with drag handles, "/" slash menu (Popover+Command), floating format toolbar, "@" mention Command (members, pages, records), "#" record link; right panel Tabs (Details, Comments,
             Links, Access); DropdownMenu for the page menu; Dialog for publish; Tooltip on every icon button
     @states loading skeleton · not found · error · no-access (a page the caller cannot read answers 404, not 403, to avoid revealing titles) · offline (edits queue and sync, version conflict dialog) · locked by another editor
             · read-only (viewer) · stale warning banner (stale_flagged_at) · "newer published version" banner when the reader is on an old version
     @audit  page created/updated (debounced into one event per editing session), published, visibility changed, customer_visible changed, owner changed, locked/unlocked, archived, reviewed, acknowledged
     @note   content is a block tree Json: paragraph, heading, bulleted/numbered list, checklist, table, code, callout, quote, divider, toggle, image and file embeds (WikiPageAttachment, Documents 17), record link (WikiPageLink).
             Every autosave bumps current_version_number and writes a WikiPageVersion; the published snapshot stays what readers see until "Publish changes" (published_version_number). locked_by_membership_id gives a soft
             edit lock (concurrent edits are merged by CRDT in production, the lock is for approval-style pages). Embedded record links render a live card (title, status) and respect the viewer's access to that record.
             The AI assistant may draft a section from the slash menu, as a suggestion the editor accepts (WikiPageVersion.ai_suggestion_id) and ai_generated is set only when AI wrote most of the page.
     @gap    "Follow page" (notify on every update) has no table (gaps-15.md #6).
     ===================================================================================================================== */
  function blk(inner, o) { o = o || {}; return '<div class="blk' + (o.sel ? " sel" : "") + '"><span class="gut">' + I("plus", 13) + I("menu", 13) + "</span>" + inner + "</div>"; }
  function editorCanvas(showSlash) {
    return blk("<h2>1. Before you deploy</h2>") +
      blk('<div class="blk-call">' + I("flag", 16) + '<div><b>Deploys are frozen Friday 16:00 to Monday 08:00</b> unless the incident commander approves. Check <span class="lrec">' + I("calendar", 12) + ' Release calendar</span> first.</div></div>') +
      blk('<p>The on-call engineer <span class="mention">@Marco Silva</span> owns the deploy. Link the release record for the change: <span class="lrec">' + I("flag", 12) + ' Release 2026.11 website</span> and project <span class="lrec">' + I("folder", 12) + " Acme Rebrand Website</span>.</p>") +
      blk('<div class="blk-ck">' + cb(1) + "<span>CI is green on <b>main</b></span></div>") + blk('<div class="blk-ck">' + cb(1) + "<span>Release notes drafted</span></div>") + blk('<div class="blk-ck">' + cb(0) + '<span>Database migration reviewed by a second engineer <span class="anchor">(required for schema changes)</span></span></div>', { sel: 1 }) +
      (showSlash ? '<div class="fmt"><span>Turn into</span><span class="on"><b>B</b></span><span><i>I</i></span><span>Link</span><span>Code</span><span>' + I("chat", 13) + " Comment</span><span>" + I("sparkles", 13) + " AI</span></div>" : "") +
      blk("<h2>2. Run the deploy</h2>") +
      blk('<div class="blk-code">$ pnpm release:prepare --env production\n$ pnpm release:deploy --env production --wait\n$ pnpm release:verify --smoke</div>') +
      blk("<p>Expected output ends with <b>smoke tests passed</b>. If a health check fails, roll back with the command below and open an incident.</p>") +
      blk('<table><thead><tr><th>Check</th><th>Owner</th><th>Pass criteria</th></tr></thead><tbody><tr><td>API health</td><td>On-call</td><td>200 on /health for 5 minutes</td></tr><tr><td>Error rate</td><td>On-call</td><td>Below 0.5% after 10 minutes</td></tr><tr><td>Payments</td><td>Finance eng</td><td>Test charge succeeds</td></tr></tbody></table>') +
      blk('<div class="blk-emb"><span class="ic">' + I("file", 18) + '</span><div class="grow"><b>Rollback checklist.pdf</b><div class="muted">Document (17) · 2 pages · 184 KB</div></div>' + btn("Open", "", "sm") + "</div>") +
      blk('<div class="blk-img">Image block: architecture-overview.png (Document, 17)</div>') +
      blk('<div class="blk-toggle">' + I("down", 14) + " <b>Troubleshooting</b></div>") +
      (showSlash ? blk('<p>/dep<span class="cur"></span></p>') + '<div class="slash"><div class="q">Blocks matching "dep"</div>' +
        [["Heading", "H", "Section title"], ["Checklist", "☑", "Tick-off items"], ["Table", "▦", "Rows and columns"], ["Code block", "</>", "Monospaced snippet"], ["Callout", "!", "Highlighted note"], ["Image or file", "◫", "Embed a Document (17)"], ["Record link", "↗", "Project, customer, task, ticket"], ["AI draft", "✦", "Write with AI, you review"]].map((r, i) => '<div class="it' + (i === 4 ? " on" : "") + '"><span class="g">' + r[1] + "</span><div>" + r[0] + "<small>" + r[2] + "</small></div></div>").join("") + "</div>" : "");
  }
  function page() {
    return '<div class="a-page">' + head("Production deploy runbook", "Engineering · Runbooks · version 14 · published version 13", btn("Share", "send") + btn("History", "time") + btn("Edit", "edit") + btn("Publish changes", "check", "primary")) +
      '<div class="dk-3">' + sideTree("Production deploy runbook") + '<div class="dk-main">' +
      '<div class="dk-crumbs">' + I("layers", 12) + " <b>Engineering</b> / <b>Runbooks</b> / Production deploy runbook<span style='margin-left:auto;display:flex;gap:6px'>" + btn("", "star", "ghost sm icon") + btn("", "link", "ghost sm icon") + more + "</span></div>" +
      '<div class="lockbar">' + I("lock", 14) + " <span>Marco Silva is editing this page. Unpublished changes: version 14 differs from published version 13.</span>" + btn("View diff", "", "sm") + "</div>" +
      '<div class="dk-cover"></div><div class="dk-ico">' + I("zap", 26) + '</div><div class="dk-title">Production deploy runbook</div>' +
      '<div class="dk-props">' +
      '<div class="pr"><span>' + I("tag", 13) + " Type</span><div>" + ptp("RUNBOOK") + "</div></div>" +
      '<div class="pr"><span>' + I("check", 13) + " Status</span><div>" + pst("PUBLISHED") + '<span class="badge yellow">Unpublished changes</span></div></div>' +
      '<div class="pr"><span>' + I("users", 13) + " Owner</span><div>" + av("MS") + " Marco Silva</div></div>" +
      '<div class="pr"><span>' + I("pen", 13) + " Reviewers</span><div>" + av("JK") + av("AM") + '<span class="muted">review every 180 days</span></div></div>' +
      '<div class="pr"><span>' + I("calendar", 13) + " Next review</span><div>Mar 11, 2027 " + muted("last reviewed Sep 13 by Jonas Koch") + "</div></div>" +
      '<div class="pr"><span>' + I("globe", 13) + " Visibility</span><div>" + E("ORGANIZATION") + "</div></div>" +
      '<div class="pr"><span>' + I("folder", 13) + " Linked</span><div><span class='lrec'>Project: Acme Rebrand Website</span><span class='lrec'>Release 2026.11</span></div></div>" +
      '<div class="pr"><span>' + I("hash", 13) + " Tags</span><div>" + tok("deploy") + tok("production") + tok("on-call") + "</div></div>" +
      '<div class="pr"><span>' + I("shield", 13) + " Required reading</span><div>" + sw(1) + " " + muted("18 of 24 acknowledged") + "</div></div>" +
      "</div>" + editorCanvas(true) +
      '<div class="sub-note" style="margin-top:14px;padding-left:46px">Saved 2 s ago · 1,240 words · autosave writes WikiPageVersion 14 · Ctrl+S saves, Ctrl+Enter publishes</div>' +
      "</div>" +
      '<div class="dk-right"><div class="tabset tabs-in">' + tabs([["d", "Details"], ["c", "Comments", 3], ["l", "Links", 4], ["a", "Access"]], "c") +
      pane("d", 0, kv("Created", "Jun 2, 2026 by Marco Silva") + kv("Last edited", "Nov 11 by Marco Silva") + kv("Words", "1,240") + kv("Slug", "production-deploy-runbook") + kv("Parent", "Runbooks") + kv("Template", "Runbook") + kv("Customer visible", sw(0)) + kv("AI generated", "No") + kv("Indexed for AI", E("INDEXED", "green")) + kv("Help center", muted("not published (13)"))) +
      pane("c", 1, '<div class="cmt"><div class="h">' + av("AM") + '<b>Anna Meyer</b> · Nov 10 · on checklist item</div><div class="q">Database migration reviewed by a second engineer</div>Should this also apply to data backfills? <span class="mention">@Jonas Koch</span> what do you think?' +
        '<div class="rp"><div class="h">' + av("JK") + "<b>Jonas Koch</b> · Nov 10</div>Yes, backfills too. I will add a line.</div><div style='margin-top:6px'>" + btn("Reply", "reply", "sm") + btn("Resolve", "check", "sm") + "</div></div>" +
        '<div class="cmt"><div class="h">' + av("SJ") + "<b>Sofia Jensen</b> · Nov 9 · page comment</div>Add a link to the rollback checklist.<div style='margin-top:6px'>" + E("RESOLVED", "green") + "</div></div>" +
        '<div class="cmt done"><div class="h">' + av("KL") + "<b>Kim Lund</b> · Nov 5</div>Typo in the second command." + '<div style="margin-top:6px">' + E("RESOLVED", "green") + "</div></div>" +
        '<div style="padding:10px 12px"><div class="input-fake">Comment or @mention. Select text to anchor it to a block.</div><div class="rowx" style="padding:6px 0">' + sel("Page comment") + '<span style="flex:1"></span>' + btn("Comment", "", "primary sm") + "</div></div>") +
      pane("l", 0, '<div class="dk-h">Records (WikiPageLink)</div>' + [["PROJECT", "Acme Rebrand Website"], ["PROJECT_MILESTONE", "Launch Nov 28"], ["WIKI_PAGE", "Incident response"], ["DOCUMENT", "Rollback checklist.pdf"]].map((r) => '<div class="rowx">' + I("link", 13) + '<div class="grow"><b>' + r[1] + "</b><small>" + U.en(r[0]) + "</small></div>" + more + "</div>").join("") + '<div class="dk-h">Backlinks</div><div class="rowx"><div class="grow"><b>Engineering home</b><small>mentions this page</small></div></div><div class="rowx"><div class="grow"><b>Project Acme Rebrand Website</b><small>Project.runbook_page_id</small></div></div>') +
      pane("a", 0, '<div class="dk-h">Who can open</div><div class="rowx">' + I("globe", 14) + '<div class="grow"><b>Everyone in the organization</b><small>visibility ORGANIZATION (from the space)</small></div>' + sel("View") + '</div><div class="rowx">' + av("MS") + '<div class="grow"><b>Marco Silva</b><small>owner</small></div>' + E("MANAGE", "purple") + '</div><div class="rowx">' + I("users", 14) + '<div class="grow"><b>Team: Engineering</b><small>WikiPagePermission TEAM</small></div>' + sel("Edit") + "</div>" + '<div style="padding:10px 12px">' + btn("Manage sharing", "send", "sm") + "</div>") + "</div></div></div>" +
      '<div class="sub-note" style="margin-top:8px">Mock: the slash menu and the format toolbar are shown open for review; in the product they appear on "/" and on text selection.</div>' +
      dm(["WikiPage · title, icon, cover_document_id, page_type, status, content, visibility, customer_visible, owner_membership_id, review_interval_days, last_reviewed_at, next_review_at, requires_acknowledgement, current_version_number, published_version_number, locked_by_membership_id, ai_generated, word_count", "WikiPageComment · block_id, body, mentions, resolved_at, parent_comment_id", "WikiPageLink · entity_type, entity_id, label, block_id", "WikiPageAttachment · document_id (17)", "WikiPageReviewer · membership_id", "WikiPageFavorite", "Project.runbook_page_id (05) · taggings · custom fields (WIKI_PAGE)", "WikiAiIndexEntry · status (indexed flag)"], ["Follow page notifications: no table (gaps-15.md #6)"]) + "</div>";
  }

  /* =====================================================================================================================
     CREATE PAGE — full page (spec §2, §3)
     @route  /docs/p/new?space=&parent=&template=&type=&from=<entityType>:<id>
     @perm   docs.pages.create (+ EDIT level in the target space) · visibility beyond the space default needs MANAGE · customer_visible needs docs.pages.publish
     @api    POST /docs/pages {space_id, parent_page_id?, template_id?, title, page_type, icon?, content?, visibility, owner_membership_id, reviewer_ids[], review_interval_days?, requires_acknowledgement, customer_visible,
             permissions[{principal_type, principal_id, level}], links[{entity_type, entity_id}], tag_ids[], custom_fields{}, status: DRAFT|PUBLISHED}
     @mcp    docs_pages_create
     @data   WikiPage · WikiPageTemplate (content, default_review_interval_days, page_type) · WikiPageReviewer · WikiPagePermission · WikiPageLink · WikiPageVersion (version 1) · taggings · custom field values
     @ui     Template gallery (Card grid) + form: Input, Popover+Command for space/parent/owner/reviewers/links, Select for type and visibility, Switch, Textarea, "Create more" toggle
     @states validation (title, space) · saving · saved (opens the page in edit mode, toast with Undo) · permission error on a field (disabled with reason)
     @audit  page created (with template and source record)
     @note   Picking a template copies its content (never linked) and applies page_type and default_review_interval_days, but keeps anything the user already typed. "From record" prefills the title and a WikiPageLink
             from the source (a project runbook from the project workspace sets Project.runbook_page_id after save). slug is derived from the title and unique per space. Create as DRAFT unless the caller may publish.
     ===================================================================================================================== */
  function pageNew() {
    const tp = [["Blank page", "GENERAL"], ["Policy", "POLICY"], ["Procedure", "PROCEDURE"], ["Runbook", "RUNBOOK"], ["Meeting notes", "MEETING_NOTES"], ["Decision record", "DECISION_RECORD"], ["Handbook chapter", "HANDBOOK_CHAPTER"], ["Onboarding guide", "ONBOARDING_GUIDE"]];
    return '<div class="a-page">' + head("New page", "Start from a template or a blank page.", btn("Cancel") + btn("Save draft", "") + btn("Create page", "plus", "primary")) +
      '<div class="g2" style="grid-template-columns:1.7fr 1fr;align-items:start"><div>' +
      cd("<b>Template</b><span class='r'>" + btn("Browse all", "", "sm") + "</span>", '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">' + tp.map((t, i) => '<div class="tp-card" style="' + (i === 3 ? "border-color:var(--blue)" : "") + '"><div class="pv" style="height:64px"><i class="h"></i><i></i><i style="width:70%"></i></div><div class="bd"><b>' + t[0] + "</b><small>" + U.en(t[1]) + "</small></div></div>").join("") + "</div>") + gap() +
      cd("<b>Content</b>", f("Title", box("Staging deploy runbook")) + f("Body", '<div class="editor"><div class="ed-bar">' + ["B", "I", "H", "•", "1.", "☑", "</>", "▦", "/"].map((x) => "<span>" + x + "</span>").join("") + '</div><div class="ed-body">The Runbook template inserts: Purpose, Before you start (checklist), Steps (numbered), Verification, Rollback, Contacts. Type “/” for blocks, “@” to mention, “#” to link a record.</div></div>')) + gap() +
      cd("<b>Links to records</b><span class='r'>" + btn("Add", "plus", "sm") + "</span>", '<div class="rowx">' + I("folder", 14) + '<div class="grow"><b>Acme Rebrand Website</b><small>Project (05) · becomes Project.runbook_page_id when type is Runbook</small></div>' + more + "</div>", 1) +
      "</div><div>" +
      cd("<b>Placement</b>", f("Space", sel("Engineering", "layers")) + f("Parent page", sel("Runbooks", "file")) + f("Page type", sel("Runbook", "tag"), "WikiPageType: " + ["GENERAL", "POLICY", "PROCEDURE", "RUNBOOK", "MEETING_NOTES", "DECISION_RECORD", "HANDBOOK_CHAPTER", "ONBOARDING_GUIDE", "OFFBOARDING_GUIDE", "FAQ"].join(", ") + ".") + f("Icon", sel("Bolt", "zap"))) + gap() +
      cd("<b>Ownership and review</b>", f("Owner", sel("Marco Silva", "users")) + f("Reviewers", sel("Add reviewers…", "users")) + f("Review every (days)", box("180"), "Template default 180. Empty = no review cadence (no stale detection).") + '<div class="rowx"><div class="grow"><b>Required reading</b><small>Members must acknowledge (requires_acknowledgement)</small></div>' + sw(0) + "</div>") + gap() +
      cd("<b>Visibility</b>", f("Who can read", sel("Same as space: Organization", "globe")) + '<div class="rowx"><div class="grow"><b>Customer visible</b><small>Exposed to the portal (07) and publishable to the help center (13)</small></div>' + sw(0) + "</div>" + f("Tags", sel("Add tags…", "tag")) + f("Custom fields", sel("Add property…", "settings"), "From custom_field_definitions for WIKI_PAGE (02).")) + gap() +
      '<div class="rowx"><div class="grow"><b>Create more</b><small>Keep the space, parent and template</small></div>' + sw(0) + "</div>" +
      "</div></div>" +
      dm(["WikiPage · every column written on create (space_id, parent_page_id, template_id, title, slug, page_type, status, content, visibility, owner_membership_id, review_interval_days, requires_acknowledgement, customer_visible)", "WikiPageTemplate · content, page_type, default_review_interval_days", "WikiPageReviewer · WikiPagePermission · WikiPageLink · WikiPageVersion (v1)", "taggings · custom_field_definitions (WIKI_PAGE)"], []) + "</div>";
  }

  /* =====================================================================================================================
     VERSION HISTORY (spec §2)
     @route  /docs/p/:pageSlug/history?version=&compare=
     @perm   VIEW docs.pages.read · restore docs.pages.update · publish a version docs.pages.publish
     @api    GET /docs/pages/:id/versions · GET /docs/pages/:id/versions/:n · GET /docs/pages/:id/diff?from=&to= · POST /docs/pages/:id/versions/:n/restore {change_summary}
     @mcp    docs_pages_read · docs_pages_update (restore)
     @data   WikiPageVersion (version_number, title, content, content_markdown, change_summary, is_published_snapshot, restored_from_version_id, ai_suggestion_id, created_by_membership_id, created_at) · WikiPage (published_version_number)
     @ui     Two-pane: version list (Table) + diff (block-level, word diff), Select to pick the compared version, AlertDialog for restore
     @states loading · no earlier versions · error · no-access
     @audit  page restored (version number and source version)
     @note   Versions are immutable. Restoring creates a NEW version (restored_from_version_id) and never rewrites history. Autosaves within one editing session are collapsed into one listed version by the UI
             (is_published_snapshot marks versions that were published). A version written from an accepted AI suggestion shows the AI badge (ai_suggestion_id).
     ===================================================================================================================== */
  function history() {
    const v = [[14, "Marco Silva", "Today 10:42", "Added migration review checklist item", 0, 0], [13, "Marco Silva", "Nov 3", "Published: updated smoke test commands", 1, 0], [12, "AI assistant", "Oct 28", "Accepted AI suggestion: rollback section", 0, 1], [11, "Jonas Koch", "Oct 14", "Fixed typo in command", 0, 0], [10, "Marco Silva", "Sep 13", "Published: review cycle", 1, 0], [9, "Marco Silva", "Sep 12", "Restored from version 6", 0, 0]];
    return '<div class="a-page">' + head("Version history", "Production deploy runbook · 14 versions · published version 13", btn("Back to page", "file") + btn("Restore version 13", "reply", "primary")) +
      '<div class="g2" style="grid-template-columns:1fr 1.5fr;align-items:start">' + cd("<b>Versions</b><span class='r muted'>WikiPageVersion</span>", v.map((r, i) => '<div class="rowx" style="' + (i === 1 ? "background:var(--blue-soft)" : "") + '">' + cb(i < 2) + '<div class="grow"><b>Version ' + r[0] + (r[4] ? " " + E("PUBLISHED", "green") : "") + (r[5] ? ' <span class="cite">' + I("sparkles", 11) + " AI</span>" : "") + "</b><small>" + r[1] + " · " + r[2] + " · " + r[3] + "</small></div>" + more + "</div>").join("") + '<div class="rowx"><button class="btn sm ghost">Load older versions</button></div>', 1) +
      cd("<b>Changes: version 13 to version 14</b><span class='r'>" + sel("Compare with…") + btn("Side by side", "", "sm") + "</span>", '<div class="diff"><div class="hd">Block 12 · checklist</div><div>CI is green on main</div><div>Release notes drafted</div><div class="add">+ Database migration reviewed by a second engineer (required for schema changes)</div><div class="hd">Block 18 · paragraph</div><div class="del">Expected output ends with all tests passed.</div><div class="add">+ Expected output ends with smoke tests passed.</div><div class="hd">Block 21 · table</div><div class="add">+ Row added: Payments | Finance eng | Test charge succeeds</div></div>' + '<div class="sub-note" style="margin-top:8px">3 blocks changed · +2 −1 · title unchanged · change_summary "Added migration review checklist item"</div>' + callout("flag", "Restoring creates <b>version 15</b> with the content of version 13. Nothing is deleted. Readers keep seeing the published version until you publish.")) + "</div>" +
      dm(["WikiPageVersion · version_number, title, content, change_summary, is_published_snapshot, restored_from_version_id, ai_suggestion_id, created_by_membership_id, created_at", "WikiPage · current_version_number, published_version_number"], []) + "</div>";
  }

  /* =====================================================================================================================
     SHARE AND PERMISSIONS OF A PAGE (spec §2, §8) — Dialog opened by Share, also a full page for deep links
     @route  /docs/p/:pageSlug/share
     @perm   level MANAGE on the page (or docs.spaces.manage) · customer_visible and visibility changes are audited · docs.pages.publish for customer_visible
     @api    GET /docs/pages/:id/permissions · PUT /docs/pages/:id/permissions {visibility, grants[{principal_type, principal_id, level, inherit}]} · PATCH /docs/pages/:id {customer_visible} · POST /docs/pages/:id/permissions/preview {membership_id}
     @mcp    docs_pages_update (permissions are part of the page update, MANAGE level checked server-side)
     @data   WikiPage (visibility, customer_visible) · WikiPagePermission (principal_type, principal_id, level, inherit, granted_by_user_id) · WikiSpaceMember (inherited, read-only here) · Membership/Team/Branch/Role/Team(DEPARTMENT) pickers
     @ui     Dialog/Sheet with Popover+Command principal picker (members, teams, departments, branches, roles), Select per row for level, Switch for inherit, Tabs (People | Visibility)
     @states loading · saving · error · no-access · "You cannot reduce your own access below MANAGE" validation
     @audit  visibility changed, grant added/changed/removed, customer_visible changed (who, from, to)
     @note   inherit = the grant also applies to child pages. Space members appear as inherited rows and cannot be removed here. The BRANCH / TEAM / ROLE / MEMBERS visibility values enumerate their principals through
             WikiPagePermission rows. External sharing links are NOT part of the module: customers see content only through customer_visible (07, 13).
     ===================================================================================================================== */
  function share() {
    return '<div class="a-page">' + head("Share · Production deploy runbook", "Control who can read, comment, edit and manage this page.", btn("Preview as member", "users") + btn("Done", "check", "primary")) +
      '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div>' +
      cd("<b>Visibility</b><span class='r muted'>WikiPage.visibility</span>", '<div style="padding:14px 16px">' + [["ORGANIZATION", "Everyone in the organization", "globe", 1], ["BRANCH", "Members of selected branches", "building", 0], ["TEAM", "Members of selected teams", "users", 0], ["ROLE", "Members with selected roles", "key", 0], ["MEMBERS", "Only people listed below", "lock", 0]].map((r) => '<div class="rowx" style="padding:6px 0"><span class="seg' + (r[3] ? " on" : "") + '">' + I(r[2], 12) + "</span><div class='grow'><b>" + U.en(r[0]) + "</b><small>" + r[1] + "</small></div></div>").join("") + "</div>") + gap() +
      cd("<b>People and groups</b><span class='r'>" + btn("Add", "plus", "sm") + "</span>", [["MS", "Marco Silva", "Owner", "MANAGE"], ["JK", "Jonas Koch", "Reviewer", "EDIT"]].map((r) => '<div class="rowx">' + av(r[0]) + '<div class="grow"><b>' + r[1] + "</b><small>" + r[2] + "</small></div>" + sel(U.en(r[3])) + more + "</div>").join("") +
        '<div class="rowx">' + I("users", 16) + '<div class="grow"><b>Team: Engineering</b><small>WikiPagePermission · TEAM · applies to child pages</small></div>' + sel("Edit") + sw(1) + more + "</div>" +
        '<div class="rowx">' + I("building", 16) + '<div class="grow"><b>Department: Operations</b><small>WikiPagePermission · DEPARTMENT · this page only</small></div>' + sel("Comment") + sw(0) + more + "</div>" +
        '<div class="rowx">' + I("key", 16) + '<div class="grow"><b>Role: Finance manager</b><small>WikiPagePermission · ROLE</small></div>' + sel("View") + sw(0) + more + "</div>" +
        '<div class="rowx" style="background:var(--surface)">' + I("layers", 16) + '<div class="grow"><b>Space Engineering · 24 members</b><small>Inherited from space settings, edit there</small></div>' + E("EDIT") + "</div>", 1) +
      "</div><div>" +
      cd("<b>Customer-visible</b>", '<div class="rowx"><div class="grow"><b>Expose to customers</b><small>Shows in the customer portal (07) and can be published to the help center (13). The page stays the source.</small></div>' + sw(0) + '</div><div class="sub-note" style="padding:8px 16px">Turning this on needs docs.pages.publish and is audited. Runbooks for internal systems should stay off.</div>', 1) + gap() +
      cd("<b>Link</b>", '<div class="share-link">' + I("link", 14) + ' https://os.logiqdev.example/docs/p/production-deploy-runbook <span style="margin-left:auto">' + btn("Copy", "", "sm") + '</span></div><div class="sub-note" style="margin-top:6px">Opening the link still checks the reader\'s access. There are no anonymous links.</div>') + gap() +
      cd("<b>Who will be notified</b>", '<div class="rowx"><div class="grow">People added receive a notification (14) with the page link.</div>' + sw(1) + "</div>", 1) + gap() +
      callout("shield", "<b>Effective access</b> 24 members can read, 11 can edit, 2 can manage. Check any member with Preview.") +
      "</div></div>" +
      dm(["WikiPage · visibility, customer_visible", "WikiPagePermission · principal_type (MEMBERSHIP, TEAM, BRANCH, ROLE, DEPARTMENT), principal_id, level, inherit, granted_by_user_id", "WikiSpaceMember · level (inherited)"], []) + "</div>";
  }

  /* =====================================================================================================================
     SEARCH WITH FILTERS (spec §7)
     @route  /docs/search?q=&space=&type=&status=&owner=&updated=&tag=&mode=keyword|semantic
     @perm   VIEW docs.pages.read (results are permission-checked on the server) · "Ask AI" docs.ai.query
     @api    GET /docs/search?q=&space_id=&page_type=&status=&owner_id=&updated_after=&tag=&linked_entity=&mode=&cursor= · POST /saved-views {entity_type: WIKI_PAGE, filters, search}
     @mcp    docs_pages_search · docs_ai_query
     @data   WikiPage (search_vector tsvector, title, excerpt, page_type, status, owner_membership_id, last_edited_at, space_id) · WikiAiIndexEntry (embedding, heading_path, content_text, status) for semantic mode · WikiPageLink · taggings
             · CustomForm (forms are searchable) · SavedView (entity_type WIKI_PAGE)
     @ui     Command-style search input (debounced 250 ms, synced to ?q=), filter bar (Popover+Command), ToggleGroup Keyword | Semantic, result list with highlighted snippets, Tabs: Pages | Forms | Linked records
     @states loading skeleton · empty ("No pages match. Ask the AI assistant instead") · error · no-access · partial ("Some results are hidden because you cannot access them" is NEVER shown: hidden results simply do not exist for the caller)
     @audit  none for plain search; AI queries are logged through the shared AI layer
     @note   Keyword mode = Postgres full-text on WikiPage.search_vector (title weighted above body). Semantic mode = vector similarity over WikiAiIndexEntry chunks, grouped per page, each hit carries heading_path.
             Both modes filter by the caller's access BEFORE ranking. Archived pages and drafts of other people are excluded unless the filter says otherwise. The same endpoint feeds platform global search (01 §140).
     @gap    No search query log or "no result" tracking (gaps-15.md #2).
     ===================================================================================================================== */
  function searchPage() {
    const r = [["Production deploy runbook", "Engineering / Runbooks", "RUNBOOK", "PUBLISHED", "…run <mark>deploy</mark> with release:deploy. Check the <mark>deploy</mark> freeze window before…", "MS", "Nov 11", "Deploy steps › Run the deploy"], ["Branching and releases", "Engineering / Handbook", "PROCEDURE", "PUBLISHED", "…hotfix branches are cut from the last <mark>deploy</mark>ed tag…", "AM", "Oct 22", "Hotfixes"], ["Release calendar and freezes", "Operations", "POLICY", "PUBLISHED", "…no <mark>deploy</mark> on Fridays after 16:00 unless approved by the incident commander…", "KL", "Oct 2", "Freeze windows"], ["Staging environment guide", "Engineering / Handbook", "GENERAL", "DRAFT", "…how to <mark>deploy</mark> a branch preview to staging…", "JK", "Nov 8", "Previews"]];
    return '<div class="a-page">' + head("Search", "Full-text and semantic search across pages and forms you can access.", btn("Save search", "plus") + btn("Ask AI instead", "sparkles", "primary")) +
      '<div class="toolbar">' + '<div class="search-in" style="flex:1">' + I("search", 14) + "<span>deploy production</span></div>" + sel("Keyword", "search") + sel("Semantic", "sparkles") + "</div>" +
      filt([["Space", "is any of", "Engineering, Operations"], ["Type", "is any of", "Runbook, Procedure, Policy"], ["Status", "is", "Published"], ["Updated", "after", "Aug 1"], ["Owner", "is", "Anyone"], ["Tag", "is", "deploy"]], btn("Clear", "", "sm ghost") + sel("Sort: Relevance", "sort")) +
      '<div class="g2" style="grid-template-columns:1fr 250px;align-items:start"><div><div class="tabset">' + tabs([["p", "Pages", 24], ["f", "Forms", 1], ["r", "Linked records", 3]], "p") +
      pane("p", 1, '<div class="panel" style="margin-top:0;padding:4px 14px">' + r.map((x) => '<div class="srch"><div style="display:flex;gap:8px;align-items:center">' + I(pico(x[2]), 15) + "<b>" + x[0] + "</b>" + ptp(x[2]) + pst(x[3]) + '</div><div class="x">' + x[4] + '</div><div class="p"><span>' + x[1] + "</span><span>·</span><span>" + x[7] + "</span><span>·</span><span>" + PEOPLE[x[5]][0] + " · " + x[6] + "</span></div></div>").join("") + "</div>" + pager("1–4 of 24")) +
      pane("f", 0, '<div class="panel" style="margin-top:0;padding:4px 14px"><div class="srch"><b>Deploy retrospective survey</b> ' + E("FEEDBACK_SURVEY", "blue") + " " + E("PUBLISHED", "green") + '<div class="p">Form · Engineering · 18 responses</div></div></div>') +
      pane("r", 0, '<div class="panel" style="margin-top:0;padding:4px 14px"><div class="srch"><b>Release 2026.11 website</b> <div class="p">Release (06) linked from Production deploy runbook</div></div></div>') + "</div></div>" +
      "<div>" + cd("<b>AI answer</b><span class='r muted'>docs.ai.query</span>", '<div class="ai-msg">Deploys run with <code>pnpm release:deploy --env production</code> after CI is green and the migration is reviewed. Avoid Friday after 16:00. <span class="cite">' + I("book", 11) + ' Production deploy runbook</span> <span class="cite">' + I("book", 11) + " Release calendar and freezes</span></div><div class='sub-note'>Answers use only pages you can read. Citations link to the page and heading.</div>") + gap() +
      cd("<b>Saved searches</b>", ["Needs review in Engineering", "Policies updated this quarter", "My drafts"].map((s) => '<div class="rowx">' + I("star", 13) + '<div class="grow">' + s + "</div></div>").join(""), 1) + "</div></div>" +
      dm(["WikiPage · search_vector, title, excerpt, page_type, status, owner_membership_id, last_edited_at", "WikiAiIndexEntry · embedding, heading_path, content_text, status", "WikiPageLink · taggings · SavedView (entity_type WIKI_PAGE)", "CustomForm · name, kind, status"], ["Search query log (what people search, zero-result queries)"]) + "</div>";
  }

  /* =====================================================================================================================
     TEMPLATES GALLERY (spec §2, §3)
     @route  /docs/templates?type=&space=&q=
     @perm   VIEW docs.pages.read · create from template docs.pages.create · create/edit organization templates docs.spaces.manage · system templates (is_system) are read-only
     @api    GET /docs/templates?type=&space_id= · POST /docs/templates · POST /docs/templates/:id/duplicate · POST /docs/pages {template_id}
     @mcp    docs_templates_read · docs_templates_manage
     @data   WikiPageTemplate (organization_id null = system, space_id, name, slug, description, icon, page_type, content, content_markdown, default_review_interval_days, is_system, sort_order, archived_at)
     @ui     Card grid with live mini preview, Tabs (All | Organization | Space | System), filter by type, Dialog "Use template"
     @states loading · empty · error · no-access
     @audit  template created, edited, archived
     @note   organization_id null means a SYSTEM template shipped with the product (policy, procedure, runbook, meeting notes, decision record, handbook chapter, onboarding guide, offboarding guide). Copy-on-use: editing a template
             never changes pages already created from it. A template scoped to a space (space_id) appears only for that space.
     ===================================================================================================================== */
  function templates() {
    const T = [["Policy", "POLICY", "System", 365, "Purpose, scope, rules, exceptions, owner, review cycle", 12], ["Procedure", "PROCEDURE", "System", 180, "Goal, roles, numbered steps, checklist, FAQ", 31], ["Runbook", "RUNBOOK", "System", 180, "Before you start, steps, verification, rollback, contacts", 14], ["Meeting notes", "MEETING_NOTES", "System", 0, "Agenda, notes, decisions, action items as tasks", 88], ["Decision record", "DECISION_RECORD", "System", 0, "Context, options, decision, consequences", 21], ["Handbook chapter", "HANDBOOK_CHAPTER", "System", 365, "Intro, sections, acknowledgement block", 9], ["Onboarding guide", "ONBOARDING_GUIDE", "System", 90, "Week 1 to 4 plan, tools, people, required reading", 6], ["Offboarding guide", "OFFBOARDING_GUIDE", "System", 180, "Access removal, handover, equipment, exit interview", 3], ["Client kickoff brief", "GENERAL", "Organization", 0, "Goals, stakeholders, scope, risks", 17], ["Incident postmortem", "PROCEDURE", "Space: Engineering", 0, "Timeline, impact, root cause, actions", 9]];
    return '<div class="a-page">' + head("Templates", "Reusable page structures. Using one copies it; it never stays linked.", btn("Import template", "inbox") + btn("New template", "plus", "primary")) +
      '<div class="tabset">' + tabs([["a", "All", 10], ["o", "Organization", 1], ["s", "Space", 1], ["y", "System", 8]], "a") +
      '<div class="toolbar">' + search("Search templates") + sel("Any type", "file") + sel("Any space", "layers") + "</div>" +
      pane("a", 1, '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px">' + T.map((t) => '<div class="tp-card"><div class="pv"><i class="h"></i><i></i><i style="width:80%"></i><i style="width:60%"></i><span>' + t[4] + '</span></div><div class="bd"><b>' + t[0] + "</b><small>" + U.en(t[1]) + " · " + (t[3] ? "review every " + t[3] + " days" : "no review cycle") + '</small><div class="rowx" style="padding:8px 0 0">' + E(t[2].split(":")[0].toUpperCase().replace("ORGANIZATION", "ORGANIZATION"), t[2] === "System" ? "" : "blue") + '<span class="muted">' + t[5] + ' uses</span><span style="flex:1"></span>' + btn("Use", "", "sm") + more + "</div></div></div>").join("") + "</div>") +
      pane("o", 0, '<div class="sub-note">Filtered: Organization templates.</div>') + pane("s", 0, '<div class="sub-note">Filtered: space templates.</div>') + pane("y", 0, '<div class="sub-note">Filtered: system templates (read-only, duplicate to customise).</div>') + "</div>" +
      dm(["WikiPageTemplate · organization_id, space_id, name, slug, description, icon, page_type, content, default_review_interval_days, is_system, sort_order, archived_at", "WikiPage · template_id (usage count)"], []) + "</div>";
  }

  /* =====================================================================================================================
     TEMPLATE EDITOR — create / edit (spec §2, §3)
     @route  /docs/templates/new · /docs/templates/:slug/edit
     @perm   docs.spaces.manage (organization and space templates) · system templates: duplicate only
     @api    POST /docs/templates · PATCH /docs/templates/:id · POST /docs/templates/:id/archive
     @mcp    docs_templates_manage
     @data   WikiPageTemplate (all columns) · WikiPage (template_id, usage count, read-only)
     @ui     Form + the same block editor as a page, Select for type, Popover+Command for space
     @states validation · saving · saved · permission error
     @audit  template created, edited, archived
     @note   page_type and default_review_interval_days are applied to new pages. Placeholders such as {{owner}}, {{today}}, {{space}} are replaced on use. content_markdown is derived from content for the gallery preview.
     ===================================================================================================================== */
  function templateEdit() {
    return '<div class="a-page">' + head("Edit template · Runbook", "Organization template used 14 times.", btn("Duplicate", "") + btn("Archive", "archive") + btn("Save template", "check", "primary")) +
      '<div class="g2" style="grid-template-columns:1.7fr 1fr;align-items:start"><div>' + cd("<b>Template content</b>", blk("<h2>Purpose</h2>") + blk("<p>What this runbook does and when to use it. Owner: {{owner}}. Created {{today}}.</p>") + blk("<h2>Before you start</h2>") + blk('<div class="blk-ck">' + cb(0) + "<span>Access to the target environment</span></div>") + blk('<div class="blk-ck">' + cb(0) + "<span>Incident channel opened</span></div>") + blk("<h2>Steps</h2>") + blk("<p>1. First step…</p>") + blk("<h2>Rollback</h2>") + blk('<div class="blk-code">$ command</div>')) + "</div><div>" +
      cd("<b>Settings</b>", f("Name", box("Runbook")) + f("Slug", box("runbook")) + f("Description", box("Operational steps with verification and rollback.")) + f("Page type", sel("Runbook", "tag")) + f("Icon", sel("Bolt", "zap")) + f("Default review interval (days)", box("180")) + f("Available in", sel("Organization", "globe"), "Organization-wide or one space (WikiPageTemplate.space_id).")) + gap() +
      cd("<b>Usage</b>", kv("Pages created", 14) + kv("Last used", "Nov 4") + kv("Created by", "Marco Silva") + kv("System template", "No")) + "</div></div>" +
      dm(["WikiPageTemplate · name, slug, description, icon, page_type, content, content_markdown, default_review_interval_days, space_id, organization_id, is_system, archived_at"], []) + "</div>";
  }

  /* =====================================================================================================================
     RUNBOOKS (spec §4 Project Help Center)
     @route  /docs/runbooks?project=&status=&q=
     @perm   VIEW docs.pages.read · link a runbook to a project: docs.pages.update on the page + projects.projects.update (05)
     @api    GET /docs/pages?page_type=RUNBOOK&project_id= · PATCH /projects/:id {runbook_page_id} · POST /docs/pages {page_type: RUNBOOK, space_id: <project space>}
     @mcp    docs_pages_read · docs_pages_create
     @data   WikiPage (page_type RUNBOOK, status, next_review_at, owner_membership_id, customer_visible, help_center_article_id, help_center_published_at) · Project.runbook_page_id (05, plain id) · WikiSpace (kind PROJECT, project_id) · WikiPageLink (PROJECT)
     @ui     Table with filter bar, Badge, DropdownMenu (open, link to project, publish to help center), Tabs All | Project runbooks | Internal systems | Customer-visible
     @states loading · empty ("No runbooks. Create one from the Runbook template") · error · no-access
     @audit  runbook linked or unlinked, customer_visible changed, published to help center
     @note   A project runbook is a RUNBOOK page linked from the project workspace (Project.runbook_page_id). Pages with customer_visible answer portal questions (07) and can be published to the help center (13):
             the page is the source and 13 keeps help_center_article_id (a view, no copy). Review cadence matters most here: an overdue runbook is flagged on the project too.
     ===================================================================================================================== */
  function runbooks() {
    const R = [["Production deploy runbook", "Engineering", "Acme Rebrand Website", "PUBLISHED", "MS", "Mar 11", 0, 0], ["Customer portal go-live runbook", "Acme Rebrand Website", "Customer Portal Build", "PUBLISHED", "AM", "Jan 4", 1, 1], ["Database failover runbook", "Engineering", "Internal system", "NEEDS_REVIEW", "JK", "Overdue", 0, 0], ["Mobile release runbook", "Engineering", "Mobile App v2", "DRAFT", "SJ", "None", 0, 0], ["Billing webhook recovery", "Operations", "Stripe Billing Migration", "PUBLISHED", "KL", "Feb 2", 0, 0]];
    return '<div class="a-page">' + head("Runbooks", "Step-by-step operational pages, linked to projects.", btn("Link runbook to project", "link") + btn("New runbook", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Runbooks", 24, "page_type RUNBOOK") + stat("Linked to a project", 11, "Project.runbook_page_id") + stat("Needs review", 3, "overdue", 1) + stat("Customer-visible", 2, "published to help center") + "</div>" +
      '<div class="toolbar">' + search("Search runbooks") + sel("Project: any", "folder") + sel("Status: any") + "</div>" +
      filt([["Type", "is", "Runbook"], ["Review", "is", "Any"]], btn("Save view", "plus", "sm")) +
      '<div class="panel" style="margin-top:0"><table>' + th(["Runbook", "Space", "Linked project", "Status", "Owner", "Next review", "Customer visible", "Help center", ""]) + "<tbody>" + R.map((r) => "<tr><td>" + I("zap", 14) + " " + ink(r[0]) + "</td><td>" + r[1] + "</td><td>" + (r[2] === "Internal system" ? muted("Internal system") : I("folder", 12) + " " + r[2]) + "</td><td>" + pst(r[3]) + "</td><td>" + wh(r[4]) + "</td><td>" + (r[5] === "Overdue" ? '<span class="badge red">Overdue</span>' : r[5]) + "</td><td>" + sw(r[6]) + "</td><td>" + (r[7] ? E("PUBLISHED", "green") : muted("not published")) + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div>" +
      gap() + callout("book", "<b>Help center publishing</b> Customer-visible runbooks are served to the portal (07) and can be published to the help center (13) without duplicating the text: 13 keeps only <code>help_center_article_id</code>.") +
      dm(["WikiPage · page_type RUNBOOK, status, next_review_at, owner_membership_id, customer_visible, help_center_article_id, help_center_published_at", "WikiSpace · kind PROJECT, project_id", "Project.runbook_page_id (05, plain id)"], []) + "</div>";
  }

  /* =====================================================================================================================
     ONBOARDING DOCS (spec §3)
     @route  /docs/onboarding?kind=ONBOARDING|OFFBOARDING&department=&role=
     @perm   VIEW docs.pages.read · checklists docs.checklists.manage · guide pages docs.pages.update
     @api    GET /docs/checklists?kind=&department_id=&role_id= · GET /docs/pages?page_type=ONBOARDING_GUIDE,OFFBOARDING_GUIDE · GET /docs/onboarding/required-reading
     @mcp    docs_checklists_manage · docs_pages_read
     @data   WikiPage (page_type ONBOARDING_GUIDE | OFFBOARDING_GUIDE, requires_acknowledgement) · WikiChecklist (kind, department_id, role_id, guide_page_id, auto_assign, is_active) · WikiChecklistRun (active runs) · WikiPageAcknowledgement
     @ui     Tabs Guides | Checklists | Required reading, Card per department, Progress, Table
     @states loading · empty ("No onboarding guides for this department yet") · error · no-access
     @audit  guide published, checklist activated, auto_assign toggled
     @note   Per department and per role: a guide page (what to read), a checklist (what to do, generates Tasks) and required reading with acknowledgement. Offboarding aligns with 01 §131. The member onboarding
             flow (01 §130) starts a WikiChecklistRun for every active checklist whose department/role matches and auto_assign is on.
     ===================================================================================================================== */
  function onboarding() {
    const D = [["Engineering", "Engineer onboarding", "Engineer onboarding guide", 13, 3, 92, 1], ["Sales", "Sales rep onboarding", "Sales playbook start here", 11, 2, 80, 1], ["Operations", "Operations onboarding", "Operations handbook", 9, 1, 100, 1], ["People", "Offboarding (all roles)", "Offboarding guide", 12, 1, 70, 0]];
    return '<div class="a-page">' + head("Onboarding docs", "Guides, checklists and required reading per department and role.", btn("New guide", "file") + btn("New checklist", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Active runs", 4, "onboarding in progress") + stat("Guides", 8, "onboarding and offboarding") + stat("Acknowledgements", "87%", "required reading") + stat("Overdue items", 3, "across runs", 1) + "</div>" +
      '<div class="tabset">' + tabs([["g", "By department"], ["r", "Required reading", 5]], "g") +
      pane("g", 1, '<div class="sp-grid">' + D.map((d) => '<div class="sp-card"><div class="top"><span class="sp-ic">' + I("users", 18) + "</span><div><b>" + d[0] + "</b><small>" + (d[6] ? "Onboarding" : "Offboarding") + "</small></div>" + sw(d[6]) + "</div>" + '<div class="rowx" style="padding:0">' + I("file", 14) + '<div class="grow"><b>' + d[2] + "</b><small>guide_page_id · " + E("ONBOARDING_GUIDE", "blue").replace("Onboarding guide", d[6] ? "Onboarding guide" : "Offboarding guide") + "</small></div></div>" +
        '<div class="rowx" style="padding:0">' + I("check", 14) + '<div class="grow"><b>' + d[1] + "</b><small>" + d[3] + " items · generates Tasks (06)</small></div></div><div class='meta'><span>" + d[4] + " active runs</span><span>Required reading " + d[5] + "% acknowledged</span></div></div>").join("") + "</div>") +
      pane("r", 0, tbl(["Page", "Audience", "Due", ">Acknowledged", "Progress", ""], [[ink("Security baseline"), "All engineers", "Nov 15", "18 of 24", bar(75), btn("Send reminder", "bell", "sm")], [ink("Code of conduct"), "Everyone", "Nov 30", "38 of 42", bar(90, "green"), btn("Send reminder", "bell", "sm")], [ink("Remote work policy"), "Everyone", "Nov 15", "29 of 42", bar(69), btn("Send reminder", "bell", "sm")], [ink("Data protection guide"), "Support, Sales", "Dec 1", "9 of 22", bar(41, "red"), btn("Send reminder", "bell", "sm")]])) + "</div>" +
      dm(["WikiPage · page_type, requires_acknowledgement", "WikiChecklist · kind, department_id, role_id, guide_page_id, auto_assign, is_active", "WikiChecklistRun · status, progress_percent", "WikiPageAcknowledgement · membership_id, required_by, acknowledged_at, acknowledged_version_number"], ["Required-reading audience (who must acknowledge): gaps-15.md #5"]) + "</div>";
  }

  /* =====================================================================================================================
     CHECKLISTS — definitions list (spec §3)
     @route  /docs/checklists?kind=&department=&role=&active=
     @perm   VIEW docs.pages.read · create/edit/archive docs.checklists.manage · start a run docs.checklists.manage
     @api    GET /docs/checklists?kind=&department_id=&role_id=&team_id=&branch_id=&is_active= · POST /docs/checklists · POST /docs/checklists/:id/runs {subject_membership_id, due_at}
     @mcp    docs_checklists_manage
     @data   WikiChecklist (kind, name, description, department_id, role_id, team_id, branch_id, guide_page_id, owner_membership_id, auto_assign, is_active, archived_at) · WikiChecklistItem (count) · WikiChecklistRun (count, active)
     @ui     Table with filter bar, Switch (is_active, auto_assign), DropdownMenu
     @states loading · empty · error · no-access
     @audit  checklist created, activated/deactivated, archived, run started
     @note   A checklist can target a department, role, team and/or branch (all optional, more specific wins when several match). Editing a checklist never changes runs already started: runs keep their generated items.
     ===================================================================================================================== */
  function checklists() {
    const C = [["Engineer onboarding", "ONBOARDING", "Engineering", "Engineer", "—", 13, 3, 1, 1, "MS"], ["Sales rep onboarding", "ONBOARDING", "Sales", "Sales rep", "—", 11, 2, 1, 1, "JK"], ["Operations onboarding", "ONBOARDING", "Operations", "Operations", "—", 9, 1, 1, 1, "AM"], ["Designer onboarding", "ONBOARDING", "Design", "Designer", "Berlin", 10, 0, 0, 1, "SJ"], ["Offboarding (all roles)", "OFFBOARDING", "—", "—", "—", 12, 1, 1, 1, "SJ"], ["Contractor offboarding", "OFFBOARDING", "—", "Contractor", "—", 6, 0, 1, 0, "SJ"]];
    return '<div class="a-page">' + head("Checklists", "Onboarding and offboarding definitions. Items generate Tasks when a run starts.", btn("New checklist", "plus", "primary")) +
      '<div class="toolbar">' + search("Search checklists") + sel("Kind: any") + sel("Department: any", "building") + sel("Role: any", "key") + "</div>" +
      filt([["Active", "is", "Yes"]], btn("Save view", "plus", "sm")) +
      '<div class="panel" style="margin-top:0"><table>' + th(["Checklist", "Kind", "Department", "Role", "Branch", ">Items", ">Active runs", "Auto-assign", "Active", "Owner", ""]) + "<tbody>" + C.map((r) => "<tr><td>" + ink(r[0]) + "</td><td>" + E(r[1], r[1] === "ONBOARDING" ? "blue" : "yellow") + "</td><td>" + r[2] + "</td><td>" + r[3] + "</td><td>" + r[4] + "</td><td class='num'>" + r[5] + "</td><td class='num'>" + r[6] + "</td><td>" + sw(r[7]) + "</td><td>" + sw(r[8]) + "</td><td>" + wh(r[9]) + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div>" +
      dm(["WikiChecklist · kind, name, department_id, role_id, team_id, branch_id, guide_page_id, owner_membership_id, auto_assign, is_active, archived_at", "WikiChecklistItem · count", "WikiChecklistRun · count by status"], []) + "</div>";
  }

  /* =====================================================================================================================
     CHECKLIST — create / edit with items (spec §3)
     @route  /docs/checklists/new · /docs/checklists/:id
     @perm   docs.checklists.manage · tasks created by runs follow tasks.tasks.create of the run initiator (service account when triggered by automation)
     @api    POST /docs/checklists {kind, name, description, department_id?, role_id?, team_id?, branch_id?, guide_page_id?, owner_membership_id, auto_assign, is_active, items[]} · PUT /docs/checklists/:id/items (ordered)
     @mcp    docs_checklists_manage
     @data   WikiChecklist · WikiChecklistItem (title, description, sort_order, page_id, requires_acknowledgement, form_id, due_offset_days, assignee_kind, assignee_membership_id, task_type_id, is_required) · WikiPage (guide + read items) · CustomForm (form items)
     @ui     Form + sortable item list (dnd-kit), Dialog per item, Select for assignee kind, Popover+Command for page/form/member/task type
     @states validation · saving · saved · permission error
     @audit  checklist created/edited, items reordered
     @note   An item is one of three kinds by its columns: a TASK (title, assignee, due offset, task_type_id), a READ item (page_id, optionally requires_acknowledgement) or a FORM item (form_id, 15 §5). due_offset_days is
             relative to the run start (start of onboarding / last working day for offboarding). Assignee kinds: SUBJECT (the new hire), MANAGER, CHECKLIST_OWNER, SPECIFIC_MEMBER.
     ===================================================================================================================== */
  function checklistEdit() {
    const it = [["Create accounts: email, Slack, GitHub", "Task", "CHECKLIST_OWNER", "Day 0", 1], ["Sign employment contract and NDA", "Task", "SUBJECT", "Day 1", 1], ["Read: Security baseline", "Read + acknowledge", "SUBJECT", "Day 3", 1], ["Read: Engineering handbook", "Read", "SUBJECT", "Day 5", 1], ["Set up development environment", "Task", "SUBJECT", "Day 2", 1], ["Meet your buddy", "Task", "MANAGER", "Day 1", 0], ["Complete equipment request", "Form: Equipment request", "SUBJECT", "Day 1", 1], ["30 day check-in", "Form: Check-in", "MANAGER", "Day 30", 1]];
    return '<div class="a-page">' + head("Engineer onboarding", "Checklist · Onboarding · 13 items", btn("Start run", "plus") + btn("Save checklist", "check", "primary")) +
      '<div class="g2" style="grid-template-columns:1.7fr 1fr;align-items:start"><div>' +
      cd("<b>Items</b><span class='r'>" + btn("Add item", "plus", "sm") + "</span>", it.map((r, i) => '<div class="rowx"><span class="muted">' + I("menu", 14) + "</span><span class='step' style='padding:0;border:0'><span class='no'>" + (i + 1) + '</span></span><div class="grow"><b>' + r[0] + "</b><small>" + r[1] + " · " + U.en(r[2]) + " · due " + r[3] + "</small></div>" + (r[4] ? E("REQUIRED", "blue") : E("OPTIONAL")) + more + "</div>").join("") + '<div class="sub-note" style="padding:8px 16px">Drag to reorder (sort_order). Items 3 and 4 use WikiChecklistItem.page_id; 7 and 8 use form_id.</div>', 1) + gap() +
      cd("<b>Item editor</b><span class='r muted'>selected: Read: Security baseline</span>", f("Title", box("Read: Security baseline")) + f("Description", box("Read and acknowledge before touching production.")) + row2(f("Type", sel("Read a page", "file")), f("Page", sel("Security baseline", "file"))) + row2(f("Assignee", sel("Subject (the new member)", "users")), f("Due offset (days)", box("3"))) + '<div class="rowx"><div class="grow"><b>Requires acknowledgement</b><small>Creates a WikiPageAcknowledgement</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Required</b><small>is_required: the run cannot complete without it</small></div>' + sw(1) + "</div>" + f("Task type", sel("Onboarding", "tasks"), "Used when the item generates a Task (06).")) +
      "</div><div>" +
      cd("<b>Checklist</b>", f("Name", box("Engineer onboarding")) + f("Kind", sel("Onboarding")) + f("Description", box("Everything a new engineer does in the first month.")) + f("Owner", sel("Marco Silva", "users")) + f("Guide page", sel("Engineer onboarding guide", "file"))) + gap() +
      cd("<b>Who gets it</b>", f("Department", sel("Engineering", "building")) + f("Role", sel("Engineer", "key")) + f("Team", sel("—", "users")) + f("Branch", sel("—", "building")) + '<div class="rowx"><div class="grow"><b>Auto-assign</b><small>Start a run when a member is onboarded (01 §130)</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Active</b></div>' + sw(1) + "</div>") + "</div></div>" +
      dm(["WikiChecklist · every column", "WikiChecklistItem · title, description, sort_order, page_id, requires_acknowledgement, form_id, due_offset_days, assignee_kind, assignee_membership_id, task_type_id, is_required", "Role · Team (department) · Branch · WikiPage · CustomForm · TaskType (06)"], []) + "</div>";
  }

  /* =====================================================================================================================
     CHECKLIST RUNS — list and run detail (spec §3)
     @route  /docs/runs?kind=&status=&subject= · /docs/runs/:id
     @perm   VIEW docs.pages.read + own runs always visible · see everyone's runs docs.checklists.manage · complete an item: the item assignee · skip an item docs.checklists.manage
     @api    GET /docs/runs?status=&checklist_id=&subject_id= · GET /docs/runs/:id · POST /docs/runs/:id/items/:itemId/complete · POST .../skip {reason} · POST /docs/runs/:id/cancel
     @mcp    docs_checklists_manage
     @data   WikiChecklistRun (checklist_id, subject_membership_id, employee_id, status, triggered_by, automation_run_id, started_at, due_at, completed_at, cancelled_at, progress_percent) · WikiChecklistRunItem (checklist_item_id, task_id, status, form_submission_id, completed_by_membership_id, completed_at, skipped_reason)
             · WikiPageAcknowledgement (checklist_run_item_id) · Task (06, read-only) · FormSubmission · Employee (10, employee_id)
     @ui     Table with filter bar and progress; detail: Card with item list, Progress, Timeline, Dialog for skip reason
     @states loading · empty ("No runs") · error · no-access
     @audit  run started, item completed/skipped (reason), run completed/cancelled
     @note   Items are generated as Tasks (06): completing the Task completes the run item and vice versa (bidirectional sync through task_id). READ items complete when the WikiPageAcknowledgement is recorded.
             progress_percent = completed required items / required items. Per-employee progress in the HR profile (10) reads these rows.
     ===================================================================================================================== */
  function runs() {
    const R = [["LN", "Lena Novak", "Engineer onboarding", "ONBOARDING", "IN_PROGRESS", "MEMBER_ONBOARDING", "Nov 3", "Nov 21", 62], ["KL", "Kim Lund", "Sales rep onboarding", "ONBOARDING", "IN_PROGRESS", "MEMBER_ONBOARDING", "Oct 27", "Nov 14", 85], ["JK", "Jonas Koch", "Contractor offboarding", "OFFBOARDING", "NOT_STARTED", "MANUAL", "—", "Dec 1", 0], ["SJ", "Sofia Jensen", "Designer onboarding", "ONBOARDING", "COMPLETED", "AUTOMATION", "Sep 15", "Oct 3", 100], ["MS", "Marco Silva", "Operations onboarding", "ONBOARDING", "CANCELLED", "MANUAL", "Aug 1", "Aug 19", 30]];
    const cls = { IN_PROGRESS: "blue", NOT_STARTED: "", COMPLETED: "green", CANCELLED: "red" };
    return '<div class="a-page">' + head("Checklist runs", "Who is on which onboarding or offboarding checklist.", btn("Start run", "plus", "primary")) +
      '<div class="mini-stats">' + stat("In progress", 6, "runs") + stat("Overdue items", 3, "across runs", 1) + stat("Completed this month", 4, "runs") + stat("Avg time to complete", "17 d", "onboarding") + "</div>" +
      '<div class="toolbar">' + search("Search member or checklist") + sel("Kind: any") + sel("Status: any") + "</div>" +
      filt([["Status", "is any of", "Not started, In progress"], ["Trigger", "is", "Any"]], btn("Save view", "plus", "sm")) +
      '<div class="panel" style="margin-top:0"><table>' + th(["Member", "Checklist", "Kind", "Status", "Trigger", "Started", "Due", "Progress", ""]) + "<tbody>" + R.map((r) => "<tr><td>" + wh(r[0]) + "</td><td>" + ink(r[2]) + "</td><td>" + E(r[3], r[3] === "ONBOARDING" ? "blue" : "yellow") + "</td><td>" + E(r[4], cls[r[4]]) + "</td><td>" + E(r[5]) + "</td><td>" + r[6] + "</td><td>" + r[7] + "</td><td>" + bar(r[8], r[8] === 100 ? "green" : "") + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div>" +
      pager("1–5 of 23") + dm(["WikiChecklistRun · subject_membership_id, employee_id, status, triggered_by, started_at, due_at, completed_at, progress_percent", "WikiChecklist · name, kind"], []) + "</div>";
  }
  function runDetail() {
    const it = [["Create accounts: email, Slack, GitHub", "COMPLETED", "Anna Meyer", "Nov 3", "WEB-171"], ["Sign employment contract and NDA", "COMPLETED", "Lena Novak", "Nov 4", "HR-24"], ["Read: Security baseline", "COMPLETED", "Lena Novak", "Nov 6", "ack v4"], ["Set up development environment", "IN_PROGRESS", "Lena Novak", "due Nov 5, overdue", "WEB-174"], ["Complete equipment request", "COMPLETED", "Lena Novak", "Nov 4", "form"], ["Meet your buddy", "PENDING", "Marco Silva", "due Nov 4", "WEB-175"], ["Read: Engineering handbook", "PENDING", "Lena Novak", "due Nov 8", "ack"], ["Optional: join guild channel", "SKIPPED", "Lena Novak", "skipped: not relevant", "—"], ["30 day check-in", "PENDING", "Marco Silva", "due Dec 3", "form"]];
    const c = { COMPLETED: "green", IN_PROGRESS: "blue", PENDING: "", SKIPPED: "yellow" };
    return '<div class="a-page">' + head("Engineer onboarding · Lena Novak", "Run · started Nov 3 · due Nov 21 · triggered by member onboarding", btn("Cancel run", "x") + btn("Send reminder", "bell") + btn("Open in HR profile", "people", "primary")) +
      '<div class="g2" style="grid-template-columns:1.7fr 1fr;align-items:start"><div>' + cd("<b>Items</b><span class='r muted'>WikiChecklistRunItem</span>", it.map((r) => '<div class="rowx">' + cb(r[1] === "COMPLETED") + '<div class="grow"><b>' + r[0] + "</b><small>" + r[2] + " · " + r[3] + (r[4] !== "—" ? " · " + I("link", 11) + " " + r[4] : "") + "</small></div>" + E(r[1], c[r[1]]) + more + "</div>").join(""), 1) + "</div><div>" +
      cd("<b>Progress</b>", '<div class="rowx"><div class="ring" style="--p:62%"><span>62%</span></div><div class="grow"><b>8 of 13 items</b><small>1 overdue · 3 pending · 1 skipped</small></div>' + E("IN_PROGRESS", "blue") + "</div>", 1) + gap() +
      cd("<b>Run details</b>", kv("Member", "Lena Novak") + kv("Employee record", "EMP-0142 (10)") + kv("Manager", "Marco Silva") + kv("Trigger", U.en("MEMBER_ONBOARDING")) + kv("Automation run", muted("none")) + kv("Due", "Nov 21")) + gap() +
      cd("<b>Activity</b>", '<div class="tl"><div class="ev"><b>Read: Security baseline acknowledged (version 4)</b><small>Lena Novak · Nov 6</small></div><div class="ev"><b>Tasks generated: 9 Tasks created in Engineering</b><small>System · Nov 3</small></div><div class="ev"><b>Run started</b><small>Member onboarding · Nov 3</small></div></div>') + "</div></div>" +
      dm(["WikiChecklistRun · all columns", "WikiChecklistRunItem · checklist_item_id, task_id, status, form_submission_id, completed_by_membership_id, completed_at, skipped_reason", "WikiPageAcknowledgement · checklist_run_item_id", "Task (06) · Employee (10) · FormSubmission"], []) + "</div>";
  }

  /* =====================================================================================================================
     REVIEWS AND ACKNOWLEDGEMENTS (spec §2, §3)
     @route  /docs/reviews?tab=cadence|acknowledgements&space=&owner=
     @perm   VIEW docs.pages.read · mark reviewed: page reviewer or owner with docs.pages.update · send reminders docs.pages.update · acknowledge: any reader of the page
     @api    GET /docs/reviews?status=overdue|due_soon · POST /docs/pages/:id/review {notes} · GET /docs/pages/:id/acknowledgements · POST /docs/pages/:id/acknowledge · POST /docs/pages/:id/acknowledgements/remind
     @mcp    docs_pages_update (review) · docs_pages_read
     @data   WikiPage (review_interval_days, last_reviewed_at, last_reviewed_by_membership_id, next_review_at, stale_flagged_at, status NEEDS_REVIEW, requires_acknowledgement, owner_membership_id) · WikiPageReviewer · WikiPageAcknowledgement
             (membership_id, required_by, acknowledged_at, acknowledged_version_number) · WikiAiSuggestion (kind STALE_PAGE, CONTRADICTION)
     @ui     Tabs, Table with filters, Progress, Dialog for "Mark reviewed" with notes, Popover+Command for reassigning the owner
     @states loading · empty ("Nothing is due for review") · error · no-access
     @audit  page reviewed (who, version), acknowledgement recorded, reminders sent, status set NEEDS_REVIEW
     @note   A daily job sets NEEDS_REVIEW + stale_flagged_at when next_review_at passed and notifies owner and reviewers (14). Marking reviewed sets last_reviewed_at and recomputes next_review_at; it does NOT create a
             version unless the content changed. AI flags (WikiAiSuggestion STALE_PAGE / CONTRADICTION) appear as extra rows with the reason and a link to the conflicting page. Re-acknowledgement is required when
             acknowledged_version_number < published_version_number of a page that requires acknowledgement.
     @gap    Who must acknowledge (audience) is not stored; see gaps-15.md #5.
     ===================================================================================================================== */
  function reviews() {
    const rv = [["Database failover runbook", "Engineering", "JK", "Aug 2", "12 days overdue", "NEEDS_REVIEW", "Manual"], ["Expense policy", "Operations", "AM", "Nov 15", "due in 4 days", "PUBLISHED", ""], ["Remote work policy", "People and HR", "SJ", "Dec 1", "due in 20 days", "PUBLISHED", ""], ["Onboarding handbook", "Company handbook", "AM", "Jul 9", "126 days overdue", "NEEDS_REVIEW", "AI: contradicts Remote work policy"], ["Brand voice guide", "Company handbook", "KL", "Sep 20", "52 days overdue", "NEEDS_REVIEW", "AI: references retired tool"]];
    return '<div class="a-page">' + head("Reviews and acknowledgements", "Keep pages fresh and prove people read the important ones.", btn("Send reminders", "bell") + btn("Export report", "file", "primary")) +
      '<div class="mini-stats">' + stat("Needs review", 9, "overdue", 1) + stat("Due in 30 days", 14, "pages") + stat("Required pages", 7, "with acknowledgement") + stat("Acknowledged", "84%", "current versions") + stat("AI stale flags", 3, "WikiAiSuggestion") + "</div>" +
      '<div class="tabset">' + tabs([["c", "Review cadence", 9], ["a", "Acknowledgements", 7]], "c") +
      pane("c", 1, filt([["Status", "is any of", "Needs review, Published"], ["Review due", "before", "Dec 31"], ["Space", "is", "Any"]], btn("Save view", "plus", "sm")) + '<div class="panel" style="margin-top:0"><table>' + th(["Page", "Space", "Owner", "Next review", "State", "Status", "Flag", ""]) + "<tbody>" + rv.map((r) => "<tr><td>" + ink(r[0]) + "</td><td>" + r[1] + "</td><td>" + wh(r[2]) + "</td><td>" + r[3] + "</td><td>" + (r[4].indexOf("overdue") > -1 ? '<span class="badge red">' + r[4] + "</span>" : r[4]) + "</td><td>" + pst(r[5]) + "</td><td>" + (r[6] ? '<span class="cite">' + I("sparkles", 11) + " " + r[6] + "</span>" : "") + "</td><td>" + btn("Mark reviewed", "check", "sm") + "</td></tr>").join("") + "</tbody></table></div>") +
      pane("a", 0, '<div class="g2" style="grid-template-columns:1.4fr 1fr;align-items:start">' + cd("<b>Security baseline</b><span class='r muted'>version 4 · 18 of 24 acknowledged</span>", [["MS", "v4", "Nov 5"], ["AM", "v4", "Nov 5"], ["JK", "v3", "Oct 1"], ["KL", "—", "pending"], ["SJ", "v4", "Nov 7"], ["LN", "—", "pending"]].map((r) => '<div class="rowx">' + av(r[0]) + '<div class="grow"><b>' + PEOPLE[r[0]][0] + "</b><small>" + (r[1] === "—" ? "Not acknowledged" : "Acknowledged " + r[1] + " on " + r[2]) + "</small></div>" + (r[1] === "v4" ? E("CURRENT", "green") : r[1] === "v3" ? E("RE-ACK NEEDED", "yellow") : E("PENDING", "red")) + "</div>").join(""), 1) + cd("<b>Required pages</b>", tbl(["Page", "Ack", "Due"], [["Security baseline", bar(75), "Nov 15"], ["Code of conduct", bar(90, "green"), "Nov 30"], ["Remote work policy", bar(69), "Nov 15"]]), 1) + "</div>") + "</div>" +
      dm(["WikiPage · review_interval_days, last_reviewed_at, last_reviewed_by_membership_id, next_review_at, stale_flagged_at, status, requires_acknowledgement", "WikiPageReviewer", "WikiPageAcknowledgement · membership_id, required_by, acknowledged_at, acknowledged_version_number", "WikiAiSuggestion · kind STALE_PAGE | CONTRADICTION, related_page_id, rationale"], ["Acknowledgement audience: no stored target (gaps-15.md #5)"]) + "</div>";
  }

  /* =====================================================================================================================
     FORMS — list and assignments (spec §5, phase 2)
     @route  /docs/forms?kind=&status=&space=
     @perm   VIEW docs.forms.read · create docs.forms.create · edit docs.forms.update · assign docs.forms.assign · review responses docs.forms.review · archive docs.forms.archive · delete docs.forms.delete* · export docs.forms.export*
     @api    GET /docs/forms?kind=&status= · POST /docs/forms/:id/assignments {target_type, target_id, due_at, reminders[], message} · GET /docs/forms/:id/assignments
     @mcp    docs_forms_read · docs_forms_assign
     @data   CustomForm (name, slug, kind, status, is_anonymous, allow_multiple_submissions, requires_review, opens_at, closes_at, current_version_number, owner_membership_id, space_id) · FormAssignment (target_type, target_id, due_at, reminders, recipient_count, submitted_count)
             · FormAssignmentRecipient (status, reminder_count)
     @ui     Table with filter bar, Badge, Progress, Dialog "Assign form" (Select target type + Popover+Command target, DatePicker, reminders list)
     @states loading · empty · error · no-access
     @audit  form published/closed/archived, assignment created (who, target, due), reminders sent (14, 20)
     @note   Assigning expands the target (member, team, department, branch or the whole organization) into FormAssignmentRecipient rows at assign time. For anonymous forms completion is tracked per recipient but answers are
             never linked to them (enforced at storage, see responses screen). Webhooks docs.form_assigned and docs.form_submitted; rules in 20 can create Tasks (06) or Tickets (13) from submissions.
     ===================================================================================================================== */
  function forms() {
    const F = [["Engineering pulse survey", "FEEDBACK_SURVEY", "PUBLISHED", 1, 24, 18, "Nov 20"], ["Weekly check-in", "CHECK_IN", "PUBLISHED", 0, 42, 31, "Every Fri"], ["Equipment request", "EQUIPMENT_REQUEST", "PUBLISHED", 0, 6, 6, "—"], ["Incident report", "INCIDENT_REPORT", "PUBLISHED", 0, 4, 4, "—"], ["Policy acknowledgement 2026", "COMPLIANCE_ACKNOWLEDGEMENT", "PUBLISHED", 0, 42, 29, "Nov 30"], ["Exit interview", "EXIT_INTERVIEW", "DRAFT", 1, 0, 0, "—"], ["Q3 offsite feedback", "FEEDBACK_SURVEY", "CLOSED", 1, 38, 36, "Sep 30"]];
    return '<div class="a-page">' + head("Forms", "Surveys, check-ins, requests and acknowledgements.", btn("Assign form", "send") + btn("New form", "plus", "primary")) +
      '<div class="toolbar">' + search("Search forms") + sel("Kind: any") + sel("Status: any") + "</div>" +
      filt([["Status", "is any of", "Draft, Published"], ["Anonymous", "is", "Any"]], btn("Save view", "plus", "sm")) +
      '<div class="panel" style="margin-top:0"><table>' + th(["Form", "Kind", "Status", "Anonymous", ">Assigned", ">Submitted", "Completion", "Due", ""]) + "<tbody>" + F.map((r) => "<tr><td>" + ink(r[0]) + "</td><td>" + E(r[1], "blue") + "</td><td>" + E(r[2], r[2] === "PUBLISHED" ? "green" : r[2] === "DRAFT" ? "yellow" : "") + "</td><td>" + (r[3] ? I("lock", 13) + " Yes" : "No") + "</td><td class='num'>" + r[4] + "</td><td class='num'>" + r[5] + "</td><td>" + (r[4] ? bar(Math.round(r[5] / r[4] * 100)) : "—") + "</td><td>" + r[6] + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div>" +
      pager("1–7 of 7") + dm(["CustomForm · name, kind, status, is_anonymous, current_version_number, opens_at, closes_at", "FormAssignment · target_type, target_id, due_at, recipient_count, submitted_count", "FormAssignmentRecipient · status, reminder_count"], []) + "</div>";
  }

  /* =====================================================================================================================
     FORM BUILDER — create / edit (spec §5)
     @route  /docs/forms/new · /docs/forms/:id/edit
     @perm   create docs.forms.create · edit docs.forms.update · publish docs.forms.update (freezes a version) · anonymous option needs docs.forms.update and is locked after the first submission
     @api    POST /docs/forms · PATCH /docs/forms/:id {fields_schema, is_anonymous, allow_multiple_submissions, requires_review, reviewer_membership_ids[], confirmation_message, opens_at, closes_at} · POST /docs/forms/:id/publish {change_summary}
     @mcp    docs_forms_create · docs_forms_update
     @data   CustomForm (all columns, fields_schema Json: [{ key, type, label, required, options, ... }]) · CustomFormVersion (version_number, fields_schema, change_summary) · WikiSpace (space_id)
     @ui     Three-pane builder: field palette | canvas (dnd-kit) | field settings; Tabs Build | Settings | Preview; Select, Switch, Popover+Command for reviewers
     @states validation (unique keys, choice options) · saving draft · published (version n) · permission error
     @audit  form created, published (version), closed, archived; anonymous flag set
     @note   Field types are CustomFormFieldType: SHORT_TEXT, LONG_TEXT, NUMBER, EMAIL, SINGLE_CHOICE, MULTI_CHOICE, CHECKBOX, SCALE, DATE, FILE_UPLOAD (Documents, 17), SIGNATURE, SECTION. Publishing freezes a
             CustomFormVersion; submissions reference the version they answered, so edits never rewrite old answers. Anonymous forms store no respondent link: is_anonymous on the submission, respondent_membership_id and
             submitted_by_user_id stay null at write time.
     ===================================================================================================================== */
  function formBuilder() {
    const fl = [["Section", "SECTION", "How are things going?"], ["How satisfied are you with your work this month?", "SCALE", "1 to 5 · required"], ["What is slowing you down?", "LONG_TEXT", "optional"], ["Which tools do you use daily?", "MULTI_CHOICE", "5 options · required"], ["Team", "SINGLE_CHOICE", "4 options · required"], ["Start date of the last project", "DATE", "optional"], ["Attach a screenshot", "FILE_UPLOAD", "optional · stored in Documents (17)"]];
    return '<div class="a-page">' + head("Engineering pulse survey", "Form · version 3 · published Nov 3 · draft changes pending", btn("Preview", "video") + btn("Assign", "send") + btn("Publish version 4", "check", "primary")) +
      '<div class="g2" style="grid-template-columns:200px 1.6fr 1fr;align-items:start">' +
      cd("<b>Fields</b>", ["SHORT_TEXT", "LONG_TEXT", "NUMBER", "EMAIL", "SINGLE_CHOICE", "MULTI_CHOICE", "CHECKBOX", "SCALE", "DATE", "FILE_UPLOAD", "SIGNATURE", "SECTION"].map((t) => '<div class="rowx" style="padding:6px 12px">' + I("plus", 12) + '<div class="grow">' + U.en(t) + "</div></div>").join(""), 1) +
      "<div>" + cd("<b>Canvas</b><span class='r muted'>fields_schema</span>", '<div style="padding:12px 14px">' + fl.map((r, i) => '<div class="fld-prev" style="' + (i === 1 ? "border-color:var(--blue)" : "") + '"><div style="display:flex;gap:8px;align-items:center"><b>' + r[0] + "</b>" + E(r[1], "blue") + '<span style="margin-left:auto">' + more + "</span></div><small>" + r[2] + "</small>" + (r[1] === "SCALE" ? '<div class="rowx" style="padding:8px 0 0;gap:6px">' + [1, 2, 3, 4, 5].map((n) => '<span class="seg">' + n + "</span>").join("") + "</div>" : "") + "</div>").join("") + '<div style="text-align:center">' + btn("Add field", "plus", "sm") + "</div></div>") + "</div>" +
      "<div>" + cd("<b>Field settings</b><span class='r muted'>Scale</span>", f("Label", box("How satisfied are you with your work this month?")) + f("Key", box("satisfaction"), "Stable answers key, never changes after publish.") + row2(f("Min", box("1")), f("Max", box("5"))) + row2(f("Left label", box("Not at all")), f("Right label", box("Very"))) + '<div class="rowx"><div class="grow"><b>Required</b></div>' + sw(1) + "</div>") + gap() +
      cd("<b>Form settings</b>", '<div class="rowx"><div class="grow"><b>Anonymous responses</b><small>No link between answers and person. Locked after first submission. Completion still tracked.</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Allow multiple submissions</b></div>' + sw(0) + '</div><div class="rowx"><div class="grow"><b>Requires review</b><small>A reviewer marks each response</small></div>' + sw(0) + "</div>" + f("Kind", sel("Feedback survey")) + f("Space", sel("Engineering", "layers")) + row2(f("Opens", sel("Nov 3", "calendar")), f("Closes", sel("Nov 20", "calendar"))) + f("Confirmation message", box("Thanks, your answers are in."))) + "</div></div>" +
      dm(["CustomForm · name, slug, kind, status, fields_schema, is_anonymous, allow_multiple_submissions, requires_review, reviewer_membership_ids, confirmation_message, opens_at, closes_at, current_version_number, space_id", "CustomFormVersion · version_number, fields_schema, change_summary"], []) + "</div>";
  }

  /* =====================================================================================================================
     FORM RESPONSES — review, aggregate, export (spec §5)
     @route  /docs/forms/:id/responses?status=&tab=summary|responses|recipients
     @perm   review docs.forms.review · export docs.forms.export* · named responses docs.forms.read · anonymous response sets docs.forms.anonymous_responses.read* (every access audited)
     @api    GET /docs/forms/:id/responses?status= · PATCH /docs/forms/:id/responses/:sid {status, review_notes} · GET /docs/forms/:id/summary · POST /docs/forms/:id/export {format} · GET /docs/forms/:id/recipients
     @mcp    docs_forms_read · docs_forms_review
     @data   FormSubmission (status, answers, is_anonymous, respondent_membership_id, submitted_at, reviewed_by_membership_id, reviewed_at, review_notes, created_task_id, created_ticket_id, exclude_from_ai_index) · FormSubmissionFile (field_key, document_id)
             · FormAssignmentRecipient (status, submitted_at, reminder_count) · CustomFormVersion
     @ui     Tabs Summary | Responses | Recipients, charts (bars, histogram), Table, Sheet for one response, Dialog for export, Select for status
     @states loading · empty ("No responses yet") · error · no-access · "Anonymous responses restricted" state when the caller lacks docs.forms.anonymous_responses.read
     @audit  response reviewed, exported, anonymous response set opened (each open is an event), submission excluded from AI index
     @note   For an anonymous form the Responses table never shows a person, a timestamp finer than the day or the IP; the Recipients tab shows only who has or has not submitted (status), with no link to an answer.
             Aggregation hides any group smaller than 5 respondents. exclude_from_ai_index keeps a submission out of the internal AI knowledge (sensitive forms such as exit interviews).
     ===================================================================================================================== */
  function formResponses() {
    return '<div class="a-page">' + head("Engineering pulse survey · responses", "Anonymous form · 18 of 24 submitted · version 3", btn("Export", "file") + btn("Send reminder", "bell") + btn("Close form", "lock", "primary")) +
      '<div class="mini-stats">' + stat("Submitted", 18, "of 24 recipients") + stat("Completion", "75%", "closes Nov 20") + stat("Avg satisfaction", "3.9", "of 5") + stat("Needs review", 0, "review not required") + stat("Reminders sent", 2, "last Nov 8") + "</div>" +
      callout("lock", "<b>Anonymous form.</b> Answers are stored without respondent, user id or precise time. Opening this response set is recorded in the audit log and needs docs.forms.anonymous_responses.read.") + gap(8) +
      '<div class="tabset">' + tabs([["s", "Summary"], ["r", "Responses", 18], ["p", "Recipients", 24]], "s") +
      pane("s", 1, '<div class="g2">' + cd("<b>How satisfied are you with your work this month?</b><span class='r muted'>SCALE · 18 answers</span>", [["5", 5], ["4", 8], ["3", 3], ["2", 2], ["1", 0]].map((r) => '<div class="bar-row"><span class="l">' + r[0] + '</span><span class="tr"><i style="width:' + r[1] * 11 + '%;background:var(--blue)"></i></span><span class="v">' + r[1] + "</span></div>").join("")) + cd("<b>Which tools do you use daily?</b><span class='r muted'>MULTI_CHOICE</span>", [["GitHub", 18], ["Slack", 17], ["Linear", 9], ["Figma", 6], ["Notion", 4]].map((r) => '<div class="bar-row"><span class="l">' + r[0] + '</span><span class="tr"><i style="width:' + r[1] * 5 + '%;background:var(--purple)"></i></span><span class="v">' + r[1] + "</span></div>").join("")) + "</div>") +
      pane("r", 0, '<div class="toolbar">' + search("Search answers") + sel("Status: any") + "</div>" + tbl(["Response", "Submitted", "Status", "Satisfaction", "What is slowing you down?"], [["#18", "Nov 10", E("SUBMITTED", "blue"), "4", "Flaky CI on the mobile repo"], ["#17", "Nov 9", E("SUBMITTED", "blue"), "5", "—"], ["#16", "Nov 9", E("SUBMITTED", "blue"), "3", "Too many context switches between projects"], ["#15", "Nov 8", E("REVIEWED", "green"), "2", "Unclear priorities after the reorg"]])) +
      pane("p", 0, tbl(["Recipient", "Status", "Reminders", "Submitted"], [[wh("MS"), E("SUBMITTED", "green"), 0, "Nov 8"], [wh("AM"), E("SUBMITTED", "green"), 1, "Nov 9"], [wh("KL"), E("PENDING", "blue"), 2, "—"], [wh("JK"), E("OVERDUE", "red"), 2, "—"]]).replace("</table>", "</table>") + '<div class="sub-note">Anonymous: this tab reveals only completion, never which answer is whose.</div>') + "</div>" +
      dm(["FormSubmission · status, answers, is_anonymous, submitted_at, reviewed_by_membership_id, review_notes, created_task_id, exclude_from_ai_index", "FormAssignmentRecipient · status, reminder_count, submitted_at", "FormSubmissionFile · field_key, document_id", "CustomFormVersion · fields_schema"], []) + "</div>";
  }

  /* =====================================================================================================================
     AI KNOWLEDGE — assistant and suggestions (spec §6)
     @route  /docs/ai?tab=ask|suggestions|index
     @perm   ask docs.ai.query · review suggestions docs.pages.update + target page EDIT · index admin docs.spaces.manage
     @api    POST /docs/ai/ask {question, space_ids?} (streams answer with citations) · GET /docs/ai/suggestions?kind=&status= · POST /docs/ai/suggestions/:id/accept|reject|dismiss · GET /docs/ai/index?status=
     @mcp    docs_ai_query
     @data   WikiAiIndexEntry (source_type, source_id, page_id, chunk_index, heading_path, status, indexed_at, error, visibility, customer_visible, source_version) · WikiAiSuggestion (kind, status, page_id, related_page_id, title, content_markdown, rationale,
             source_entity_type, source_entity_id, citation_entry_ids, confidence, model_name, reviewed_by_membership_id, resulting_version_id) · WikiPageVersion (ai_suggestion_id)
     @ui     Tabs, chat panel with citation chips (Badge), Card per suggestion with Diff and Accept / Reject buttons, Table for index health
     @states loading (streaming) · no answer ("I could not find this in pages you can read") · error · no-access · index lagging banner
     @audit  AI question asked (shared AI layer), suggestion accepted (creates WikiPageVersion with ai_suggestion_id), rejected, dismissed
     @note   The assistant retrieves chunks the ASKING USER may read (visibility is evaluated at query time, WikiAiIndexEntry.visibility is only a prefilter) and always cites page and heading. Form submissions are indexed only when the
             form allows it (exclude_from_ai_index). Suggestions (draft from a conversation, meeting or resolved ticket; update; stale; contradiction) are never applied automatically: a human accepts, which writes a version.
             BYOK: model calls use the organization's own OPENAI IntegrationConnection (no platform key).
     ===================================================================================================================== */
  function ai() {
    const S = [["DRAFT_PAGE", "How to handle failed card payments", "Drafted from 6 resolved tickets (13)", "Ticket TCK-2041 and 5 more", 87, "PENDING"], ["UPDATE_PAGE", "Production deploy runbook: add smoke test step", "Discovered in meeting notes of Nov 4", "Meeting: Sprint 14 retro", 74, "PENDING"], ["STALE_PAGE", "Brand voice guide", "References the retired design tool", "Page review", 81, "PENDING"], ["CONTRADICTION", "Onboarding handbook vs Remote work policy", "Different core hours stated (10 to 16 vs 11 to 15)", "Two pages", 92, "PENDING"], ["UPDATE_PAGE", "Expense policy", "Mileage rate changed", "Accepted Oct 30", 95, "ACCEPTED"]];
    return '<div class="a-page">' + head("AI knowledge", "Ask how the business works, and review AI proposals before they touch a page.", btn("Index health", "settings")) +
      '<div class="tabset">' + tabs([["a", "Ask"], ["s", "Suggestions", 4], ["i", "Index"]], "a") +
      pane("a", 1, '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start">' + cd("<b>Assistant</b><span class='r muted'>answers use only pages you can read</span>", '<div style="padding:12px 14px"><div class="ai-msg me">How do we deploy to production on a Friday?</div><div class="ai-msg">Deploys are frozen from Friday 16:00 until Monday 08:00. Outside that window run <code>pnpm release:deploy --env production</code> after CI is green. During a freeze the incident commander must approve; note the approval in the release record. <span class="cite">' + I("book", 11) + ' Production deploy runbook › Before you deploy</span> <span class="cite">' + I("book", 11) + ' Release calendar and freezes</span><div class="rowx" style="padding:8px 0 0">' + btn("Helpful", "check", "sm") + btn("Not right", "x", "sm") + btn("Open pages", "link", "sm") + '</div></div><div class="input-fake">Ask a question about how we work…</div></div>') +
        cd("<b>Scope</b>", f("Search in", sel("All spaces I can read", "layers")) + '<div class="rowx"><div class="grow"><b>Include forms</b><small>Only forms that allow AI indexing</small></div>' + sw(0) + '</div><div class="rowx"><div class="grow"><b>Include linked records</b><small>Projects, tasks, tickets the page links</small></div>' + sw(1) + '</div><div class="sub-note" style="padding:8px 16px">Pages hidden from you are never used, even as hints.</div>', 1) + "</div>") +
      pane("s", 0, '<div class="toolbar">' + sel("Kind: any") + sel("Status: Pending") + "</div>" + S.map((s) => cd("<b>" + s[1] + "</b><span class='r'>" + E(s[0], "purple") + E(s[5], s[5] === "ACCEPTED" ? "green" : "blue") + "<span class='muted'>confidence " + s[4] + "%</span></span>", '<div style="padding:12px 14px"><div class="muted">' + s[2] + " · source: " + s[3] + '</div>' + (s[0] === "UPDATE_PAGE" || s[0] === "DRAFT_PAGE" ? '<div class="diff" style="margin-top:8px"><div class="add">+ Run <code>pnpm release:verify --smoke</code> and confirm output "smoke tests passed".</div></div>' : "") + (s[5] === "PENDING" ? '<div class="rowx" style="padding:10px 0 0">' + btn("Accept and create version", "check", "primary sm") + btn("Edit first", "edit", "sm") + btn("Reject", "x", "sm") + btn("Dismiss", "", "sm ghost") + "</div>" : "") + "</div>")).join('<div style="height:10px"></div>')) +
      pane("i", 0, tbl(["Source", "Items", ">Chunks", "Status", "Last indexed"], [["Pages", "431", "3,980", E("INDEXED", "green"), "2 min ago"], ["Forms", "7", "61", E("INDEXED", "green"), "Nov 10"], ["Form submissions", "186", "186", E("PENDING", "blue"), "queued"], ["Linked records", "212", "640", E("STALE", "yellow"), "Nov 6"], ["Failed", "3", "3", E("FAILED", "red"), "embedding error"]])) + "</div>" +
      dm(["WikiAiIndexEntry · source_type, page_id, chunk_index, heading_path, status, indexed_at, error, source_version", "WikiAiSuggestion · kind, status, page_id, related_page_id, content_markdown, rationale, citation_entry_ids, confidence, resulting_version_id", "WikiPageVersion · ai_suggestion_id", "IntegrationConnection (OPENAI, BYOK)"], []) + "</div>";
  }

  /* =====================================================================================================================
     ANALYTICS (spec §2, §3, §6)
     @route  /docs/analytics?from=&to=&space=
     @perm   docs.spaces.manage (space-level numbers for managed spaces) · organization totals need docs.spaces.manage at the organization scope
     @api    GET /docs/analytics/{summary|health|coverage|acknowledgements|ai} ?space_id=&from=&to=
     @mcp    docs_spaces_manage (read)
     @data   Computable now: WikiPage (status, page_type, next_review_at, stale_flagged_at, last_edited_at, owner_membership_id, word_count, requires_acknowledgement) · WikiPageAcknowledgement · WikiPageVersion (edit activity) · WikiPageComment · WikiAiIndexEntry (status)
             · WikiChecklistRun · FormAssignmentRecipient · WikiAiSuggestion
     @ui     Card, Stat, bar and line charts, Table, Select range
     @states loading · empty ("Not enough data yet") · error · no-access
     @audit  none (read only)
     @note   Content health (stale, unowned, never reviewed, drafts older than 30 days), coverage (pages per space and type), edit activity from WikiPageVersion, acknowledgement and onboarding completion.
     @gap    READER analytics (views, unique readers, popular pages, search terms, "was this helpful") needs WikiPageView, a search log and page feedback: gaps-15.md #1, #2. Shown below as "needs data" and not faked.
     ===================================================================================================================== */
  function analytics() {
    const wk = [22, 31, 18, 40, 36, 28, 44, 39];
    return '<div class="a-page">' + head("Docs analytics", "How healthy and used the knowledge base is.", sel("Last 90 days") + sel("All spaces", "layers") + btn("Export", "file")) +
      '<div class="mini-stats">' + stat("Pages", 431, "+27 this quarter") + stat("Healthy", "88%", "not stale, owned, reviewed") + stat("Stale", 9, "NEEDS_REVIEW", 1) + stat("Orphaned", 5, "no owner", 1) + stat("Drafts over 30 days", 12, "unpublished", 1) + stat("AI index", "99.3%", "chunks indexed") + "</div>" +
      '<div class="g2">' + cd("<b>Edit activity</b><span class='r muted'>WikiPageVersion per week</span>", '<div class="bars">' + wk.map((v) => '<span style="height:' + v * 2 + 'px" title="' + v + ' versions"></span>').join("") + '</div><div class="sub-note">Weeks 38 to 45 · 258 versions by 31 editors</div>') +
      cd("<b>Pages by status</b>", [["PUBLISHED", 391, "green"], ["DRAFT", 31, "yellow"], ["NEEDS_REVIEW", 9, "red"], ["ARCHIVED", 120, ""]].map((r) => '<div class="bar-row"><span class="l">' + U.en(r[0]) + '</span><span class="tr"><i style="width:' + Math.round(r[1] / 4) + "%;background:var(--" + (r[2] || "mute") + ')"></i></span><span class="v">' + r[1] + "</span></div>").join("")) + "</div>" + gap() +
      '<div class="g2">' + cd("<b>Coverage by space</b>", tbl(["Space", ">Pages", ">Needs review", "Owner coverage", ">Avg age"], [["Engineering", 86, 3, bar(96, "green"), "112 d"], ["Operations", 41, 1, bar(100, "green"), "88 d"], ["People and HR", 58, 2, bar(91, "green"), "140 d"], ["Company handbook", 64, 3, bar(78), "205 d"]]), 1) +
      cd("<b>Reader analytics</b><span class='r'><span class='badge yellow'>needs data</span></span>", '<div class="sub-note" style="padding:14px 16px">Views, unique readers, most read pages, top searches and zero-result searches need a page view log and a search log that the schema does not have yet (gaps-15.md #1, #2). Not faked here.</div>', 1) + "</div>" + gap() +
      '<div class="g3">' + cd("<b>Acknowledgements</b>", [["Security baseline", 75], ["Code of conduct", 90], ["Remote work policy", 69]].map((r) => '<div class="rowx"><div class="grow">' + r[0] + "</div>" + bar(r[1]) + "</div>").join(""), 1) + cd("<b>Onboarding</b>", kv("Active runs", 6) + kv("Avg completion", "17 days") + kv("Overdue items", 3), 1) + cd("<b>AI usage</b>", kv("Questions (30 d)", 128) + kv("Answered with citations", "91%") + kv("Suggestions accepted", "14 of 22"), 1) + "</div>" +
      dm(["WikiPage · status, page_type, owner_membership_id, next_review_at, stale_flagged_at, last_edited_at", "WikiPageVersion · created_at, created_by_membership_id", "WikiPageAcknowledgement · WikiChecklistRun · FormAssignmentRecipient · WikiAiIndexEntry · WikiAiSuggestion"], ["Page views, readers, search log, helpfulness feedback (WikiPageView, WikiSearchQuery, WikiPageFeedback)"]) + "</div>";
  }

  /* =====================================================================================================================
     IMPORT AND EXPORT
     @route  /docs/import-export?tab=import|export
     @perm   import docs.pages.create (+ EDIT in the target space) · export a page docs.pages.read · bulk export of a space docs.spaces.manage · form response export docs.forms.export*
     @api    POST /docs/import {source: markdown|html|docx|notion|confluence|csv, space_id, parent_page_id, document_ids[]} · GET /docs/import/:jobId · POST /docs/export {scope: page|subtree|space, format: markdown|pdf|html|docx, include_attachments} · GET /docs/export/:jobId
     @mcp    docs_pages_create (import) · docs_pages_read (export)
     @data   WikiPage / WikiPageVersion / WikiPageAttachment written on import · Documents (17) for uploaded source files and generated export archives
     @ui     Tabs Import | Export, Dropzone (Documents upload), Select, Popover+Command for target, Progress for the job, Table of past jobs
     @states idle · uploading · parsing (progress) · preview with warnings (unsupported blocks) · done · failed with a downloadable report · no-access
     @audit  import started/finished (counts), export requested/downloaded (sensitive scopes)
     @note   Imports land as DRAFT pages with the importer as owner; links between imported pages are rewritten. Exports respect the caller's access: pages the caller cannot read are omitted from a subtree or space export.
             Export of an entire space is audited as a sensitive action.
     @gap    Import/export jobs have no table (job state, counts, errors) and there are no docs.pages.export / docs.pages.import keys: gaps-15.md #4.
     ===================================================================================================================== */
  function importExport() {
    return '<div class="a-page">' + head("Import and export", "Bring pages in from other tools, or take a copy out.", "") +
      '<div class="tabset">' + tabs([["i", "Import"], ["e", "Export"], ["h", "History", 6]], "i") +
      pane("i", 1, '<div class="g2" style="grid-template-columns:1.4fr 1fr;align-items:start"><div>' + cd("<b>Source</b>", '<div style="padding:14px 16px">' + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' + [["Markdown files", "md, zip", 1], ["Word documents", "docx", 0], ["HTML export", "html, zip", 0], ["Notion export", "zip", 0], ["Confluence export", "zip", 0], ["Google Docs", "from Drive", 0]].map((s) => '<div class="tp-card" style="' + (s[2] ? "border-color:var(--blue)" : "") + '"><div class="bd"><b>' + s[0] + "</b><small>" + s[1] + "</small></div></div>").join("") + '</div><div style="height:12px"></div><div class="drop2">' + I("clip", 18) + " Drop files here or choose from Documents (17)</div></div>") + gap() +
        cd("<b>Preview</b><span class='r muted'>24 files · 3 warnings</span>", [["Deploy guide.md", "OK", "green"], ["Onboarding.md", "OK", "green"], ["Old runbook.md", "2 unsupported blocks (embedded video) become links", "yellow"], ["Policies/Expense.md", "OK", "green"]].map((r) => '<div class="rowx">' + cb(1) + '<div class="grow"><b>' + r[0] + "</b><small>" + r[1] + "</small></div>" + E(r[2] === "green" ? "READY" : "WARNING", r[2]) + "</div>").join(""), 1) + "</div><div>" +
        cd("<b>Destination</b>", f("Space", sel("Engineering", "layers")) + f("Parent page", sel("Runbooks", "file")) + f("Page type", sel("General", "tag")) + f("Owner", sel("Me", "users")) + '<div class="rowx"><div class="grow"><b>Keep folder structure as nested pages</b></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Import as draft</b><small>Always on, publishing is a separate step</small></div>' + sw(1) + "</div>") + gap() + btn("Start import", "inbox", "primary") + "</div></div>") +
      pane("e", 0, '<div class="g2" style="align-items:start">' + cd("<b>What to export</b>", f("Scope", sel("A page and its sub-pages")) + f("Page or space", sel("Engineering / Runbooks", "file")) + f("Format", sel("Markdown (zip)")) + '<div class="rowx"><div class="grow"><b>Include attachments</b><small>Documents embedded in pages (17)</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Include comments and version history</b></div>' + sw(0) + "</div>") + cd("<b>Rules</b>", '<div class="sub-note" style="padding:12px 16px">Pages you cannot read are left out. Exporting a whole space needs docs.spaces.manage and is audited as a sensitive action. Form responses are exported from the form (docs.forms.export).</div>' + '<div style="padding:0 16px 14px">' + btn("Export", "file", "primary") + "</div>", 1) + "</div>") +
      pane("h", 0, tbl(["Job", "Type", "Scope", "Status", "By", "When"], [["IMP-0031", E("IMPORT", "blue"), "24 Markdown files to Engineering", E("COMPLETED", "green"), "Marco Silva", "Nov 6"], ["EXP-0019", E("EXPORT"), "Space: Operations (zip)", E("COMPLETED", "green"), "Anna Meyer", "Oct 30"], ["IMP-0030", E("IMPORT", "blue"), "Notion export to Company handbook", E("FAILED", "red"), "Sofia Jensen", "Oct 12"]])) + "</div>" +
      dm(["WikiPage · WikiPageVersion · WikiPageAttachment (written on import)", "Documents (17) · source files and export archives"], ["Import/export job table and the keys docs.pages.import, docs.pages.export (gaps-15.md #4)"]) + "</div>";
  }

  /* =====================================================================================================================
     TRASH AND ARCHIVE
     @route  /docs/trash?tab=archived|deleted&space=
     @perm   VIEW docs.pages.read · archive/unarchive docs.pages.archive · delete permanently docs.pages.delete* (sensitive) · restore from trash docs.pages.archive
     @api    GET /docs/pages?status=ARCHIVED · POST /docs/pages/:id/unarchive · GET /docs/trash · POST /docs/pages/:id/restore · DELETE /docs/pages/:id (permanent)
     @mcp    docs_pages_archive · docs_pages_delete (sensitive, confirmation when an AI agent calls it)
     @data   WikiPage (status ARCHIVED, archived_at) · WikiSpace (archived_at) · WikiPageVersion (kept on archive)
     @ui     Tabs Archived | Trash, Table with bulk bar (Restore, Delete forever), AlertDialog with typed confirmation for permanent delete
     @states loading · empty ("Nothing archived") · error · no-access
     @audit  page archived/unarchived/deleted (title, space, who)
     @note   ARCHIVE is a status (WikiPageStatus ARCHIVED + archived_at): hidden from the tree, search and AI index, reversible, versions kept. TRASH (soft delete with a retention window, e.g. 30 days, then purge) is not
             modelled: only archive and hard delete exist today.
     @gap    Soft-delete / trash retention needs WikiPage.deleted_at, deleted_by_membership_id and a purge job: gaps-15.md #3.
     ===================================================================================================================== */
  function trash() {
    const A = [["Old intranet home", "Legacy intranet", "RUNBOOK", "Oct 14", "Anna Meyer", 12], ["Q2 offsite plan", "Company handbook", "MEETING_NOTES", "Sep 30", "Kim Lund", 4], ["VPN setup (v1)", "Engineering", "PROCEDURE", "Sep 2", "Marco Silva", 7], ["Vendor list 2024", "Operations", "GENERAL", "Aug 19", "Anna Meyer", 2]];
    return '<div class="a-page">' + head("Archive and trash", "Archived pages are hidden but kept with all versions.", btn("Empty trash", "x")) +
      '<div class="tabset">' + tabs([["a", "Archived", 120], ["d", "Trash", 4]], "a") +
      pane("a", 1, '<div class="toolbar">' + search("Search archived pages") + sel("Space: any", "layers") + sel("Type: any") + "</div>" + filt([["Archived", "before", "Dec 1"]], btn("Save view", "plus", "sm")) +
        '<div class="bulk"><span class="cb on"></span><b>2 selected</b><span style="flex:1"></span>' + btn("Restore", "reply", "sm") + btn("Delete forever", "x", "sm") + "</div>" +
        '<div class="panel" style="margin-top:0"><table>' + th(["", "Page", "Space", "Type", "Archived", "By", ">Versions", ""]) + "<tbody>" + A.map((r, i) => "<tr><td>" + cb(i < 2) + "</td><td>" + ink(r[0]) + "</td><td>" + r[1] + "</td><td>" + ptp(r[2]) + "</td><td>" + r[3] + "</td><td>" + r[4] + "</td><td class='num'>" + r[5] + "</td><td>" + btn("Restore", "", "sm") + "</td></tr>").join("") + "</tbody></table></div>" + pager("1–4 of 120")) +
      pane("d", 0, callout("flag", "<b>Trash is not available yet.</b> Today a page is either archived (reversible) or permanently deleted (docs.pages.delete, sensitive). A 30 day recoverable trash needs a soft-delete column (gaps-15.md #3).") + gap(8) + tbl(["Page", "Deleted", "By", "Purges in"], [[ink("Sketch notes"), "Nov 5", "Anna Meyer", "24 days"], [ink("Draft: pricing"), "Nov 2", "Sofia Jensen", "21 days"]])) + "</div>" +
      dm(["WikiPage · status ARCHIVED, archived_at, title, space_id, page_type", "WikiPageVersion · count", "WikiSpace · archived_at"], ["Soft-delete trash with retention: WikiPage.deleted_at / purge job"]) + "</div>";
  }

  const MAP = { home, spaces, spaceNew, space, spaceSettings, page, pageNew, history, share, search: searchPage, templates, templateEdit, runbooks, onboarding, checklists, checklistEdit, runs, runDetail, reviews, forms, formBuilder, formResponses, ai, analytics, importExport, trash };
  const CRUMB = { page: "Production deploy runbook", history: "Version history", share: "Share", spaceNew: "New space", space: "Engineering", spaceSettings: "Engineering settings", pageNew: "New page", templateEdit: "Runbook template", checklistEdit: "Engineer onboarding", runDetail: "Lena Novak", formBuilder: "Engineering pulse survey", formResponses: "Responses" };
  window.VIEWS.docs = { html: function (s) { return (MAP[s || "home"] || MAP.home)(s); }, crumb: function (s) { return CRUMB[s] || ""; }, fill: false };
})();
