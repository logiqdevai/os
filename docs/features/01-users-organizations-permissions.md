# Users, Members, Organizations, Branches & Permissions

> Linear: [LOG-406](https://linear.app/logiqdev/issue/LOG-406/users-members-organizations-branches-and-permissions) · Status: Backlog

## 1. Purpose

This module defines the identity, organization, membership, branch, team, role, permission, access-control, and workspace structure for the Agency Operating System.

It is the foundational access and tenancy layer used by CRM, Projects, Tasks, Support, Finance, Contracts, Offers, Messaging, Documents, Calendar, Employees, Customer Portal, and other modules.

The module must support both:

* Independent organizations representing completely separate companies.
* Branches representing offices, locations, or operational units belonging to the same organization.

Example:

**Deloitte**

* Deloitte Greece
* Deloitte UK
* Deloitte Germany
* Deloitte France
* Deloitte USA

These are branches / organizational units of the same top-level organization when configured that way, rather than separate platform organizations.

At the same time, completely unrelated companies such as Deloitte, Acme Software, and Northwind must be isolated as separate Organizations.

---

# 2. Core Concepts

The system should clearly distinguish the following entities:

### User

A person with a platform identity and login credentials.

### Organization

A completely separate company / tenant inside the platform.

### Branch

A physical office, geographic office, subsidiary unit, or operational location belonging to an Organization.

### Membership

The relationship between a User and an Organization.

### Organization Role

A reusable collection of permissions assigned to a Member.

### Team

A group of Members used for operational collaboration.

### Permission

A granular authorization allowing or denying an action on a resource.

### Scope

The organizational boundary within which a permission applies.

### Organization Owner / Admin

Privileged Members responsible for organization administration.

### Service / Module Access

Whether a Member can access a particular product such as CRM, Projects, Finance, Support, or Contracts.

These concepts must remain separate. A user's global identity must not be confused with their membership in a specific organization or branch.

---

# 3. Multi-Tenant Architecture

Organizations are the primary tenancy boundary.

Data belonging to Organization A must not be visible to Organization B unless an explicitly supported cross-organization relationship exists.

Example:

**Organization A — Acme**

* Users
* Clients
* Projects
* Finance
* Contracts
* Employees

must be isolated from:

**Organization B — Northwind**

* Users
* Clients
* Projects
* Finance
* Contracts
* Employees

A User may belong to both organizations without causing their data to become shared automatically.

---

# 4. User Identity

A User represents a human platform identity.

Core information may include:

* User ID
* First name
* Last name
* Display name
* Email
* Phone
* Profile photo
* Locale
* Time zone
* Language
* Authentication methods
* Account status
* Last login
* Created date

Identity information should be centralized and reused by every module.

CRM contacts, employee records, customer contacts, and external stakeholders must not automatically become Users merely because they have an email address.

---

# 5. User Account States

Support states such as:

* Invited
* Active
* Suspended
* Deactivated
* Locked
* Pending verification

Deactivation must preserve historical activity, ownership references, comments, approvals, tasks, projects, and audit records.

---

# 6. Authentication

The platform should support configurable authentication methods:

* Email/password
* Magic link
* Passkeys
* OAuth / social login where supported
* SSO
* SAML
* OIDC
* MFA

Authentication is separate from authorization.

A successful login does not imply access to every organization or module.

---

# 7. Global User vs Organization Membership

A User is global.

Membership is organization-specific.

Example:

**Petros — User**

Memberships:

* Organization A → Owner
* Organization B → Member
* Organization C → External collaborator

Each membership can have completely different permissions, roles, teams, branches, and module access.

---

# 8. Organization

An Organization represents an entire company / tenant.

Core fields:

* Organization ID
* Legal / registered name
* Display name
* Short name
* Logo
* Country
* Default currency
* Default timezone
* Default language
* Website
* Contact information
* Tax / registration identifiers where applicable
* Organization status
* Created date

An Organization owns its platform data.

---

# 9. Organization Isolation

Every major platform resource should belong to exactly one Organization unless explicitly designed as a global system resource.

Examples:

* Projects
* Tasks
* Clients
* Contracts
* Offers
* Invoices
* Support tickets
* Documents
* Messages
* Employees
* Branches

must have an organization context.

---

# 10. Organization Lifecycle

Organizations may have states such as:

* Setup
* Active
* Suspended
* Read-only
* Archived
* Deleted / scheduled for deletion

Suspended organizations should prevent normal operations while preserving authorized administrative access.

---

# 11. Organization Creation

An organization may be created by:

* New account signup
* Existing user
* Organization invitation
* Platform administrator
* Enterprise onboarding
* API

Creation should establish the initial Owner membership.

---

# 12. Organization Owner

The Organization Owner is the highest standard administrative role.

Capabilities may include:

* Organization settings
* Billing administration
* Member management
* Branch management
* Role management
* Permission management
* Security settings
* Data governance
* Integrations
* Organization deletion / transfer

Organizations may support multiple Owners if desired.

---

# 13. Organization Administrators

Admins can perform selected administrative actions without necessarily becoming Owners.

Organizations should support specialized administrative roles such as:

* User Administrator
* Security Administrator
* Finance Administrator
* Branch Administrator
* Integration Administrator
* Audit Administrator

These roles should be permission-based rather than hardcoded wherever possible.

---

# 14. Organization Profile

Organization settings should contain:

* Identity
* Branding
* Contact information
* Localization
* Currency
* Time zone
* Number formats
* Date formats
* Working days
* Business hours
* Default settings
* Security settings
* Notification defaults

---

# 15. Organization Branding

Organizations can configure:

* Logo
* Name
* Favicon
* Primary branding
* Email branding
* Customer Portal branding
* Document branding
* Contract branding

Modules consume organization branding rather than implementing separate branding systems.

---

# 16. Branches

Branches are organizational units inside an Organization.

A Branch can represent:

* Country office
* City office
* Regional office
* Departmental office
* Legal subsidiary when modeled as a branch
* Operational location
* Remote office
* Service center

The important distinction is:

**Organization = separate company / tenant**

**Branch = organizational unit inside that company**

---

# 17. Branch Hierarchy

Branches may optionally support hierarchy.

Example:

**Deloitte**

→ Europe

→ Greece

→ Athens

→ Thessaloniki

or:

**Deloitte**

→ Greece

→ Athens

→ Thessaloniki

The hierarchy depth should be configurable.

---

# 18. Branch Data Model

A Branch may contain:

* Branch ID
* Organization ID
* Parent Branch
* Name
* Code
* Country
* Region
* City
* Address
* Time zone
* Phone
* Email
* Manager
* Status
* Cost center reference
* Currency reference
* Custom fields

A Branch cannot belong to two Organizations simultaneously.

---

# 19. Branch Status

Example states:

* Active
* Planned
* Temporarily closed
* Suspended
* Archived

Archiving a branch must not delete its historical records.

---

# 20. Branch Manager

A Branch can have one or more responsible Members.

Examples:

* Branch Manager
* Regional Director
* Office Administrator

Branch management permissions should be assignable independently of global organization administration.

---

# 21. User Branch Membership

A Member can belong to:

* One branch
* Multiple branches
* A parent branch
* An entire organization

Example:

A regional manager may have access to:

* Athens
* Thessaloniki
* Heraklion

while a local employee only has access to Heraklion.

---

# 22. Branch Scope

Permissions can be scoped to:

* Organization-wide
* Branch
* Branch hierarchy
* Team
* Specific resource

This is critical for enterprise organizations.

---

# 23. Branch Access Examples

### Local employee

Can access:

* Heraklion branch
* Heraklion projects
* Heraklion clients

### Regional manager

Can access:

* All branches in Greece
* Regional projects
* Regional teams

### Global executive

Can access:

* All organization branches
* Organization-wide reporting

### External consultant

Can access:

* Specific organization
* Specific branch
* Specific projects

---

# 24. Membership

Membership is the authorization relationship between User and Organization.

A membership contains:

* User
* Organization
* Status
* Roles
* Branches
* Teams
* Module access
* Permission overrides
* Joined date
* Invited by
* Last active date

---

# 25. Multiple Organization Memberships

Users should be able to belong to multiple Organizations.

Example:

User:

**John Smith**

Membership 1:

**Acme Software** → Admin

Membership 2:

**Partner Agency** → Member

Membership 3:

**Client Company** → External collaborator

Switching organizations must change the active data scope.

---

# 26. Organization Switcher

The global application should provide an organization switcher.

It should display:

* Organization logo
* Organization name
* User role
* Branch context where relevant

Switching organizations should never merge the navigation state or data context accidentally.

---

# 27. Active Branch Context

Users with multiple branch memberships should be able to select their active branch context.

Options may include:

* Current branch
* Multiple selected branches
* Entire organization

The selected scope affects list views, reporting, dashboards, and resource visibility where applicable.

---

# 28. Global vs Branch Resources

Resources should define whether they are:

* Organization-wide
* Branch-specific
* Shared across branches

Examples:

A global CRM client may be organization-wide.

A branch-specific employee may belong to Athens.

A project may be assigned to Athens while being visible to the regional management team.

---

# 29. Branch-Aware Modules

Modules should be able to consume branch context without each implementing their own branch system.

Relevant modules include:

* CRM
* Projects
* Tasks
* Support
* Finance
* Employees
* Contracts
* Offers
* Documents
* Calendar
* Messaging
* Customer Portal

The identity/access layer provides the branch scope.

---

# 30. Branch Assignment Rules

Resources can have:

* Primary branch
* Additional branches
* Organization-wide visibility

Examples:

Employee → Primary branch Athens

Project → Primary branch Athens

Client → Organization-wide

Contract → Organization-wide or linked to relevant branch

---

# 31. Organization-Wide vs Branch-Level Clients

The CRM should support both:

### Organization client

A client relationship managed centrally across the company.

### Branch client

A client primarily associated with a particular branch.

The client should not be duplicated simply because multiple branches interact with it.

Example:

Acme Corporation may be a single CRM company for Deloitte while having relationships with:

* Deloitte Greece
* Deloitte UK
* Deloitte Germany

Branch relationships should be represented as relationships / ownership rather than duplicate client records.

---

# 32. Branch-Level Projects

Projects can be:

* Organization-wide
* Branch-specific
* Multi-branch

A project can have a primary branch and additional participating branches.

---

# 33. Cross-Branch Projects

Projects involving multiple branches should support:

* Primary branch
* Participating branches
* Cross-branch teams
* Cross-branch permissions
* Cross-branch reporting

Example:

A global client implementation may involve:

* Greece engineering
* UK account management
* Germany support

---

# 34. Branch-Level Finance

Finance can consume branch context for:

* Revenue reporting
* Expense reporting
* Cost centers
* Budgets
* Profitability

Finance remains responsible for financial records and calculations.

The identity layer only provides organizational/branch context.

---

# 35. Branch-Level Employees

Employees may have:

* Primary branch
* Secondary branches
* Department
* Team
* Manager

Employee Management owns employee-specific data.

This module owns the access relationship to branches.

---

# 36. Branch-Level Contracts

Contracts may optionally be associated with:

* Organization
* Branch
* Multiple branches

Example:

A global MSA may be organization-wide while a local SOW is associated with the Greece branch.

---

# 37. Branch-Level Offers

Offers can optionally identify the branch responsible for the commercial relationship.

This allows:

* Branch sales ownership
* Branch revenue attribution
* Regional reporting

without duplicating the client.

---

# 38. Branch-Level Support

Support tickets may include:

* Organization
* Client
* Branch
* Assigned team

This allows local support queues while retaining centralized customer context.

---

# 39. Branch-Level Documents

Documents may have:

* Organization scope
* Branch scope
* Project scope
* Restricted access

Access is controlled by the permissions layer.

---

# 40. Teams

Teams are collaborative groups of Members.

Teams are not equivalent to Branches.

A team may be:

* Local to a branch
* Organization-wide
* Cross-branch
* Temporary project team

Examples:

* Athens Development
* Greece Sales
* Global Support
* AI Automation Team

---

# 41. Team Hierarchy

Teams may optionally support:

* Parent team
* Subteam
* Department
* Business unit

Example:

Engineering

→ Backend

→ Frontend

→ DevOps

Teams should remain independent from physical Branch hierarchy.

---

# 42. Team Membership

Members can belong to multiple teams.

A team membership may include:

* Team role
* Start date
* End date
* Primary team flag

---

# 43. Departments

Organizations may define departments such as:

* Sales
* Engineering
* Design
* Finance
* HR
* Support
* Customer Success
* Management

Departments may be represented through teams or organizational units according to organization configuration.

---

# 44. Roles

Roles are reusable authorization bundles.

Examples:

* Owner
* Organization Admin
* Branch Admin
* Manager
* Employee
* Finance Manager
* Sales Manager
* Project Manager
* Support Agent
* Developer
* Customer Success
* External Collaborator
* Viewer

Roles should not be hardcoded to one module.

---

# 45. Role Types

Support:

### System roles

Reserved platform roles such as Owner.

### Organization roles

Defined by the organization.

### Branch roles

Roles scoped to a branch.

### Team roles

Roles scoped to a team.

### Project roles

Operational roles used by Projects.

These authorization concepts must remain interoperable.

---

# 46. Permissions

Permissions represent individual capabilities.

Examples:

* `crm.clients.read`
* `crm.clients.create`
* `crm.clients.update`
* `crm.clients.delete`
* `projects.projects.read`
* `projects.projects.update`
* `projects.members.manage`
* `contracts.contracts.read`
* `contracts.contracts.approve`
* `finance.invoices.read`
* `finance.invoices.create`
* `users.members.manage`
* `organizations.settings.manage`

Permission naming should be standardized across modules.

---

# 47. Permission Actions

Standard actions should include:

* Read
* Create
* Update
* Delete
* Archive
* Restore
* Approve
* Export
* Share
* Manage
* Execute

Modules may define additional domain-specific actions.

---

# 48. Permission Resources

Permissions may target:

* Module
* Resource type
* Specific resource
* Field
* Action

Example:

A user may be allowed to read Projects but not read project financial information.

---

# 49. Resource-Level Permissions

Support granular permissions for sensitive records.

Example:

User can access:

* Project A
* Project B

but not:

* Project C

This should be supported through explicit resource sharing or membership.

---

# 50. Permission Scopes

Every permission can optionally have a scope:

* Organization
* Branch
* Branch hierarchy
* Team
* Project
* Resource

Example:

`finance.expenses.read` → Branch: Athens

while:

`finance.reports.read` → Organization: Deloitte

---

# 51. Role + Scope Model

The authorization model should conceptually evaluate:

**User → Membership → Role → Permission → Scope → Resource**

Example:

John

→ Deloitte Membership

→ Branch Manager

→ `projects.projects.update`

→ Greece Branch

→ Project X

Access is allowed only if all relevant conditions are satisfied.

---

# 52. Permission Inheritance

Support inheritance where appropriate.

Example:

Organization-wide permission

→ inherited by branches

Branch-level permission

→ inherited by child branches

Team permission

→ inherited by team members

Inheritance must be explicit and visible to administrators.

---

# 53. Permission Deny Rules

The system should support explicit deny rules when required.

Deny should be evaluated safely and predictably against inherited access.

Administrators must be able to understand why access was denied.

---

# 54. Permission Evaluation

The authorization engine should evaluate:

 1. User authentication
 2. Active organization
 3. Membership status
 4. Organization status
 5. Roles
 6. Permissions
 7. Scope
 8. Resource ownership
 9. Explicit grants
10. Explicit denies

The result should be deterministic.

---

# 55. Permission Explanation

Administrators should be able to inspect why a user has access.

Example:

> John can edit Project #123 because he is a Project Manager in the Athens branch and Project #123 belongs to Athens.

This is particularly important for enterprise organizations.

---

# 56. Module Access

Organizations should be able to enable or disable access to platform products.

Example:

* CRM
* Projects
* Tasks
* Support
* Finance
* Contracts
* Offers
* Employees
* Documents
* Messaging
* Calendar

A Member may have access to Projects but not Finance.

---

# 57. Product-Level Access

Product access should be evaluated before feature permissions.

Example:

User has:

**Projects = Enabled**

but:

**Finance = Disabled**

Finance permissions therefore have no practical effect until Finance access is enabled.

---

# 58. Feature Permissions

Within a product, access can be granular.

Example:

Finance:

* View invoices
* Create invoices
* Edit invoices
* Approve invoices
* Export financial reports

Projects:

* View projects
* Create projects
* Edit projects
* Manage members
* Manage budgets
* Archive projects

---

# 59. Sensitive Permissions

Certain permissions should require elevated roles.

Examples:

* Export customer data
* View financial data
* View employee compensation
* Delete organization data
* Manage authentication
* Manage permissions
* Approve contracts
* Change billing

---

# 60. Field-Level Permissions

Sensitive fields may require additional permissions.

Examples:

* Employee salary
* Bank account information
* Contract value
* Customer financial information
* Internal notes

A user may be able to access the record without seeing sensitive fields.

---

# 61. Delegated Administration

Organization Owners can delegate administrative responsibilities.

Example:

* HR Admin manages Employees.
* Finance Admin manages Finance.
* IT Admin manages Users.
* Branch Admin manages Athens membership.

Delegated administrators should not automatically gain unrelated permissions.

---

# 62. Branch Administrator

A Branch Admin may manage:

* Branch members
* Branch teams
* Branch settings
* Branch projects
* Branch operational resources

They should not automatically manage the entire organization.

---

# 63. Organization Administrator

Organization Admin can manage organization-wide configuration according to assigned permissions.

Examples:

* Members
* Roles
* Teams
* Branches
* Module access
* Security
* Integrations

---

# 64. Super Admin / Platform Admin

Platform administrators are separate from organization administrators.

Platform admins operate the SaaS platform itself and should not be treated as ordinary organization members.

Platform-level access must be heavily audited.

---

# 65. Invitations

Organizations can invite users by:

* Email
* Invitation link
* Bulk import
* SSO provisioning
* API

Invitation configuration may specify:

* Organization
* Branch
* Team
* Role
* Module access
* Expiration

---

# 66. Invitation Lifecycle

States:

* Pending
* Accepted
* Expired
* Cancelled
* Rejected

Invitation history should be preserved.

---

# 67. Bulk User Provisioning

Enterprise organizations should support bulk provisioning.

Methods may include:

* CSV import
* SCIM
* SSO provisioning
* API

Provisioned users should receive appropriate organization membership and branch assignment.

---

# 68. SCIM

Enterprise identity management should support SCIM where available.

Operations may include:

* Create user
* Update user
* Deactivate user
* Assign group
* Remove group

SCIM synchronization must not bypass platform authorization rules.

---

# 69. SSO

Organizations may configure SSO.

Supported concepts:

* Identity provider
* Domain verification
* SAML/OIDC configuration
* Automatic provisioning
* Group mapping
* Role mapping
* Branch mapping

---

# 70. Domain Verification

Organizations may verify corporate email domains.

Example:

deloitte.com

Domain verification can support:

* SSO setup
* User provisioning
* Invitation controls
* Organization discovery

Domain ownership does not automatically grant organization membership.

---

# 71. Group Mapping

External identity groups can map to:

* Organization roles
* Teams
* Branches
* Module access

Example:

`Deloitte-Greece-Developers`

→ Greece Branch
→ Engineering Team
→ Developer Role
→ Projects + Tasks access

---

# 72. User Sessions

Users should be able to view active sessions where security policy permits.

Information may include:

* Device
* Browser
* Location approximation
* Login time
* Last activity

Users may revoke sessions.

---

# 73. Security Policies

Organizations may configure:

* Password requirements
* MFA requirement
* SSO requirement
* Session duration
* Idle timeout
* Login restrictions
* Allowed domains
* Invitation restrictions

---

# 74. MFA

Support configurable MFA policies.

Examples:

* Optional
* Required for admins
* Required for all users
* Required for sensitive modules

---

# 75. API Access

Users and organizations may have API credentials where supported.

API credentials should have:

* Owner
* Scope
* Permissions
* Expiration
* Rotation
* Audit history

API access must never automatically inherit unlimited human permissions.

---

# 76. Service Accounts

Organizations may create non-human service identities for automation.

Service accounts should have:

* Name
* Owner
* Purpose
* Permissions
* Scope
* Expiration
* Credential rotation

Service accounts should not be treated as ordinary employees.

---

# 77. External Collaborators

External users may be granted limited organization access.

Examples:

* Contractor
* Client stakeholder
* Partner
* Consultant

They should have restricted permissions and explicit scope.

---

# 78. Guest Access

Guest accounts may be restricted to:

* Specific Projects
* Specific Documents
* Specific Channels
* Customer Portal resources

Guest access must not imply organization-wide membership.

---

# 79. Customer Portal Identity

Customer Portal users should be separate from internal Members while still using the underlying identity infrastructure where appropriate.

A client contact can have a portal identity without becoming an internal organization Member.

---

# 80. Employee vs Member

Employee and Member are not synonymous.

A Member means:

> A User has access to an Organization.

An Employee means:

> The organization has an employment/HR record for that person.

A contractor or external collaborator can be a Member without being an Employee.

Employee Management remains the source of truth for employment information.

---

# 81. User Profile vs Employee Profile

User Profile owns identity and authentication information.

Employee Profile owns employment information such as:

* Job title
* Compensation
* Employment dates
* Leave
* HR notes
* Employment status

Do not duplicate these fields in User Management.

---

# 82. Teams vs Branches

The system must not treat Teams and Branches as the same entity.

### Branch

Where the organization operates geographically / organizationally.

### Team

Who works together functionally.

A team can span multiple branches.

---

# 83. Organization Hierarchy

The platform should support an optional organization hierarchy:

**Organization**

→ Branches

→ Departments / Teams

→ Members

The hierarchy should be flexible enough for small companies and multinational organizations.

---

# 84. Branch Hierarchy Example

Example enterprise structure:

**Deloitte**

├── Americas
│ ├── USA
│ └── Canada
│
├── Europe
│ ├── UK
│ ├── Germany
│ ├── France
│ └── Greece
│ ├── Athens
│ └── Thessaloniki
│
└── Asia Pacific
├── Australia
└── Singapore

The hierarchy is configurable rather than hardcoded.

---

# 85. Resource Visibility

Every major resource should be able to express visibility:

* Organization-wide
* Branch
* Branch hierarchy
* Team
* Project
* Explicit users

This provides a consistent security model across modules.

---

# 86. Cross-Branch Collaboration

Members from different branches can collaborate when explicitly permitted.

Examples:

* Shared project
* Shared team
* Shared client
* Global support
* Global finance

Cross-branch access should be visible to administrators.

---

# 87. Organization-Wide Teams

Some teams should not be tied to a branch.

Examples:

* Global IT
* Global Finance
* Executive Team
* Security
* Platform Engineering

These teams can operate across branches.

---

# 88. Branch-Restricted Teams

A team may be limited to one branch.

Example:

**Athens Frontend Team**

Only Athens members can join unless explicitly overridden.

---

# 89. Membership Transfer

A Member can be transferred between branches.

Transfer should preserve:

* User identity
* Organization membership
* Historical records
* Previous branch activity

New branch permissions should apply after the transfer.

---

# 90. Multi-Branch Membership

Some users may permanently belong to multiple branches.

Examples:

* Regional manager
* Global executive
* Traveling consultant
* Shared finance team

The system should support multiple branch assignments without duplicating users.

---

# 91. Branch Manager Scope

Branch Managers should be able to manage only their assigned branch unless additional permissions are granted.

Child-branch access can be inherited when configured.

---

# 92. Role Assignment

Roles may be assigned at:

* Organization level
* Branch level
* Team level
* Project level
* Resource level

The effective permission set is calculated from all applicable assignments.

---

# 93. Temporary Permissions

Support time-limited access.

Example:

A consultant receives Finance access for 30 days.

The permission automatically expires without requiring manual removal.

---

# 94. Delegation

Users may temporarily delegate selected responsibilities.

Example:

A Branch Manager on leave delegates project approval to another manager.

Delegation should have:

* Start date
* End date
* Permissions delegated
* Delegate
* Audit history

---

# 95. Approval Permissions

Sensitive actions should support explicit approval rights.

Examples:

* Contract approval
* Expense approval
* Invoice approval
* Project completion
* Employee leave approval

Approval permissions are separate from general edit permissions.

---

# 96. Separation of Duties

The authorization model should support separation-of-duties rules.

Example:

The person creating an invoice may not be allowed to approve that same invoice.

The person generating a contract may require a different person to approve it.

---

# 97. Permission Conflicts

Administrators should be warned about potentially dangerous combinations.

Examples:

* User creation + security administration
* Finance creation + finance approval
* Contract generation + contract approval
* Employee management + compensation visibility

Policies can define restricted combinations.

---

# 98. Access Reviews

Organizations should be able to periodically review access.

Review workflow:

1. Generate access review.
2. Manager/admin reviews users.
3. Confirm access.
4. Remove unnecessary access.
5. Record completion.

---

# 99. Permission Audit

Audit important authorization changes:

* Role assigned
* Role removed
* Permission granted
* Permission revoked
* Branch assigned
* Branch removed
* Team assigned
* Module enabled
* Module disabled
* Admin promoted
* Admin removed

---

# 100. User Activity Audit

Where platform audit infrastructure supports it, track:

* Login
* Logout
* Resource access
* Sensitive exports
* Permission changes
* Organization switching
* Security changes

Audit retention should follow organization policy.

---

# 101. Data Export Permissions

Exporting data should be separately permissioned from reading data.

Example:

A user may read CRM clients but not export the entire client database.

---

# 102. Delete Permissions

Deletion should be separately permissioned.

Where possible, modules should prefer archive/deactivation over destructive deletion.

---

# 103. Organization Deletion

Organization deletion must be restricted to authorized Owners / platform administrators.

Support:

* Deletion request
* Confirmation
* Grace period
* Data export
* Final deletion
* Audit record

---

# 104. Branch Deletion

Branches should generally be archived rather than deleted.

Historical resources should retain their branch association.

---

# 105. Organization Settings Permissions

Different administrative settings should have independent permissions.

Examples:

* Organization profile
* Branding
* Security
* Billing
* Members
* Roles
* Branches
* Teams
* Integrations
* API

Avoid one universal "Admin" permission when granular delegation is possible.

---

# 106. Permission Management UI

The administration interface should provide:

### Users

List all Members and status.

### Roles

Create and manage roles.

### Permissions

Browse the permission catalog.

### Branches

Manage branch hierarchy.

### Teams

Manage organizational teams.

### Access Reviews

Review effective access.

### Audit

Review security changes.

---

# 107. Member Detail Page

A Member page should show:

* User identity
* Organization membership
* Roles
* Branches
* Teams
* Module access
* Effective permissions
* Active sessions
* Security status
* Recent activity
* Invitations

Sensitive HR information should not appear unless authorized.

---

# 108. Effective Permissions View

Administrators should see a calculated permission summary.

Example:

**Projects**

* Read: Yes
* Create: Yes
* Update: Yes
* Delete: No
* Manage members: Yes

**Finance**

* Read: Yes
* Create: No
* Approve: No

The interface should show the source of each permission.

---

# 109. Role Editor

Role editor should allow administrators to:

* Name role
* Describe role
* Select permissions
* Select scope
* Assign modules
* Define restrictions
* Save
* Publish
* Duplicate
* Deprecate

---

# 110. Permission Catalog UI

Permissions should be grouped by product:

* CRM
* Projects
* Tasks
* Support
* Offers
* Contracts
* Finance
* Employees
* Documents
* Messaging
* Calendar
* Customer Portal
* Administration

---

# 111. Role Templates

Provide reusable default roles.

Examples:

* Owner
* Admin
* Manager
* Employee
* Finance Manager
* Sales Manager
* Project Manager
* Support Agent
* Viewer
* External Collaborator

Organizations can clone and customize them.

---

# 112. Permission Bundles

Permission bundles can simplify administration.

Example:

**Project Manager Bundle**

* Projects read/create/update
* Tasks read/create/update
* Team visibility
* Time visibility
* Project reporting

Bundles can be assigned to roles.

---

# 113. Branch Roles

Organizations can define branch-specific roles.

Example:

**Greece Branch Manager**

* Manage Greece members
* Manage Greece projects
* View Greece finance
* View Greece CRM
* Cannot manage global security

---

# 114. Global Roles

Global roles apply organization-wide.

Examples:

* Global Finance Director
* Global HR Admin
* Global Security Admin
* Global CEO

---

# 115. Resource Sharing

Users should be able to share specific resources with another authorized Member where supported.

Examples:

* Share project
* Share document
* Share conversation
* Share report

Sharing must never bypass organization isolation.

---

# 116. External Organization Collaboration

Cross-organization collaboration should be explicit.

Example:

Deloitte can collaborate with a client organization on a Project without giving the client access to Deloitte's internal organization.

The Customer Portal / external collaboration mechanisms should be used rather than breaking tenant isolation.

---

# 117. Organization Relationships

Organizations may have business relationships:

* Client
* Vendor
* Partner
* Parent company
* Subsidiary
* Affiliate

These relationships belong to CRM / business modules, not the identity layer.

---

# 118. Organization vs Legal Entity

The platform should allow an Organization to represent a company while retaining flexibility for complex corporate structures.

If legal entities need to be modeled separately later, they should not be confused with Branches.

For example:

**Global Group**

→ Legal Entity A
→ Legal Entity B

→ Branch Athens
→ Branch London

The exact legal-entity model can be introduced as a separate domain if required.

---

# 119. Branch vs Subsidiary

A Branch is not automatically a separate legal entity.

The system must allow administrators to mark a branch as:

* Operational branch
* Office
* Regional unit
* Subsidiary reference

without assuming legal status.

If legal/accounting separation is required, Finance should support the appropriate legal-entity model separately.

---

# 120. Localization by Branch

Branches can override organization defaults for:

* Time zone
* Locale
* Language
* Currency display
* Working hours
* Week start
* Date format

Organization defaults remain the fallback.

---

# 121. Branch Business Hours

Each branch can define:

* Working days
* Opening hours
* Holidays
* Local timezone

Calendar and scheduling modules can consume this information.

---

# 122. Branch Holidays

Branches may have local holiday calendars.

Example:

Greece and Germany may have different public holidays.

Calendar and employee scheduling can consume branch-specific holiday context.

---

# 123. Branch Reporting

Organization reporting should support:

* Global
* Region
* Country
* Branch
* Team

Example:

Revenue:

**Global → Europe → Greece → Athens**

The reporting modules remain responsible for calculations.

---

# 124. Branch Filters

Common platform views should support branch filtering where relevant:

* CRM
* Projects
* Tasks
* Finance
* Employees
* Support
* Contracts
* Offers

---

# 125. Default Branch

A Member may have a default branch used for navigation and creation workflows.

Example:

John's default branch = Athens.

The default does not restrict him if he has broader permissions.

---

# 126. Default Team

A Member may have a primary team.

This can be used for:

* Default assignment
* Notifications
* Workload
* Reporting
* Project recommendations

---

# 127. User Preferences

User-specific preferences may include:

* Language
* Time zone
* Theme
* Default organization
* Default branch
* Default team
* Notification preferences
* Dashboard layout

These preferences are not permissions.

---

# 128. Organization Defaults

Organization defaults may include:

* Currency
* Timezone
* Locale
* Working days
* Default roles
* Default project settings
* Default document settings

Users and branches can override defaults where permitted.

---

# 129. Onboarding

Organization onboarding should guide Owners through:

1. Company information
2. Branch setup
3. Teams
4. Users
5. Roles
6. Module activation
7. Security configuration
8. Integrations
9. Branding

---

# 130. Member Onboarding

New Members may receive an onboarding workflow based on role and branch.

Example:

Developer:

* Join engineering team
* Access Projects
* Access Tasks
* Access Messaging
* Complete security setup

---

# 131. Offboarding

When a Member leaves:

1. Disable login.
2. Revoke active sessions.
3. Revoke temporary credentials.
4. Remove active assignments where appropriate.
5. Preserve historical records.
6. Reassign ownership where required.
7. Preserve audit history.

Offboarding should not delete historical work.

---

# 132. Ownership Transfer

Before deactivating a Member, the system should identify resources they own:

* Projects
* Deals
* Tasks
* Contracts
* Support tickets
* Documents
* Teams

Administrators can transfer ownership to another authorized Member.

---

# 133. Reassignment Rules

Organizations may configure automatic reassignment for selected resources.

Example:

When Account Manager leaves:

→ Reassign open deals to Sales Manager.

The platform must not automatically reassign sensitive resources without policy approval.

---

# 134. Audit History Preservation

When a user is deactivated, historical records should continue showing the original actor.

Example:

> Contract approved by John Smith — March 4, 2026

Even if John is no longer an active Member.

---

# 135. Permission Caching

The authorization layer may cache permission evaluations for performance, but permission changes must propagate quickly and predictably.

Critical security changes should invalidate relevant sessions or permission caches immediately.

---

# 136. Authorization API

Internal modules should consume a centralized authorization service.

Capabilities should include:

* Check permission
* Check resource access
* Resolve effective roles
* Resolve branch scope
* Resolve team scope
* Explain authorization result

Modules should not implement independent permission engines.

---

# 137. API Permissions

API requests should include organization context and authenticated identity.

Authorization must evaluate the same permissions model as the UI.

UI hiding is not security.

---

# 138. Webhooks

Identity and organization events should support webhooks.

Examples:

* `user.created`
* `user.updated`
* `user.deactivated`
* `membership.created`
* `membership.updated`
* `membership.revoked`
* `organization.created`
* `organization.updated`
* `branch.created`
* `branch.updated`
* `branch.archived`
* `role.created`
* `role.updated`
* `permission.changed`
* `team.created`
* `team.updated`

---

# 139. Audit Events

Security-sensitive events should produce immutable audit events.

Examples:

* Login
* MFA change
* Role assignment
* Permission change
* Branch assignment
* Organization switch
* User deactivation
* API credential creation
* SSO configuration

---

# 140. Search

Organization administrators should be able to search:

* Users
* Members
* Roles
* Teams
* Branches
* Permissions
* Organizations

Search must respect organization scope.

---

# 141. Organization Admin Dashboard

Dashboard should show:

* Active Members
* Pending invitations
* Branches
* Teams
* Module adoption
* Admins
* Security status
* Recent permission changes
* Access review status
* Suspended accounts

---

# 142. Branch Dashboard

Branch dashboard may show:

* Members
* Teams
* Projects
* Clients
* Support workload
* Revenue context
* Open tasks
* Branch activity

Other modules remain responsible for domain-specific metrics.

---

# 143. Permission Matrix

Organizations should have a matrix view:

| Role | CRM | Projects | Tasks | Support | Finance | Contracts |
| -- | -- | -- | -- | -- | -- | -- |
| Owner | Full | Full | Full | Full | Full | Full |
| Manager | Manage | Manage | Manage | Manage | Read | Manage |
| Employee | Read | Edit | Edit | Read | None | Read |
| Viewer | Read | Read | Read | Read | None | Read |

The matrix should be generated from actual permissions rather than hardcoded.

---

# 144. Branch Permission Matrix

Permissions should also be inspectable by scope.

Example:

| Role | Athens | Thessaloniki | Greece | Global |
| -- | -- | -- | -- | -- |
| Branch Manager | Full | None | None | None |
| Regional Manager | Full | Full | Full | None |
| Global Admin | Full | Full | Full | Full |

---

# 145. Access Simulation

Administrators should be able to select:

* User
* Organization
* Branch
* Resource

and ask:

**"Can this user perform this action?"**

The system should return:

* Allowed / denied
* Reason
* Role responsible
* Scope responsible
* Any deny rule

---

# 146. Security Notifications

Notify administrators about events such as:

* New admin assigned
* MFA disabled
* Large permission change
* Suspicious bulk provisioning
* External collaborator added
* Branch admin changed
* SSO configuration changed

---

# 147. Enterprise Governance

Large organizations should support:

* Access reviews
* Delegated administration
* Branch hierarchy
* Global roles
* Regional roles
* Separation of duties
* SSO
* SCIM
* Audit logs
* Security policies
* Temporary access

---

# 148. Small Organization Experience

The same model should remain simple for a small company.

A 5-person agency may only use:

* One Organization
* No Branches
* Two Teams
* Owner
* Admin
* Employee roles

Advanced enterprise features remain optional.

---

# 149. Organization Templates

Organizations may use setup templates for common structures.

Example:

**Agency Template**

* Sales
* Engineering
* Design
* Support
* Finance
* Management

Default roles and permissions can be generated from the template.

---

# 150. Recommended MVP

### Identity

* Users
* Authentication
* Profiles
* User status
* Sessions

### Organizations

* Organization creation
* Organization profile
* Organization isolation
* Organization switcher
* Owner
* Admin

### Membership

* Invitations
* Memberships
* Roles
* Module access
* Offboarding

### Branches

* Branch creation
* Branch hierarchy
* Branch membership
* Branch managers
* Branch scope
* Branch filtering

### Teams

* Teams
* Team membership
* Team roles

### Permissions

* Permission catalog
* Role-based access
* Scope-based permissions
* Resource access
* Module permissions
* Audit history

### Enterprise

* SSO foundation
* MFA
* API authorization
* External collaborators

---

# 151. Phase 2

* SCIM
* Advanced branch hierarchy
* Delegated administration
* Temporary permissions
* Access reviews
* Permission simulation
* Field-level permissions
* Separation of duties
* Service accounts
* Advanced audit search
* Organization templates
* Branch dashboards

---

# 152. Phase 3

* Enterprise identity governance
* Advanced identity-provider integrations
* Automated access certification
* Risk-based access controls
* Advanced organizational modeling
* Legal-entity support where required
* Cross-organization enterprise federation
* Advanced policy engine
* AI-assisted access reviews

---

# 153. Success Criteria

The module is successful when:

* A User has one global identity.
* A User can belong to multiple Organizations.
* Organizations are fully isolated tenants.
* Organizations can contain many Branches.
* Branches can be hierarchical.
* Branches are not confused with separate Organizations.
* Users can belong to multiple branches.
* Teams can span branches.
* Roles are reusable.
* Permissions are granular.
* Permissions can be scoped.
* Module access is separate from detailed permissions.
* Admin responsibilities can be delegated.
* Enterprise SSO/SCIM can be added without redesigning the identity model.
* Historical records remain intact after offboarding.
* Cross-branch collaboration is possible without weakening tenant isolation.
* External collaborators can access specific resources without becoming full internal users.
* Customer Portal identities remain distinct from internal Members.
* Modules consume one centralized authorization system rather than implementing their own.

---

# 154. Core Relationship Model

The conceptual model should be:

**Platform**

→ Users

→ Organizations

→ Organization Memberships

→ Branches

→ Teams

→ Roles

→ Permissions

→ Scopes

→ Resources

With operational relationships:

**User**

→ Membership

→ Organization

→ Branch / Branches

→ Team / Teams

→ Role / Roles

→ Permissions

→ Access to CRM / Projects / Tasks / Support / Finance / Contracts / Offers / Documents / Messaging / Calendar / other modules

---

# 155. Critical Architectural Distinctions

The implementation must preserve these distinctions:

### User ≠ Member

A User is a global identity. A Member is that identity's access relationship to an Organization.

### Organization ≠ Branch

An Organization is a separate company / tenant. A Branch is a unit inside that company.

### Branch ≠ Team

A Branch represents organizational/geographic structure. A Team represents functional collaboration.

### Member ≠ Employee

A Member has platform access. An Employee has an HR/employment relationship.

### Role ≠ Permission

A Role bundles permissions. A Permission represents an individual capability.

### Authentication ≠ Authorization

Authentication proves who the user is. Authorization determines what that user can access.

### Product Access ≠ Feature Permission

Having access to Projects does not automatically grant every Projects permission.

### Organization Scope ≠ Branch Scope

Organization-wide access and branch-limited access must be independently represented.

---

# 156. Final Architectural Principle

The Users, Members, Organizations, Branches & Permissions module should be the **central identity and authorization foundation** for the entire Agency Operating System.

Its most important structural rule is:

**Organization = isolated company / tenant**

**Branch = organizational unit inside that company**

**User = global human identity**

**Membership = user's relationship with a company**

**Team = functional collaboration group**

**Role = reusable permission bundle**

**Permission = specific capability**

**Scope = where that capability applies**

This allows the platform to work equally well for a 5-person agency and a multinational organization with hundreds of branches, thousands of Members, regional management, global teams, and complex permission boundaries.

The rest of the Agency OS should consume this model rather than recreating users, branches, roles, or permissions independently.
