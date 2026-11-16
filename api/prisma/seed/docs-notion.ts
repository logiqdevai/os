/**
 * Docs reseed — wipes ALL Business Docs data of one organization (spaces + pages + versions + comments, templates,
 * checklists, forms, AI index, search log, transfer jobs; cascades do the rest) and seeds a Notion-style workspace:
 * teamspaces, nested pages, favorites, version history, comment threads, page templates.
 *
 *   npx dotenv run -f .env.staging -- npx tsx prisma/seed/docs-notion.ts --email=anna.zoi@yahoo.com
 *
 * Development stage only: the databases hold test data (AGENTS.md). Platform system templates (organization_id null) are kept.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? 'true']));
const EMAIL = args.email ?? 'anna.zoi@yahoo.com';
const prisma: any = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }) });

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page';
const words = (md: string) => (md.trim() ? md.trim().split(/\s+/).length : 0);
const excerpt = (md: string) => md.replace(/[#>*`\-\[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);

interface PageSeed { title: string; icon: string; type?: string; md: string; children?: PageSeed[]; favorite?: boolean; comments?: string[]; edits?: string[] }
interface SpaceSeed { name: string; icon: string; color: string; description: string; kind?: string; pages: PageSeed[] }

const SPACES: SpaceSeed[] = [
  {
    name: 'Getting started', icon: 'sparkles', color: '#2563eb', description: 'How Docs works — blocks, shortcuts, sharing.',
    pages: [
      {
        title: 'Welcome to Docs', icon: 'sparkles', favorite: true,
        md: `# Welcome to Docs\n\nEverything is a **block**. Press \`/\` on an empty line to add text, headings, lists, to-dos, quotes, code and dividers.\n\n## Try it now\n\n- [ ] Type \`/\` and pick *Heading 2*\n- [ ] Select some text to bold or link it\n- [x] Create a page with the **+** in the sidebar\n\n> Pages nest inside pages, as deep as you like.\n\n---\n\nLink to another page with [[Keyboard shortcuts]].`,
        comments: ['Love the new editor — the slash menu is fast.', 'Can we add a page with our brand guidelines here?'],
        children: [
          {
            title: 'Keyboard shortcuts', icon: 'keyboard', favorite: true,
            md: `# Keyboard shortcuts\n\nUse **Ctrl** on Windows/Linux and **⌘** on Mac.\n\n## Pages\n\n- \`Ctrl+K\` — search and jump to any page\n- \`Ctrl+Alt+N\` — new page (inside the current page)\n- \`Ctrl+[\` / \`Ctrl+]\` — go back / forward\n- \`Ctrl+Shift+U\` — go up to the parent page\n- \`Ctrl+S\` — save now\n\n## Blocks\n\n- \`/\` — block menu\n- \`Ctrl+Alt+1/2/3\` — heading 1 / 2 / 3\n- \`Ctrl+Shift+4\` — to-do list\n- \`Ctrl+Shift+5\` — bulleted list\n- \`Ctrl+Shift+6\` — numbered list\n- \`Ctrl+Shift+8\` — code block\n- \`Ctrl+Shift+Up/Down\` — move the block up / down\n- \`Ctrl+D\` — duplicate the block\n\n## Text\n\n- \`Ctrl+B\` bold · \`Ctrl+I\` italic · \`Ctrl+U\` underline\n- \`Ctrl+Shift+S\` strikethrough · \`Ctrl+E\` inline code`,
          },
          {
            title: 'Blocks and the slash menu', icon: 'blocks',
            md: `# Blocks and the slash menu\n\n## Markdown shortcuts\n\nType these at the start of a line:\n\n1. \`# \`, \`## \`, \`### \` for headings\n2. \`- \` or \`* \` for a bulleted list\n3. \`1. \` for a numbered list\n4. \`[] \` for a to-do\n5. \`> \` for a quote\n6. \`---\` for a divider\n\n\`\`\`\nconst block = "code blocks keep their formatting";\n\`\`\``,
          },
        ],
      },
      {
        title: 'Sharing and permissions', icon: 'lock',
        md: `# Sharing and permissions\n\nA page inherits the access of its space. Restrict a page to specific members, teams or roles from **⋯ → Permissions**.\n\n- **View** — read only\n- **Comment** — read and comment\n- **Edit** — change the page\n- **Manage** — change access`,
      },
    ],
  },
  {
    name: 'Company wiki', icon: 'building-2', color: '#16a34a', description: 'Handbook, policies and how we work.', kind: 'DEPARTMENT',
    pages: [
      {
        title: 'Employee handbook', icon: 'book-open', type: 'HANDBOOK_CHAPTER', favorite: true,
        md: `# Employee handbook\n\nThe single source of truth for how we work. Start with [[Remote work policy]].\n\n## Contents\n\n1. Culture and values\n2. Working hours and time off\n3. Tools and access\n4. Security`,
        edits: ['Added security chapter', 'Reworded the introduction'],
        children: [
          { title: 'Remote work policy', icon: 'house', type: 'POLICY', md: `# Remote work policy\n\n## Core hours\n\nBe reachable **10:00–16:00** local time. Outside core hours you are free to schedule your day.\n\n## Equipment\n\n- [x] Laptop provided\n- [x] Monitor stipend (€250)\n- [ ] Home-office desk (request via IT)\n\n> Review this policy every 180 days.` },
          { title: 'Time off and holidays', icon: 'palmtree', type: 'POLICY', md: `# Time off and holidays\n\nEveryone gets **25 days** of paid leave plus public holidays.\n\n1. Request leave at least two weeks ahead\n2. Your manager approves in the People app\n3. Add the dates to the team calendar` },
        ],
      },
      {
        title: 'Onboarding guide', icon: 'rocket', type: 'ONBOARDING_GUIDE',
        md: `# Onboarding guide\n\n## Week 1\n\n- [ ] Set up your laptop and accounts\n- [ ] Read the [[Employee handbook]]\n- [ ] Meet your buddy\n- [ ] Join the team channels\n\n## Week 2\n\n- [ ] Ship your first small change\n- [ ] Shadow a customer call`,
      },
    ],
  },
  {
    name: 'Engineering', icon: 'wrench', color: '#7c3aed', description: 'Runbooks, decisions and architecture notes.', kind: 'TEAM',
    pages: [
      {
        title: 'Runbooks', icon: 'book-marked', type: 'RUNBOOK',
        md: `# Runbooks\n\nStep-by-step guides for operating our systems. Each runbook lists *when to use it*, *steps* and *how to roll back*.`,
        children: [
          { title: 'Deploy to production', icon: 'ship', type: 'RUNBOOK', favorite: true, md: `# Deploy to production\n\n## Before you start\n\n- [ ] CI is green on \`main\`\n- [ ] Migration reviewed\n- [ ] On-call informed\n\n## Steps\n\n1. Tag the release\n2. Run the deploy pipeline\n3. Watch error rate for 15 minutes\n\n\`\`\`bash\nnpm run deploy -- --env production\n\`\`\`\n\n## Roll back\n\nRe-run the pipeline with the previous tag.` },
          { title: 'Incident response', icon: 'siren', type: 'RUNBOOK', md: `# Incident response\n\n1. Acknowledge the alert\n2. Open an incident channel\n3. Assign an incident lead\n4. Communicate every 30 minutes\n5. Write the post-mortem within 48 hours` },
        ],
      },
      {
        title: 'Decision records', icon: 'scale', type: 'DECISION_RECORD',
        md: `# Decision records\n\nWe write down significant decisions so the *why* is not lost.`,
        children: [
          { title: 'ADR-001 Use PostgreSQL', icon: 'database', type: 'DECISION_RECORD', md: `# ADR-001 Use PostgreSQL\n\n**Status:** accepted\n\n## Context\n\nWe need relational integrity and full-text search.\n\n## Decision\n\nUse PostgreSQL with Prisma.\n\n## Consequences\n\n- Strong consistency\n- One database to operate` },
        ],
      },
    ],
  },
  {
    name: 'Meeting notes', icon: 'calendar', color: '#d97706', description: 'Weekly syncs and one-off meetings.', kind: 'TOPIC',
    pages: [
      {
        title: 'Weekly sync', icon: 'repeat', type: 'MEETING_NOTES', md: `# Weekly sync\n\nA running log — newest notes below this page.`,
        children: [
          { title: 'Weekly sync — Nov 10', icon: 'pen-line', type: 'MEETING_NOTES', md: `# Weekly sync — Nov 10\n\n**Attendees:** Anna, Petros, Maria\n\n## Agenda\n\n1. Roadmap review\n2. Docs redesign\n\n## Action items\n\n- [ ] Anna — share the docs mockups\n- [x] Petros — fix the editor autosave\n- [ ] Maria — update the onboarding guide` },
          { title: 'Weekly sync — Nov 17', icon: 'pen-line', type: 'MEETING_NOTES', md: `# Weekly sync — Nov 17\n\n**Attendees:** Anna, Petros\n\n## Notes\n\n- Docs now has a Notion-style editor\n- Sidebar page tree shipped\n\n## Action items\n\n- [ ] Collect feedback on the slash menu` },
        ],
      },
    ],
  },
];

const TEMPLATES = [
  { name: 'Meeting notes', icon: 'pen-line', type: 'MEETING_NOTES', md: `# Meeting notes\n\n**Date:**\n**Attendees:**\n\n## Agenda\n\n1. \n\n## Notes\n\n## Action items\n\n- [ ] ` },
  { name: 'Project brief', icon: 'target', type: 'GENERAL', md: `# Project brief\n\n## Goal\n\n## Scope\n\n- In scope\n- Out of scope\n\n## Milestones\n\n- [ ] \n\n## Risks\n\n> ` },
  { name: 'Decision record', icon: 'scale', type: 'DECISION_RECORD', md: `# Decision\n\n**Status:** proposed\n\n## Context\n\n## Decision\n\n## Consequences\n` },
  { name: 'How-to guide', icon: 'book-open', type: 'PROCEDURE', md: `# How to …\n\n## When to use this\n\n## Steps\n\n1. \n\n## Troubleshooting\n` },
];

async function wipe(org: string) {
  const del = async (label: string, fn: () => Promise<{ count: number }>) => console.log(`  - ${label}: ${(await fn()).count}`);
  console.log('Wiping docs data…');
  await del('checklists', () => prisma.wikiChecklist.deleteMany({ where: { organization_id: org } }));
  await del('forms', () => prisma.customForm.deleteMany({ where: { organization_id: org } }));
  await del('ai suggestions', () => prisma.wikiAiSuggestion.deleteMany({ where: { organization_id: org } }));
  await del('ai index', () => prisma.wikiAiIndexEntry.deleteMany({ where: { organization_id: org } }));
  await del('search log', () => prisma.wikiSearchQuery.deleteMany({ where: { organization_id: org } }));
  await del('transfer jobs', () => prisma.wikiTransferJob.deleteMany({ where: { organization_id: org } }));
  await del('templates', () => prisma.wikiPageTemplate.deleteMany({ where: { organization_id: org } }));
  await del('spaces (+ pages, versions, comments, favorites)', () => prisma.wikiSpace.deleteMany({ where: { organization_id: org } }));
}

async function main() {
  const user = await prisma.user.findFirst({ where: { email: EMAIL } });
  if (!user?.default_organization_id) throw new Error(`User ${EMAIL} or their organization not found`);
  const org: string = user.default_organization_id;
  const members: any[] = await prisma.membership.findMany({ where: { organization_id: org, status: 'ACTIVE' }, orderBy: { created_at: 'asc' } });
  const me = members.find((m) => m.user_id === user.id) ?? members[0];
  if (!me) throw new Error('No active membership');
  const others = members.filter((m) => m.id !== me.id);
  const author = (i: number) => (others.length ? others[i % others.length] : me);

  await wipe(org);

  let pages = 0;
  const seedPage = async (spaceId: string, parent: { id: string; path: string; depth: number } | null, p: PageSeed, order: number, usedSlugs: Set<string>) => {
    let slug = slugify(p.title); for (let n = 2; usedSlugs.has(slug); n++) slug = `${slugify(p.title)}-${n}`; usedSlugs.add(slug);
    const versions = [...(p.edits ?? []), 'Created'].reverse(); // oldest first
    const version = versions.length;
    const now = Date.now();
    const created = await prisma.wikiPage.create({
      data: {
        organization_id: org, space_id: spaceId, parent_page_id: parent?.id ?? null, title: p.title, slug, icon: p.icon, page_type: p.type ?? 'GENERAL',
        status: 'PUBLISHED', content: { format: 'markdown' }, content_markdown: p.md, excerpt: excerpt(p.md), word_count: words(p.md),
        path: parent ? `${parent.path}${parent.id}/` : '', depth: parent ? parent.depth + 1 : 0, sort_order: order,
        owner_membership_id: me.id, current_version_number: version, published_version_number: version, published_at: new Date(now), published_by_membership_id: me.id,
        last_edited_by_membership_id: me.id, last_edited_at: new Date(now - order * 3_600_000), created_by_user_id: user.id,
      },
    });
    for (const [i, summary] of versions.entries()) {
      await prisma.wikiPageVersion.create({
        data: { page_id: created.id, version_number: i + 1, title: p.title, content: { format: 'markdown' }, content_markdown: p.md, change_summary: summary, is_published_snapshot: i + 1 === version, created_by_membership_id: author(i).id, created_at: new Date(now - (versions.length - i) * 86_400_000) },
      });
    }
    if (p.favorite) await prisma.wikiPageFavorite.create({ data: { page_id: created.id, membership_id: me.id, sort_order: pages } });
    let parentComment: string | null = null;
    for (const [i, body] of (p.comments ?? []).entries()) {
      const c: any = await prisma.wikiPageComment.create({ data: { page_id: created.id, author_membership_id: author(i).id, body } });
      if (i === 0) parentComment = c.id;
      else if (parentComment) await prisma.wikiPageComment.update({ where: { id: c.id }, data: { parent_comment_id: parentComment } });
    }
    pages++;
    const self = { id: created.id, path: created.path, depth: created.depth };
    for (const [i, child] of (p.children ?? []).entries()) await seedPage(spaceId, self, child, i, usedSlugs);
  };

  for (const [si, s] of SPACES.entries()) {
    const space = await prisma.wikiSpace.create({
      data: { organization_id: org, name: s.name, slug: slugify(s.name), description: s.description, icon: s.icon, color: s.color, kind: s.kind ?? 'TOPIC', owner_membership_id: me.id, sort_order: si, created_by_user_id: user.id },
    });
    const used = new Set<string>();
    for (const [i, p] of s.pages.entries()) await seedPage(space.id, null, p, i, used);
  }

  for (const [i, t] of TEMPLATES.entries()) {
    await prisma.wikiPageTemplate.create({ data: { organization_id: org, name: t.name, slug: slugify(t.name), icon: t.icon, page_type: t.type, content: { format: 'markdown' }, content_markdown: t.md, sort_order: i, created_by_user_id: user.id } });
  }
  console.log(`Seeded ${SPACES.length} spaces, ${pages} pages, ${TEMPLATES.length} templates for ${EMAIL}.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
