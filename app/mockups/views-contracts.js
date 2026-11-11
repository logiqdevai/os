/* =====================================================================================================================
   CONTRACTS APP — module 04 (docs/features/04-contracts.md)
   =====================================================================================================================
   SCHEMA-ALIGNED to api/prisma/schema.prisma: Contract, ContractParty, ContractSignatory, ContractProject, ContractVersion, ContractSection, ContractReview, ContractComment, ContractChangeRequest, ContractApproval,
   ContractObligation, ContractTermination, ContractType, ContractTemplate(+Version), ContractClause(+Version), ContractApprovalRule, SignatureRequest, Signer, SignatureEvent. Enums are real values (ContractStatus,
   ContractVersionStatus, ContractRelationKind, ContractRenewalType, ContractPartyType, ContractReviewDecision, ContractApprovalDecision, ContractChangeRequestStatus, ContractObligationType/Status, ExtractionReviewState,
   ContractTerminationType, ContractRiskLevel, SignatureType, SigningOrder, SignatureRequestStatus, SignerStatus, SignatureEventType). Permission keys: contracts.contracts.* (read, create, update, delete, archive,
   export, review, approve, amend, renew, terminate), contracts.versions.create, contracts.signatures.send/cancel, contracts.templates.manage, contracts.clauses.manage, contracts.types.manage,
   contracts.approval_rules.manage, contracts.obligations.manage, contracts.comments.internal.read, contracts.confidential_terms.read (FIELD-LEVEL), contracts.knowledge.search.
   Comment tags (legend in README.md): @screen @route @perm @api @mcp @data @ui @states @audit @note @gap. Every screen ends with a "Data model" footer (REVIEW-ONLY, do not ship).

   RULES THAT APPLY TO EVERY SCREEN HERE:
     - FOUR INDEPENDENT STATES (spec §86): document/version state, contract (lifecycle) state, project state, finance state. They are owned by different modules and shown side by side, never merged into one status.
     - EXACT VERSION BINDING: reviews, approvals and signatures each reference ONE ContractVersion. Approving v1 does not approve v1.1. Versions locked for signature or signed are IMMUTABLE (locked_at, content_hash, signed_hash);
       any change is a new version, an amendment or a renewal, never an edit of signed text. AI output never silently alters approved or signed language.
     - Internal vs customer-visible: reviews, comments, notes, risk data and some sections are internal (is_internal / customer_visible = false) and must never reach the customer portal (07). Enforce on the server.
     - Confidential terms (contracts.confidential_terms.read) are FIELD-LEVEL: without the key the fields are omitted by the API and the UI renders "Restricted", never an empty value.
     - Linked records stay with their owners: proposals (03), projects (05), invoices/subscriptions (08), documents (17), tasks (06), calendar events (19), notifications (14). Contracts store ids/links only.
   ===================================================================================================================== */
(function () {
  const U = window.UI;
  const { E, ES, S, head, btn, cd, sw, cb, sel, fld, stat, search, who, tok, kv, muted, more, callout, keyc, dm, tabs, pane } = U;
  const I = (n, s) => LQ.icon(n, s);
  const AV = LQ.av;
  const eur = (n) => "€" + Math.round(n).toLocaleString("en-US");
  const tile = (t, tone) => '<span class="pv ' + (tone || "") + '">' + t + "</span>";
  const CC = { DRAFT: "", INTERNAL_REVIEW: "yellow", CUSTOMER_REVIEW: "yellow", APPROVAL_REQUIRED: "yellow", READY_FOR_SIGNATURE: "blue", PARTIALLY_SIGNED: "blue", FULLY_SIGNED: "green", ACTIVE: "green", EXPIRING: "yellow", RENEWED: "green", SUPERSEDED: "", TERMINATED: "red", EXPIRED: "", CANCELLED: "", ARCHIVED: "" };
  /* @impl cStatus(): ContractStatus -> Badge, one map everywhere. Lifecycle state only (NOT the document state). */
  const cStatus = (v) => ES(v, CC[v] || "");
  const risk = (v) => '<span class="badge ' + { LOW: "green", MEDIUM: "yellow", HIGH: "red", CRITICAL: "red" }[v] + '" title="ContractRiskLevel ' + v + '">' + U.en(v) + " risk</span>";

  /* =====================================================================================================================
     DASHBOARD (spec §65)
     @route  /contracts (default) · /contracts/dashboard
     @perm   VIEW contracts.contracts.read · value widgets need contracts.confidential_terms.read when values are marked confidential
     @api    GET /contracts/dashboard (aggregate: counts per status, expiring windows, recent signed/amendments, value by type/customer)
     @mcp    contracts_contracts_read (summary)
     @data   Contract (status, type_id, primary_company_id, total_value, expiration_date, renewal_date, notice_deadline, signature_date, relation_kind) · SignatureRequest (status) · ContractType (reminder_windows_days)
     @ui     Card, Progress, Table, Badge; each widget loads independently
     @states loading per widget · empty · error per widget · no-access per widget
     @note   "Expiring soon" uses the windows configured on the type (ContractType.reminder_windows_days, default 180/120/90/60/30/14/7), not a hard-coded number. "Awaiting signature" = READY_FOR_SIGNATURE and
             PARTIALLY_SIGNED. Counts are scoped to the caller's branch/team visibility.
     ===================================================================================================================== */
  function dashboard() {
    return '<div class="a-page">' + head("Contracts", "What needs attention across your agreements (§65).", btn("New contract", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Active", 38, "contracts") + stat("Drafts", 6, "in progress") + stat("Awaiting approval", 2, "APPROVAL_REQUIRED") + stat("Awaiting signature", 3, "2 partially signed") + stat("Expiring soon", 5, "within 90 days", 1) + stat("Renewals due", 3, "notice deadlines") + "</div>" +
      '<div class="g2">' +
      /* @impl Expiring list: contracts whose expiration_date or notice_deadline falls in the next window, soonest first, with the days left and the renewal type. Link to the renewal workflow. */
      cd("<b>Expiring soon</b><span class='r muted'>notice deadline first</span>", [["Northwind support agreement", "Northwind", "notice in 12 days", "AUTOMATIC"], ["Initech maintenance", "Initech", "expires in 34 days", "MANUAL"], ["Globex NDA", "Globex", "expires in 61 days", "NONE"]].map((r) => '<div class="rowx"><div class="grow"><b>' + r[0] + "</b><small>" + r[1] + " · " + r[2] + "</small></div>" + E(r[3]) + btn("Renew", "", "sm") + "</div>").join(""), 1) +
      cd("<b>Awaiting signature</b><span class='r muted'>SignatureRequest</span>", '<div class="rowx"><div class="grow"><b>Wayne Enterprises MSA</b><small>2 of 3 signers · sent 3 days ago</small></div>' + S("PARTIALLY_SIGNED").replace("badge ", "badge blue ") + '</div><div class="rowx"><div class="grow"><b>Hooli SOW 1</b><small>0 of 2 signers · sent yesterday</small></div>' + S("SENT").replace("badge ", "badge blue ") + '</div><div class="rowx"><div class="grow"><b>Wonka licensing agreement</b><small>1 of 2 signers · expires in 6 days</small></div>' + S("PARTIALLY_SIGNED").replace("badge ", "badge blue ") + "</div>", 1) +
      cd("<b>Contracts by type</b><span class='r muted'>active</span>", [["MSA", 14], ["SOW", 11], ["Maintenance", 7], ["NDA", 4], ["Other", 2]].map((r) => '<div class="bar-row"><span class="l">' + r[0] + '</span><span class="tr"><i class="fc-best" style="width:' + r[1] * 6 + '%"></i></span><span class="v">' + r[1] + "</span></div>").join("")) +
      cd("<b>Recently signed & amended</b>", '<div class="tl"><div class="ev"><b>Acme MSA v3 fully signed</b><small>Oct 30</small></div><div class="ev"><b>Amendment A1 created for Acme MSA</b><small>Nov 4</small></div><div class="ev"><b>Initech SOW 2 activated</b><small>Nov 6</small></div></div>') + "</div>" +
      dm(["Contract · status, type_id, primary_company_id, total_value, expiration_date, renewal_date, notice_deadline, signature_date, relation_kind", "SignatureRequest · status · ContractType · reminder_windows_days"], []) + "</div>";
  }

  /* =====================================================================================================================
     CONTRACT LIST (spec §3, §5, §64)
     @route  /contracts/all?view=&status=&type=&company=&owner=&expires=&q=
     @perm   VIEW contracts.contracts.read · create contracts.contracts.create · export contracts.contracts.export* · archive contracts.contracts.archive
     @api    GET /contracts?view=&status=&type_id=&company_id=&q=&cursor= · POST /contracts {type_id, template_id?, proposal_version_id?, company_id}
     @mcp    contracts_contracts_read, contracts_contracts_create
     @data   Contract (number, title, type_id, status, relation_kind, primary_company_id, owner_membership_id, effective_date, expiration_date, notice_deadline, total_value, risk_level, renewal_type) · ContractType ·
             CrmCompany (02) · saved views via SavedView
     @ui     Table (server-side), ToggleGroup/saved-view tabs, Badge, Popover+Command filters, DropdownMenu
     @states loading · empty · error · no-access
     @note   Views in the panel (Drafts, In review, Awaiting signature, Active, Expiring, Amendments, Terminated, Archived) are saved filters over ContractStatus and relation_kind. Search covers number, title, customer, signatory,
             proposal, project, tags and custom fields (§64). Number from NumberSequence (entity_type "contract", e.g. CTR-2026-0001). Value column is FIELD-LEVEL restricted when marked confidential.
     ===================================================================================================================== */
  function list() {
    /* number, title, customer, type, ContractStatus, relation, effective, expires, value, risk, owner */
    const R = [
      ["CTR-2026-0014", "Acme Master Service Agreement", "Acme Corp", "MSA", "ACTIVE", "STANDALONE", "Oct 30, 2026", "Oct 2027", 186400, "MEDIUM", ["PR", ""]],
      ["CTR-2026-0014-A1", "Amendment 1: rates", "Acme Corp", "Amendment", "INTERNAL_REVIEW", "AMENDMENT", "—", "Oct 2027", 0, "LOW", ["AM", ""]],
      ["CTR-2026-0019", "Wayne Enterprises MSA", "Wayne Enterprises", "MSA", "PARTIALLY_SIGNED", "STANDALONE", "—", "—", 240000, "HIGH", ["PR", ""]],
      ["CTR-2026-0020", "Hooli SOW 1", "Hooli", "SOW", "READY_FOR_SIGNATURE", "SOW", "—", "—", 52000, "LOW", ["NG", "g"]],
      ["CTR-2026-0021", "Globex Master Agreement", "Globex", "MSA", "DRAFT", "STANDALONE", "—", "—", 88000, "MEDIUM", ["AM", ""]],
      ["CTR-2025-0087", "Northwind support agreement", "Northwind Traders", "Support", "EXPIRING", "STANDALONE", "Jan 2026", "Dec 2026", 14400, "LOW", ["NG", "g"]],
      ["CTR-2025-0061", "Initech maintenance", "Initech", "Maintenance", "ACTIVE", "RENEWAL", "Dec 2025", "Dec 2026", 21600, "LOW", ["MS", "g"]],
      ["CTR-2024-0033", "Umbrella NDA", "Umbrella Ltd", "NDA", "EXPIRED", "STANDALONE", "Mar 2024", "Mar 2026", 0, "LOW", ["SJ", "y"]],
    ];
    return '<div class="a-page">' + head("All contracts", "One record per agreement, separate from its document versions (§3). Lifecycle status shown; document, project and finance states are on the contract.", btn("Import", "box") + btn("New contract", "plus", "primary")) +
      '<div class="toolbar">' + search("Search number, title, customer, signatory…") + '<div class="seg"><button class="on">All</button><button>Active</button><button>Awaiting signature</button><button>Expiring</button><button>Amendments</button></div><button class="btn">Type</button><button class="btn">Customer</button><button class="btn">Owner</button><button class="btn">Expires</button></div>' +
      '<div class="panel" style="margin-top:0"><div class="tbl-scroll"><table><thead><tr><th>Contract</th><th>Customer</th><th>Type</th><th>Status</th><th>Effective</th><th>Expires</th><th class="num">Value</th><th>Risk</th><th>Owner</th><th></th></tr></thead><tbody>' +
      R.map((r) => '<tr class="clk" onclick="location.hash=\'#contracts/detail\'"><td><div class="name"><b class="ink mono" style="font-weight:500">' + r[0] + "</b></div><div class='sub-note'>" + r[1] + "</div></td><td>" + r[2] + "</td><td>" + (r[5] === "STANDALONE" ? r[3] : r[3] + ' <span class="badge">' + U.en(r[5]) + "</span>") + "</td><td>" + cStatus(r[4]) + '</td><td class="muted">' + r[6] + '</td><td class="' + (r[4] === "EXPIRING" ? "ink" : "muted") + '">' + r[7] + '</td><td class="num money">' + (r[8] ? eur(r[8]) : "—") + "</td><td>" + risk(r[9]) + "</td><td>" + AV(r[10][0], r[10][1]) + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div></div>" +
      dm(["Contract · number, title, type_id, status, relation_kind, primary_company_id, owner_membership_id, effective_date, expiration_date, notice_deadline, total_value, risk_level, renewal_type", "ContractType · name · CrmCompany"], []) + "</div>";
  }

  /* =====================================================================================================================
     CONTRACT DETAIL (spec §3-§5, §23-§29, §32-§42, §43-§50, §66, §86)
     @route  /contracts/:contractId?tab=overview|versions|review|signature|obligations|lineage|timeline
     @perm   VIEW contracts.contracts.read · edit draft contracts.contracts.update · new version contracts.versions.create · request review contracts.contracts.review · approve contracts.contracts.approve* ·
             send/cancel signature contracts.signatures.send* / cancel* · amend contracts.contracts.amend · renew contracts.contracts.renew · terminate contracts.contracts.terminate* · obligations contracts.obligations.manage ·
             internal comments contracts.comments.internal.read · confidential fields contracts.confidential_terms.read
     @api    GET /contracts/:id (record + parties + relations + 4-state summary) · GET /contracts/:id/versions · POST /contracts/:id/versions · GET/POST /contracts/:id/reviews · POST /contract-versions/:vid/approvals/:id/decision ·
             POST /contract-versions/:vid/signature-requests {provider, signing_order, signers[], package_documents[]} · POST /signature-requests/:id/cancel|remind · GET/POST /contracts/:id/obligations ·
             POST /contracts/:id/amendments|renewals|terminate · GET /contracts/:id/timeline
     @mcp    contracts_contracts_read, contracts_contracts_update, contracts_versions_create, contracts_obligations_manage; send/cancel/approve/terminate are sensitive: human confirmation for AI callers
     @data   Contract (all) · ContractParty (party_type, legal_name, company_id) · ContractSignatory (name, email, is_required) · ContractVersion (version_number, label, status, change_summary, content_hash, signed_hash, locked_at,
             approved_at, signed_at, document_id, signed_document_id) · ContractReview · ContractApproval (step, step_name, approver, decision, rule_id) · ContractComment (is_internal, is_blocking) · ContractChangeRequest ·
             SignatureRequest/Signer/SignatureEvent (in-house e-signature) · ContractObligation · ContractTermination · lineage via parent_contract_id, relation_kind, superseded_by_contract_id · ContractProject (project links)
     @ui     Tabs, Card, Table, Stepper (approval chain), Timeline, Sheet (version compare), Dialog (send for signature, terminate), AlertDialog (cancel signature), Badge, Progress
     @states loading · not found · error · no-access · locked-version banner · confidential field "Restricted"
     @audit  contract created / edited / version created / review requested / comment added / approved / signature requested / signature completed / amendment created / renewal created / status changed / terminated
     @note   THE FOUR STATES at the top are computed from their owners and are NOT editable here: Document (this module: ContractVersion.status of the current version), Contract (ContractStatus), Project (05: status of linked
             projects), Finance (08: billing/invoice state). A signed version is immutable: "Amend" creates a new ContractVersion/contract of relation_kind AMENDMENT linked by parent_contract_id; "Renew" creates a RENEWAL; a new
             agreement that replaces it sets superseded_by_contract_id. Customer change requests (ContractChangeRequest) never edit the contract directly: they produce a new version after review.
             E-SIGNATURE IS BUILT IN-HOUSE (04 §33): no third-party provider. Each signer gets a single-use link, verifies identity with a one-time code (email or SMS), accepts the consent text (version recorded) and signs (DRAWN | TYPED | UPLOADED).
             The platform stores every action as a SignatureEvent (IP, user agent), hashes the final artifact and generates the audit certificate (Documents 17). There is nothing to configure per organization.
     ===================================================================================================================== */
  function detail() {
    const V = [["v3", "SIGNED", "Final, signed Oct 30", "Oct 30", "a1f3…9c2e"], ["v2", "SUPERSEDED", "Customer review changes", "Oct 22", "7be0…41aa"], ["v1", "SUPERSEDED", "Generated from MSA template v6", "Oct 14", "03dd…e871"]];
    return '<div class="a-page">' +
      /* @impl Header: contract number + title, lifecycle badge, type, parties, owner, risk (explainable, not legal advice). Actions: New version, Request review, Amend, Renew, Terminate (each gated). */
      '<div class="cd" style="margin-bottom:14px"><div class="hdr-card">' + tile("CT", "blue") + '<div class="nm"><h2><span class="mono">CTR-2026-0014</span> Acme Master Service Agreement ' + cStatus("ACTIVE") + risk("MEDIUM") + '</h2><div class="muted">MSA · Logiqdev Ltd and Acme Corp · owner Petros R. · effective Oct 30, 2026 · renews automatically Oct 2027</div></div>' + btn("Amend", "edit") + btn("Renew", "reply") + btn("Terminate", "x") + "</div>" +
      /* @impl FOUR STATES (spec §86): read-only chips from four owners. Never collapse them into one status. */
      '<div style="padding:0 20px 18px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px"><div class="stat" style="padding:10px 12px"><small>Document (04)</small><div style="margin-top:4px"><span class="badge green">Signed</span> <span class="sub-note">v3</span></div></div><div class="stat" style="padding:10px 12px"><small>Contract (04)</small><div style="margin-top:4px">' + cStatus("ACTIVE") + '</div></div><div class="stat" style="padding:10px 12px"><small>Project (05)</small><div style="margin-top:4px"><span class="badge blue">In progress</span></div></div><div class="stat" style="padding:10px 12px"><small>Finance (08)</small><div style="margin-top:4px"><span class="badge green">Billing</span></div></div></div></div>' +
      '<div class="tabset">' + tabs([["o", "Overview"], ["v", "Versions", 3], ["r", "Review & approval"], ["s", "Signature"], ["b", "Obligations", 4], ["l", "Lineage"], ["t", "Timeline"]], "o") +
      pane("o", 1, '<div class="crm-split"><div class="stack">' +
        /* @impl Dates card: the ten independent dates of §51 (draft, approval, signature, effective, start, end, renewal, notice deadline, expiration, termination). Each is addressable by automation; notice_deadline is derived
             from end/expiration minus notice_days. */
        cd("<b>Dates & renewal</b>", kv("Signed", "Oct 30, 2026") + kv("Effective · start", "Oct 30, 2026") + kv("End · expiration", "Oct 29, 2027") + kv("Renewal", E("AUTOMATIC") + " · 12 months") + kv("Notice deadline", "Aug 30, 2027 <span class='badge'>60 days before</span>") + kv("Reminders", "180 · 90 · 60 · 30 · 14 · 7 days")) +
        /* @impl Value card: total_value, one_time_value, recurring_value, billing_frequency, payment_terms, billing_model. FIELD-LEVEL: hidden without contracts.confidential_terms.read. Billing and invoices are owned by Finance (08). */
        cd("<b>Commercial</b><span class='r muted'>confidential terms</span>", kv("Total value", eur(186400)) + kv("One-time", eur(114400)) + kv("Recurring", eur(72000) + " / year") + kv("Payment terms", "Net 30") + kv("Billing model", E("TIME_AND_MATERIALS")) + kv("Processes personal data", "Yes · DPA attached")) +
        "</div><div class=\"stack\">" +
        cd("<b>Parties</b>", '<div class="rowx"><div class="grow"><b>Logiqdev Ltd</b><small>' + E("AGENCY", "purple").replace("badge ", "badge ") + ' · signatory Petros Rodinos, Director</small></div></div><div class="rowx"><div class="grow"><b>Acme Corporation S.A.</b><small>' + E("CUSTOMER", "blue") + ' · signatory Lena Kovac, Marketing Director · VAT EL998877665</small></div></div>', 1) +
        /* @impl Relations: proposal (03, exact proposal_version_id), projects (05 via ContractProject), parent/children (amendments, renewals, SOWs), documents (17). Read-only links to the owning modules. */
        cd("<b>Related</b>", '<div class="rowx">' + I("file", 15) + '<div class="grow"><b>Proposal PR-1987 v2</b><small>03 · accepted Feb 2025</small></div></div><div class="rowx">' + I("folder", 15) + '<div class="grow"><b>Acme Rebrand Website</b><small>05 · project · role: delivery</small></div></div><div class="rowx">' + I("layers", 15) + '<div class="grow"><b>Amendment A1</b><small>child contract · in review</small></div></div>', 1) + "</div></div>") +
      /* @impl VERSIONS: ContractVersion rows (version_number, label, status DRAFT | IN_REVIEW | APPROVED | LOCKED_FOR_SIGNATURE | SIGNED | SUPERSEDED, change_summary, content_hash, signed_hash). Compare opens a section-level diff (Sheet). Signed versions
           show the signed document (signed_document_id, Documents 17) and a hash-verified badge; they cannot be edited or deleted. */
      pane("v", 0, '<div class="panel" style="margin-top:0"><table><thead><tr><th>Version</th><th>Status</th><th>Summary</th><th>Date</th><th>Content hash</th><th></th></tr></thead><tbody>' + V.map((v) => '<tr><td class="mono ink">' + v[0] + "</td><td>" + E(v[1], v[1] === "SIGNED" ? "green" : "") + '</td><td class="muted">' + v[2] + "</td><td>" + v[3] + '</td><td class="key">' + v[4] + "</td><td>" + btn("Compare", "", "sm") + btn("PDF", "file", "sm") + "</td></tr>").join("") + "</tbody></table></div>") +
      /* @impl REVIEW & APPROVAL: reviews (ContractReview: internal or customer, decision, comment, due) and the approval chain (ContractApproval by step, e.g. Account owner > Finance > Legal > Executive, each BOUND to one version).
           Approval steps come from ContractApprovalRule matching value, type, liability, risk... Comments (ContractComment) are internal or customer-visible; is_blocking comments must be resolved before signature. */
      pane("r", 0, '<div class="g2">' + cd("<b>Approval chain · v3</b><span class='r muted'>ContractApproval · rule “High value”</span>", ["Account owner · Anna Meyer", "Finance · Elena Papadaki", "Legal · external counsel", "Executive · Petros Rodinos"].map((x) => '<div class="rowx"><div class="grow"><b>' + x + "</b></div>" + E("APPROVED", "green") + "</div>").join(""), 1) +
        cd("<b>Reviews & comments</b>", '<div class="rowx"><div class="grow"><b>Internal legal review</b><small>external counsel · v2 · changes requested, resolved in v3</small></div>' + E("APPROVED", "green") + '</div><div class="rowx"><div class="grow"><b>Customer review</b><small>Lena Kovac · v2 · changes requested: payment terms</small></div>' + E("CHANGES_REQUESTED", "yellow") + '</div><div class="rowx"><div class="grow"><b>' + I("lock", 12) + " Internal: liability cap negotiated to 1× annual fees</b><small>Petros R. · internal · not visible to the customer</small></div></div>", 1) + "</div>") +
      /* @impl SIGNATURE: SignatureRequest (subject CONTRACT_VERSION, status, signing_order SEQUENTIAL | PARALLEL, package_documents locked at send, reminder_settings), its Signer rows (order, status PENDING | SENT | DELIVERED |
           VIEWED | SIGNED | DECLINED | BOUNCED, signed_at, auth_method, identity_verified_at, consent_text_version, signature_type) and SignatureEvent audit rows (each action is recorded once: duplicate submissions are ignored). The signed document and audit certificate are Documents (17). */
      pane("s", 0, cd("<b>Signature request</b><span class='r'>" + S("FULLY_SIGNED").replace("badge ", "badge green ") + "</span>", '<div class="kvr"><span>Package</span><b>MSA v3 + DPA v1 (locked)</b></div><div class="kvr"><span>Signing order</span><b>' + E("SEQUENTIAL") + '</b></div><div class="kvr"><span>Signed document hash</span><b class="key">c04e…77b1</b></div><div class="kvr"><span>Audit certificate</span><b><a style="text-decoration:underline">Download PDF</a></b></div><div style="height:8px"></div><table><thead><tr><th>Signer</th><th>Order</th><th>Status</th><th>Identity verified</th><th>Consent</th><th>Signature</th><th>Signed</th></tr></thead><tbody><tr><td class="ink">Lena Kovac · Acme</td><td>1</td><td>' + E("SIGNED", "green") + '</td><td class="muted">email code · Oct 29 13:58</td><td class="muted">terms v2</td><td>' + E("DRAWN") + '</td><td class="muted">Oct 29, 14:02</td></tr><tr><td class="ink">Petros Rodinos · Logiqdev</td><td>2</td><td>' + E("SIGNED", "green") + '</td><td class="muted">email code · Oct 30 09:11</td><td class="muted">terms v2</td><td>' + E("TYPED") + '</td><td class="muted">Oct 30, 09:15</td></tr></tbody></table>', 1) + '<div style="height:12px"></div>' + cd("<b>Signing events</b><span class='r muted'>SignatureEvent · IP and device kept</span>", '<div class="tl"><div class="ev"><b class="key">COMPLETED</b><small>Oct 30, 09:15 · audit certificate generated</small></div><div class="ev"><b class="key">SIGNED</b><small>Petros Rodinos · 85.74.x.x · Chrome</small></div><div class="ev"><b class="key">SIGNED</b><small>Lena Kovac · 94.66.x.x · Safari</small></div><div class="ev"><b class="key">VIEWED</b><small>Lena Kovac · after the one-time code</small></div><div class="ev"><b class="key">SENT</b><small>Oct 28 · signing links emailed</small></div></div>')) +
      /* @impl OBLIGATIONS: ContractObligation rows (type ContractObligationType, status ContractObligationStatus, due_date, frequency, responsible party/member, source section, project_id/task_id links). Execution is a Task (06), not a copy.
           AI-extracted obligations (is_ai_extracted + extraction_confidence) stay PENDING_REVIEW until a human confirms (ExtractionReviewState); nothing operational is created from an unreviewed extraction. */
      pane("b", 0, '<div class="panel" style="margin-top:0"><table><thead><tr><th>Obligation</th><th>Type</th><th>Responsible</th><th>Due</th><th>Status</th><th>Source</th><th>Task</th></tr></thead><tbody>' + [["Deliver brand guidelines", "DELIVERABLE", "Logiqdev", "Nov 28", "IN_PROGRESS", "§4.2", "WEB-142"], ["Quarterly SLA report", "REPORTING", "Logiqdev", "Dec 31", "OPEN", "§7.1", "—"], ["Renewal notice", "RENEWAL_NOTICE", "Either party", "Aug 30, 2027", "OPEN", "§12.3", "—"], ["Pay milestone 2 invoice", "PAYMENT", "Acme", "Nov 24", "OPEN", "§5.4", "—"]].map((o) => "<tr><td class='ink'>" + o[0] + "</td><td>" + E(o[1]) + "</td><td>" + o[2] + "</td><td>" + o[3] + "</td><td>" + S(o[4]) + '</td><td class="muted">' + o[5] + '</td><td class="key">' + o[6] + "</td></tr>").join("") + "</tbody></table></div>") +
      /* @impl LINEAGE: tree from parent_contract_id and relation_kind (STANDALONE, AMENDMENT, RENEWAL, SOW, CHANGE_ORDER, TERMINATION_AGREEMENT) with relation_sequence; superseded_by_contract_id marks replacement. The MSA / SOW structure (§48) is this tree. */
      pane("l", 0, cd("<b>Master agreement structure</b>", '<div class="rowx"><div class="grow"><b class="mono">CTR-2026-0014</b> Acme MSA <small>root</small></div>' + cStatus("ACTIVE") + '</div><div class="rowx" style="padding-left:34px"><div class="grow"><b class="mono">CTR-2026-0014-A1</b> Amendment 1 <small>' + E("AMENDMENT") + '</small></div>' + cStatus("INTERNAL_REVIEW") + '</div><div class="rowx" style="padding-left:34px"><div class="grow"><b class="mono">CTR-2026-0017</b> SOW 1: Website <small>' + E("SOW") + '</small></div>' + cStatus("ACTIVE") + '</div><div class="rowx" style="padding-left:34px"><div class="grow"><b class="muted">Renewal 2027</b> <small>created automatically 60 days before notice</small></div><span class="badge">Planned</span></div>', 1)) +
      pane("t", 0, cd("<b>Lifecycle timeline</b><span class='r muted'>§66</span>", '<div class="tl"><div class="ev"><b>Amendment A1 created</b><small>Nov 4 · Anna Meyer</small></div><div class="ev"><b>Activated</b><small>Oct 30</small></div><div class="ev"><b>Fully signed</b><small>Oct 30 · v3</small></div><div class="ev"><b>Signature requested</b><small>Oct 28 · Petros R.</small></div><div class="ev"><b>Approved (4 steps)</b><small>Oct 27</small></div><div class="ev"><b>Version v3 created</b><small>Oct 24</small></div><div class="ev"><b>Generated from template MSA v6</b><small>Oct 14</small></div></div>')) + "</div>" +
      dm(["Contract · number, status, relation_kind, parent_contract_id, dates, renewal_type, renewal_term_months, notice_days, total_value, one_time_value, recurring_value, billing_model, risk_level, risk_factors, customer_visible, current_version_id, signed_version_id", "ContractParty · ContractSignatory · ContractProject · ContractVersion · ContractReview · ContractApproval · ContractComment · ContractChangeRequest", "SignatureRequest · Signer (signature_type, consent_text_version, consent_accepted_at, identity_verified_at, auth_method) · SignatureEvent · ContractObligation · ContractTermination", "ContractAiFinding · kind, severity, status (AI contract review)"], []) + "</div>";
  }

  /* =====================================================================================================================
     CONTRACT EDITOR (spec §13-§17, §72-§74, §79-§80)
     @route  /contracts/:contractId/versions/:versionId/edit
     @perm   edit DRAFT versions contracts.contracts.update · create version contracts.versions.create · insert clauses contracts.contracts.update · AI review contracts.contracts.review (+ AI connection)
     @api    GET /contract-versions/:id (+sections, variables, validation) · PUT /contract-versions/:id/sections · POST /contract-versions/:id/validate · POST /contract-versions/:id/ai/review (async) ·
             POST /contract-versions/:id/lock-for-signature
     @mcp    contracts_versions_create, contracts_contracts_update
     @data   ContractVersion (status, variables JSON, change_summary, template_version_id, content_hash) · ContractSection (key, title, body, clause_version_id, is_appendix, sort_order) · ContractClause/ContractClauseVersion (library) ·
             ContractTemplateVersion (sections, variables, conditional_rules, required_fields) · ContractComment
     @ui     Tiptap section editor, outline (dnd-kit), Command (clause library search), Sheet (compare with previous version), Alert (validation), Popover (AI)
     @states loading · conflict 409 · locked (LOCKED_FOR_SIGNATURE/SIGNED = read-only) · validating · error · no-access
     @audit  version created / edited / locked for signature
     @note   Sections can be FREE TEXT or a pinned CLAUSE VERSION (clause_version_id): clause text is inserted by reference, so updating the library never changes existing contracts. Conditional clauses and required variables come
             from the template version; "Validate" (§16) checks missing variables/required fields and conflicting dates and blocks lock-for-signature. AI REVIEW findings (§73) point to a section and are labelled "AI recommendation";
             they never edit text. Locking for signature freezes the version and the package ordering (§78/§80).
     ===================================================================================================================== */
  function editor() {
    const SEC = [["parties", "Parties", 0], ["definitions", "Definitions", 0], ["services", "Services", 1], ["fees", "Fees and payment", 1], ["ip", "Intellectual property", 1], ["confidentiality", "Confidentiality", 1], ["liability", "Limitation of liability", 1], ["term", "Term and renewal", 1], ["termination", "Termination", 1], ["law", "Governing law", 1], ["appendix-a", "Appendix A: rates", 0]];
    return '<div class="a-page">' +
      '<div class="cd" style="margin-bottom:14px"><div class="hdr-card">' + tile("CT", "blue") + '<div class="nm"><h2><span class="mono">CTR-2026-0021</span> Globex Master Agreement ' + cStatus("DRAFT") + E("DRAFT", "yellow") + '</h2><div class="muted">editing v1 · generated from template “MSA” v6 · customer Globex · 2 blocking comments</div></div>' + btn("Compare", "layers") + btn("Validate", "check") + btn("Request review", "users", "primary") + "</div></div>" +
      '<div class="crm-split" style="grid-template-columns:230px minmax(0,1fr) 300px"><div class="cd"><div class="cd-h"><b>Sections</b></div><div class="cd-b flush">' +
      /* @impl Outline: ContractSection rows. A pin icon = the section is a CLAUSE reference (clause_version_id), plain = free text. Appendices have is_appendix. */
      SEC.map((s, i) => '<div class="rowx" style="padding:8px 12px;' + (i === 6 ? "background:var(--elevated)" : "") + '"><span class="muted">' + I(s[2] ? "pin" : "edit", 13) + '</span><div class="grow"><b style="font-size:13px">' + s[1] + "</b></div></div>").join("") + "</div></div>" +
      '<div class="cd"><div class="cd-h"><b>Limitation of liability</b><span class="badge">Clause · LIAB-STD v3</span><span class="r">' + btn("Replace clause", "", "sm") + '</span></div><div class="cd-b"><div class="ink" style="line-height:1.7">Each party’s total liability under this Agreement shall not exceed the fees paid or payable in the twelve (12) months preceding the claim. Nothing limits liability for fraud, death or personal injury caused by negligence, or any liability that cannot be limited by law.</div><div class="sub-note" style="margin-top:10px">Pinned to clause version LIAB-STD v3. Updating the library does not change this contract.</div></div></div>' +
      '<div class="stack">' +
      /* @impl Validation panel (§16): missing variables, conflicting dates, required template fields. Lock-for-signature stays disabled until it is clean. */
      cd("<b>Validation</b><span class='r'><span class='badge yellow'>2 issues</span></span>", '<div class="rowx"><div class="grow"><b>Missing: customer VAT number</b><small>Parties</small></div></div><div class="rowx"><div class="grow"><b>Start date is after the end date</b><small>Term and renewal</small></div></div>', 1) +
      /* @impl AI review findings (§73): each has a section pointer, the kind (missing clause, conflicting dates, unusual payment terms, liability difference, termination difference, scope inconsistency, renewal, non-standard clause) and the label
           "AI recommendation". Dismiss/accept is recorded; findings are stored as ContractAiFinding rows (status OPEN | ACCEPTED | DISMISSED, reviewed_by_membership_id, resolution_note). */
      cd("<b>AI review</b><span class='r muted'>ContractAiFinding · AI recommendations</span>", '<div class="rowx" style="align-items:flex-start"><span class="muted">' + I("sparkles", 14) + '</span><div class="grow"><b>Liability cap is higher than your standard</b><small>Limitation of liability · ' + E("LIABILITY_DIFFERENCE") + " · " + E("HIGH", "red") + "</small></div>" + E("OPEN", "blue") + btn("Accept", "", "sm") + btn("Dismiss", "", "sm") + '</div><div class="rowx" style="align-items:flex-start"><span class="muted">' + I("sparkles", 14) + '</span><div class="grow"><b>Non-standard payment term: Net 60</b><small>Fees and payment · ' + E("UNUSUAL_PAYMENT_TERMS") + " · " + E("MEDIUM", "yellow") + "</small></div>" + E("DISMISSED") + "</div>", 1) +
      cd("<b>Risk</b><span class='r'>" + risk("MEDIUM") + "</span>", '<div class="sub-note">Explainable score from type, liability, payment terms, duration and non-standard clauses. Not legal advice.</div>') + "</div></div>" +
      dm(["ContractVersion · status, variables, change_summary, template_version_id, content_hash", "ContractSection · key, title, body, clause_version_id, is_appendix, sort_order", "ContractClause · ContractClauseVersion · ContractTemplateVersion · ContractComment", "ContractAiFinding · version_id, section_id, kind, severity, message, recommendation, status, model, reviewed_by_membership_id, resolution_note"], []) + "</div>";
  }

  /* =====================================================================================================================
     OBLIGATIONS (spec §49-§50, §75)
     @route  /contracts/obligations?status=&type=&contract=&due=
     @perm   VIEW contracts.contracts.read · manage contracts.obligations.manage
     @api    GET /contract-obligations?... · PATCH /contract-obligations/:id (status, due, task link) · POST /contract-obligations/:id/confirm|reject (AI extraction review) · POST /contract-obligations/:id/task
     @mcp    contracts_obligations_manage
     @data   ContractObligation (type, status, title, due_date, frequency, responsible_party_id, responsible_membership_id, contract_id, section_id, project_id, task_id, is_ai_extracted, extraction_confidence, review_state, reminder_days_before)
     @ui     Table, Badge, ToggleGroup, Dialog (review extraction), DropdownMenu (create task)
     @states loading · empty · error · no-access
     @note   OVERDUE is computed from due_date and status. "Create task" creates a Task in 06 and stores task_id: execution happens there. AI-extracted rows are shown separately (review_state PENDING_REVIEW) with confidence and
             the source section, and DO NOTHING (no reminders, no tasks) until confirmed, unless the organization configured auto-confirm.
     ===================================================================================================================== */
  function obligations() {
    const R = [["Pay milestone 2 invoice", "PAYMENT", "Acme MSA", "Acme", "Nov 24", "OPEN", "—", ""], ["Deliver brand guidelines", "DELIVERABLE", "Acme MSA", "Logiqdev", "Nov 28", "IN_PROGRESS", "WEB-142", ""], ["Security review report", "SECURITY_REVIEW", "Wayne MSA", "Logiqdev", "Nov 12", "OVERDUE", "—", ""], ["Quarterly SLA report", "REPORTING", "Acme MSA", "Logiqdev", "Dec 31", "OPEN", "—", ""], ["Data processing audit right notice", "OTHER", "Globex MSA (draft)", "Globex", "—", "OPEN", "—", "PENDING_REVIEW · 82%"]];
    return '<div class="a-page">' + head("Obligations", "What each party must do under your contracts. Execution lives in Tasks (06).", btn("New obligation", "plus", "primary")) +
      '<div class="toolbar">' + search("Search obligations…") + '<div class="seg"><button class="on">All open 5</button><button>Overdue</button><button>Mine</button><button>AI to review 1</button></div><button class="btn">Contract</button><button class="btn">Type</button></div>' +
      '<div class="panel" style="margin-top:0"><table><thead><tr><th>Obligation</th><th>Type</th><th>Contract</th><th>Responsible</th><th>Due</th><th>Status</th><th>Task</th><th></th></tr></thead><tbody>' + R.map((r) => "<tr><td><b class='ink' style='font-weight:500'>" + r[0] + "</b>" + (r[7] ? '<div class="sub-note">' + I("sparkles", 11) + " AI extracted · " + r[7] + "</div>" : "") + "</td><td>" + E(r[1]) + "</td><td>" + r[2] + "</td><td>" + r[3] + "</td><td>" + r[4] + "</td><td>" + (r[5] === "OVERDUE" ? E("OVERDUE", "red") : S(r[5])) + '</td><td class="key">' + r[6] + "</td><td>" + (r[7] ? btn("Review", "", "sm") : btn("Create task", "", "sm")) + "</td></tr>").join("") + "</tbody></table></div>" +
      dm(["ContractObligation · type, status, title, due_date, frequency, responsible_party_id, responsible_membership_id, contract_id, section_id, task_id, project_id, is_ai_extracted, extraction_confidence, review_state"], []) + "</div>";
  }

  /* =====================================================================================================================
     RENEWALS (spec §46, §52)
     @route  /contracts/renewals?window=30|60|90|180&type=
     @perm   VIEW contracts.contracts.read · renew contracts.contracts.renew
     @api    GET /contracts/renewals?within_days= · POST /contracts/:id/renewals {mode: manual|automatic|modified|with_proposal|with_project}
     @mcp    contracts_contracts_renew
     @data   Contract (renewal_type, renewal_term_months, notice_days, renewal_date, notice_deadline, end_date, expiration_date, status) · ContractType (reminder_windows_days)
     @ui     Table, ToggleGroup (window), Badge (urgency), Dialog (renewal options)
     @states loading · empty · error · no-access
     @audit  renewal created
     @note   Renewals preserve lineage (Original -> Renewal -> Renewal version, relation_kind RENEWAL). Reminder windows are organization-configurable per contract type (180/120/90/60/30/14/7 by default) and fire
             notifications (14) through automation (20). AUTOMATIC renewals still create a record and notify before the notice deadline.
     ===================================================================================================================== */
  function renewals() {
    const R = [["Northwind support agreement", "Northwind", "AUTOMATIC", "Dec 12", "12 days", "Dec 2026"], ["Initech maintenance", "Initech", "MANUAL", "Dec 30", "34 days", "Dec 2026"], ["Globex NDA", "Globex", "NONE", "—", "61 days", "Jan 2027"], ["Acme MSA", "Acme Corp", "AUTOMATIC", "Aug 30, 2027", "293 days", "Oct 2027"]];
    return '<div class="a-page">' + head("Renewals", "Notice deadlines and expirations, soonest first (§52).", '<div class="seg"><button>30 days</button><button class="on">90 days</button><button>180 days</button></div>') +
      '<div class="panel" style="margin-top:0"><table><thead><tr><th>Contract</th><th>Customer</th><th>Renewal</th><th>Notice deadline</th><th>Time left</th><th>Ends</th><th></th></tr></thead><tbody>' + R.map((r) => "<tr><td class='ink'>" + r[0] + "</td><td>" + r[1] + "</td><td>" + E(r[2]) + "</td><td>" + r[3] + '</td><td><span class="badge ' + (parseInt(r[4]) < 30 ? "red" : parseInt(r[4]) < 90 ? "yellow" : "") + '">' + r[4] + "</span></td><td>" + r[5] + "</td><td>" + btn("Renew", "reply", "sm") + more + "</td></tr>").join("") + "</tbody></table></div>" +
      dm(["Contract · renewal_type, renewal_term_months, notice_days, notice_deadline, end_date, expiration_date, status", "ContractType · reminder_windows_days"], []) + "</div>";
  }

  /* =====================================================================================================================
     TEMPLATES & CLAUSES (spec §8-§12, §77; types and approval rules §2, §28)
     @route  /contracts/library?tab=templates|clauses|types|rules
     @perm   VIEW contracts.contracts.read · templates contracts.templates.manage* · clauses contracts.clauses.manage* · types contracts.types.manage · approval rules contracts.approval_rules.manage*
     @api    GET/POST /contract-templates (+ /versions, /publish) · GET/POST /contract-clauses (+ /versions) · GET/POST /contract-types · GET/PUT /contract-approval-rules
     @mcp    contracts_templates_manage*, contracts_clauses_manage*, contracts_types_manage, contracts_approval_rules_manage*
     @data   ContractTemplate (status DRAFT | PUBLISHED | DEPRECATED, current_version_id, owner_membership_id, effective_date) · ContractTemplateVersion (sections, variables, conditional_rules, signature_blocks, required_fields, published_at) ·
             ContractClause (key, name, category, status, usage_restrictions) · ContractClauseVersion (text, effective_date, deprecated_at) · ContractType (default_template_id, required_metadata, approval_workflow, signature_requirements,
             default_renewal_type, default_notice_days, reminder_windows_days, retention_days) · ContractApprovalRule (conditions JSON, steps JSON, priority, enabled)
     @ui     Tabs, Table, Dialog+Form, sortable lists, JSON-backed rule builder (conditions: value, type, liability, discount, payment terms, duration, customer category, risk, custom fields)
     @states loading · empty · error · no-access
     @audit  template published / deprecated · clause version created · rule changed
     @note   GOVERNANCE (§77): templates and clauses have an owner, versions, approval state, effective and deprecated dates and a change history; ONLY authorized users publish. Publishing a template or clause creates a new immutable
             version; existing contracts keep the version they were generated from. A deprecated clause cannot be inserted into new contracts. Rules are evaluated in `priority` order and may add several approval steps.
     ===================================================================================================================== */
  function templates() {
    return '<div class="a-page">' + head("Templates & clauses", "Governed building blocks for contracts: templates, clause library, contract types and approval rules.", btn("New template", "plus", "primary")) +
      '<div class="tabset">' + tabs([["t", "Templates"], ["c", "Clause library"], ["y", "Types"], ["r", "Approval rules"]], "t") +
      pane("t", 1, '<div class="panel" style="margin-top:0"><table><thead><tr><th>Template</th><th>Type</th><th>Status</th><th>Version</th><th>Owner</th><th>Effective</th><th></th></tr></thead><tbody>' + [["Master Service Agreement", "MSA", "PUBLISHED", "v6", "Petros R.", "Sep 1"], ["Statement of Work", "SOW", "PUBLISHED", "v4", "Anna Meyer", "Jul 12"], ["NDA (mutual)", "NDA", "PUBLISHED", "v3", "Petros R.", "Jan 5"], ["Data Processing Agreement", "DPA", "DRAFT", "v2", "Elena Papadaki", "—"], ["Maintenance agreement (old)", "Maintenance", "DEPRECATED", "v5", "Petros R.", "Mar 2025"]].map((r) => "<tr><td class='ink'>" + r[0] + "</td><td>" + r[1] + "</td><td>" + S(r[2]) + '</td><td class="mono">' + r[3] + "</td><td>" + r[4] + '</td><td class="muted">' + r[5] + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div>") +
      pane("c", 0, '<div class="panel" style="margin-top:0"><table><thead><tr><th>Clause</th><th>Key</th><th>Category</th><th>Status</th><th>Version</th><th>Used in</th></tr></thead><tbody>' + [["Limitation of liability (standard)", "LIAB-STD", "Liability", "ACTIVE", "v3", 14], ["Confidentiality (mutual)", "CONF-MUT", "Confidentiality", "ACTIVE", "v2", 22], ["IP ownership on delivery", "IP-DELIV", "IP", "ACTIVE", "v4", 11], ["Auto-renewal", "RENEW-AUTO", "Term", "ACTIVE", "v1", 8], ["Legacy liability cap", "LIAB-OLD", "Liability", "DEPRECATED", "v2", 3]].map((r) => "<tr><td class='ink'>" + r[0] + '</td><td class="key">' + r[1] + "</td><td>" + r[2] + "</td><td>" + S(r[3]) + '</td><td class="mono">' + r[4] + '</td><td class="num">' + r[5] + "</td></tr>").join("") + "</tbody></table></div>") +
      pane("y", 0, '<div class="panel" style="margin-top:0"><table><thead><tr><th>Type</th><th>Default template</th><th>Renewal</th><th class="num">Notice</th><th>Reminder windows</th><th class="num">Retention</th></tr></thead><tbody>' + [["MSA", "Master Service Agreement", "MANUAL", 60, "180 · 90 · 60 · 30", 7], ["SOW", "Statement of Work", "NONE", 30, "30 · 14", 7], ["NDA", "NDA (mutual)", "NONE", 0, "60 · 30", 10], ["Maintenance", "—", "AUTOMATIC", 60, "90 · 60 · 30", 7]].map((r) => "<tr><td class='ink'>" + r[0] + "</td><td>" + r[1] + "</td><td>" + E(r[2]) + '</td><td class="num">' + r[3] + " days</td><td>" + r[4] + ' days</td><td class="num">' + r[5] + " years</td></tr>").join("") + "</tbody></table></div>") +
      pane("r", 0, cd("<b>Approval rules</b><span class='r'>" + btn("New rule", "plus", "sm") + "</span>", '<div class="rowx"><div class="grow"><b>High value</b><small>total_value ≥ €100,000 → Finance → Executive · priority 1</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Non-standard liability</b><small>clause LIAB-STD replaced → Legal · priority 2</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>High risk</b><small>risk_level ≥ HIGH → Executive · priority 3</small></div>' + sw(1) + "</div>", 1)) + "</div>" +
      dm(["ContractTemplate · status, current_version_id, owner_membership_id · ContractTemplateVersion · ContractClause · ContractClauseVersion · ContractType · ContractApprovalRule"], []) + "</div>";
  }

  const MAP = { dashboard, list, detail, editor, obligations, renewals, templates };
  const CRUMB = { detail: "CTR-2026-0014", editor: "Edit CTR-2026-0021" };
  window.VIEWS.contracts = { html: function (s) { return (MAP[s || "dashboard"] || MAP.dashboard)(s); }, crumb: function (s) { return CRUMB[s] || ""; }, fill: false };
})();
