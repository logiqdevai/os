# AI Agent Skill: Frontend Documentation & Implementation Roadmap

## Mission

Using:

- `docs/Product_Specification.md`
- `api/prisma/schema.prisma`
- The `.cursor\rules\app-code-structure-and-best-practices.mdc`
- The current frontend application and its existing pages, components, routes, navigation, and UI patterns

create and maintain a complete, implementation-ready frontend documentation system **and** a master implementation progress roadmap.

The documentation must allow an AI coding agent to understand:

1. What the final the product frontend should contain.
2. What already exists in the current application.
3. What is missing or incomplete.
4. Which pages, routes, subpages, tabs, menus, dialogs, drawers, forms, and user flows are required.
5. Which Prisma entities and relationships each feature exposes.
6. What should be implemented next.
7. In what dependency-aware order implementation should happen.
8. What must be completed before the product is considered finished.

---

# PART A — CREATE THE COMPLETE FRONTEND DOCUMENTATION

\  Using the following sources:  \* `docs/Product_Specification.md` \* `api/prisma/schema.prisma` \* The **\*current frontend application\*** and its existing pages, components, routes, navigation, and UI patterns  Create a set of **\*Markdown documentation files\*** that clearly define the complete frontend structure for every feature in the product.  ## Goal  We need a comprehensive, implementation-ready map of the application that an AI coding agent can use to understand **\*what pages, subpages, screens, menus, dialogs, tabs, and user flows need to exist for each feature\***.  Do not only summarize the product specification. Cross-reference the specification, Prisma schema, and existing frontend implementation to determine the intended application structure.  ---  ## 1. Analyze the Existing Application First  Before creating the documentation:  1. Inspect the current frontend directory structure. 2. Identify all existing:     \* Routes    \* Pages    \* Layouts    \* Navigation menus    \* Sidebar items    \* Header actions    \* Tabs    \* Dropdown menus    \* Modals/dialogs    \* Drawers    \* Forms    \* Detail pages    \* List/table pages    \* Dashboard sections    \* Settings pages 3. Identify which features are already implemented and which appear to be missing. 4. Compare the frontend with:     \* `docs/Product_Specification.md`    \* `api/prisma/schema.prisma` 5. Use the Prisma schema to understand the underlying entities, relationships, and data that the UI needs to expose.  Do not assume that the current frontend is complete or that the existing navigation represents the final product structure.  ---  # 2. Create Markdown Documentation Files  Create a logical set of `.md` files under an appropriate documentation directory.  Organize the documentation by feature/module rather than putting everything into one extremely large file.  For example:  

`text docs/frontend/ ├── README.md ├── navigation.md ├── authentication.md ├── dashboard.md ├── users.md ├── organizations.md ├── projects.md ├── [feature].md ├── settings.md └── ... `

 Choose the actual file structure based on the features discovered in the product specification, Prisma schema, and frontend.  Do not blindly use the example names above.  ---  # 3. Document Every Feature  For **\*each product feature\***, document the complete UI structure.  Each feature document should include:  ## Feature Overview  Explain:  \* What the feature does \* Which users/roles can access it \* Which data/entities it uses \* Relevant Prisma models \* Dependencies on other features  ## Pages  List every required page.  For each page specify:  \* Page name \* Route/path \* Purpose \* Who can access it \* Parent page \* Entry points \* Main UI sections \* Data displayed \* Primary actions \* Secondary actions \* Empty states \* Loading states \* Error states \* Permission restrictions  Example:  

``### Project Details  **Route:** `/projects/:projectId`  **Purpose:** Display the complete information and activity for a project.  **Sections:** - Project header - Project information - Members - Activity - Settings  **Actions:** - Edit project - Add member - Remove member - Archive project  **Related entities:** - Project - User - ProjectMember ``

 \---  # 4. Document Subpages and Nested Navigation  For every feature, explicitly define its hierarchy.  Example:  

`text Projects ├── Project List ├── Create Project └── Project Details     ├── Overview     ├── Activity     ├── Members     ├── Files     └── Settings `

 Make it clear which items are:  \* Top-level pages \* Child pages \* Tabs \* Nested routes \* Modals \* Drawers \* Dropdown actions  Do not treat a modal or tab as a standalone page unless appropriate.  ---  # 5. Document Menus and Navigation  Create a dedicated `navigation.md` containing the complete application navigation.  Document:  ### Main Navigation  

`text Dashboard Projects Users ... `

 For every navigation item specify:  \* Label \* Route \* Icon if already established \* Parent menu \* Required role/permission \* Whether it is always visible \* Whether it is conditionally visible \* Destination page  ### User/Profile Menu  Document all items such as:  

`text Profile Account Settings Notifications Help Sign Out `

 \### Context Menus  Document feature-specific menus such as:  

`text Project ├── Edit ├── Duplicate ├── Archive └── Delete `

 \### Mobile Navigation  If the existing application has responsive/mobile navigation, document it separately.  ---  # 6. Document Tabs  Every tab-based interface should be explicitly documented.  For example:  

`text Project Details ├── Overview ├── Members ├── Activity └── Settings `

 For every tab specify:  \* Tab label \* Route, if applicable \* Purpose \* Data displayed \* Actions available \* Permissions  ---  # 7. Document Modals, Dialogs, Drawers, and Forms  Do not limit the documentation to full pages.  For every feature identify UI interactions such as:  \* Create dialogs \* Edit dialogs \* Delete confirmation dialogs \* Invite dialogs \* Filters \* Search panels \* Side drawers \* Detail drawers \* Confirmation dialogs \* Multi-step forms  For each one document:  \* Trigger \* Title \* Fields \* Validation \* Actions \* Success behavior \* Error behavior \* Permission requirements \* What happens after submission  Example:  

`### Delete Project Dialog  **Triggered by:** Project → More Actions → Delete  **Fields:** None  **Content:** - Warning message - Project name - Confirmation requirement  **Actions:** - Cancel - Delete  **Success:** - Delete project - Close dialog - Redirect to project list `

 \---  # 8. Connect UI to the Prisma Schema  Use `api/prisma/schema.prisma` to make the documentation data-aware.  For each relevant page, identify:  \* Prisma models involved \* Important relationships \* Data that must be displayed \* Data that can be created/updated/deleted \* Related entities \* Ownership/permissions implied by the schema  For example:  

``**Data model:**  - `User` - `Project` - `ProjectMember`  **Relationships:**  - A Project belongs to a User - A Project has many ProjectMembers - A ProjectMember references a User ``

 Do not invent database fields that do not exist.  If the product specification requires functionality that is not represented in the Prisma schema, explicitly flag it as a **\*schema gap\*** instead of silently inventing a model.  ---  # 9. Identify Missing or Incomplete Frontend Features  Compare:  1. Product specification 2. Prisma schema 3. Current frontend  Create a clear section/document for discrepancies.  Categorize them as:  \* Already implemented \* Partially implemented \* Missing \* Unclear / requires product decision \* Schema gap \* Frontend-only requirement  Example:  

`| Feature | Specification | Schema | Frontend | Status | |---|---|---|---|---| | Projects | Yes | Yes | Yes | Implemented | | Project Members | Yes | Yes | Partial | Needs completion | | Notifications | Yes | No | No | Schema gap | `

 This comparison is important: the documentation should describe the **\*desired final product\***, while also making the current implementation gaps obvious.  ---  # 10. Define User Flows  For important features, document the expected user flows.  Example:  

`text Create Project  Project List     ↓ Click "Create Project"     ↓ Create Project Form     ↓ Validate Form     ↓ Submit     ↓ Create Project     ↓ Redirect to Project Details `

 Include important alternative paths:  \* Validation errors \* Permission errors \* Empty states \* Failed API requests \* Cancellation \* Unsaved changes  ---  # 11. Define Roles and Permissions  Where applicable, document which roles can:  \* View \* Create \* Edit \* Delete \* Archive \* Manage \* Invite \* Approve  Do not invent roles if they are not defined in the specification/schema.  If permissions are unclear, explicitly mark them as requiring clarification.  ---  # 12. Keep the Documentation Implementation-Oriented  These files are intended to be consumed by an **\*AI coding agent\***.  Therefore, avoid vague descriptions such as:  

> "The user can manage projects."

  Instead write:  

> "Add a \`/projects\` page containing a searchable project list. Each row must provide a details action and an overflow menu. The overflow menu contains Edit, Archive, and Delete. Clicking a project opens \`/projects/\:projectId\`."

  The documentation should allow an AI coding agent to implement the frontend without having to repeatedly infer the intended structure from the product specification.  ---  # 13. Do Not Invent Requirements  Follow this priority:  1. Existing product specification 2. Existing database schema 3. Existing frontend behavior/patterns 4. Reasonable UX conventions  If something cannot be determined from those sources, **\*flag it as unclear\*** rather than making up a requirement.  Clearly distinguish between:  \* Confirmed requirements \* Existing implementation \* Inferred behavior \* Open questions  ---  # 14. Create a Master Frontend Map  The `README.md` should provide a high-level overview of the entire application.  Include:  ## Application Sitemap  

`text Application ├── Authentication │   ├── Login │   ├── Register │   └── ... ├── Dashboard ├── Feature A │   ├── List │   ├── Create │   └── Details │       ├── Overview │       └── Settings ├── Feature B └── Settings `

 \## Route Map  Include a table:  | Route           | Page            | Feature   | Access        | Status   | | --------------- | --------------- | --------- | ------------- | -------- | | `/dashboard`    | Dashboard       | Dashboard | Authenticated | Existing | | `/projects`     | Projects        | Projects  | Authenticated | Existing | | `/projects/:id` | Project Details | Projects  | Authenticated | Partial  |  ## Feature Status  Summarize implementation status across the application.  ---  # 15. Final Requirements  The final documentation must:  \* Cover **\*all features\*** in the product specification. \* Cover relevant entities from the Prisma schema. \* Reflect the current frontend implementation. \* Clearly identify missing functionality. \* Document pages and routes. \* Document nested pages. \* Document tabs. \* Document menus. \* Document context menus. \* Document modals/dialogs. \* Document drawers. \* Document forms. \* Document user flows. \* Document permissions where known. \* Document important states and interactions. \* Identify conflicts between specification, schema, and frontend. \* Avoid inventing unsupported requirements. \* Be structured so an AI coding agent can directly use it as an implementation reference.  Before finishing, verify that every feature mentioned in the product specification has a corresponding section in the frontend documentation and that every major Prisma entity relevant to the frontend has been accounted for.

---

# PART B — CREATE THE AI-EXECUTABLE IMPLEMENTATION PROGRESS PLAN

The frontend documentation created in Part A is the detailed source of requirements. After creating or updating it, create the master roadmap:

`docs/frontend/PROGRESS.md`

The progress file must treat the detailed frontend documentation as its implementation reference.

\  Using:  \* `docs/Product_Specification.md` \* `api/prisma/schema.prisma` \* The current frontend application \* The frontend documentation Markdown files created from the previous task  Create a **\*single progress/tracking Markdown file\*** that an AI coding agent can use as its primary implementation roadmap.  The progress file should tell the agent:  1. **\*What needs to be built\*** 2. **\*In what order it needs to be built\*** 3. **\*Which documentation file explains each task\*** 4. **\*What is already completed\*** 5. **\*What the agent should work on next\*** 6. **\*What must be completed before the product can be considered finished\***  The goal is for an AI coding agent to open this one file and immediately understand **\*where the project currently stands and what it should implement next\***, without having to reconstruct the roadmap itself.  ---  # 1. Create a Master Progress File  Create:  

`text docs/frontend/PROGRESS.md `

 This file is the **\*master implementation checklist\***.  The agent should treat `PROGRESS.md` as the source of truth for implementation progress and task order.  Detailed requirements should remain in the individual feature Markdown files.  ---  # 2. Organize Work From MVP → Finished Product  The progress file must organize all work into logical implementation phases.  Use this general progression:  

`text Phase 0 — Project / Architecture Foundation Phase 1 — Authentication & Access Phase 2 — Core MVP Features Phase 3 — MVP Supporting Features Phase 4 — Main Product Workflows Phase 5 — Advanced Features Phase 6 — Settings / Administration Phase 7 — UX, Error & Edge Cases Phase 8 — Security / Permissions / Data Integrity Phase 9 — Testing & QA Phase 10 — Production Readiness Phase 11 — Finished Product `

 Do **\*not\*** blindly use these phases if the actual product requires a different order.  Determine the correct implementation sequence from:  \* Product requirements \* Database dependencies \* Frontend dependencies \* User flows \* Feature dependencies \* Existing implementation  The important requirement is that the order must be **\*dependency-aware and practical for incremental development\***.  ---  # 3. Every TODO Must Link to Detailed Documentation  Each TODO should point to the Markdown file containing its detailed implementation requirements.  For example:  

``- [ ] Implement project list page   - Details: [Projects](./projects.md)   - Route: `/projects`   - Depends on: Authentication, Project API ``

 Or:  

`- [ ] Implement project details workflow   - Details: [Projects](./projects.md)   - Includes: overview, members, activity, settings   - Depends on: Project list `

 Use relative Markdown links so the agent can navigate directly to the relevant documentation.  If a task does not need a separate feature document, link to the most relevant existing documentation or `README.md`.  ---  # 4. Every TODO Must Be Actionable  Avoid vague TODOs.  Bad:  

`- [ ] Projects - [ ] Settings - [ ] Finish UI `

 Good:  

``- [ ] Implement `/projects`   - Details: [Projects](./projects.md)   - Add project list   - Add search   - Add empty state   - Add loading/error states   - Add create-project action   - Add row actions ``

 An AI agent should be able to understand **\*what "done" means\*** for every task.  ---  # 5. Define Completion Criteria  Every major task should have explicit completion criteria.  Example:  

`- [ ] Implement project list   - Details: [Projects](./projects.md)   - Completion criteria:     - [ ] Route exists     - [ ] Data is loaded from the API     - [ ] Loading state exists     - [ ] Error state exists     - [ ] Empty state exists     - [ ] Search works     - [ ] Project navigation works `

 The agent should be able to check the boxes only after verifying the implementation.  ---  # 6. Track Dependencies  Tasks must clearly state dependencies.  Example:  

`### 2.3 Project Management  - [ ] Implement project list   - Details: [Projects](./projects.md)   - Depends on: Authentication, API client  - [ ] Implement project creation   - Details: [Projects](./projects.md)   - Depends on: Project list, project API  - [ ] Implement project details   - Details: [Projects](./projects.md)   - Depends on: Project list  - [ ] Implement project members   - Details: [Projects](./projects.md)   - Depends on: Project details, user management `

 This prevents the agent from implementing features in an order that creates unnecessary rework.  ---  # 7. Clearly Separate MVP From Post-MVP  The progress file must make it obvious which features are required for the first usable product.  Use explicit labels:  

`## MVP  Everything in this section is required before the MVP is considered complete.  ## Post-MVP  These features are intentionally excluded from the MVP and should be implemented afterward. `

 The MVP should be based on the actual product specification rather than arbitrary assumptions.  ---  # 8. Include Current Implementation Status  At the beginning of the file, include a concise status summary.  Example:  

`# the product Frontend Progress  ## Current Status  **Current Phase:** Phase 2 — Core MVP Features  **MVP Progress:** 14 / 27 tasks completed  **Overall Progress:** 32 / 86 tasks completed  **Next Task:** Implement Project Details  **Next Documentation:** [Projects](./projects.md) `

 Keep this section updated as implementation progresses.  ---  # 9. Add an Explicit "What To Do Next" Section  This is extremely important.  At the top of `PROGRESS.md`, include:  

``## Next Action  > The next task for the AI coding agent is:  - [ ] Implement `/projects/:projectId` - Documentation: [Projects](./projects.md) - Phase: Core MVP - Depends on: Project List ``

 After completing a task, the agent should update this section to point to the next incomplete task.  The agent should **\*not choose an arbitrary task\*** when the next task is already defined.  ---  # 10. Define Agent Instructions  At the top of `PROGRESS.md`, include a section called:  

`## Instructions for AI Coding Agents `

 It should explain the workflow:  

``1. Read this file first. 2. Find the `Next Action`. 3. Read the linked detailed documentation before modifying code. 4. Inspect the existing implementation before making changes. 5. Check the Prisma schema when the task involves data/entities. 6. Implement only the current task unless dependencies require otherwise. 7. Run the relevant tests/type checks/linting. 8. Verify the task's completion criteria. 9. Mark the task as completed. 10. Update the progress counters. 11. Update `Next Action` to the next incomplete task. 12. Do not skip ahead unless the current task is blocked. ``

 Add:  

`### Important Rules  - Do not mark a task complete based only on code being written. - Verify the actual behavior. - Do not invent requirements. - If requirements are unclear, document the uncertainty instead of guessing. - If a dependency is missing, identify it and stop at the appropriate task. - Keep the detailed feature documentation synchronized with implementation changes. - Do not rewrite unrelated parts of the application. - Follow existing frontend architecture and conventions unless the documentation explicitly requires a change. `

 \---  # 11. Use a Consistent TODO Structure  Every major feature should follow the same format.  Example:  

``## Phase 2 — Core MVP  ### 2.1 Dashboard  - [ ] Implement dashboard route   - Details: [Dashboard](./dashboard.md)   - Route: `/dashboard`   - Depends on: Authentication    **Completion criteria:**   - [ ] Route is accessible to authenticated users   - [ ] Dashboard layout is implemented   - [ ] Required data is displayed   - [ ] Loading state exists   - [ ] Error state exists   - [ ] Empty states are handled   - [ ] Navigation works  ### 2.2 Projects  - [ ] Implement project list   - Details: [Projects](./projects.md)   - Route: `/projects`   - Depends on: Authentication    **Completion criteria:**   - [ ] List displays projects   - [ ] Search works   - [ ] Empty state exists   - [ ] Loading state exists   - [ ] Error state exists   - [ ] Create action works  - [ ] Implement project creation   - Details: [Projects](./projects.md)   - Depends on: Project list    **Completion criteria:**   - [ ] Create UI exists   - [ ] Form validation works   - [ ] API integration works   - [ ] Success state works   - [ ] Error state works   - [ ] User is redirected appropriately ``

 \---  # 12. Include Pages, Subpages, Menus and UI States  The progress plan must not only track backend/API work.  It must include frontend work for:  \* Routes \* Pages \* Subpages \* Tabs \* Navigation \* Sidebar \* Header \* Menus \* Context menus \* Modals \* Dialogs \* Drawers \* Forms \* Tables \* Filters \* Search \* Empty states \* Loading states \* Error states \* Permission states \* Responsive/mobile behavior  Link each task to its detailed feature documentation.  ---  # 13. Include Feature-Level Checklists  At the end of each major feature section, include a feature completion checklist.  Example:  

`### Project Feature — Completion  - [ ] All required routes implemented - [ ] All required pages implemented - [ ] All tabs implemented - [ ] All menus implemented - [ ] All dialogs implemented - [ ] All forms implemented - [ ] API integration complete - [ ] Loading states complete - [ ] Error states complete - [ ] Empty states complete - [ ] Permissions complete - [ ] Responsive behavior complete - [ ] Tests complete `

 A feature should not be considered complete until all relevant items are checked.  ---  # 14. Include Final Product Checklist  The final section should define exactly what "finished product" means.  Example:  

`# Finished Product Checklist  ## Product Functionality  - [ ] All MVP features complete - [ ] All post-MVP features complete - [ ] All documented workflows work end-to-end  ## Navigation  - [ ] All routes implemented - [ ] All navigation items implemented - [ ] All nested navigation implemented - [ ] All menus implemented  ## UI  - [ ] Loading states - [ ] Empty states - [ ] Error states - [ ] Confirmation dialogs - [ ] Forms and validation - [ ] Responsive layouts  ## Data  - [ ] Prisma relationships correctly represented - [ ] API integration complete - [ ] Mutations handled correctly - [ ] Error handling complete  ## Security  - [ ] Authentication enforced - [ ] Permissions enforced - [ ] Unauthorized states handled  ## Quality  - [ ] Type checking passes - [ ] Linting passes - [ ] Tests pass - [ ] No known blocking issues `

 \---  # 15. Handle Blocked Tasks  Add a section:  

`## Blocked / Needs Clarification `

 When the agent encounters something that cannot be implemented safely, it should add it here.  Example:  

`- [ ] Determine whether organization admins can delete projects.   - Related documentation: [Projects](./projects.md)   - Reason: Product specification and current permissions model disagree.   - Blocking: Project deletion permissions `

 Do not silently make product decisions.  ---  # 16. Maintain Progress Automatically  The AI coding agent should update `PROGRESS.md` after every completed implementation task.  For every completed task:  1. Change `[ ]` → `[x]` 2. Update the completion counters. 3. Update the current phase. 4. Update `Next Action`. 5. Add blockers if discovered. 6. Update linked documentation if implementation reveals a necessary clarification.  Do not mark future tasks as completed simply because they are planned.  ---  # 17. Final Expected Structure  The resulting file should roughly follow this structure:  

`text PROGRESS.md  # the product Frontend Progress  ## Instructions for AI Coding Agents  ## Current Status  ## Next Action  ## MVP Definition  ---  # Phase 0 — Foundation  ## 0.1 Application Architecture - [ ] - [ ]  ## 0.2 Shared UI - [ ] - [ ]  ---  # Phase 1 — Authentication  ## 1.1 Authentication - [ ] - [ ]  ---  # Phase 2 — Core MVP  ## 2.1 Dashboard - [ ] - [ ]  ## 2.2 Feature A - [ ] - [ ] - [ ]  ## 2.3 Feature B - [ ] - [ ]  ---  # Phase 3 — MVP Supporting Features  ...  ---  # Phase 4 — Main Product Workflows  ...  ---  # Phase 5 — Advanced Features  ...  ---  # Phase 6 — Settings & Administration  ...  ---  # Phase 7 — UX & Edge Cases  ...  ---  # Phase 8 — Security & Permissions  ...  ---  # Phase 9 — Testing & QA  ...  ---  # Phase 10 — Production Readiness  ...  ---  # Phase 11 — Finished Product  ## Final Checklist  ...  ---  # Blocked / Needs Clarification  ... `

 \---  # 18. Important: Determine the Actual Tasks  Do not simply create placeholder phases or generic TODOs.  First inspect:  \* `docs/Product_Specification.md` \* `api/prisma/schema.prisma` \* The current frontend \* The detailed frontend feature documentation  Then derive the **\*actual implementation tasks\*** required by this specific project.  The final `PROGRESS.md` should represent the real the product product, not a generic application template.  The result should be detailed enough that a new AI coding agent can start with:  

> "Read \`docs/frontend/PROGRESS.md\`."

  and immediately know:  \* what the product is, \* what has already been implemented, \* what remains, \* what the current priority is, \* which documentation to read, \* what dependencies exist, \* how to verify completion, \* and exactly what task to implement next.

---

# EXECUTION ORDER

Follow this order strictly:

1. Inspect the product specification.
2. Inspect the Prisma schema.
3. Inspect the current frontend implementation.
4. Identify existing routes, pages, layouts, navigation, components, dialogs, tabs, forms, and UI patterns.
5. Compare the specification, schema, and frontend.
6. Identify implemented, partially implemented, missing, unclear, and schema-gap functionality.
7. Create or update the detailed documentation files under `docs/frontend/`.
8. Verify that every product feature has corresponding frontend documentation.
9. Verify that every major Prisma entity relevant to the frontend has been accounted for.
10. Create or update `docs/frontend/README.md` as the master frontend map.
11. Create or update `docs/frontend/navigation.md`.
12. Create the remaining feature documentation files based on the actual the product product.
13. Create or update `docs/frontend/PROGRESS.md`.
14. Derive the real implementation order from dependencies rather than using generic placeholders.
15. Set a single explicit **Next Action** for the coding agent.

---

# SOURCE OF TRUTH PRIORITY

When determining requirements, use this priority order:

1. Existing product specification
2. Existing Prisma schema
3. Existing frontend behavior and patterns
4. Reasonable UX conventions

Do not invent requirements.

If something cannot be determined, explicitly classify it as one of:

- Confirmed requirement
- Existing implementation
- Inferred behavior
- Open question
- Schema gap
- Frontend-only requirement

---

# AGENT OPERATING RULES

When implementing the product after documentation is complete:

1. Read `docs/frontend/PROGRESS.md` first.
2. Read the current **Next Action**.
3. Open the linked detailed documentation before changing code.
4. Inspect the existing implementation before making changes.
5. Check the Prisma schema whenever the task involves data or entities.
6. Implement the current task unless a required dependency forces additional work.
7. Do not skip ahead arbitrarily.
8. Do not mark a task complete merely because code was written.
9. Verify actual behavior.
10. Run relevant type checks, linting, and tests.
11. Verify every completion criterion.
12. Change `[ ]` to `[x]` only after verification.
13. Update progress counters.
14. Update the current phase.
15. Update **Next Action** to the next incomplete task.
16. Add blockers or open questions when requirements cannot safely be determined.
17. Keep detailed documentation synchronized with implementation changes.
18. Do not rewrite unrelated parts of the application.
19. Follow existing frontend architecture and conventions unless documentation explicitly requires a change.

---

---

# REAL API & END-TO-END INTEGRATION REQUIREMENTS

## Core Rule: No Fake Integrations

Do not consider a frontend feature complete merely because:

- The UI exists.
- A form exists.
- An API client function exists.
- A TanStack Query hook exists.
- Mock data is displayed.
- A request function has been written but is not connected to a real backend endpoint.

For every feature that requires server-side functionality, the feature must work against the **real API and backend implementation**.

A completed feature must provide a working flow:

```text
User Interface
    ↓
TanStack Query
    ↓
Real API Endpoint
    ↓
Backend Feature / Business Logic
    ↓
Database or External Service
    ↓
Real API Response
    ↓
TanStack Query Cache Update
    ↓
Updated User Interface
```

---

# BACKEND FEATURE INSPECTION

Before implementing or connecting a frontend feature:

1. Inspect the relevant backend `/features` folders.
2. Identify the existing feature/module responsible for the functionality.
3. Inspect the existing API endpoints.
4. Identify:
   - Available routes/endpoints
   - HTTP methods
   - Request parameters
   - Request body
   - Response structure
   - Authentication requirements
   - Permission requirements
   - Validation rules
   - Error responses
5. Determine whether the existing API fully supports the required frontend workflow.

Do not assume that an API endpoint exists simply because a frontend API client method exists.

The backend implementation is the source of truth for actual available functionality.

---

# MISSING API FUNCTIONALITY

If the product specification requires functionality that the frontend needs but the backend does not currently support:

1. Inspect the relevant `/features` folder.
2. Extend the existing feature/module where appropriate.
3. Create or update the required API endpoint(s).
4. Add or update:
   - Route/controller
   - Request DTO/schema/validation
   - Service/business logic
   - Authorization/permission checks
   - Database operations
   - Error handling
   - Response contract
5. Follow the existing backend architecture and conventions.
6. Do not create duplicate endpoints if equivalent functionality already exists.

After implementing the backend functionality, connect the frontend to the **real endpoint**.

Do not leave a fake client method, mock response, TODO, or placeholder as a substitute for missing backend functionality.

---

# TANSTACK QUERY REQUIREMENTS

All frontend communication with server state must use **TanStack Query**, following the application's existing conventions.

For each backend-driven feature:

## Queries

Use TanStack Query queries for reading server data.

Typical requirements:

- Create query keys using a consistent structure.
- Place query logic in the appropriate frontend `/features` folder.
- Use the real API endpoint.
- Handle loading states.
- Handle error states.
- Handle empty states where applicable.
- Configure caching and refetching according to existing project conventions.
- Avoid duplicating server state in local component state unnecessarily.

## Mutations

Use TanStack Query mutations for operations that change server state, including:

- Create
- Update
- Delete
- Archive
- Restore
- Submit
- Approve
- Reject
- Other server-side actions

After successful mutations:

1. Update or invalidate the appropriate query keys.
2. Ensure the UI reflects the real server state.
3. Display appropriate success behavior.
4. Handle API validation and server errors.
5. Do not manually assume success before the backend confirms it.

Use optimistic updates only when appropriate and consistent with existing application patterns.

---

# FRONTEND `/features` ORGANIZATION

Frontend API integration should follow the application's feature-based architecture.

For each feature, keep related functionality within the appropriate `/features` folder according to the existing project conventions.

A feature may contain, where appropriate:

```text
features/
└── feature-name/
    ├── api/
    ├── hooks/
    ├── components/
    ├── pages/
    ├── types/
    ├── utils/
    └── ...
```

Do not blindly create this exact structure if the existing application uses a different convention.

Instead:

1. Inspect the existing `/features` architecture.
2. Follow the established structure.
3. Add API functions and TanStack Query hooks in the appropriate locations.
4. Keep feature-specific logic close to the feature.
5. Avoid placing unrelated API logic inside pages or generic components.

---

# REQUIRED END-TO-END IMPLEMENTATION WORKFLOW

For every feature that involves backend functionality, follow this sequence:

## Step 1 — Inspect the Requirements

Determine:

- What the user should be able to do.
- What data must be displayed.
- What data can be created, updated, or deleted.
- Which user flows require server interaction.

## Step 2 — Inspect Existing Backend Features

Inspect the relevant backend `/features` folder and determine:

- Which endpoints already exist.
- Which operations are already supported.
- Which operations are missing.
- Whether existing responses contain the data required by the UI.

## Step 3 — Update the Backend if Necessary

If required functionality is missing:

- Add or update the endpoint.
- Implement the required business logic.
- Add validation.
- Apply authentication and authorization.
- Connect the functionality to the database or required service.
- Return an appropriate response.

## Step 4 — Create/Update the Frontend API Layer

Create or update the feature's API functions so they call the actual backend endpoints.

Do not create API functions for imaginary routes.

The frontend API layer must match the real backend contract.

## Step 5 — Create TanStack Query Integration

Implement:

- Query hooks for reads.
- Mutation hooks for writes.
- Consistent query keys.
- Cache invalidation or cache updates.
- Loading states.
- Error handling.

## Step 6 — Connect the Real UI

Connect pages, components, forms, dialogs, tables, and actions to the TanStack Query hooks.

The user interaction must trigger the real backend operation.

## Step 7 — Verify End-to-End Behavior

Verify the complete workflow:

```text
User Action
    ↓
Frontend Validation
    ↓
TanStack Query Query/Mutation
    ↓
Real API Request
    ↓
Backend Endpoint
    ↓
Business Logic
    ↓
Database / Service
    ↓
API Response
    ↓
TanStack Query Cache Update
    ↓
UI Updates
```

Only then can the task be marked as complete.

---

# API STATUS DOCUMENTATION

For every documented feature that requires server functionality, explicitly record API status.

Use a structure similar to:

| Operation | Frontend Requirement | API Endpoint | Backend Status | Integration Status |
|---|---|---|---|---|
| List | Display records | `GET /resource` | Existing | Connected / Missing |
| Details | Display one record | `GET /resource/:id` | Existing / Missing | Connected / Missing |
| Create | Create record | `POST /resource` | Existing / Missing | Connected / Missing |
| Update | Update record | `PATCH /resource/:id` | Existing / Missing | Connected / Missing |
| Delete | Delete record | `DELETE /resource/:id` | Existing / Missing | Connected / Missing |

Use the **actual endpoints discovered in the codebase**, not placeholder examples.

---

# SIGNUP EXAMPLE: WHAT "COMPLETE" MEANS

A signup feature is not complete when only the signup UI and an API client function exist.

The complete flow must be:

```text
Signup Page
    ↓
User enters valid information
    ↓
Frontend validation
    ↓
TanStack Query mutation
    ↓
POST to the real signup endpoint
    ↓
Backend authentication feature handles request
    ↓
Validation and business logic execute
    ↓
User/account is created
    ↓
Database transaction completes
    ↓
Real response is returned
    ↓
TanStack Query handles success
    ↓
Authentication/session state updates as required
    ↓
User is redirected or shown the appropriate next step
```

The agent must verify this actual flow rather than assuming it works.

---

# COMPLETION RULE FOR BACKEND-DRIVEN FEATURES

A backend-driven feature can only be marked complete when all applicable items are verified:

- [ ] Required UI is implemented.
- [ ] Required backend functionality exists.
- [ ] Missing backend endpoints were created or existing endpoints were updated.
- [ ] The correct backend `/features` module was used.
- [ ] Frontend API functions call real endpoints.
- [ ] TanStack Query is used for server state.
- [ ] Query keys follow project conventions.
- [ ] Mutations update or invalidate relevant cached data.
- [ ] Real request contracts are used.
- [ ] Real response contracts are handled.
- [ ] Authentication is enforced where required.
- [ ] Permissions are enforced where required.
- [ ] Validation errors are handled.
- [ ] Server errors are handled.
- [ ] Loading states are implemented.
- [ ] Empty states are implemented where applicable.
- [ ] Successful operations update the UI correctly.
- [ ] The complete user flow works end-to-end.
- [ ] Relevant tests, type checks, and linting pass.

---

# PROGRESS ROADMAP REQUIREMENTS FOR API WORK

`PROGRESS.md` must track backend dependencies and integration work explicitly.

For backend-driven tasks, do not use vague completion items such as:

```text
- [ ] Create customer UI
- [ ] Connect API
```

Instead use dependency-aware tasks such as:

```text
- [ ] Verify existing customer backend feature
  - Inspect: relevant backend `/features` folder
  - Confirm actual endpoints and contracts

- [ ] Implement missing customer API operations
  - Create only the operations required by the product specification
  - Follow existing backend architecture

- [ ] Implement customer API integration
  - Use real backend endpoints
  - Add feature API functions

- [ ] Implement TanStack Query hooks
  - Queries for reads
  - Mutations for writes
  - Cache invalidation/update

- [ ] Connect customer UI to real server state
  - Verify end-to-end behavior
```

The **Next Action** must point to the next dependency-aware implementation step, whether that step is backend work, API integration, TanStack Query work, or UI work.

---

# FINAL PRINCIPLE

The agent must build features **vertically and end-to-end** whenever practical:

> Requirement → Backend Feature → Real API → TanStack Query → UI → Verification

Do not treat the frontend and API client as disconnected deliverables.

Do not consider a feature finished until the actual user interaction works against the real backend functionality.

# FINAL DELIVERABLES

The completed documentation system must include, at minimum:

- `docs/frontend/README.md`
- `docs/frontend/PROGRESS.md`
- `docs/frontend/navigation.md`
- Feature-specific Markdown files based on the actual the product product

Together, these files must provide:

- Complete application sitemap
- Complete route map
- Feature status overview
- Navigation structure
- Page hierarchy
- Nested routes and subpages
- Tabs
- Menus and context menus
- Dialogs and drawers
- Forms and validation requirements
- User flows
- Loading states
- Empty states
- Error states
- Permission states where known
- Prisma model relationships relevant to the UI
- Schema gaps
- Frontend gaps
- MVP definition
- Post-MVP work
- Dependency-aware implementation phases
- Actionable implementation tasks
- Completion criteria
- A single explicit next task
- Blocked and clarification items
- Final finished-product checklist

The result must be generic and reusable while being derived from the actual project being analyzed and derived from the actual repository, product specification, Prisma schema, and existing frontend—not from generic example features.
