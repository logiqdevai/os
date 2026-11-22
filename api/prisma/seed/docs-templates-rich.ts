/**
 * Rich built-in templates (schedules, programs, planners, dashboards) — the layouts people expect from Notion's gallery:
 * day columns, timetables, agendas, roadmaps (Mermaid gantt), trackers and home dashboards.
 * Merged first into SYSTEM_TEMPLATES (docs-templates.ts); a slug listed here replaces the simpler one of the same name.
 */
import type { SystemTemplate } from './docs-templates';

export const cols = (...columns: string[]) => `<div data-columns>\n${columns.map((c) => `<div data-column>\n\n${c.trim()}\n\n</div>`).join('\n')}\n</div>`;
export const toggle = (summary: string, body: string, level = 0) => `<details${level ? ` data-level="${level}"` : ''}>\n<summary>${summary}</summary>\n\n${body.trim()}\n\n</details>`;
const F = '```';

const day = (name: string) =>
    `### ${name}\n\n| Time | Plan |\n| --- | --- |\n| 09:00 |  |\n| 11:00 |  |\n| 14:00 |  |\n| 16:00 |  |\n\n- [ ] \n- [ ] `;

export const RICH_TEMPLATES: SystemTemplate[] = [
    // ---- Personal: schedules and planners ---------------------------------------------------------------------------
    {
        slug: 'weekly-planner', name: 'Weekly schedule', icon: 'calendar', category: 'PERSONAL', page_type: 'GENERAL', featured: true,
        description: 'A full week at a glance: priorities, a time-blocked plan for every day, habits and a Friday review.',
        md: `> [!TIP]
> Fill the three priorities first, then block time for them. Move unfinished to-dos to next week on Friday.

${cols(`### Top 3 this week\n\n1. \n2. \n3. `, `### Habits\n\n- [ ] Exercise\n- [ ] Read 20 minutes\n- [ ] Plan tomorrow`, `### Don't forget\n\n- \n- `)}

## The week

${cols(day('Monday'), day('Tuesday'), day('Wednesday'))}

${cols(day('Thursday'), day('Friday'), `### Weekend\n\n- [ ] \n- [ ] \n- [ ] \n\n> [!NOTE]\n> One thing just for fun.`)}

## Friday review

${cols(`### Went well\n\n- `, `### To improve\n\n- `, `### Next week\n\n- [ ] `)}
`,
    },
    {
        slug: 'daily-planner', name: 'Daily planner', icon: 'sun', category: 'PERSONAL', page_type: 'GENERAL', featured: true,
        description: 'Time-blocked day with priorities, to-dos, notes and an evening reflection.',
        md: `${cols(
            `## Schedule\n\n| Time | What |\n| --- | --- |\n| 07:00 | Morning routine |\n| 08:00 |  |\n| 09:00 | **Deep work** |\n| 10:00 | **Deep work** |\n| 11:00 |  |\n| 12:00 | Lunch |\n| 13:00 |  |\n| 14:00 |  |\n| 15:00 |  |\n| 16:00 |  |\n| 17:00 | Wrap up |\n| 18:00 |  |`,
            `## Priorities\n\n1. \n2. \n3. \n\n## To-do\n\n- [ ] \n- [ ] \n- [ ] \n- [ ] \n\n## Tracker\n\n- [ ] Water\n- [ ] Walk\n- [ ] Sleep before 23:00\n\n> [!NOTE]\n> Today's focus: one sentence.`,
        )}

## Notes

*Ideas, things to remember, loose thoughts.*

## Evening reflection

${cols(`**Wins**\n\n- `, `**Lessons**\n\n- `, `**Tomorrow**\n\n- [ ] `)}
`,
    },
    {
        slug: 'monthly-planner', name: 'Monthly planner', icon: 'calendar-days', category: 'PERSONAL', page_type: 'GENERAL',
        description: 'Month overview: goals, a week-by-week plan, key dates and budget.',
        md: `[TOC]

${cols(`### Goals\n\n- [ ] \n- [ ] \n- [ ] `, `### Key dates\n\n| Date | What |\n| --- | --- |\n|  |  |\n|  |  |`, `### Budget\n\n| | Planned | Actual |\n| --- | --- | --- |\n| Income |  |  |\n| Fixed |  |  |\n| Savings |  |  |`)}

## Week by week

| Week | Focus | Meetings | Deadlines | Done |
| --- | --- | --- | --- | --- |
| 1 |  |  |  | ☐ |
| 2 |  |  |  | ☐ |
| 3 |  |  |  | ☐ |
| 4 |  |  |  | ☐ |

## Monthly review

${cols(`**Keep**\n\n- `, `**Stop**\n\n- `, `**Start**\n\n- `)}
`,
    },
    {
        slug: 'habit-tracker', name: 'Habit tracker', icon: 'check-square', category: 'PERSONAL', page_type: 'GENERAL',
        description: 'Track habits day by day for a week, with streaks, reasons and a weekly review.',
        md: `> [!TIP]
> Mark a day with an x. Start with three habits so the chain does not break.

## This week

| Habit | Mon | Tue | Wed | Thu | Fri | Sat | Sun | Streak |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Exercise |  |  |  |  |  |  |  |  |
| Read |  |  |  |  |  |  |  |  |
| Water |  |  |  |  |  |  |  |  |
| Meditate |  |  |  |  |  |  |  |  |
| Sleep 8 h |  |  |  |  |  |  |  |  |

${cols(`### Why these habits\n\n*One sentence per habit.*`, `### What gets in the way\n\n- \n- `, `### Rewards\n\n- 7-day streak: \n- 30-day streak: `)}
`,
    },
    {
        slug: 'personal-dashboard', name: 'Personal dashboard', icon: 'layout-dashboard', category: 'PERSONAL', page_type: 'GENERAL',
        description: 'A home page for your day: focus, goals, reading list, quick links and notes — all in columns.',
        md: `> [!NOTE]
> *"The key is not to prioritize what's on your schedule, but to schedule your priorities."*

${cols(
            `## Today\n\n- [ ] \n- [ ] \n- [ ] \n\n## This week\n\n- Mon: \n- Tue: \n- Wed: \n- Thu: \n- Fri: `,
            `## Goals\n\n| Goal | Progress |\n| --- | --- |\n|  | 0% |\n|  | 0% |\n|  | 0% |\n\n## Money\n\n- Savings: \n- This month: `,
            `## Reading list\n\n- [ ] \n- [ ] \n\n## Quick links\n\n- *Link a page with @*\n- *Link a page with @*`,
        )}

## Inbox

*Drop anything here, sort it later.*

${toggle('Someday / maybe', '- ')}
`,
    },

    // ---- Meetings / events: programs and agendas --------------------------------------------------------------------
    {
        slug: 'event-program', name: 'Event program & schedule', icon: 'ticket', category: 'OPERATIONS', page_type: 'GENERAL', featured: true,
        description: 'Conference, workshop or offsite: a timed program per day, speakers, logistics, budget and a run-of-show checklist.',
        md: `> [!IMPORTANT]
> **Event:** *name* · **Date:** *dates* · **Venue:** *place* · **Owner:** *name*

[TOC]

${cols(`### Audience\n\n*Who comes and how many.*`, `### Goals\n\n- \n- `, `### Registration\n\n*Link, deadline, capacity.*`)}

## Program

${toggle('Day 1', `| Time | Session | Speaker | Room |\n| --- | --- | --- | --- |\n| 08:30 | Registration & coffee |  | Lobby |\n| 09:30 | **Opening keynote** |  | Main hall |\n| 10:30 | Break |  |  |\n| 11:00 | Talk |  | Room A |\n| 11:00 | Workshop |  | Room B |\n| 12:30 | Lunch |  | Restaurant |\n| 14:00 | Panel |  | Main hall |\n| 16:00 | Closing & networking |  | Terrace |`)}

${toggle('Day 2', `| Time | Session | Speaker | Room |\n| --- | --- | --- | --- |\n| 09:00 | Talk |  | Main hall |\n| 10:30 | Break |  |  |\n| 11:00 | Workshop |  | Room A |\n| 12:30 | Lunch |  | Restaurant |\n| 14:00 | Lightning talks |  | Main hall |\n| 16:00 | Wrap-up |  | Main hall |`)}

## Speakers

${cols(`**Name**\n\n*Topic*\n\n- [ ] Confirmed\n- [ ] Bio received\n- [ ] Travel booked`, `**Name**\n\n*Topic*\n\n- [ ] Confirmed\n- [ ] Bio received\n- [ ] Travel booked`, `**Name**\n\n*Topic*\n\n- [ ] Confirmed\n- [ ] Bio received\n- [ ] Travel booked`)}

## Logistics & budget

${cols(`### Logistics\n\n- [ ] Venue contract\n- [ ] Catering\n- [ ] AV equipment\n- [ ] Signage\n- [ ] Badges`, `### Budget\n\n| Item | Budget | Actual |\n| --- | --- | --- |\n| Venue |  |  |\n| Catering |  |  |\n| Speakers |  |  |\n| Marketing |  |  |\n| **Total** |  |  |`)}

## Run of show (event day)

| Time | Task | Owner | Done |
| --- | --- | --- | --- |
| 07:00 | Venue access, AV check |  | ☐ |
| 08:00 | Registration desk ready |  | ☐ |
| 09:15 | Speaker briefing |  | ☐ |
| 17:00 | Teardown |  | ☐ |
`,
    },
    {
        slug: 'meeting-agenda', name: 'Meeting agenda (timed)', icon: 'clock', category: 'MEETINGS', page_type: 'MEETING_NOTES',
        description: 'A timed agenda with owners, a decisions column and action items with due dates.',
        md: `${cols(`**Date**\n\n[Nov 22, 2026](date:2026-11-22)`, `**Facilitator**\n\n*@name*`, `**Note taker**\n\n*@name*`, `**Attendees**\n\n*@names*`)}

> [!NOTE]
> **Goal of this meeting:** *one sentence — what is true when we are done?*

## Agenda

| Time | Topic | Owner | Outcome |
| --- | --- | --- | --- |
| 5 min | Check-in and review of last actions |  |  |
| 15 min | Topic 1 |  | Decision / Info |
| 15 min | Topic 2 |  | Decision / Info |
| 10 min | Topic 3 |  | Decision / Info |
| 5 min | Summary and next steps |  |  |

## Notes

${toggle('Topic 1', '- ')}

${toggle('Topic 2', '- ')}

${toggle('Topic 3', '- ')}

## Decisions

- 

## Action items

| Action | Owner | Due | Done |
| --- | --- | --- | --- |
|  |  |  | ☐ |
|  |  |  | ☐ |
`,
    },
    {
        slug: 'offsite-itinerary', name: 'Team offsite itinerary', icon: 'map', category: 'MEETINGS', page_type: 'GENERAL',
        description: 'Plan a multi-day team offsite: schedule per day, travel, rooms, activities and costs.',
        md: `[TOC]

${cols(`### Where\n\n*Venue, address, link*`, `### When\n\n*Arrival – departure*`, `### Who\n\n*Number of people*`)}

## Schedule

${cols(
            `### Day 1 — Arrive\n\n| Time | Plan |\n| --- | --- |\n| 12:00 | Arrivals |\n| 14:00 | Welcome |\n| 16:00 | Kick-off session |\n| 19:00 | Dinner |`,
            `### Day 2 — Work\n\n| Time | Plan |\n| --- | --- |\n| 09:00 | Strategy session |\n| 12:30 | Lunch |\n| 14:00 | Workshops |\n| 17:00 | Free time |\n| 19:30 | Team activity |`,
            `### Day 3 — Close\n\n| Time | Plan |\n| --- | --- |\n| 09:00 | Retro and next steps |\n| 11:00 | Wrap-up |\n| 12:00 | Departure |`,
        )}

## Travel and rooms

| Person | Travel | Room | Dietary |
| --- | --- | --- | --- |
|  |  |  |  |
|  |  |  |  |

## Costs

${cols(`| Item | Cost |\n| --- | --- |\n| Venue |  |\n| Travel |  |\n| Food |  |\n| Activities |  |\n| **Total** |  |`, `> [!TIP]\n> Send travel details and the schedule a week before, and collect dietary needs early.`)}
`,
    },
    {
        slug: 'travel-itinerary', name: 'Trip itinerary', icon: 'plane', category: 'PERSONAL', page_type: 'GENERAL',
        description: 'Flights, stays, a day-by-day plan, packing list and budget for a trip.',
        md: `${cols(`### Flights\n\n| | Out | Back |\n| --- | --- | --- |\n| Date |  |  |\n| Flight |  |  |\n| Time |  |  |`, `### Stay\n\n- **Where:** \n- **Check in:** \n- **Check out:** \n- **Booking:** `, `### Budget\n\n| | Planned | Spent |\n| --- | --- | --- |\n| Travel |  |  |\n| Stay |  |  |\n| Food |  |  |\n| Fun |  |  |`)}

## Day by day

${toggle('Day 1', `| Time | Plan |\n| --- | --- |\n| Morning |  |\n| Afternoon |  |\n| Evening |  |`)}

${toggle('Day 2', `| Time | Plan |\n| --- | --- |\n| Morning |  |\n| Afternoon |  |\n| Evening |  |`)}

${toggle('Day 3', `| Time | Plan |\n| --- | --- |\n| Morning |  |\n| Afternoon |  |\n| Evening |  |`)}

## Packing list

${cols(`**Documents**\n\n- [ ] Passport\n- [ ] Tickets\n- [ ] Insurance`, `**Clothes**\n\n- [ ] \n- [ ] \n- [ ] `, `**Tech**\n\n- [ ] Charger\n- [ ] Adapter\n- [ ] Headphones`)}
`,
    },

    // ---- Projects and planning: roadmaps ----------------------------------------------------------------------------
    {
        slug: 'sprint-planning', name: 'Sprint planning', icon: 'zap', category: 'PROJECTS', page_type: 'GENERAL', featured: true,
        description: 'Sprint goal, capacity, backlog, a day-by-day plan with a timeline and risks.',
        md: `> [!IMPORTANT]
> **Sprint goal:** *one sentence — what will be true at the end of the sprint?*

${cols(`### Dates\n\n**Start:** \n\n**End:** \n\n**Review:** `, `### Capacity\n\n| Person | Days |\n| --- | --- |\n|  |  |\n|  |  |`, `### Risks\n\n- \n- `)}

## Sprint backlog

| Item | Owner | Estimate | Status |
| --- | --- | --- | --- |
|  |  |  | To do |
|  |  |  | To do |
|  |  |  | To do |

## Timeline

${F}mermaid
gantt
    title Sprint timeline
    dateFormat YYYY-MM-DD
    section Build
    Feature A :a1, 2026-11-23, 4d
    Feature B :a2, after a1, 3d
    section Quality
    Testing   :a3, after a2, 2d
    Release   :milestone, after a3, 0d
${F}

## Daily plan

${cols(`### Week 1\n\n- Mon: planning\n- Tue: \n- Wed: \n- Thu: \n- Fri: demo prep`, `### Week 2\n\n- Mon: \n- Tue: \n- Wed: \n- Thu: review\n- Fri: retro`)}

${toggle('Definition of done', '- [ ] Code reviewed\n- [ ] Tests pass\n- [ ] Documented\n- [ ] Deployed to staging')}
`,
    },
    {
        slug: 'project-roadmap', name: 'Project roadmap', icon: 'route', category: 'PROJECTS', page_type: 'GENERAL', featured: true,
        description: 'Quarterly roadmap with a gantt timeline, milestones, owners and a risk register.',
        md: `[TOC]

> [!NOTE]
> **Vision:** *where this project should be in 12 months.*

## Timeline

${F}mermaid
gantt
    title Roadmap
    dateFormat YYYY-MM-DD
    axisFormat %b
    section Discover
    Research        :r1, 2026-12-01, 21d
    Concept         :r2, after r1, 14d
    section Build
    MVP             :b1, after r2, 45d
    Beta            :b2, after b1, 30d
    section Launch
    Go to market    :l1, after b2, 21d
${F}

## By quarter

${cols(`### Q1\n\n- [ ] \n- [ ] \n\n**Outcome:** `, `### Q2\n\n- [ ] \n- [ ] \n\n**Outcome:** `, `### Q3\n\n- [ ] \n- [ ] \n\n**Outcome:** `, `### Q4\n\n- [ ] \n- [ ] \n\n**Outcome:** `)}

## Milestones

| Milestone | Date | Owner | Status |
| --- | --- | --- | --- |
|  |  |  | Planned |
|  |  |  | Planned |

## Risks

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
|  | High | Medium |  |
|  | Medium | Low |  |
`,
    },
    {
        slug: 'product-launch-plan', name: 'Product launch plan', icon: 'rocket', category: 'MARKETING', page_type: 'GENERAL',
        description: 'Countdown schedule T-30 to T+14 with owners per workstream, messaging and a launch-day program.',
        md: `> [!IMPORTANT]
> **Launch date:** [Dec 15, 2026](date:2026-12-15) · **Owner:** *name* · **Goal:** *number to hit*

## Countdown

${cols(
            `### T-30\n\n- [ ] Positioning final\n- [ ] Landing page brief\n- [ ] Press list`,
            `### T-14\n\n- [ ] Assets ready\n- [ ] Emails scheduled\n- [ ] Sales trained`,
            `### T-1\n\n- [ ] Final QA\n- [ ] Status page\n- [ ] Support briefed`,
            `### T+14\n\n- [ ] Results review\n- [ ] Customer feedback\n- [ ] Next steps`,
        )}

## Launch day program

| Time | Action | Owner |
| --- | --- | --- |
| 08:00 | Release to production |  |
| 09:00 | Announcement email |  |
| 09:30 | Social posts |  |
| 10:00 | Blog and press |  |
| 14:00 | Customer calls |  |
| 17:00 | Day-end check-in |  |

## Messaging

${cols(`### One-liner\n\n*What it is in 10 words.*`, `### For whom\n\n*The customer and their problem.*`, `### Proof\n\n- \n- `)}

## Workstreams

| Workstream | Owner | Status |
| --- | --- | --- |
| Product |  | On track |
| Marketing |  | On track |
| Sales |  | On track |
| Support |  | On track |
`,
    },
    {
        slug: 'content-calendar', name: 'Content calendar', icon: 'calendar-range', category: 'MARKETING', page_type: 'GENERAL', featured: true,
        description: 'Plan a month of content across channels with pillars, a weekly grid and a publishing checklist.',
        md: `${cols(`### Content pillars\n\n1. \n2. \n3. `, `### Goals\n\n- Reach: \n- Leads: \n- Engagement: `, `### Channels\n\n- Blog\n- Newsletter\n- LinkedIn\n- YouTube`)}

## Calendar

| Week | Mon | Tue | Wed | Thu | Fri |
| --- | --- | --- | --- | --- | --- |
| 1 | Blog |  | LinkedIn |  | Newsletter |
| 2 |  | Blog | LinkedIn |  | Newsletter |
| 3 | Blog |  | LinkedIn | Video | Newsletter |
| 4 |  | Blog | LinkedIn |  | Newsletter |

## Ideas

${cols(`**Backlog**\n\n- \n- \n- `, `**In progress**\n\n- `, `**Published**\n\n- `)}

## Publishing checklist

- [ ] Title and hook
- [ ] Visual
- [ ] Link and call to action
- [ ] Proofread
- [ ] Scheduled
`,
    },
    {
        slug: 'okr-quarter-plan', name: 'Quarter plan (OKRs)', icon: 'target', category: 'COMPANY', page_type: 'GENERAL',
        description: 'Objectives and key results with owners, a weekly check-in table and a quarter timeline.',
        md: `> [!NOTE]
> Three objectives at most. Every key result has a number, a start value and an owner.

${cols(
            `### Objective 1\n\n| Key result | Start | Target | Now |\n| --- | --- | --- | --- |\n| KR1 |  |  |  |\n| KR2 |  |  |  |\n| KR3 |  |  |  |`,
            `### Objective 2\n\n| Key result | Start | Target | Now |\n| --- | --- | --- | --- |\n| KR1 |  |  |  |\n| KR2 |  |  |  |\n| KR3 |  |  |  |`,
            `### Objective 3\n\n| Key result | Start | Target | Now |\n| --- | --- | --- | --- |\n| KR1 |  |  |  |\n| KR2 |  |  |  |\n| KR3 |  |  |  |`,
        )}

## Weekly check-in

| Week | Confidence | Blockers | Next |
| --- | --- | --- | --- |
| 1 | On track |  |  |
| 2 | On track |  |  |
| 3 | At risk |  |  |
| 4 | At risk |  |  |

## Timeline

${F}mermaid
gantt
    title Quarter
    dateFormat YYYY-MM-DD
    section Objective 1
    Initiative A :2026-01-05, 30d
    section Objective 2
    Initiative B :2026-01-20, 45d
    section Objective 3
    Initiative C :2026-02-10, 40d
${F}
`,
    },

    // ---- People / learning / operations: schedules ------------------------------------------------------------------
    {
        slug: 'study-timetable', name: 'Class & study timetable', icon: 'graduation-cap', category: 'PERSONAL', page_type: 'GENERAL',
        description: 'Weekly timetable by period, a course list with exams, and a revision plan.',
        md: `## Weekly timetable

| Period | Mon | Tue | Wed | Thu | Fri |
| --- | --- | --- | --- | --- | --- |
| 08:00 – 09:30 |  |  |  |  |  |
| 09:45 – 11:15 |  |  |  |  |  |
| 11:30 – 13:00 |  |  |  |  |  |
| Lunch |  |  |  |  |  |
| 14:00 – 15:30 |  |  |  |  |  |
| 15:45 – 17:15 |  |  |  |  |  |

${cols(
            `### Courses\n\n| Course | Teacher | Room |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |\n|  |  |  |`,
            `### Exams & deadlines\n\n| What | Date | Weight |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |`,
        )}

## Revision plan

${cols(`### Week 1\n\n- [ ] \n- [ ] `, `### Week 2\n\n- [ ] \n- [ ] `, `### Week 3\n\n- [ ] \n- [ ] `)}
`,
    },
    {
        slug: 'shift-schedule', name: 'Team shift schedule', icon: 'users', category: 'OPERATIONS', page_type: 'GENERAL',
        description: 'Weekly rota by person and shift, with coverage rules, swaps and time-off requests.',
        md: `> [!NOTE]
> **Coverage rule:** at least *2* people per shift. Swap requests go to *name* 48 hours ahead.

## Week of *date*

| Person | Mon | Tue | Wed | Thu | Fri | Sat | Sun | Hours |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  | Early | Early | Late | Late | Off | Off | Off |  |
|  | Late | Late | Early | Early | Off | Off | Off |  |
|  | Off | Off | Off | Off | Early | Early | Late |  |

${cols(`### Shifts\n\n- **Early:** 07:00 – 15:00\n- **Late:** 13:00 – 21:00\n- **Night:** 21:00 – 07:00`, `### Swaps\n\n| Who | With | Day | Approved |\n| --- | --- | --- | --- |\n|  |  |  | ☐ |`, `### Time off\n\n| Who | From | To | Approved |\n| --- | --- | --- | --- |\n|  |  |  | ☐ |`)}
`,
    },
    {
        slug: 'new-hire-30-60-90', name: 'New hire 30-60-90 plan', icon: 'user-plus', category: 'PEOPLE', page_type: 'ONBOARDING_GUIDE', featured: true,
        description: 'First-week schedule plus 30, 60 and 90 day goals in columns, with people to meet and check-ins.',
        md: `> [!TIP]
> Welcome! This page is yours. Your manager and buddy will update it with you every week.

${cols(`**Start date**\n\n*date*`, `**Manager**\n\n*@name*`, `**Buddy**\n\n*@name*`)}

## First week

| Day | Morning | Afternoon |
| --- | --- | --- |
| Mon | Welcome and equipment | Meet the team |
| Tue | Tools and access | Product overview |
| Wed | Shadow a teammate | First small task |
| Thu | Team meeting | 1:1 with manager |
| Fri | Questions and feedback | Plan for next week |

## 30 · 60 · 90

${cols(
            `### First 30 days\n\n*Learn*\n\n- [ ] Meet everyone\n- [ ] Learn the tools\n- [ ] First contribution`,
            `### Days 31–60\n\n*Contribute*\n\n- [ ] Own a small project\n- [ ] Present to the team\n- [ ] Give feedback on onboarding`,
            `### Days 61–90\n\n*Own*\n\n- [ ] Lead a project\n- [ ] Help a new hire\n- [ ] Set goals for next quarter`,
        )}

## People to meet

| Who | Role | Why | Done |
| --- | --- | --- | --- |
|  |  |  | ☐ |
|  |  |  | ☐ |

## Check-ins

${toggle('Day 30', '**What went well:** \n\n**What was hard:** \n\n**Support needed:** ')}

${toggle('Day 60', '**What went well:** \n\n**What was hard:** \n\n**Support needed:** ')}

${toggle('Day 90', '**What went well:** \n\n**What was hard:** \n\n**Support needed:** ')}
`,
    },
    {
        slug: 'team-home', name: 'Team home', icon: 'house', category: 'COMPANY', page_type: 'GENERAL', featured: true,
        description: 'A team space home page: mission, this week, rituals, key links and who does what.',
        md: `> [!NOTE]
> **Our mission:** *one sentence.*

${cols(
            `## Rituals\n\n| When | What |\n| --- | --- |\n| Mon 09:30 | Weekly sync |\n| Wed 15:00 | Demo |\n| Fri 16:00 | Retro |`,
            `## This quarter\n\n- [ ] Goal 1\n- [ ] Goal 2\n- [ ] Goal 3\n\n## Links\n\n- *Roadmap*\n- *Tasks*\n- *Docs*`,
            `## People\n\n| Name | Focus |\n| --- | --- |\n|  |  |\n|  |  |\n|  |  |`,
        )}

## How we work

${toggle('Communication', '*Channels and response times.*')}

${toggle('Decisions', '*How we decide and where we record it.*')}

${toggle('On-call and support', '*Who is on call this week.*')}

## Updates

${cols(`**This week**\n\n- `, `**Next week**\n\n- `, `**Blockers**\n\n- `)}
`,
    },
];
