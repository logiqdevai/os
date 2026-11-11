/* =====================================================================================================================
   AUTOMATION APP — module 20 (docs/features/20-automation-engine.md). Rules, runs, scheduled jobs, event bus, webhooks, approvals, AI steps.
   =====================================================================================================================
   SCHEMA-ALIGNED to api/prisma/schema.prisma: AutomationSettings, AutomationTriggerDefinition, AutomationActionDefinition, AutomationRuleTemplate, AutomationRule, AutomationRuleVersion, PlatformEvent, AutomationRun,
   AutomationRunStep, AutomationApproval, AutomationAiStep, AutomationRunLock, ScheduledJob, ScheduledJobRun, OutboundWebhook, WebhookDelivery, AutomationInboundWebhook (+ ServiceAccount, SavedView, Tagging from 01/02).
   Enums are real values: AutomationTriggerKind (EVENT, SCHEDULE, DATE_RELATIVE, MANUAL, INBOUND_WEBHOOK), AutomationActionKind (UPDATE_FIELD, ADD_TAG, SET_CUSTOM_FIELD, CHANGE_STATUS, ASSIGN, CREATE_RECORD, NOTIFY,
   SEND_COMMUNICATION, POST_MESSAGE, MANAGE_CHANNEL, CALL_WEBHOOK, AI_STEP, WAIT, APPROVAL, BRANCH, CUSTOM), AutomationAssignStrategy (MEMBER, TEAM, ROUND_ROBIN, LEAST_LOADED), AutomationRuleScopeType (ORGANIZATION, BRANCH,
   TEAM, PROJECT_TYPE, PROJECT), AutomationRuleStatus (DRAFT, PUBLISHED, ARCHIVED), AutomationRunMode (LIVE, TEST, DRY_RUN), AutomationRunStatus (PENDING, RUNNING, WAITING, AWAITING_APPROVAL, RETRY_SCHEDULED, SUCCEEDED,
   FAILED, DEAD_LETTERED, SKIPPED, CANCELLED), AutomationStepStatus (PENDING, RUNNING, WAITING, AWAITING_APPROVAL, SUCCEEDED, FAILED, SKIPPED, CANCELLED), AutomationApprovalDecision (PENDING, APPROVED, REJECTED, EXPIRED,
   CANCELLED), AutomationAiStepKind (CLASSIFY, SUMMARIZE, EXTRACT, DRAFT), PlatformEventSource (MODULE, API, INBOUND_WEBHOOK, SCHEDULED_JOB, AUTOMATION, SYSTEM), ScheduledJobKind (CRON, INTERVAL, ONCE), ScheduledJobStatus
   (ACTIVE, PAUSED, DISABLED, COMPLETED), ScheduledJobRunStatus (PENDING, RUNNING, SUCCEEDED, FAILED, SKIPPED, CANCELLED, TIMED_OUT), OutboundWebhookStatus (ACTIVE, PAUSED, DISABLED), WebhookDeliveryStatus (PENDING,
   RETRY_SCHEDULED, SUCCEEDED, FAILED, DEAD_LETTERED), InboundWebhookStatus (ACTIVE, PAUSED, REVOKED), InboundWebhookAuthScheme (HMAC_SHA256, BEARER_TOKEN, BASIC, NONE).
   Permission keys (catalog, * = sensitive): automation.rules.read / create / update / delete* / enable* / run / manage* · automation.runs.read / manage* · automation.templates.manage · automation.approval_policies.manage* · automation.jobs.read / manage* · automation.webhooks.manage* ·
   automation.settings.manage* · automation.service_accounts.manage* · automation.actions.destructive.enable*.
   Comment tags (legend in README.md): @screen @route @perm @api @mcp @data @ui @states @audit @note @gap. Every screen ends with a "Data model" footer (REVIEW-ONLY, do not ship).

   RULES THAT APPLY TO EVERY SCREEN HERE:
     - Modules publish EVENTS (PlatformEvent) and expose ACTIONS (AutomationActionDefinition). The engine evaluates rules and executes actions. Mandatory module logic (contract immutability, ledger rules, permission checks) stays in the
       module and can never be a rule or be bypassed by one (spec §1, §6).
     - A rule = trigger + conditions + ordered actions. The LIVE definition is on AutomationRule (trigger_*, conditions, actions); every publish writes an immutable AutomationRuleVersion and bumps current_version. Only
       status PUBLISHED and enabled = true runs. A run stores the rule_version it executed.
     - Execution identity: a rule runs as its owner membership or as a ServiceAccount (run_as_service_account_id, 01 §76) and every action goes through the central authorization service with that principal. Never elevated rights.
       A user can only build rules whose actions they could perform themselves, or that run under a service account they manage (automation.service_accounts.manage).
     - Guardrails: destructive and customer-facing actions need AutomationSettings.destructive_actions_enabled (automation.actions.destructive.enable*) and can require approval. Loop depth (max_trigger_depth), rate limits
       (org / rule), retries with backoff, dead-letter with alert, idempotency key per run and per step, optional per-record serialization (AutomationRunLock).
     - AI steps use the shared AI layer; provider keys are per organization (IntegrationConnection, BYOK, OPENAI only here). AI output has confidence and a threshold; AI never runs irreversible actions by itself.
     - Every screen is built for all access channels at once: UI, REST, MCP tool <module>_<resource>_<action>, API key / service account, webhooks. Lists are filtered server-side by branch/team/project scope of the rule.
   ===================================================================================================================== */
(function () {
  const U = window.UI;
  const { E, ES, head, btn, cd, sw, cb, sel, stat, search, who, tok, kv, muted, more, callout, dm, tabs, pane } = U;
  const I = (n, s) => LQ.icon(n, s);
  const AV = LQ.av;
  const th = (a) => "<thead><tr>" + a.map((x) => "<th" + (x[0] === ">" ? ' class="num"' : "") + ">" + x.replace(/^>/, "") + "</th>").join("") + "</tr></thead>";
  const tbl = (cols, rows) => '<div class="panel tbl-x" style="margin-top:0"><table>' + th(cols) + "<tbody>" + rows.map((r) => "<tr>" + r.map((c, i) => "<td" + (cols[i][0] === ">" ? ' class="num"' : "") + ">" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  const bar = (p, tone) => '<span class="bar"><i style="width:' + p + "%" + (tone ? ";background:var(--" + tone + ")" : "") + '"></i></span>' + p + "%";
  const ink = (t) => '<span class="ink">' + t + "</span>";
  const mono = (t) => '<span class="mono">' + t + "</span>";
  const gap = () => "";
  const fld = (l, h, hint) => '<div class="fld"><label>' + l + "</label>" + h + (hint ? '<div class="sub-note">' + hint + "</div>" : "") + "</div>";
  const box = (t) => '<div class="input-fake">' + t + "</div>";
  const two = (a, b) => '<div class="rowx" style="gap:8px;padding:0;align-items:flex-start"><div style="flex:1">' + a + '</div><div style="flex:1">' + b + "</div></div>";
  const sp = (h) => '<div style="height:' + (h || 12) + 'px"></div>';
  const trow = (t, s, r, on) => '<div class="rowx"><div class="grow"><b>' + t + "</b><small>" + s + "</small></div>" + (r === undefined ? "" : r) + "</div>";
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const js = (o) => '<pre class="json">' + esc(typeof o === "string" ? o : JSON.stringify(o, null, 2)).replace(/&quot;/g, '"').replace(/"([A-Za-z0-9_.$-]+)":/g, '<span class="k">"$1"</span>:').replace(/: ("[^"]*")/g, ': <span class="s">$1</span>') + "</pre>";
  const seg = (arr, on) => '<div class="rowx" style="gap:6px;padding:0;flex-wrap:wrap">' + arr.map((t) => '<span class="seg' + (t === on ? " on" : "") + '">' + t + "</span>").join("") + "</div>";
  const filterBar = (chips, extra) => window.UI.filters ? window.UI.filters.filterBar(chips, extra) : "";
  const PEOPLE = { AM: ["Anna Meyer", ""], MS: ["Marco Silva", "g"], SJ: ["Sofia Jensen", "y"], JK: ["Jonas Koch", "r"], KL: ["Kim Lund", "p"] };
  const wh = (a) => who(a, PEOPLE[a][1], PEOPLE[a][0], "");
  const SA = '<span class="badge purple" title="run_as_service_account_id">' + "service account</span>";

  /* @impl Status colours per enum, semantic tokens only. Same maps in every list so a status always looks the same. */
  const RC = { SUCCEEDED: "green", FAILED: "red", DEAD_LETTERED: "red", RUNNING: "blue", WAITING: "yellow", AWAITING_APPROVAL: "purple", RETRY_SCHEDULED: "yellow", PENDING: "", SKIPPED: "", CANCELLED: "", TIMED_OUT: "red", PUBLISHED: "green", DRAFT: "yellow", ARCHIVED: "", ACTIVE: "green", PAUSED: "yellow", DISABLED: "", COMPLETED: "blue", REVOKED: "red", APPROVED: "green", REJECTED: "red", EXPIRED: "", LIVE: "", TEST: "blue", DRY_RUN: "purple" };
  const st = (v) => ES(v, RC[v] || "");
  const kindLbl = (k) => E(k, "");

  /* trigger catalog (AutomationTriggerDefinition) — key, module, name, kind, entity_type, permission, notifiable, webhook_subscribable, version */
  const TRG = [
    ["crm.lead.created", "CRM", "Lead created", "EVENT", "CRM_LEAD", "crm.leads.read", 1, 1, 2],
    ["crm.deal.stage_changed", "CRM", "Deal stage changed", "EVENT", "CRM_DEAL", "crm.deals.read", 1, 1, 3],
    ["crm.deal.inactive", "CRM", "Deal inactive for N days", "DATE_RELATIVE", "CRM_DEAL", "crm.deals.read", 1, 0, 1],
    ["proposals.proposal.accepted", "PROPOSALS", "Proposal accepted", "EVENT", "PROPOSAL", "proposals.proposals.read", 1, 1, 2],
    ["contracts.contract.fully_signed", "CONTRACTS", "Contract fully signed", "EVENT", "CONTRACT", "contracts.contracts.read", 1, 1, 2],
    ["contracts.contract.expiring", "CONTRACTS", "Contract expiring in N days", "DATE_RELATIVE", "CONTRACT", "contracts.contracts.read", 1, 0, 1],
    ["projects.project.status_changed", "PROJECTS", "Project status changed", "EVENT", "PROJECT", "projects.projects.read", 1, 1, 2],
    ["tasks.task.overdue", "TASKS", "Task overdue", "EVENT", "TASK", "tasks.tasks.read", 1, 0, 1],
    ["finance.invoice.overdue", "FINANCE", "Invoice overdue", "EVENT", "INVOICE", "finance.invoices.read", 1, 1, 2],
    ["finance.payment.failed", "FINANCE", "Payment failed", "EVENT", "PAYMENT", "finance.invoices.read", 1, 1, 1],
    ["support.ticket.created", "SUPPORT", "Ticket created", "EVENT", "TICKET", "support.tickets.read", 1, 1, 2],
    ["support.sla.at_risk", "SUPPORT", "SLA at risk", "EVENT", "TICKET", "support.tickets.read", 1, 0, 1],
    ["employees.leave.requested", "EMPLOYEES", "Leave requested", "EVENT", "LEAVE_REQUEST", "employees.leave.read", 1, 1, 1],
    ["schedule.cron", "AUTOMATION", "Schedule (cron or interval)", "SCHEDULE", "", "", 0, 0, 1],
    ["manual.run", "AUTOMATION", "Run manually", "MANUAL", "", "", 0, 0, 1],
    ["inbound.webhook", "AUTOMATION", "Inbound webhook received", "INBOUND_WEBHOOK", "", "automation.webhooks.manage", 0, 0, 1],
  ];
  /* action catalog (AutomationActionDefinition) — key, module, name, kind, entity_type, permission, destructive, customer_facing, idempotent, retryable, builtin */
  const ACT = [
    ["crm.deal.change_stage", "CRM", "Change deal stage", "CHANGE_STATUS", "CRM_DEAL", "crm.deals.change_stage", 0, 0, 1, 1, 0],
    ["crm.lead.assign", "CRM", "Assign lead", "ASSIGN", "CRM_LEAD", "crm.leads.assign", 0, 0, 1, 1, 0],
    ["tasks.create", "TASKS", "Create task", "CREATE_RECORD", "TASK", "tasks.tasks.create", 0, 0, 0, 1, 0],
    ["tasks.update", "TASKS", "Update task field", "UPDATE_FIELD", "TASK", "tasks.tasks.update", 0, 0, 1, 1, 0],
    ["projects.create_from_template", "PROJECTS", "Create project from template", "CREATE_RECORD", "PROJECT", "projects.projects.create", 0, 0, 0, 1, 0],
    ["contracts.create_from_template", "CONTRACTS", "Create contract from template", "CREATE_RECORD", "CONTRACT", "contracts.contracts.create", 0, 0, 0, 1, 0],
    ["support.ticket.create", "SUPPORT", "Create ticket", "CREATE_RECORD", "TICKET", "support.tickets.create", 0, 0, 0, 1, 0],
    ["calendar.event.create", "CALENDAR", "Create calendar event", "CREATE_RECORD", "CALENDAR_EVENT", "calendar.events.manage", 0, 0, 0, 1, 0],
    ["notifications.notify", "NOTIFICATIONS", "Notify recipients", "NOTIFY", "", "", 0, 0, 1, 1, 0],
    ["communications.send_template", "COMMUNICATION", "Send email or SMS from template", "SEND_COMMUNICATION", "COMM_MESSAGE", "communications.messages.send", 0, 1, 0, 1, 0],
    ["messaging.post_message", "MESSAGING", "Post message to channel", "POST_MESSAGE", "CHANNEL", "messaging.messages.post", 0, 0, 0, 1, 0],
    ["messaging.channel.manage", "MESSAGING", "Create or archive channel", "MANAGE_CHANNEL", "CHANNEL", "messaging.channels.create", 0, 0, 1, 1, 0],
    ["records.delete", "AUTOMATION", "Delete record", "CUSTOM", "", "automation.actions.destructive.enable", 1, 0, 1, 0, 0],
    ["engine.add_tag", "AUTOMATION", "Add tag", "ADD_TAG", "", "", 0, 0, 1, 1, 1],
    ["engine.set_custom_field", "AUTOMATION", "Set custom field", "SET_CUSTOM_FIELD", "", "", 0, 0, 1, 1, 1],
    ["engine.call_webhook", "AUTOMATION", "Call outbound webhook", "CALL_WEBHOOK", "", "automation.webhooks.manage", 0, 0, 0, 1, 1],
    ["engine.ai_step", "AUTOMATION", "Run AI step", "AI_STEP", "", "", 0, 0, 1, 1, 1],
    ["engine.wait", "AUTOMATION", "Wait for duration or date", "WAIT", "", "", 0, 0, 1, 0, 1],
    ["engine.approval", "AUTOMATION", "Require human approval", "APPROVAL", "", "", 0, 0, 1, 0, 1],
    ["engine.branch", "AUTOMATION", "Conditional branch", "BRANCH", "", "", 0, 0, 1, 0, 1],
  ];
  /* rules (AutomationRule): id, name, module, status, enabled, trigger_kind, trigger_key, scope, run as, runs, failures, last run, last status, version, owner, updated */
  const RULES = [
    ["wf-deal-won", "Deal won → create project from template", "CRM", "PUBLISHED", 1, "EVENT", "crm.deal.stage_changed", "ORGANIZATION", "Automation · Sales", 214, 3, "12 min ago", "SUCCEEDED", 7, "AM", "Nov 9"],
    ["wf-invoice-overdue", "Invoice 7 days overdue → reminder and task", "FINANCE", "PUBLISHED", 1, "EVENT", "finance.invoice.overdue", "BRANCH · Berlin", "Automation · Finance", 96, 11, "1 h ago", "RETRY_SCHEDULED", 4, "MS", "Nov 4"],
    ["wf-contract-expiring", "Contract expiring in 30 days → notify owner", "CONTRACTS", "PUBLISHED", 1, "DATE_RELATIVE", "record.date_relative", "ORGANIZATION", "Owner", 41, 0, "Today 06:00", "SUCCEEDED", 3, "SJ", "Oct 28"],
    ["wf-ticket-triage", "New ticket → AI classify and route", "SUPPORT", "PUBLISHED", 1, "EVENT", "support.ticket.created", "TEAM · Support EU", "Automation · Support", 1840, 22, "2 min ago", "AWAITING_APPROVAL", 12, "KL", "Nov 10"],
    ["wf-weekly-digest", "Weekly project status digest", "PROJECTS", "PUBLISHED", 1, "SCHEDULE", "schedule.cron", "ORGANIZATION", "Owner", 44, 1, "Mon 08:00", "SUCCEEDED", 2, "JK", "Sep 15"],
    ["wf-leave-approval", "Leave request → manager approval", "EMPLOYEES", "PUBLISHED", 1, "EVENT", "employees.leave.requested", "ORGANIZATION", "Automation · HR", 58, 0, "Yesterday", "WAITING", 5, "SJ", "Oct 2"],
    ["wf-payment-failed", "Payment failed → dunning email", "FINANCE", "DRAFT", 0, "EVENT", "finance.payment.failed", "BRANCH · Berlin", "Automation · Finance", 0, 0, "—", "", 1, "MS", "Nov 10"],
    ["wf-web-leads", "Website form lead → create lead and assign", "CRM", "PUBLISHED", 1, "INBOUND_WEBHOOK", "inbound.webhook", "ORGANIZATION", "Automation · Sales", 389, 14, "8 min ago", "FAILED", 6, "AM", "Nov 1"],
    ["wf-sla-escalate", "SLA at risk → escalate to lead", "SUPPORT", "PUBLISHED", 0, "EVENT", "support.sla.at_risk", "TEAM · Support EU", "Automation · Support", 73, 5, "Nov 2", "SUCCEEDED", 3, "KL", "Nov 2"],
    ["wf-kickoff", "Create project kickoff pack", "PROJECTS", "PUBLISHED", 1, "MANUAL", "manual.run", "PROJECT_TYPE · Website", "Owner", 17, 0, "Nov 6", "SUCCEEDED", 2, "JK", "Oct 20"],
    ["wf-onboarding-old", "Old onboarding checklist (replaced)", "TASKS", "ARCHIVED", 0, "EVENT", "crm.deal.stage_changed", "ORGANIZATION", "Owner", 120, 9, "Aug 30", "SUCCEEDED", 4, "AM", "Sep 1"],
  ];
  const TKCOL = { EVENT: "", SCHEDULE: "blue", DATE_RELATIVE: "yellow", MANUAL: "", INBOUND_WEBHOOK: "purple" };
  const ruleRow = (r) => [cb(0), ink(r[1]) + '<small class="muted" style="display:block">' + mono(r[0]) + "</small>", E(r[2]), E(r[3], RC[r[3]]) + " " + (r[4] ? "" : '<span class="badge" title="enabled = false">Off</span>'), E(r[5], TKCOL[r[5]]) + '<small class="muted" style="display:block">' + mono(r[6]) + "</small>", r[7], r[8] === "Owner" ? "Owner" : SA + " " + r[8], "v" + r[13], r[9], r[10] ? '<span class="badge ' + (r[10] / Math.max(r[9], 1) > 0.05 ? "red" : "") + '">' + r[10] + "</span>" : "0", r[12] ? r[11] + "<br>" + st(r[12]) : muted("Never"), wh(r[14]), more];

  /* =====================================================================================================================
     OVERVIEW (spec §2, §6, §8)
     @route  /automation/overview
     @perm   VIEW automation.rules.read · run numbers need automation.runs.read · jobs need automation.jobs.read · attention items for webhooks need automation.webhooks.manage*
     @api    GET /automation/overview (aggregates) · GET /automation/runs?status=&since= · GET /automation/rules?sort=failure_count
     @mcp    automation_rules_read · automation_runs_read · automation_jobs_read
     @data   AutomationRun (status, created_at, duration_ms) · AutomationRule (run_count, failure_count, last_run_status, enabled) · AutomationApproval (decision PENDING) · WebhookDelivery (DEAD_LETTERED) · ScheduledJob (consecutive_failures)
     @ui     Card, Progress, bar chart (recharts), Table, Badge, Alert
     @states loading skeleton · empty ("No workflows yet" + templates CTA) · error · no-access (card hidden when the key is missing, never an empty zero)
     @note   Everything here is computed from run rows (nothing is stored separately). "Needs attention" is the daily inbox of an operator: dead letters, pending approvals, rules with a failure rate above 5%, disabled outbound
             webhooks and jobs with consecutive failures. Every number links to the filtered list.
     ===================================================================================================================== */
  function overview() {
    const days = [[30, 2, 1], [34, 1, 0], [28, 3, 1], [40, 2, 2], [12, 0, 0], [9, 0, 0], [38, 4, 1], [44, 2, 1], [47, 5, 2], [41, 3, 0], [36, 2, 1], [8, 0, 0], [10, 1, 0], [52, 6, 3]];
    const mx = 70;
    return '<div class="a-page">' + head("Automation", "When something happens, do something: workflows, runs, schedules and webhooks.", btn("Templates", "layers") + btn("New workflow", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Active workflows", 8, "of 11 · 1 draft") + stat("Runs (24 h)", 312, "98.1% succeeded") + stat("Failed", 6, "last 24 h", 1) + stat("Dead-lettered", 2, "need action", 1) + stat("Awaiting approval", 3, "oldest 5 h") + stat("Scheduled jobs", 14, "2 paused") + "</div>" +
      '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div>' +
      cd("<b>Runs per day</b><span class='r muted'>AutomationRun · last 14 days</span>", '<div class="chart">' + days.map((d) => '<span style="height:' + Math.round((d[0] + d[1] + d[2]) / mx * 100) + '%" title="' + d[0] + ' succeeded, ' + d[1] + ' waiting, ' + d[2] + ' failed"><i class="bd" style="height:' + d[2] / (d[0] + d[1] + d[2]) * 100 + '%"></i><i class="wt" style="height:' + d[1] / (d[0] + d[1] + d[2]) * 100 + '%"></i><i class="ok" style="height:' + d[0] / (d[0] + d[1] + d[2]) * 100 + '%"></i></span>').join("") + '</div><div class="lg"><span><i style="background:var(--green)"></i>Succeeded</span><span><i style="background:var(--yellow)"></i>Waiting / approval / retry</span><span><i style="background:var(--red)"></i>Failed / dead-lettered</span></div>') + sp() +
      cd("<b>Recent runs</b><span class='r'>" + btn("All runs", "list", "sm") + "</span>", tbl(["Workflow", "Trigger", "Mode", "Status", ">Duration", "Started"], [[ink("Deal won → create project from template"), mono("crm.deal.stage_changed"), E("LIVE"), st("SUCCEEDED"), "2.4 s", "12 min ago"], [ink("New ticket → AI classify and route"), mono("support.ticket.created"), E("LIVE"), st("AWAITING_APPROVAL"), "—", "2 min ago"], [ink("Website form lead → create lead and assign"), mono("inbound.webhook"), E("LIVE"), st("FAILED"), "0.8 s", "8 min ago"], [ink("Invoice 7 days overdue → reminder and task"), mono("finance.invoice.overdue"), E("LIVE"), st("RETRY_SCHEDULED"), "6.1 s", "1 h ago"], [ink("Weekly project status digest"), mono("schedule.cron"), E("TEST", "blue"), st("SUCCEEDED"), "9.3 s", "Today 08:00"]]).replace('class="panel tbl-x" style="margin-top:0"', 'class="tbl-x"'), 1) +
      "</div><div>" +
      cd("<b>Needs attention</b><span class='r muted'>inbox of an operator</span>",
        '<div class="rowl">' + I("flag", 16) + '<div class="grow"><b>2 dead-lettered runs</b><small>Website form lead · Invoice reminder · alerts on</small></div>' + btn("Open", "", "sm") + "</div>" +
        '<div class="rowl">' + I("check", 16) + '<div class="grow"><b>3 approvals waiting</b><small>Leave request, ticket reply, kickoff email</small></div>' + btn("Review", "", "sm") + "</div>" +
        '<div class="rowl">' + I("zap", 16) + '<div class="grow"><b>Website form lead: 3.6% failing</b><small>14 of 389 runs failed, mostly HTTP 422 from Stripe mapping</small></div>' + btn("Open", "", "sm") + "</div>" +
        '<div class="rowl">' + I("globe", 16) + '<div class="grow"><b>Webhook "Zapier · CRM sync" disabled</b><small>disabled_reason: 10 consecutive failures</small></div>' + btn("Fix", "", "sm") + "</div>" +
        '<div class="rowl">' + I("clock", 16) + '<div class="grow"><b>Job support.sla_timers failed 3 times in a row</b><small>consecutive_failures 3 of max_retries 3</small></div>' + btn("Open", "", "sm") + "</div>", 1) + sp() +
      cd("<b>Engine limits</b><span class='r muted'>AutomationSettings</span>", '<div class="rowl"><div class="grow"><b>Organization rate limit</b><small>312 of 1,000 runs this hour</small></div><div style="width:110px"><div class="gauge"><i style="width:31%"></i></div></div></div><div class="rowl"><div class="grow"><b>Loop protection</b><small>max_trigger_depth 3 · 0 runs stopped today</small></div></div><div class="rowl"><div class="grow"><b>Destructive actions</b><small>Enabled by Anna Meyer Oct 2 · approval required</small></div>' + sw(1) + "</div>", 1) + sp() +
      callout("sparkles", "<b>Tip.</b> Start from a template: 23 ready recipes for sales, finance, support and projects. Every template is a normal rule you can edit.") +
      "</div></div>" +
      dm(["AutomationRun · status, mode, duration_ms, created_at", "AutomationRule · enabled, run_count, failure_count, last_run_status", "AutomationApproval · decision", "WebhookDelivery · status DEAD_LETTERED · OutboundWebhook · status, disabled_reason", "ScheduledJob · consecutive_failures · AutomationSettings"], []) + "</div>";
  }

  /* =====================================================================================================================
     WORKFLOWS LIST — filters, saved views, bulk actions (spec §5)
     @route  /automation/workflows?view=<savedViewId>&filter=<json>&sort=&q=&status=&module=&trigger=&scope=&owner=
     @perm   VIEW automation.rules.read · enable / disable automation.rules.enable* · create / duplicate / import automation.rules.create · edit automation.rules.update · "Run now" on a MANUAL rule automation.rules.run · archive / delete automation.rules.delete*
     @api    GET /automation/rules?filter=&sort=&q=&cursor= · POST /automation/rules/bulk {ids|filter, action: enable|disable|archive|duplicate|set_owner|set_run_as|add_tag} · GET /automation/rules/:id/export · POST /automation/rules/import · GET/POST /saved-views?entity_type=AUTOMATION_RULE
     @mcp    automation_rules_read · automation_rules_update · automation_rules_enable · automation_rules_delete
     @data   AutomationRule (name, module, status, enabled, trigger_kind, trigger_key, scope_type, run_as_service_account_id, owner_membership_id, run_count, failure_count, last_run_at, last_run_status, current_version, updated_at, template_id, imported_from) · Tagging (entity AUTOMATION_RULE) · SavedView (entity_type AUTOMATION_RULE)
     @ui     Table with column chooser, filter bar, Popover+Command pickers, sticky bulk bar, DropdownMenu row actions, Dialog for "Save view", Tabs for the status groups
     @states loading skeleton · empty ("No workflows match" + clear filters; first run: templates CTA) · error · no-access · enable button disabled with reason when automation.rules.enable is missing
     @audit  rule created, edited, published, enabled, disabled, archived, owner or run-as changed, exported, imported (one audit event per rule for bulk)
     @note   Failure rate = failure_count / run_count, shown red above 5%. "Off" means enabled = false (a PUBLISHED rule that is switched off); only PUBLISHED + enabled runs. Enabling a rule that contains destructive
             actions needs automation.actions.destructive.enable* and the organization switch. Archived rules keep history and can be restored. Select all selects by FILTER, the API re-evaluates it.
     ===================================================================================================================== */
  function workflows() {
    return '<div class="a-page">' + head("Workflows", "Every rule of the organization with its trigger, scope and health.", btn("Import", "file") + btn("Templates", "layers") + btn("New workflow", "plus", "primary")) +
      '<div class="tabset">' + tabs([["all", "All", 11], ["pub", "Published", 9], ["dr", "Draft", 1], ["ar", "Archived", 1], ["fail", "Failing", 3]], "all") + "</div>" +
      '<div class="toolbar">' + search("Search name, trigger key, description") + sel("Module: All", "grid") + sel("Trigger: All", "zap") + sel("Scope: All", "building") + sel("Owner: Anyone", "users") + sel("Run as: Any", "key") + sel("Sort: Last run", "sort") + sel("Columns (11)", "settings") + sel("Views: Needs attention", "star") + "</div>" +
      filterBar([["Status", "is", "Published"], ["Enabled", "is", "true"], ["Failure rate", "above", "5%"], ["Tag", "is any of", "sales, billing"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="bulk"><span class="cb on"></span><b>3 selected</b><span class="muted">select all 11 matching</span><span style="flex:1"></span>' + btn("Enable", "check", "sm") + btn("Disable", "x", "sm") + sel("Change owner…", "users") + sel("Run as…", "key") + sel("Add tag…", "tag") + btn("Duplicate", "layers", "sm") + btn("Export", "file", "sm") + btn("Archive", "x", "sm") + "</div>" +
      tbl(["", "Workflow", "Module", "Status", "Trigger", "Scope", "Runs as", "Ver", ">Runs", ">Failed", "Last run", "Owner", ""], RULES.map((r, i) => { const x = ruleRow(r); x[0] = cb(i < 3); return x; })) +
      '<div class="pager"><span class="muted">1–11 of 11</span><span style="flex:1"></span>' + btn("Previous", "", "sm") + btn("Next", "", "sm") + "</div>" +
      callout("shield", "<b>Row actions</b> (DropdownMenu): Open builder · Run now (manual rules) · Test with sample event · Duplicate · Export JSON · View runs · Copy ID · Archive. Rules are listed only inside the caller's branch / team / project scope.") +
      dm(["AutomationRule · name, module, status, enabled, trigger_kind, trigger_key, scope_type, run_as_service_account_id, owner_membership_id, run_count, failure_count, last_run_at, last_run_status, current_version, imported_from", "Tagging · entity_type AUTOMATION_RULE (platform table) · SavedView · entity_type AUTOMATION_RULE, layout, visibility, filters, sorting, columns"], []) + "</div>";
  }

  /* =====================================================================================================================
     CREATE WORKFLOW — wizard as a full page (spec §5, §6, §10, §14)
     @route  /automation/workflows/new?template=<key>&from=<ruleId>&module=
     @perm   automation.rules.create · run as a service account needs automation.service_accounts.manage* on that account (or the account is delegated to the caller) · destructive allowance needs automation.actions.destructive.enable*
     @api    POST /automation/rules {name, description, module, template_id?, duplicated_from_rule_id?, imported_from?, trigger_kind, trigger_key, trigger_config, entity_type, scope_type, branch_id|team_id|project_type_id|project_id,
             owner_membership_id, run_as_service_account_id, idempotency_key_template, serialize_per_record, max_retries, retry_backoff_seconds, rate_limit_per_hour, max_trigger_depth, allow_destructive_actions, require_approval_for_destructive, timeout_seconds, conditions, actions}
     @mcp    automation_rules_create
     @data   AutomationRule (every column above; status DRAFT, enabled false on create) · AutomationRuleTemplate (definition, variables → copied, usage_count + 1) · AutomationTriggerDefinition · ServiceAccount · Branch / Team / ProjectType / Project (scope)
     @ui     Sectioned form with a step nav, Card-radio group for "Start from", Select / Popover+Command pickers, Switch, Dialog for JSON import, DatePicker. Ends in the builder (the next screen) with a draft saved
     @states validation inline (name unique per organization, trigger required, run-as account must be ACTIVE and not expired) · saving · created (opens the builder) · permission error on a field disables it with the reason
     @audit  rule created (with template, duplicate or import source)
     @note   A new rule is a DRAFT and never runs until it is published AND enabled. Scope narrows where the rule fires: ORGANIZATION, BRANCH, TEAM, PROJECT_TYPE or PROJECT (the matching *_id is required). "Run as" defaults to
             AutomationSettings.default_service_account_id when set, otherwise the owner. Choosing a service account shows its role summary; actions the account cannot perform are flagged in the builder, not at runtime.
             Template variables (AutomationRuleTemplate.variables) are asked here (e.g. days before, pipeline stage) and substituted into the copied definition.
     ===================================================================================================================== */
  function create() {
    const nav = ["Start from", "Trigger", "Scope and owner", "Run as and safety", "Review"];
    return '<div class="a-page">' + head("New workflow", "A new workflow is a draft until you publish and enable it.", btn("Cancel") + btn("Save draft", "") + btn("Create and open builder", "plus", "primary")) +
      '<div class="wz"><div class="wz-nav">' + nav.map((n, i) => '<a class="' + (i < 2 ? "done" : i === 2 ? "on" : "") + '"><span class="n">' + (i + 1) + "</span>" + n + "</a>").join("") + "</div><div>" +
      cd("<b>1 · Start from</b>", '<div class="opt"><div><b>Blank</b><small>Pick a trigger and add steps</small></div><div class="on"><b>Template</b><small>AutomationRuleTemplate · 23 available</small></div><div><b>Duplicate</b><small>Copy an existing workflow (duplicated_from_rule_id)</small></div><div><b>Import</b><small>JSON export file (imported_from)</small></div></div>' + sp() +
        fld("Template", sel("Deal won → create project from template · CRM · used 41 times", "layers"), "Variables below are filled into the copied definition.") + two(fld("Pipeline stage (variable)", sel("Won")), fld("Project template (variable)", sel("Website build · 14 tasks", "folder")))) + sp() +
      cd("<b>2 · Name and trigger</b>", fld("Name", box("Deal won → create project from template")) + fld("Description", box("Creates the project, assigns the PM and notifies finance when a deal is won.")) + two(fld("Module", sel("CRM", "grid")), fld("Record type (entity_type)", sel("CRM deal", "crm"))) +
        fld("Trigger kind", seg(["EVENT", "SCHEDULE", "DATE_RELATIVE", "MANUAL", "INBOUND_WEBHOOK"].map((k) => U.en(k)), "Event")) + fld("Trigger (catalog)", sel("crm.deal.stage_changed · Deal stage changed", "zap"), "Registered by CRM (02) in AutomationTriggerDefinition. Shows only triggers whose required_permission you hold.") +
        fld("Trigger filter (trigger_config)", '<div class="cond"><span class="f">to_stage</span><span class="o">is</span><span class="v">Won</span></div><div class="cond"><span class="f">pipeline</span><span class="o">is any of</span><span class="v">Sales, Agency retainers</span></div>' + btn("Add filter", "plus", "sm"), "Cheap filters evaluated before the rule is considered. Deeper checks belong in the condition step.") +
        '<div class="sub-note">SCHEDULE shows the cron builder (see Scheduled jobs). DATE_RELATIVE asks for date field (from AutomationTriggerDefinition.date_fields), offset in days and before / after.</div>') + sp() +
      cd("<b>3 · Scope and owner</b>", fld("Scope (scope_type)", seg(["Organization", "Branch", "Team", "Project type", "Project"], "Branch")) + two(fld("Branch", sel("Berlin", "building")), fld("Owner", sel("Anna Meyer", "users"))) +
        '<div class="sub-note">Only records inside this scope can fire the rule. PROJECT_TYPE and PROJECT scopes come from Projects (05).</div>' + sp(8) + fld("Tags", sel("sales, onboarding", "tag"), "Tagging rows on AUTOMATION_RULE (platform table).")) + sp() +
      cd("<b>4 · Run as and safety</b>", fld("Run as", seg(["Owner (Anna Meyer)", "Service account"], "Service account"), "Actions are checked against this principal with the same central authorization as the UI and the API.") + fld("Service account", sel("Automation · Sales  ·  ACTIVE · 11 permissions · expires never", "key"), "automation.service_accounts.manage* needed to pick an account you do not own. Default comes from Settings.") +
        two(fld("Max retries", box("3")), fld("Retry backoff (seconds)", box("60"))) + two(fld("Rate limit per hour", box("Organization default (200)")), fld("Max trigger depth", box("Organization default (3)"))) + two(fld("Timeout (seconds)", box("120")), fld("Idempotency key template", box("{{event.id}}"))) +
        '<div class="rowx"><div class="grow"><b>Serialize per record</b><small>Runs for the same record execute one at a time (AutomationRunLock)</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Allow destructive actions</b><small>Needs automation.actions.destructive.enable* and the organization switch</small></div>' + sw(0) + '</div><div class="rowx"><div class="grow"><b>Require approval for destructive and customer-facing steps</b><small>require_approval_for_destructive</small></div>' + sw(1) + "</div>") + sp() +
      cd("<b>5 · Review</b>", '<div class="flow-mini"><span>Deal stage changed to Won</span>→<span>If amount ≥ 5,000</span>→<span>Create project from template</span>→<span>Assign least loaded PM</span>→<span>Notify finance</span></div>' + sp(8) + '<div class="sub-note">Creates draft v1. You finish steps in the builder, test with a sample event, then publish (version 1) and enable.</div>') +
      "</div></div>" +
      dm(["AutomationRule · name, description, module, entity_type, trigger_kind, trigger_key, trigger_config, scope_type, branch_id, team_id, project_type_id, project_id, owner_membership_id, run_as_service_account_id, max_retries, retry_backoff_seconds, rate_limit_per_hour, max_trigger_depth, timeout_seconds, idempotency_key_template, serialize_per_record, allow_destructive_actions, require_approval_for_destructive, template_id, duplicated_from_rule_id, imported_from", "AutomationRuleTemplate · definition, variables · AutomationTriggerDefinition · ServiceAccount · Tagging"], []) + "</div>";
  }

  /* =====================================================================================================================
     WORKFLOW BUILDER — node canvas with side configuration (spec §3, §4, §5, §9)
     @route  /automation/workflows/:ruleId/builder?node=<step key>&tab=node|rule|test
     @perm   edit automation.rules.update · publish and enable automation.rules.enable* · test and dry run automation.rules.read (read-only side effects: DRY_RUN) · destructive steps need automation.actions.destructive.enable*
     @api    GET /automation/rules/:id · PUT /automation/rules/:id/draft {trigger_*, conditions, actions} · POST /automation/rules/:id/test {event|sample, mode: TEST|DRY_RUN} · POST /automation/rules/:id/publish {change_summary} ·
             GET /automation/triggers · GET /automation/actions · POST /automation/rules/:id/validate
     @mcp    automation_rules_read · automation_rules_update · automation_rules_enable (sensitive: human confirmation when an AI agent calls it)
     @data   AutomationRule (trigger_kind, trigger_key, trigger_config, conditions {all, any, not}, actions [{key, action_key, inputs, on_error, branch, wait, approval, ai}], current_version, status, draft_definition, draft_updated_at, draft_updated_by_membership_id) · AutomationTriggerDefinition (payload_schema, sample_payload, config_schema) ·
             AutomationActionDefinition (input_schema, output_schema, required_permission, is_destructive, is_customer_facing) · AutomationRuleVersion (publish writes a snapshot) · AutomationRun (mode TEST | DRY_RUN) · AutomationAiStep (kind, confidence_threshold)
     @ui     Canvas (React Flow style: pan, zoom, drag nodes, keyboard delete) + palette of the REAL trigger and action registries + right Sheet panel with Tabs (Node, Rule, Test), shadcn Select / Popover+Command / Input / Textarea / Switch / Slider, JSON schema form renderer for input_schema, Tooltip on every badge
     @states loading · empty canvas (trigger node only + "Add first step") · validation errors per node (red outline + list) · saving draft · unpublished changes banner · read-only for users without automation.rules.update · error
     @audit  draft saved (coalesced), published (version created with change_summary), enabled, disabled · test and dry runs are stored as AutomationRun with mode TEST / DRY_RUN
     @note   Node types are exactly the AutomationActionKind values (UPDATE_FIELD ... CUSTOM) plus the trigger and the condition tree; BRANCH renders two lanes, WAIT, APPROVAL and AI_STEP get their own config. Node x/y positions are layout metadata inside each step's JSON (`ui`), not columns.
             Each action shows the permission it needs; if the run-as principal lacks it the node gets a warning now, not at runtime. Customer-facing actions carry a badge and force approval when the rule requires it.
             Palette lists only actions whose module is enabled for the organization and whose required_permission the AUTHOR holds (or the run-as service account holds). Dry run shows what each step WOULD do without side effects (AutomationRunMode DRY_RUN);
             test mode executes against a sample or a real recent event with mode TEST (customer-facing and destructive steps are skipped).
             UNPUBLISHED CHANGES: editing a PUBLISHED rule writes AutomationRule.draft_definition (+ draft_updated_at, draft_updated_by_membership_id); the live columns keep running. Publish copies the draft over them, bumps current_version, writes AutomationRuleVersion and clears the draft; Discard clears it.
     ===================================================================================================================== */
  const node = (cls, ic, tag, title, sub, on, stt) => '<div class="wf-node ' + cls + (on ? " sel" : "") + '"><span class="ic">' + I(ic, 15) + '</span><div class="tx"><span class="tg">' + tag + "</span><b>" + title + "</b><small>" + sub + "</small></div>" + (stt || "") + "</div>";
  const lk = '<div class="wf-link"></div>';
  function builder() {
    const pal = (h, a) => "<h4>" + h + "</h4>" + a.map((x) => '<div class="it">' + I(x[1], 14) + x[0] + "</div>").join("");
    return '<div class="a-page" style="max-width:1500px">' +
      '<div class="wf-bar"><span class="nm">Deal won → create project from template</span>' + st("PUBLISHED") + '<span class="badge yellow" title="draft changes on top of version 7">v7 + unpublished changes</span>' + E("ORGANIZATION") + SA + '<span class="muted">Automation · Sales</span><span style="flex:1"></span>' + btn("Test with sample", "zap", "sm") + btn("Dry run", "check", "sm") + btn("Versions", "layers", "sm") + btn("Discard changes", "x", "sm") + btn("Publish v8", "send", "sm primary") + "</div>" +
      callout("flag", "<b>Unpublished changes.</b> 2 steps changed since v7. The live rule keeps running v7 until you publish. 1 validation warning: <b>Send email</b> is customer-facing and needs an approval step before it.", "warn") + sp(10) +
      '<div class="wf-wrap"><div class="wf-pal">' +
      pal("Trigger", [["Event", "zap"], ["Schedule", "clock"], ["Date relative", "calendar"], ["Manual", "pen"], ["Inbound webhook", "globe"]]) +
      pal("Logic", [["Condition", "filter"], ["Branch", "layers"], ["Wait", "time"], ["Approval", "check"]]) +
      pal("Records", [["Create task", "tasks"], ["Create project from template", "folder"], ["Change status", "flag"], ["Assign", "users"], ["Update field", "edit"], ["Add tag", "tag"], ["Set custom field", "hash"]]) +
      pal("Communicate", [["Notify", "bell"], ["Send email or SMS", "mail"], ["Post message", "chat"], ["Manage channel", "hash"], ["Call webhook", "plug"]]) +
      pal("AI", [["Classify", "sparkles"], ["Summarize", "sparkles"], ["Extract", "sparkles"], ["Draft", "sparkles"]]) +
      '</div><div class="wf-canvas">' +
      node("t", "zap", "Trigger · EVENT", "Deal stage changed", "crm.deal.stage_changed · to_stage is Won · CRM", 0) + lk +
      node("c", "filter", "Conditions", "If all match", "amount ≥ 5,000 · company has no open project · branch is Berlin", 0) + lk +
      node("a", "folder", "1 · CREATE_RECORD", "Create project from template", "projects.create_from_template · Website build · needs projects.projects.create", 0, '<span class="st">' + E("SUCCEEDED", "green") + "</span>") + lk +
      node("w", "layers", "2 · BRANCH", "Amount ≥ 25,000?", "two lanes: large deals / standard deals", 0) +
      '<div class="wf-branch"><div class="col"><span class="lb">Yes · large deal</span>' + node("a", "users", "3a · ASSIGN", "Assign to Team: Delivery leads", "strategy LEAST_LOADED", 0) + lk + node("a", "bell", "4a · NOTIFY", "Notify CFO and sales lead", "notifications.notify", 0) + '</div><div class="col"><span class="lb">No · standard deal</span>' + node("a", "users", "3b · ASSIGN", "Assign to member: deal owner", "strategy MEMBER", 0) + "</div></div>" + lk +
      node("a", "sparkles", "5 · AI_STEP · DRAFT", "Draft kickoff email", "engine.ai_step · confidence ≥ 0.80 · OPENAI gpt-4.1", 1) + lk +
      node("x", "check", "6 · APPROVAL", "Approve before sending to customer", "requested from: Deal owner · expires in 24 h", 0, '<span class="st"><span class="badge yellow">warning</span></span>') + lk +
      node("a", "mail", "7 · SEND_COMMUNICATION", "Send kickoff email from template", "communications.send_template · customer-facing", 0, '<span class="st"><span class="badge red">customer-facing</span></span>') + lk +
      node("w", "time", "8 · WAIT", "Wait 2 days", "then continue", 0) + lk +
      node("a", "tasks", "9 · CREATE_RECORD", "Create task: Schedule kickoff call", "tasks.create · due +3 days · assign deal owner", 0) +
      '<div style="margin-top:14px">' + btn("Add step", "plus", "sm") + "</div></div>" +
      '<div class="wf-side"><div class="hd">' + I("sparkles", 15) + "<b>5 · AI step</b><span style=\"flex:1\"></span>" + seg(["Node", "Rule", "Test"], "Node") + '</div><div class="bd">' +
      fld("Step name", box("Draft kickoff email")) + fld("Action", sel("engine.ai_step · Run AI step", "zap")) + fld("Kind (AutomationAiStepKind)", seg(["Classify", "Summarize", "Extract", "Draft"], "Draft")) +
      fld("Prompt template", '<div class="editor"><div class="ed-body" style="min-height:90px">Write a friendly kickoff email for {{deal.company.name}} about project {{steps.1.output.project.name}}. Tone: professional, 120 words.</div></div>', "Variables from the trigger payload and earlier step outputs (output_schema of each action).") +
      fld("Output schema", box('{ subject: string, body: string }')) + fld("Confidence threshold", '<div class="rowx" style="padding:0"><div class="gauge" style="flex:1"><i style="width:80%"></i></div><b>0.80</b></div>', "Default from Settings (ai_default_confidence_threshold). Below it the next step waits for approval.") +
      '<div class="rowx" style="padding:6px 0"><div class="grow"><b>Requires approval</b><small>AutomationAiStep.requires_approval</small></div>' + sw(1) + "</div>" +
      fld("On error", seg(["Stop run", "Continue"], "Stop run")) + two(fld("Retries", box("Rule default")), fld("Timeout (s)", box("30"))) +
      '<div class="sub-note">Provider key: organization OPENAI connection (BYOK, IntegrationConnection). AI steps never run irreversible actions.</div>' + sp(10) +
      cd("<b>Rule settings</b>", kv("Scope", "Organization") + kv("Run as", "Automation · Sales") + kv("Max trigger depth", "3 (org default)") + kv("Idempotency key", mono("{{event.id}}")) + kv("Serialize per record", "Yes") + kv("Destructive actions", "Not allowed")) + sp(10) +
      cd("<b>Test with a sample event</b>", js({ event_key: "crm.deal.stage_changed", entity_type: "CRM_DEAL", payload: { deal_id: "d_1042", to_stage: "Won", amount: 32000 } }) + sp(8) + '<div class="rowx" style="padding:0">' + btn("Run test", "zap", "sm") + btn("Dry run", "check", "sm") + "</div>" + '<div class="sub-note">Dry run result: 9 steps would run, 1 customer-facing step skipped in test mode, approval would be requested from Anna Meyer.</div>') +
      "</div></div></div>" +
      dm(["AutomationRule · trigger_kind, trigger_key, trigger_config, conditions, actions (Json steps with ui layout), current_version, status", "AutomationTriggerDefinition · payload_schema, sample_payload · AutomationActionDefinition · input_schema, output_schema, required_permission, is_destructive, is_customer_facing", "AutomationRuleVersion · written on publish · AutomationRun · mode TEST, DRY_RUN · AutomationAiStep · kind, confidence_threshold"], ["AutomationRule.draft_definition · draft_updated_at · draft_updated_by_membership_id (unpublished changes banner, Discard, Publish v8)"]) + "</div>";
  }

  /* =====================================================================================================================
     WORKFLOW DETAIL — overview, versions and diff, runs, settings (spec §5, §6, §8)
     @route  /automation/workflows/:ruleId?tab=overview|versions|runs|settings|activity&v=<n>&compare=<n>
     @perm   VIEW automation.rules.read · edit automation.rules.update · enable / disable automation.rules.enable* · delete / archive automation.rules.delete* · runs tab automation.runs.read · restore version automation.rules.update
     @api    GET /automation/rules/:id · GET /automation/rules/:id/versions · GET /automation/rules/:id/versions/:n/diff?against= · POST /automation/rules/:id/versions/:n/restore · POST /automation/rules/:id/enable|disable|duplicate|archive · GET /automation/rules/:id/export · GET /automation/runs?rule_id=
     @mcp    automation_rules_read · automation_rules_update · automation_rules_enable · automation_rules_delete · automation_runs_read
     @data   AutomationRule (all columns) · AutomationRuleVersion (version, name, trigger_*, conditions, actions, scope, settings, change_summary, author_membership_id, published_at, superseded_at) · AutomationRun (rule_version) · AutomationRunLock · AuditEvent
     @ui     Page header with status Badge + Switch, Tabs, Table, side-by-side / unified diff viewer (read-only JSON tree), AlertDialog for archive / restore
     @states loading · not found · error · no-access · "newer version exists" banner while someone else edits
     @audit  version published, restored (creates a NEW version, never rewrites history), enabled / disabled, archived, owner or run-as changed, exported
     @note   Versions are immutable snapshots. Restoring v5 copies it into the draft; publishing makes v8. Runs always show the version they executed. Diff compares trigger, conditions, each step (added / removed / changed inputs)
             and settings JSON. Export produces a portable JSON without ids of other records (variables instead), import records imported_from.
     ===================================================================================================================== */
  function workflow() {
    const V = [[7, "Add AI draft and approval before customer email", "Anna Meyer", "Nov 9", "Current", 22], [6, "Switch assignment to LEAST_LOADED", "Marco Silva", "Oct 22", "", 120], [5, "Raise amount threshold to 5,000", "Anna Meyer", "Oct 3", "", 61], [4, "Add notify CFO branch", "Anna Meyer", "Sep 12", "", 9], [3, "Scope to organization", "Sofia Jensen", "Aug 30", "", 2], [2, "Add wait and follow-up task", "Anna Meyer", "Aug 18", "", 0], [1, "Initial version from template", "Anna Meyer", "Aug 18", "", 0]];
    return '<div class="a-page">' + head("Deal won → create project from template", "crm.deal.stage_changed · CRM · created from template “Deal won → create project” · owner Anna Meyer", sel("Run as: Automation · Sales", "key") + btn("Open builder", "edit", "primary") + btn("Duplicate", "layers") + more) +
      '<div class="rowx" style="padding:0 0 12px;gap:10px">' + st("PUBLISHED") + E("EVENT") + E("ORGANIZATION") + '<span class="muted">Enabled</span>' + sw(1) + '<span class="muted">v7 · published Nov 9 by Anna Meyer</span></div>' +
      '<div class="tabset">' + tabs([["ov", "Overview"], ["ver", "Versions", 7], ["rn", "Runs", 214], ["set", "Settings and safety"], ["ac", "Activity"]], "ov") +
      pane("ov", 1, '<div class="mini-stats">' + stat("Runs", 214, "all time") + stat("Succeeded", "98.6%", "3 failed", 0) + stat("Median duration", "2.4 s", "p95 6.9 s") + stat("Last run", "12 min ago", "SUCCEEDED") + stat("Next run", "—", "event driven") + "</div>" +
        '<div class="g2" style="align-items:start">' + cd("<b>Flow</b><span class='r muted'>v7</span>", '<div class="flow-mini"><span>EVENT crm.deal.stage_changed</span>→<span>If all</span>→<span>CREATE_RECORD</span>→<span>BRANCH</span>→<span>ASSIGN</span>→<span>AI_STEP</span>→<span>APPROVAL</span>→<span>SEND_COMMUNICATION</span>→<span>WAIT 2 d</span>→<span>CREATE_RECORD</span></div>' + sp(10) + '<div class="sub-note">9 steps · 1 customer-facing · 0 destructive · 1 AI step · 1 approval</div>') +
        cd("<b>Where it applies</b>", kv("Scope", "ORGANIZATION") + kv("Run as", "Automation · Sales " + SA) + kv("Owner", "Anna Meyer") + kv("Template", "Deal won → create project") + kv("Tags", "sales, onboarding") + kv("Created", "Aug 18 by Anna Meyer")) + "</div>" + sp() +
        cd("<b>Last runs</b><span class='r'>" + btn("All runs", "list", "sm") + "</span>", tbl(["Run", "Record", "Status", ">Duration", "Version", "Started"], [[mono("run_8f2a"), "Deal · Acme redesign", st("SUCCEEDED"), "2.4 s", "v7", "12 min ago"], [mono("run_8f19"), "Deal · Globex retainer", st("AWAITING_APPROVAL"), "—", "v7", "3 h ago"], [mono("run_8e60"), "Deal · Initech audit", st("FAILED"), "0.9 s", "v7", "Yesterday"]]).replace('class="panel tbl-x" style="margin-top:0"', 'class="tbl-x"'), 1)) +
      pane("ver", 0, tbl(["Version", "Change summary", "Author", "Published", ">Runs", ""], V.map((v) => [E("v" + v[0], v[4] ? "green" : "") + (v[4] ? " " + E("Current", "green") : ""), ink(v[1]), v[2], v[3], v[5], btn("Compare", "", "sm") + " " + btn("Restore", "", "sm")])) + sp() +
        cd("<b>Diff v6 → v7</b><span class='r muted'>AutomationRuleVersion · actions, settings</span>", '<div class="diff"><div class="hdr">@@ actions[4] @@</div><div class="del">-  { "key": "5", "action_key": "communications.send_template", "inputs": { "template": "kickoff" } }</div><div class="add">+  { "key": "5", "action_key": "engine.ai_step", "ai": { "kind": "DRAFT", "confidence_threshold": 0.8 } }</div><div class="add">+  { "key": "6", "action_key": "engine.approval", "approval": { "requested_from": "deal.owner", "expires_in": "24h" } }</div><div class="add">+  { "key": "7", "action_key": "communications.send_template", "inputs": { "body": "{{steps.5.output.body}}" } }</div><div class="hdr">@@ settings @@</div><div class="del">-  "require_approval_for_destructive": false</div><div class="add">+  "require_approval_for_destructive": true</div><div class="hdr">trigger, conditions, scope: unchanged</div></div>')) +
      pane("rn", 0, filterBar([["Rule", "is", "Deal won → create project"], ["Status", "is any of", "FAILED, AWAITING_APPROVAL"]]) + tbl(["Run", "Record", "Mode", "Status", ">Attempt", ">Duration", "Version", "Started"], [[mono("run_8f2a"), "Acme redesign", E("LIVE"), st("SUCCEEDED"), "1/3", "2.4 s", "v7", "12 min ago"], [mono("run_8f19"), "Globex retainer", E("LIVE"), st("AWAITING_APPROVAL"), "1/3", "—", "v7", "3 h ago"], [mono("run_8e60"), "Initech audit", E("LIVE"), st("FAILED"), "3/3", "0.9 s", "v7", "Yesterday"]])) +
      pane("set", 0, '<div class="g2" style="align-items:start">' + cd("<b>Execution</b>", fld("Run as", sel("Automation · Sales", "key")) + two(fld("Max retries", box("3")), fld("Backoff (s)", box("60"))) + two(fld("Rate limit / hour", box("Org default")), fld("Max trigger depth", box("Org default"))) + two(fld("Timeout (s)", box("120")), fld("Idempotency key", box("{{event.id}}"))) + '<div class="rowx"><div class="grow"><b>Serialize per record</b></div>' + sw(1) + "</div>") +
        cd("<b>Guardrails</b>", '<div class="rowx"><div class="grow"><b>Allow destructive actions</b><small>Organization switch is on</small></div>' + sw(0) + '</div><div class="rowx"><div class="grow"><b>Require approval for destructive and customer-facing</b></div>' + sw(1) + "</div>" + callout("shield", "Changing run-as or guardrails needs automation.service_accounts.manage* / automation.actions.destructive.enable* and is audited.") + sp() + '<div class="rowx" style="padding:0">' + btn("Export JSON", "file", "sm") + btn("Archive", "x", "sm") + btn("Delete", "x", "sm") + "</div>") + "</div>") +
      pane("ac", 0, '<div class="tl"><div class="ev"><b>Anna Meyer published v7</b><small>Nov 9 · “Add AI draft and approval before customer email”</small></div><div class="ev"><b>Run as changed to Automation · Sales</b><small>Marco Silva · Oct 22</small></div><div class="ev"><b>Rule enabled</b><small>Anna Meyer · Aug 18</small></div></div>') + "</div>" +
      dm(["AutomationRule · all columns", "AutomationRuleVersion · version, change_summary, author_membership_id, published_at, superseded_at, actions, conditions, settings", "AutomationRun · rule_version · AuditEvent (activity)"], []) + "</div>";
  }

  /* =====================================================================================================================
     RUN HISTORY (spec §8)
     @route  /automation/runs?filter=<json>&q=&status=&mode=&rule=&trigger=&record=&from=&to=&cursor=
     @perm   VIEW automation.runs.read (inside the rule's scope) · retry / cancel / reprocess automation.runs.manage* · replay as TEST automation.rules.read
     @api    GET /automation/runs?filter=&sort=&cursor= · POST /automation/runs/bulk {ids|filter, action: retry|cancel} · POST /automation/runs/:id/retry|cancel · GET/POST /saved-views?entity_type=AUTOMATION_RUN
     @mcp    automation_runs_read
     @data   AutomationRun (rule_id, rule_version, mode, status, trigger_kind, trigger_key, entity_type, entity_id, attempt, max_attempts, duration_ms, error_code, queued_at, started_at, finished_at, actor_type, run_as_service_account_id, performed_destructive_action, parent_run_id, trigger_depth) · SavedView (AUTOMATION_RUN)
     @ui     Table with filter bar + saved views, cursor pagination + virtualization, row side peek (Sheet), DropdownMenu, sticky bulk bar
     @states loading skeleton · empty ("No runs match") · error · no-access · retention note when the date range is older than run_retention_days
     @audit  retry and cancel write audit events with actor; runs that performed destructive or customer-facing actions are flagged
     @note   Searchable by rule, record (entity_type + entity_id), status, mode, trigger, date, actor and error code (spec §8). TEST and DRY_RUN runs are hidden by default and toggled with the Mode filter. A run started by another run
             shows parent_run_id and trigger_depth (loop protection). Retention comes from AutomationSettings.run_retention_days (null = keep).
     ===================================================================================================================== */
  const RUNS = [
    ["run_8f2a", "Deal won → create project from template", "crm.deal.stage_changed", "Deal · Acme redesign", "LIVE", "SUCCEEDED", "1/3", "2.4 s", "v7", "Nov 11 11:48", 0],
    ["run_8f2c", "New ticket → AI classify and route", "support.ticket.created", "Ticket · TCK-2051", "LIVE", "AWAITING_APPROVAL", "1/3", "—", "v12", "Nov 11 11:58", 0],
    ["run_8f27", "Website form lead → create lead and assign", "inbound.webhook", "Lead · (not created)", "LIVE", "FAILED", "3/3", "0.8 s", "v6", "Nov 11 11:52", 0],
    ["run_8f10", "Invoice 7 days overdue → reminder and task", "finance.invoice.overdue", "Invoice · INV-2026-0418", "LIVE", "RETRY_SCHEDULED", "2/4", "6.1 s", "v4", "Nov 11 10:58", 1],
    ["run_8ef4", "Weekly project status digest", "schedule.cron", "—", "TEST", "SUCCEEDED", "1/3", "9.3 s", "v2", "Nov 11 08:00", 0],
    ["run_8ed9", "Leave request → manager approval", "employees.leave.requested", "Leave · Jonas Koch", "LIVE", "WAITING", "1/3", "—", "v5", "Nov 10 16:20", 0],
    ["run_8ec1", "Website form lead → create lead and assign", "inbound.webhook", "Lead · (not created)", "LIVE", "DEAD_LETTERED", "3/3", "1.1 s", "v6", "Nov 10 09:14", 0],
    ["run_8eb7", "Contract expiring in 30 days → notify owner", "record.date_relative", "Contract · CT-0087", "LIVE", "SUCCEEDED", "1/3", "1.2 s", "v3", "Nov 11 06:00", 0],
    ["run_8e90", "Deal won → create project from template", "crm.deal.stage_changed", "Deal · Globex retainer", "DRY_RUN", "SKIPPED", "1/3", "0.3 s", "v8 draft", "Nov 10 14:02", 0],
    ["run_8e60", "SLA at risk → escalate to lead", "support.sla.at_risk", "Ticket · TCK-2019", "LIVE", "CANCELLED", "1/3", "—", "v3", "Nov 9 17:44", 0],
  ];
  function runs() {
    return '<div class="a-page">' + head("Run history", "Every execution with trigger, inputs, steps and result. Retention " + muted("90 days (Settings)"), btn("Export CSV", "file") + btn("Replay as test", "zap")) +
      '<div class="mini-stats">' + stat("Runs", "3,418", "last 7 days") + stat("Succeeded", "97.4%", "") + stat("Running / waiting", 7, "") + stat("Failed", 41, "needs review", 1) + stat("Median duration", "2.1 s", "p95 7.8 s") + "</div>" +
      '<div class="toolbar">' + search("Search run id, record id, error code, idempotency key") + sel("Status: All", "filter") + sel("Mode: LIVE", "zap") + sel("Trigger: All", "zap") + sel("Date: Last 7 days", "calendar") + sel("Actor: Any", "users") + sel("Columns (10)", "settings") + sel("Views: Failed today", "star") + "</div>" +
      filterBar([["Status", "is any of", "Failed, Dead lettered, Retry scheduled"], ["Mode", "is", "LIVE"], ["Record type", "is", "Invoice"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="bulk"><span class="cb on"></span><b>2 selected</b><span style="flex:1"></span>' + btn("Retry", "zap", "sm") + btn("Cancel", "x", "sm") + btn("Open in dead letter", "flag", "sm") + "</div>" +
      tbl(["", "Run", "Workflow", "Trigger", "Record", "Mode", "Status", ">Attempt", ">Duration", "Version", "Started", ""], RUNS.map((r, i) => [cb(i === 2 || i === 3), mono(r[0]), ink(r[1]), mono(r[2]), r[3], E(r[4], RC[r[4]]), st(r[5]) + (r[10] ? ' <span class="badge yellow" title="performed_destructive_action or customer-facing">external</span>' : ""), r[6], r[7], r[8], r[9], more])) +
      '<div class="pager"><span class="muted">1–10 of 3,418</span><span style="flex:1"></span>' + btn("Previous", "", "sm") + btn("Next", "", "sm") + "</div>" +
      dm(["AutomationRun · rule_id, rule_version, mode, status, trigger_kind, trigger_key, entity_type, entity_id, attempt, max_attempts, duration_ms, error_code, started_at, finished_at, actor_type, run_as_service_account_id, parent_run_id, trigger_depth", "SavedView · entity_type AUTOMATION_RUN · AutomationSettings · run_retention_days"], ["Retry / cancel of a run has no dedicated key (automation.runs.manage) · gaps-20.md #2"]) + "</div>";
  }

  /* =====================================================================================================================
     RUN DETAIL — step timeline, inputs / outputs, errors, retry (spec §6, §8, §9)
     @route  /automation/runs/:runId?step=<index>
     @perm   VIEW automation.runs.read · retry from failed step / cancel need automation.runs.manage* · approve / reject inside the run: the requested approver (AutomationApproval.requested_from_membership_id), no catalog key needed
     @api    GET /automation/runs/:id (run + steps + approvals + ai_steps + deliveries) · POST /automation/runs/:id/retry {from_step?} · POST /automation/runs/:id/cancel · POST /automation/approvals/:id/decide {decision, comment}
     @mcp    automation_runs_read
     @data   AutomationRun (input, conditions_result, conditions_passed, output, error*, attempt, max_attempts, next_retry_at, wait_until, current_step_index, idempotency_key, parent_run_id, trigger_depth, performed_destructive_action) · AutomationRunStep (step_index, step_key, action_key, kind, status, input, output, attempt, max_attempts, branch_taken, skipped_reason, is_destructive, duration_ms, error_*) · AutomationApproval · AutomationAiStep · WebhookDelivery (run_step_id) · PlatformEvent (event_id)
     @ui     Header Card, vertical step timeline with duration bars, collapsible JSON viewers (inputs / outputs, secrets masked), Alert for errors, Dialog for retry options, Badge per enum
     @states loading · not found · error · no-access · big payloads truncated with "download JSON" · secrets and customer personal data masked for users without the record permission
     @audit  retry, cancel, approval decisions
     @note   Steps are strictly ordered; a failed retryable step is retried with backoff until max_attempts, then the run becomes DEAD_LETTERED (alert if enabled). "Retry from failed step" reuses the idempotency keys so completed steps are not repeated;
             "Re-run" creates a new run. A WAITING step shows wait_until, AWAITING_APPROVAL shows who must decide and when it expires. AI steps show model, tokens, cost, confidence versus threshold. Conditions result shows every predicate that was evaluated.
     ===================================================================================================================== */
  const step = (i, cls, key, kind, status, meta, body) => '<div class="stp"><span class="ix ' + cls + '">' + i + '</span><div><div class="hd"><b>' + key + "</b>" + E(kind) + st(status) + '<span class="meta">' + meta + "</span></div>" + (body || "") + "</div></div>";
  function run() {
    return '<div class="a-page">' + head("Run run_8f10", "Invoice 7 days overdue → reminder and task · v4 · LIVE", btn("Re-run as test", "zap") + btn("Cancel run", "x") + btn("Retry from failed step", "zap", "primary")) +
      callout("flag", "<b>Step 5 failed (attempt 2 of 4).</b> Call outbound webhook returned HTTP 502. Next retry scheduled for <b>Nov 11 11:15</b> (backoff 120 s). If all attempts fail the run moves to dead letter and an alert is sent.", "warn") + sp() +
      '<div class="g2" style="grid-template-columns:1.8fr 1fr;align-items:start"><div>' +
      cd("<b>Steps</b><span class='r muted'>AutomationRunStep · 6 steps</span>",
        step(1, "ok", "Conditions", "BRANCH", "SUCCEEDED", "12 ms", '<div class="io"><div><small>conditions_result</small>' + js({ all: [{ "invoice.days_overdue >= 7": true }, { "invoice.amount > 0": true }, { "customer.on_payment_plan = false": true }] }) + "</div><div><small>conditions_passed</small>" + js({ passed: true }) + "</div></div>") +
        step(2, "ok", "AI classify: customer tone", "AI_STEP", "SUCCEEDED", "1.9 s · 412 tokens", '<div class="io"><div><small>input</small>' + js({ kind: "CLASSIFY", text: "Last 3 messages with Acme Corp" }) + "</div><div><small>output · confidence 0.91 ≥ 0.80</small>" + js({ label: "friendly", confidence: 0.91 }) + '</div></div><div class="sub-note">OPENAI gpt-4.1-mini · cost 0.0004 EUR · passed_threshold true</div>') +
        step(3, "ok", "Wait 1 day", "WAIT", "SUCCEEDED", "wait_until Nov 10 12:00", "") +
        step(4, "ok", "Approve reminder wording", "APPROVAL", "SUCCEEDED", "approved by Marco Silva · 2 h", '<div class="sub-note">Decision APPROVED · comment “OK, keep it soft.”</div>') +
        step(5, "bad", "Call outbound webhook · Accounting export", "CALL_WEBHOOK", "FAILED", "attempt 2/4 · 6.0 s", '<div class="io"><div><small>input</small>' + js({ webhook: "Accounting export", event: "finance.invoice.overdue", invoice: "INV-2026-0418" }) + "</div><div><small>output</small>" + js({ status: 502, body: "Bad gateway" }) + '</div></div><div class="errbox"><b>WEBHOOK_HTTP_502</b> Upstream returned 502. Retryable (AutomationActionDefinition.retryable). Next retry Nov 11 11:15.</div>') +
        step(6, "", "Create task: Call customer", "CREATE_RECORD", "PENDING", "not started", "")) + "</div><div>" +
      cd("<b>Run</b>", kv("Status", st("RETRY_SCHEDULED")) + kv("Mode", E("LIVE")) + kv("Workflow", "Invoice 7 days overdue") + kv("Version", "v4 (current)") + kv("Trigger", mono("finance.invoice.overdue")) + kv("Record", "Invoice INV-2026-0418") + kv("Attempt", "2 of 4") + kv("Queued", "Nov 11 10:58") + kv("Started", "Nov 11 10:58") + kv("Duration", "6.1 s so far") + kv("Run as", SA + " Automation · Finance") + kv("Actor", "SERVICE_ACCOUNT") + kv("Idempotency key", mono("evt_5b21")) + kv("Trigger depth", "0 of 3") + kv("Destructive action", "No")) + sp() +
      cd("<b>Trigger event</b><span class='r muted'>PlatformEvent</span>", js({ event_key: "finance.invoice.overdue", source: "SCHEDULED_JOB", entity_id: "INV-2026-0418", occurred_at: "Nov 11 10:58" })) + sp() +
      cd("<b>Related</b>", '<div class="rowl" style="padding:9px 16px"><div class="grow"><b>Webhook delivery</b><small>WebhookDelivery · RETRY_SCHEDULED</small></div>' + btn("Open", "", "sm") + '</div><div class="rowl" style="padding:9px 16px"><div class="grow"><b>Parent run</b><small>None (depth 0)</small></div></div><div class="rowl" style="padding:9px 16px"><div class="grow"><b>Audit</b><small>audit_events for this run</small></div>' + btn("Open", "", "sm") + "</div>", 1) + "</div></div>" +
      dm(["AutomationRun · status, mode, input, conditions_result, conditions_passed, attempt, max_attempts, next_retry_at, idempotency_key, trigger_depth, parent_run_id, performed_destructive_action, error*", "AutomationRunStep · step_index, step_key, action_key, kind, status, input, output, attempt, wait_until, branch_taken, skipped_reason, is_destructive, duration_ms, error_*", "AutomationApproval · decision, approver_membership_id, comment · AutomationAiStep · confidence, confidence_threshold, passed_threshold, tokens, cost_amount · WebhookDelivery · run_step_id"], ["Retry / cancel permission key · gaps-20.md #2"]) + "</div>";
  }

  /* =====================================================================================================================
     DEAD LETTER AND FAILED WORK (spec §6)
     @route  /automation/dead-letter?tab=runs|deliveries|events|jobs
     @perm   VIEW automation.runs.read (runs, events) · deliveries automation.webhooks.manage* · jobs automation.jobs.read · retry / discard need automation.runs.manage* (runs, events), automation.webhooks.manage* (deliveries), automation.jobs.manage* (jobs)
     @api    GET /automation/dead-letter?kind=run|delivery|event|job_run · POST /automation/runs/:id/retry · POST /automation/webhook-deliveries/:id/retry · POST /automation/events/:id/reprocess · POST /automation/dead-letter/discard {ids, reason}
     @mcp    automation_runs_read · automation_webhooks_manage · automation_jobs_manage
     @data   AutomationRun (status DEAD_LETTERED, dead_lettered_at, dead_letter_reason, error_code) · WebhookDelivery (status DEAD_LETTERED, dead_lettered_at, response_status_code, error_message) · PlatformEvent (dead_lettered_at, processing_attempts, processing_error) · ScheduledJobRun (FAILED, TIMED_OUT, error_code) · AutomationSettings (dead_letter_alerts_enabled)
     @ui     Tabs with counts, Table with bulk bar, Dialog "Retry" and "Discard (reason required)", Alert
     @states loading · empty ("Nothing is stuck") · error · no-access (tab hidden without the key)
     @audit  retry, reprocess and discard (with reason) written to audit_events
     @note   Permanent failures land here after max_attempts (runs, deliveries) or processing_attempts (events). The alert goes through Notifications (14) when dead_letter_alerts_enabled. Retrying is safe: step and run idempotency keys prevent duplicates.
             Alerts go to the rule owner (dead_letter_alert_notify_rule_owner), to dead_letter_alert_membership_ids and, optionally, to the Messaging channel dead_letter_alert_channel_id (12).
     ===================================================================================================================== */
  function deadletter() {
    return '<div class="a-page">' + head("Dead letter", "Work that failed permanently. Retry it or discard it with a reason.", btn("Alert settings", "bell") + btn("Retry selected", "zap", "primary")) +
      '<div class="tabset">' + tabs([["r", "Runs", 2], ["d", "Webhook deliveries", 3], ["e", "Events", 1], ["j", "Job runs", 2]], "r") +
      pane("r", 1, '<div class="bulk"><span class="cb on"></span><b>1 selected</b><span style="flex:1"></span>' + btn("Retry", "zap", "sm") + btn("Discard…", "x", "sm") + "</div>" + tbl(["", "Run", "Workflow", "Error", "Reason", ">Attempts", "Dead-lettered"], [[cb(1), mono("run_8ec1"), ink("Website form lead → create lead and assign"), mono("MAPPING_ERROR"), "payload.email missing after 3 attempts", "3/3", "Nov 10 09:14"], [cb(0), mono("run_8d77"), ink("Invoice 7 days overdue → reminder and task"), mono("WEBHOOK_HTTP_500"), "Accounting export returned 500 four times", "4/4", "Nov 8 13:02"]])) +
      pane("d", 0, tbl(["", "Delivery", "Endpoint", "Event", "HTTP", "Error", ">Attempts", "Dead-lettered"], [[cb(0), mono("dlv_912"), "Zapier · CRM sync", mono("crm.deal.stage_changed"), "410", "Gone: endpoint removed", "8/8", "Nov 10"], [cb(0), mono("dlv_90e"), "Zapier · CRM sync", mono("crm.lead.created"), "—", "Timeout after 10 s", "8/8", "Nov 10"], [cb(0), mono("dlv_8c2"), "Accounting export", mono("finance.invoice.paid"), "500", "Internal Server Error", "5/5", "Nov 8"]])) +
      pane("e", 0, tbl(["", "Event", "Source", "Entity", ">Attempts", "Processing error", "Dead-lettered"], [[cb(0), mono("support.ticket.created"), E("MODULE"), "TCK-2022", "5", "Rule evaluation timeout", "Nov 7"]])) +
      pane("j", 0, tbl(["", "Job", "Run", "Status", "Error", ">Attempt", "Started"], [[cb(0), mono("support.sla_timers"), mono("jr_5521"), st("TIMED_OUT"), "TIMEOUT after 300 s", "3/3", "Nov 11 03:00"], [cb(0), mono("notifications.digest_daily"), mono("jr_5510"), st("FAILED"), "Email provider unavailable", "3/3", "Nov 10 07:00"]])) + "</div>" +
      callout("bell", "Alerts are on: the organization admins and the rule owner receive a notification (14) when a run, delivery or event is dead-lettered.") +
      dm(["AutomationRun · dead_lettered_at, dead_letter_reason, error_code, attempt", "WebhookDelivery · dead_lettered_at, response_status_code, error_message, attempt", "PlatformEvent · dead_lettered_at, processing_attempts, processing_error", "ScheduledJobRun · status, error_code, attempt", "AutomationSettings · dead_letter_alerts_enabled, dead_letter_alert_membership_ids, dead_letter_alert_notify_rule_owner, dead_letter_alert_channel_id"], []) + "</div>";
  }

  /* =====================================================================================================================
     SCHEDULED JOBS — list (spec §7)
     @route  /automation/jobs?status=&module=&kind=&q=
     @perm   VIEW automation.jobs.read · create / edit / pause / resume / run now / delete automation.jobs.manage*
     @api    GET /automation/jobs?filter=&sort= · POST /automation/jobs · PATCH /automation/jobs/:id · POST /automation/jobs/:id/pause|resume|run-now · GET /automation/jobs/:id/runs
     @mcp    automation_jobs_read · automation_jobs_manage (sensitive: human confirmation for AI callers)
     @data   ScheduledJob (module, key, name, kind, cron_expression, interval_seconds, run_at, timezone, handler, status, rule_id, branch_id, next_run_at, last_run_at, last_run_status, last_duration_ms, run_count, failure_count, consecutive_failures, max_retries, retry_backoff_seconds, timeout_seconds, allow_overlap, catch_up_missed, locked_by, lock_expires_at, paused_at)
     @ui     Table with filter bar, Switch (pause / resume), DropdownMenu, Badge per status, bulk bar
     @states loading · empty ("No scheduled jobs") · error · no-access
     @audit  job created, edited, paused, resumed, run now, deleted
     @note   Two families: module jobs registered by modules (organization_id null = platform-wide, read-only except pause for the org; key like contracts.expiration_monitor with a code `handler`) and organization jobs created here. A job with
             rule_id is the schedule behind a SCHEDULE / DATE_RELATIVE rule and is edited from the rule (mirrors AutomationRule.next_run_at). Lock fields (locked_by, lock_expires_at) show which worker holds the job.
     ===================================================================================================================== */
  const JOBS = [
    ["contracts.expiration_monitor", "CONTRACTS", "Contract expiration and renewal monitor", "CRON", "0 6 * * *", "Europe/Berlin", "ACTIVE", "", "Tomorrow 06:00", "Today 06:00", "SUCCEEDED", "1.4 s", 312, 0, 0],
    ["finance.dunning_run", "FINANCE", "Invoice dunning and reminders", "CRON", "0 9 * * 1-5", "Europe/Berlin", "ACTIVE", "", "Tomorrow 09:00", "Today 09:00", "SUCCEEDED", "8.7 s", 220, 2, 0],
    ["income_expense.recurring_generate", "INCOME_EXPENSE", "Generate recurring expenses", "CRON", "0 2 1 * *", "Europe/Berlin", "ACTIVE", "", "Dec 1 02:00", "Nov 1 02:00", "SUCCEEDED", "3.1 s", 24, 0, 0],
    ["support.sla_timers", "SUPPORT", "SLA breach checks", "INTERVAL", "every 60 s", "UTC", "ACTIVE", "", "in 40 s", "1 min ago", "FAILED", "300 s", 98211, 41, 3],
    ["support.auto_close", "SUPPORT", "Auto-close resolved tickets", "CRON", "30 3 * * *", "Europe/Berlin", "ACTIVE", "", "Tomorrow 03:30", "Today 03:30", "SUCCEEDED", "0.9 s", 410, 0, 0],
    ["messaging.channel_archive", "MESSAGING", "Archive inactive project channels", "CRON", "0 4 * * 0", "Europe/Berlin", "ACTIVE", "", "Sun 04:00", "Nov 8 04:00", "SUCCEEDED", "2.0 s", 52, 0, 0],
    ["notifications.digest_daily", "NOTIFICATIONS", "Daily notification digest", "CRON", "0 7 * * *", "Europe/Berlin", "ACTIVE", "", "Tomorrow 07:00", "Today 07:00", "FAILED", "12 s", 310, 4, 1],
    ["documents.retention", "DOCUMENTS", "Retention enforcement", "CRON", "0 1 * * *", "UTC", "PAUSED", "", "paused", "Nov 3 01:00", "SUCCEEDED", "44 s", 180, 1, 0],
    ["rule:wf-weekly-digest", "PROJECTS", "Weekly project status digest", "CRON", "0 8 * * 1", "Europe/Berlin", "ACTIVE", "Weekly project status digest", "Mon 08:00", "Nov 10 08:00", "SUCCEEDED", "9.3 s", 44, 1, 0],
    ["org.q4_price_switch", "FINANCE", "Switch to the Q4 price list", "ONCE", "Dec 1 00:00", "Europe/Berlin", "ACTIVE", "", "Dec 1 00:00", "—", "", "—", 0, 0, 0],
    ["org.year_end_close", "FINANCE", "Year-end checklist reminder (2025)", "ONCE", "Dec 31 2025 09:00", "Europe/Berlin", "COMPLETED", "", "—", "Dec 31 09:00", "SUCCEEDED", "0.6 s", 1, 0, 0],
  ];
  function jobs() {
    return '<div class="a-page">' + head("Scheduled jobs", "Recurring work hosted by the engine: module jobs and your own schedules.", btn("Register handler docs", "book") + btn("New scheduled job", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Jobs", 11, "9 active · 1 paused") + stat("Runs (24 h)", "1,622", "99.2% succeeded") + stat("Failing", 2, "consecutive failures", 1) + stat("Next run", "40 s", "support.sla_timers") + stat("Locked now", 1, "worker w-3") + "</div>" +
      '<div class="toolbar">' + search("Search key, name, handler") + sel("Module: All", "grid") + sel("Kind: All", "clock") + sel("Status: All", "filter") + sel("Source: All", "building") + sel("Sort: Next run", "sort") + "</div>" +
      filterBar([["Status", "is any of", "Active, Paused"], ["Last run status", "is not", "Succeeded"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="bulk"><span class="cb on"></span><b>2 selected</b><span style="flex:1"></span>' + btn("Pause", "x", "sm") + btn("Resume", "check", "sm") + btn("Run now", "zap", "sm") + "</div>" +
      tbl(["", "Job", "Module", "Kind", "Schedule", "Timezone", "Status", "Next run", "Last run", ">Runs", ">Failed", "Source", ""], JOBS.map((j, i) => [cb(i === 3 || i === 6), ink(j[2]) + '<small class="muted" style="display:block">' + mono(j[0]) + "</small>", E(j[1]), E(j[3]), mono(j[4]), j[5], st(j[6]), j[8], j[9] + (j[10] ? "<br>" + st(j[10]) + (j[14] ? ' <span class="badge red" title="consecutive_failures">' + j[14] + " in a row</span>" : "") : ""), j[12].toLocaleString("en-US"), j[13], j[7] ? '<span class="badge purple">rule</span>' : j[0].indexOf("org.") === 0 ? '<span class="badge blue">organization</span>' : '<span class="badge">module</span>', more])) +
      dm(["ScheduledJob · module, key, name, kind, cron_expression, interval_seconds, run_at, timezone, handler, status, rule_id, next_run_at, last_run_at, last_run_status, run_count, failure_count, consecutive_failures, locked_by, lock_expires_at, paused_at", "ScheduledJobRun (last run)"], []) + "</div>";
  }

  /* =====================================================================================================================
     SCHEDULED JOB — create / edit with cron builder (spec §7)
     @route  /automation/jobs/new · /automation/jobs/:jobId/edit
     @perm   automation.jobs.manage* · linking to a rule needs automation.rules.update on it · running a handler that touches a module needs the handler's own permission through the run-as principal
     @api    POST /automation/jobs {module, key, name, description, kind, cron_expression|interval_seconds|run_at, timezone, handler, payload, rule_id?, branch_id?, max_retries, retry_backoff_seconds, timeout_seconds, allow_overlap, catch_up_missed} · PATCH /automation/jobs/:id · POST /automation/jobs/preview {kind, expr, timezone} → next 5 runs
     @mcp    automation_jobs_manage
     @data   ScheduledJob (every column listed) · Branch (branch_id) · AutomationRule (rule_id)
     @ui     Sectioned form, cron builder (5 field chips + presets + day-of-week ToggleGroup + free text with validation), shadcn Select for handler (registered handlers only), Textarea JSON editor for payload (validated), DatePicker + time for ONCE, Switch
     @states validation inline (cron syntax, interval ≥ 30 s, run_at in the future, key unique per organization) · saving · preview loading · error · no-access
     @audit  job created / edited (before and after of schedule and payload)
     @note   Kind CRON: 5-field expression evaluated in `timezone` (DST aware: a skipped hour runs at the next valid minute, a repeated hour runs once). INTERVAL: every N seconds after the previous start. ONCE: runs at run_at, then status COMPLETED.
             `handler` is chosen from handlers registered by modules in code (an organization cannot run arbitrary code). allow_overlap false skips a run while the previous one is still running (ScheduledJobRunStatus SKIPPED).
             catch_up_missed runs one catch-up after downtime instead of every missed slot. Module jobs show the same form read-only except pause and branch scope.
     ===================================================================================================================== */
  function jobNew() {
    return '<div class="a-page">' + head("New scheduled job", "Choose when it runs, what it does and how failures are handled.", btn("Cancel") + btn("Save", "", "") + btn("Create job", "plus", "primary")) +
      '<div class="g2" style="grid-template-columns:1.6fr 1fr;align-items:start"><div>' +
      cd("<b>What it does</b>", two(fld("Module", sel("FINANCE", "grid")), fld("Key", box("org.q4_price_switch"), "Unique per organization. Prefix org. for your own jobs.")) + fld("Name", box("Weekly overdue summary to finance")) + fld("Description", box("Posts the list of overdue invoices to #finance every Monday.")) +
        fld("Handler", sel("finance.overdue_summary · registered by Finance (08)", "plug"), "Only handlers registered by modules can be chosen. Run-as principal: Automation · Finance.") + fld("Or run a workflow", sel("None · choose a rule with a manual or schedule trigger", "zap"), "Sets rule_id: the job then only fires that rule.") +
        fld("Payload (JSON)", js({ channel: "finance", min_days_overdue: 7, currency: "EUR" }))) + sp() +
      cd("<b>When</b>", fld("Kind", seg(["Cron", "Interval", "Once"], "Cron")) +
        '<div class="cron"><div><small>Minute</small><b>0</b><span>at minute 0</span></div><div><small>Hour</small><b>8</b><span>at 08:00</span></div><div><small>Day of month</small><b>*</b><span>every day</span></div><div><small>Month</small><b>*</b><span>every month</span></div><div><small>Day of week</small><b>1</b><span>Monday</span></div></div>' + sp(10) +
        fld("Days of week", '<div class="dows">' + ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => "<span" + (i === 0 ? ' class="on"' : "") + ">" + d + "</span>").join("") + "</div>") +
        fld("Presets", seg(["Every hour", "Daily 09:00", "Weekdays 09:00", "Weekly Monday", "Monthly 1st", "Custom"], "Weekly Monday")) + two(fld("Expression", box("0 8 * * 1")), fld("Timezone", sel("Europe/Berlin", "globe"))) +
        '<div class="callout">' + I("clock", 16) + "<div><b>Every Monday at 08:00 (Europe/Berlin).</b> Interval kind asks for seconds (min 30). Once asks for date and time (run_at) and the job completes afterwards.</div></div>") + sp() +
      cd("<b>Reliability</b>", two(fld("Max retries", box("3")), fld("Retry backoff (seconds)", box("60"))) + fld("Timeout (seconds)", box("300"), "Empty = engine default. A run over the timeout becomes TIMED_OUT.") + '<div class="rowx"><div class="grow"><b>Allow overlap</b><small>Start a run while the previous one is still running</small></div>' + sw(0) + '</div><div class="rowx"><div class="grow"><b>Catch up missed runs</b><small>After downtime run once instead of skipping</small></div>' + sw(1) + "</div>") +
      "</div><div>" +
      cd("<b>Next 5 runs</b><span class='r muted'>preview · Europe/Berlin</span>", '<div class="nextruns"><span><i>1</i>Mon Nov 16, 08:00</span><span><i>2</i>Mon Nov 23, 08:00</span><span><i>3</i>Mon Nov 30, 08:00</span><span><i>4</i>Mon Dec 7, 08:00</span><span><i>5</i>Mon Dec 14, 08:00</span></div>') + sp() +
      cd("<b>Scope and status</b>", fld("Branch", sel("All branches", "building")) + fld("Initial status", seg(["Active", "Paused"], "Active")) + '<div class="sub-note">Statuses: ACTIVE, PAUSED, DISABLED (by the engine after repeated failures), COMPLETED (ONCE finished).</div>') + sp() +
      callout("shield", "<b>Permissions.</b> Creating and editing needs automation.jobs.manage*. The job runs with the permissions of its run-as principal, never with elevated rights.") + "</div></div>" +
      dm(["ScheduledJob · module, key, name, description, kind, cron_expression, interval_seconds, run_at, timezone, handler, payload, status, rule_id, branch_id, max_retries, retry_backoff_seconds, timeout_seconds, allow_overlap, catch_up_missed"], []) + "</div>";
  }

  /* =====================================================================================================================
     SCHEDULED JOB DETAIL — run history (spec §7, §8)
     @route  /automation/jobs/:jobId?tab=runs|config
     @perm   VIEW automation.jobs.read · run now / pause / edit automation.jobs.manage*
     @api    GET /automation/jobs/:id · GET /automation/jobs/:id/runs?status=&cursor= · POST /automation/jobs/:id/run-now · POST /automation/job-runs/:id/retry|cancel
     @mcp    automation_jobs_read · automation_jobs_manage
     @data   ScheduledJob (status, next_run_at, last_*, consecutive_failures, locked_by, locked_at, lock_expires_at) · ScheduledJobRun (status, scheduled_for, started_at, finished_at, duration_ms, attempt, max_attempts, next_retry_at, input, output, error_code, error_message, error, worker_id, triggered_by_membership_id) · PlatformEvent (scheduled_job_run_id)
     @ui     Header Card, Tabs, Table, Sheet for run details with JSON viewers
     @states loading · empty runs · error · no-access
     @audit  run now (triggered_by_membership_id), pause, resume, cancel
     @note   After `consecutive_failures` reaches max_retries the engine sets status DISABLED and raises the dead-letter alert; resume resets the counter. A run holds a lock (locked_by, lock_expires_at) so only one worker executes it.
     ===================================================================================================================== */
  function job() {
    return '<div class="a-page">' + head("SLA breach checks", "support.sla_timers · SUPPORT · every 60 s · UTC", btn("Run now", "zap") + btn("Pause", "x") + btn("Edit", "edit", "primary")) +
      callout("flag", "<b>3 consecutive failures.</b> The last run timed out after 300 s. One more failure disables the job (max_retries 3) and sends a dead-letter alert.", "warn") + sp() +
      '<div class="mini-stats">' + stat("Status", "Active", "") + stat("Runs", "98,211", "all time") + stat("Failed", 41, "0.04%", 1) + stat("Last duration", "300 s", "timeout") + stat("Locked by", "w-3", "expires in 20 s") + "</div>" +
      '<div class="tabset">' + tabs([["r", "Runs"], ["c", "Configuration"]], "r") +
      pane("r", 1, tbl(["Run", "Scheduled for", "Status", ">Attempt", ">Duration", "Worker", "Error", "Triggered by"], [[mono("jr_5521"), "Nov 11 11:59", st("TIMED_OUT"), "3/3", "300 s", "w-3", mono("TIMEOUT"), "Schedule"], [mono("jr_5520"), "Nov 11 11:58", st("FAILED"), "3/3", "41 s", "w-1", mono("DB_LOCK_TIMEOUT"), "Schedule"], [mono("jr_551f"), "Nov 11 11:57", st("SUCCEEDED"), "1/3", "0.8 s", "w-2", "—", "Schedule"], [mono("jr_551e"), "Nov 11 11:56", st("SKIPPED"), "1/1", "—", "—", "previous run still active", "Schedule"], [mono("jr_551a"), "Nov 11 11:30", st("SUCCEEDED"), "1/3", "0.7 s", "w-1", "—", "Anna Meyer (run now)"]])) +
      pane("c", 0, '<div class="g2" style="align-items:start">' + cd("<b>Schedule</b>", kv("Kind", E("INTERVAL")) + kv("Every", "60 s") + kv("Timezone", "UTC") + kv("Handler", mono("support.sla_timers.check")) + kv("Allow overlap", "No") + kv("Catch up missed", "No")) + cd("<b>Reliability</b>", kv("Max retries", "3") + kv("Backoff", "30 s") + kv("Timeout", "300 s") + kv("Consecutive failures", "3") + kv("Paused at", "—"))+ "</div>") + "</div>" +
      dm(["ScheduledJob · status, kind, interval_seconds, handler, consecutive_failures, locked_by, lock_expires_at, max_retries, retry_backoff_seconds, timeout_seconds", "ScheduledJobRun · status, scheduled_for, duration_ms, attempt, worker_id, error_code, triggered_by_membership_id"], []) + "</div>";
  }

  /* =====================================================================================================================
     EVENT LOG — platform events (spec §2, §6, §12)
     @route  /automation/events?source=&key=&entity=&from=&to=&state=
     @perm   VIEW automation.runs.read (scope-filtered; payload fields the caller cannot see are masked) · the event log with payloads is part of automation.runs.read (no separate events key) · reprocess an event automation.runs.manage*
     @api    GET /automation/events?filter=&cursor= · POST /automation/events/:id/reprocess · GET /automation/events/:id
     @mcp    automation_runs_read
     @data   PlatformEvent (event_key, module, source, entity_type, entity_id, payload, changes, actor_type, actor_*_id, dedupe_key, correlation_id, causation_run_id, trigger_depth, occurred_at, received_at, rules_processed_at, rules_matched_count, notifications_processed_at, webhooks_processed_at, processed_at, processing_attempts, processing_error, dead_lettered_at)
     @ui     Table + filter bar, Sheet with payload / changes JSON, Badge for the three consumers
     @states loading · empty · error · no-access
     @audit  reprocess requests
     @note   The event bus log. One event feeds three consumers: rules (rules_processed_at, rules_matched_count), 14 Notifications (notifications_processed_at) and outbound webhooks (webhooks_processed_at). Delivery is at-least-once, dedupe_key makes publishing idempotent,
             causation_run_id + trigger_depth link events created by automation runs (loop protection). Retention comes from event_retention_days.
     ===================================================================================================================== */
  function events() {
    const dot = (b) => b ? '<span class="badge green">done</span>' : '<span class="badge yellow">pending</span>';
    return '<div class="a-page">' + head("Event log", "Everything modules, the API, webhooks and jobs published to the event bus.", btn("Publish test event", "send")) +
      '<div class="toolbar">' + search("Search event key, entity id, correlation id") + sel("Source: All", "filter") + sel("Module: All", "grid") + sel("State: All", "check") + sel("Date: Last 24 h", "calendar") + "</div>" +
      filterBar([["Source", "is any of", "Module, Inbound webhook"], ["Rules matched", "above", "0"]], btn("Clear", "", "sm ghost")) +
      tbl(["Event", "Module", "Source", "Entity", "Actor", "Occurred", ">Rules", "Notifications", "Webhooks", "Depth"], [
        [mono("crm.deal.stage_changed"), E("CRM"), E("MODULE"), "CRM_DEAL · d_1042", "USER · Anna Meyer", "11:48:02", "1 matched", dot(1), dot(1), "0"],
        [mono("support.ticket.created"), E("SUPPORT"), E("MODULE"), "TICKET · TCK-2051", "USER · Kim Lund", "11:58:10", "1 matched", dot(1), dot(0), "0"],
        [mono("inbound.webhook"), E("AUTOMATION"), E("INBOUND_WEBHOOK"), "slug · website-leads", "SYSTEM", "11:52:31", "1 matched", dot(1), dot(1), "0"],
        [mono("tasks.task.created"), E("TASKS"), E("AUTOMATION"), "TASK · WEB-152", "SERVICE_ACCOUNT · Automation · Sales", "11:48:04", "0 matched", dot(1), dot(1), "1"],
        [mono("finance.invoice.overdue"), E("FINANCE"), E("SCHEDULED_JOB"), "INVOICE · INV-2026-0418", "SYSTEM", "10:58:00", "1 matched", dot(1), dot(1), "0"],
        [mono("support.ticket.created"), E("SUPPORT"), E("MODULE"), "TICKET · TCK-2022", "USER · Marco Silva", "Nov 7", '<span class="badge red" title="dead_lettered_at">dead letter</span>', dot(1), dot(1), "0"],
      ]) + sp() +
      cd("<b>support.ticket.created</b><span class='r muted'>payload · changes · correlation corr_77a1 · dedupe tck-2051-created</span>", '<div class="g2">' + js({ ticket_id: "TCK-2051", subject: "Cannot export invoices", priority: "HIGH", customer: "Acme Corp", channel: "EMAIL" }) + js({ changes: null, correlation_id: "corr_77a1", processing_attempts: 1, processed_at: "11:58:12" }) + "</div>") +
      dm(["PlatformEvent · event_key, module, source, entity_type, entity_id, payload, changes, actor_type, dedupe_key, correlation_id, causation_run_id, trigger_depth, occurred_at, rules_processed_at, rules_matched_count, notifications_processed_at, webhooks_processed_at, processed_at, processing_attempts, processing_error, dead_lettered_at"], []) + "</div>";
  }

  /* =====================================================================================================================
     TRIGGER CATALOG (spec §3, §12)
     @route  /automation/catalog/triggers?module=&kind=&q=&key=<trigger key>
     @perm   VIEW automation.rules.read (the catalog is platform-wide; an entry the caller cannot use is shown disabled with its required_permission)
     @api    GET /automation/triggers?module=&kind= · GET /automation/triggers/:key (payload_schema, sample_payload, config_schema, date_fields) · POST /automation/triggers/register (modules, service credential, code at deploy)
     @mcp    automation_rules_read
     @data   AutomationTriggerDefinition (module, key, name, description, kind, entity_type, payload_schema, sample_payload, date_fields, config_schema, required_permission, notifiable, webhook_subscribable, version, is_active, sort_order)
     @ui     Table + filter bar, Sheet detail with JSON schema viewer and a "Use in new workflow" button
     @states loading · empty · error · no-access
     @note   Triggers are DECLARED BY MODULES in code and synced at deploy (not editable here, no tenant data). `notifiable` means 14 can subscribe to the same event, `webhook_subscribable` means it can be chosen for an outbound webhook. DATE_RELATIVE triggers list date_fields
             (e.g. contract end_date) usable with an offset in days. Deprecated versions stay readable because published rules reference them.
     ===================================================================================================================== */
  function triggers() {
    return '<div class="a-page">' + head("Trigger catalog", "What can start a workflow. Registered by each module; read-only here.", btn("Docs", "book")) +
      '<div class="toolbar">' + search("Search key or name") + sel("Module: All", "grid") + sel("Kind: All", "zap") + sel("Entity: All", "hash") + sel("Usable by me", "key") + "</div>" +
      '<div class="g2" style="grid-template-columns:1.6fr 1fr;align-items:start"><div>' +
      tbl(["Trigger", "Module", "Kind", "Entity", "Needs", "Notify", "Webhook", ">Ver"], TRG.map((t, i) => [ink(t[2]) + '<small class="muted" style="display:block">' + mono(t[0]) + "</small>", E(t[1]), E(t[3], TKCOL[t[3]]), t[4] ? E(t[4]) : "—", t[5] ? mono(t[5]) : "—", t[6] ? "Yes" : "No", t[7] ? "Yes" : "No", t[8]])) + "</div><div>" +
      cd("<b>Deal stage changed</b><span class='r'>" + btn("Use in workflow", "plus", "sm") + "</span>", kv("Key", mono("crm.deal.stage_changed")) + kv("Module", "CRM") + kv("Kind", E("EVENT")) + kv("Record", E("CRM_DEAL")) + kv("Needs permission", mono("crm.deals.read")) + kv("Notifications (14)", "Yes") + kv("Outbound webhooks", "Yes") + kv("Version", "3") + kv("Active", "Yes") + sp(8) + "<small class='muted'>payload_schema</small>" + js({ deal_id: "string", from_stage: "string", to_stage: "string", amount: "decimal", currency: "string", owner_membership_id: "string" }) + sp(8) + "<small class='muted'>config_schema (filters)</small>" + js({ to_stage: "enum[]", pipeline: "enum[]" }) + sp(8) + "<small class='muted'>sample_payload</small>" + js({ deal_id: "d_1042", from_stage: "Negotiation", to_stage: "Won", amount: 32000, currency: "EUR" })) + sp() +
      cd("<b>Contract expiring in N days</b>", kv("Kind", E("DATE_RELATIVE", "yellow")) + kv("date_fields", "end_date, renewal_date, notice_deadline") + '<div class="sub-note">The author picks a date field, an offset in days and before / after.</div>') + "</div></div>" +
      dm(["AutomationTriggerDefinition · module, key, name, description, kind, entity_type, payload_schema, sample_payload, date_fields, config_schema, required_permission, notifiable, webhook_subscribable, version, is_active, sort_order"], []) + "</div>";
  }

  /* =====================================================================================================================
     ACTION CATALOG (spec §4, §6, §10)
     @route  /automation/catalog/actions?module=&kind=&key=<action key>
     @perm   VIEW automation.rules.read · using destructive actions in a rule needs automation.actions.destructive.enable*
     @api    GET /automation/actions?module=&kind=&destructive= · GET /automation/actions/:key (input_schema, output_schema) · POST /automation/actions/register (modules, at deploy)
     @mcp    automation_rules_read
     @data   AutomationActionDefinition (module, key, name, description, kind, entity_type, input_schema, output_schema, required_permission, is_destructive, is_customer_facing, is_idempotent, retryable, is_engine_builtin, version, is_active, sort_order)
     @ui     Table + filter bar, Sheet with JSON schema viewer, Badge for guardrail flags
     @states loading · empty · error · no-access
     @note   Actions are declared by modules with an input schema and the permission the executing principal needs; built-in engine actions (is_engine_builtin: wait, branch, approval, AI step, call webhook, tag, custom field) have no module.
             Flags drive guardrails: is_destructive and is_customer_facing may require approval, is_idempotent and retryable decide how retries behave. Business rules of the owning module always run inside the action and cannot be bypassed.
     ===================================================================================================================== */
  function actions() {
    return '<div class="a-page">' + head("Action catalog", "What a workflow can do. Registered by each module; the engine adds its built-ins.", btn("Docs", "book")) +
      '<div class="toolbar">' + search("Search key or name") + sel("Module: All", "grid") + sel("Kind: All", "zap") + sel("Flags: All", "shield") + sel("Usable by me", "key") + "</div>" +
      '<div class="g2" style="grid-template-columns:1.7fr 1fr;align-items:start"><div>' +
      tbl(["Action", "Module", "Kind", "Needs permission", "Flags"], ACT.map((a) => [ink(a[2]) + '<small class="muted" style="display:block">' + mono(a[0]) + "</small>", E(a[1]), E(a[3]), a[5] ? mono(a[5]) : "—", (a[6] ? '<span class="badge red">destructive</span> ' : "") + (a[7] ? '<span class="badge yellow">customer-facing</span> ' : "") + (a[8] ? '<span class="badge">idempotent</span> ' : "") + (a[9] ? '<span class="badge">retryable</span> ' : "") + (a[10] ? '<span class="badge blue">built-in</span>' : "")])) + "</div><div>" +
      cd("<b>Create task</b>", kv("Key", mono("tasks.create")) + kv("Module", "TASKS") + kv("Kind", E("CREATE_RECORD")) + kv("Record", E("TASK")) + kv("Needs permission", mono("tasks.tasks.create")) + kv("Idempotent", "No (uses step idempotency key)") + kv("Retryable", "Yes") + sp(8) + "<small class='muted'>input_schema</small>" + js({ title: "string (template allowed)", team_id: "string", assignee: { strategy: "MEMBER | TEAM | ROUND_ROBIN | LEAST_LOADED", target: "id" }, due_in_days: "integer?", priority: "TaskPriority" }) + sp(8) + "<small class='muted'>output_schema</small>" + js({ task_id: "string", key: "string" })) + sp() +
      cd("<b>Assign strategies</b><span class='r muted'>AutomationAssignStrategy</span>", [["MEMBER", "A fixed member or the record owner"], ["TEAM", "Everyone in a team (first available)"], ["ROUND_ROBIN", "Rotates through the team"], ["LEAST_LOADED", "The member with the fewest open items"]].map((r) => trow(U.en(r[0]), r[1], "")).join(""), 1) + "</div></div>" +
      dm(["AutomationActionDefinition · module, key, name, kind, entity_type, input_schema, output_schema, required_permission, is_destructive, is_customer_facing, is_idempotent, retryable, is_engine_builtin, version, is_active"], []) + "</div>";
  }

  /* =====================================================================================================================
     TEMPLATES GALLERY (spec §5, §14)
     @route  /automation/templates?module=&category=&q=&mine=1 · /automation/templates/:key (preview)
     @perm   VIEW automation.rules.read · use a template automation.rules.create · publish / unpublish an organization template automation.templates.manage
     @api    GET /automation/templates?module=&category=&q= · POST /automation/templates {from_rule_id, name, category, variables} · POST /automation/rules {template_id, variables}
     @mcp    automation_rules_read · automation_rules_create
     @data   AutomationRuleTemplate (organization_id null = system, module, key, name, description, category, definition, variables, is_system, is_published, usage_count, created_by_membership_id)
     @ui     Card grid, Tabs (System / Organization), Sheet preview with the flow summary and a variables form, Dialog "Save workflow as template"
     @states loading · empty ("No templates in this category") · error · no-access
     @audit  template published, unpublished, used (usage_count + 1, rule created with template_id)
     @note   System templates (is_system) ship with the platform and are read-only; organization templates are saved from an existing rule and can be unpublished. Using a template copies `definition` into a new DRAFT rule and asks for the template's `variables`
             (days, stage, template ids). Actions the author cannot perform or modules that are disabled are listed as "needs" before use.
     ===================================================================================================================== */
  const TPL = [
    ["Deal won → create project from template", "CRM", "Sales", "On Won, create the project, assign the PM, notify finance.", ["Deal stage = Won", "Create project", "Assign", "Notify"], 41, 1],
    ["Lead → assign round-robin and follow up", "CRM", "Sales", "Assign new leads by round-robin and create a follow-up task after 2 days.", ["Lead created", "Assign ROUND_ROBIN", "Wait 2 d", "Task"], 33, 1],
    ["Proposal accepted → draft contract", "PROPOSALS", "Sales", "Create a contract from template when a proposal is accepted.", ["Proposal accepted", "Contract from template", "Notify"], 19, 1],
    ["Contract expiring → notify owner", "CONTRACTS", "Contracts", "30, 14 and 7 days before the end date notify the owner and legal.", ["Date relative", "Notify", "Wait", "Notify"], 27, 1],
    ["Invoice overdue → reminder ladder", "FINANCE", "Finance", "Reminder after 3, 7 and 14 days with approval for the last step.", ["Invoice overdue", "Wait", "Send email", "Approval", "Task"], 38, 1],
    ["Payment failed → dunning email", "FINANCE", "Finance", "Notify the customer and finance when a card payment fails.", ["Payment failed", "Send email", "Notify"], 22, 1],
    ["New ticket → AI classify and route", "SUPPORT", "Support", "Classify, set priority and assign to the right team; low confidence asks for approval.", ["Ticket created", "AI classify", "Assign", "Approval"], 52, 1],
    ["SLA at risk → escalate", "SUPPORT", "Support", "Post to the team channel and notify the lead.", ["SLA at risk", "Post message", "Notify"], 31, 1],
    ["Leave requested → manager approval", "EMPLOYEES", "HR", "Ask the manager for approval, notify the employee.", ["Leave requested", "Approval", "Notify"], 18, 1],
    ["Project completed → archive channel", "MESSAGING", "Projects", "Archive the project channel 14 days after completion.", ["Project completed", "Wait 14 d", "Manage channel"], 15, 1],
    ["Weekly status digest", "PROJECTS", "Projects", "Every Monday post a summary of project health to a channel.", ["Schedule", "AI summarize", "Post message"], 24, 1],
    ["Retainer renewal reminder (our agency)", "CONTRACTS", "Contracts", "Our own version: remind 45 days before renewal and create a call task.", ["Date relative", "Task", "Notify"], 3, 0],
  ];
  function templates() {
    return '<div class="a-page">' + head("Templates", "Ready recipes. A template copies into a normal draft workflow you can edit.", btn("Save a workflow as template", "layers") + btn("Start blank", "plus", "primary")) +
      '<div class="tabset">' + tabs([["s", "System", 11], ["o", "Our templates", 1]], "s") + "</div>" +
      '<div class="toolbar">' + search("Search templates") + sel("Module: All", "grid") + sel("Category: All", "tag") + sel("Sort: Most used", "sort") + "</div>" +
      '<div class="tgrid">' + TPL.map((t) => '<div class="tcard"><div style="display:flex;gap:6px;align-items:center">' + E(t[1]) + '<span class="badge">' + t[2] + "</span>" + (t[6] ? "" : '<span class="badge blue">organization</span>') + '</div><h3>' + t[0] + "</h3><p>" + t[3] + '</p><div class="flow-mini">' + t[4].map((x) => "<span>" + x + "</span>").join("") + '</div><div class="ft">' + I("users", 12) + " used " + t[5] + ' times<span style="flex:1"></span>' + btn("Preview", "", "sm") + btn("Use", "plus", "sm primary") + "</div></div>").join("") + "</div>" +
      cd("<b>Preview · Deal won → create project from template</b><span class='r'>" + btn("Use this template", "plus", "primary") + "</span>", '<div class="g2" style="align-items:start"><div>' + kv("Module", "CRM") + kv("Trigger", mono("crm.deal.stage_changed")) + kv("Steps", "9 (1 customer-facing, 1 AI step)") + kv("Needs", "projects.projects.create, tasks.tasks.create, communications.messages.send") + kv("Modules required", "CRM, Projects, Tasks, Communication") + "</div><div>" + fld("Variable: pipeline stage", sel("Won")) + fld("Variable: project template", sel("Website build", "folder")) + fld("Variable: notify member", sel("Finance team", "users")) + "</div></div>") +
      dm(["AutomationRuleTemplate · organization_id (null = system), module, key, name, description, category, definition, variables, is_system, is_published, usage_count, created_by_membership_id", "AutomationRule · template_id"], []) + "</div>";
  }

  /* =====================================================================================================================
     WEBHOOKS — outbound endpoints, inbound endpoints, deliveries (spec §12)
     @route  /automation/webhooks?tab=outbound|inbound|deliveries&status=&q=
     @perm   VIEW and manage automation.webhooks.manage* (the whole screen is sensitive: secrets, URLs, signing). Delivery log of rules' CALL_WEBHOOK steps is visible with automation.runs.read
     @api    GET/POST/PATCH/DELETE /webhooks/outbound · POST /webhooks/outbound/:id/test|rotate-secret|pause|resume · GET /webhooks/deliveries?webhook_id=&status= · POST /webhooks/deliveries/:id/retry · GET/POST/PATCH /webhooks/inbound · POST /webhooks/inbound/:id/rotate-secret|revoke · public POST /hooks/in/:slug (signed)
     @mcp    automation_webhooks_manage (sensitive: human confirmation for AI callers; secrets are never returned)
     @data   OutboundWebhook (name, url, secret, signing_algorithm, subscribed_events, headers, channel_id, include_direct_messages, content_type, api_version, status, max_attempts, retry_backoff_seconds, timeout_seconds, disable_after_failures, consecutive_failures, last_delivery_at, last_success_at, last_failure_at, disabled_at, disabled_reason) ·
             WebhookDelivery (webhook_id, event_id, run_step_id, event_key, status, payload, request_headers, attempt, max_attempts, next_retry_at, response_status_code, response_body, response_headers, error_message, duration_ms, delivery_key, delivered_at, dead_lettered_at) ·
             AutomationInboundWebhook (rule_id, name, slug, auth_scheme, secret, signature_header, payload_schema, payload_mapping, allowed_ip_ranges, status, rate_limit_per_minute, received_count, rejected_count, last_received_at, last_rejected_at, last_rejection_reason, secret_rotated_at, revoked_at)
     @ui     Tabs, Table, row DropdownMenu, Sheet for delivery detail (request / response JSON), copy-to-clipboard for URLs, one-time secret reveal Dialog, Switch for pause
     @states loading · empty ("No endpoints yet") · error · no-access · auto-disabled banner
     @audit  endpoint created / edited / paused / disabled, secret rotated (never the value), delivery retried, inbound request rejected (counted, sampled)
     @note   Outbound: HMAC signature of the body with `secret` (shown once, stored encrypted); events come from `subscribed_events` (only trigger keys with webhook_subscribable) and from CALL_WEBHOOK steps. Auto-disabled after disable_after_failures consecutive failures
             (disabled_reason is shown). The Messaging integration (12) can point `channel_id` here. Inbound: external systems POST to /hooks/in/<slug>; the request is authenticated with auth_scheme, checked against allowed_ip_ranges and rate limit, logged as a PlatformEvent
             (source INBOUND_WEBHOOK), mapped with payload_mapping and starts `rule_id`. Rejections are counted but the payload is not stored.
     ===================================================================================================================== */
  function webhooks() {
    const out = [
      ["Accounting export", "https://api.books.example/hooks/logiq", "finance.invoice.created, finance.invoice.paid, finance.invoice.overdue", "ACTIVE", "HMAC SHA-256", "Nov 11 10:58", "502 · 1 failure in a row", "98.4%"],
      ["Zapier · CRM sync", "https://hooks.zapier.example/catch/4021/abc", "crm.lead.created, crm.deal.stage_changed", "DISABLED", "HMAC SHA-256", "Nov 10 13:22", "disabled: 10 consecutive failures", "71.0%"],
      ["Slack #wins", "https://chat.example/hooks/T00/B00", "crm.deal.stage_changed", "ACTIVE", "HMAC SHA-256", "Nov 11 11:48", "200", "100%"],
      ["Data warehouse", "https://dw.example/ingest", "projects.project.status_changed, tasks.task.overdue", "PAUSED", "HMAC SHA-256", "Nov 2 09:00", "paused by Marco Silva", "99.1%"],
    ];
    const inn = [
      ["Website leads", "website-leads", "HMAC_SHA256", "Website form lead → create lead and assign", "ACTIVE", "1,204", "14 (rate limit 4, bad signature 10)", "8 min ago"],
      ["Typeform feedback", "typeform-feedback", "BEARER_TOKEN", "Feedback → create task", "ACTIVE", "86", "0", "Yesterday"],
      ["Legacy ERP", "legacy-erp", "BASIC", "(no rule)", "PAUSED", "12", "2", "Oct 3"],
      ["Old CRM import", "old-crm", "NONE", "(no rule)", "REVOKED", "40", "0", "Jun 12"],
    ];
    return '<div class="a-page">' + head("Webhooks", "Send events to other systems and let other systems start workflows.", btn("New inbound endpoint", "plus") + btn("New outbound endpoint", "plus", "primary")) +
      '<div class="tabset">' + tabs([["o", "Outbound", 4], ["i", "Inbound", 4], ["d", "Deliveries", 128]], "o") +
      pane("o", 1, callout("flag", "<b>Zapier · CRM sync is disabled.</b> 10 consecutive failures (HTTP 410). Update the URL and resume to retry the 2 dead-lettered deliveries.", "warn") + sp(10) + '<div class="toolbar">' + search("Search name or URL") + sel("Status: All", "filter") + sel("Event: All", "zap") + "</div>" + tbl(["Endpoint", "Events", "Status", "Signing", "Last delivery", "Last result", ">Success", ""], out.map((o) => [ink(o[0]) + '<small class="muted" style="display:block">' + mono(o[1]) + "</small>", '<span class="muted">' + o[2] + "</span>", st(o[3]), o[4], o[5], o[6], o[7], more]))) +
      pane("i", 0, tbl(["Endpoint", "Public URL", "Auth", "Starts workflow", "Status", ">Received", ">Rejected", "Last received", ""], inn.map((o) => [ink(o[0]), mono("/hooks/in/" + o[1]), E(o[2]), o[3], st(o[4]), o[5], o[6], o[7], more]))) +
      pane("d", 0, filterBar([["Status", "is any of", "Failed, Retry scheduled, Dead lettered"], ["Endpoint", "is", "Any"]]) + tbl(["Delivery", "Endpoint", "Event", "Status", "HTTP", ">Attempt", ">Duration", "Next retry", ""], [[mono("dlv_912"), "Zapier · CRM sync", mono("crm.deal.stage_changed"), st("DEAD_LETTERED"), "410", "8/8", "0.3 s", "—", btn("Retry", "", "sm")], [mono("dlv_920"), "Accounting export", mono("finance.invoice.overdue"), st("RETRY_SCHEDULED"), "502", "2/5", "6.0 s", "11:15", btn("Retry now", "", "sm")], [mono("dlv_91f"), "Slack #wins", mono("crm.deal.stage_changed"), st("SUCCEEDED"), "200", "1/5", "0.4 s", "—", ""], [mono("dlv_91c"), "Accounting export", mono("finance.invoice.paid"), st("SUCCEEDED"), "204", "1/5", "0.5 s", "—", ""], [mono("dlv_91a"), "Data warehouse", mono("tasks.task.overdue"), st("PENDING"), "—", "0/5", "—", "—", ""]]) + sp() +
        cd("<b>dlv_920 · request and response</b><span class='r muted'>WebhookDelivery</span>", '<div class="g2"><div><small class="muted">request_headers · payload</small>' + js({ "X-Logiq-Event": "finance.invoice.overdue", "X-Logiq-Delivery": "dlv_920", "X-Logiq-Signature": "sha256=•••••••", payload: { invoice: "INV-2026-0418", amount: 4800 } }) + '</div><div><small class="muted">response_status_code 502 · response_body</small>' + js({ error: "Bad gateway" }) + "</div></div>")) + "</div>" +
      dm(["OutboundWebhook · name, url, secret (encrypted), signing_algorithm, subscribed_events, headers, channel_id, status, max_attempts, retry_backoff_seconds, timeout_seconds, disable_after_failures, consecutive_failures, disabled_reason", "WebhookDelivery · status, attempt, response_status_code, error_message, next_retry_at, delivery_key", "AutomationInboundWebhook · slug, auth_scheme, secret, rule_id, allowed_ip_ranges, status, received_count, rejected_count"], []) + "</div>";
  }

  /* =====================================================================================================================
     WEBHOOK FORM — create / edit outbound or inbound endpoint (spec §12)
     @route  /automation/webhooks/new?type=outbound|inbound · /automation/webhooks/:id/edit
     @perm   automation.webhooks.manage* · linking an inbound endpoint to a rule needs automation.rules.update on it
     @api    POST /webhooks/outbound {name, description, url, subscribed_events[], headers, content_type, api_version, max_attempts, retry_backoff_seconds, timeout_seconds, disable_after_failures, channel_id?, include_direct_messages} · POST /webhooks/inbound {name, description, rule_id, slug, auth_scheme, signature_header, payload_schema, payload_mapping, allowed_ip_ranges, rate_limit_per_minute}
     @mcp    automation_webhooks_manage
     @data   OutboundWebhook (all columns above) · AutomationInboundWebhook (all columns above) · AutomationTriggerDefinition (webhook_subscribable) · Channel (12, channel_id)
     @ui     Segmented type switch, Form sections, multi-select Popover+Command for events (only webhook_subscribable triggers), key-value editor for headers, Textarea JSON editor for schema and mapping, one-time secret reveal Dialog, "Send test event" button
     @states validation inline (https URL required, private network URLs refused (SSRF guard), slug unique) · saving · created (shows the secret once) · error · no-access
     @audit  created / edited / secret rotated / test sent
     @note   URLs must be https and public; internal addresses are blocked. The signing secret is generated by the server and shown once; rotating keeps the old secret valid for a grace period. Headers marked secret are stored encrypted.
             For inbound, the mapping translates the external payload into the event payload (payload_mapping) and payload_schema validates it before it becomes a PlatformEvent.
     ===================================================================================================================== */
  function webhookNew() {
    return '<div class="a-page">' + head("New webhook endpoint", "Outbound sends events out. Inbound receives signed requests and starts a workflow.", btn("Cancel") + btn("Send test event", "send") + btn("Create endpoint", "plus", "primary")) +
      fld("Direction", seg(["Outbound", "Inbound"], "Outbound")) +
      '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div>' +
      cd("<b>Outbound endpoint</b>", fld("Name", box("Accounting export")) + fld("Description", box("Sends invoice events to the accounting system.")) + fld("URL", box("https://api.books.example/hooks/logiq"), "https only. Private and internal addresses are refused.") +
        fld("Events", '<div class="flow-mini">' + ["finance.invoice.created", "finance.invoice.paid", "finance.invoice.overdue"].map((e) => "<span>" + e + "</span>").join("") + "</div>" + sp(6) + sel("Add events… (webhook_subscribable triggers)", "zap")) + two(fld("Content type", sel("application/json")), fld("API version", sel("2026-10"))) +
        fld("Headers", '<div class="cond"><span class="f">X-Source</span><span class="v">logiq</span></div><div class="cond"><span class="f">Authorization</span><span class="v">•••••••• (secret)</span></div>' + btn("Add header", "plus", "sm")) +
        fld("Signing", '<div class="rowx" style="padding:0;gap:10px"><span class="badge">HMAC SHA-256</span><span class="muted">Secret generated on create and shown once.</span></div>')) + sp() +
      cd("<b>Messaging link</b><span class='r muted'>optional</span>", fld("Channel (Messaging 12)", sel("Not linked", "chat"), "When set, events are mirrored into this channel by the Messaging integration (channel_id).") + '<div class="rowx"><div class="grow"><b>Include direct messages</b><small>Only for message events (include_direct_messages)</small></div>' + sw(0) + "</div>") + sp() +
      cd("<b>Inbound endpoint (when direction is Inbound)</b>", two(fld("Name", box("Website leads")), fld("Slug", box("website-leads"), "URL: /hooks/in/website-leads")) + fld("Starts workflow", sel("Website form lead → create lead and assign", "zap")) + two(fld("Auth scheme", sel("HMAC_SHA256")), fld("Signature header", box("X-Signature"))) + fld("Allowed IP ranges", box("203.0.113.0/24, 198.51.100.7/32")) + fld("Rate limit per minute", box("60")) +
        fld("Payload schema", js({ type: "object", required: ["email"], properties: { email: "string", name: "string", message: "string" } })) + fld("Payload mapping", js({ "contact.email": "$.email", "contact.name": "$.name", "lead.source": "website" }))) + "</div><div>" +
      cd("<b>Delivery reliability</b>", two(fld("Max attempts", box("5")), fld("Backoff (s)", box("60"))) + two(fld("Timeout (s)", box("10")), fld("Disable after failures", box("10"), "Consecutive failures before the endpoint is disabled. Empty = never.")) + callout("flag", "Failed deliveries retry with exponential backoff. After max attempts a delivery is dead-lettered and an alert is sent.")) + sp() +
      cd("<b>Secret</b>", '<div class="rowx"><div class="grow"><b>Signing secret</b><small>Shown once after creation. Rotate to issue a new one.</small></div>' + btn("Rotate", "key", "sm") + "</div>") + "</div></div>" +
      dm(["OutboundWebhook · name, description, url, secret, signing_algorithm, subscribed_events, headers, channel_id, include_direct_messages, content_type, api_version, max_attempts, retry_backoff_seconds, timeout_seconds, disable_after_failures", "AutomationInboundWebhook · name, description, slug, rule_id, auth_scheme, secret, signature_header, payload_schema, payload_mapping, allowed_ip_ranges, rate_limit_per_minute"], []) + "</div>";
  }

  /* =====================================================================================================================
     APPROVALS INSIDE WORKFLOWS (spec §4, §9, §14)
     @route  /automation/approvals?decision=PENDING&mine=1 · /automation/approvals/:id
     @perm   VIEW own pending approvals: any member who was asked (requested_from_membership_id or listed in requested_from); all approvals automation.runs.read · decide: only the requested approver (checked on the server, not a catalog key) · cancel automation.rules.update · approver policies automation.approval_policies.manage*
     @api    GET /automation/approvals?decision=&mine=&cursor= · POST /automation/approvals/:id/decide {decision: APPROVED|REJECTED, comment} · POST /automation/approvals/:id/cancel · GET/POST/PATCH /automation/approval-policies · POST /automation/approval-policies/:id/archive
     @mcp    automation_runs_read (decide is NOT exposed to MCP: a human decision, never an agent)
     @data   AutomationApproval (run_id, step_id, decision, context, requested_from_membership_id, requested_from, approver_membership_id, comment, requested_at, expires_at, decided_at, notification_id, policy_id, escalated_at, escalated_to_membership_id) · AutomationApprovalPolicy (name, description, approver_membership_ids, approver_team_ids, approver_role_ids, allow_rule_owner, expires_after_hours, escalate_after_hours, escalate_to_membership_id, delegate_when_out_of_office, archived_at) · AutomationRunStep (AWAITING_APPROVAL) · AutomationAiStep (requires_approval, confidence, passed_threshold) · Notification (14, notification_id)
     @ui     Table + filter bar, Sheet with context card, Approve / Reject buttons with a required comment on reject, Badge per AutomationApprovalDecision
     @states loading · empty ("Nothing waiting for you") · error · no-access · expired banner
     @audit  approval requested, approved, rejected, expired, cancelled (actor and comment)
     @note   An APPROVAL step pauses the run (status AWAITING_APPROVAL) until a member decides or expires_at passes (decision EXPIRED, the rule's on_error setting decides if the run stops or continues). The context shows exactly what will happen next
             (e.g. the email text that an AI step drafted, with confidence). AI steps below their threshold create an approval automatically. Approvers are notified through 14 (notification_id).
             A step can name an AutomationApprovalPolicy (approval.policy_id): the request goes to the policy's members, teams and roles, expires after expires_after_hours, is escalated to escalate_to_membership_id after escalate_after_hours, and skips approvers who are on leave (10) or out of office (19) when delegate_when_out_of_office. First decision wins; quorum approval is Phase 2.
     ===================================================================================================================== */
  function approvals() {
    return '<div class="a-page">' + head("Approvals", "Workflow steps waiting for a human decision.", sel("Mine only", "users")) +
      '<div class="mini-stats">' + stat("Waiting for you", 2, "oldest 5 h") + stat("Waiting (all)", 3, "") + stat("Decided (7 d)", 21, "18 approved") + stat("Expired", 1, "last 7 d") + "</div>" +
      '<div class="tabset">' + tabs([["p", "Pending", 3], ["d", "Decided"], ["e", "Expired and cancelled"]], "p") + "</div>" +
      tbl(["Request", "Workflow", "Run", "Asked", "Requested", "Expires", "Decision", ""], [[ink("Send kickoff email to Acme Corp") + '<small class="muted" style="display:block">AI draft · confidence 0.86</small>', "Deal won → create project", mono("run_8f19"), "Anna Meyer (you)", "3 h ago", "in 21 h", st("PENDING") + "", btn("Review", "", "sm primary")], [ink("Leave request · Jonas Koch · Dec 22–Jan 2"), "Leave request → manager approval", mono("run_8ed9"), "Anna Meyer (you)", "Yesterday", "in 2 d", st("PENDING"), btn("Review", "", "sm primary")], [ink("Reply to TCK-2051 with refund offer") + '<small class="muted" style="display:block">AI draft · confidence 0.62 &lt; 0.80</small>', "New ticket → AI classify and route", mono("run_8f2c"), "Support leads (Kim Lund)", "2 min ago", "in 4 h", st("PENDING"), btn("Open", "", "sm")], [ink("Reminder wording"), "Invoice overdue → reminder", mono("run_8f10"), "Marco Silva", "2 d ago", "—", st("APPROVED"), ""], [ink("Delete 14 stale leads"), "Cleanup stale leads", mono("run_8c02"), "Anna Meyer", "Nov 2", "—", st("REJECTED"), ""]]) + sp() +
      '<div class="g2" style="grid-template-columns:1.4fr 1fr;align-items:start">' + cd("<b>Send kickoff email to Acme Corp</b><span class='r'>" + st("PENDING") + "</span>", kv("Workflow", "Deal won → create project from template · v7") + kv("Step", "6 · APPROVAL after AI_STEP DRAFT") + kv("Record", "Deal · Acme redesign") + sp(8) + "<small class='muted'>context · what will be sent</small>" + js({ to: "lena.kovac@acme.example", subject: "Welcome to your project kickoff", body: "Hi Lena, we are excited to start…", confidence: 0.86 }) + sp(10) + fld("Comment", box("Required when rejecting")) + '<div class="rowx" style="padding:0;gap:8px">' + btn("Reject", "x", "") + btn("Approve and continue", "check", "primary") + "</div>") +
      cd("<b>Rules</b>", kv("Policy", "Finance leads " + muted("AutomationApprovalPolicy")) + kv("Requested from", "3 members + team Finance (policy)") + kv("Expires", "24 h after request " + muted("expires_after_hours")) + kv("Escalates", "to Sofia Jensen after 8 h " + muted("escalate_after_hours")) + kv("Out of office", "next approver " + muted("delegate_when_out_of_office")) + kv("On expiry", "Stop the run (on_error)") + kv("Notified", "Notification (14) + email") + callout("shield", "Decisions are human only. API keys, service accounts and MCP tools cannot approve.")) + "</div>" +
      dm(["AutomationApproval · run_id, step_id, decision, context, requested_from_membership_id, requested_from, approver_membership_id, comment, requested_at, expires_at, decided_at, notification_id", "AutomationApprovalPolicy · name, approver_membership_ids, approver_team_ids, approver_role_ids, allow_rule_owner, expires_after_hours, escalate_after_hours, escalate_to_membership_id, delegate_when_out_of_office, archived_at", "AutomationApproval · policy_id, escalated_at, escalated_to_membership_id", "AutomationRunStep · status AWAITING_APPROVAL · AutomationAiStep · requires_approval, confidence, passed_threshold"], []) + "</div>";
  }

  /* =====================================================================================================================
     AI AGENTS AND MCP TOOLS (spec §9, 01 §76, access channels)
     @route  /automation/agents?tab=accounts|ai|mcp
     @perm   VIEW automation.rules.read · manage service accounts automation.service_accounts.manage* (with 01) · AI step statistics automation.runs.read
     @api    GET /service-accounts?used_by=automation · GET /automation/ai-steps/stats?from=&to= · GET /automation/mcp-tools (the tools of this module and the keys they need)
     @mcp    automation_rules_read · automation_service_accounts_manage (sensitive)
     @data   ServiceAccount (name, purpose, status, expires_at, owner_membership_id, run_as for rules) · ApiKey (01, scopes, expiry) · AutomationRule.run_as_service_account_id · AutomationAiStep (kind, provider, model, confidence, confidence_threshold, passed_threshold, requires_approval, input_tokens, output_tokens, cost_amount, latency_ms) · AutomationSettings.default_service_account_id, ai_default_confidence_threshold · IntegrationConnection (OPENAI, BYOK, 17 providers screen)
     @ui     Tabs, Table, Badge (sensitive *), Progress, Popover + Command for permission summary
     @states loading · empty · error · no-access (tab hidden without the key) · expired / disabled account warning
     @audit  service account created, role assignment changed, key rotated, default changed
     @note   Three views of the same principle: (1) service accounts are the identities workflows run as (least privilege, expiry, owner); (2) AI steps are costed per provider call and gated by confidence; (3) MCP tools are the agent-facing mirror of the REST API
             of this module, listed only to callers holding the key, sensitive tools (*) need human confirmation when an AI agent calls them. Tool name = <module>_<resource>_<action>.
             CALL LOG: every MCP tool call is a McpToolCall row (01 §75, §136: tool_name, permission_key, actor_type, api_key_id, service_account_id, actor_membership_id, client_name, status SUCCEEDED | FAILED | DENIED | AWAITING_CONFIRMATION | REJECTED | EXPIRED, confirmed_by_membership_id, confirmed_at, input_summary redacted, error_code, duration_ms). Viewing it needs organizations.mcp_calls.read*.
     ===================================================================================================================== */
  function agents() {
    const T = [
      ["automation_rules_read", "automation.rules.read", 0, "List and read workflows, versions"], ["automation_rules_create", "automation.rules.create", 0, "Create a draft workflow"], ["automation_rules_update", "automation.rules.update", 0, "Edit a draft, run test and dry run"], ["automation_rules_enable", "automation.rules.enable", 1, "Publish, enable and disable a workflow"],
      ["automation_rules_delete", "automation.rules.delete", 1, "Archive or delete a workflow"], ["automation_rules_manage", "automation.rules.manage", 1, "Import, export, change owner and run-as"], ["automation_runs_read", "automation.runs.read", 0, "List runs, steps, events, approvals"], ["automation_jobs_read", "automation.jobs.read", 0, "List scheduled jobs and their runs"],
      ["automation_jobs_manage", "automation.jobs.manage", 1, "Create, pause, run scheduled jobs"], ["automation_webhooks_manage", "automation.webhooks.manage", 1, "Manage inbound and outbound endpoints"], ["automation_settings_manage", "automation.settings.manage", 1, "Change engine guardrails and limits"], ["automation_runs_manage", "automation.runs.manage", 1, "Retry, cancel, reprocess events, replay"], ["automation_templates_manage", "automation.templates.manage", 0, "Publish organization templates"], ["automation_rules_run", "automation.rules.run", 0, "Run a manual workflow now"], ["automation_approval_policies_manage", "automation.approval_policies.manage", 1, "Manage approver policies"],
      ["automation_service_accounts_manage", "automation.service_accounts.manage", 1, "Create service accounts for workflows"], ["automation_actions_destructive_enable", "automation.actions.destructive.enable", 1, "Allow destructive actions in a workflow"],
    ];
    return '<div class="a-page">' + head("AI agents and MCP", "Who workflows run as, what AI steps cost and which tools agents may call.", btn("New service account", "plus", "primary")) +
      '<div class="tabset">' + tabs([["a", "Service accounts", 4], ["i", "AI steps"], ["m", "MCP tools", 13]], "a") +
      pane("a", 1, tbl(["Service account", "Purpose", "Status", "Owner", "Workflows", "API keys", "Expires", ""], [[ink("Automation · Sales"), "Sales workflows", st("ACTIVE"), wh("AM"), "3", "1", "Never", more], [ink("Automation · Finance"), "Reminders and exports", st("ACTIVE"), wh("MS"), "2", "1", "Dec 31", more], [ink("Automation · Support"), "Triage and SLA", st("ACTIVE"), wh("KL"), "2", "2", "Never", more], [ink("Automation · HR"), "Leave workflows", '<span class="badge yellow" title="expires_at soon">expires in 9 d</span>', wh("SJ"), "1", "0", "Nov 20", more]]) + sp() +
        callout("shield", "Default for new workflows: <b>Automation · Sales</b> (AutomationSettings.default_service_account_id). A service account holds explicit permission keys and scope, never a human's full access; audit actor type SERVICE_ACCOUNT.")) +
      pane("i", 0, '<div class="mini-stats">' + stat("AI steps (30 d)", "2,410", "") + stat("Passed threshold", "91%", "") + stat("Sent to approval", "9%", "") + stat("Avg confidence", "0.88", "") + stat("Cost (30 d)", "18.40 EUR", "OPENAI, BYOK") + "</div>" + tbl(["Kind", "Model", ">Steps", ">Avg confidence", "Passed", ">Tokens in / out", ">Cost", ">p95 latency"], [[E("CLASSIFY"), "gpt-4.1-mini", "1,520", "0.93", bar(96, "green"), "310k / 12k", "4.80", "1.4 s"], [E("SUMMARIZE"), "gpt-4.1", "380", "0.90", bar(92, "green"), "620k / 94k", "7.90", "4.2 s"], [E("EXTRACT"), "gpt-4.1-mini", "310", "0.84", bar(81, "yellow"), "180k / 20k", "2.10", "2.1 s"], [E("DRAFT"), "gpt-4.1", "200", "0.79", bar(70, "yellow"), "210k / 88k", "3.60", "5.8 s"]]) + callout("sparkles", "Provider keys are per organization (OPENAI via the integrations screen, BYOK). AI steps never run irreversible actions on their own and below the threshold they wait for approval.")) +
      pane("m", 0, callout("key", "Tools are listed only to callers holding the key. Tools marked <b>*</b> are sensitive and need human confirmation when an AI agent calls them. API keys and service accounts use the same keys.") + sp(10) + tbl(["MCP tool", "Permission key", "Sensitive", "What it does", "Channels"], T.map((t) => [mono(t[0]), mono(t[1]), t[2] ? '<span class="badge yellow">* confirm</span>' : "No", t[3], "UI · REST · MCP · API key"])) + sp() +
        cd("<b>Recent agent calls</b><span class='r muted'>McpToolCall · organizations.mcp_calls.read*</span>", tbl(["When", "Tool", "Caller", "Permission checked", "Status", "Confirmed by"], [["Nov 11 10:42", mono("crm_deals_update"), "Support triage agent · API key ak_9f2…", mono("crm.deals.update"), E("SUCCEEDED", "green"), "—"], ["Nov 11 10:31", mono("automation_rules_enable"), "Claude Desktop · for Anna Meyer", mono("automation.rules.enable"), E("AWAITING_CONFIRMATION", "yellow"), btn("Confirm", "check", "sm")], ["Nov 11 09:58", mono("finance_invoices_delete"), "Finance bot · service account", mono("finance.invoices.delete"), E("DENIED", "red"), "—"], ["Nov 10 17:20", mono("tasks_tasks_create"), "Standup agent · API key ak_31c…", mono("tasks.tasks.create"), E("SUCCEEDED", "green"), "—"], ["Nov 10 16:05", mono("automation_rules_delete"), "Claude Desktop · for Marco Silva", mono("automation.rules.delete"), E("SUCCEEDED", "green"), "Marco Silva · 16:06"]]).replace('class="panel tbl-x" style="margin-top:0"', 'class="tbl-x"'), 1)) + "</div>" +
      dm(["ServiceAccount · name, purpose, status, expires_at, owner_membership_id · AutomationRule · run_as_service_account_id · AutomationSettings · default_service_account_id", "AutomationAiStep · kind, provider, model, confidence, confidence_threshold, passed_threshold, requires_approval, input_tokens, output_tokens, cost_amount, latency_ms", "McpToolCall · tool_name, permission_key, actor_type, api_key_id, service_account_id, actor_membership_id, client_name, status, requires_confirmation, confirmed_by_membership_id, confirmed_at, input_summary, error_code, duration_ms", "Permission catalog · 17 automation.* keys (MCP tool = module_resource_action)"], []) + "</div>";
  }

  /* =====================================================================================================================
     SETTINGS — engine guardrails (spec §6, §8, §9, §10)
     @route  /automation/settings?tab=limits|safety|retention|defaults
     @perm   VIEW and edit automation.settings.manage* · enabling destructive actions automation.actions.destructive.enable* (separate key, recorded with who and when) · default service account automation.service_accounts.manage*
     @api    GET/PATCH /automation/settings
     @mcp    automation_settings_manage (sensitive)
     @data   AutomationSettings (org_rate_limit_per_hour, default_rule_rate_limit_per_hour, max_trigger_depth, default_max_retries, default_retry_backoff_seconds, destructive_actions_enabled, destructive_actions_enabled_at, destructive_actions_enabled_by_membership_id, destructive_requires_approval, run_retention_days, event_retention_days, job_run_retention_days, dead_letter_alerts_enabled, dead_letter_alert_membership_ids, dead_letter_alert_notify_rule_owner, dead_letter_alert_channel_id, default_service_account_id, ai_default_confidence_threshold, updated_at)
     @ui     Form Cards with Input (number) / Switch / Select, AlertDialog for enabling destructive actions (type the organization name to confirm), "unsaved changes" bar
     @states loading · saved toast · validation (limits ≥ 1, depth 1–10, retention ≥ 7 days or empty) · error · no-access (read-only for users without manage)
     @audit  every change with before and after; enabling destructive actions records the actor and time
     @note   One row per organization. Limits are guardrails, not billing: a rule over its hourly limit has runs SKIPPED with a reason and an alert. Retention empty = keep forever (legal holds in 17 are not overridden). Lowering retention deletes older rows in the next job run, after a warning.
             Enabling destructive actions (delete, payment, external send) is deliberate: separate key, confirmation dialog, who and when stored (destructive_actions_enabled_at / _by_membership_id), optional approval.
     ===================================================================================================================== */
  function settings() {
    const nf = (l, v, h) => fld(l, box(v), h);
    return '<div class="a-page">' + head("Automation settings", "Guardrails for every workflow and job of this organization.", btn("Discard") + btn("Save changes", "check", "primary")) +
      '<div class="g2" style="align-items:start"><div>' +
      cd("<b>Limits and loop protection</b>", nf("Organization rate limit per hour", "1,000", "Runs started per hour across all workflows. Above it runs are SKIPPED.") + nf("Default rule rate limit per hour", "200", "Used when a rule has no own limit.") + nf("Max trigger depth", "3", "A workflow cannot re-trigger itself through its actions beyond this depth (loop protection).")) + sp() +
      cd("<b>Retries</b>", two(nf("Default max retries", "3"), nf("Default backoff (seconds)", "60")) + '<div class="sub-note">Exponential backoff. Only retryable actions are retried; permanent failures go to dead letter.</div>') + sp() +
      cd("<b>Retention</b>", two(nf("Run history (days)", "90"), nf("Event log (days)", "30")) + nf("Scheduled job runs (days)", "30", "Empty keeps everything. A legal hold from Documents (17) is never overridden.") + callout("flag", "Lowering retention deletes older rows at the next cleanup job. You are warned with the number of rows.", "warn")) +
      "</div><div>" +
      cd("<b>Destructive and customer-facing actions</b>", '<div class="rowx"><div class="grow"><b>Allow destructive actions</b><small>Delete records, payments, external sends. Needs automation.actions.destructive.enable*.</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Require approval by default</b><small>destructive_requires_approval</small></div>' + sw(1) + "</div>" + kv("Enabled by", "Anna Meyer") + kv("Enabled at", "Oct 2, 14:20") + callout("shield", "Mandatory module logic (contract immutability, ledger rules, permission checks) is enforced by the module and cannot be bypassed by any workflow.")) + sp() +
      cd("<b>Defaults</b>", fld("Default service account", sel("Automation · Sales", "key"), "Pre-selected as the run-as principal of new workflows.") + fld("AI default confidence threshold", '<div class="rowx" style="padding:0"><div class="gauge" style="flex:1"><i style="width:80%"></i></div><b>0.80</b></div>', "Below it an AI step waits for human approval.")) + sp() +
      cd("<b>Alerts</b>", '<div class="rowx"><div class="grow"><b>Dead-letter alerts</b><small>dead_letter_alerts_enabled · notify through Notifications (14)</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Notify the rule owner</b><small>dead_letter_alert_notify_rule_owner</small></div>' + sw(1) + "</div>" + fld("Also notify", sel("Anna Meyer, Jonas Koch", "users"), "dead_letter_alert_membership_ids") + fld("Messaging channel", sel("#automation-alerts", "hash"), "dead_letter_alert_channel_id (12), optional")) + "</div></div>" +
      dm(["AutomationSettings · org_rate_limit_per_hour, default_rule_rate_limit_per_hour, max_trigger_depth, default_max_retries, default_retry_backoff_seconds, destructive_actions_enabled, destructive_actions_enabled_at, destructive_actions_enabled_by_membership_id, destructive_requires_approval, run_retention_days, event_retention_days, job_run_retention_days, dead_letter_alerts_enabled, dead_letter_alert_membership_ids, dead_letter_alert_notify_rule_owner, dead_letter_alert_channel_id, default_service_account_id, ai_default_confidence_threshold"], []) + "</div>";
  }

  /* =====================================================================================================================
     LIMITS AND USAGE (spec §6, §8, §9)
     @route  /automation/usage?range=7d|30d|month
     @perm   VIEW automation.runs.read (settings values need automation.settings.manage* to edit; reading is allowed)
     @api    GET /automation/usage?from=&to= (aggregates over AutomationRun, AutomationAiStep, WebhookDelivery, PlatformEvent)
     @mcp    automation_runs_read
     @data   AutomationRun (count by status, rule_id, created_at) · AutomationRunStep (count) · PlatformEvent (count by event_key) · WebhookDelivery (count by status) · AutomationAiStep (tokens, cost_amount) · ScheduledJobRun (count) · AutomationSettings (limits for the gauges) · OrganizationEntitlement (keys automation.runs_per_month, automation.ai_cost_cap_cents; limit_value, period, enforcement, source) · AutomationRule (rate_limit_per_hour)
     @ui     Card, gauges (Progress), bar chart, Table
     @states loading · empty · error · no-access
     @note   All numbers are computed from history and bounded by the retention settings. The gauges compare usage with AutomationSettings limits (organization hourly limit, per-rule limits). Plan quotas are OrganizationEntitlement rows (01 §56): key automation.runs_per_month (period MONTHLY) and automation.ai_cost_cap_cents; usage is counted here from AutomationRun and AutomationAiStep. A HARD limit pauses new runs (status SKIPPED, reason PLAN_LIMIT) and notifies; SOFT only notifies. Tenants read their limits, Logiqdev staff and plan changes write them.
     ===================================================================================================================== */
  function usage() {
    const g = (l, v, m, cls) => '<div class="rowl"><div class="grow"><b>' + l + "</b><small>" + v + "</small></div><div style=\"width:140px\"><div class=\"gauge\"><i class=\"" + (cls || "") + '" style="width:' + m + '%"></i></div></div></div>';
    return '<div class="a-page">' + head("Limits and usage", "How much the engine is used compared with your guardrails.", sel("Last 30 days", "calendar")) +
      '<div class="mini-stats">' + stat("Runs", "11,820", "30 days") + stat("Steps executed", "58,114", "avg 4.9 per run") + stat("Events", "42,306", "publish to 3 consumers") + stat("Webhook deliveries", "9,884", "98.1% ok") + stat("Job runs", "49,200", "99.8% ok") + stat("AI cost", "18.40 EUR", "OPENAI BYOK") + "</div>" +
      '<div class="g2" style="align-items:start">' + cd("<b>Limits</b><span class='r muted'>AutomationSettings</span>", g("Organization hourly limit", "peak 612 of 1,000 runs per hour", 61) + g("Website form lead (rule limit)", "peak 188 of 200 per hour", 94, "warn") + g("Max trigger depth", "deepest chain 2 of 3", 66) + g("Run history retention", "90 days · 11,820 rows", 40) + g("Event log retention", "30 days · 42,306 rows", 55) + g("Plan: runs per month", "11,820 of 25,000 · automation.runs_per_month", 47) + g("Plan: AI cost cap", "18.40 of 50.00 EUR · automation.ai_cost_cap_cents", 37), 1) +
      cd("<b>Skipped and limited</b>", '<div class="rowl"><div class="grow"><b>5 runs skipped: rate limit</b><small>Website form lead, Nov 10 09:00–10:00</small></div>' + st("SKIPPED") + '</div><div class="rowl"><div class="grow"><b>0 runs stopped: loop protection</b><small>max_trigger_depth 3</small></div></div><div class="rowl"><div class="grow"><b>2 runs timed out</b><small>timeout_seconds 120</small></div>' + st("FAILED") + "</div>", 1) + "</div>" + sp() +
      '<div class="g2" style="align-items:start">' + cd("<b>Top workflows by runs</b>", tbl(["Workflow", ">Runs", ">Failed", ">Avg duration"], [[ink("New ticket → AI classify and route"), "1,840", "22", "3.1 s"], [ink("Website form lead → create lead and assign"), "389", "14", "0.9 s"], [ink("Deal won → create project from template"), "214", "3", "2.4 s"], [ink("Invoice 7 days overdue → reminder"), "96", "11", "6.1 s"]]).replace('class="panel tbl-x" style="margin-top:0"', 'class="tbl-x"'), 1) +
      cd("<b>Top events</b>", tbl(["Event", ">Count", "Rules matched"], [[mono("tasks.task.updated"), "18,200", "2"], [mono("support.ticket.created"), "2,061", "1"], [mono("crm.deal.stage_changed"), "960", "3"], [mono("finance.invoice.overdue"), "310", "1"]]).replace('class="panel tbl-x" style="margin-top:0"', 'class="tbl-x"'), 1) + "</div>" +
      dm(["AutomationRun · AutomationRunStep · PlatformEvent · WebhookDelivery · ScheduledJobRun (counts)", "AutomationAiStep · input_tokens, output_tokens, cost_amount", "AutomationSettings · org_rate_limit_per_hour, default_rule_rate_limit_per_hour, max_trigger_depth, retention fields", "OrganizationEntitlement · key, limit_value, period, enforcement, source, valid_until (01 §56)"], []) + "</div>";
  }

  const MAP = { overview, workflows, create, builder, workflow, runs, run, deadletter, approvals, jobs, jobNew, job, events, triggers, actions, templates, webhooks, webhookNew, agents, usage, settings };
  const CRUMB = { builder: "Deal won → create project", workflow: "Deal won → create project", run: "run_8f10", job: "support.sla_timers" };
  window.VIEWS.automation = { html: function (s) { return (MAP[s || "overview"] || MAP.overview)(s); }, crumb: function (s) { return CRUMB[s] || ""; }, fill: false };
})();

