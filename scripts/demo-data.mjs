#!/usr/bin/env node
/**
 * Demo data for the test organization, created through the REST API (never the DB directly),
 * so the create/update flows of every module are exercised.
 *
 *   node scripts/demo-data.mjs            (API on http://localhost:3000)
 *   API_URL=http://... node scripts/demo-data.mjs
 *
 * Idempotent-ish: every top-level record is looked up by name/title first and reused when it exists.
 * Every non-2xx response is printed with method, path, status and body; the section continues where it can.
 */

const API = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const OWNER = { email: 'owner@logiqdev.test', password: 'Password123!' };
const MEMBER_PASSWORD = 'Password123!';

let token = null;
let orgId = null;
const failures = [];
const counts = {};

// ---------------------------------------------------------------- helpers

class ApiError extends Error {
    constructor(method, path, status, body) {
        super(`${method} ${path} -> ${status}`);
        this.method = method;
        this.path = path;
        this.status = status;
        this.body = body;
    }
}

async function call(method, path, body, { auth = true, quiet = false, headers = {}, raw = false } = {}) {
    const h = { ...headers };
    if (auth && token) h.authorization = `Bearer ${token}`;
    if (auth && orgId) h['x-organization-id'] = orgId;
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
        h['content-type'] = 'application/json';
        payload = JSON.stringify(body);
    }
    const res = await fetch(API + path, { method, headers: h, body: payload });
    const text = await res.text();
    let data = text;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        /* keep text */
    }
    if (!res.ok) {
        const err = new ApiError(method, path, res.status, data);
        if (!quiet) {
            failures.push(`${method} ${path} -> ${res.status} ${JSON.stringify(data).slice(0, 600)}`);
            console.error(`  ✗ ${method} ${path} -> ${res.status}\n    ${JSON.stringify(data).slice(0, 1500)}`);
        }
        throw err;
    }
    return raw ? res : data;
}

const get = (p, o) => call('GET', p, undefined, o);
const post = (p, b, o) => call('POST', p, b ?? {}, o);
const patch = (p, b, o) => call('PATCH', p, b, o);
const put = (p, b, o) => call('PUT', p, b, o);

/** Unwrap list responses: `{data: [...]}` or a plain array. */
const rows = (r) => (Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : Array.isArray(r?.items) ? r.items : []);

const qs = (o) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null) p.set(k, String(v));
    const s = p.toString();
    return s ? `?${s}` : '';
};

/** Find a row in a list endpoint whose `field` equals `value` (case-insensitive). */
async function findBy(path, field, value, extra = {}) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await get(`${path}${sep}${qs({ search: value, limit: 100, ...extra }).slice(1)}`);
    const v = String(value).toLowerCase();
    return rows(r).find((x) => String(x?.[field] ?? '').toLowerCase() === v) ?? null;
}

/** Look up by name first; create when missing. Counts created vs reused. */
async function ensure(label, lookup, create) {
    let found = null;
    try {
        found = await lookup();
    } catch {
        /* printed already */
    }
    if (found) {
        bump(label, 'reused');
        return found;
    }
    const created = await create();
    bump(label, 'created');
    return created;
}

function bump(label, kind) {
    counts[label] ??= { created: 0, reused: 0 };
    counts[label][kind]++;
}

/** Run a step; failures are already printed by call(), the step just stops. */
async function step(name, fn) {
    try {
        return await fn();
    } catch (e) {
        if (!(e instanceof ApiError)) {
            failures.push(`${name}: ${e.stack ?? e}`);
            console.error(`  ✗ ${name}: ${e.stack ?? e}`);
        }
        return null;
    }
}

const section = (t) => console.log(`\n== ${t}`);
const DAY = 86_400_000;
const now = new Date();
const iso = (d) => d.toISOString();
const day = (offset) => {
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    return new Date(d.getTime() + offset * DAY);
};
const ymd = (offset) => iso(day(offset)).slice(0, 10);
const at = (offset, hour, minute = 0) => {
    const d = day(offset);
    d.setUTCHours(hour, minute, 0, 0);
    return d;
};
/** Monday of the current week (UTC) as a day offset from today. */
const mondayOffset = -((now.getUTCDay() + 6) % 7);
const isWeekend = (offset) => [0, 6].includes(day(offset).getUTCDay());
const pick = (arr, i) => arr[i % arr.length];

async function login(email, password) {
    const r = await post('/auth/email/login', { email, password }, { auth: false });
    return r;
}

// ---------------------------------------------------------------- main

async function main() {
    console.log(`API ${API}`);
    const session = await login(OWNER.email, OWNER.password);
    token = session.access_token;
    orgId = session.user.default_organization_id;
    console.log(`Signed in as ${session.user.email}, org ${orgId}`);

    const ctx = {};
    await admin(ctx);
    await crm(ctx);
    await projects(ctx);
    await tasks(ctx);
    await time(ctx);
    await people(ctx);
    await proposals(ctx);
    await billing(ctx);
    await ledger(ctx);
    await support(ctx);
    await messaging(ctx);
    await docs(ctx);
    await files(ctx);
    await calendar(ctx);
    await campaigns(ctx);
    await automation(ctx);

    section('Summary');
    for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(28)} created ${String(v.created).padStart(3)}  reused ${String(v.reused).padStart(3)}`);
    if (failures.length) {
        console.log(`\n${failures.length} failure(s):`);
        for (const f of failures) console.log(`  - ${f}`);
        process.exitCode = 1;
    } else console.log('\nAll steps succeeded.');
}

// ---------------------------------------------------------------- 01 admin: teams, members

async function admin(ctx) {
    section('Admin: teams, members');
    const branches = rows(await get('/branches'));
    ctx.hq = branches.find((b) => b.is_headquarters) ?? branches[0];

    ctx.branchAthens = await step('branch', () =>
        ensure('branches', () => findBy('/branches', 'name', 'Athens studio'), () => post('/branches', { name: 'Athens studio', code: 'ATH', city: 'Athens', country: 'GR' })),
    );

    const teamDefs = [
        { name: 'Web team', task_key: 'WEB', description: 'Builds client websites and web apps' },
        { name: 'Mobile', task_key: 'APP', description: 'iOS and Android apps' },
        { name: 'Sales', task_key: 'SAL', description: 'New business and account growth', kind: 'DEPARTMENT' },
    ];
    ctx.teams = {};
    for (const t of teamDefs) {
        ctx.teams[t.task_key] = await step(`team ${t.name}`, () => ensure('teams', () => findBy('/teams', 'name', t.name), () => post('/teams', t)));
    }

    const roles = rows(await get('/roles?limit=100'));
    const role = (slug) => roles.find((r) => r.slug === slug)?.id;

    const newMembers = [
        { email: 'elena@logiqdev.test', first_name: 'Elena', last_name: 'Papadaki', role: 'project-manager', team: 'WEB' },
        { email: 'nikos@logiqdev.test', first_name: 'Nikos', last_name: 'Georgiou', role: 'developer', team: 'APP' },
        { email: 'laura@logiqdev.test', first_name: 'Laura', last_name: 'Becker', role: 'sales-manager', team: 'SAL' },
    ];
    for (const m of newMembers) {
        await step(`member ${m.email}`, async () => {
            const members = rows(await get(`/members${qs({ search: m.email })}`));
            if (members.some((x) => x.user?.email === m.email)) return bump('members (invited)', 'reused');
            const inv = await post('/invitations', { emails: [m.email], role_id: role(m.role), team_id: ctx.teams[m.team]?.id, branch_id: ctx.hq?.id, expires_in_days: 7 });
            let result = inv.results?.[0];
            if (result?.status === 'already_invited') result = await post(`/invitations/${result.invitation_id}/resend`);
            if (!result?.invite_url) throw new Error(`no invite_url for ${m.email} (email was sent?) ${JSON.stringify(result)}`);
            const inviteToken = result.invite_url.split('/').pop();
            await post('/auth/email/register', { email: m.email, password: MEMBER_PASSWORD, first_name: m.first_name, last_name: m.last_name, invitation_token: inviteToken }, { auth: false });
            bump('members (invited)', 'created');
        });
    }

    const members = rows(await get('/members?limit=100'));
    ctx.members = members;
    const byEmail = (e) => members.find((m) => m.user?.email === e);
    ctx.m = {
        owner: byEmail('owner@logiqdev.test'),
        kim: byEmail('kim@logiqdev.test'),
        jonas: byEmail('jonas@logiqdev.test'),
        sofia: byEmail('sofia@logiqdev.test'),
        marco: byEmail('marco@logiqdev.test'),
        elena: byEmail('elena@logiqdev.test'),
        nikos: byEmail('nikos@logiqdev.test'),
        laura: byEmail('laura@logiqdev.test'),
    };
    for (const [k, v] of Object.entries(ctx.m)) if (!v) console.warn(`  ! member ${k} not found`);

    // Team membership
    const teamMembers = {
        WEB: ['owner', 'jonas', 'sofia', 'marco', 'elena'],
        APP: ['nikos', 'sofia', 'kim'],
        SAL: ['laura', 'kim', 'owner'],
    };
    for (const [key, people] of Object.entries(teamMembers)) {
        const team = ctx.teams[key];
        if (!team) continue;
        const detail = await step('team detail', () => get(`/teams/${team.id}`));
        const current = new Set((detail?.members ?? []).map((x) => x.membership_id ?? x.membership?.id));
        for (const p of people) {
            const mem = ctx.m[p];
            if (!mem || current.has(mem.id)) continue;
            await step(`team member ${p}`, () => post(`/teams/${team.id}/members`, { membership_id: mem.id }).then(() => bump('team members', 'created')));
        }
    }
}

// ---------------------------------------------------------------- sections filled in below

// ---------------------------------------------------------------- 02 CRM

/** Create, or reuse the record a 409 possible_duplicates points at. */
async function createOrDuplicate(path, body) {
    try {
        return await post(path, body, { quiet: true });
    } catch (e) {
        if (e instanceof ApiError && e.status === 409 && e.body?.code === 'possible_duplicates' && e.body.duplicates?.[0]) return e.body.duplicates[0];
        if (e instanceof ApiError) {
            failures.push(`${e.method} ${e.path} -> ${e.status} ${JSON.stringify(e.body).slice(0, 600)}`);
            console.error(`  ✗ ${e.method} ${e.path} -> ${e.status}\n    ${JSON.stringify(e.body).slice(0, 1500)}`);
        }
        throw e;
    }
}

async function crm(ctx) {
    section('CRM: companies, contacts, leads, deals');
    const m = ctx.m;
    const companyDefs = [
        { name: 'Northwind Retail', type: 'CUSTOMER', domain: 'northwind-retail.example', industry: 'Retail', company_size: '201-500', number_of_employees: 320, city: 'Athens', owner: 'laura' },
        { name: 'Acme Logistics', type: 'CUSTOMER', domain: 'acme-logistics.example', industry: 'Logistics', company_size: '51-200', number_of_employees: 140, city: 'Thessaloniki', owner: 'kim' },
        { name: 'Bluewave Health', type: 'CUSTOMER', domain: 'bluewave-health.example', industry: 'Healthcare', company_size: '501-1000', number_of_employees: 780, city: 'Berlin', country: 'DE', owner: 'laura' },
        { name: 'Helios Energy', type: 'CUSTOMER', domain: 'helios-energy.example', industry: 'Energy', company_size: '1000+', number_of_employees: 2100, city: 'Patras', owner: 'kim' },
        { name: 'Orbit Studios', type: 'PROSPECT', domain: 'orbit-studios.example', industry: 'Media', company_size: '11-50', number_of_employees: 35, city: 'Heraklion', owner: 'laura' },
        { name: 'CloudNest Hosting', type: 'VENDOR', domain: 'cloudnest.example', industry: 'Cloud infrastructure', company_size: '51-200', number_of_employees: 90, city: 'Dublin', country: 'IE', owner: 'owner' },
    ];
    ctx.companies = {};
    for (const c of companyDefs) {
        const company = await step(`company ${c.name}`, () =>
            ensure('crm companies', () => findBy('/crm/companies', 'name', c.name), () =>
                createOrDuplicate('/crm/companies', {
                    name: c.name,
                    legal_name: `${c.name} Ltd`,
                    type: c.type,
                    industry: c.industry,
                    company_size: c.company_size,
                    number_of_employees: c.number_of_employees,
                    currency: 'EUR',
                    website: `https://${c.domain}`,
                    email: `hello@${c.domain}`,
                    phone: '+30 210 555 0100',
                    country: c.country ?? 'GR',
                    address: { line1: '12 Market Street', city: c.city, country: c.country ?? 'GR' },
                    description: `${c.industry} company — demo data`,
                    owner_membership_id: m[c.owner]?.id,
                    team_id: ctx.teams.SAL?.id,
                }),
            ),
        );
        if (company) ctx.companies[c.name] = { ...company, domain: c.domain };
    }
    ctx.customerCompanies = companyDefs.filter((c) => c.type === 'CUSTOMER').map((c) => ctx.companies[c.name]).filter(Boolean);
    ctx.vendorCompanies = companyDefs.filter((c) => c.type === 'VENDOR').map((c) => ctx.companies[c.name]).filter(Boolean);
    const C = (n) => ctx.companies[n];

    const contactDefs = [
        { first_name: 'Maria', last_name: 'Konstantinou', job_title: 'Head of E-commerce', company: 'Northwind Retail', roles: ['PRIMARY', 'DECISION_MAKER'] },
        { first_name: 'Dimitris', last_name: 'Alexiou', job_title: 'IT Manager', company: 'Northwind Retail', roles: ['TECHNICAL'] },
        { first_name: 'Thomas', last_name: 'Wagner', job_title: 'COO', company: 'Acme Logistics', roles: ['PRIMARY', 'EXECUTIVE'] },
        { first_name: 'Sara', last_name: 'Lind', job_title: 'Finance Lead', company: 'Acme Logistics', roles: ['BILLING'] },
        { first_name: 'Julia', last_name: 'Hoffmann', job_title: 'Digital Product Owner', company: 'Bluewave Health', roles: ['PRIMARY', 'PROJECT_STAKEHOLDER'] },
        { first_name: 'Giorgos', last_name: 'Petrou', job_title: 'CTO', company: 'Helios Energy', roles: ['PRIMARY', 'TECHNICAL'] },
        { first_name: 'Anna', last_name: 'Vlachou', job_title: 'Procurement', company: 'Helios Energy', roles: ['BILLING'] },
        { first_name: 'Leo', last_name: 'Marin', job_title: 'Founder', company: 'Orbit Studios', roles: ['PRIMARY', 'DECISION_MAKER'] },
    ];
    ctx.contacts = {};
    for (const c of contactDefs) {
        const company = C(c.company);
        const email = `${c.first_name}.${c.last_name}@${company?.domain ?? 'example.com'}`.toLowerCase();
        const contact = await step(`contact ${c.first_name}`, () =>
            ensure('crm contacts', () => findBy('/crm/contacts', 'email', email), () =>
                createOrDuplicate('/crm/contacts', { first_name: c.first_name, last_name: c.last_name, job_title: c.job_title, company_id: company?.id, email, phone: '+30 694 555 0' + String(100 + c.first_name.length), roles: c.roles, consent: { email: true }, owner_membership_id: m.laura?.id }),
            ),
        );
        if (contact) ctx.contacts[c.first_name] = contact;
    }
    const K = (n) => ctx.contacts[n];

    const settings = await get('/crm/settings');
    const source = (name) => settings.lead_sources?.find((s) => s.name.toLowerCase().includes(name))?.id;
    const leadDefs = [
        { name: 'Pelion Hotels — booking engine', company_name: 'Pelion Hotels', contact_name: 'Kostas Ioannou', email: 'kostas@pelion-hotels.example', estimated_value: 18000, src: 'web', score: 72 },
        { name: 'Zeta Fitness — member app', company_name: 'Zeta Fitness', contact_name: 'Eva Novak', email: 'eva@zeta-fitness.example', estimated_value: 32000, src: 'refer', score: 64 },
        { name: 'Agora Books — Shopify migration', company_name: 'Agora Books', contact_name: 'Petra Ilić', email: 'petra@agora-books.example', estimated_value: 9500, src: 'event', score: 40 },
        { name: 'Orbit Studios — brand site', company_id: C('Orbit Studios')?.id, contact_id: K('Leo')?.id, email: 'leo.marin@orbit-studios.example', estimated_value: 12000, src: 'web', score: 81 },
    ];
    for (const l of leadDefs) {
        await step(`lead ${l.name}`, () =>
            ensure('crm leads', () => findBy('/crm/leads?state=all', 'name', l.name), () =>
                createOrDuplicate('/crm/leads', { name: l.name, company_id: l.company_id, contact_id: l.contact_id, company_name: l.company_name, contact_name: l.contact_name, email: l.email, estimated_value: l.estimated_value, currency: 'EUR', lead_source_id: source(l.src), manual_score: l.score, owner_membership_id: m.laura?.id, next_follow_up_at: iso(at(3, 9)), description: 'Inbound interest — demo data', allow_duplicate: true }),
            ),
        );
    }

    const pipelines = await get('/crm/pipelines');
    const pipeline = pipelines.find((p) => p.is_default) ?? pipelines[0];
    const stage = (name) => pipeline.stages.find((s) => s.name === name)?.id;
    const lossReason = settings.loss_reasons?.find((r) => r.scope !== 'LEAD')?.id;
    const dealDefs = [
        { name: 'Northwind — e-shop redesign', company: 'Northwind Retail', contact: 'Maria', value: 48000, stage: 'Closed Won', outcome: 'won', close: -20 },
        { name: 'Acme — driver mobile app', company: 'Acme Logistics', contact: 'Thomas', value: 65000, stage: 'Closed Won', outcome: 'won', close: -35 },
        { name: 'Bluewave — patient portal phase 2', company: 'Bluewave Health', contact: 'Julia', value: 54000, stage: 'Negotiation', close: 21 },
        { name: 'Helios — energy dashboard', company: 'Helios Energy', contact: 'Giorgos', value: 38000, stage: 'Proposal', close: 30 },
        { name: 'Orbit — brand website', company: 'Orbit Studios', contact: 'Leo', value: 12000, stage: 'Discovery', close: 45 },
        { name: 'Acme — warehouse kiosk', company: 'Acme Logistics', contact: 'Thomas', value: 22000, stage: 'Closed Lost', outcome: 'lost', close: -10 },
    ];
    ctx.deals = {};
    for (const d of dealDefs) {
        const deal = await step(`deal ${d.name}`, async () => {
            const found = await findBy('/crm/deals', 'name', d.name);
            if (found) {
                bump('crm deals', 'reused');
                return found;
            }
            const created = await post('/crm/deals', {
                name: d.name,
                pipeline_id: pipeline.id,
                stage_id: stage('New Opportunity'),
                company_id: C(d.company)?.id,
                primary_contact_id: K(d.contact)?.id,
                owner_membership_id: m.laura?.id,
                project_manager_membership_id: m.elena?.id,
                team_id: ctx.teams.SAL?.id,
                value: d.value,
                currency: 'EUR',
                expected_close_date: ymd(d.close),
                next_step: 'Follow up with the decision maker',
                description: 'Demo deal',
            });
            bump('crm deals', 'created');
            // Walk the pipeline: line items, a stage change, then won/lost.
            await put(`/crm/deals/${created.id}/line-items`, { items: [{ name: 'Design & development', quantity: 1, unit_price: d.value * 0.8 }, { name: 'Project management', quantity: 1, unit_price: d.value * 0.2 }] });
            if (d.outcome === 'won') {
                await post(`/crm/deals/${created.id}/stage`, { stage_id: stage('Proposal') });
                await post(`/crm/deals/${created.id}/won`, { won_note: 'Signed after the second workshop', actual_close_date: ymd(d.close), set_customer: true });
            } else if (d.outcome === 'lost') {
                await post(`/crm/deals/${created.id}/stage`, { stage_id: stage('Qualified') });
                await post(`/crm/deals/${created.id}/lost`, { lost_reason_id: lossReason, lost_reason: 'Went with an in-house team', competitor: 'In-house', actual_close_date: ymd(d.close) });
            } else if (d.stage !== 'New Opportunity') {
                await post(`/crm/deals/${created.id}/stage`, { stage_id: stage(d.stage) });
            }
            await post('/crm/activities', { type: 'MEETING', title: `Discovery call — ${d.company}`, status: 'COMPLETED', deal_id: created.id, company_id: C(d.company)?.id, contact_id: K(d.contact)?.id, starts_at: iso(at(-14, 10)), ends_at: iso(at(-14, 11)), outcome: 'Agreed on scope and next steps', owner_membership_id: m.laura?.id });
            await post('/crm/notes', { entity_type: 'CRM_DEAL', entity_id: created.id, body: `Budget confirmed around **€${d.value.toLocaleString('en')}**. Decision expected by ${ymd(d.close)}.`, pinned: true });
            return created;
        });
        if (deal) ctx.deals[d.name] = deal;
    }
    // One upcoming follow-up activity (once)
    await step('crm activity', () =>
        ensure('crm activities', () => findBy('/crm/activities', 'title', 'Send revised estimate to Helios'), () =>
            post('/crm/activities', { type: 'FOLLOW_UP', title: 'Send revised estimate to Helios', priority: 'HIGH', company_id: C('Helios Energy')?.id, contact_id: K('Giorgos')?.id, deal_id: ctx.deals['Helios — energy dashboard']?.id, starts_at: iso(at(2, 9)), owner_membership_id: m.laura?.id }),
        ),
    );
}

// ---------------------------------------------------------------- 05 projects

async function projects(ctx) {
    section('Projects: projects, members, milestones, risk, status update');
    const m = ctx.m;
    const statuses = await get('/project-statuses');
    const types = await get('/project-types');
    const status = (slug) => statuses.find((s) => s.slug === slug)?.id;
    const type = (slug) => types.find((t) => t.slug === slug)?.id;
    const defs = [
        { name: 'Northwind e-shop redesign', code: 'NWR', company: 'Northwind Retail', team: 'WEB', type: 'website', status: 'in-progress', owner: 'elena', start: -40, end: 50, budget_hours: 560, budget_amount: 48000, members: ['jonas', 'sofia', 'marco'], health: 'HEALTHY' },
        { name: 'Acme driver app', code: 'ACM', company: 'Acme Logistics', team: 'APP', type: 'mobile-app', status: 'in-progress', owner: 'kim', start: -30, end: 70, budget_hours: 760, budget_amount: 65000, members: ['nikos', 'sofia'], health: 'AT_RISK' },
        { name: 'Bluewave patient portal', code: 'BWH', company: 'Bluewave Health', team: 'WEB', type: 'web-application', status: 'planned', owner: 'elena', start: 14, end: 120, budget_hours: 640, budget_amount: 54000, members: ['jonas', 'marco'], health: 'UNKNOWN' },
        { name: 'Helios website care', code: 'HEL', company: 'Helios Energy', team: 'WEB', type: 'maintenance', status: 'in-progress', owner: 'kim', start: -90, end: 275, budget_hours: 120, budget_amount: 6000, members: ['sofia'], health: 'HEALTHY' },
    ];
    ctx.projects = {};
    ctx.projectByCompany = {};
    for (const d of defs) {
        const project = await step(`project ${d.name}`, async () => {
            const found = await findBy('/projects?include_closed=true', 'name', d.name);
            if (found) {
                bump('projects', 'reused');
                return found;
            }
            const p = await post('/projects', {
                name: d.name,
                code: d.code,
                description: `${d.name} for ${d.company} — demo project`,
                type_id: type(d.type),
                status_id: status(d.status),
                company_id: ctx.companies[d.company]?.id,
                owner_membership_id: m[d.owner]?.id,
                team_id: ctx.teams[d.team]?.id,
                branch_id: ctx.hq?.id,
                priority: d.health === 'AT_RISK' ? 'HIGH' : 'MEDIUM',
                visibility: 'CUSTOMER_VISIBLE',
                planned_start: ymd(d.start),
                target_completion: ymd(d.end),
                budget_hours: d.budget_hours,
                budget_amount: d.budget_amount,
                currency: 'EUR',
                health: d.health,
            });
            bump('projects', 'created');
            for (const [i, who] of d.members.entries()) {
                await post(`/projects/${p.id}/members`, { membership_id: m[who]?.id, role_label: i === 0 ? 'Lead developer' : 'Developer', allocation_percent: i === 0 ? 60 : 40 });
                bump('project members', 'created');
            }
            const ms = [
                { name: 'Discovery & UX', status: d.start < -20 ? 'COMPLETED' : 'PLANNED', planned_date: ymd(d.start + 14), actual_date: d.start < -20 ? ymd(d.start + 15) : undefined, progress_percent: d.start < -20 ? 100 : 0, customer_visible: true, is_billing_milestone: true },
                { name: 'Beta release', status: d.start < 0 ? 'IN_PROGRESS' : 'PLANNED', planned_date: ymd(Math.round((d.start + d.end) / 2)), progress_percent: d.start < 0 ? 45 : 0, customer_visible: true },
                { name: 'Launch', status: 'PLANNED', planned_date: ymd(d.end), customer_visible: true, is_billing_milestone: true },
            ];
            for (const [i, x] of ms.entries()) {
                await post(`/projects/${p.id}/milestones`, { ...x, owner_membership_id: m[d.owner]?.id, sort_order: i });
                bump('milestones', 'created');
            }
            return p;
        });
        if (project) {
            ctx.projects[d.code] = project;
            ctx.projectByCompany[d.company] = project;
        }
    }
    const acm = ctx.projects.ACM;
    if (acm) {
        await step('risk', async () => {
            const raid = rows(await get(`/projects/raid${qs({ kind: 'risks', search: 'App store review' })}`));
            if (raid.length) return bump('risks', 'reused');
            await post(`/projects/${acm.id}/risks`, { title: 'App store review may delay launch', description: 'Apple review times have been 5–7 days for logistics apps.', category: 'Schedule', probability: 3, impact: 4, status: 'OPEN', mitigation: 'Submit a TestFlight build two weeks early.', owner_membership_id: m.kim?.id, due_date: ymd(20) });
            bump('risks', 'created');
        });
        await step('status update', async () => {
            const list = await get(`/projects/${acm.id}/status-updates`).catch(() => []);
            if (rows(list).length) return bump('status updates', 'reused');
            const su = await post(`/projects/${acm.id}/status-updates`, {
                summary: 'Driver app is on track for beta; offline sync took longer than planned.',
                period_start: ymd(-7),
                period_end: ymd(0),
                completed_work: '- Login & onboarding\n- Route list screen',
                current_work: '- Offline sync\n- Push notifications',
                upcoming_work: '- Beta build to TestFlight',
                risks_summary: 'App store review time.',
                progress_percent: 40,
                health: 'AT_RISK',
                customer_visible: true,
            });
            await post(`/projects/${acm.id}/status-updates/${su.id}/publish`);
            bump('status updates', 'created');
        });
    }
}

// ---------------------------------------------------------------- 06 tasks

async function tasks(ctx) {
    section('Tasks: tasks, comments, cycle');
    const m = ctx.m;
    const web = ctx.teams.WEB;
    const app = ctx.teams.APP;
    const statusesOf = async (team) => (team ? await get(`/task-statuses${qs({ team_id: team.id })}`) : []);
    const st = { WEB: await statusesOf(web), APP: await statusesOf(app) };
    const sid = (team, slug) => st[team].find((s) => s.slug === slug)?.id;

    // Current WEB cycle (2 weeks from this Monday) — reuse when one exists.
    ctx.cycle = await step('cycle', () =>
        ensure('cycles', async () => rows(await get(`/cycles${qs({ team_id: web?.id, limit: 50 })}`)).find((c) => c.name === 'Sprint — Northwind beta'), () =>
            post('/cycles', { team_id: web?.id, project_id: ctx.projects.NWR?.id, name: 'Sprint — Northwind beta', goal: 'Checkout and product pages ready for beta', starts_at: ymd(mondayOffset), ends_at: ymd(mondayOffset + 13) }),
        ),
    );

    const P = ctx.projects;
    const T = (team, project, title, status, priority, assignee, due, extra = {}) => ({ team, project, title, status, priority, assignee, due, ...extra });
    const defs = [
        T('WEB', 'NWR', 'Set up Next.js storefront skeleton', 'done', 'HIGH', 'jonas', -20),
        T('WEB', 'NWR', 'Design product listing page', 'done', 'MEDIUM', 'marco', -15),
        T('WEB', 'NWR', 'Implement product listing with filters', 'in-review', 'HIGH', 'jonas', 2, { cycle: true, estimate_points: 5 }),
        T('WEB', 'NWR', 'Checkout: address and shipping step', 'in-progress', 'URGENT', 'sofia', 3, { cycle: true, estimate_points: 8 }),
        T('WEB', 'NWR', 'Checkout: Stripe payment step', 'todo', 'HIGH', 'sofia', 8, { cycle: true, estimate_points: 8 }),
        T('WEB', 'NWR', 'Product detail page gallery', 'in-progress', 'MEDIUM', 'marco', 5, { cycle: true, estimate_points: 3 }),
        T('WEB', 'NWR', 'SEO metadata and sitemap', 'todo', 'LOW', 'jonas', 12, { cycle: true, estimate_points: 2 }),
        T('WEB', 'NWR', 'Migrate 4,000 products from Magento', 'backlog', 'MEDIUM', null, 25),
        T('WEB', 'NWR', 'Fix cart badge not updating on mobile Safari', 'todo', 'URGENT', 'jonas', -1, { cycle: true, estimate_points: 1 }),
        T('WEB', 'BWH', 'Patient portal information architecture', 'todo', 'MEDIUM', 'marco', 18),
        T('WEB', 'BWH', 'Accessibility audit plan (WCAG 2.2 AA)', 'backlog', 'MEDIUM', 'elena', 21),
        T('WEB', 'BWH', 'Kick-off workshop agenda', 'done', 'LOW', 'elena', -2),
        T('WEB', 'HEL', 'Monthly plugin and core updates', 'done', 'MEDIUM', 'sofia', -5),
        T('WEB', 'HEL', 'Investigate slow homepage (LCP 4.1s)', 'in-progress', 'HIGH', 'sofia', 1),
        T('WEB', 'HEL', 'Add new tariff page', 'todo', 'MEDIUM', 'jonas', 9),
        T('WEB', null, 'Update agency website case studies', 'backlog', 'LOW', 'marco', 30),
        T('APP', 'ACM', 'Driver login with SMS code', 'done', 'HIGH', 'nikos', -12),
        T('APP', 'ACM', 'Route list screen', 'done', 'HIGH', 'nikos', -6),
        T('APP', 'ACM', 'Offline sync for deliveries', 'in-progress', 'URGENT', 'nikos', 4, { estimate_points: 13 }),
        T('APP', 'ACM', 'Proof of delivery: photo + signature', 'todo', 'HIGH', 'sofia', 10, { estimate_points: 8 }),
        T('APP', 'ACM', 'Push notifications for new routes', 'todo', 'MEDIUM', 'nikos', 14),
        T('APP', 'ACM', 'Crash on Android 12 when camera denied', 'in-review', 'URGENT', 'sofia', 0),
        T('APP', 'ACM', 'TestFlight beta build', 'backlog', 'MEDIUM', 'nikos', 20),
        T('APP', 'ACM', 'App store screenshots and listing copy', 'backlog', 'LOW', 'kim', 24),
        T('APP', null, 'Evaluate React Native 0.80 upgrade', 'backlog', 'LOW', 'nikos', 40),
    ];
    const existing = rows(await get('/tasks?limit=200&archived=false'));
    ctx.tasks = [];
    for (const [i, d] of defs.entries()) {
        const found = existing.find((t) => t.title === d.title);
        if (found) {
            bump('tasks', 'reused');
            ctx.tasks.push({ ...found, def: d });
            continue;
        }
        const task = await step(`task ${d.title}`, async () => {
            const t = await post('/tasks', {
                title: d.title,
                description: `${d.title}.\n\n**Acceptance criteria**\n- Works on desktop and mobile\n- Covered by tests`,
                team_id: ctx.teams[d.team]?.id,
                project_id: d.project ? P[d.project]?.id : undefined,
                priority: d.priority,
                assignee_membership_id: d.assignee ? m[d.assignee]?.id : undefined,
                due_date: ymd(d.due),
                start_date: ymd(Math.min(d.due - 5, 0)),
                estimate_points: d.estimate_points,
                cycle_id: d.cycle ? ctx.cycle?.id : undefined,
                checklist: i % 4 === 0 ? ['Implement', 'Write tests', 'Update docs'] : undefined,
            });
            bump('tasks', 'created');
            // Move through the workflow with an update (exercises PATCH + status change)
            if (d.status !== 'todo') await patch(`/tasks/${t.id}`, { status_id: sid(d.team, d.status) });
            if (i % 3 === 0) {
                await post(`/tasks/${t.id}/comments`, { body: `Picked this up — first draft by ${ymd(d.due - 1)}.`, visibility: 'INTERNAL' });
                bump('task comments', 'created');
            }
            if (d.status === 'in-review') {
                await post(`/tasks/${t.id}/comments`, { body: `@[${m.elena?.user?.display_name ?? 'Elena'}](${m.elena?.id}) ready for review.`, mentions: m.elena ? [m.elena.id] : undefined });
                bump('task comments', 'created');
            }
            return t;
        });
        if (task) ctx.tasks.push({ ...task, def: d });
    }
}

// ---------------------------------------------------------------- 18 time

async function time(ctx) {
    section('Time: entries for the past 2 weeks');
    const m = ctx.m;
    const people = ['jonas', 'sofia', 'marco', 'nikos', 'elena'];
    const from = ymd(-14);
    const to = ymd(0);
    for (const who of people) {
        const mem = m[who];
        if (!mem) continue;
        await step(`time ${who}`, async () => {
            const existing = rows(await get(`/time/entries${qs({ scope: 'all', membership_id: mem.id, from, to, limit: 200 })}`));
            if (existing.length) return bump('time entries', 'reused');
            const mine = ctx.tasks.filter((t) => t.def.assignee === who && t.project_id);
            const pool = mine.length ? mine : ctx.tasks.filter((t) => t.project_id);
            for (let off = -14; off <= 0; off++) {
                if (isWeekend(off)) continue;
                const t1 = pick(pool, off + 20);
                const t2 = pick(pool, off + 21);
                await post('/time/entries', { membership_id: mem.id, date: ymd(off), task_id: t1.id, duration_minutes: 180 + ((off * 37) % 4) * 15, description: `Work on ${t1.title}` });
                await post('/time/entries', { membership_id: mem.id, date: ymd(off), task_id: t2.id, duration_minutes: 150 + ((off * 13) % 3) * 30, description: `Work on ${t2.title}` });
                bump('time entries', 'created');
                bump('time entries', 'created');
                if (off % 5 === 0) {
                    await post('/time/entries', { membership_id: mem.id, date: ymd(off), duration_minutes: 45, description: 'Team stand-ups and planning', is_billable: false, non_billable_category: 'INTERNAL' });
                    bump('time entries', 'created');
                }
            }
        });
    }
}

// ---------------------------------------------------------------- 10 people

async function people(ctx) {
    section('People: employees, leave types, leave requests');
    const m = ctx.m;
    const profile = {
        owner: { job_title: 'Managing director', seniority_level: 'EXECUTIVE', team: 'SAL' },
        kim: { job_title: 'Account manager', seniority_level: 'SENIOR', team: 'SAL' },
        jonas: { job_title: 'Senior engineer', seniority_level: 'SENIOR', team: 'WEB', stack: ['TypeScript', 'React', 'Next.js'] },
        sofia: { job_title: 'Full-stack engineer', seniority_level: 'MID', team: 'WEB', stack: ['TypeScript', 'NestJS', 'React Native'] },
        marco: { job_title: 'Product designer', seniority_level: 'MID', team: 'WEB', stack: ['Figma'] },
        elena: { job_title: 'Project manager', seniority_level: 'LEAD', team: 'WEB' },
        nikos: { job_title: 'Mobile developer', seniority_level: 'MID', team: 'APP', stack: ['Swift', 'Kotlin', 'React Native'] },
        laura: { job_title: 'Sales manager', seniority_level: 'MANAGER', team: 'SAL' },
    };
    const employees = rows(await get('/people/employees?limit=200'));
    ctx.employees = {};
    for (const [who, p] of Object.entries(profile)) {
        const mem = m[who];
        if (!mem) continue;
        const found = employees.find((e) => e.membership_id === mem.id || e.membership?.id === mem.id);
        if (found) {
            bump('employees', 'reused');
            ctx.employees[who] = found;
            continue;
        }
        const e = await step(`employee ${who}`, () =>
            post('/people/employees', {
                membership_id: mem.id,
                job_title: p.job_title,
                seniority_level: p.seniority_level,
                department_team_id: ctx.teams[p.team]?.id,
                primary_branch_id: ctx.hq?.id,
                employment_status: 'ACTIVE',
                employment_type: 'FULL_TIME',
                work_location: who === 'nikos' ? 'REMOTE' : 'HYBRID',
                hire_date: ymd(-400 - who.length * 30),
                weekly_capacity_hours: 40,
                target_utilization_percent: ['owner', 'laura', 'kim'].includes(who) ? 40 : 80,
                technical_stack: p.stack,
                timezone: 'Europe/Athens',
                directory_visible: true,
            }),
        );
        if (e) {
            bump('employees', 'created');
            ctx.employees[who] = e;
        }
    }
    // Managers: engineers report to Elena, sales to the owner
    for (const who of ['jonas', 'sofia', 'marco', 'nikos']) {
        const e = ctx.employees[who];
        if (e && ctx.employees.elena && !e.manager_employee_id) await step('manager', () => patch(`/people/employees/${e.id}`, { manager_employee_id: ctx.employees.elena.id }));
    }

    const types = await get('/people/leave-types');
    let wfh = types.find((t) => t.code === 'WFH');
    if (!wfh) {
        wfh = await step('leave type', () => post('/people/leave-types', { name: 'Training day', code: 'WFH', category: 'TIME_OFF', color: 'violet', is_paid: true, requires_approval: true, allows_half_day: true, deducts_balance: false, min_notice_days: 2 }));
        if (wfh) bump('leave types', 'created');
    } else bump('leave types', 'reused');
    const vac = types.find((t) => t.code === 'VAC');
    const sick = types.find((t) => t.code === 'SICK');

    const requests = [
        { who: 'jonas', type: vac, start: 21, end: 25, reason: 'Family trip', approve: true },
        { who: 'sofia', type: sick, start: -6, end: -6, reason: 'Flu', approve: true },
        { who: 'marco', type: vac, start: 35, end: 39, reason: 'Holiday', approve: false },
        { who: 'nikos', type: wfh, start: 9, end: 9, reason: 'React Native conference', approve: false },
    ];
    const existing = rows(await get('/people/leave-requests?limit=200'));
    for (const r of requests) {
        const emp = ctx.employees[r.who];
        if (!emp || !r.type) continue;
        // Weekend starts would have no working days — shift to the next Monday.
        let s = r.start;
        while (isWeekend(s)) s++;
        let e = Math.max(r.end, s);
        while (isWeekend(e)) e++;
        await step(`leave ${r.who}`, async () => {
            let lr = existing.find((x) => x.employee_id === emp.id && x.leave_type_id === r.type.id && String(x.start_date).slice(0, 10) === ymd(s));
            if (lr) bump('leave requests', 'reused');
            else {
                lr = await post('/people/leave-requests', { employee_id: emp.id, leave_type_id: r.type.id, start_date: ymd(s), end_date: ymd(e), reason: r.reason });
                bump('leave requests', 'created');
            }
            if (r.approve && lr.status === 'PENDING') await post(`/people/leave-requests/${lr.id}/approve`, { note: 'Enjoy!' });
        });
    }
}

// ---------------------------------------------------------------- 03/04 proposals + contracts

async function proposals(ctx) {
    section('Proposals + contracts');
    const m = ctx.m;
    const content = (product, amount) => ({
        sections: [
            { type: 'COVER', title: 'Cover', body: `# ${product}\nPrepared by Logiqdev` },
            { type: 'EXECUTIVE_SUMMARY', title: 'Executive summary', body: `We propose to design and build **${product}** in three phases, with a beta after eight weeks.` },
            { type: 'SCOPE', title: 'Scope', body: '- Discovery and UX\n- Design system\n- Development and QA\n- Launch and hand-over' },
            { type: 'TERMS', title: 'Terms', body: 'Prices exclude VAT. Valid for 30 days.' },
        ],
        line_items: [
            { name: 'Discovery & UX', quantity: 1, unit_price: Math.round(amount * 0.2), tax_percent: 24 },
            { name: 'Development', quantity: Math.round((amount * 0.7) / 85), unit: 'hour', unit_price: 85, tax_percent: 24 },
            { name: 'Website care plan', quantity: 12, unit: 'month', unit_price: 290, tax_percent: 24, is_recurring: true, billing_frequency: 'monthly', is_optional: true },
        ],
        payment_schedule: [
            { name: 'Deposit', trigger: 'ON_ACCEPTANCE', percentage: 40 },
            { name: 'Beta', trigger: 'ON_MILESTONE', percentage: 30, milestone_name: 'Beta release' },
            { name: 'Launch', trigger: 'ON_DELIVERY', percentage: 30 },
        ],
        payment_terms: 'Net 14',
        validity_days: 30,
    });
    const defs = [
        { title: 'Helios — energy dashboard proposal', company: 'Helios Energy', contact: 'Giorgos', deal: 'Helios — energy dashboard', amount: 38000, state: 'draft' },
        { title: 'Bluewave — patient portal phase 2', company: 'Bluewave Health', contact: 'Julia', deal: 'Bluewave — patient portal phase 2', amount: 54000, state: 'sent' },
        { title: 'Northwind — e-shop redesign', company: 'Northwind Retail', contact: 'Maria', deal: 'Northwind — e-shop redesign', amount: 48000, state: 'accepted' },
    ];
    for (const d of defs) {
        await step(`proposal ${d.title}`, async () => {
            let p = await findBy('/proposals', 'title', d.title);
            if (p) bump('proposals', 'reused');
            else {
                p = await post('/proposals', { title: d.title, currency: 'EUR', company_id: ctx.companies[d.company]?.id, contact_id: ctx.contacts[d.contact]?.id, deal_id: ctx.deals[d.deal]?.id, owner_membership_id: m.laura?.id, requires_contract: d.state === 'accepted' });
                bump('proposals', 'created');
                await put(`/proposals/${p.id}/versions/${p.current_version_id}/content`, content(d.title.split(' — ')[1], d.amount));
            }
            if (d.state === 'draft') return;
            const full = await get(`/proposals/${p.id}`);
            let token = null;
            if (full.status === 'DRAFT') {
                const sent = await post(`/proposals/${p.id}/send`, { channels: ['LINK'], message: 'Looking forward to working with you.' });
                token = sent.public_url.split('/').pop();
            }
            if (d.state !== 'accepted') return;
            if (token) {
                await get(`/public/proposals/${token}`, { auth: false });
                await post(`/public/proposals/${token}/decision`, { decision: 'ACCEPTED', signer_name: 'Maria Konstantinou', signer_email: 'maria.konstantinou@northwind-retail.example', signer_title: 'Head of E-commerce', terms_accepted: true }, { auth: false });
            }
            const after = await get(`/proposals/${p.id}`);
            if (after.status !== 'ACCEPTED') return;
            const contracts = rows(await get(`/contracts${qs({ proposal_id: p.id })}`));
            if (contracts.length) return bump('contracts', 'reused');
            await post(`/proposals/${p.id}/convert`, { contract_title: 'Northwind — e-shop redesign agreement' });
            bump('contracts', 'created');
        });
    }
}
// ---------------------------------------------------------------- 08 billing

async function billing(ctx) {
    section('Billing: catalog, profiles, invoices, payments, subscription');
    const taxRates = rows(await get('/finance/tax-rates'));
    ctx.vat = await step('tax rate', () => ensure('tax rates', async () => taxRates.find((t) => t.name === 'VAT 24%'), () => post('/finance/tax-rates', { name: 'VAT 24%', percentage: 24, country: 'GR', is_default: true })));

    const productDefs = [
        { name: 'Web development (hourly)', type: 'DEVELOPMENT_HOURS', unit: 'hour', prices: [{ currency: 'EUR', unit_amount: 85, name: 'Standard rate' }] },
        { name: 'UX design (hourly)', type: 'SERVICE', unit: 'hour', prices: [{ currency: 'EUR', unit_amount: 75, name: 'Standard rate' }] },
        { name: 'Website care plan', type: 'MAINTENANCE_PLAN', unit: 'month', prices: [{ currency: 'EUR', unit_amount: 290, name: 'Monthly', type: 'RECURRING', interval: 'MONTH' }] },
        { name: 'Managed hosting', type: 'SUBSCRIPTION', unit: 'month', prices: [{ currency: 'EUR', unit_amount: 120, name: 'Monthly', type: 'RECURRING', interval: 'MONTH' }] },
    ];
    ctx.products = {};
    for (const p of productDefs) {
        ctx.products[p.name] = await step(`product ${p.name}`, () =>
            ensure('products', () => findBy('/finance/products', 'name', p.name), () => post('/finance/products', { ...p, default_tax_rate_id: ctx.vat?.id, description: `${p.name} — demo catalog item` })),
        );
    }
    // Add a second price to the hourly product once (exercise POST /products/:id/prices).
    const dev = ctx.products['Web development (hourly)'];
    if (dev && !(dev.prices ?? []).some((x) => x.name === 'Rush rate')) {
        await step('price', () => post(`/finance/products/${dev.id}/prices`, { currency: 'EUR', unit_amount: 110, name: 'Rush rate' }).then(() => bump('prices', 'created')));
    }

    // Billing profiles for the customer companies
    ctx.profiles = {};
    for (const c of ctx.customerCompanies ?? []) {
        ctx.profiles[c.name] = await step(`billing profile ${c.name}`, () =>
            ensure(
                'billing profiles',
                () => get(`/finance/billing-profiles/${c.id}`, { quiet: true }).catch(() => null),
                () =>
                    post('/finance/billing-profiles', {
                        company_id: c.id,
                        legal_name: `${c.name} Ltd`,
                        billing_email: `billing@${c.domain}`,
                        billing_address: { line1: '12 Market Street', city: 'Athens', postal_code: '10563', country: 'GR' },
                        vat_number: `EL${String(100000000 + c.name.length * 7919).slice(0, 9)}`,
                        currency: 'EUR',
                        payment_terms_days: 14,
                    }),
            ),
        );
    }

    const P = (name) => ctx.profiles[name];
    const devPrice = dev?.prices?.[0];
    const invoiceDefs = [
        { key: 'draft', company: 'Northwind Retail', issue: 0, due: 14, notes: 'Demo: draft invoice — Discovery phase', lines: [{ description: 'Discovery workshops', quantity: 12, unit_amount: 85 }, { description: 'UX audit', quantity: 8, unit_amount: 75 }] },
        { key: 'sent', company: 'Acme Logistics', issue: -3, due: 11, notes: 'Demo: sent invoice — Sprint 3', lines: [{ description: 'Development sprint 3', quantity: 40, unit_amount: 85 }] },
        { key: 'paid', company: 'Bluewave Health', issue: -20, due: -6, notes: 'Demo: paid invoice — Milestone 1', lines: [{ description: 'Milestone 1 — patient portal design', quantity: 1, unit_amount: 4800 }] },
        { key: 'overdue', company: 'Helios Energy', issue: -45, due: -15, notes: 'Demo: overdue invoice — October support', lines: [{ description: 'Support hours October', quantity: 18, unit_amount: 85 }, { description: 'Managed hosting October', quantity: 1, unit_amount: 120 }] },
    ];
    const existing = rows(await get('/finance/invoices?limit=200'));
    ctx.invoices = {};
    for (const d of invoiceDefs) {
        const profile = P(d.company);
        if (!profile) continue;
        const found = existing.find((i) => i.notes === d.notes);
        if (found) {
            bump('invoices', 'reused');
            ctx.invoices[d.key] = found;
            continue;
        }
        await step(`invoice ${d.key}`, async () => {
            const inv = await post('/finance/invoices', {
                billing_profile_id: profile.id,
                issue_date: ymd(d.issue),
                due_date: ymd(d.due),
                billing_model: 'TIME_AND_MATERIALS',
                project_id: ctx.projectByCompany?.[d.company]?.id,
                notes: d.notes,
                accepted_methods: ['BANK_TRANSFER', 'CARD'],
                lines: d.lines.map((l, i) => ({ ...l, tax_rate_id: ctx.vat?.id, product_id: i === 0 ? dev?.id : undefined, price_id: i === 0 ? devPrice?.id : undefined, unit: 'hour' })),
            });
            bump('invoices', 'created');
            ctx.invoices[d.key] = inv;
            if (d.key === 'draft') return;
            // Finalize through approval (no e-mail). Then the "sent" one is also sent to a dummy address.
            await post(`/finance/invoices/${inv.id}/approve`, { comment: 'Looks good' });
            if (d.key === 'sent') await post(`/finance/invoices/${inv.id}/send`, { to: ['billing@example.com'], message: 'Please find our invoice attached.' });
            if (d.key === 'paid') await post(`/finance/invoices/${inv.id}/payments`, { method_type: 'BANK_TRANSFER', received_at: ymd(-4), reference: 'TRX-88213' });
            if (d.key === 'overdue') await post(`/finance/invoices/${inv.id}/payments`, { amount: 500, method_type: 'BANK_TRANSFER', received_at: ymd(-10), reference: 'Partial payment' });
        });
    }

    // Subscription: managed hosting for Acme
    const hosting = ctx.products['Managed hosting'];
    const acme = P('Acme Logistics');
    if (hosting && acme) {
        await step('subscription', async () => {
            const subs = rows(await get(`/finance/subscriptions${qs({ billing_profile_id: acme.id })}`));
            if (subs.length) return bump('subscriptions', 'reused');
            await post('/finance/subscriptions', { billing_profile_id: acme.id, items: [{ product_id: hosting.id, price_id: hosting.prices?.[0]?.id, quantity: 1 }], start_date: ymd(-10) });
            bump('subscriptions', 'created');
        });
    }
}

// ---------------------------------------------------------------- 09 ledger

async function ledger(ctx) {
    section('Ledger: expenses, recurring expense');
    const cats = await get('/ledger/categories?kind=EXPENSE');
    const cat = (name) => cats.find((c) => c.name === name)?.id;
    const methods = await get('/ledger/payment-methods');
    const card = methods.find((m) => m.name === 'Company card')?.id;
    const bank = methods.find((m) => m.name === 'Business bank account')?.id;
    const vendor = (name) => ctx.vendorCompanies?.find((c) => c.name === name)?.id;

    const expenses = [
        { description: 'AWS — October cloud hosting', category_id: cat('Cloud hosting'), net_amount: 640.5, vat_percent: 0, vat_treatment: 'REVERSE_CHARGE', company_id: vendor('CloudNest Hosting'), transaction_date: ymd(-11), payment_method_id: card, mark_paid: true },
        { description: 'Figma Organization — annual seats', category_id: cat('Software'), net_amount: 1080, vat_percent: 24, transaction_date: ymd(-9), payment_method_id: card, counterparty_name: 'Figma', mark_paid: true },
        { description: 'Office rent — November', category_id: cat('Rent'), net_amount: 2200, vat_percent: 24, transaction_date: ymd(-10), payment_method_id: bank, counterparty_name: 'Kifisias Properties', mark_paid: true },
        { description: 'Google Ads — lead campaign', category_id: cat('Advertising'), gross_amount: 450, vat_percent: 24, transaction_date: ymd(-6), payment_method_id: card, counterparty_name: 'Google Ireland', mark_paid: true },
        { description: 'MacBook Pro for new developer', category_id: cat('Hardware'), net_amount: 2490, vat_percent: 24, transaction_date: ymd(-3), payment_method_id: bank, counterparty_name: 'iStorm', due_date: ymd(10) },
        { description: 'Accounting services — Q3', category_id: cat('Accounting fees'), net_amount: 600, vat_percent: 24, transaction_date: ymd(-30), counterparty_name: 'Papadopoulos & Co', due_date: ymd(-5) },
    ];
    for (const e of expenses) {
        await step(`expense ${e.description}`, () =>
            ensure('ledger expenses', () => findBy('/ledger/records?type=EXPENSE', 'description', e.description), () => post('/ledger/records', { type: 'EXPENSE', currency: 'EUR', ...e })),
        );
    }
    await step('recurring expense', () =>
        ensure('recurring expenses', () => findBy('/ledger/recurring', 'name', 'Internet — office fibre'), () =>
            post('/ledger/recurring', { name: 'Internet — office fibre', description: 'Monthly fibre line for the office', expected_net_amount: 45, vat_percent: 24, category_id: cat('Internet'), payment_method_id: bank, start_date: ymd(-20), interval: 'MONTH', day_of_month: Math.min(28, day(-20).getUTCDate()), due_days: 10 }),
        ),
    );
}
// ---------------------------------------------------------------- 13 support

async function support(ctx) {
    section('Support: tickets, conversations');
    const m = ctx.m;
    const statuses = await get('/support/ticket-statuses');
    const open = statuses.find((s) => s.category === 'OPEN')?.id;
    const waiting = statuses.find((s) => s.category === 'PENDING_CUSTOMER')?.id;
    const tickets = [
        { subject: 'Checkout page shows a blank screen on iOS 17', type: 'BUG', priority: 'URGENT', contact: 'Dimitris', project: 'NWR', assignee: 'jonas', reply: 'Thanks Dimitris — we can reproduce it and a fix is in review.', note: 'Same root cause as the cart badge task.', then: open },
        { subject: 'Add a second admin user for the driver app console', type: 'ACCOUNT', priority: 'NORMAL', contact: 'Thomas', project: 'ACM', assignee: 'kim', reply: 'Done — the invitation is on its way. Can you confirm it arrived?', then: waiting },
        { subject: 'Invoice INV for October: VAT number missing', type: 'BILLING', priority: 'HIGH', contact: 'Anna', assignee: 'owner', reply: 'Apologies — we will reissue the invoice with your VAT number today.' },
        { subject: 'Request: add Greek language to the tariff page', type: 'FEATURE_REQUEST', priority: 'LOW', contact: 'Giorgos', project: 'HEL', assignee: 'sofia' },
    ];
    for (const t of tickets) {
        await step(`ticket ${t.subject}`, () =>
            ensure('support tickets', () => findBy('/support/tickets?state=all', 'subject', t.subject), async () => {
                const c = ctx.contacts[t.contact];
                const ticket = await post('/support/tickets', { subject: t.subject, description: `${t.subject}.\n\nReported by ${c?.first_name ?? 'customer'} by phone.`, type: t.type, priority: t.priority, source: 'MANUAL', requester_contact_id: c?.id, project_id: t.project ? ctx.projects[t.project]?.id : undefined, assignee_membership_id: m[t.assignee]?.id, team_id: ctx.teams[t.project === 'ACM' ? 'APP' : 'WEB']?.id });
                if (t.reply) await post(`/support/tickets/${ticket.id}/replies`, { kind: 'AGENT', body: t.reply, then_status_id: t.then });
                if (t.note) await post(`/support/tickets/${ticket.id}/replies`, { kind: 'INTERNAL_NOTE', body: t.note, mentions: m.elena ? [m.elena.id] : undefined });
                return ticket;
            }),
        );
    }
    const convos = [
        { subject: 'Question about the beta timeline', contact: 'Maria', channel: 'EMAIL', first: 'CUSTOMER', body: 'Hi! Could you share when we can test the new checkout?', reply: 'Hi Maria — the beta will be ready on ' + ymd(10) + '. We will send a link.', status: 'PENDING' },
        { subject: 'Phone call: hosting renewal', contact: 'Sara', channel: 'PHONE', first: 'CUSTOMER', body: 'Sara called to ask whether hosting renews automatically.', reply: 'Yes — the managed hosting subscription renews monthly; you can cancel any time.', status: 'RESOLVED' },
        { subject: 'Welcome to Logiqdev support', contact: 'Julia', channel: 'EMAIL', first: 'AGENT', body: 'Hi Julia, this is your support inbox for the patient portal project. Reply here any time.' },
    ];
    for (const c of convos) {
        await step(`conversation ${c.subject}`, () =>
            ensure('support conversations', () => findBy('/support/conversations', 'subject', c.subject), async () => {
                const conv = await post('/support/conversations', { channel_type: c.channel, subject: c.subject, body: c.body, contact_id: ctx.contacts[c.contact]?.id, first_message_kind: c.first, priority: 'NORMAL' });
                if (c.reply) await post(`/support/conversations/${conv.id}/messages`, { kind: 'AGENT', body: c.reply, then_status: c.status });
                await post(`/support/conversations/${conv.id}/messages`, { kind: 'INTERNAL_NOTE', body: 'Logged for the weekly account review.' });
                return conv;
            }),
        );
    }
}

// ---------------------------------------------------------------- 12 messaging

async function messaging(ctx) {
    section('Messaging: channels, messages, thread');
    const m = ctx.m;
    const ids = (...who) => who.map((w) => m[w]?.id).filter(Boolean);
    const mine = rows(await get('/messaging/channels'));
    const defs = [
        { name: 'general', display: 'general', description: 'Company-wide announcements and chat', members: ids('kim', 'jonas', 'sofia', 'marco', 'elena', 'nikos', 'laura') },
        { name: 'web-team', display: 'web-team', description: 'Web team day-to-day', members: ids('jonas', 'sofia', 'marco', 'elena') },
        { name: 'proj-acme-driver-app', display: 'proj-acme-driver-app', description: 'Acme driver app project', kind: 'PRIVATE', members: ids('kim', 'nikos', 'sofia') },
    ];
    const ch = {};
    for (const d of defs) {
        ch[d.name] = await step(`channel ${d.name}`, () =>
            ensure('channels', async () => mine.find((c) => c.slug === d.name || c.name === d.name) ?? rows(await get(`/messaging/channels/browse${qs({ search: d.name })}`)).find((c) => c.slug === d.name), () =>
                post('/messaging/channels', { name: d.display, kind: d.kind ?? 'PUBLIC', description: d.description, topic: d.description, membership_ids: d.members, ...(d.name === 'general' && { auto_join: true }) }),
            ),
        );
    }
    const msgs = [
        { ch: 'general', id: 'demo-gen-1', body: 'Welcome Elena, Nikos and Laura to the team! 🎉' },
        { ch: 'general', id: 'demo-gen-2', body: 'Reminder: the office is closed on Friday afternoon for the team lunch.' },
        { ch: 'web-team', id: 'demo-web-1', body: `Northwind beta is planned for ${ymd(10)}. @[Jonas](${m.jonas?.id}) can you share the checkout status?`, thread: [{ id: 'demo-web-1-r1', body: 'Address step is done, Stripe step starts tomorrow.' }, { id: 'demo-web-1-r2', body: 'Great, thanks! Let us demo it on Thursday.' }] },
        { ch: 'web-team', id: 'demo-web-2', body: 'Heads-up: Helios homepage LCP regressed to 4.1s, looking into the hero image.' },
        { ch: 'proj-acme-driver-app', id: 'demo-acm-1', body: 'Offline sync PR is up for review.', thread: [{ id: 'demo-acm-1-r1', body: 'Reviewing now.' }] },
    ];
    for (const x of msgs) {
        const channel = ch[x.ch];
        if (!channel) continue;
        await step(`message ${x.id}`, async () => {
            const root = await post(`/messaging/channels/${channel.id}/messages`, { body: x.body, client_message_id: x.id });
            const fresh = !root.reactions?.length && (root.reply_count ?? 0) === 0;
            bump('messages', fresh ? 'created' : 'reused');
            for (const r of x.thread ?? []) {
                await post(`/messaging/channels/${channel.id}/messages`, { body: r.body, parent_message_id: root.id, client_message_id: r.id });
                bump('thread replies', fresh ? 'created' : 'reused');
            }
            if (fresh) await post(`/messaging/messages/${root.id}/reactions`, { emoji: '👍' });
        });
    }
}

// ---------------------------------------------------------------- 15 docs

async function docs(ctx) {
    section('Docs: space + pages');
    const space = await step('space', () =>
        ensure('docs spaces', () => findBy('/docs/spaces', 'name', 'Engineering handbook'), () =>
            post('/docs/spaces', { name: 'Engineering handbook', description: 'How we build, review and ship', icon: '🛠️', kind: 'DEPARTMENT', team_id: ctx.teams.WEB?.id, default_visibility: 'ORGANIZATION' }),
        ),
    );
    if (!space) return;
    const pages = [
        { title: 'Onboarding', page_type: 'ONBOARDING_GUIDE', body: '# Welcome\n\n1. Get access to GitHub and Figma\n2. Read [[Code review guidelines]]\n3. Pair with a buddy for the first week' },
        { title: 'Code review guidelines', page_type: 'PROCEDURE', body: '# Code review\n\n- Keep PRs under 400 lines\n- At least one approval\n- CI must be green', parent: 'Onboarding' },
        { title: 'Release checklist', page_type: 'RUNBOOK', body: '# Release checklist\n\n- [ ] Changelog updated\n- [ ] Staging smoke test\n- [ ] Tag and deploy\n- [ ] Notify the client' },
        { title: 'Weekly sync — notes', page_type: 'MEETING_NOTES', body: `# Weekly sync ${ymd(mondayOffset)}\n\n**Decisions**\n- Northwind beta on ${ymd(10)}\n\n**Actions**\n- Elena: send the status update` },
    ];
    const ids = {};
    for (const p of pages) {
        const page = await step(`page ${p.title}`, () =>
            ensure('docs pages', () => findBy(`/docs/pages?space_id=${space.id}`, 'title', p.title), () =>
                post('/docs/pages', { space_id: space.id, parent_page_id: p.parent ? ids[p.parent] : undefined, title: p.title, content_markdown: p.body, page_type: p.page_type, publish: p.page_type !== 'MEETING_NOTES' }),
            ),
        );
        if (page) ids[p.title] = page.id;
    }
}

// ---------------------------------------------------------------- 17 files

async function files(ctx) {
    section('Files: folder + upload');
    const tree = await get('/files/folders/tree');
    let folder = tree.find((f) => f.name === 'Client assets' && !f.parent_folder_id);
    if (folder) bump('folders', 'reused');
    else {
        folder = await step('folder', () => post('/files/folders', { name: 'Client assets', description: 'Logos, briefs and exports from clients' }));
        if (folder) bump('folders', 'created');
    }
    if (!folder) return;
    const sub = tree.find((f) => f.name === 'Northwind' && f.parent_folder_id === folder.id);
    if (sub) bump('folders', 'reused');
    else await step('subfolder', () => post('/files/folders', { name: 'Northwind', parent_folder_id: folder.id, company_id: ctx.companies['Northwind Retail']?.id }).then(() => bump('folders', 'created')));

    await step('upload', async () => {
        const docs = rows(await get(`/files/documents${qs({ folder_id: folder.id, search: 'kickoff-notes' })}`));
        if (docs.length) return bump('documents', 'reused');
        const form = new FormData();
        const text = `Kick-off notes\n==============\nDate: ${ymd(-30)}\nAttendees: Maria, Dimitris, Elena, Jonas\n\n- Beta on ${ymd(10)}\n- Weekly status every Friday\n`;
        form.append('file', new Blob([text], { type: 'text/plain' }), 'kickoff-notes.txt');
        form.append('folder_id', folder.id);
        form.append('title', 'kickoff-notes');
        form.append('description', 'Notes from the Northwind kick-off');
        await post('/files/upload', form);
        bump('documents', 'created');
    });
}

// ---------------------------------------------------------------- 19 calendar

async function calendar(ctx) {
    section('Calendar: events this week');
    const m = ctx.m;
    const from = iso(day(mondayOffset));
    const to = iso(day(mondayOffset + 7));
    const existing = rows(await get(`/calendar/events${qs({ from, to })}`));
    const att = (...who) => who.filter((w) => m[w]).map((w) => ({ membership_id: m[w].id, role: 'REQUIRED' }));
    const events = [
        { title: 'Weekly sync', d: mondayOffset, h: 9, len: 30, attendees: att('jonas', 'sofia', 'marco', 'elena', 'nikos'), recurrence: { freq: 'WEEKLY', byday: [1], count: 12 }, color: 'info' },
        { title: 'Northwind checkout demo', d: mondayOffset + 3, h: 14, len: 60, attendees: att('jonas', 'sofia', 'elena'), company_id: ctx.companies['Northwind Retail']?.id, project_id: ctx.projects.NWR?.id, meeting_url: 'https://meet.example.com/northwind', color: 'success' },
        { title: 'Acme driver app — sprint review', d: mondayOffset + 4, h: 11, len: 45, attendees: att('nikos', 'sofia', 'kim'), project_id: ctx.projects.ACM?.id, color: 'violet' },
        { title: 'Helios proposal walkthrough', d: mondayOffset + 2, h: 16, len: 60, attendees: att('laura', 'kim'), company_id: ctx.companies['Helios Energy']?.id, location: 'Helios HQ, Patras', color: 'warning' },
        { title: '1:1 Elena / Jonas', d: mondayOffset + 1, h: 12, len: 30, attendees: att('elena', 'jonas'), visibility: 'PRIVATE' },
    ];
    for (const e of events) {
        if (existing.some((x) => x.title === e.title)) {
            bump('calendar events', 'reused');
            continue;
        }
        const start = at(e.d, e.h);
        await step(`event ${e.title}`, () =>
            post('/calendar/events', {
                title: e.title,
                description: `${e.title} — demo event`,
                starts_at: iso(start),
                ends_at: iso(new Date(start.getTime() + e.len * 60_000)),
                timezone: 'Europe/Athens',
                attendees: e.attendees,
                recurrence: e.recurrence,
                visibility: e.visibility ?? 'ORGANIZATION',
                location: e.location,
                meeting_url: e.meeting_url,
                color: e.color,
                project_id: e.project_id,
                company_id: e.company_id,
                reminders: [{ minutes_before: 10, method: 'NOTIFICATION' }],
            }).then(() => bump('calendar events', 'created')),
        );
    }
}

// ---------------------------------------------------------------- 11 campaigns

async function campaigns(ctx) {
    section('Campaigns: template, list, draft campaign');
    const template = await step('template', async () => {
        let t = await findBy('/communications/templates', 'name', 'Monthly newsletter');
        if (t) {
            bump('comm templates', 'reused');
            if (!t.current_version_id) {
                const full = await get(`/communications/templates/${t.id}`);
                if (full.draft_version?.id) await post(`/communications/templates/${t.id}/versions/${full.draft_version.id}/publish`);
            }
            return t;
        }
        t = await post('/communications/templates', {
            name: 'Monthly newsletter',
            channel: 'EMAIL',
            kind: 'CAMPAIGN',
            category: 'MARKETING_CAMPAIGN',
            description: 'Monthly agency newsletter',
            subject: 'What we shipped this month',
            preheader: 'Case studies, launches and tips',
            body_html: '<h1>Hi {{first_name | there}},</h1><p>Here is what we shipped this month.</p><p>— The Logiqdev team</p>',
            body_text: 'Hi {{first_name | there}}, here is what we shipped this month. — The Logiqdev team',
        });
        if (t.draft_version?.id) await post(`/communications/templates/${t.id}/versions/${t.draft_version.id}/publish`);
        bump('comm templates', 'created');
        return t;
    });
    const list = await step('list', () =>
        ensure('comm lists', () => findBy('/communications/lists', 'name', 'Customers — newsletter'), async () => {
            const l = await post('/communications/lists', { name: 'Customers — newsletter', description: 'Primary contacts at customers', channel: 'EMAIL' });
            const members = ['Maria', 'Thomas', 'Julia', 'Giorgos'].map((n) => ctx.contacts[n]).filter(Boolean).map((c) => ({ kind: 'CRM_CONTACT', contact_id: c.id }));
            await post(`/communications/lists/${l.id}/members`, { members });
            return l;
        }),
    );
    await step('campaign', () =>
        ensure('campaigns', () => findBy('/communications/campaigns', 'name', 'November newsletter'), () =>
            post('/communications/campaigns', { name: 'November newsletter', channel: 'EMAIL', description: 'Monthly newsletter to customers', campaign_type: 'newsletter', template_id: template?.id, from_name: 'Logiqdev', audiences: list ? [{ mode: 'INCLUDE', list_id: list.id }] : undefined }),
        ),
    );
}

// ---------------------------------------------------------------- 20 automation

async function automation(ctx) {
    section('Automation: draft workflow');
    await step('rule', () =>
        ensure('automation rules', () => findBy('/automation/rules', 'name', 'Deal won → kick-off task'), () =>
            post('/automation/rules', {
                name: 'Deal won → kick-off task',
                description: 'When a deal is won, create a kick-off task for the project manager and notify sales.',
                module: 'CRM',
                trigger_kind: 'EVENT',
                trigger_key: 'crm.deal.won',
                entity_type: 'CRM_DEAL',
                actions: [
                    { key: 'create_task', name: 'Create kick-off task', action_key: 'tasks.create', inputs: { title: 'Kick-off: {{event.payload.name}}', priority: 'HIGH', assignee_membership_id: ctx.m.elena?.id }, on_error: 'stop' },
                    { key: 'notify_sales', name: 'Notify sales', action_key: 'notifications.notify', inputs: { recipient_membership_ids: [ctx.m.laura?.id].filter(Boolean), title: 'Deal won — kick-off task created' }, on_error: 'continue' },
                ],
            }),
        ),
    );
}

main().catch((e) => {
    console.error(e instanceof ApiError ? `${e.message} ${JSON.stringify(e.body)}` : e);
    process.exit(1);
});
