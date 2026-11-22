/**
 * Built-in template gallery — docs/features/15-notion-business-docs.md §3.
 *
 * Platform system templates (organization_id null, is_system true): every organization sees them in /docs/templates,
 * can start pages from them and can duplicate them into an editable organization template. Upserted by slug from
 * prisma/seed.ts; system templates that are no longer listed here are deleted (pages keep their content).
 *
 * The Markdown is the editor's dialect (app/src/pages/docs/components/editor/nodes.ts + block-nodes.ts):
 * callouts `> [!TIP]`, toggles `<details>`, columns `<div data-columns>`, `[TOC]`, ```mermaid and ```math blocks.
 */
import type { PrismaClient } from '../../src/generated/prisma';
import { cols, RICH_TEMPLATES, toggle } from './docs-templates-rich';

type Category = 'COMPANY' | 'PROJECTS' | 'MEETINGS' | 'ENGINEERING' | 'PRODUCT' | 'OPERATIONS' | 'PEOPLE' | 'SALES' | 'MARKETING' | 'PERSONAL' | 'OTHER';
type PageType = 'GENERAL' | 'POLICY' | 'PROCEDURE' | 'RUNBOOK' | 'MEETING_NOTES' | 'DECISION_RECORD' | 'HANDBOOK_CHAPTER' | 'ONBOARDING_GUIDE' | 'OFFBOARDING_GUIDE' | 'FAQ';

export interface SystemTemplate {
    slug: string;
    name: string;
    description: string;
    icon: string;
    category: Category;
    page_type: PageType;
    featured?: boolean;
    review_days?: number;
    md: string;
}

const FENCE = '```';

const BASE_TEMPLATES: SystemTemplate[] = [
    // ---- Company ----------------------------------------------------------------------------------------------------
    {
        slug: 'company-wiki', name: 'Company wiki', icon: 'building-2', category: 'COMPANY', page_type: 'GENERAL', featured: true,
        description: 'A home for everything about the company: mission, teams, policies and where to find things.',
        md: `> [!TIP]
> Start here. Link every team's space and the pages people look for most.

[TOC]

## Mission

*Why we exist, in one or two sentences.*

${cols(`### Company\n\n- Mission and values\n- Org chart\n- Office locations`, `### Teams\n\n- Engineering\n- Sales\n- Operations`, `### Policies\n\n- Code of conduct\n- Expenses\n- Time off`)}

## Values

1. **Customers first** — *what this means day to day*
2. **Own it** — *what this means day to day*
3. **Be direct** — *what this means day to day*

## Most-read pages

- *Link a page with @*

${toggle('FAQ: where do I ask for help?', '*Answer: which channel, which person, response time.*')}
`,
    },
    {
        slug: 'employee-handbook', name: 'Employee handbook', icon: 'book-open', category: 'COMPANY', page_type: 'HANDBOOK_CHAPTER', review_days: 365,
        description: 'Working hours, time off, benefits, equipment and conduct — the handbook every new hire reads.',
        md: `[TOC]

## Welcome

*A short note from leadership.*

## How we work

| Topic | Policy |
| --- | --- |
| Working hours | *Core hours and flexibility* |
| Remote work | *Who, where, how often* |
| Communication | *Chat vs. email vs. meetings* |

## Time off

${toggle('Vacation', '*Days per year, how to request, approval.*')}

${toggle('Sick leave', '*How to report, documentation needed.*')}

${toggle('Public holidays', '*Which calendar applies.*')}

## Benefits

- *Health insurance*
- *Learning budget*
- *Equipment*

> [!IMPORTANT]
> Questions about this handbook go to People Ops.
`,
    },
    {
        slug: 'company-policy', name: 'Policy', icon: 'shield-check', category: 'COMPANY', page_type: 'POLICY', review_days: 365,
        description: 'A formal policy with purpose, scope, rules, exceptions and an owner — ready for acknowledgement.',
        md: `> [!NOTE]
> **Owner:** *name* · **Applies to:** *everyone / a team* · **Effective:** *date*

## Purpose

*Why this policy exists and the risk it reduces.*

## Scope

*Who and what it covers. What it does not cover.*

## Policy

1. *Rule*
2. *Rule*
3. *Rule*

## Exceptions

*How to request an exception and who approves it.*

## Violations

*What happens if the policy is not followed.*

## Related

- *Link related policies and procedures*
`,
    },
    {
        slug: 'okrs', name: 'OKRs', icon: 'target', category: 'COMPANY', page_type: 'GENERAL',
        description: 'Quarterly objectives and measurable key results, with owners and a mid-quarter check-in.',
        md: `> [!TIP]
> 3–5 objectives, each with 2–4 key results you can measure.

## Objective 1 — *ambitious, qualitative*

| Key result | Owner | Start | Target | Now |
| --- | --- | --- | --- | --- |
| *KR 1* | | | | |
| *KR 2* | | | | |

## Objective 2 — *ambitious, qualitative*

| Key result | Owner | Start | Target | Now |
| --- | --- | --- | --- | --- |
| *KR 1* | | | | |

## Mid-quarter check-in

${toggle('What is on track', '- ')}

${toggle('What is at risk and why', '- ')}
`,
    },

    // ---- Projects ---------------------------------------------------------------------------------------------------
    {
        slug: 'project-brief', name: 'Project brief', icon: 'rocket', category: 'PROJECTS', page_type: 'GENERAL', featured: true,
        description: 'Goal, scope, milestones, team and risks on one page — align everyone before kickoff.',
        md: `${cols(`**Owner**\n\n*name*`, `**Status**\n\n*Planning*`, `**Target date**\n\n*date*`)}

## Problem

*What is broken or missing, for whom, and how we know.*

## Goal

*What success looks like. One measurable outcome.*

## Scope

${cols(`### In scope\n\n- \n- `, `### Out of scope\n\n- \n- `)}

## Milestones

- [ ] Kickoff
- [ ] First version
- [ ] Launch
- [ ] Review results

## Team

| Role | Person |
| --- | --- |
| Lead | |
| Design | |
| Engineering | |

## Risks

> [!WARNING]
> *Biggest risk and how we reduce it.*
`,
    },
    {
        slug: 'project-kickoff', name: 'Project kickoff', icon: 'flag', category: 'PROJECTS', page_type: 'MEETING_NOTES',
        description: 'Agenda for the first meeting of a project: context, roles, plan, ways of working.',
        md: `## Agenda

1. Why this project (5 min)
2. Goals and success metrics (10 min)
3. Roles and responsibilities (10 min)
4. Plan and milestones (15 min)
5. How we work together (10 min)
6. Questions (10 min)

## Roles (RACI)

| Area | Responsible | Accountable | Consulted | Informed |
| --- | --- | --- | --- | --- |
| | | | | |

## Ways of working

- **Status updates:** *weekly, where*
- **Decisions:** *who decides, where we record them*
- **Channel:** *#project-name*

## Action items

- [ ]
`,
    },
    {
        slug: 'weekly-status-update', name: 'Weekly status update', icon: 'calendar', category: 'PROJECTS', page_type: 'GENERAL',
        description: 'Green / yellow / red status, what shipped, what is next and what is blocked.',
        md: `> [!NOTE]
> **Overall status:** On track · At risk · Off track

${cols(`### Done this week\n\n- `, `### Next week\n\n- `, `### Blocked\n\n- `)}

## Metrics

| Metric | Last week | This week |
| --- | --- | --- |
| | | |

## Decisions needed

- [ ]
`,
    },

    // ---- Meetings ---------------------------------------------------------------------------------------------------
    {
        slug: 'meeting-notes', name: 'Meeting notes', icon: 'pen-line', category: 'MEETINGS', page_type: 'MEETING_NOTES', featured: true,
        description: 'Agenda, notes, decisions and action items with owners — the classic.',
        md: `${cols(`**Date**\n\n*date*`, `**Attendees**\n\n*@mention people*`)}

## Agenda

1.
2.

## Notes

-

## Decisions

> [!IMPORTANT]
> *What we decided and why.*

## Action items

- [ ] *Task* — *owner* — *due*
`,
    },
    {
        slug: 'one-on-one', name: '1:1 notes', icon: 'users', category: 'MEETINGS', page_type: 'MEETING_NOTES',
        description: 'A running 1:1 doc: talking points from both sides, feedback, growth and follow-ups.',
        md: `${cols(`### Their topics\n\n- `, `### My topics\n\n- `)}

## How are things going?

*Energy, workload, anything blocking.*

## Feedback

${toggle('Feedback for them', '- ')}

${toggle('Feedback for me', '- ')}

## Growth

*Goals, skills, next step in their career.*

## Follow-ups

- [ ]
`,
    },
    {
        slug: 'team-sync', name: 'Weekly team sync', icon: 'repeat', category: 'MEETINGS', page_type: 'MEETING_NOTES',
        description: 'Round of updates, metrics, blockers and announcements for a recurring team meeting.',
        md: `## Announcements

-

## Updates

| Person | Last week | This week | Blockers |
| --- | --- | --- | --- |
| | | | |

## Discussion

${toggle('Topic 1', '*Notes*', 3)}

${toggle('Topic 2', '*Notes*', 3)}

## Action items

- [ ]
`,
    },
    {
        slug: 'retrospective', name: 'Retrospective', icon: 'messages-square', category: 'MEETINGS', page_type: 'MEETING_NOTES',
        description: 'What went well, what did not, what to try next — with actions that actually get done.',
        md: `> [!TIP]
> Everyone writes silently for 5 minutes, then we group and vote.

${cols(`### Went well\n\n- `, `### Didn't go well\n\n- `, `### Try next\n\n- `)}

## Top 3 to discuss

1.
2.
3.

## Actions

- [ ] *Action* — *owner*

## Last retro's actions

- [ ] *Did we do them?*
`,
    },

    // ---- Engineering ------------------------------------------------------------------------------------------------
    {
        slug: 'technical-design', name: 'Technical design doc', icon: 'code', category: 'ENGINEERING', page_type: 'DECISION_RECORD', featured: true,
        description: 'RFC-style design: context, proposal with a diagram, alternatives, rollout and open questions.',
        md: `${cols(`**Author**\n\n*name*`, `**Reviewers**\n\n*@mention*`, `**Status**\n\n*Draft*`)}

[TOC]

## Context

*What problem are we solving? What constraints do we have?*

## Goals and non-goals

${cols(`### Goals\n\n- `, `### Non-goals\n\n- `)}

## Proposal

*How it works.*

${FENCE}mermaid
flowchart LR
  Client --> API
  API --> Queue
  Queue --> Worker
  Worker --> DB[(Database)]
${FENCE}

## Alternatives considered

${toggle('Option A', '*Why not.*')}

${toggle('Option B', '*Why not.*')}

## Rollout

- [ ] Behind a feature switch in staging
- [ ] Migrate data
- [ ] Enable for all

## Open questions

-
`,
    },
    {
        slug: 'incident-postmortem', name: 'Incident postmortem', icon: 'siren', category: 'ENGINEERING', page_type: 'GENERAL', featured: true,
        description: 'Blameless postmortem: impact, timeline, root cause, what went well and follow-up actions.',
        md: `> [!CAUTION]
> **Severity:** *SEV-1/2/3* · **Duration:** *start – end* · **Customers affected:** *number*

## Summary

*Two sentences: what happened and the impact.*

## Timeline

| Time | Event |
| --- | --- |
| | Alert fired |
| | Incident declared |
| | Mitigated |
| | Resolved |

## Root cause

*The 5 whys.*

${FENCE}mermaid
sequenceDiagram
  participant U as User
  participant S as Service
  participant D as Database
  U->>S: Request
  S->>D: Query
  D--xS: Timeout
  S-->>U: 500 error
${FENCE}

${cols(`### What went well\n\n- `, `### What went wrong\n\n- `)}

## Action items

- [ ] *Prevent* — *owner* — *due*
- [ ] *Detect sooner* — *owner* — *due*

> [!NOTE]
> Blameless: we look at systems and processes, not at people.
`,
    },
    {
        slug: 'runbook', name: 'Runbook', icon: 'terminal', category: 'ENGINEERING', page_type: 'RUNBOOK', review_days: 90,
        description: 'Step-by-step operational procedure with prerequisites, commands, checks and rollback.',
        md: `> [!WARNING]
> Read the whole runbook before starting. Stop and escalate if a check fails.

## When to use

*Symptoms or alert names that lead here.*

## Prerequisites

- [ ] Access to *system*
- [ ] *Tool* installed

## Steps

1. **Check the current state**

${FENCE}bash
# command
${FENCE}

2. **Apply the fix**

${FENCE}bash
# command
${FENCE}

3. **Verify** — *what you should see*

## Rollback

${toggle('How to undo', '1. ')}

## Escalation

*Who to call, in what order.*
`,
    },
    {
        slug: 'release-notes', name: 'Release notes', icon: 'sparkles', category: 'ENGINEERING', page_type: 'GENERAL',
        description: 'What is new, improved and fixed in a release — written for customers.',
        md: `## Highlights

> [!TIP]
> *The one change customers will love most.*

## New

-

## Improved

-

## Fixed

-

${toggle('Internal notes (migrations, flags)', '- ')}
`,
    },

    // ---- Product ----------------------------------------------------------------------------------------------------
    {
        slug: 'product-requirements', name: 'Product requirements (PRD)', icon: 'clipboard-list', category: 'PRODUCT', page_type: 'GENERAL', featured: true,
        description: 'Problem, users, requirements by priority, success metrics and launch plan.',
        md: `${cols(`**PM**\n\n*name*`, `**Status**\n\n*Discovery*`, `**Launch**\n\n*date*`)}

[TOC]

## Problem

*Who has it, how often, how painful. Include evidence.*

## Users and jobs to be done

| User | Job | Today's workaround |
| --- | --- | --- |
| | | |

## Requirements

| Priority | Requirement | Notes |
| --- | --- | --- |
| Must | | |
| Should | | |
| Could | | |

## User flow

${FENCE}mermaid
flowchart TD
  A[Open page] --> B{Has data?}
  B -- Yes --> C[Show list]
  B -- No --> D[Show empty state]
${FENCE}

## Success metrics

- *Metric and target*

## Out of scope

-

## Launch plan

- [ ] Beta with *n* customers
- [ ] Docs and help center
- [ ] Announcement
`,
    },
    {
        slug: 'launch-checklist', name: 'Launch checklist', icon: 'list-checks', category: 'PRODUCT', page_type: 'PROCEDURE',
        description: 'Everything to check before, during and after a launch, by team.',
        md: `${toggle('Before launch', `- [ ] Feature complete and tested
- [ ] Docs and help articles
- [ ] Pricing and billing ready
- [ ] Support team trained
- [ ] Announcement drafted`, 2)}

${toggle('Launch day', `- [ ] Enable for everyone
- [ ] Publish announcement
- [ ] Monitor errors and metrics`, 2)}

${toggle('After launch', `- [ ] Collect feedback
- [ ] Review metrics after 2 weeks
- [ ] Retrospective`, 2)}
`,
    },

    // ---- Operations -------------------------------------------------------------------------------------------------
    {
        slug: 'standard-operating-procedure', name: 'Standard operating procedure', icon: 'cog', category: 'OPERATIONS', page_type: 'PROCEDURE', featured: true, review_days: 180,
        description: 'A repeatable process: purpose, roles, steps, quality checks and records.',
        md: `> [!NOTE]
> **Owner:** *name* · **Frequency:** *daily / weekly / on request* · **Time needed:** *minutes*

## Purpose

*What this procedure achieves.*

## Roles

| Role | Responsibility |
| --- | --- |
| | |

## Steps

1.
2.
3.

## Quality checks

- [ ]
- [ ]

## Records

*What to log, where.*
`,
    },
    {
        slug: 'vendor-evaluation', name: 'Vendor evaluation', icon: 'scale', category: 'OPERATIONS', page_type: 'DECISION_RECORD',
        description: 'Compare vendors on weighted criteria and record the decision.',
        md: `## Need

*What we are buying and why.*

## Criteria

| Criterion | Weight | Vendor A | Vendor B | Vendor C |
| --- | --- | --- | --- | --- |
| Price | 30% | | | |
| Features | 30% | | | |
| Support | 20% | | | |
| Security | 20% | | | |
| **Score** | | | | |

${cols(`### Vendor A\n\n\n\n`, `### Vendor B\n\n\n\n`, `### Vendor C\n\n\n\n`)}

## Decision

> [!IMPORTANT]
> *Chosen vendor and why.*
`,
    },

    // ---- People -----------------------------------------------------------------------------------------------------
    {
        slug: 'new-hire-onboarding', name: 'New hire onboarding', icon: 'graduation-cap', category: 'PEOPLE', page_type: 'ONBOARDING_GUIDE', featured: true,
        description: 'First day, first week, first month — accounts, people to meet and goals.',
        md: `> [!TIP]
> Welcome! Work through this page with your buddy. Tick things off as you go.

${cols(`**Manager**\n\n*@mention*`, `**Buddy**\n\n*@mention*`, `**Start date**\n\n*date*`)}

${toggle('Day 1', `- [ ] Laptop and accounts
- [ ] Read the employee handbook
- [ ] Lunch with your buddy`, 2)}

${toggle('Week 1', `- [ ] Meet your team (1:1s)
- [ ] Tour of the product
- [ ] First small task`, 2)}

${toggle('Month 1', `- [ ] Own a project
- [ ] 30-day check-in with your manager`, 2)}

## People to meet

| Person | Why |
| --- | --- |
| | |

## Useful links

-
`,
    },
    {
        slug: 'job-description', name: 'Job description', icon: 'briefcase', category: 'PEOPLE', page_type: 'GENERAL',
        description: 'Role summary, responsibilities, requirements and what we offer.',
        md: `${cols(`**Team**\n\n*team*`, `**Location**\n\n*remote / office*`, `**Type**\n\n*full-time*`)}

## About the role

*Two or three sentences.*

## What you will do

-
-

## What you bring

-
-

## Nice to have

-

## What we offer

-
`,
    },
    {
        slug: 'interview-scorecard', name: 'Interview scorecard', icon: 'star', category: 'PEOPLE', page_type: 'GENERAL',
        description: 'Structured questions and scores per competency, with a clear hire / no-hire.',
        md: `**Candidate:** *name* · **Role:** *role* · **Interviewer:** *name*

| Competency | Question | Score (1–4) | Evidence |
| --- | --- | --- | --- |
| *Skill* | | | |
| *Collaboration* | | | |
| *Ownership* | | | |

## Recommendation

> [!IMPORTANT]
> **Strong hire / Hire / No hire / Strong no hire** — *why*
`,
    },

    // ---- Sales & marketing ------------------------------------------------------------------------------------------
    {
        slug: 'account-plan', name: 'Account plan', icon: 'handshake', category: 'SALES', page_type: 'GENERAL', featured: true,
        description: 'Key account overview: stakeholders, goals, opportunities, risks and next steps.',
        md: `${cols(`**Account**\n\n*company*`, `**Owner**\n\n*@mention*`, `**Annual value**\n\n*amount*`)}

## Their business

*What they do, their goals this year.*

## Stakeholders

| Name | Role | Attitude | Last contact |
| --- | --- | --- | --- |
| | Decision maker | | |
| | Champion | | |

## Opportunities

-

## Risks

> [!WARNING]
> *Churn signals or competitors.*

## Next steps

- [ ]
`,
    },
    {
        slug: 'sales-call-notes', name: 'Sales call notes', icon: 'mail', category: 'SALES', page_type: 'MEETING_NOTES',
        description: 'Discovery questions, pain points, budget, timeline and next step for a sales call.',
        md: `**Company:** *name* · **Attendees:** *names*

## Discovery

${toggle('What problem are you trying to solve?', '- ')}

${toggle('How do you handle it today?', '- ')}

${toggle('Who decides and what is the budget?', '- ')}

${toggle('What is the timeline?', '- ')}

## Next step

- [ ] *Next step and date*
`,
    },
    {
        slug: 'campaign-brief', name: 'Campaign brief', icon: 'megaphone', category: 'MARKETING', page_type: 'GENERAL', featured: true,
        description: 'Goal, audience, message, channels, budget and timeline for a marketing campaign.',
        md: `${cols(`**Owner**\n\n*name*`, `**Launch**\n\n*date*`, `**Budget**\n\n*amount*`)}

## Goal

*One measurable goal.*

## Audience

*Who, what they care about, where they are.*

## Key message

> [!TIP]
> *One sentence people should remember.*

## Channels

| Channel | Content | Owner | Date |
| --- | --- | --- | --- |
| Email | | | |
| Social | | | |
| Blog | | | |

## Results

*Filled in after the campaign.*
`,
    },
    {
        slug: 'blog-post', name: 'Blog post', icon: 'pencil', category: 'MARKETING', page_type: 'GENERAL',
        description: 'Outline, draft and review checklist for a blog post or article.',
        md: `> [!NOTE]
> **Keyword:** *main keyword* · **Audience:** *who* · **Publish date:** *date*

## Outline

1. Hook
2. Problem
3. Solution
4. Call to action

## Draft

*Write here.*

## Before publishing

- [ ] Title and meta description
- [ ] Images with alt text
- [ ] Links checked
- [ ] Reviewed by *name*
`,
    },

    // ---- Personal ---------------------------------------------------------------------------------------------------
    {
        slug: 'weekly-planner', name: 'Weekly planner', icon: 'calendar', category: 'PERSONAL', page_type: 'GENERAL', featured: true,
        description: 'Plan your week: top priorities, a day-by-day plan and a Friday review.',
        md: `## Top 3 this week

1.
2.
3.

${cols(`### Mon\n\n- [ ] `, `### Tue\n\n- [ ] `, `### Wed\n\n- [ ] `, `### Thu\n\n- [ ] `, `### Fri\n\n- [ ] `)}

## Friday review

${toggle('What went well?', '- ')}

${toggle('What will I change next week?', '- ')}
`,
    },
    {
        slug: 'learning-notes', name: 'Learning notes', icon: 'lightbulb', category: 'PERSONAL', page_type: 'GENERAL',
        description: 'Notes from a book, course or talk: key ideas, quotes and what you will apply.',
        md: `**Source:** *title, author / link*

## Key ideas

-

## Quotes

>

## Formulas

${FENCE}math
E = mc^2
${FENCE}

## What I will apply

- [ ]
`,
    },
];

/** An empty to-do ("- [ ]" without text) is not a task in Markdown and would show as literal "[ ]": give it a placeholder. */
const fillEmptyTodos = (md: string) => md.replace(/^(\s*- \[ \])[ \t]*$/gm, '$1 To-do');

/** Rich layouts first; a rich template replaces the simple one with the same slug. */
export const SYSTEM_TEMPLATES: SystemTemplate[] = [...RICH_TEMPLATES, ...BASE_TEMPLATES.filter((t) => !RICH_TEMPLATES.some((r) => r.slug === t.slug))].map((t) => ({ ...t, md: fillEmptyTodos(t.md) }));

/** Upsert the gallery (Postgres treats NULL organization_id as distinct, so look up by slug explicitly). */
export async function seedDocsSystemTemplates(prisma: PrismaClient) {
    const slugs = SYSTEM_TEMPLATES.map((t) => t.slug);
    for (const [i, t] of SYSTEM_TEMPLATES.entries()) {
        const data = {
            name: t.name, description: t.description, icon: t.icon, category: t.category, page_type: t.page_type, is_featured: !!t.featured,
            content_markdown: t.md.trim(), default_review_interval_days: t.review_days ?? null, is_system: true, sort_order: i, archived_at: null,
        };
        const existing = await prisma.wikiPageTemplate.findFirst({ where: { organization_id: null, slug: t.slug }, select: { id: true } });
        if (existing) await prisma.wikiPageTemplate.update({ where: { id: existing.id }, data });
        else await prisma.wikiPageTemplate.create({ data: { ...data, organization_id: null, slug: t.slug } });
    }
    const removed = await prisma.wikiPageTemplate.deleteMany({ where: { organization_id: null, slug: { notIn: slugs } } });
    console.log(`docs templates: ${SYSTEM_TEMPLATES.length} upserted, ${removed.count} removed`);
}
