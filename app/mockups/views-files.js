/* =====================================================================================================================
   FILES APP — module 17 Documents & File Management (docs/features/17-documents-file-management.md). Standalone rail app "Files".
   =====================================================================================================================
   SCHEMA-ALIGNED to api/prisma/schema.prisma: Document, DocumentVersion, Folder, FolderTemplate, DocumentCategory, DocumentAttachment, DocumentShare, DocumentApproval, DocumentApprover, DocumentRetentionPolicy,
   DocumentDeletionRequest, DocumentUploadJob, DocumentPreview, DocumentFavorite, DocumentRecentAccess, DocumentSettings, VaultEntry, VaultEntryGrant, VaultAccessLog, VaultKey. Reused: SignatureRequest/Signer (04),
   CrmNote (comments, entity_type DOCUMENT), SavedView (entity_type DOCUMENT), AuditEvent.
   Enums are real values: DocumentStatus (DRAFT, ACTIVE, APPROVED, ARCHIVED, DELETED), DocumentScope (ORGANIZATION, BRANCH, TEAM, PROJECT, CUSTOMER, EMPLOYEE, RECORD), DocumentSource (UPLOAD, URL_IMPORT, PORTAL_UPLOAD,
   EMAIL_CAPTURE, GENERATED, OCR_INTAKE, EXTERNAL_LINK, API), DocumentVersionStatus (PENDING, SCANNING, AVAILABLE, QUARANTINED, FAILED), DocumentScanStatus (PENDING, SCANNING, CLEAN, INFECTED, FAILED, SKIPPED),
   DocumentType (LOGO, BANNER, IMAGE, VIDEO, AUDIO, PDF, DOCUMENT, OTHER, SPREADSHEET, PRESENTATION, TEXT, CODE, ARCHIVE, LINK), DocumentShareSubjectType (MEMBERSHIP, TEAM, PORTAL_USER, EXTERNAL_EMAIL, PUBLIC_LINK),
   DocumentSharePermission (VIEW, COMMENT, EDIT, MANAGE), DocumentShareStatus (ACTIVE, EXPIRED, REVOKED), DocumentApprovalStatus (PENDING, APPROVED, REJECTED, CHANGES_REQUESTED, CANCELLED), DocumentApprovalDecision,
   DocumentApproverKind (MEMBERSHIP, PORTAL_USER), FolderTemplateTarget (PROJECT_TYPE, CUSTOMER, EMPLOYEE, ORGANIZATION), DocumentRetentionAnchor (CREATED, LAST_MODIFIED, ARCHIVED, RECORD_CLOSED),
   DocumentRetentionAction (ARCHIVE, SOFT_DELETE, PERMANENT_DELETE), DocumentDeletionKind (SOFT, PERMANENT, RETENTION), DocumentDeletionStatus (REQUESTED, APPROVED, EXECUTED, REJECTED, CANCELLED),
   VaultEntryType (PASSWORD, API_KEY, SSH_KEY, NOTE, FILE), VaultScope (ORGANIZATION, CUSTOMER, PROJECT), VaultGrantSubjectType, VaultAccessAction (VIEW, REVEAL, COPY, CREATE, UPDATE, ROTATE, DELETE, GRANT, REVOKE),
   VaultKeyStatus (ACTIVE, ROTATING, RETIRED), DocumentStorageProvider (PLATFORM, S3_COMPATIBLE, GOOGLE_DRIVE, MICROSOFT_365), SignatureRequestStatus, SignerStatus.
   Permission keys: documents.documents.* (read, create, update, delete*, archive, export*, share, approve), documents.folders.manage, documents.categories.manage, documents.retention.manage*, documents.deletions.approve*,
   documents.storage.manage*, documents.vault.read*, documents.vault.reveal*, documents.vault.manage*; portal.documents.read / upload (customer portal); contracts.signatures.send / cancel (04, signature requests).
   Comment tags (legend in README.md): @screen @route @perm @api @mcp @data @ui @states @audit @note @gap. Every screen ends with a "Data model" footer (REVIEW-ONLY, do not ship).

   RULES THAT APPLY TO EVERY SCREEN HERE:
     - "Modules own the relationship to a document. This module owns the document." Other modules store only a plain document id (TaskAttachment, Invoice.pdf_document_id ...) or a DocumentAttachment row; never redefine storage.
     - A Document is a logical record; the bytes live in immutable DocumentVersion rows. Document.current_version_id points at the live one. A re-upload creates a new version; a restore creates a NEW version with restored_from_version_id.
       Modules can LOCK a version (is_locked, locked_by_module, locked_reason): 04 locks the signed contract version. A locked version can never be replaced, deleted or purged.
     - Storage is the PLATFORM bucket only (DocumentStorageProvider PLATFORM). There is no provider configuration screen in this app (external providers of spec section 16 are out of scope for this mockup, the schema keeps the enum and DocumentStorageConnection).
     - Every file access goes through a short-lived signed URL (DocumentSettings.signed_url_ttl_seconds) after a permission check on every request. No public storage URLs, ever. A version is only served when DocumentVersion.status = AVAILABLE
       (scan_status CLEAN or SKIPPED); QUARANTINED / INFECTED files are never downloadable and never previewable.
     - Visibility = scope default (Document.scope + branch_id / team_id / project_id / company_id / employee_id) plus explicit DocumentShare rows. Sharing never crosses organizations except through the customer portal (07). Lists are filtered
       server-side by scope. EMPLOYEE scope and is_sensitive documents need the owning module's key (employees.documents.read) on top of documents.documents.read.
     - Sensitive categories (DocumentCategory.is_sensitive / Document.is_sensitive) write an audit event on every preview and download. Legal hold (Document.legal_hold) blocks every deletion path, including retention.
     - The credential VAULT is separate: own keys (documents.vault.*), secrets are write-only after save (secret_ciphertext is never returned; the UI sees only secret_hint), reveal and copy are explicit logged actions (VaultAccessLog + audit_events).
       Provider keys of the organization (OpenAI, Resend, Twilio, Stripe, Viva Wallet) are NOT vault entries: they are IntegrationConnection rows in Admin (01) sharing the same VaultKey.
     - Light and dark: semantic tokens only. Dev stage: no real data.
   ===================================================================================================================== */
(function () {
  const U = window.UI;
  const { E, ES, head, btn, cd, sw, cb, sel, stat, search, who, tok, kv, muted, more, callout, dm, tabs, pane } = U;
  const I = (n, s) => LQ.icon(n, s);
  const AV = LQ.av;
  const en = U.en;
  const th = (a) => "<thead><tr>" + a.map((x) => "<th" + (x[0] === ">" ? ' class="num"' : "") + ">" + x.replace(/^>/, "") + "</th>").join("") + "</tr></thead>";
  const tbl = (cols, rows) => '<div class="panel" style="margin-top:0"><table>' + th(cols) + "<tbody>" + rows.map((r) => "<tr>" + r.map((c, i) => "<td" + (cols[i][0] === ">" ? ' class="num"' : "") + ">" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  const ink = (t) => '<span class="ink">' + t + "</span>";
  const bar = (p, tone) => '<span class="bar"><i style="width:' + p + "%" + (tone ? ";background:var(--" + tone + ")" : "") + '"></i></span> ' + p + "%";
  const PEOPLE = { AM: ["Anna Meyer", ""], MS: ["Marco Silva", "g"], SJ: ["Sofia Jensen", "y"], JK: ["Jonas Koch", "r"], KL: ["Kim Lund", "p"] };
  const av = (a) => AV(a, PEOPLE[a][1]);
  const wh = (a) => who(a, PEOPLE[a][1], PEOPLE[a][0], "");
  const f = (l, h, hint) => '<div class="fld"><label>' + l + "</label>" + h + (hint ? '<div class="sub-note">' + hint + "</div>" : "") + "</div>";
  const box = (t) => '<div class="input-fake">' + t + "</div>";
  const row = (t, s, r) => '<div class="rowx"><div class="grow"><b>' + t + "</b>" + (s ? "<small>" + s + "</small>" : "") + "</div>" + (r || "") + "</div>";
  const sp = '<div style="height:12px"></div>';
  const ser = (items, on) => '<div class="rowx" style="gap:8px;padding:0;flex-wrap:wrap">' + items.map((t, i) => '<span class="seg' + (i === on ? " on" : "") + '">' + t + "</span>").join("") + "</div>";
  const FB = (a, b) => window.UI.filters.filterBar(a, b);

  /* DocumentType -> icon. Colours stay neutral (semantic tokens). */
  const TI = { PDF: "file", DOCUMENT: "file", TEXT: "file", CODE: "hash", SPREADSHEET: "grid", PRESENTATION: "panel", IMAGE: "sparkles", LOGO: "star", BANNER: "flag", VIDEO: "video", AUDIO: "phone", ARCHIVE: "box", LINK: "link", OTHER: "clip" };
  const ficon = (t) => '<span class="fl-ico" title="DocumentType ' + t + '">' + I(TI[t] || "file", 15) + "</span>";
  const flags = (d) => '<span class="fl-flags">' + (d.sens ? '<span title="Document.is_sensitive">' + I("shield", 13) + "</span>" : "") + (d.hold ? '<span title="Document.legal_hold">' + I("lock", 13) + "</span>" : "") + (d.cust ? '<span title="Document.customer_visible">' + I("globe", 13) + "</span>" : "") + (d.lock ? '<span title="DocumentVersion.is_locked">' + I("key", 13) + "</span>" : "") + "</span>";
  const SM = { DRAFT: "yellow", ACTIVE: "green", APPROVED: "green", ARCHIVED: "", DELETED: "red" };
  const st = (s) => ES(s, SM[s] || "");
  const AP = { PENDING: "yellow", APPROVED: "green", REJECTED: "red", CHANGES_REQUESTED: "yellow", CANCELLED: "" };

  /* title, filename, DocumentType, size, category, context, owner, status, updated, versions, flags, approval_status */
  const D = [
    { id: "d1", t: "Acme Rebrand, Design Specification", fn: "acme-rebrand-design-spec.pdf", ty: "PDF", sz: "4.2 MB", cat: "Specification", ctx: "Acme Rebrand Website", sc: "PROJECT", ow: "AM", s: "ACTIVE", up: "Nov 10", v: 3, cust: 1, ap: "PENDING" },
    { id: "d2", t: "Master Services Agreement, Acme Corp (signed)", fn: "msa-acme-signed.pdf", ty: "PDF", sz: "812 KB", cat: "Contract", ctx: "Acme Corp", sc: "CUSTOMER", ow: "SJ", s: "APPROVED", up: "Oct 28", v: 2, lock: 1, hold: 1, ap: "APPROVED" },
    { id: "d3", t: "Homepage hero mockups", fn: "hero-mockups-v7.png", ty: "IMAGE", sz: "2.1 MB", cat: "Design", ctx: "Acme Rebrand Website", sc: "PROJECT", ow: "MS", s: "ACTIVE", up: "Nov 9", v: 7, cust: 1 },
    { id: "d4", t: "Invoice INV-2041, Northwind", fn: "INV-2041.pdf", ty: "PDF", sz: "96 KB", cat: "Invoice", ctx: "Northwind Ltd", sc: "CUSTOMER", ow: "JK", s: "ACTIVE", up: "Nov 8", v: 1, cust: 1 },
    { id: "d5", t: "Brand guidelines 2026", fn: "brand-guidelines-2026.pptx", ty: "PRESENTATION", sz: "18.4 MB", cat: "Design", ctx: "Organization", sc: "ORGANIZATION", ow: "AM", s: "APPROVED", up: "Nov 2", v: 4 },
    { id: "d6", t: "Employee handbook", fn: "employee-handbook.docx", ty: "DOCUMENT", sz: "640 KB", cat: "Policy", ctx: "Organization", sc: "ORGANIZATION", ow: "SJ", s: "ACTIVE", up: "Oct 14", v: 6 },
    { id: "d7", t: "Sprint 14 demo recording", fn: "sprint-14-demo.mp4", ty: "VIDEO", sz: "221 MB", cat: "Other", ctx: "Mobile App v2", sc: "PROJECT", ow: "KL", s: "ACTIVE", up: "Nov 7", v: 1 },
    { id: "d8", t: "Pricing model 2027", fn: "pricing-model-2027.xlsx", ty: "SPREADSHEET", sz: "380 KB", cat: "Other", ctx: "Team Finance", sc: "TEAM", ow: "JK", s: "DRAFT", up: "Nov 6", v: 5, sens: 1 },
    { id: "d9", t: "Offer letter, K. Lund", fn: "offer-kim-lund.pdf", ty: "PDF", sz: "120 KB", cat: "HR document", ctx: "Employee: Kim Lund", sc: "EMPLOYEE", ow: "SJ", s: "APPROVED", up: "Sep 1", v: 2, sens: 1 },
    { id: "d10", t: "Analytics export October", fn: "export-2026-10.zip", ty: "ARCHIVE", sz: "58 MB", cat: "Other", ctx: "Data Warehouse Setup", sc: "PROJECT", ow: "AM", s: "ACTIVE", up: "Nov 3", v: 1, scan: "QUARANTINED" },
    { id: "d11", t: "Mobile flows (Figma)", fn: "external link", ty: "LINK", sz: "-", cat: "Design", ctx: "Mobile App v2", sc: "PROJECT", ow: "MS", s: "ACTIVE", up: "Oct 30", v: 1 },
  ];
  const TREE = [
    ["Organization", [["Company policies", 0, 12], ["Brand assets", 0, 34], ["Templates", 0, 9]]],
    ["Customers", [["Acme Corp", 0, 41], ["Contracts", 1, 6], ["Proposals", 1, 8], ["Briefs", 1, 5], ["Northwind Ltd", 0, 27]]],
    ["Projects", [["Acme Rebrand Website", 0, 63, 1], ["Deliverables", 1, 14], ["Design", 1, 31], ["Specifications", 1, 9], ["Client uploads", 1, 9], ["Mobile App v2", 0, 48]]],
    ["Employees", [["Kim Lund", 0, 7], ["Marco Silva", 0, 5]]],
  ];
  const tree = (sel2) => '<div class="fl-tree">' + '<div class="fl-node' + (sel2 === "all" ? " on" : "") + '">' + I("box", 14) + "All files<span class='n'>412</span></div>" + '<div class="fl-node">' + I("star", 14) + "Favorites<span class='n'>6</span></div>" + '<div class="fl-node">' + I("clock", 14) + "Recent</div>" + '<div class="fl-node">' + I("users", 14) + "Shared with me<span class='n'>3</span></div>" +
    TREE.map((g) => "<h6>" + g[0] + "</h6>" + g[1].map((n) => '<div class="fl-node d' + n[1] + (n[3] ? " on" : "") + '">' + I("folder", 14) + n[0] + "<span class='n'>" + n[2] + "</span></div>").join("")).join("") +
    '<div class="fl-node" style="margin-top:6px;color:var(--blue)">' + I("plus", 14) + "New folder</div></div>";
  const dcell = (d) => '<div class="fl-name">' + ficon(d.ty) + "<div><b>" + d.t + "</b><small>" + d.fn + "</small></div></div>";
  const scan = (d) => (d.scan ? E(d.scan, "red") : "");

  /* =====================================================================================================================
     FILE BROWSER (spec sections 2, 3, 7, 8, 11)
     @screen Files / Browse
     @route  /files/browse?folder=:folderId&scope=&view=grid|list&sort=&q=  (folder = Folder.id, path in Folder.path)
     @perm   VIEW documents.documents.read (rows narrowed by scope; EMPLOYEE scope needs employees.documents.read) · upload documents.documents.create · rename/move documents.documents.update · archive documents.documents.archive ·
             delete documents.documents.delete* · share documents.documents.share · export/download many documents.documents.export* · folders documents.folders.manage
     @api    GET /documents?folder_id=&scope=&category_id=&status=&type=&owner=&q=&sort=&cursor= · GET /folders/tree?scope= · POST /documents/bulk {ids|filter, action, args} · POST /documents/:id/favorite · GET/POST /saved-views?entity_type=DOCUMENT
     @mcp    documents_documents_list · documents_documents_search · documents_documents_move · documents_documents_archive · documents_folders_list
     @data   Folder (parent_folder_id, name, path, depth, scope, project_id, company_id, employee_id, customer_visible, color, icon, is_system, archived_at) · Document (title, filename, type, mimetype, size, category_id, status, scope, folder_id,
             owner_membership_id, version_count, current_version_id, is_sensitive, legal_hold, customer_visible, approval_status, updated_at) · DocumentVersion.status/scan_status · DocumentCategory · DocumentFavorite · SavedView (entity_type DOCUMENT)
     @ui     Resizable folder tree (shadcn Collapsible + ScrollArea), Breadcrumb, ToggleGroup grid/list, Table with column chooser, filter bar (UI.filters), Popover+Command pickers, DropdownMenu row actions, sticky bulk bar, Sheet quick preview
     @states loading skeleton cards/rows · empty folder (drop zone "Drop files here") · error · no-access (403/404 identical, never reveal that a folder exists) · quarantined file badge · partial results when a filter hits a restricted scope
     @audit  document moved, renamed, archived, deleted, favorite toggled (not audited), bulk actions (one audit event per document + one summary)
     @note   Tree nodes are Folder rows grouped by Folder.scope (Organization / Customer / Project / Employee). Moving or renaming a folder never changes Document ids. Folder depth is capped by DocumentSettings.folder_max_depth.
             "Select all" selects by FILTER, the API re-evaluates it. The icon strip on each row: shield = is_sensitive, lock = legal_hold, globe = customer_visible, key = a locked version. Quarantined files show a red badge and no preview.
     ===================================================================================================================== */
  function browse() {
    const gridCard = (d, i) => '<div class="fl-card' + (i < 2 ? " picked" : "") + '"><span class="cbx">' + cb(i < 2) + '</span><div class="fl-thumb">' + I(TI[d.ty] || "file", 34) + '<span class="ext">' + d.fn.split(".").pop().toUpperCase() + "</span></div><div class='fl-meta'><b>" + d.t + "</b><small>" + d.sz + " · v" + d.v + " · " + d.up + " " + flags(d) + "</small></div></div>";
    const folders = [["Deliverables", "14 files · customer visible"], ["Design", "31 files"], ["Specifications", "9 files"], ["Client uploads", "9 files · portal upload allowed"]];
    return '<div class="a-page">' + head("Files", "All documents you can see. Scope and sharing decide what appears.", btn("New folder", "folder") + btn("Upload", "plus", "primary")) +
      '<div class="fl-wrap">' + tree("p") + "<div>" +
      '<div class="fl-crumbs">' + I("box", 14) + "Projects " + I("right", 12) + " <b>Acme Rebrand Website</b> " + muted("Folder.path /projects/acme-rebrand-website") + "</div>" +
      '<div class="toolbar">' + search("Search title, filename, content") + sel("Grid", "grid") + sel("Sort: Updated ↓", "sort") + sel("Columns (8)", "settings") + sel("Views: Needs approval", "star") + "</div>" +
      FB([["Type", "is any of", "PDF, Image"], ["Category", "is any of", "Specification, Design"], ["Status", "is not", "Archived"], ["Updated", "after", "Oct 1"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="bulk"><span class="cb on"></span><b>2 selected</b><span class="muted">bulk bar</span><span style="flex:1"></span>' + btn("Download", "box", "sm") + btn("Share", "link", "sm") + sel("Move to…", "folder") + sel("Category…", "tag") + sel("Tag…", "tag") + btn("Archive", "box", "sm") + btn("Delete", "x", "sm") + "</div>" +
      '<div class="fl-grid" style="margin-bottom:12px">' + folders.map((x) => '<div class="fl-folder">' + I("folder", 22) + "<div><b>" + x[0] + "</b><small>" + x[1] + "</small></div></div>").join("") + "</div>" +
      '<div class="fl-grid">' + D.slice(0, 6).map(gridCard).join("") + "</div>" +
      '<div class="sub-note" style="margin:16px 0 8px">List layout (the same query, ToggleGroup switches the layout and saves it in SavedView.layout)</div>' +
      '<div class="panel" style="margin-top:0"><table>' + th(["", "Name", "Category", "Scope / context", "Owner", "Status", ">Size", "Updated", ""]) + "<tbody>" + D.map((d, i) => "<tr><td>" + cb(i < 2) + "</td><td>" + dcell(d) + " " + flags(d) + "</td><td>" + d.cat + "</td><td>" + E(d.sc) + " " + muted(d.ctx) + "</td><td>" + wh(d.ow) + "</td><td>" + st(d.s) + " " + (d.ap ? E(d.ap, AP[d.ap]) : "") + " " + scan(d) + "</td><td class='num'>" + d.sz + " " + muted("v" + d.v) + "</td><td>" + d.up + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div>" +
      '<div class="pager"><span class="muted">1–11 of 63 in this folder</span><span style="flex:1"></span>' + btn("Previous", "", "sm") + btn("Next", "", "sm") + "</div>" +
      "</div></div>" +
      dm(["Folder · parent_folder_id, name, path, depth, scope, project_id, company_id, employee_id, customer_visible, portal_upload_allowed, is_system, archived_at", "Document · title, filename, type, size, category_id, status, scope, folder_id, owner_membership_id, version_count, is_sensitive, legal_hold, customer_visible, approval_status, updated_at", "DocumentVersion · status, scan_status, is_locked", "DocumentCategory · name, is_sensitive · DocumentFavorite · SavedView (entity_type DOCUMENT)"], []) + "</div>";
  }

  /* =====================================================================================================================
     RECENT & FAVORITES (spec section 7)
     @screen Files / Recent and favorites
     @route  /files/recent?tab=recent|favorites
     @perm   VIEW documents.documents.read (items you can no longer see disappear silently)
     @api    GET /documents/recent · GET /documents/favorites · DELETE /documents/:id/favorite
     @mcp    documents_documents_list (filter recent=true)
     @data   DocumentRecentAccess (membership_id, document_id, last_accessed_at, access_count) · DocumentFavorite (membership_id, document_id | folder_id) · Document · Folder
     @ui     Tabs, Table, DropdownMenu
     @states loading · empty ("Nothing opened yet") · error
     @note   One DocumentRecentAccess row per member and document, bumped on every open. Downloads of sensitive categories are audited in audit_events, not here. Favorites can point to a document OR a folder.
     ===================================================================================================================== */
  function recent() {
    return '<div class="a-page">' + head("Recent and favorites", "Your personal shortcuts.", btn("Clear recent", "x")) +
      '<div class="tabset">' + tabs([["r", "Recent", 8], ["f", "Favorites", 6]], "r") +
      pane("r", 1, tbl(["Name", "Context", "Last opened", ">Opened", ""], D.slice(0, 8).map((d, i) => ["<div class='fl-name'>" + ficon(d.ty) + "<div><b>" + d.t + "</b><small>" + d.fn + "</small></div></div>", d.ctx, ["Today 09:14", "Today 08:02", "Yesterday", "Yesterday", "Nov 9", "Nov 8", "Nov 7", "Nov 6"][i], String(12 - i), I("star", 15)])) ) +
      pane("f", 0, tbl(["Name", "Kind", "Context", ""], [["<div class='fl-name'>" + ficon("OTHER") + "<div><b>Acme Rebrand Website</b><small>Folder</small></div></div>", "Folder", "Project", I("star", 15)]].concat(D.slice(0, 5).map((d) => ["<div class='fl-name'>" + ficon(d.ty) + "<div><b>" + d.t + "</b><small>" + d.fn + "</small></div></div>", "Document", d.ctx, I("star", 15)])))) + "</div>" +
      dm(["DocumentRecentAccess · membership_id, document_id, last_accessed_at, access_count", "DocumentFavorite · membership_id, document_id, folder_id", "Document · title, filename, type · Folder · name"], []) + "</div>";
  }

  /* =====================================================================================================================
     UPLOAD (spec sections 5, 6; DocumentUploadJob)
     @screen Files / Upload (full page; the same form opens as a Dialog from any folder or record)
     @route  /files/upload?folder=&project=&company=&entity=<RecordEntityType>:<id>&document=<id> (document = upload a NEW VERSION of that document)
     @perm   documents.documents.create (new document) · documents.documents.update (new version) · linking a record needs read on that record · sensitive category needs documents.documents.create on that category · portal users: portal.documents.upload into folders with portal_upload_allowed
     @api    POST /document-upload-jobs {batch_id, filename, mimetype, expected_size_bytes, expected_checksum, folder_id, scope, project_id, company_id, entity_type, entity_id, category_id, title, change_note, document_id?} -> returns a signed upload URL (resumable, chunked) ·
             POST /document-upload-jobs/:id/complete · POST /document-upload-jobs/from-url {source_url, ...} · GET /document-upload-jobs?batch_id= (progress)
     @mcp    documents_documents_create · documents_versions_create · documents_upload_from_url
     @data   DocumentUploadJob (batch_id, status, source, source_url, filename, mimetype, expected_size_bytes, uploaded_bytes, expected_checksum, folder_id, scope, project_id, company_id, entity_type, entity_id, category_id, title, change_note,
             scan_status, error_code, error_message, via_portal, document_id, version_id) · Document · DocumentVersion (created on completion) · DocumentAttachment (link to a record) · DocumentSettings (max_file_size_bytes, allowed_mime_types, blocked_extensions, virus_scan_required)
     @ui     Dropzone (react-dropzone) with a resumable chunk uploader, shadcn Form (Select, Popover+Command, Textarea, Switch), Progress, per-file Collapsible metadata, Toast for completion
     @states idle · uploading (per-file progress, cancel) · scanning · completed · failed (size, type, blocked extension, quota, virus found) with retry · permission error on a field disabled with reason
     @audit  document created, version created (change_note), upload failed by policy, file quarantined
     @note   One job per file; jobs in a batch share batch_id. Files are checked against DocumentSettings BEFORE the upload starts (size, mime, blocked extension) and again after (checksum, scan). A file stays PENDING/SCANNING and is not downloadable until
             DocumentVersion.status = AVAILABLE. Uploading to an existing Document creates version_number + 1 and requires a change_note when the document has an approval or a lock. Upload from URL uses source = URL_IMPORT. The folder decides the
             default category (Folder.default_category_id) and scope.
     ===================================================================================================================== */
  function upload() {
    const jobs = [["acme-rebrand-design-spec-v4.pdf", "PDF · 4.6 MB", "UPLOADING", 62, "Specification"], ["hero-mockups-v8.png", "PNG · 2.3 MB", "SCANNING", 100, "Design"], ["kickoff-notes.docx", "DOCX · 84 KB", "COMPLETED", 100, "Other"], ["installer.exe", "EXE · 12 MB", "FAILED", 0, "blocked extension (DocumentSettings.blocked_extensions)"]];
    const sm = { UPLOADING: "blue", SCANNING: "yellow", COMPLETED: "green", FAILED: "red" };
    return '<div class="a-page">' + head("Upload files", "Add documents to a folder, a project or a customer. Large files upload in resumable chunks.", btn("Cancel") + btn("Upload 3 files", "plus", "primary")) +
      '<div class="g2" style="grid-template-columns:1.7fr 1fr;align-items:start"><div>' +
      cd("<b>Files</b><span class='r muted'>DocumentUploadJob · batch</span>", '<div class="drop" style="margin:14px">' + I("clip", 16) + " Drop files or folders here, or browse · up to 2 GB each (DocumentSettings.max_file_size_bytes)</div>" +
        jobs.map((j) => '<div class="fl-upl">' + ficon("PDF") + "<div><b>" + j[0] + "</b><small>" + j[1] + "</small></div><div>" + (j[2] === "FAILED" ? '<small style="color:var(--red)">' + j[4] + "</small>" : "<div>" + sel(j[4], "tag") + "</div>") + "</div><div>" + (j[2] === "UPLOADING" ? bar(j[3]) : "") + "</div>" + E(j[2], sm[j[2]]) + "<div>" + more + "</div></div>").join(""), 1) +
      sp + cd("<b>Or import from a URL</b><span class='r muted'>source URL_IMPORT</span>", '<div class="rowx">' + box("https://…") + btn("Fetch", "link", "sm") + '</div><div class="sub-note" style="padding:0 14px 12px">The server downloads the file, applies the same limits and scan, and stores it as a normal version. Private network addresses are refused.</div>', 1) +
      sp + cd("<b>New version of an existing document</b>", f("Document", sel("Choose a document to replace…", "file"), "Leave empty to create new documents. Choosing one turns every file into a NEW VERSION (version_number + 1); old versions stay immutable.") + f("Change note", box("What changed in this version?"), "Required when the document has a pending approval, a share pinned to a version, or a module lock.") + '<div class="rowx"><div class="grow"><b>Keep approved version as current until approved</b><small>Document.approved_version_id stays on the approved version; the new one waits for a new approval.</small></div>' + sw(1) + "</div>") +
      "</div><div>" +
      cd("<b>Where it goes</b>", f("Folder", sel("Projects / Acme Rebrand Website / Specifications", "folder")) + f("Scope", sel("Project", "layers"), "Document.scope. Follows the folder; changeable when you may.") + f("Project", sel("Acme Rebrand Website", "folder")) + f("Customer", sel("Acme Corp", "building")) + f("Linked record", sel("Link to task, ticket, invoice…", "link"), "Creates a DocumentAttachment (entity_type + entity_id, role).")) +
      sp + cd("<b>Metadata</b>", f("Title", box("Defaults to the file name")) + f("Category", sel("Specification", "tag")) + f("Owner", sel("Anna Meyer", "users")) + f("Tags", sel("Add tags…", "tag")) + f("Description", box("Optional")) + f("Retention policy", sel("Category default: Project records, 7 years"), "DocumentCategory.default_retention_policy_id applies when empty.")) +
      sp + cd("<b>Access</b>", '<div class="rowx"><div class="grow"><b>Customer visible</b><small>Shows in the customer portal (07)</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Sensitive</b><small>Audits every preview and download</small></div>' + sw(0) + '</div><div class="rowx"><div class="grow"><b>Watermark when shared</b><small>Document.watermark_enabled</small></div>' + sw(0) + "</div>") +
      sp + cd("<b>Limits (your organization)</b>", kv("Max file size", "2 GB") + kv("Blocked", ".exe .bat .scr .js") + kv("Virus scan", "Required before available") + kv("Signed URL lifetime", "10 minutes"), 0) +
      "</div></div>" +
      dm(["DocumentUploadJob · every column listed in @data", "Document · title, category_id, folder_id, scope, project_id, company_id, owner_membership_id, retention_policy_id, customer_visible, is_sensitive, watermark_enabled", "DocumentVersion · version_number, change_note, checksum_sha256, scan_status · DocumentAttachment", "DocumentSettings · max_file_size_bytes, allowed_mime_types, blocked_extensions, virus_scan_required"], []) + "</div>";
  }

  /* =====================================================================================================================
     DOCUMENT DETAIL (spec sections 4, 6, 8, 9, 10)
     @screen Files / Document
     @route  /files/documents/:documentId?tab=preview|versions|sharing|links|approvals|signatures|activity
     @perm   VIEW documents.documents.read (+ employees.documents.read for EMPLOYEE scope) · edit metadata/new version documents.documents.update · archive documents.documents.archive · delete documents.documents.delete* · share documents.documents.share ·
             approvals documents.documents.approve · download documents.documents.read (every request re-checked; sensitive ones audited) · legal hold documents.retention.manage*
     @api    GET /documents/:id · PATCH /documents/:id · GET /documents/:id/versions · POST /documents/:id/versions · POST /documents/:id/versions/:versionId/restore · GET /documents/:id/preview?version= (signed URL) ·
             GET /documents/:id/download?version= (signed URL) · GET /documents/:id/shares · GET /documents/:id/attachments · GET /documents/:id/approvals · GET /documents/:id/activity · GET/POST /notes?entity_type=DOCUMENT&entity_id=
     @mcp    documents_documents_get · documents_versions_list · documents_documents_update · documents_documents_share · documents_documents_archive
     @data   Document (all columns) · DocumentVersion (version_number, status, filename, size_bytes, checksum_sha256, scan_status, change_note, author_membership_id, source, restored_from_version_id, is_locked, locked_by_module, locked_reason, page_count,
             extracted_text) · DocumentPreview (kind, status, page_number, watermarked) · DocumentShare · DocumentAttachment · DocumentApproval/DocumentApprover · CrmNote (entity_type DOCUMENT) · SignatureRequest (package_documents, signed_document_id) · audit_events
     @ui     Tabs, PDF/image/video viewer in a Sheet or inline (react-pdf, native video), Table, Dialog for upload-new-version / restore, AlertDialog for delete, Popover+Command people pickers, Textarea composer with @mentions
     @states loading skeleton · preview PENDING (rendering) · preview UNSUPPORTED (download only) · version QUARANTINED (no preview, no download, banner) · legal hold banner · deleted (read-only with Restore) · no-access
     @audit  viewed/downloaded (sensitive only), metadata changed (field diff), new version, version restored, share created/revoked, approval requested/decided, archived, deleted, legal hold set/released
     @note   Comments are CrmNote rows (entity_type DOCUMENT) shared with the platform notes service; the COMMENT share permission only allows adding notes. Version compare works for text and PDF (diff of DocumentVersion.extracted_text); other types show
             metadata only. Restore creates a NEW version (restored_from_version_id) and never edits an old one. A locked version shows who locked it and why and cannot be replaced. Watermark: preview renditions are generated with
             DocumentPreview.watermarked when the document is customer-visible and DocumentSettings.watermark_customer_documents is on.
     ===================================================================================================================== */
  function doc() {
    const d = D[0];
    const ver = [[3, "AVAILABLE", "CLEAN", "Anna Meyer", "Nov 10 14:22", "4.2 MB", "Added mobile breakpoints and dark mode tokens", 0, "", 1], [2, "AVAILABLE", "CLEAN", "Marco Silva", "Nov 4 10:05", "3.9 MB", "Client feedback round 1", 0, "", 0], [1, "AVAILABLE", "CLEAN", "Anna Meyer", "Oct 21 16:40", "3.1 MB", "First draft", 0, "", 0]];
    const prev = '<div class="fl-prev"><div class="bar-t">' + I("file", 14) + " acme-rebrand-design-spec.pdf · v3 · page 1 of 24<span style='flex:1'></span>" + btn("Download", "box", "sm") + btn("Open full screen", "panel", "sm") + '</div><div style="position:relative;flex:1"><div class="fl-page"><i class="h"></i><i></i><i></i><i style="width:80%"></i><i></i><i style="width:60%"></i><i></i><i style="width:90%"></i><i style="width:70%"></i></div><div class="fl-wm">ACME · CONFIDENTIAL</div></div></div>';
    return '<div class="a-page">' +
      '<div class="a-head"><div><h1>' + d.t + '</h1><p>' + d.fn + " · PDF · 4.2 MB · owner Anna Meyer · updated Nov 10</p></div><div class=\"acts\">" + btn("Favorite", "star") + btn("Share", "link") + btn("New version", "plus") + btn("Edit", "edit", "primary") + "</div></div>" +
      '<div class="rowx" style="gap:8px;padding:0 0 12px;flex-wrap:wrap">' + st("ACTIVE") + E("Pending", "yellow") + E("PROJECT") + E("Customer visible", "blue") + '<span class="muted">approval PENDING on version 3 · 2 approvers</span></div>' +
      '<div class="tabset">' + tabs([["p", "Preview"], ["v", "Versions", 3], ["s", "Sharing", 4], ["l", "Links", 5], ["a", "Approvals", 1], ["g", "Signatures"], ["h", "Activity"]], "p") +
      pane("p", 1, '<div class="g2" style="grid-template-columns:1.6fr 1fr;align-items:start"><div>' + prev + sp + cd("<b>Comments</b><span class='r muted'>CrmNote · entity_type DOCUMENT</span>", '<div class="tl"><div class="ev"><b>Marco Silva</b> <span class="muted">Nov 10</span><small>“Section 4 needs the updated spacing scale, @Anna Meyer can you check?”</small></div><div class="ev"><b>Lena Kovac (customer)</b> ' + E("COMMENT", "blue") + '<small>Nov 9 · “Approved the colour palette, waiting for typography.”</small></div></div><div class="rowx" style="margin-top:8px"><div class="grow muted">Write a comment… (@ to mention)</div>' + sel("Internal", "lock") + btn("Comment", "", "primary") + "</div>") + "</div><div>" +
        cd("<b>Properties</b>", kv("Category", "Specification") + kv("Status", st("ACTIVE")) + kv("Scope", E("PROJECT") + " Acme Rebrand Website") + kv("Folder", "Projects / Acme Rebrand Website / Specifications") + kv("Customer", "Acme Corp " + muted("(02)")) + kv("Owner", wh("AM")) + kv("Tags", E("Brand", "blue") + " " + E("Phase 2")) + kv("Source", E("UPLOAD")) + kv("Created", "Oct 21 by Anna Meyer") + kv("Versions", "3 · current v3") + kv("Checksum", muted("sha256 9f2c…a41e")) + kv("Scan", E("CLEAN", "green") + " " + muted("Nov 10 14:23")) + kv("Customer visible", sw(1)) + kv("Sensitive", sw(0)) + kv("Watermark", sw(1)) + kv("Retention", "Project records · until Nov 2033") + kv("Legal hold", muted("none")) + kv("Custom fields", "Contract ref: ACM-2026-04")) + "</div></div>") +
      pane("v", 0, cd("<b>Version history</b><span class='r'>" + btn("Compare", "layers", "sm") + btn("Upload new version", "plus", "sm") + "</span>", tbl(["Ver.", "Status", "Scan", "Author", "Date", ">Size", "Change note", ""], ver.map((v) => ["v" + v[0] + (v[9] ? " " + E("Current", "blue") : ""), E(v[1], "green"), E(v[2], "green"), v[3], v[4], v[5], v[6], more])).replace('class="panel" style="margin-top:0"', 'class="panel" style="margin:0;border:0"'), 1) + sp +
        cd("<b>Compare v2 with v3</b><span class='r muted'>DocumentVersion.extracted_text · text and PDF only</span>", '<div class="fl-diff"><div><b>v2</b><p>Typography uses <span class="del">Inter 14</span> for body. Spacing scale <span class="del">4 / 8 / 16</span>.</p></div><div><b>v3</b><p>Typography uses <span class="add">Inter 15</span> for body. Spacing scale <span class="add">4 / 8 / 12 / 16</span>. <span class="add">Dark mode tokens added.</span></p></div></div>') + sp +
        callout("lock", "A version can be locked by another module (for example 04 Contracts locks the signed contract). Locked versions show who locked them and why, and cannot be replaced or deleted. This document has no locked version.") ) +
      pane("s", 0, cd("<b>Who has access</b><span class='r'>" + btn("Share", "plus", "sm") + "</span>", tbl(["Subject", "Type", "Permission", "Expires", "Pinned version", "Status", ""], [[wh("MS"), E("MEMBERSHIP"), E("EDIT"), "—", "Current", E("ACTIVE", "green"), more], ["Design team", E("TEAM"), E("COMMENT"), "—", "Current", E("ACTIVE", "green"), more], ["Lena Kovac, Acme Corp", E("PORTAL_USER"), E("VIEW"), "Dec 31", "v2", E("ACTIVE", "green"), more], ["agency@studio-nord.com", E("EXTERNAL_EMAIL"), E("VIEW"), "Nov 5", "v2", E("EXPIRED"), more]]).replace('class="panel" style="margin-top:0"', 'class="panel" style="margin:0;border:0"'), 1) + sp + cd("<b>Public links</b>", row("Link ending …k3Qz", "Expires Nov 24 · password set · downloads 3 of 10 · views 12", E("ACTIVE", "green") + more), 1) + sub("Share activity is visible to the owner: opens, downloads and last access per share (DocumentShare.access_count, download_count, last_accessed_at).")) +
      pane("l", 0, cd("<b>Linked records</b><span class='r'>" + btn("Link record", "plus", "sm") + "</span>", [["PROJECT", "Acme Rebrand Website", "Specification", "Projects"], ["TASK", "WEB-142 Rebuild pricing page hero", "Reference", "Tasks"], ["TASK", "WEB-151 Client approval flow", "Reference", "Tasks"], ["PROPOSAL", "PRO-2026-018 Acme redesign", "Attachment", "Proposals"], ["TICKET", "TCK-2041 CSV export request", "Attachment", "Support"]].map((r) => row(r[1], r[3] + " · role " + r[2], E(r[0]) + more)).join(""), 1) + sub("DocumentAttachment (entity_type, entity_id, role, source_module). The owning module controls the relationship; removing the link never deletes the document.")) +
      pane("a", 0, cd("<b>Approval on version 3</b><span class='r'>" + btn("Remind", "bell", "sm") + btn("Cancel request", "x", "sm") + "</span>", row("Design specification sign-off", "Requested by Anna Meyer Nov 10 · due Nov 14 · all approvers required", E("PENDING", "yellow")) + row("Marco Silva", "MEMBERSHIP · notified Nov 10", E("APPROVED", "green")) + row("Lena Kovac, Acme Corp", "PORTAL_USER · notified Nov 10", E("PENDING", "yellow")), 1) + sub("The approval is bound to an exact version. A new upload does not change the decision on v3. Contract approval and signature stay in 04.")) +
      pane("g", 0, cd("<b>Signature requests including this document</b>", row("No signature requests", "Documents are signed through a contract or proposal in 04. This document is not part of a package.", btn("Open Signatures", "pen", "sm")), 1)) +
      pane("h", 0, cd("<b>Activity</b><span class='r muted'>audit_events</span>", '<div class="tl"><div class="ev"><b>Approval requested for v3</b><small>Anna Meyer · Nov 10 14:30</small></div><div class="ev"><b>Version 3 uploaded</b><small>Anna Meyer · Nov 10 14:22 · “Added mobile breakpoints and dark mode tokens”</small></div><div class="ev"><b>Public link created (expires Nov 24, password)</b><small>Anna Meyer · Nov 10</small></div><div class="ev"><b>Shared with Lena Kovac (VIEW, pinned to v2)</b><small>Marco Silva · Nov 5</small></div><div class="ev"><b>Downloaded by lena.kovac@acme.com via public link</b><small>Nov 9 11:14 · IP 84.1.x.x</small></div><div class="ev"><b>Document created</b><small>Anna Meyer · Oct 21</small></div></div>')) + "</div>" +
      dm(["Document · all columns (title, category_id, status, scope, folder_id, owner, version_count, current_version_id, approval_status, approved_version_id, retention_policy_id, legal_hold, is_sensitive, customer_visible, watermark_enabled, keywords)", "DocumentVersion · version_number, status, scan_status, change_note, author_membership_id, restored_from_version_id, is_locked, locked_by_module, locked_reason, extracted_text", "DocumentPreview · DocumentShare · DocumentAttachment · DocumentApproval · DocumentApprover · CrmNote (DOCUMENT) · audit_events", "Reads: SignatureRequest.package_documents (04)"], []) + "</div>";
  }
  const sub = (t) => '<div class="sub-note" style="margin-top:8px">' + t + "</div>";

  /* =====================================================================================================================
     SHARED LINKS & SHARES — manage (spec section 9)
     @screen Files / Shared
     @route  /files/shared?tab=links|people|with-me&status=&expires=
     @perm   VIEW documents.documents.read on the shared item · create/revoke documents.documents.share · see every share of the organization documents.documents.share + manage on the item (others only see shares they created) ·
             public links additionally require DocumentSettings.public_links_enabled
     @api    GET /document-shares?subject_type=&status=&document_id=&folder_id=&expires_before=&cursor= · POST /document-shares · PATCH /document-shares/:id {expires_at, permission, allow_download, max_access_count} · POST /document-shares/:id/revoke · POST /document-shares/bulk-revoke
     @mcp    documents_shares_list · documents_documents_share · documents_shares_revoke
     @data   DocumentShare (document_id | folder_id, subject_type, membership_id, team_id, portal_user_id, external_email, external_name, link_token, link_password_hash, permission, status, allow_download, watermark, pinned_version_id,
             max_access_count, access_count, download_count, last_accessed_at, message, expires_at, shared_by_membership_id, revoked_at) · Document.title · Folder.name · DocumentSettings (public_links_enabled, public_link_max_days, default_share_expiry_days)
     @ui     Tabs, Table with filter bar, Badge for status, Switch, DropdownMenu (Copy link, Extend, Change permission, Revoke), AlertDialog for revoke, Tooltip for the masked token
     @states loading · empty ("Nothing shared yet") · error · public links disabled by policy (banner, create button disabled with reason) · no-access
     @audit  share created, permission changed, extended, revoked, public link opened and downloaded (per access, queryable here via access_count and the audit log)
     @note   The raw link token is shown ONCE on creation; afterwards only the last 4 characters. link_password_hash is never returned. Expired shares flip to EXPIRED automatically (job); revoking sets revoked_at and takes effect at once.
             The share list of a customer shows only items that are also customer_visible. Sharing a folder shares its current and future documents.
     ===================================================================================================================== */
  function shares() {
    const L = [["Acme Rebrand, Design Specification", "…k3Qz", "VIEW", "Nov 24", "yes", "3 / 10", "12", "Nov 9", "ACTIVE", "AM"], ["Brand guidelines 2026", "…p0Wx", "VIEW", "Dec 31", "no", "—", "41", "Nov 10", "ACTIVE", "SJ"], ["Folder: Deliverables (Acme)", "…m7Re", "VIEW", "Nov 15", "yes", "7 / 25", "19", "Nov 8", "ACTIVE", "MS"], ["Pricing model 2027", "…a9Lc", "VIEW", "Nov 1", "yes", "1 / 1", "2", "Oct 30", "EXPIRED", "JK"], ["Sprint 14 demo recording", "…d2Hn", "VIEW", "Dec 1", "no", "—", "5", "Nov 2", "REVOKED", "KL"]];
    return '<div class="a-page">' + head("Shared", "Links and explicit shares you manage.", btn("Revoke selected", "x") + btn("New share", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Active links", 14, "PUBLIC_LINK · ACTIVE") + stat("Expiring in 7 days", 4, "extend or let expire", 1) + stat("Shared with people", 63, "MEMBERSHIP · TEAM · PORTAL_USER · EXTERNAL_EMAIL") + stat("Downloads this month", 138, "from links and shares") + "</div>" +
      '<div class="tabset">' + tabs([["l", "Public links", 14], ["p", "People and teams", 63], ["m", "Shared with me", 3]], "l") +
      pane("l", 1, '<div class="toolbar">' + search("Search document, folder, token ending") + sel("Status: Active", "filter") + sel("Expires: Any", "calendar") + sel("Created by: Anyone", "users") + sel("Sort: Expiry ↑", "sort") + "</div>" +
        FB([["Status", "is any of", "Active, Expired"], ["Password", "is", "set"]], btn("Clear", "", "sm ghost")) +
        '<div class="panel" style="margin-top:0"><table>' + th(["", "Item", "Link", "Permission", "Expires", "Password", ">Downloads", ">Views", "Last access", "Status", "By", ""]) + "<tbody>" + L.map((r, i) => "<tr><td>" + cb(i === 0) + "</td><td>" + ink(r[0]) + "</td><td class='muted'>" + r[1] + "</td><td>" + E(r[2]) + "</td><td>" + r[3] + "</td><td>" + (r[4] === "yes" ? I("lock", 14) : "—") + "</td><td class='num'>" + r[5] + "</td><td class='num'>" + r[6] + "</td><td>" + r[7] + "</td><td>" + E(r[8], r[8] === "ACTIVE" ? "green" : r[8] === "REVOKED" ? "red" : "") + "</td><td>" + av(r[9]) + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div>" +
        sub("Every public link expires (maximum DocumentSettings.public_link_max_days = 90) and is audited per access. No link ever points at storage; opening it goes through the platform, which checks status, expiry, password and download limits.")) +
      pane("p", 0, tbl(["Item", "Shared with", "Type", "Permission", "Expires", "Pinned version", "Status", "Shared by", ""], [["Acme Rebrand, Design Specification", "Lena Kovac, Acme Corp", E("PORTAL_USER"), E("VIEW"), "Dec 31", "v2", E("ACTIVE", "green"), av("MS"), more], ["Acme Rebrand, Design Specification", "Design team", E("TEAM"), E("COMMENT"), "—", "Current", E("ACTIVE", "green"), av("AM"), more], ["Folder: Deliverables (Acme)", "Marco Silva", E("MEMBERSHIP"), E("EDIT"), "—", "—", E("ACTIVE", "green"), av("AM"), more], ["Brand guidelines 2026", "agency@studio-nord.com", E("EXTERNAL_EMAIL"), E("VIEW"), "Nov 5", "v3", E("EXPIRED"), av("SJ"), more]])) +
      pane("m", 0, tbl(["Item", "Shared by", "Permission", "Expires", ""], [["Q4 budget workbook", wh("JK"), E("EDIT"), "—", more], ["Onboarding checklist", wh("SJ"), E("VIEW"), "Dec 15", more], ["Folder: Employee handbook drafts", wh("SJ"), E("COMMENT"), "—", more]])) + "</div>" +
      dm(["DocumentShare · subject_type, membership_id, team_id, portal_user_id, external_email, link_token (last 4 only), permission, status, allow_download, watermark, pinned_version_id, max_access_count, access_count, download_count, last_accessed_at, expires_at, shared_by_membership_id, revoked_at", "Document.title · Folder.name · DocumentSettings · public_links_enabled, public_link_max_days"], []) + "</div>";
  }

  /* =====================================================================================================================
     CREATE SHARE / LINK — full page (spec section 9)
     @screen Files / Share (also the Share dialog opened from a document, folder or the browser bulk bar)
     @route  /files/shared/new?document=<id>|folder=<id>&type=link|member|team|portal|external
     @perm   documents.documents.share on the item · PUBLIC_LINK needs DocumentSettings.public_links_enabled · sharing to PORTAL_USER needs the item to be customer_visible (or the share makes it visible after a warning) · sensitive documents: public links and external e-mail are blocked
     @api    POST /document-shares {document_id|folder_id, subject_type, membership_id|team_id|portal_user_id|external_email, external_name, permission, allow_download, watermark, pinned_version_id, expires_at, max_access_count, password, message, notify}
     @mcp    documents_documents_share (sensitive: needs human confirmation when an AI agent calls it)
     @data   DocumentShare (all columns written) · DocumentSettings (public_links_enabled, public_link_max_days, default_share_expiry_days, watermark_customer_documents) · Document / Folder · Membership / Team / User (portal) pickers
     @ui     shadcn Form: ToggleGroup for the subject type, Popover+Command pickers (members, teams, portal users), DatePicker, Switch, password Input with strength hint, Textarea, copy-link Input with a Copy button
     @states validation (expiry required and not beyond the maximum, password min length) · saving · created (link shown once, with Copy) · blocked by policy (reason) · permission error
     @audit  share created (subject, permission, expiry, pinned version, password set yes/no), link created
     @note   Expiry defaults to DocumentSettings.default_share_expiry_days and cannot exceed public_link_max_days for public links. A pinned version makes the recipient see that version even after newer uploads. A password is stored only as
             link_password_hash. max_access_count counts opens (the link stops at the limit); there is no separate download limit column, downloads are limited by allow_download only.
     @gap    Download limit separate from max_access_count is not in the schema (DocumentShare has max_access_count only). Documented in gaps-17.md.
     ===================================================================================================================== */
  function sharenew() {
    return '<div class="a-page">' + head("Share a document", "Choose who gets access and for how long.", btn("Cancel") + btn("Create share", "link", "primary")) +
      '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div>' +
      cd("<b>What you share</b>", '<div class="rowx"><div class="fl-name">' + ficon("PDF") + "<div><b>Acme Rebrand, Design Specification</b><small>acme-rebrand-design-spec.pdf · v3 · Customer visible</small></div></div><span style='flex:1'></span>" + btn("Change", "", "sm") + "</div>" + f("Version", ser(["Always the latest", "Pin to a version"], 0), "Pinned: recipients keep seeing that version (DocumentShare.pinned_version_id).")) + sp +
      cd("<b>Who</b>", f("Share with", ser(["Public link", "Member", "Team", "Portal user", "External e-mail"], 0)) + f("Link access", '<div class="fl-secret" style="letter-spacing:0;font-family:inherit"><span class="grow muted">A link is generated when you save. Shown once.</span></div>') +
        '<div class="g2"><div>' + f("Permission", sel("View", "lock"), "VIEW · COMMENT · EDIT · MANAGE. Public links allow VIEW only.") + "</div><div>" + f("Expires", sel("In 14 days (default 14, max 90)", "calendar"), "Required for public links.") + "</div></div>" +
        '<div class="g2"><div>' + f("Password", box("Optional, at least 10 characters"), "Stored as a hash only. Share it with the recipient separately.") + "</div><div>" + f("Maximum opens", box("Unlimited"), "DocumentShare.max_access_count") + "</div></div>" +
        f("Message to the recipient", box("Optional note included in the e-mail"))) + sp +
      cd("<b>Subject pickers (shown for the selected type)</b>", f("Member", sel("Search members…", "users")) + f("Team", sel("Search teams…", "users")) + f("Portal user", sel("Search customer contacts…", "building"), "Only contacts of the document customer.") + f("External e-mail", box("name@company.com") + box("Name (optional)"), "Allowed only when the organization policy permits external collaborators.")) +
      "</div><div>" +
      cd("<b>Options</b>", '<div class="rowx"><div class="grow"><b>Allow download</b><small>Off = view only in the browser</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Watermark preview</b><small>Recipient name and date on every page</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Notify recipient</b><small>Sends the share e-mail (14)</small></div>' + sw(1) + "</div>") + sp +
      cd("<b>Policy</b>", kv("Public links", E("ENABLED", "green")) + kv("Maximum lifetime", "90 days") + kv("Default expiry", "14 days") + kv("Sensitive documents", "No public links, no external e-mail") + kv("This document", "Not sensitive")) + sp +
      callout("shield", "Opening the link is audited each time: time, IP and whether the file was downloaded. You can revoke it from Shared at any moment.") +
      "</div></div>" +
      dm(["DocumentShare · every column listed in @data", "DocumentSettings · public_links_enabled, public_link_max_days, default_share_expiry_days, watermark_customer_documents", "Membership · Team · User (portal)"], ["Separate download limit (max_downloads) is not in the schema: only max_access_count exists"]) + "</div>";
  }

  /* =====================================================================================================================
     CREATE FOLDER — full page (spec section 7)
     @screen Files / New folder
     @route  /files/folders/new?parent=<id>&scope=&project=&company=&employee=&template=<id>
     @perm   documents.folders.manage · scope: project needs projects.projects.read, customer needs crm.companies.read, employee needs employees.documents.manage
     @api    POST /folders {parent_folder_id, name, description, scope, branch_id, team_id, project_id, company_id, employee_id, template_id?, default_category_id, customer_visible, portal_upload_allowed, color, icon, sort_order} · PATCH /folders/:id · POST /folders/:id/archive · POST /folders/:id/move
     @mcp    documents_folders_create · documents_folders_update
     @data   Folder (parent_folder_id, name, description, path, depth, scope, branch_id, team_id, project_id, company_id, employee_id, template_id, default_category_id, customer_visible, portal_upload_allowed, is_system, color, icon, sort_order) · FolderTemplate (applied structure) · DocumentSettings.folder_max_depth · DocumentCategory
     @ui     shadcn Form, Popover+Command (parent folder tree picker, project, customer), Select (scope), ColorPicker swatches, Switch, live preview of the structure created by a template
     @states validation (name unique under the parent, depth limit, forbidden characters) · saving · created (toast + open folder) · permission error · depth exceeded
     @audit  folder created (with template id), renamed, moved, archived, restored
     @note   Path and depth are computed by the API (Folder.path / depth); the client never sends them. Moving or renaming never changes Document ids. Choosing a template creates the whole sub-tree in one transaction. System folders (is_system) cannot be
             renamed, moved or deleted. customer_visible = documents in it can appear in the customer portal; portal_upload_allowed = portal users may upload into it (portal.documents.upload).
     ===================================================================================================================== */
  function foldernew() {
    return '<div class="a-page">' + head("New folder", "Folders keep documents together without changing their ids.", btn("Cancel") + btn("Create folder", "folder", "primary")) +
      '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div>' +
      cd("<b>Folder</b>", f("Name", box("e.g. Design handoff")) + f("Description", box("Optional")) + f("Parent folder", sel("Projects / Acme Rebrand Website", "folder"), "Depth 3 of 6 allowed (DocumentSettings.folder_max_depth).") +
        '<div class="g2"><div>' + f("Colour", ser(["Blue", "Green", "Purple", "Yellow", "Grey"], 0)) + "</div><div>" + f("Icon", sel("Folder", "folder")) + "</div></div>") + sp +
      cd("<b>Belongs to</b>", f("Scope", ser(["Organization", "Branch", "Team", "Project", "Customer", "Employee"], 3), "DocumentScope. Subfolders inherit the scope of the parent.") + f("Project", sel("Acme Rebrand Website", "folder")) + f("Branch / team (optional)", sel("All branches", "building")) + f("Default category for new files", sel("Specification", "tag"), "Folder.default_category_id")) + sp +
      cd("<b>Start from a template (optional)</b>", f("Folder template", sel("Website project (7 folders)", "layers"), "Creates the whole structure below. Templates are managed in Folder templates.") + '<div class="fl-ftree" style="padding:6px 0">' + [["Briefs", "l1"], ["Design", "l1"], ["Mockups", "l2"], ["Assets", "l2"], ["Specifications", "l1"], ["Deliverables", "l1", " customer visible"], ["Client uploads", "l1", " portal upload"]].map((r) => '<div class="r ' + r[1] + '">' + I("folder", 14) + r[0] + "<em>" + (r[2] || "") + "</em></div>").join("") + "</div>") +
      "</div><div>" +
      cd("<b>Access</b>", '<div class="rowx"><div class="grow"><b>Customer visible</b><small>Documents can appear in the customer portal (07)</small></div>' + sw(0) + '</div><div class="rowx"><div class="grow"><b>Allow portal uploads</b><small>Customer users can upload here (portal.documents.upload)</small></div>' + sw(0) + "</div>" + f("Extra access", sel("Share the folder with…", "users"), "Creates DocumentShare rows with folder_id. Everyone with scope access sees it already.")) + sp +
      callout("lock", "System folders (is_system) such as Signed contracts are created by other modules and cannot be renamed, moved or deleted.") + sp +
      cd("<b>Result</b>", kv("Path", "/projects/acme-rebrand-website/design-handoff") + kv("Depth", "3") + kv("Visible to", "Project members + shares")) + "</div></div>" +
      dm(["Folder · every column in @data", "FolderTemplate · structure (applied) · DocumentSettings.folder_max_depth", "DocumentCategory · Project · CrmCompany · Team · Branch (pickers)"], []) + "</div>";
  }

  /* =====================================================================================================================
     FOLDER TEMPLATES (spec section 7)
     @screen Files / Folder templates (list + editor)
     @route  /files/folder-templates · /files/folder-templates/new · /files/folder-templates/:id
     @perm   VIEW documents.folders.manage (templates are applied by project, customer and HR flows with their own keys) · create/edit/archive documents.folders.manage
     @api    GET/POST /folder-templates · PATCH /folder-templates/:id · POST /folder-templates/:id/archive · POST /folder-templates/:id/apply {target}
     @mcp    documents_folder_templates_list · documents_folder_templates_apply
     @data   FolderTemplate (name, description, target, project_type_id, structure Json, is_default, archived_at) · ProjectType (05) · Folder.template_id
     @ui     Table, Tree editor (dnd-kit sortable) with inline rename, Dialog, Select, Switch
     @states loading · empty · error · no-access · "in use by N projects" warning on archive
     @audit  template created, structure changed, set default, archived
     @note   structure is a tree of { name, customer_visible, portal_upload_allowed, default_category_slug, children[] }. One default per target (and per project_type_id for PROJECT_TYPE) is applied automatically when a project (05 section 36),
             customer, employee (10) or organization is created. Editing a template never changes folders already created.
     ===================================================================================================================== */
  function tpl() {
    return '<div class="a-page">' + head("Folder templates", "Default folder structures per project type, customer, employee or organization.", btn("New template", "plus", "primary")) +
      '<div class="g2" style="grid-template-columns:1.1fr 1fr;align-items:start"><div>' +
      tbl(["Template", "Target", "Project type", ">Folders", "Default", "Used by", ""], [[ink("Website project"), E("PROJECT_TYPE"), "Website", "7", sw(1), "12 projects", more], [ink("App project"), E("PROJECT_TYPE"), "Mobile app", "8", sw(1), "5 projects", more], [ink("Customer onboarding"), E("CUSTOMER"), "—", "5", sw(1), "41 customers", more], [ink("Employee file"), E("EMPLOYEE"), "—", "6", sw(1), "28 employees", more], [ink("Organization basics"), E("ORGANIZATION"), "—", "4", sw(0), "—", more], [ink("Retainer project (old)") + " " + E("ARCHIVED"), E("PROJECT_TYPE"), "Retainer", "5", sw(0), "0", more]]) + "</div><div>" +
      cd("<b>Website project</b><span class='r'>" + btn("Save", "check", "sm primary") + "</span>", f("Name", box("Website project")) + f("Target", ser(["Project type", "Customer", "Employee", "Organization"], 0)) + f("Project type", sel("Website", "layers")) + '<div class="rowx" style="padding:0 0 10px"><div class="grow"><b>Default for this project type</b><small>Applied automatically on project creation</small></div>' + sw(1) + "</div>" +
        '<div class="fl-ftree">' + [["Briefs", "", "category Brief"], ["Design", "", ""], ["Mockups", "l1", ""], ["Assets", "l1", ""], ["Specifications", "", "category Specification"], ["Deliverables", "", "customer visible"], ["Client uploads", "", "portal upload"]].map((r) => '<div class="r ' + r[1] + '">' + I("folder", 14) + r[0] + "<em>" + r[2] + "</em>" + more + "</div>").join("") + '</div><div style="margin-top:8px">' + btn("Add folder", "plus", "sm") + "</div>") + "</div></div>" +
      dm(["FolderTemplate · name, description, target, project_type_id, structure (Json tree), is_default, archived_at", "ProjectType · name (05) · Folder.template_id (usage count)"], []) + "</div>";
  }

  /* =====================================================================================================================
     CREDENTIAL VAULT — list (spec section 12)
     @screen Files / Vault
     @route  /files/vault?scope=&type=&company=&project=&expiring=
     @perm   VIEW documents.vault.read* (sees name, type, scope, owner, expiry, secret_hint; never the secret) · reveal/copy documents.vault.reveal* · create/edit/rotate/delete/grant documents.vault.manage* · portal users see only entries with a VaultEntryGrant and portal_visible
     @api    GET /vault/entries?scope=&company_id=&project_id=&type=&expiring_before=&q= · POST /vault/entries · GET /vault/entries/:id · PATCH /vault/entries/:id · POST /vault/entries/:id/reveal · DELETE /vault/entries/:id
     @mcp    documents_vault_list (metadata only) · documents_vault_get · documents_vault_reveal (sensitive: human confirmation, never returned to a model by default)
     @data   VaultEntry (scope, company_id, project_id, name, type, username, url, notes, secret_hint, file_name, expires_at, owner_membership_id, portal_visible, last_rotated_at, last_revealed_at, reveal_count, archived_at) · VaultEntryGrant · VaultKey
     @ui     Table with filter bar, Badge for type and expiry, DropdownMenu, expiry warning Alert, Tooltip on secret_hint ("ends in …x9"), Sheet detail
     @states loading · empty · error · no-access (vault hidden when the member lacks documents.vault.read) · expired and expiring soon highlighted
     @audit  entry created/updated/rotated/deleted, grant/revoke; reveal and copy are separate actions (VaultAccessLog + audit_events, vault.entry_revealed webhook)
     @note   The list NEVER contains secrets or ciphertext. Entries encrypted with the active VaultKey of the organization (key material stays in the KMS). This is not where OpenAI/Resend/Twilio/Stripe/Viva Wallet keys live (Admin, Integrations).
             Sharing a vault entry into Messaging or Support is blocked; only a link to the entry is shared (needs vault access to open it).
     ===================================================================================================================== */
  function vault() {
    const R = [["Acme hosting (cPanel)", "PASSWORD", "CUSTOMER", "Acme Corp", "acme-admin", "…x9", "Dec 30", "AM", 1, "Nov 8"], ["Cloudflare API token, Acme", "API_KEY", "CUSTOMER", "Acme Corp", "—", "…q2", "Nov 20", "MS", 0, "Nov 10"], ["Deploy key, Mobile App v2", "SSH_KEY", "PROJECT", "Mobile App v2", "deploy", "…7c", "—", "KL", 0, "Oct 31"], ["Domain registrar, northwind.com", "PASSWORD", "CUSTOMER", "Northwind Ltd", "ops@northwind.com", "…m1", "Nov 14", "JK", 1, "Nov 1"], ["Agency wifi and alarm codes", "NOTE", "ORGANIZATION", "Organization", "—", "—", "—", "SJ", 0, "Sep 12"], ["SSL certificate bundle, Acme", "FILE", "CUSTOMER", "Acme Corp", "—", "file", "Mar 2", "AM", 0, "Oct 5"]];
    return '<div class="a-page">' + head("Credential vault", "Encrypted logins and keys that belong to customers and projects. Secrets are write-only.", btn("Access log", "shield") + btn("New credential", "plus", "primary")) +
      callout("key", "Your own integration keys (OpenAI, Resend, Twilio, Stripe, Viva Wallet) are managed in Admin, Integrations, not here.") + sp +
      '<div class="mini-stats">' + stat("Entries", 38, "not archived") + stat("Expiring in 30 days", 3, "expires_at", 1) + stat("Expired", 1, "rotate or archive", 1) + stat("Revealed this week", 9, "VaultAccessLog REVEAL") + stat("Portal visible", 4, "VaultEntry.portal_visible") + "</div>" +
      '<div class="toolbar">' + search("Search name, username, URL") + sel("Scope: All", "layers") + sel("Type: All", "key") + sel("Owner: Anyone", "users") + sel("Sort: Expiry ↑", "sort") + "</div>" +
      FB([["Scope", "is any of", "Customer, Project"], ["Expires", "before", "Dec 31"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="panel" style="margin-top:0"><table>' + th(["Name", "Type", "Scope", "Username", "Secret", "Expires", "Owner", "Portal", "Last revealed", ""]) + "<tbody>" + R.map((r) => "<tr><td>" + ink(r[0]) + "</td><td>" + E(r[1]) + "</td><td>" + E(r[2]) + " " + muted(r[3]) + "</td><td>" + r[4] + "</td><td><span class='fl-wo'>" + I("lock", 12) + " " + r[5] + "</span></td><td>" + (r[6] === "Nov 14" || r[6] === "Nov 20" ? '<span class="badge yellow">' + r[6] + "</span>" : r[6]) + "</td><td>" + av(r[7]) + "</td><td>" + (r[8] ? I("globe", 14) : "—") + "</td><td>" + r[9] + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div>" +
      '<div class="pager"><span class="muted">1–6 of 38</span><span style="flex:1"></span>' + btn("Previous", "", "sm") + btn("Next", "", "sm") + "</div>" +
      dm(["VaultEntry · name, type, scope, company_id, project_id, username, url, secret_hint, file_name, expires_at, owner_membership_id, portal_visible, last_revealed_at, reveal_count, archived_at", "VaultEntryGrant · VaultKey · VaultAccessLog (last revealed)"], []) + "</div>";
  }

  /* =====================================================================================================================
     CREATE / EDIT VAULT ENTRY — full page (spec section 12)
     @screen Files / New credential
     @route  /files/vault/new?scope=&company=&project= · /files/vault/:entryId/edit
     @perm   documents.vault.manage* · customer/project scope needs read on that customer/project · portal_visible requires DocumentSettings.vault_portal_sharing_enabled
     @api    POST /vault/entries {scope, company_id?, project_id?, name, type, username, url, secret (write-only), notes, file (upload id, type FILE), expires_at, owner_membership_id, portal_visible, tags, grants[]} · PATCH /vault/entries/:id (secret only when a new value is typed) · POST /vault/entries/:id/rotate
     @mcp    documents_vault_create · documents_vault_update (secret accepted, never returned)
     @data   VaultEntry (scope, company_id, project_id, name, type, username, url, notes, secret_ciphertext (server only), vault_key_id, secret_hint, file_name/file_mimetype/file_size_bytes/file_storage_key, expires_at, owner_membership_id, portal_visible) · VaultEntryGrant (subject_type, membership_id, team_id, portal_user_id, can_reveal, can_manage, expires_at) · VaultKey (active)
     @ui     shadcn Form, password Input with generator and strength meter, Textarea, Popover+Command pickers, DatePicker, Switch, FileDrop for type FILE, Table of grants
     @states validation · saving · saved ("Secret stored encrypted; it cannot be shown again unless revealed") · edit mode shows a masked placeholder and "Replace secret" · permission error · portal sharing disabled by policy
     @audit  VaultAccessLog CREATE / UPDATE / ROTATE / GRANT / REVOKE and matching audit_events (secret value never logged)
     @note   Field-level secret: on save the server encrypts with the active VaultKey (envelope encryption) and stores secret_ciphertext plus a secret_hint (last 2 characters). The API never returns ciphertext or the secret outside the reveal endpoint.
             Leaving the secret blank on edit keeps the old one. Type NOTE stores the secret in the same encrypted field; type FILE stores an encrypted file in vault storage (file_* columns), not a Document.
     ===================================================================================================================== */
  function vaultnew() {
    return '<div class="a-page">' + head("New credential", "The secret is encrypted on save and can only be shown through an audited reveal.", btn("Cancel") + btn("Save credential", "lock", "primary")) +
      '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div>' +
      cd("<b>Credential</b>", f("Name", box("e.g. Acme hosting (cPanel)")) + f("Type", ser(["Password", "API key", "SSH key", "Note", "File"], 0)) + '<div class="g2"><div>' + f("Username", box("Optional")) + "</div><div>" + f("URL", box("https://…")) + "</div></div>" +
        f("Secret", '<div class="fl-secret"><span class="grow muted" style="letter-spacing:0">Type or generate a secret</span>' + btn("Generate", "sparkles", "sm") + "</div>", "Write-only. After saving it is never shown in forms or lists; only a hint (the last 2 characters) is kept.") +
        f("Notes", '<div class="editor"><div class="ed-body" style="min-height:70px">Recovery e-mail, 2FA location, rotation rules…</div></div>', "Notes are not encrypted separately; do not put secrets here.") + f("Expires", sel("No expiry", "calendar"), "Reminders go to the owner 30 and 7 days before (14).")) + sp +
      cd("<b>Scope</b>", f("Belongs to", ser(["Organization", "Customer", "Project"], 1)) + f("Customer", sel("Acme Corp", "building")) + f("Project (optional)", sel("Acme Rebrand Website", "folder")) + f("Owner", sel("Anna Meyer", "users")) + f("Tags", sel("Add tags…", "tag"))) + sp +
      cd("<b>Explicit access</b><span class='r'>" + btn("Add grant", "plus", "sm") + "</span>", tbl(["Subject", "Type", ">Reveal", ">Manage", "Expires", ""], [[wh("MS"), E("MEMBERSHIP"), cb(1), cb(0), "—", more], ["Dev team", E("TEAM"), cb(1), cb(0), "Dec 31", more]]).replace('class="panel" style="margin-top:0"', 'class="panel" style="margin:0;border:0"'), 1) +
      "</div><div>" +
      cd("<b>Customer portal</b>", '<div class="rowx"><div class="grow"><b>Visible to the customer</b><small>VaultEntry.portal_visible · needs a grant for a portal user</small></div>' + sw(0) + "</div>" + f("Portal user", sel("Lena Kovac (reveal)", "users")) + sub("Enabled in Settings (DocumentSettings.vault_portal_sharing_enabled).")) + sp +
      cd("<b>Encryption</b>", kv("Key", "VaultKey v3 " + E("ACTIVE", "green")) + kv("Algorithm", "AES-256-GCM envelope") + kv("Key material", "KMS, never in the database") + kv("Reveal re-authentication", "every 10 minutes")) + sp +
      callout("shield", "Vault entries cannot be pasted into Messaging or Support. Share a link instead; the recipient needs vault access to open it.") + sp +
      cd("<b>For type File</b>", '<div class="drop">' + I("clip", 16) + " Drop the file (encrypted, max 10 MB)</div>") + "</div></div>" +
      dm(["VaultEntry · every column in @data (secret_ciphertext and vault_key_id are server-side)", "VaultEntryGrant · subject_type, membership_id, team_id, portal_user_id, can_reveal, can_manage, expires_at", "VaultKey · status ACTIVE · DocumentSettings.vault_portal_sharing_enabled, vault_reveal_reauth_minutes"], []) + "</div>";
  }

  /* =====================================================================================================================
     VAULT ENTRY DETAIL — reveal and access log (spec section 12, 15)
     @screen Files / Vault entry
     @route  /files/vault/:entryId?tab=details|access|log
     @perm   VIEW documents.vault.read* · REVEAL / COPY documents.vault.reveal* (or a grant with can_reveal) · edit, rotate, grant documents.vault.manage* · access log documents.vault.manage*
     @api    GET /vault/entries/:id (metadata) · POST /vault/entries/:id/reveal {reason?} -> { secret } (short-lived, not cached) · POST /vault/entries/:id/copy · POST /vault/entries/:id/rotate · GET /vault/entries/:id/access-log · POST/DELETE /vault/entries/:id/grants
     @mcp    documents_vault_get · documents_vault_reveal (sensitive, human confirmation)
     @data   VaultEntry (all except ciphertext) · VaultEntryGrant · VaultAccessLog (action, actor_user_id, actor_membership_id, via_portal, ip_address, user_agent, context, created_at) · VaultKey
     @ui     Card, masked secret field with Reveal and Copy buttons (reveal auto-hides after 30 s), Tabs, Table, AlertDialog "Reveal this secret? The reveal is logged." with optional reason, re-auth Dialog when vault_reveal_reauth_minutes expired
     @states loading · masked · revealed (countdown) · re-auth required · reveal denied (403 and logged) · expired entry banner · archived
     @audit  VaultAccessLog VIEW on open, REVEAL, COPY, UPDATE, ROTATE, GRANT, REVOKE, DELETE + audit_events; revealing increments reveal_count and last_revealed_at; webhook vault.entry_revealed
     @note   The secret exists in the browser only between Reveal and the timeout; it is never in the page payload, never in the URL and never in logs. Copy uses the clipboard and writes a COPY log row. The log is append-only and cannot be edited.
     ===================================================================================================================== */
  function vaultentry() {
    const lg = [["REVEAL", "Anna Meyer", "Nov 10 14:02", "84.1.x.x · Chrome", "reason: DNS change for the launch"], ["COPY", "Marco Silva", "Nov 8 09:44", "84.1.x.x · Safari", ""], ["UPDATE", "Anna Meyer", "Nov 1 16:10", "84.1.x.x · Chrome", "username changed"], ["VIEW", "Kim Lund", "Oct 28 11:30", "84.7.x.x · Firefox", ""], ["GRANT", "Anna Meyer", "Oct 20 10:00", "84.1.x.x · Chrome", "Dev team, can_reveal"], ["CREATE", "Anna Meyer", "Oct 20 09:58", "84.1.x.x · Chrome", ""]];
    return '<div class="a-page">' + '<div class="a-head"><div><h1>Acme hosting (cPanel)</h1><p>Password · Customer: Acme Corp · owner Anna Meyer</p></div><div class="acts">' + btn("Rotate", "zap") + btn("Edit", "edit", "primary") + "</div></div>" +
      '<div class="rowx" style="gap:8px;padding:0 0 12px">' + E("PASSWORD") + E("CUSTOMER") + '<span class="badge yellow">Expires Dec 30</span><span class="muted">encrypted with VaultKey v3 · revealed 7 times</span></div>' +
      '<div class="tabset">' + tabs([["d", "Details"], ["a", "Access", 3], ["l", "Access log", 24]], "d") +
      pane("d", 1, '<div class="g2" style="align-items:start">' + cd("<b>Credential</b>", kv("Username", "acme-admin " + btn("Copy", "", "sm ghost")) + kv("URL", "https://acme.example/cpanel") + '<div class="fld"><label>Secret</label><div class="fl-secret"><span class="grow">••••••••••••••••</span>' + btn("Reveal", "key", "sm") + btn("Copy", "clip", "sm") + '</div><div class="sub-note">Write-only. Reveal and copy are logged. Hint: ends in x9.</div></div>' +
        '<div class="fld"><label>Revealed state (what you see after Reveal, auto-hides in 30 s)</label><div class="fl-secret rev"><span class="grow">Hx7!kQ-2m#pLw9vT</span>' + btn("Hide", "x", "sm") + '</div></div>' + kv("Notes", "Recovery to ops@studio.example. 2FA app held by Anna.") + kv("Tags", E("Hosting", "blue"))) +
        cd("<b>Metadata</b>", kv("Scope", E("CUSTOMER") + " Acme Corp") + kv("Project", "Acme Rebrand Website") + kv("Owner", wh("AM")) + kv("Created", "Oct 20 by Anna Meyer") + kv("Last rotated", "Oct 20") + kv("Last revealed", "Nov 10 by Anna Meyer") + kv("Reveal count", "7") + kv("Portal visible", sw(1)) + kv("Expires", "Dec 30"))
        + "</div>") +
      pane("a", 0, cd("<b>Grants</b><span class='r'>" + btn("Grant access", "plus", "sm") + "</span>", tbl(["Subject", "Type", ">Reveal", ">Manage", "Expires", "Granted by", ""], [[wh("MS"), E("MEMBERSHIP"), cb(1), cb(0), "—", "Anna Meyer", more], ["Dev team", E("TEAM"), cb(1), cb(0), "Dec 31", "Anna Meyer", more], ["Lena Kovac, Acme Corp", E("PORTAL_USER"), cb(1), cb(0), "Dec 30", "Anna Meyer", more]]).replace('class="panel" style="margin-top:0"', 'class="panel" style="margin:0;border:0"'), 1) + sub("Everyone with documents.vault.manage* can also reveal; grants extend access to people without that key.")) +
      pane("l", 0, cd("<b>Access log</b><span class='r'>" + btn("Export", "file", "sm") + "</span>", tbl(["Action", "Actor", "When", "IP and agent", "Context"], lg.map((r) => [E(r[0], r[0] === "REVEAL" ? "yellow" : ""), r[1], r[2], r[3], r[4] || "—"])).replace('class="panel" style="margin-top:0"', 'class="panel" style="margin:0;border:0"'), 1) + sub("Append-only (VaultAccessLog), mirrored to audit_events. Portal access is flagged via_portal.")) + "</div>" +
      dm(["VaultEntry · name, type, scope, company_id, project_id, username, url, notes, secret_hint, expires_at, owner_membership_id, portal_visible, last_rotated_at, last_revealed_at, reveal_count", "VaultEntryGrant · all columns · VaultAccessLog · action, actor_user_id, actor_membership_id, via_portal, ip_address, user_agent, context, created_at · VaultKey"], []) + "</div>";
  }

  /* =====================================================================================================================
     SIGNATURES — overview of in-house e-signature requests (module 04, shown here because signed artifacts are documents)
     @screen Files / Signatures
     @route  /files/signatures?status=&subject=&expiring=
     @perm   VIEW contracts.contracts.read (requests belong to contracts and proposals) + documents.documents.read for the artifact · send/resend contracts.signatures.send* · cancel contracts.signatures.cancel* · download signed file and audit certificate documents.documents.read
     @api    GET /signature-requests?status=&subject_type=&cursor= · GET /signature-requests/:id (signers, events) · POST /signature-requests/:id/remind · POST /signature-requests/:id/cancel {reason}
     @mcp    contracts_signatures_list · contracts_signatures_send · contracts_signatures_cancel (owned by 04)
     @data   SignatureRequest (subject_type, contract_id, contract_version_id, proposal_version_id, status, signing_order, package_documents Json [{document_id, title, sort_order}], reminders_sent, signed_document_id, audit_certificate_document_id, signed_hash,
             sent_at, expires_at, completed_at, cancelled_at, cancel_reason) · Signer (name, email, title, order, status, viewed_at, signed_at, declined_at) · Document (signed artifact and audit certificate)
     @ui     Tabs, Table with filter bar, Badge, Progress for signers, Sheet with signer timeline, DropdownMenu (Remind, Cancel)
     @states loading · empty · error · no-access (contracts key missing hides the section) · expired · partially signed
     @audit  owned by 04 (SignatureEvent); this screen only reads. Downloading the signed artifact is audited here (sensitive category Contract)
     @note   Signing is built in-house: no e-signature provider. Requests are created from a contract or proposal version in 04; this list is a read-only overview with links into 04. The signed artifact and the audit certificate are ordinary Documents in a system folder
             and their version is LOCKED by CONTRACTS (is_locked) so nobody can replace them. Statuses are SignatureRequestStatus (NOT_SENT, SENT, DELIVERED, VIEWED, PARTIALLY_SIGNED, FULLY_SIGNED, DECLINED, EXPIRED, CANCELLED, FAILED).
     ===================================================================================================================== */
  function signatures() {
    const SS = { FULLY_SIGNED: "green", PARTIALLY_SIGNED: "yellow", VIEWED: "blue", SENT: "blue", DECLINED: "red", EXPIRED: "", CANCELLED: "", FAILED: "red", DELIVERED: "blue" };
    const R = [["MSA, Acme Corp", "CONTRACT_VERSION", "PARALLEL", "FULLY_SIGNED", "2 / 2", "Oct 28", "—", 1], ["Proposal PRO-2026-018, Acme redesign", "PROPOSAL_VERSION", "SEQUENTIAL", "PARTIALLY_SIGNED", "1 / 2", "—", "Nov 17", 0], ["NDA, Northwind Ltd", "CONTRACT_VERSION", "SEQUENTIAL", "VIEWED", "0 / 2", "—", "Nov 20", 0], ["SOW 3, Mobile App v2", "CONTRACT_VERSION", "PARALLEL", "DECLINED", "1 / 3", "—", "—", 0], ["Retainer renewal, Delta Studio", "CONTRACT_VERSION", "SEQUENTIAL", "EXPIRED", "0 / 1", "—", "Oct 30", 0]];
    return '<div class="a-page">' + head("Signatures", "In-house e-signature requests across contracts and proposals.", btn("Open Contracts", "pen")) +
      '<div class="mini-stats">' + stat("Waiting for signers", 6, "SENT · DELIVERED · VIEWED · PARTIALLY_SIGNED") + stat("Expiring in 7 days", 2, "expires_at", 1) + stat("Signed this month", 9, "FULLY_SIGNED") + stat("Declined", 1, "DECLINED", 1) + "</div>" +
      '<div class="toolbar">' + search("Search contract, proposal, signer e-mail") + sel("Status: Any", "filter") + sel("Subject: Any", "file") + sel("Sort: Sent ↓", "sort") + "</div>" +
      FB([["Status", "is any of", "Sent, Viewed, Partially signed"], ["Expires", "before", "Dec 1"]], btn("Clear", "", "sm ghost")) +
      '<div class="panel" style="margin-top:0"><table>' + th(["Subject", "Type", "Order", "Status", "Signed", "Completed", "Expires", "Signed document", ""]) + "<tbody>" + R.map((r) => "<tr><td>" + ink(r[0]) + "</td><td>" + E(r[1]) + "</td><td>" + E(r[2]) + "</td><td>" + E(r[3], SS[r[3]]) + "</td><td>" + r[4] + "</td><td>" + r[5] + "</td><td>" + r[6] + "</td><td>" + (r[7] ? '<span class="fl-name">' + ficon("PDF") + "<b>msa-acme-signed.pdf</b></span> " + I("key", 13) : "—") + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div>" +
      sp + cd("<b>Selected: Proposal PRO-2026-018</b><span class='r'>" + btn("Remind", "bell", "sm") + btn("Cancel request", "x", "sm") + "</span>", row("Marco Silva (agency)", "order 1 · signed Nov 10 14:02", E("SIGNED", "green")) + row("Lena Kovac, lena.kovac@acme.com", "order 2 · viewed Nov 11 08:20 · reminder 1 of 3 sent", E("VIEWED", "blue")) + row("Package", "Proposal PDF v2 · Terms of service v5 (locked order, package_documents)", ""), 1) +
      dm(["SignatureRequest · subject_type, status, signing_order, package_documents, reminders_sent, signed_document_id, audit_certificate_document_id, signed_hash, sent_at, expires_at, completed_at, cancelled_at, cancel_reason", "Signer · name, email, order, status, viewed_at, signed_at, declined_at · Document · DocumentVersion.is_locked, locked_by_module"], []) + "</div>";
  }

  /* =====================================================================================================================
     DOCUMENT APPROVALS (spec section 10)
     @screen Files / Approvals
     @route  /files/approvals?tab=mine|requested|all&status= · /files/approvals/new?document=
     @perm   VIEW documents.documents.read · decide (as approver) documents.documents.approve · request documents.documents.approve · portal approvers decide with portal.deliverables.approve (07)
     @api    GET /document-approvals?mine=&status= · POST /document-approvals {document_id, version_id, approver_ids, require_all, due_at, message} · POST /document-approvals/:id/decision {decision, comment} · POST /document-approvals/:id/cancel · POST /document-approvals/:id/remind
     @mcp    documents_approvals_list · documents_approvals_request · documents_approvals_decide
     @data   DocumentApproval (document_id, version_id, title, message, status, require_all, due_at, requested_by_membership_id, outcome_comment, completed_at, cancelled_at, last_reminded_at) · DocumentApprover (kind, membership_id, portal_user_id, sort_order, decision, comment, decided_at, notified_at) · Document (approval_status, approved_version_id, approved_at)
     @ui     Tabs, Table, Dialog (Approve / Request changes / Reject with a required comment), Popover+Command approver picker, DatePicker
     @states loading · empty ("Nothing waiting for you") · error · version superseded notice · overdue highlighted
     @audit  approval requested, decision per approver, outcome, cancelled, reminded
     @note   An approval is bound to ONE version; uploading v4 does not change the decision on v3, and Document.approved_version_id keeps pointing at the approved one. With require_all every approver must APPROVE; any REJECTED or CHANGES_REQUESTED ends the request.
             Contract signing stays in 04; deliverable acceptance criteria in 05. Portal approvers appear as PORTAL_USER and the item shows in the customer portal as a pending approval.
     ===================================================================================================================== */
  function approvals() {
    const R = [["Acme Rebrand, Design Specification", "v3", "Anna Meyer", "Marco Silva, Lena Kovac", "PENDING", "Nov 14", "1 / 2"], ["Employee handbook 2027", "v6", "Sofia Jensen", "Jonas Koch", "CHANGES_REQUESTED", "Nov 8", "0 / 1"], ["Brand guidelines 2026", "v4", "Anna Meyer", "Sofia Jensen", "APPROVED", "Nov 2", "1 / 1"], ["Mobile onboarding flows", "v2", "Marco Silva", "Lena Kovac", "REJECTED", "Oct 30", "0 / 1"]];
    return '<div class="a-page">' + head("Approvals", "Document sign-off bound to an exact version.", btn("Request approval", "plus", "primary")) +
      '<div class="tabset">' + tabs([["m", "Waiting for me", 2], ["r", "I requested", 3], ["a", "All", 14]], "m") +
      pane("m", 1, '<div class="toolbar">' + search("Search document") + sel("Status: Pending", "filter") + sel("Due: Any", "calendar") + "</div>" +
        tbl(["Document", "Version", "Requested by", "Approvers", "Status", "Decisions", "Due", ""], R.map((r) => [ink(r[0]), r[1], r[2], r[3], E(r[4], AP[r[4]]), r[6], r[5], btn("Review", "", "sm")]))) +
      pane("r", 0, tbl(["Document", "Version", "Status", "Due", ""], R.slice(0, 3).map((r) => [ink(r[0]), r[1], E(r[4], AP[r[4]]), r[5], more]))) +
      pane("a", 0, tbl(["Document", "Version", "Requested by", "Status", "Completed", ""], R.map((r) => [ink(r[0]), r[1], r[2], E(r[4], AP[r[4]]), r[4] === "PENDING" ? "—" : r[5], more]))) + "</div>" +
      sp + cd("<b>Review: Acme Rebrand, Design Specification v3</b><span class='r'>due Nov 14</span>", '<div class="g2"><div>' + row("Message", "“Please check typography and the dark mode tokens.”") + row("Marco Silva", "MEMBERSHIP · approved Nov 10 · “Looks good.”", E("APPROVED", "green")) + row("Lena Kovac, Acme Corp", "PORTAL_USER · notified Nov 10", E("PENDING", "yellow")) + '</div><div class="fld"><label>Your decision (comment required for reject and changes)</label><div class="editor"><div class="ed-body" style="min-height:70px">Add a comment…</div></div><div class="rowx" style="padding:8px 0 0">' + btn("Approve", "check", "primary") + btn("Request changes", "edit") + btn("Reject", "x") + "</div></div></div>") +
      dm(["DocumentApproval · document_id, version_id, title, message, status, require_all, due_at, requested_by_membership_id, outcome_comment, completed_at", "DocumentApprover · kind, membership_id, portal_user_id, decision, comment, decided_at · Document.approval_status, approved_version_id"], []) + "</div>";
  }

  /* =====================================================================================================================
     RETENTION & LEGAL HOLD (spec section 13)
     @screen Files / Retention and holds
     @route  /files/retention?tab=policies|holds|requests · /files/retention/policies/new
     @perm   VIEW + manage documents.retention.manage* · approve permanent deletion documents.deletions.approve* (a different person than the requester) · set legal hold on one document documents.retention.manage*
     @api    GET/POST /retention-policies · PATCH /retention-policies/:id · POST /documents/:id/legal-hold {reason} · DELETE /documents/:id/legal-hold · GET /deletion-requests?status= · POST /deletion-requests/:id/approve|reject|execute
     @mcp    documents_retention_policies_list · documents_legal_hold_set · documents_deletions_approve (sensitive)
     @data   DocumentRetentionPolicy (name, description, category_id, scope, retain_days, anchor, action, enforced_by_module, is_active, is_default, archived_at) · DocumentCategory.default_retention_policy_id · Document (retention_policy_id, retention_expires_at, legal_hold, legal_hold_reason, legal_hold_set_by_user_id, legal_hold_set_at, purge_scheduled_at) ·
             DocumentDeletionRequest (document_id, document_title, kind, status, reason, requested_by_user_id, approved_by_user_id, approved_at, rejected_reason, purged_storage_keys, executed_at)
     @ui     Tabs, Table, Dialog policy editor (Select anchor and action, number input days), AlertDialog for legal hold with a required reason, Badge
     @states loading · empty · error · no-access · policy in use warning
     @audit  policy created/changed (before and after), legal hold set/released (reason), deletion requested/approved/rejected/executed, retention run summary
     @note   Policy = category and/or scope + retain_days from an anchor (CREATED, LAST_MODIFIED, ARCHIVED, RECORD_CLOSED) then an action (ARCHIVE, SOFT_DELETE, PERMANENT_DELETE). enforced_by_module marks policies owned by another module (04 contract retention is enforced here
             and read-only in this list). LEGAL HOLD beats every policy: while Document.legal_hold is true, soft delete, permanent delete, retention action and purge are all refused. Permanent deletion always needs an approved DocumentDeletionRequest and writes purged_storage_keys.
     ===================================================================================================================== */
  function retention() {
    const P = [["Contract records", "Contract", "—", "2555", "RECORD_CLOSED", "ARCHIVE", "CONTRACTS", 1], ["Project records", "—", "PROJECT", "2555", "RECORD_CLOSED", "ARCHIVE", "", 1], ["Invoices and receipts", "Invoice", "—", "3650", "CREATED", "ARCHIVE", "", 1], ["HR documents", "HR document", "EMPLOYEE", "1825", "ARCHIVED", "PERMANENT_DELETE", "", 1], ["Temporary uploads", "Other", "—", "180", "LAST_MODIFIED", "SOFT_DELETE", "", 0]];
    return '<div class="a-page">' + head("Retention and holds", "Policies, legal holds and restricted deletions.", btn("New policy", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Active policies", 4, "is_active") + stat("Legal holds", 3, "Document.legal_hold", 1) + stat("Pending deletions", 2, "REQUESTED", 1) + stat("Expiring next 30 days", 17, "retention_expires_at") + "</div>" +
      '<div class="tabset">' + tabs([["p", "Policies", 5], ["h", "Legal holds", 3], ["r", "Deletion requests", 4]], "p") +
      pane("p", 1, tbl(["Policy", "Category", "Scope", ">Retain days", "Anchor", "Action", "Enforced by", "Active", ""], P.map((r) => [ink(r[0]), r[1], r[2] ? E(r[2]) : "—", r[3], E(r[4]), E(r[5], r[5] === "PERMANENT_DELETE" ? "red" : ""), r[6] ? E(r[6]) : "—", sw(r[7]), more])) + sp +
        cd("<b>Policy editor: Temporary uploads</b><span class='r'>" + btn("Save", "check", "sm primary") + "</span>", '<div class="g3">' + f("Name", box("Temporary uploads")) + f("Category", sel("Other", "tag")) + f("Scope", sel("Any scope", "layers")) + f("Retain for (days)", box("180")) + f("Counted from", sel("Last modified")) + f("Then", sel("Soft delete")) + "</div>" + sub("Applies to documents created after saving and, on request, to existing ones (a dry run lists them first). Contract policies are enforced by 04 and cannot be edited here.")) ) +
      pane("h", 0, cd("<b>Documents on legal hold</b><span class='r'>" + btn("Place hold", "lock", "sm") + "</span>", tbl(["Document", "Reason", "Set by", "Since", "Retention", ""], [[ink("MSA, Acme Corp (signed)"), "Dispute with Acme, case 2026-114", "Sofia Jensen", "Oct 30", "blocked", btn("Release", "", "sm")], [ink("Offer letter, K. Lund"), "HR investigation", "Sofia Jensen", "Sep 14", "blocked", btn("Release", "", "sm")], [ink("Invoice INV-1988, Delta Studio"), "Tax audit", "Jonas Koch", "Aug 2", "blocked", btn("Release", "", "sm")]]).replace('class="panel" style="margin-top:0"', 'class="panel" style="margin:0;border:0"'), 1) + sub("While on hold, soft delete, permanent delete and retention actions are refused for the document and for all its versions.")) +
      pane("r", 0, tbl(["Document", "Kind", "Requested by", "Reason", "Status", "Approved by", ""], [[ink("Old brand assets 2019"), E("PERMANENT"), "Anna Meyer", "Customer request to erase", E("REQUESTED", "yellow"), "—", btn("Approve", "", "sm") + btn("Reject", "", "sm")], [ink("Analytics export October"), E("SOFT"), "Jonas Koch", "Quarantined file", E("EXECUTED", "green"), "—", more], [ink("Test uploads"), E("RETENTION"), "System", "Policy Temporary uploads", E("REQUESTED", "yellow"), "—", btn("Approve", "", "sm")], [ink("Draft proposal v1"), E("PERMANENT"), "Marco Silva", "Duplicate", E("REJECTED", "red"), "Sofia Jensen", more]])) + "</div>" +
      dm(["DocumentRetentionPolicy · all columns in @data", "Document · retention_policy_id, retention_expires_at, legal_hold, legal_hold_reason, legal_hold_set_by_user_id, legal_hold_set_at, purge_scheduled_at", "DocumentDeletionRequest · kind, status, reason, requested_by_user_id, approved_by_user_id, rejected_reason, purged_storage_keys, executed_at"], []) + "</div>";
  }

  /* =====================================================================================================================
     TRASH (spec section 13)
     @screen Files / Trash
     @route  /files/trash?type=documents|folders|vault
     @perm   VIEW documents.documents.read (own deletions) · restore documents.documents.update · delete permanently documents.documents.delete* + an approved DocumentDeletionRequest (documents.deletions.approve*) · vault entries documents.vault.manage*
     @api    GET /documents?status=DELETED · POST /documents/:id/restore · POST /deletion-requests {document_id, kind: PERMANENT, reason} · POST /documents/bulk {action: restore}
     @mcp    documents_documents_restore · documents_deletions_request
     @data   Document (status DELETED, deleted_at, deleted_by_user_id, purge_scheduled_at, legal_hold) · Folder (deleted_at) · VaultEntry (deleted_at) · DocumentSettings.soft_delete_recovery_days · DocumentDeletionRequest
     @ui     Table with bulk bar, AlertDialog for permanent delete (requires reason, creates a request), Badge countdown
     @states loading · empty ("Trash is empty") · error · legal hold blocks "Delete permanently" (disabled with reason)
     @audit  document deleted (soft), restored, permanent deletion requested/approved/executed
     @note   Soft delete sets status DELETED, deleted_at and purge_scheduled_at = deleted_at + soft_delete_recovery_days (30). Nothing is removed from storage until purge. Files held by legal hold or with a locked version never reach the trash.
             "Delete permanently" does not delete: it opens a DocumentDeletionRequest of kind PERMANENT that another person approves.
     ===================================================================================================================== */
  function trash() {
    const R = [["Old brand assets 2019", "brand-2019.zip", "ARCHIVE", "Organization", "Anna Meyer", "Nov 5", "24 days", "REQUESTED"], ["Draft proposal v1", "proposal-v1.docx", "DOCUMENT", "Acme Corp", "Marco Silva", "Nov 3", "22 days", ""], ["Screenshot 2026-10-31", "screen.png", "IMAGE", "Mobile App v2", "Kim Lund", "Nov 1", "20 days", ""], ["Meeting recording (duplicate)", "demo-copy.mp4", "VIDEO", "Mobile App v2", "Kim Lund", "Oct 22", "11 days", ""]];
    return '<div class="a-page">' + head("Trash", "Deleted items stay recoverable for 30 days.", btn("Empty my trash", "x")) +
      callout("clock", "Items are removed from storage 30 days after deletion (DocumentSettings.soft_delete_recovery_days). Permanent deletion needs approval from a second person.") + sp +
      '<div class="tabset">' + tabs([["d", "Documents", 4], ["f", "Folders", 1], ["v", "Vault entries", 1]], "d") +
      pane("d", 1, '<div class="toolbar">' + search("Search deleted documents") + sel("Deleted by: Anyone", "users") + sel("Sort: Deleted ↓", "sort") + "</div>" +
        '<div class="bulk"><span class="cb on"></span><b>2 selected</b><span style="flex:1"></span>' + btn("Restore", "zap", "sm") + btn("Delete permanently", "x", "sm") + "</div>" +
        '<div class="panel" style="margin-top:0"><table>' + th(["", "Name", "Context", "Deleted by", "Deleted", "Purge in", "Status", ""]) + "<tbody>" + R.map((r, i) => "<tr><td>" + cb(i < 2) + "</td><td>" + dcell({ ty: r[2], t: r[0], fn: r[1] }) + "</td><td>" + r[3] + "</td><td>" + r[4] + "</td><td>" + r[5] + "</td><td>" + r[6] + "</td><td>" + (r[7] ? E("Deletion " + r[7].toLowerCase(), "yellow") : E("DELETED", "red")) + "</td><td>" + btn("Restore", "", "sm") + "</td></tr>").join("") + "</tbody></table></div>") +
      pane("f", 0, tbl(["Folder", "Context", "Contains", "Deleted", ""], [[ink("Old mockups"), "Acme Rebrand Website", "12 documents", "Nov 4", btn("Restore", "", "sm")]])) +
      pane("v", 0, tbl(["Entry", "Scope", "Deleted by", "Deleted", ""], [[ink("Old staging login"), E("PROJECT"), "Marco Silva", "Nov 2", btn("Restore", "", "sm")]])) + "</div>" +
      dm(["Document · status DELETED, deleted_at, deleted_by_user_id, purge_scheduled_at, legal_hold", "Folder.deleted_at · VaultEntry.deleted_at · DocumentSettings.soft_delete_recovery_days", "DocumentDeletionRequest · kind PERMANENT, status"], []) + "</div>";
  }

  /* =====================================================================================================================
     STORAGE USAGE & QUOTAS
     @screen Files / Storage
     @route  /files/storage?by=type|scope|category|owner
     @perm   VIEW documents.storage.manage* (usage and cleanup suggestions) · quota is read-only here (plan, set in Admin billing: organizations.billing.manage)
     @api    GET /documents/storage-usage?group_by= · GET /documents/storage-usage/largest?limit= · POST /documents/bulk {action: archive|delete}
     @mcp    documents_storage_usage
     @data   Document (size, type, scope, category_id, owner_membership_id, status) · DocumentVersion (size_bytes, storage_provider = PLATFORM) · DocumentSettings (default_storage_provider = PLATFORM, max_file_size_bytes)
     @ui     Quota bar (stacked Progress), Tabs, Table of largest files with checkboxes, Alert at 80 and 95 percent
     @states loading · error · quota near limit warning · no-access
     @audit  none for reads; cleanup actions are audited as documents are
     @note   Storage is the platform bucket only; there is no provider configuration. Usage is the sum of DocumentVersion.size_bytes for AVAILABLE versions (old versions count). Numbers are computed, never stored by hand.
     @gap    The schema has no quota or plan limit column (no storage_quota_bytes on Organization or DocumentSettings), so the 100 GB limit below is not backed. Documented in gaps-17.md.
     ===================================================================================================================== */
  function storage() {
    return '<div class="a-page">' + head("Storage", "How much space documents use on the platform bucket.", btn("Clean up suggestions", "sparkles")) +
      '<div class="g2" style="grid-template-columns:1.6fr 1fr;align-items:start"><div>' +
      cd("<b>Usage</b><span class='r muted'>PLATFORM bucket</span>", '<div style="font-size:26px;font-weight:600;color:var(--ink)">62.4 GB <span class="muted" style="font-size:14px;font-weight:400">of 100 GB</span></div><div class="fl-quota" style="margin:10px 0"><i class="fl-q1" style="width:28%"></i><i class="fl-q2" style="width:17%"></i><i class="fl-q3" style="width:9%"></i><i class="fl-q4" style="width:6%"></i><i class="fl-q5" style="width:2.4%"></i></div>' +
        '<div class="rowx" style="gap:16px;padding:0;flex-wrap:wrap"><span><i class="fl-dot fl-q1"></i>Video 28 GB</span><span><i class="fl-dot fl-q2"></i>Presentations and design 17 GB</span><span><i class="fl-dot fl-q3"></i>Archives 9 GB</span><span><i class="fl-dot fl-q4"></i>PDF 6 GB</span><span><i class="fl-dot fl-q5"></i>Other 2.4 GB</span></div>') + sp +
      cd("<b>Largest files</b><span class='r'>" + btn("Archive selected", "box", "sm") + "</span>", tbl(["", "Name", "Context", ">Size", ">Versions", "Updated"], [[cb(0), dcell(D[6]), "Mobile App v2", "221 MB", "1", "Nov 7"], [cb(0), dcell(D[9]), "Data Warehouse Setup", "58 MB", "1", "Nov 3"], [cb(0), dcell(D[4]), "Organization", "73 MB (4 versions)", "4", "Nov 2"], [cb(0), dcell({ ty: "VIDEO", t: "Kickoff recording Acme", fn: "kickoff.mp4" }), "Acme Corp", "190 MB", "1", "Sep 12"]]).replace('class="panel" style="margin-top:0"', 'class="panel" style="margin:0;border:0"'), 1) +
      "</div><div>" +
      cd("<b>By scope</b>", [["Projects", 63, "39 GB"], ["Customers", 24, "15 GB"], ["Organization", 12, "7 GB"], ["Employees", 3, "1.4 GB"]].map((r) => row(r[0], "", bar(r[1]) + " " + r[2])).join(""), 1) + sp +
      cd("<b>Storage</b>", kv("Provider", E("PLATFORM")) + kv("Encryption at rest", "yes, per organization") + kv("Region", "EU (set by the platform)") + kv("Quota", "100 GB " + muted("plan"))) + sp +
      callout("zap", "At 80 percent the owner is notified; at 95 percent uploads from the portal are paused. Archived documents still count.") + "</div></div>" +
      dm(["Document · size, type, scope, category_id, owner_membership_id, status", "DocumentVersion · size_bytes, storage_provider", "DocumentSettings · default_storage_provider PLATFORM, max_file_size_bytes"], ["Storage quota / plan limit has no column (gap)"]) + "</div>";
  }

  /* =====================================================================================================================
     SEARCH (spec section 11)
     @screen Files / Search
     @route  /files/search?q=&type=&category=&scope=&owner=&tag=&from=&to=&record=<RecordEntityType>:<id>
     @perm   documents.documents.read (results are permission-filtered in the query; EMPLOYEE and sensitive items need their extra key)
     @api    GET /documents/search?q=&filters=&cursor= · feeds GET /search (global search, Product Specification section 4)
     @mcp    documents_documents_search
     @data   Document.search_vector (tsvector over title, filename, keywords, search_text) · DocumentVersion.extracted_text (when DocumentSettings.full_text_extraction_enabled) · Document (category_id, scope, owner_membership_id, keywords, entity_type, entity_id, created_at) · taggings · custom_field_definitions
     @ui     Search Input with scope chips, filter bar, result list with highlighted snippet, Tabs (All, Documents, Folders)
     @states loading · empty ("No documents match") · error · "content search is off" hint when extraction is disabled
     @audit  none (search is not audited); opening a sensitive result is
     @note   Matching is permission-aware in SQL, never post-filtered, so counts never leak hidden documents. Content hits come from extracted_text of the CURRENT version only.
     ===================================================================================================================== */
  function searchp() {
    const R = [["Acme Rebrand, Design Specification", "…typography uses <mark>Inter</mark> 15 for body copy and the spacing scale 4 / 8 / 12 / 16…", "page 7", "PDF", "Specification"], ["Brand guidelines 2026", "…primary typeface <mark>Inter</mark>, headings in Inter Display…", "slide 12", "PRESENTATION", "Design"], ["Employee handbook", "…company laptops use the <mark>Inter</mark>nal asset tag…", "page 3", "DOCUMENT", "Policy"]];
    return '<div class="a-page">' + head("Search files", "Titles, file names and document content.", "") +
      '<div class="toolbar">' + search("inter typography") + sel("Scope: All", "layers") + sel("Type: Any", "file") + sel("Category: Any", "tag") + sel("Owner: Anyone", "users") + sel("Updated: Any time", "calendar") + "</div>" +
      FB([["Linked to", "is", "Project: Acme Rebrand Website"], ["Tag", "is", "Brand"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="tabset">' + tabs([["a", "All", 5], ["d", "Documents", 3], ["f", "Folders", 2]], "a") + pane("a", 1, "") + "</div>" +
      '<div class="panel" style="margin-top:0">' + R.map((r) => '<div class="rowx" style="align-items:flex-start">' + ficon(r[3]) + '<div class="grow"><b>' + r[0] + "</b><small>" + r[4] + " · " + r[2] + "</small><div class='muted' style='margin-top:4px'>" + r[1] + "</div></div>" + more + "</div>").join("") + "</div>" +
      sub("Folders matching “inter”: Design / Typography (14 files) · Brand assets / Fonts (6 files)") +
      dm(["Document.search_vector · title, filename, keywords, search_text", "DocumentVersion.extracted_text (current version) · DocumentSettings.full_text_extraction_enabled", "taggings · custom_field_definitions (filters)"], []) + "</div>";
  }

  /* =====================================================================================================================
     DOCUMENT TEMPLATES
     @screen Files / Document templates
     @route  /files/templates · /files/templates/new · /files/templates/:id
     @perm   VIEW documents.documents.read · create from template documents.documents.create · manage templates documents.categories.manage (closest existing key)
     @api    GET /document-templates · POST /document-templates · POST /document-templates/:id/generate {variables, folder_id}
     @mcp    documents_templates_list · documents_templates_generate
     @data   NONE in module 17: the schema has no document template table. Proposal templates (03) and contract templates (04) have their own tables; generated PDFs are stored as Document with source GENERATED.
     @ui     Card grid, Dialog (variables form), Table, Tabs (Mine, Library)
     @states loading · empty · error · no-access
     @audit  template created/changed, document generated from a template (source GENERATED)
     @note   MOCKUP ONLY until the gap is closed. Today the closest real behaviour is: pick a template in 03/04 and the generated PDF lands here as a Document (DocumentSource GENERATED). A neutral "template" for letters, NDAs and checklists needs its own model.
     @gap    No DocumentTemplate model (name, description, category_id, folder_id, source version, variables Json, scope, archived_at) and no keys (documents.templates.read / manage). Documented in gaps-17.md.
     ===================================================================================================================== */
  function templates() {
    const T = [["Meeting notes", "DOCUMENT", "4 variables"], ["Project brief", "DOCUMENT", "9 variables"], ["Statement of work", "DOCUMENT", "12 variables"], ["Invoice cover letter", "DOCUMENT", "5 variables"], ["Weekly status report", "SPREADSHEET", "3 variables"], ["Onboarding checklist", "DOCUMENT", "6 variables"]];
    return '<div class="a-page">' + head("Document templates", "Start a new document from a prepared one.", btn("New template", "plus", "primary")) +
      callout("sparkles", "This screen is not backed by the schema yet (see gaps-17.md). Generated PDFs from Proposals and Contracts already arrive in Files with source GENERATED.", "") + sp +
      '<div class="toolbar">' + search("Search templates") + sel("Category: Any", "tag") + sel("Scope: Any", "layers") + "</div>" +
      '<div class="fl-grid">' + T.map((t) => '<div class="fl-card"><div class="fl-thumb">' + I(TI[t[1]], 34) + '<span class="ext">TEMPLATE</span></div><div class="fl-meta"><b>' + t[0] + "</b><small>" + t[2] + "</small><div style='margin-top:8px'>" + btn("Use template", "plus", "sm") + "</div></div></div>").join("") + "</div>" +
      sp + cd("<b>Use template: Project brief</b>", '<div class="g3">' + f("Document title", box("Brief, Acme Rebrand Website")) + f("Customer", sel("Acme Corp", "building")) + f("Project", sel("Acme Rebrand Website", "folder")) + f("Folder", sel("Briefs", "folder")) + f("Owner", sel("Anna Meyer", "users")) + f("Category", sel("Specification", "tag")) + "</div>" + sub("Variables are filled from the customer and project; the result is a normal Document with version 1.")) +
      dm(["Document · source GENERATED (existing)", "Folder · category defaults"], ["DocumentTemplate model and documents.templates.* keys do not exist (gap)"]) + "</div>";
  }

  /* =====================================================================================================================
     SETTINGS (spec sections 4, 5, 8, 9, 12, 13)
     @screen Files / Settings
     @route  /files/settings?tab=limits|sharing|vault|categories
     @perm   VIEW + edit documents.retention.manage* (limits, signed URLs, soft delete) · sharing and vault toggles documents.storage.manage* · categories documents.categories.manage · folder depth documents.folders.manage
     @api    GET/PATCH /document-settings · GET/POST/PATCH /document-categories · POST /document-categories/:id/archive
     @mcp    documents_settings_get · documents_settings_update · documents_categories_manage
     @data   DocumentSettings (max_file_size_bytes, allowed_mime_types, blocked_extensions, virus_scan_required, folder_max_depth, public_links_enabled, public_link_max_days, default_share_expiry_days, watermark_customer_documents, signed_url_ttl_seconds,
             soft_delete_recovery_days, portal_upload_enabled, vault_portal_sharing_enabled, vault_reveal_reauth_minutes, full_text_extraction_enabled, default_storage_provider) · DocumentCategory (name, slug, description, icon, color, is_system, is_sensitive, customer_visible_default, default_retention_policy_id, sort_order, archived_at)
     @ui     Tabs, shadcn Form with Switch, Select, number Input, TagInput for mime types and extensions, Table for categories, Dialog category editor
     @states loading · saving per control (optimistic with rollback) · validation · error · no-access
     @audit  every settings change (before and after), category created/changed/archived
     @note   One DocumentSettings row per organization. Provider is fixed to PLATFORM in this app. Lowering max_file_size_bytes never affects existing files. System categories (is_system) cannot be deleted, only renamed and archived is blocked.
             Turning public_links_enabled off expires nothing automatically but blocks creation and opening (existing links answer 404).
     ===================================================================================================================== */
  function settings() {
    const tg = (t, s, on) => '<div class="rowx"><div class="grow"><b>' + t + "</b><small>" + s + "</small></div>" + sw(on) + "</div>";
    const C = [["Contract", "Contracts", 0, 0, "Contract records", 1], ["Proposal", "Proposals", 0, 1, "Project records", 1], ["Deliverable", "Deliverables", 0, 1, "Project records", 1], ["Design", "Design", 0, 1, "—", 1], ["Specification", "Specifications", 0, 1, "Project records", 1], ["Invoice", "Invoices", 0, 1, "Invoices and receipts", 1], ["Receipt", "Receipts", 0, 0, "Invoices and receipts", 1], ["HR document", "HR", 1, 0, "HR documents", 1], ["Policy", "Policies", 0, 0, "—", 1], ["Other", "Other", 0, 0, "—", 1]];
    return '<div class="a-page">' + head("Files settings", "Limits, sharing policy, vault and categories for the whole organization.", btn("Save changes", "check", "primary")) +
      '<div class="tabset">' + tabs([["l", "Uploads and limits"], ["s", "Sharing and access"], ["v", "Vault"], ["c", "Categories", 10]], "l") +
      pane("l", 1, '<div class="g2" style="align-items:start">' + cd("<b>Uploads</b>", f("Maximum file size", box("2 GB"), "max_file_size_bytes") + f("Allowed file types", box("pdf, png, jpg, docx, xlsx, pptx, mp4, zip … (any if empty)"), "allowed_mime_types") + f("Blocked extensions", box(".exe .bat .scr .js .vbs"), "blocked_extensions") + tg("Scan every file for malware", "Files are unavailable until the scan is CLEAN", 1) + tg("Customers may upload from the portal", "Only into folders with portal uploads allowed", 1) + tg("Extract text for content search", "PDF, Office and text files", 1)) +
        cd("<b>Folders and deletion</b>", f("Maximum folder depth", box("6")) + f("Recovery window after delete (days)", box("30"), "soft_delete_recovery_days") + f("Storage", sel("Platform bucket (PLATFORM)", "box"), "Fixed. Provider configuration is not part of this app.") + f("Signed URL lifetime (seconds)", box("600"), "signed_url_ttl_seconds: every preview and download uses a fresh signed URL.")) + "</div>") +
      pane("s", 0, '<div class="g2" style="align-items:start">' + cd("<b>Public links</b>", tg("Allow public links", "public_links_enabled", 1) + f("Longest link lifetime (days)", box("90")) + f("Default expiry for new shares (days)", box("14")) + tg("Watermark customer-facing documents", "watermark_customer_documents", 1)) + cd("<b>Customer portal</b>", tg("New documents visible to customers by default", "Per category: customer_visible_default", 0) + tg("Customers can upload", "portal_upload_enabled", 1) + sub("Folder level overrides: Folder.customer_visible and Folder.portal_upload_allowed.")) + "</div>") +
      pane("v", 0, '<div class="g2" style="align-items:start">' + cd("<b>Vault</b>", tg("Share entries with the customer portal", "vault_portal_sharing_enabled", 0) + f("Re-authenticate before reveal (minutes)", box("10"), "vault_reveal_reauth_minutes. Empty = never ask again in a session.")) + cd("<b>Encryption key</b>", kv("Active key", "VaultKey v3 " + E("ACTIVE", "green")) + kv("Previous", "v2 " + E("RETIRED")) + kv("Used by", "Vault entries, bank details, integration connections") + '<div style="margin-top:8px">' + btn("Rotate key", "zap", "sm") + "</div>" + sub("Rotation re-encrypts in the background (status ROTATING). Key material lives in the secret manager.")) + "</div>") +
      pane("c", 0, cd("<b>Document categories</b><span class='r'>" + btn("New category", "plus", "sm") + "</span>", tbl(["Category", "Slug", "Sensitive", "Customer visible default", "Default retention", "System", ""], C.map((r) => [ink(r[0]), r[1].toLowerCase(), sw(r[2]), sw(r[3]), r[4], r[5] ? E("System") : "", more])).replace('class="panel" style="margin-top:0"', 'class="panel" style="margin:0;border:0"'), 1)) + "</div>" +
      dm(["DocumentSettings · every column in @data", "DocumentCategory · name, slug, description, icon, color, is_system, is_sensitive, customer_visible_default, default_retention_policy_id, sort_order, archived_at", "VaultKey · status, version, rotated_at"], []) + "</div>";
  }

  const MAP = { browse, recent, upload, doc, shares, sharenew, foldernew, tpl, vault, vaultnew, vaultentry, signatures, approvals, retention, trash, storage, search: searchp, templates, settings };
  const CRUMB = { browse: "Browse", recent: "Recent and favorites", upload: "Upload", doc: "Acme Rebrand, Design Specification", shares: "Shared", sharenew: "Share", foldernew: "New folder", tpl: "Folder templates", vault: "Vault", vaultnew: "New credential", vaultentry: "Acme hosting (cPanel)", signatures: "Signatures", approvals: "Approvals", retention: "Retention and holds", trash: "Trash", storage: "Storage", search: "Search", templates: "Document templates", settings: "Settings" };
  window.VIEWS.files = { html: function (s) { return (MAP[s || "browse"] || MAP.browse)(s); }, crumb: function (s) { return CRUMB[s] || ""; }, fill: false };
})();
