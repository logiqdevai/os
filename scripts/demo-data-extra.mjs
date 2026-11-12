#!/usr/bin/env node
/**
 * Extra demo data for the features added after scripts/demo-data.mjs (CRM custom fields / saved views / targets /
 * rules / merge / import, cycles + releases, project governance, People settings, Time, Docs, Files, Automation,
 * Admin, Notifications, Calendar, Messages, Support widget, Communications). REST only - never the DB directly.
 * Run scripts/demo-data.mjs first (this script reuses its companies, projects, teams and colleagues).
 *
 *   DEMO_OWNER_EMAIL=… DEMO_OWNER_PASSWORD=… node scripts/demo-data-extra.mjs
 *   ONLY=crm,tasks node scripts/demo-data-extra.mjs        (run some sections only)
 *   API_URL=http://… node scripts/demo-data-extra.mjs
 *
 * Safe for accounts with LIVE email / AI connections: nothing here sends an email or SMS, no AI endpoint is called,
 * integrations are never touched, and campaigns / workflows / webhooks / SSO / reviews stay draft or disabled.
 * Idempotent-ish: records are looked up by name/title first and reused. Every non-2xx response is printed with
 * method, path, status and body; the run continues and a summary is printed at the end.
 */

const API = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const OWNER = { email: process.env.DEMO_OWNER_EMAIL ?? 'owner@logiqdev.test', password: process.env.DEMO_OWNER_PASSWORD ?? 'Password123!' };
const DOMAIN = process.env.DEMO_MEMBER_DOMAIN ?? 'demo.logiqdev.test';
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',').map((s) => s.trim())) : null;

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

async function call(method, path, body, { auth = true, quiet = false, headers = {} } = {}) {
    const h = { ...headers };
    if (auth && token) h.authorization = `Bearer ${token}`;
    if (auth && orgId) h['x-organization-id'] = orgId;
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
        h['content-type'] = 'application/json';
        payload = JSON.stringify(body);
    }
    let res;
    for (let attempt = 0; ; attempt++) {
        try {
            res = await fetch(API + path, { method, headers: h, body: payload });
            break;
        } catch (e) {
            if (attempt >= 30) throw e; // API restarting? wait up to ~1 minute
            await new Promise((r) => setTimeout(r, 2000));
        }
    }
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
            failures.push(`${method} ${path} -> ${res.status} ${JSON.stringify(data).slice(0, 500)}`);
            console.error(`  ✗ ${method} ${path} -> ${res.status}\n    ${JSON.stringify(data).slice(0, 1200)}`);
        }
        throw err;
    }
    return data;
}

const get = (p, o) => call('GET', p, undefined, o);
const post = (p, b, o) => call('POST', p, b ?? {}, o);
const patch = (p, b, o) => call('PATCH', p, b, o);
const put = (p, b, o) => call('PUT', p, b, o);

const rows = (r) => (Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : Array.isArray(r?.items) ? r.items : []);
const qs = (o) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null) p.set(k, String(v));
    const s = p.toString();
    return s ? `?${s}` : '';
};

/** List `path` (unwrapped) and return the first row whose `field` equals `value` (case-insensitive). */
async function findIn(path, field, value) {
    const v = String(value).toLowerCase();
    return rows(await get(path)).find((x) => String(x?.[field] ?? '').toLowerCase() === v) ?? null;
}
/** Search-style list endpoint (`?search=`). */
async function findBy(path, field, value, extra = {}) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await get(`${path}${sep}${qs({ search: value, limit: 100, ...extra }).slice(1)}`);
    const v = String(value).toLowerCase();
    return rows(r).find((x) => String(x?.[field] ?? '').toLowerCase() === v) ?? null;
}

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
/** ensure() by listing `listPath` and matching `field`. */
const ensureIn = (label, listPath, field, value, create) => ensure(label, () => findIn(listPath, field, value), create);

function bump(label, kind) {
    counts[label] ??= { created: 0, reused: 0 };
    counts[label][kind]++;
}

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
const pick = (arr, i) => arr[i % arr.length];

// ---------------------------------------------------------------- main

async function main() {
    console.log(`API ${API}`);
    const session = await post('/auth/email/login', { email: OWNER.email, password: OWNER.password }, { auth: false });
    if (!session.access_token) throw new Error(`login failed: ${JSON.stringify(session).slice(0, 300)}`);
    token = session.access_token;
    orgId = session.user.default_organization_id;
    console.log(`Signed in as ${session.user.email}, org ${orgId}`);

    const ctx = await loadContext();

    // Safety net: with a live email connection, assigning / mentioning / inviting colleagues would send real notification
    // emails (to the demo colleagues' fake addresses). Switch the org's external notification channels off while seeding
    // and restore them afterwards (also when the run fails). In-app notifications keep working.
    const prevChannels = await step('read notification settings', () => get('/notification-settings'));
    if (prevChannels) await step('mute external notification channels', () => patch('/notification-settings', { enabled_channels: ['IN_APP'], portal_enabled_channels: ['IN_APP'] }));
    try {
        for (const name of ORDER) {
            if (ONLY && !ONLY.has(name)) continue;
            if (!REG[name]) { console.log(`
== ${name}: not implemented`); continue; }
            await step(`section ${name}`, () => REG[name](ctx));
        }
    } finally {
        if (prevChannels) {
            await new Promise((r) => setTimeout(r, 6000)); // let the event bus finish fan-out while external channels are still muted
            const restored = await step('restore notification settings', () => patch('/notification-settings', { enabled_channels: prevChannels.enabled_channels, portal_enabled_channels: prevChannels.portal_enabled_channels }));
            if (restored) console.log(`
Notification channels restored to ${prevChannels.enabled_channels.join(', ')}`);
            else console.log(`
!! COULD NOT RESTORE notification channels - set enabled_channels back to ${prevChannels.enabled_channels.join(', ')} via PATCH /notification-settings`);
        }
    }

    section('Summary');
    for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(34)} created ${String(v.created).padStart(3)}  reused ${String(v.reused).padStart(3)}`);
    if (failures.length) {
        console.log(`\n${failures.length} failure(s):`);
        for (const f of failures) console.log(`  - ${f}`);
        process.exitCode = 1;
    } else console.log('\nAll steps succeeded.');
}

async function loadContext() {
    const ctx = {};
    const members = rows(await get('/members?limit=100'));
    ctx.members = members;
    const byEmail = (e) => members.find((m) => m.user?.email === e);
    ctx.m = { owner: byEmail(OWNER.email) };
    for (const n of ['kim', 'jonas', 'sofia', 'marco', 'elena', 'nikos', 'laura']) ctx.m[n] = byEmail(`${n}@${DOMAIN}`);
    for (const [k, v] of Object.entries(ctx.m)) if (!v) console.warn(`  ! member ${k} not found`);
    ctx.teams = {};
    for (const t of rows(await get('/teams?limit=100'))) ctx.teams[t.task_key ?? t.name] = t;
    ctx.projects = rows(await get('/projects?limit=100'));
    ctx.branches = rows(await get('/branches'));
    ctx.hq = ctx.branches.find((b) => b.is_headquarters) ?? ctx.branches[0];
    console.log(`  members ${members.length}, teams ${Object.keys(ctx.teams).join(',')}, projects ${ctx.projects.length}`);
    return ctx;
}

const REG = {};
const ORDER = ['crm', 'tasks', 'projects', 'people', 'time', 'docs', 'files', 'automation', 'admin', 'notifications', 'calendar', 'messages', 'support', 'communications'];
// ---------------------------------------------------------------- @@BEGIN crm
// ---------------------------------------------------------------- CRM

async function crm(ctx) {
    section('CRM: custom fields, saved views, targets, rules, duplicates, import');
    const m = ctx.m;
    const companies = rows(await get('/crm/companies?limit=100'));
    const companyByName = (n) => companies.find((c) => c.name === n);

    // ---- custom field group + definitions
    const group = await step('cf group', () => ensureIn('crm custom field groups', '/custom-field-groups', 'name', 'Account profile', () => post('/custom-field-groups', { name: 'Account profile', description: 'Commercial profile of a customer account' })));
    const defs = [
        { key: 'customer_tier', label: 'Customer tier', type: 'DROPDOWN', entity_types: ['CRM_COMPANY'], options: [{ value: 'strategic', label: 'Strategic', color: 'violet' }, { value: 'growth', label: 'Growth' }, { value: 'standard', label: 'Standard' }], is_filterable: true },
        { key: 'contract_renewal_date', label: 'Contract renewal date', type: 'DATE', entity_types: ['CRM_COMPANY', 'CRM_DEAL'], is_filterable: true, is_sortable: true },
        { key: 'annual_it_budget', label: 'Annual IT budget', type: 'CURRENCY', entity_types: ['CRM_COMPANY'], validation: { min: 0 } },
        { key: 'is_reference_customer', label: 'Reference customer', type: 'BOOLEAN', entity_types: ['CRM_COMPANY'] },
        { key: 'preferred_channels', label: 'Preferred channels', type: 'MULTI_SELECT', entity_types: ['CRM_COMPANY', 'CRM_CONTACT'], options: [{ value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'in_person', label: 'In person' }] },
        { key: 'procurement_notes', label: 'Procurement notes', type: 'LONG_TEXT', entity_types: ['CRM_COMPANY'], validation: { max_length: 2000 } },
        { key: 'linkedin_company_page', label: 'LinkedIn page', type: 'URL', entity_types: ['CRM_COMPANY'] },
        { key: 'decision_role', label: 'Decision role', type: 'RADIO', entity_types: ['CRM_CONTACT'], options: [{ value: 'decision_maker', label: 'Decision maker' }, { value: 'influencer', label: 'Influencer' }, { value: 'user', label: 'End user' }] },
        { key: 'win_probability_pct', label: 'Internal win confidence', type: 'PERCENTAGE', entity_types: ['CRM_DEAL', 'CRM_LEAD'], validation: { min: 0, max: 100 } },
        { key: 'security_review_done', label: 'Security review done', type: 'BOOLEAN', entity_types: ['CRM_DEAL'] },
        { key: 'lead_budget_band', label: 'Budget band', type: 'DROPDOWN', entity_types: ['CRM_LEAD'], options: [{ value: 'lt_10k', label: 'Under 10k' }, { value: '10_50k', label: '10k - 50k' }, { value: 'gt_50k', label: 'Over 50k' }], is_filterable: true },
    ];
    const existing = rows(await get('/custom-fields?include_archived=true'));
    for (const d of defs) {
        if (existing.find((e) => e.key === d.key)) { bump('crm custom fields', 'reused'); continue; }
        const created = await step(`cf ${d.key}`, () => post('/custom-fields', { ...d, group_id: group?.id }));
        if (created) bump('crm custom fields', 'created');
    }

    // ---- values on records
    const cfValues = {
        'Northwind Retail': { customer_tier: 'strategic', contract_renewal_date: ymd(120), annual_it_budget: 420000, is_reference_customer: true, preferred_channels: ['email', 'in_person'], procurement_notes: 'Procurement runs a quarterly vendor review; POs above 50k need a second signature from the CFO.', linkedin_company_page: 'https://www.linkedin.com/company/northwind-retail-demo' },
        'Acme Logistics': { customer_tier: 'growth', contract_renewal_date: ymd(75), annual_it_budget: 150000, is_reference_customer: false, preferred_channels: ['phone', 'whatsapp'] },
        'Bluewave Health': { customer_tier: 'strategic', contract_renewal_date: ymd(210), annual_it_budget: 900000, is_reference_customer: true, preferred_channels: ['email'], procurement_notes: 'GDPR / health-data DPA required before any pilot.' },
        'Helios Energy': { customer_tier: 'strategic', contract_renewal_date: ymd(300), annual_it_budget: 1250000, preferred_channels: ['email', 'phone'] },
        'Orbit Studios': { customer_tier: 'standard', annual_it_budget: 40000, preferred_channels: ['whatsapp'] },
    };
    for (const [name, values] of Object.entries(cfValues)) {
        const c = companyByName(name);
        if (!c) { console.warn(`  ! company ${name} not found`); continue; }
        await step(`cf values ${name}`, async () => { await patch(`/crm/companies/${c.id}`, { custom_fields: values }); bump('crm custom field values (companies)', 'created'); });
    }
    const contacts = rows(await get('/crm/contacts?limit=100'));
    const roles = ['decision_maker', 'influencer', 'user'];
    for (const [i, c] of contacts.slice(0, 6).entries()) {
        await step(`cf values contact ${c.id}`, async () => { await patch(`/crm/contacts/${c.id}`, { custom_fields: { decision_role: pick(roles, i), preferred_channels: i % 2 ? ['email', 'phone'] : ['email'] } }); bump('crm custom field values (contacts)', 'created'); });
    }
    const deals = rows(await get('/crm/deals?limit=100'));
    for (const [i, d] of deals.slice(0, 4).entries()) {
        await step(`cf values deal ${d.id}`, async () => { await patch(`/crm/deals/${d.id}`, { custom_fields: { win_probability_pct: 40 + i * 15, security_review_done: i % 2 === 0, contract_renewal_date: ymd(180 + i * 30) } }); bump('crm custom field values (deals)', 'created'); });
    }

    // ---- saved views (personal + shared)
    const viewDefs = [
        { entity_type: 'CRM_COMPANY', name: 'Strategic accounts', visibility: 'ORGANIZATION', layout: 'table', filters: { type: 'CUSTOMER', cf_key: 'customer_tier', cf_value: 'strategic' }, sorting: { field: 'name', direction: 'asc' } },
        { entity_type: 'CRM_COMPANY', name: 'My prospects', visibility: 'PERSONAL', layout: 'table', filters: { type: 'PROSPECT' } },
        { entity_type: 'CRM_CONTACT', name: 'Decision makers', visibility: 'ORGANIZATION', layout: 'table', filters: { cf_key: 'decision_role', cf_value: 'decision_maker' } },
        { entity_type: 'CRM_LEAD', name: 'Hot open leads', visibility: 'ORGANIZATION', layout: 'table', filters: { state: 'open' }, sorting: { field: 'lead_score', direction: 'desc' } },
        { entity_type: 'CRM_LEAD', name: 'Follow-ups this week', visibility: 'PERSONAL', layout: 'table', filters: { state: 'open' } },
        { entity_type: 'CRM_DEAL', name: 'Open deals by value', visibility: ctx.teams.SAL ? 'TEAM' : 'ORGANIZATION', team_id: ctx.teams.SAL?.id, layout: 'table', filters: { status: 'OPEN' }, sorting: { field: 'amount', direction: 'desc' } },
        { entity_type: 'CRM_DEAL', name: 'Closing soon (board)', visibility: 'PERSONAL', layout: 'pipeline', filters: { status: 'OPEN' } },
    ];
    for (const v of viewDefs) {
        await step(`saved view ${v.name}`, () =>
            ensure('crm saved views', async () => rows(await get(`/saved-views?entity_type=${v.entity_type}`)).find((x) => x.name === v.name), () => post('/saved-views', v)),
        );
    }

    // ---- sales targets (current month + quarter; org / individual / team)
    const month = ymd(0).slice(0, 7) + '-01';
    const targetDefs = [
        { period: 'MONTH', period_start: month, metric: 'REVENUE_WON', amount: 120000, currency: 'EUR' },
        { period: 'MONTH', period_start: month, metric: 'DEALS_WON', amount: 6 },
        { period: 'QUARTER', period_start: month, metric: 'REVENUE_WON', amount: 380000, currency: 'EUR' },
        { period: 'QUARTER', period_start: month, metric: 'PIPELINE_CREATED', amount: 900000, currency: 'EUR' },
        { period: 'MONTH', period_start: month, metric: 'REVENUE_WON', amount: 45000, currency: 'EUR', owner_membership_id: m.laura?.id },
        { period: 'MONTH', period_start: month, metric: 'REVENUE_WON', amount: 35000, currency: 'EUR', owner_membership_id: m.kim?.id },
        { period: 'QUARTER', period_start: month, metric: 'REVENUE_WON', amount: 190000, currency: 'EUR', team_id: ctx.teams.SAL?.id },
    ];
    const existingTargets = rows(await get('/crm/targets'));
    for (const t of targetDefs) {
        const same = existingTargets.find((x) => x.period === t.period && x.metric === t.metric && (x.owner_membership_id ?? null) === (t.owner_membership_id ?? null) && (x.team_id ?? null) === (t.team_id ?? null) && Number(x.amount) === t.amount);
        if (same) { bump('crm targets', 'reused'); continue; }
        await step(`target ${t.metric}`, async () => { await post('/crm/targets', t); bump('crm targets', 'created'); });
    }

    // ---- lead assignment + scoring rules
    const settings = await step('crm settings', () => get('/crm/settings'));
    const src = (n) => settings?.lead_sources?.find((s) => s.name.toLowerCase().includes(n))?.id;
    const assignmentRules = [
        { name: 'Enterprise leads to Laura', priority: 10, conditions: [{ field: 'estimated_value', operator: 'gte', value: 50000 }], assign_to: { membership_id: m.laura?.id } },
        { name: 'Website leads round robin (Sales)', priority: 20, conditions: src('web') ? [{ field: 'lead_source_id', operator: 'equals', value: src('web') }] : [{ field: 'website', operator: 'is_not_empty' }], assign_to: ctx.teams.SAL ? { team_id: ctx.teams.SAL.id, strategy: 'round_robin' } : { membership_ids: [m.laura?.id, m.kim?.id].filter(Boolean), strategy: 'round_robin' } },
        { name: 'Small deals to least loaded', priority: 30, conditions: [{ field: 'estimated_value', operator: 'lt', value: 10000 }], assign_to: { membership_ids: [m.laura?.id, m.kim?.id, m.owner?.id].filter(Boolean), strategy: 'least_loaded' } },
    ];
    for (const r of assignmentRules) await step(`assignment rule ${r.name}`, () => ensureIn('crm assignment rules', '/crm/assignment-rules', 'name', r.name, () => post('/crm/assignment-rules', r)));
    const scoringRules = [
        { name: 'Free mailbox address', description: 'Personal mailbox instead of a company domain', conditions: [{ field: 'email_domain', operator: 'in', value: ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'] }], points: -10 },
        { name: 'Budget above 50k', conditions: [{ field: 'estimated_value', operator: 'gte', value: 50000 }], points: 25 },
        { name: 'Budget 10k - 50k', conditions: [{ field: 'estimated_value', operator: 'gte', value: 10000 }, { field: 'estimated_value', operator: 'lt', value: 50000 }], points: 10 },
        { name: 'Has phone number', conditions: [{ field: 'phone', operator: 'is_not_empty' }], points: 5 },
        { name: 'Company size 201+', conditions: [{ field: 'estimated_company_size', operator: 'in', value: ['201-500', '501-1000', '1000+'] }], points: 15 },
    ];
    for (const [i, r] of scoringRules.entries()) await step(`scoring rule ${r.name}`, () => ensureIn('crm scoring rules', '/crm/scoring-rules', 'name', r.name, () => post('/crm/scoring-rules', { ...r, sort_order: i * 10 })));

    // ---- duplicate pair (left unmerged on purpose so the Duplicates screen has something to review)
    const dupBase = { type: 'PROSPECT', industry: 'Robotics', city: 'Patras', country: 'GR', allow_duplicate: true, owner_membership_id: m.laura?.id };
    const z1 = await step('dup company 1', () => ensure('crm companies (duplicate pair)', () => findBy('/crm/companies', 'name', 'Zenith Robotics'), () => post('/crm/companies', { ...dupBase, name: 'Zenith Robotics', legal_name: 'Zenith Robotics Ltd', website: 'https://zenith-robotics.example', email: 'info@zenith-robotics.example', vat_number: 'EL998877665' })));
    const z2 = await step('dup company 2', () => ensure('crm companies (duplicate pair)', () => findBy('/crm/companies', 'name', 'Zenith Robotics Ltd.'), () => post('/crm/companies', { ...dupBase, name: 'Zenith Robotics Ltd.', website: 'https://www.zenith-robotics.example', email: 'sales@zenith-robotics.example', vat_number: 'EL998877665', description: 'Entered from a trade-fair list - probably the same company as Zenith Robotics.' })));
    await step('duplicate rule', () => put('/crm/duplicate-rules', { entity_type: 'CRM_COMPANY', match_keys: ['domain', 'vat', 'name'], min_score: 60, auto_check: true, enabled: true }).then(() => bump('crm duplicate rules', 'created')));
    await step('duplicates scan', async () => {
        const d = await get('/crm/duplicates?entity_type=CRM_COMPANY');
        console.log(`  duplicate candidates for companies: ${rows(d).length}`);
        if (z1 && z2) await get(`/crm/merge/preview?entity_type=CRM_COMPANY&ids=${z1.id},${z2.id}`).then(() => console.log('  merge preview OK'));
    });

    // ---- CSV import (small: 3 prospect companies; rows already present are skipped by name)
    const csv = [
        'Company,Website,Industry,Country,Employees,Source',
        'Meridian Marine Services,meridian-marine.example,Shipping,GR,85,Referral',
        'Kappa Foods SA,kappafoods.example,Food & beverage,GR,240,Referral',
        'Alpine Analytics GmbH,alpine-analytics.example,Data & analytics,DE,60,Website',
    ].join('\n');
    await step('csv import', async () => {
        const jobs = rows(await get('/crm/imports?limit=50'));
        if (jobs.some((j) => /trade-fair-prospects/i.test(JSON.stringify(j)) && !/FAILED|CANCEL/.test(j.status ?? ''))) { bump('crm import jobs', 'reused'); return; }
        const fd = new FormData();
        fd.append('entity_type', 'CRM_COMPANY');
        fd.append('file', new Blob([csv], { type: 'text/csv' }), 'trade-fair-prospects.csv');
        const job = await call('POST', '/crm/imports', fd);
        bump('crm import jobs', 'created');
        await put(`/crm/imports/${job.id}/mapping`, { field_mapping: { Company: 'name', Website: 'website', Industry: 'industry', Country: 'country', Employees: 'number_of_employees', Source: 'lead_source' }, duplicate_strategy: { mode: 'skip', match_key: 'name' }, save_as: 'Trade fair prospects' });
        const preview = await post(`/crm/imports/${job.id}/preview`);
        console.log(`  import preview: ${JSON.stringify(preview).slice(0, 260)}`);
        await post(`/crm/imports/${job.id}/start`);
        for (let i = 0; i < 20; i++) {
            await new Promise((r) => setTimeout(r, 1000));
            const j = await get(`/crm/imports/${job.id}`);
            if (!['IMPORTING', 'VALIDATING', 'QUEUED'].includes(j.status)) { console.log(`  import finished: ${j.status}`); break; }
        }
    });
}

REG.crm = crm;
// @@END crm
// ---------------------------------------------------------------- @@BEGIN tasks
// ---------------------------------------------------------------- Tasks: saved views, cycles, releases

async function tasks(ctx) {
    section('Tasks: saved views, cycle, release');
    const m = ctx.m;

    const viewDefs = [
        { entity_type: 'TASK', name: 'My open tasks', visibility: 'PERSONAL', layout: 'list', filters: { assignee: 'me', status_category: 'open' } },
        { entity_type: 'TASK', name: 'Overdue and urgent', visibility: 'ORGANIZATION', layout: 'list', filters: { priority: 'URGENT,HIGH', overdue: true }, sorting: { field: 'due_date', direction: 'asc' } },
        { entity_type: 'TASK', name: 'Web team board', visibility: ctx.teams.WEB ? 'TEAM' : 'ORGANIZATION', team_id: ctx.teams.WEB?.id, layout: 'kanban', filters: { team_id: ctx.teams.WEB?.id }, grouping: { by: 'status' } },
        { entity_type: 'TASK', name: 'Unassigned backlog', visibility: 'ORGANIZATION', layout: 'list', filters: { assignee: 'none' } },
    ];
    for (const v of viewDefs) {
        await step(`task view ${v.name}`, () =>
            ensure('task saved views', async () => rows(await get('/saved-views?entity_type=TASK')).find((x) => x.name === v.name), () => post('/saved-views', v)),
        );
    }

    // ---- a cycle (APP team, current fortnight) + a planned follow-up cycle (WEB)
    const cycles = rows(await get('/cycles?limit=100'));
    const appTeam = ctx.teams.APP;
    const webTeam = ctx.teams.WEB;
    const appProject = ctx.projects.find((p) => p.team_id === appTeam?.id) ?? ctx.projects.find((p) => /driver/i.test(p.name));
    const wantCycles = [
        appTeam && { team_id: appTeam.id, project_id: appProject?.id, name: 'Sprint — Driver app foundations', goal: 'Auth, offline sync spike and first route screen', starts_at: ymd(-4), ends_at: ymd(9) },
        webTeam && { team_id: webTeam.id, name: 'Sprint — Pricing and polish', goal: 'Pricing page, accessibility fixes, performance budget', starts_at: ymd(11), ends_at: ymd(24) },
    ].filter(Boolean);
    const cycleByName = {};
    for (const c of wantCycles) {
        const found = cycles.find((x) => x.name === c.name);
        if (found) { bump('task cycles', 'reused'); cycleByName[c.name] = found; continue; }
        const created = await step(`cycle ${c.name}`, () => post('/cycles', c));
        if (created) { bump('task cycles', 'created'); cycleByName[c.name] = created; }
    }
    const activeCycle = cycleByName['Sprint — Driver app foundations'];
    if (activeCycle) {
        await step('activate cycle', () => patch(`/cycles/${activeCycle.id}`, { status: 'ACTIVE' }));
        const inCycle = rows(await get(`/tasks?cycle_id=${activeCycle.id}&limit=5`)).length;
        const appTasks = (inCycle ? [] : rows(await get(`/tasks?team_id=${appTeam.id}&limit=50`))).filter((t) => !t.cycle_id && !t.completed_at && !t.cancelled_at);
        for (const t of appTasks.slice(0, 5)) await step(`task to cycle ${t.number}`, async () => { await patch(`/tasks/${t.id}`, { cycle_id: activeCycle.id }); bump('tasks added to a cycle', 'created'); });
    }
    const nextCycle = cycleByName['Sprint — Pricing and polish'];
    if (nextCycle) {
        const inNext = rows(await get(`/tasks?cycle_id=${nextCycle.id}&limit=5`)).length;
        const webTasks = (inNext ? [] : rows(await get(`/tasks?team_id=${webTeam.id}&limit=50`))).filter((t) => !t.cycle_id && !t.completed_at && !t.cancelled_at);
        for (const t of webTasks.slice(0, 3)) await step(`task to cycle ${t.number}`, async () => { await patch(`/tasks/${t.id}`, { cycle_id: nextCycle.id }); bump('tasks added to a cycle', 'created'); });
    }

    // ---- a release with tasks, a deployment and hand-written notes (no AI)
    const webProject = ctx.projects.find((p) => p.team_id === webTeam?.id && /northwind|website|web/i.test(p.name)) ?? ctx.projects.find((p) => p.team_id === webTeam?.id);
    const release = await step('release', () =>
        ensureIn('task releases', '/releases?limit=100', 'name', 'Northwind storefront beta', () =>
            post('/releases', {
                name: 'Northwind storefront beta', version: '0.9.0', team_id: webTeam?.id, project_id: webProject?.id, status: 'IN_PROGRESS', target_date: ymd(14), customer_visible: true,
                notes: '## Highlights\n\n- New product listing with filters and sorting\n- Guest checkout with address validation\n- Order confirmation page\n\n## Known issues\n\n- Gift cards are not available yet\n',
            }),
        ),
    );
    if (release) {
        const candidates = rows(await get(`/tasks?${webProject ? 'project_id=' + webProject.id + '&' : 'team_id=' + webTeam.id + '&'}limit=50`)).filter((t) => !t.release_id);
        if (candidates.length) await step('release tasks', async () => { await post(`/releases/${release.id}/tasks`, { task_ids: candidates.slice(0, 4).map((t) => t.id) }); bump('release tasks', 'created'); });
        const detail = await step('release detail', () => get(`/releases/${release.id}`));
        if (!(detail?.deployments ?? []).length) {
            await step('deployment staging', async () => { await post(`/releases/${release.id}/deployments`, { environment: 'staging', status: 'SUCCEEDED', notes: 'Deployed from main, smoke tests green.' }); bump('release deployments', 'created'); });
            await step('deployment production', async () => { await post(`/releases/${release.id}/deployments`, { environment: 'production', status: 'PENDING' }); bump('release deployments', 'created'); });
        }
    }
}
REG.tasks = tasks;
// @@END tasks
// ---------------------------------------------------------------- @@BEGIN projects
// ---------------------------------------------------------------- Projects: governance

async function projects(ctx) {
    section('Projects: gates, reviews, checklists, handover, closeout notes');
    const me = ctx.m.owner?.id; // approvers / owners are the signed-in owner on purpose: the actor is never notified
    const targets = ctx.projects.filter((p) => !['COMPLETED', 'CANCELLED'].includes(p.status?.category)).slice(0, 2);
    for (const [pi, p] of targets.entries()) {
        const base = `/projects/${p.id}`;
        console.log(`  project ${p.name}`);
        const milestones = rows(await get(`${base}/milestones`).catch(() => []));
        const gates = [
            { kind: undefined, name: 'Design sign-off', description: 'UX flows and visual design approved by the customer before development starts.', approver_membership_id: me, blocks_completion: false, milestone_id: milestones[0]?.id },
            { name: 'Security and privacy review', description: 'OWASP checklist, dependency audit and data-protection review.', approver_membership_id: me, blocks_completion: true },
            { name: 'Go-live readiness', description: 'Monitoring, backups, rollback plan and support handover are in place.', approver_membership_id: me, blocks_completion: true },
        ];
        const existingGates = rows(await get(`${base}/gates`));
        const gateRecords = [];
        for (const g of gates) {
            const found = existingGates.find((x) => x.name === g.name);
            if (found) { bump('project gates', 'reused'); gateRecords.push(found); continue; }
            const created = await step(`gate ${g.name}`, () => post(`${base}/gates`, g));
            if (created) { bump('project gates', 'created'); gateRecords.push(created); }
        }
        const first = gateRecords[0];
        if (first && first.status === 'PENDING' && pi === 0) await step('decide gate', () => post(`${base}/gates/${first.id}/decide`, { decision: 'PASSED', comment: 'Approved after the second design review.' }));

        const existingReviews = rows(await get(`${base}/reviews`));
        const reviewDefs = [
            { type: 'RETROSPECTIVE', title: `Sprint retrospective — ${p.name}`, held_at: ymd(-3), facilitator_membership_id: me, participants: [me].filter(Boolean), went_well: 'Daily syncs kept blockers short.\nDemo to the customer produced fast feedback.', went_wrong: 'Two tickets were started before the design was final.', root_causes: 'No definition of ready for design handoff.', lessons: 'Add a design-ready checkbox to every UI task.', actions: [{ title: 'Add definition of ready to the task template', owner_membership_id: me, due_date: ymd(7) }, { title: 'Book recurring design review slot', owner_membership_id: me, due_date: ymd(5) }] },
            { type: 'DELIVERY', title: `Mid-project health review — ${p.name}`, held_at: ymd(-10), facilitator_membership_id: me, findings: 'Scope is stable; budget burn is 8% ahead of plan.', decisions: 'Keep the target date, move two nice-to-have items to phase 2.' },
        ];
        for (const r of reviewDefs) {
            if (existingReviews.some((x) => x.title === r.title)) { bump('project reviews', 'reused'); continue; }
            await step(`review ${r.title}`, async () => { await post(`${base}/reviews`, r); bump('project reviews', 'created'); });
        }

        const existingLists = rows(await get(`${base}/checklists`));
        const listDefs = [
            { name: 'Kickoff checklist', phase: 'kickoff', items: [{ title: 'Kickoff meeting held', is_required: true }, { title: 'Stakeholders and roles documented', is_required: true }, { title: 'Communication plan agreed' }, { title: 'Access to customer systems received' }] },
            { name: 'Launch checklist', phase: 'launch', items: [{ title: 'Production deployment rehearsed', is_required: true }, { title: 'Monitoring and alerts configured', is_required: true }, { title: 'Customer training completed' }, { title: 'Rollback plan tested' }] },
        ];
        for (const l of listDefs) {
            const found = existingLists.find((x) => x.name === l.name);
            if (found) { bump('project checklists', 'reused'); continue; }
            const created = await step(`checklist ${l.name}`, () => post(`${base}/checklists`, l));
            if (created) {
                bump('project checklists', 'created');
                if (l.phase === 'kickoff') {
                    const detail = rows(await get(`${base}/checklists`)).find((x) => x.id === created.id);
                    for (const item of (detail?.items ?? []).slice(0, 3)) await step('tick item', () => patch(`${base}/checklists/${created.id}/items/${item.id}`, { is_completed: true }));
                }
            }
        }

        if (pi === 0) {
            const existingHandovers = rows(await get(`${base}/handovers`));
            if (existingHandovers.length) bump('project handovers', 'reused');
            else await step('handover', async () => {
                await post(`${base}/handovers`, {
                    type: 'delivery_to_support', from_team_id: ctx.teams.WEB?.id, to_team_id: ctx.teams.SAL?.id, new_owner_membership_id: me, scheduled_at: ymd(21),
                    details: { checklist: [{ title: 'Runbook written', done: true }, { title: 'Support team briefed' }, { title: 'Customer contacts shared' }], open_items: 'Two low-priority bugs stay open for the first maintenance sprint.', support_reference: 'Priority support, 24h response', contacts: 'Customer PM and technical lead (see CRM).', notes: 'Planned handover - not yet accepted.' },
                });
                bump('project handovers', 'created');
            });
        }
    }
    // closeout record (saved only; the project is NOT closed)
    const target = targets[1] ?? targets[0];
    if (target) await step('closeout notes', async () => {
        await put(`/projects/${target.id}/closeout`, { final_status_summary: 'Draft - delivery on track, closeout will be completed after launch.', outstanding_items: 'Final invoice, customer survey.', lessons_learned: 'Involve support earlier in the plan.' });
        bump('project closeout notes', 'created');
    });
}
REG.projects = projects;
// @@END projects
// ---------------------------------------------------------------- @@BEGIN people
// ---------------------------------------------------------------- People

async function people(ctx) {
    section('People: org chart, leave, holidays, onboarding, improvement plan, feedback request');
    const m = ctx.m;
    const employees = rows(await get('/people/employees?limit=100'));
    const empOf = (name) => employees.find((e) => e.membership_id === m[name]?.id);

    // ---- org chart reporting lines
    const lines = [['elena', 'owner'], ['nikos', 'owner'], ['laura', 'owner'], ['kim', 'owner'], ['jonas', 'elena'], ['sofia', 'elena'], ['marco', 'elena']];
    for (const [who, boss] of lines) {
        const e = empOf(who), b = empOf(boss);
        if (!e || !b) { console.warn(`  ! employee record missing for ${!e ? who : boss}`); continue; }
        if (e.manager_employee_id === b.id) { bump('reporting lines', 'reused'); continue; }
        await step(`manager ${who}`, async () => { await patch(`/people/employees/${e.id}`, { manager_employee_id: b.id }); bump('reporting lines', 'created'); });
    }
    await step('org chart', async () => { const c = await get('/people/org-chart'); console.log(`  org chart nodes: ${JSON.stringify(c).length} bytes`); });

    // ---- leave types + policies
    const types = rows(await get('/people/leave-types'));
    const typeDefs = [
        { name: 'Vacation', code: 'VAC', category: 'VACATION', color: 'info', is_paid: true, requires_approval: true, allows_half_day: true, deducts_balance: true, min_notice_days: 7, sort_order: 1 },
        { name: 'Sick leave', code: 'SICK', category: 'SICK', color: 'warning', is_paid: true, requires_approval: false, requires_attachment: true, attachment_after_days: 3, allows_half_day: true, deducts_balance: false, sort_order: 2 },
        { name: 'Parental leave', code: 'PAR', category: 'PARENTAL', color: 'violet', is_paid: false, requires_approval: true, deducts_balance: false, max_consecutive_days: 120, sort_order: 3 },
        { name: 'Unpaid leave', code: 'UNP', category: 'UNPAID', color: 'neutral', is_paid: false, requires_approval: true, deducts_balance: false, min_notice_days: 14, sort_order: 4 },
    ];
    const typeByCode = {};
    for (const t of types) typeByCode[t.code] = t;
    for (const t of typeDefs) {
        if (typeByCode[t.code]) { bump('leave types', 'reused'); continue; }
        const c = await step(`leave type ${t.code}`, () => post('/people/leave-types', t));
        if (c) { bump('leave types', 'created'); typeByCode[t.code] = c; }
    }
    const policies = rows(await get('/people/leave-policies'));
    const policyDefs = [
        { code: 'VAC', name: 'Vacation — Athens studio', branch_id: ctx.branches.find((b) => /athens/i.test(b.name))?.id, accrual_method: 'MONTHLY', annual_entitlement_days: 24, prorate_first_year: true, seniority_bonus_days_per_year: 1, max_entitlement_days: 30, carry_over_max_days: 7, carry_over_expiry_months: 4 },
        { code: 'SICK', name: 'Sick leave — standard', accrual_method: 'ANNUAL_UPFRONT', annual_entitlement_days: 10, allow_negative_balance: false, is_default: true },
    ];
    for (const p of policyDefs) {
        const { code, ...body } = p;
        if (!typeByCode[code]) continue;
        if (policies.some((x) => x.name === p.name)) { bump('leave policies', 'reused'); continue; }
        await step(`leave policy ${p.name}`, async () => { await post('/people/leave-policies', { ...body, leave_type_id: typeByCode[code].id }); bump('leave policies', 'created'); });
    }

    // ---- company + branch holidays (current + next year)
    const year = now.getUTCFullYear();
    const holidays = [
        { name: 'New Year', date: `${year + 1}-01-01`, kind: 'PUBLIC', recurring: true, country_code: 'GR' },
        { name: 'Epiphany', date: `${year + 1}-01-06`, kind: 'PUBLIC', recurring: true, country_code: 'GR' },
        { name: 'Christmas Day', date: `${year}-12-25`, kind: 'PUBLIC', recurring: true, country_code: 'GR' },
        { name: 'Boxing Day', date: `${year}-12-26`, kind: 'PUBLIC', recurring: true, country_code: 'GR' },
        { name: 'Company winter break', date: `${year}-12-24`, kind: 'COMPANY', is_half_day: true, recurring: true },
        { name: 'Team offsite day', date: `${year + 1}-03-12`, kind: 'COMPANY' },
    ];
    const existingHolidays = [...rows(await get(`/people/holidays?year=${year}`)), ...rows(await get(`/people/holidays?year=${year + 1}`))];
    for (const h of holidays) {
        if (existingHolidays.some((x) => x.name === h.name)) { bump('company holidays', 'reused'); continue; }
        await step(`holiday ${h.name}`, async () => { await post('/people/holidays', h); bump('company holidays', 'created'); });
    }
    const ath = ctx.branches.find((b) => /athens/i.test(b.name)) ?? ctx.hq;
    if (ath) {
        const bh = rows(await get('/people/branch-holidays'));
        for (const h of [{ name: 'Athens studio founding day', date: `${year + 1}-05-04`, recurring: true }]) {
            if (bh.some((x) => x.name === h.name)) { bump('branch holidays', 'reused'); continue; }
            await step(`branch holiday ${h.name}`, async () => { await post('/people/branch-holidays', { ...h, branch_id: ath.id }); bump('branch holidays', 'created'); });
        }
    }

    // ---- onboarding checklist template (module 15) + a run for one employee
    const lists = rows(await get('/docs/checklists?kind=ONBOARDING'));
    let onboarding = lists.find((l) => l.name === 'Developer onboarding');
    if (onboarding) bump('onboarding checklists', 'reused');
    else {
        onboarding = await step('onboarding checklist', () => post('/docs/checklists', {
            kind: 'ONBOARDING', name: 'Developer onboarding', description: 'First two weeks for every new developer.', team_id: ctx.teams.WEB?.id, auto_assign: false, is_active: true,
            items: [
                { title: 'Laptop and accounts set up', assignee_kind: 'CHECKLIST_OWNER', due_offset_days: 1, is_required: true },
                { title: 'Read the engineering handbook', assignee_kind: 'SUBJECT', due_offset_days: 3, requires_acknowledgement: true, is_required: true },
                { title: 'Meet your buddy and your manager', assignee_kind: 'MANAGER', due_offset_days: 2 },
                { title: 'Ship a first small change to production', assignee_kind: 'SUBJECT', due_offset_days: 10 },
                { title: '30-day feedback conversation', assignee_kind: 'MANAGER', due_offset_days: 30 },
            ],
        }));
        if (onboarding) bump('onboarding checklists', 'created');
    }
    const marco = empOf('marco');
    if (onboarding && marco) await step('onboarding run', async () => {
        const runs = rows(await get(`/people/employees/${marco.id}/checklist-runs`));
        if (runs.some((r) => (r.checklist_id ?? r.checklist?.id) === onboarding.id)) { bump('onboarding runs', 'reused'); return; }
        const run = await post(`/people/employees/${marco.id}/checklist-runs`, { checklist_id: onboarding.id, due_at: iso(at(14, 12)) });
        bump('onboarding runs', 'created');
        const item = (run?.items ?? [])[0];
        if (run?.id && item) await step('complete first onboarding item', () => post(`/people/employees/${marco.id}/checklist-runs/${run.id}/items/${item.id}/complete`, {}));
    });

    // ---- performance improvement plan (draft) + feedback request
    const jonas = empOf('jonas');
    if (jonas) {
        const pips = rows(await get('/people/performance/improvement-plans?limit=50'));
        if (pips.some((p) => p.title === 'Delivery predictability plan')) bump('improvement plans', 'reused');
        else await step('improvement plan', async () => {
            await post('/people/performance/improvement-plans', {
                employee_id: jonas.id, title: 'Delivery predictability plan', reason: 'Three sprints in a row ended with unfinished committed work.',
                objectives: '- Estimate within +/-20% on 80% of tasks\n- Break work into slices of at most 3 days\n- Flag risks in the daily sync before the day they bite\n\n**Support offered:** weekly 1:1 with the tech lead, pairing sessions on estimation.',
                start_date: ymd(0), end_date: ymd(60), check_in_frequency_days: 14, manager_membership_id: empOf('elena')?.membership_id,
                items: [{ title: 'Estimation workshop', due_date: ymd(10) }, { title: 'First sprint with sliced tasks', due_date: ymd(24) }, { title: 'Mid-plan review', due_date: ymd(30), description: 'Review burndown and estimation accuracy together.' }],
            });
            bump('improvement plans', 'created');
        });
    }
    const sofia = empOf('sofia');
    if (sofia) {
        const reqs = rows(await get('/people/performance/feedback-requests?box=all&limit=50'));
        if (reqs.some((r) => (r.employee_id ?? r.employee?.id) === sofia.id)) bump('feedback requests', 'reused');
        else await step('feedback request', async () => {
            await post('/people/performance/feedback-requests', { employee_id: sofia.id, requested_from_membership_ids: [m.jonas?.id, m.elena?.id, m.marco?.id].filter(Boolean), due_date: ymd(10), message: 'Please share a few lines on how working with Sofia went this quarter: what she does well and one thing to improve.', is_anonymous: true });
            bump('feedback requests', 'created');
        });
    }
}
REG.people = people;
// @@END people
// ---------------------------------------------------------------- @@BEGIN time
// ---------------------------------------------------------------- Time

async function time(ctx) {
    section('Time: scheduled report (paused), project time settings, suggestions');
    const me = ctx.m.owner?.id;

    // A scheduled report that would e-mail data: created PAUSED (is_active false) so nothing is ever sent.
    const schedules = rows(await get('/time/report-schedules'));
    const scheduleDefs = [
        { name: 'Weekly hours by project', report_key: 'hours_by_project', frequency: 'WEEKLY', day_of_week: 1, time_of_day: '08:00', timezone: 'Europe/Athens', filters: { scope: 'all' }, recipient_membership_ids: [me].filter(Boolean), is_active: false },
        { name: 'Monthly hours by customer', report_key: 'hours_by_customer', frequency: 'MONTHLY', day_of_month: 1, time_of_day: '07:30', timezone: 'Europe/Athens', filters: { scope: 'all', billable: true }, recipient_membership_ids: [me].filter(Boolean), is_active: false },
    ];
    for (const s of scheduleDefs) {
        if (schedules.some((x) => x.name === s.name)) { bump('time report schedules (paused)', 'reused'); continue; }
        await step(`schedule ${s.name}`, async () => { await post('/time/report-schedules', s); bump('time report schedules (paused)', 'created'); });
    }

    // Project time settings
    const types = rows(await get('/time/activity-types'));
    const dev = types.find((t) => /develop|engineer/i.test(t.name)) ?? types[0];
    const settingsByProject = [
        { match: /acme|driver/i, body: { default_billable: true, default_activity_type_id: dev?.id, time_tracking_enabled: true, require_task: true, hours_alert_percent: 80, approver_membership_id: me } },
        { match: /helios|care/i, body: { default_billable: false, default_non_billable_category: 'WARRANTY', time_tracking_enabled: true, members_only: true, require_task: false, hours_alert_percent: 90 } },
        { match: /northwind/i, body: { default_billable: true, time_tracking_enabled: true, members_only: false, require_task: true, hours_alert_percent: 100 } },
    ];
    for (const p of ctx.projects) {
        const s = settingsByProject.find((x) => x.match.test(p.name));
        if (!s) continue;
        await step(`project time settings ${p.name}`, async () => { await patch(`/time/project-settings/${p.id}`, s.body); bump('project time settings', 'created'); });
    }

    // Suggestions (from calendar events and task status changes); left pending for the user to accept or dismiss.
    await step('generate time suggestions', async () => {
        const r = await post('/time/suggestions/generate', { from: ymd(-14), to: ymd(0) });
        console.log(`  suggestions generated: ${JSON.stringify(r).slice(0, 160)}`);
        bump('time suggestion runs', 'created');
    });
}
REG.time = time;
// @@END time
// ---------------------------------------------------------------- @@BEGIN docs
// ---------------------------------------------------------------- Docs

async function docs(ctx) {
    section('Docs: more pages, onboarding + client process, page permissions');
    const m = ctx.m;
    const space = await step('space', () => ensureIn('docs spaces', '/docs/spaces?limit=100', 'name', 'Engineering handbook', () => post('/docs/spaces', { name: 'Engineering handbook', description: 'How we build, review and ship', icon: '🛠️', kind: 'DEPARTMENT', team_id: ctx.teams.WEB?.id, default_visibility: 'ORGANIZATION' })));
    const ops = await step('ops space', () => ensureIn('docs spaces', '/docs/spaces?limit=100', 'name', 'Agency operations', () => post('/docs/spaces', { name: 'Agency operations', description: 'Client process, policies and internal planning', icon: '📋', kind: 'DEPARTMENT', default_visibility: 'ORGANIZATION' })));
    if (!space || !ops) return;

    const existing = async (spaceId) => rows(await get(`/docs/pages?space_id=${spaceId}&limit=100`));
    const have = { eng: await existing(space.id), ops: await existing(ops.id) };
    const mk = async (key, spaceId, p) => {
        const found = have[key].find((x) => x.title === p.title);
        if (found) { bump('docs pages', 'reused'); return found; }
        const created = await step(`page ${p.title}`, () => post('/docs/pages', { space_id: spaceId, publish: true, ...p }));
        if (created) { bump('docs pages', 'created'); have[key].push(created); }
        return created;
    };

    const onboarding = await mk('eng', space.id, {
        title: 'Developer onboarding — first week', page_type: 'ONBOARDING_GUIDE', icon: '🚀', review_interval_days: 180,
        content_markdown: '# Developer onboarding — first week\n\n## Day 1\n- Laptop, GitHub, Figma and Slack-style chat access\n- Meet your buddy and your manager\n- Clone the starter repo and run it locally\n\n## Days 2-3\n- Read [[Code review guidelines]] and [[Release checklist]]\n- Pick a "good first task" from the Web team board\n\n## By Friday\n- First pull request merged\n- 30-minute feedback chat with your manager\n\n> Questions? Ask in the team channel - nobody minds.',
    });
    await mk('eng', space.id, {
        title: 'Architecture decision: monorepo for client projects', page_type: 'DECISION_RECORD', icon: '🧭',
        content_markdown: '# ADR-007: Monorepo for client projects\n\n**Status:** accepted\n\n## Context\nEvery client project had its own repo and CI setup, so improvements never spread.\n\n## Decision\nNew client projects start from one monorepo template with shared lint, CI and deployment config.\n\n## Consequences\n- Faster project setup (hours instead of days)\n- Needs a clear upgrade path for projects on older template versions',
    });
    await mk('eng', space.id, {
        title: 'On-call and incident FAQ', page_type: 'FAQ', icon: '🚨',
        content_markdown: '# On-call FAQ\n\n**Who is on call?** See the rota in the calendar (calendar "On-call").\n\n**What counts as an incident?** Anything that blocks a customer in production.\n\n**What do I do first?** Acknowledge, open an incident in Support, post in the incident channel, then investigate.',
    });

    const clientProcess = await mk('ops', ops.id, {
        title: 'Client process — from first call to launch', page_type: 'PROCEDURE', icon: '🤝', review_interval_days: 90,
        content_markdown: '# Client process\n\n1. **Discovery call** - qualify the lead in the CRM and capture needs.\n2. **Proposal** - send from the CRM deal; usually a fixed scope with optional extras.\n3. **Contract** - signed electronically before any work starts.\n4. **Kickoff** - create the project from a template, invite the client to the portal.\n5. **Delivery** - two-week cycles, a status update every Friday.\n6. **Launch and handover** - go-live checklist, then handover to support.\n7. **Closeout** - lessons learned, final invoice, customer survey.\n\n## Roles\n| Role | Responsibility |\n| -- | -- |\n| Account manager | Relationship, proposal, contract |\n| Project manager | Plan, status updates, risks |\n| Tech lead | Estimates, architecture, quality |',
    });
    await mk('ops', ops.id, {
        title: 'Information security policy', page_type: 'POLICY', icon: '🔐', review_interval_days: 365,
        content_markdown: '# Information security policy\n\n- Use the company password manager; no shared passwords in chat.\n- Enable two-factor authentication on every work account.\n- Lock your screen when away.\n- Report suspected incidents immediately.',
    });
    const hiring = await mk('ops', ops.id, {
        title: 'Hiring plan and salary bands (restricted)', page_type: 'GENERAL', icon: '💼', visibility: 'MEMBERS',
        content_markdown: '# Hiring plan\n\n- Q1: one senior developer (Web team)\n- Q2: one designer\n\n## Salary bands\nSee the finance sheet. This page is visible only to the members listed in its permissions.',
    });

    // ---- page permissions (members + team grants; nobody is notified)
    const grants = (page, visibility, list) => step(`permissions ${page.title}`, async () => { await put(`/docs/pages/${page.id}/permissions`, { visibility, grants: list }); bump('docs page permissions', 'created'); });
    if (hiring) await grants(hiring, 'MEMBERS', [
        { principal_type: 'MEMBERSHIP', principal_id: m.owner.id, level: 'MANAGE' },
        { principal_type: 'MEMBERSHIP', principal_id: m.kim?.id, level: 'VIEW' },
        { principal_type: 'MEMBERSHIP', principal_id: m.elena?.id, level: 'COMMENT' },
    ].filter((g) => g.principal_id));
    if (clientProcess && ctx.teams.SAL) await grants(clientProcess, 'ORGANIZATION', [
        { principal_type: 'TEAM', principal_id: ctx.teams.SAL.id, level: 'EDIT' },
        ...(ctx.teams.WEB ? [{ principal_type: 'TEAM', principal_id: ctx.teams.WEB.id, level: 'COMMENT' }] : []),
    ]);
    if (onboarding && ctx.teams.WEB) await grants(onboarding, 'ORGANIZATION', [{ principal_type: 'TEAM', principal_id: ctx.teams.WEB.id, level: 'EDIT' }]);

    // a comment thread on the client process page (no mentions)
    if (clientProcess) await step('page comment', async () => {
        const c = rows(await get(`/docs/pages/${clientProcess.id}/comments`));
        if (c.length) return bump('docs comments', 'reused');
        await post(`/docs/pages/${clientProcess.id}/comments`, { body: 'Should step 5 mention the customer approval gate in the portal?' });
        bump('docs comments', 'created');
    });
}
REG.docs = docs;
// @@END docs
// ---------------------------------------------------------------- @@BEGIN files
// ---------------------------------------------------------------- Files

async function files(ctx) {
    section('Files: retention policy, folder template, document template');

    // retention policies (ARCHIVE only - never a delete action)
    const policies = rows(await get('/files/retention/policies?limit=100'));
    const policyDefs = [
        { name: 'Invoices and contracts — 10 years', description: 'Statutory retention for financial and legal documents.', scope: 'ORGANIZATION', retain_days: 3650, anchor: 'CREATED', action: 'ARCHIVE', is_active: true },
        { name: 'Project working files — 2 years after close', description: 'Working documents are archived two years after the project is closed.', scope: 'PROJECT', retain_days: 730, anchor: 'RECORD_CLOSED', action: 'ARCHIVE', is_active: true },
        { name: 'Employee records — 5 years', scope: 'EMPLOYEE', retain_days: 1825, anchor: 'LAST_MODIFIED', action: 'ARCHIVE', is_active: false },
    ];
    for (const p of policyDefs) {
        if (policies.some((x) => x.name === p.name)) { bump('files retention policies', 'reused'); continue; }
        await step(`retention ${p.name}`, async () => { await post('/files/retention/policies', p); bump('files retention policies', 'created'); });
    }

    // folder template
    const ftemplates = rows(await get('/files/folder-templates?limit=100'));
    if (ftemplates.some((x) => x.name === 'Customer project folders')) bump('files folder templates', 'reused');
    else await step('folder template', async () => {
        await post('/files/folder-templates', {
            name: 'Customer project folders', description: 'Standard structure for every new customer project.', target: 'ORGANIZATION', is_default: false,
            structure: [
                { name: '01 Contract and proposal' },
                { name: '02 Briefs and requirements', customer_visible: true },
                { name: '03 Design', customer_visible: true, children: [{ name: 'Wireframes' }, { name: 'Final artwork' }] },
                { name: '04 Delivery', children: [{ name: 'Releases' }, { name: 'Test reports' }] },
                { name: '05 Invoices' },
            ],
        });
        bump('files folder templates', 'created');
    });

    // document template: a text document with {{placeholders}}, then the template over it
    const tree = await get('/files/folders/tree');
    let folder = tree.find((f) => f.name === 'Templates' && !f.parent_folder_id);
    if (!folder) folder = await step('templates folder', () => post('/files/folders', { name: 'Templates', description: 'Source documents for document templates' }).then((f) => { bump('folders', 'created'); return f; }));
    const dtemplates = rows(await get('/files/document-templates?limit=100'));
    if (dtemplates.some((x) => x.name === 'Project kickoff agenda')) bump('files document templates', 'reused');
    else if (folder) await step('document template', async () => {
        const form = new FormData();
        const text = 'Kickoff agenda - {{project_name}}\n\nCustomer: {{customer_name}}\nDate: {{kickoff_date}}\nProject manager: {{project_manager}}\n\n1. Introductions\n2. Goals and success criteria\n3. Scope and timeline\n4. Communication plan\n5. Risks and open questions\n';
        form.append('file', new Blob([text], { type: 'text/plain' }), 'kickoff-agenda-template.txt');
        form.append('folder_id', folder.id);
        form.append('title', 'kickoff-agenda-template');
        const doc = await post('/files/upload', form);
        await post('/files/document-templates', {
            document_id: doc.id ?? doc.document?.id, name: 'Project kickoff agenda', description: 'Agenda for the kickoff meeting of a customer project.', folder_id: folder.id, scope: 'ORGANIZATION',
            variables: [{ key: 'project_name', label: 'Project name', required: true }, { key: 'customer_name', label: 'Customer', required: true }, { key: 'kickoff_date', label: 'Kickoff date' }, { key: 'project_manager', label: 'Project manager', default: 'To be assigned' }],
        });
        bump('files document templates', 'created');
    });
}
REG.files = files;
// @@END files
// ---------------------------------------------------------------- @@BEGIN automation
// ---------------------------------------------------------------- Automation

async function automation(ctx) {
    section('Automation: approval policy, date-relative draft workflow, outbound webhook (paused)');
    const m = ctx.m;

    // approval policies
    const policyDefs = [
        { name: 'Finance approvals', description: 'Invoices, expenses and payouts above the auto-approve limit.', approver_membership_ids: [m.kim?.id, m.owner?.id].filter(Boolean), allow_rule_owner: false, expires_after_hours: 72, escalate_after_hours: 24, escalate_to_membership_id: m.owner?.id, delegate_when_out_of_office: true },
        { name: 'Delivery sign-off', description: 'Releases and deliverables: any project manager or the web team lead.', approver_membership_ids: [m.elena?.id].filter(Boolean), approver_team_ids: ctx.teams.WEB ? [ctx.teams.WEB.id] : [], allow_rule_owner: false, expires_after_hours: 120, delegate_when_out_of_office: true },
    ];
    for (const p of policyDefs) await step(`approval policy ${p.name}`, () => ensureIn('automation approval policies', '/automation/approval-policies?limit=100', 'name', p.name, () => post('/automation/approval-policies', p)));

    // date-relative workflow, left as a DRAFT (never published or enabled)
    const rules = rows(await get('/automation/rules?limit=100'));
    const dateRule = { name: 'Remind before task due date', description: 'Three days before a task is due, notify the assignee. Draft - not published.', module: 'TASKS', trigger_kind: 'DATE_RELATIVE', trigger_key: 'date.tasks.task.due_date', entity_type: 'TASK', trigger_config: { offset_days: 3, direction: 'before' },
        actions: [{ key: 'notify_assignee', name: 'Notify assignee', action_key: 'notifications.notify', inputs: { recipient_membership_ids: ['{{event.payload.assignee_membership_id}}'], title: 'Task due in 3 days: {{event.payload.title}}' }, on_error: 'continue' }] };
    if (rules.some((r) => r.name === dateRule.name)) bump('automation workflows (draft)', 'reused');
    else await step('date-relative rule', async () => {
        try { await post('/automation/rules', dateRule, { quiet: true }); }
        catch (e) {
            // some builds expect the trigger key without the `date.` prefix
            if (!(e instanceof ApiError) || e.status >= 500) throw e;
            await post('/automation/rules', { ...dateRule, trigger_key: 'tasks.task.due_date' });
        }
        bump('automation workflows (draft)', 'created');
    });

    // outbound webhook to an example endpoint, immediately paused
    const hooks = rows(await get('/automation/webhooks/outbound?limit=100'));
    let hook = hooks.find((h) => h.name === 'Example receiver');
    if (hook) bump('outbound webhooks', 'reused');
    else {
        hook = await step('outbound webhook', () => post('/automation/webhooks/outbound', { name: 'Example receiver', description: 'Test endpoint - paused, no deliveries are sent.', url: 'https://example.com/hooks/test', subscribed_events: ['crm.deal.won', 'tasks.task.completed'], max_attempts: 3, timeout_seconds: 10 }));
        if (hook) bump('outbound webhooks', 'created');
    }
    if (hook && !hook.paused_at && hook.status !== 'PAUSED' && hook.is_active !== false) await step('pause webhook', () => post(`/automation/webhooks/outbound/${hook.id}/pause`));
}
REG.automation = automation;
// @@END automation
// ---------------------------------------------------------------- @@BEGIN calendar
// ---------------------------------------------------------------- Calendar

async function calendar(ctx) {
    section('Calendar: room resource, recurring event with an edited occurrence');
    const athens = ctx.branches.find((b) => /athens/i.test(b.name)) ?? ctx.hq;
    const resources = rows(await get('/calendar/resources'));
    let room = resources.find((r) => r.name === 'Aegean meeting room');
    if (room) bump('calendar resources', 'reused');
    else {
        room = await step('resource', () => post('/calendar/resources', { name: 'Aegean meeting room', kind: 'ROOM', code: 'ATH-1', description: 'Meeting room with a screen and video-conference kit.', capacity: 8, location: 'Athens studio, 2nd floor', color: 'info', requires_approval: false, branch_id: athens?.id ?? null }));
        if (room) bump('calendar resources', 'created');
    }
    await step('second resource', async () => {
        if (resources.some((r) => r.name === 'Demo projector')) return bump('calendar resources', 'reused');
        await post('/calendar/resources', { name: 'Demo projector', kind: 'EQUIPMENT', code: 'EQ-PRJ', description: 'Portable projector for client demos.', color: 'violet' });
        bump('calendar resources', 'created');
    });

    // recurring series without attendees (so no invitations go out), booking the room
    const title = 'Design review';
    const from = iso(day(-1));
    const to = iso(day(80));
    const existing = rows(await get(`/calendar/events${qs({ from, to })}`)).filter((e) => String(e.title).startsWith(title));
    let master = existing[0];
    if (master) bump('calendar recurring events', 'reused');
    else {
        // first Thursday from tomorrow on
        let off = 1;
        while (day(off).getUTCDay() !== 4) off++;
        const start = at(off, 10);
        master = await step('recurring event', () => post('/calendar/events', {
            title, description: 'Weekly design review of the current sprint.', starts_at: iso(start), ends_at: iso(new Date(start.getTime() + 45 * 60_000)), timezone: 'Europe/Athens',
            recurrence: { freq: 'WEEKLY', byday: [4], count: 8 }, visibility: 'ORGANIZATION', color: 'violet', reminders: [{ minutes_before: 10, method: 'NOTIFICATION' }],
            ...(room ? { resource_ids: [room.id] } : {}),
        }));
        if (master) bump('calendar recurring events', 'created');
    }
    if (master) await step('edit one occurrence', async () => {
        const id = master.id ?? master.event_id;
        const list = rows(await get(`/calendar/events${qs({ from, to })}`)).filter((e) => String(e.title).startsWith(title) || e.id === id || e.event_id === id);
        const occ = list.sort((a, b) => new Date(a.starts_at ?? a.start) - new Date(b.starts_at ?? b.start))[1];
        if (!occ) { console.log('  (series has no second occurrence in range)'); return; }
        if (list.some((e) => /moved/i.test(e.title ?? ''))) return bump('calendar edited occurrences', 'reused');
        const s = new Date(occ.starts_at ?? occ.start);
        const e = new Date(occ.ends_at ?? occ.end);
        await post(`/calendar/events/${id}/occurrences`, {
            occurrence_start: occ.occurrence_start ?? iso(s), title: 'Design review (moved to the afternoon)', starts_at: iso(new Date(s.getTime() + 5 * 3600_000)), ends_at: iso(new Date(e.getTime() + 5 * 3600_000)), description: 'Moved because of the client workshop in the morning.',
        });
        bump('calendar edited occurrences', 'created');
    });
}
REG.calendar = calendar;
// @@END calendar
// ---------------------------------------------------------------- @@BEGIN messages
// ---------------------------------------------------------------- Messages

async function messages(ctx) {
    section('Messages: channel with a pinned message and an attachment');
    const m = ctx.m;
    const mine = rows(await get('/messaging/channels'));
    const name = 'client-launches';
    const channel = await step('channel', () =>
        ensure('channels', async () => mine.find((c) => c.slug === name || c.name === name) ?? rows(await get(`/messaging/channels/browse${qs({ search: name })}`)).find((c) => c.slug === name), () =>
            post('/messaging/channels', { name, kind: 'PUBLIC', description: 'Launch plans and go-live checklists for client projects', topic: 'Launch coordination', membership_ids: ['elena', 'jonas', 'sofia', 'nikos'].map((n) => m[n]?.id).filter(Boolean) }),
        ),
    );
    if (!channel) return;
    const text = [
        { id: 'extra-launch-1', body: '**Launch rules**\n\n1. Freeze scope 48h before go-live\n2. Run the launch checklist in the project\n3. Post the go/no-go result here', pin: true },
        { id: 'extra-launch-2', body: 'Northwind storefront beta: staging is green, production deploy is planned after the customer sign-off.' },
    ];
    let pinned = null;
    for (const x of text) {
        await step(`message ${x.id}`, async () => {
            const msg = await post(`/messaging/channels/${channel.id}/messages`, { body: x.body, client_message_id: x.id });
            bump('messages', 'created');
            if (x.pin) pinned = msg;
        });
    }
    if (pinned) await step('pin', async () => { await put(`/messaging/messages/${pinned.id}/pin`, {}); bump('pinned messages', 'created'); });
    else {
        const existing = rows(await get(`/messaging/channels/${channel.id}/pins`));
        if (existing.length) bump('pinned messages', 'reused');
    }

    // attachment: upload a small text file, then post it with a message
    await step('attachment', async () => {
        const files = rows(await get(`/messaging/channels/${channel.id}/files`));
        if (files.some((f) => /launch-runbook/i.test(f.file_name ?? f.name ?? ''))) return bump('message attachments', 'reused');
        const fd = new FormData();
        fd.append('file', new Blob(['Launch runbook\n\n1. Final backup\n2. Deploy\n3. Smoke tests\n4. Announce\n'], { type: 'text/plain' }), 'launch-runbook.txt');
        const up = await call('POST', `/messaging/channels/${channel.id}/attachments`, fd);
        await post(`/messaging/channels/${channel.id}/messages`, { body: 'Runbook for the next go-live attached.', client_message_id: 'extra-launch-3', attachments: [{ document_id: up.document_id ?? up.id, file_name: up.file_name ?? 'launch-runbook.txt', mime_type: up.mime_type ?? 'text/plain', size_bytes: up.size_bytes ?? 70 }] });
        bump('message attachments', 'created');
    });
}
REG.messages = messages;
// @@END messages
// ---------------------------------------------------------------- @@BEGIN support
// ---------------------------------------------------------------- Support

async function support(ctx) {
    section('Support: widget channel with AI suggest-only mode and office hours');
    const channels = rows(await get('/support/channels?limit=100'));
    let widget = channels.find((c) => c.type === 'WIDGET' && c.is_active !== false);
    if (widget) bump('support widget channels', 'reused');
    else {
        const inboxes = rows(await get('/support/inboxes'));
        const inbox = inboxes.find((i) => i.is_default) ?? inboxes[0];
        if (!inbox) { console.warn('  ! no support inbox'); return; }
        widget = await step('widget channel', () => post('/support/channels', { inbox_id: inbox.id, type: 'WIDGET', name: 'Website chat', allowed_origins: ['https://www.example.com'], csat_enabled: true, config: { title: 'Chat with us', welcome_message: 'Hi! Ask us anything about your project or invoices.', primary_color: '#2563eb' } }));
        if (widget) bump('support widget channels', 'created');
    }
    if (!widget) return;
    // SUGGEST = a draft reply is prepared for an agent to review; the AI never answers customers by itself.
    // (A suggestion is only produced when a customer writes in; nothing is generated by this script.)
    await step('ai agent suggest-only', async () => {
        await put(`/support/channels/${widget.id}/ai-agent`, { mode: 'SUGGEST', min_confidence: 0.8, max_turns: 3, handover_phrases: ['speak to a person', 'call me', 'refund'] });
        bump('support ai config (SUGGEST)', 'created');
    });
    await step('office hours', async () => {
        await put(`/support/channels/${widget.id}/office-hours`, {
            enabled: true, use_organization_hours: false, timezone: 'Europe/Athens',
            days: { mon: { start: '09:00', end: '17:30' }, tue: { start: '09:00', end: '17:30' }, wed: { start: '09:00', end: '17:30' }, thu: { start: '09:00', end: '17:30' }, fri: { start: '09:00', end: '15:00' } },
            offline_message: 'We are offline right now. Leave your email and we will answer on the next working day.',
        });
        bump('support office hours', 'created');
    });
}
REG.support = support;
// @@END support
// ---------------------------------------------------------------- @@BEGIN communications
// ---------------------------------------------------------------- Communications

async function communications(ctx) {
    section('Communications: topics, A/B draft campaign, recurring draft campaign (nothing is scheduled or sent)');
    const topicDefs = [
        { name: 'Product updates', slug: 'product-updates', description: 'Releases and new features', channel: 'EMAIL', default_opt_in: true, sort_order: 1 },
        { name: 'Newsletter', slug: 'newsletter', description: 'Our monthly newsletter', channel: 'EMAIL', default_opt_in: false, sort_order: 2 },
        { name: 'Events and webinars', slug: 'events', description: 'Invitations to events and webinars', channel: 'EMAIL', default_opt_in: false, sort_order: 3 },
        { name: 'Service announcements', slug: 'service-announcements', description: 'Maintenance windows and incidents', channel: 'EMAIL', default_opt_in: true, sort_order: 4 },
    ];
    const topics = rows(await get('/communications/topics?limit=100'));
    const topicBy = {};
    for (const t of topics) topicBy[t.slug] = t;
    for (const t of topicDefs) {
        if (topicBy[t.slug]) { bump('comm topics', 'reused'); continue; }
        const c = await step(`topic ${t.slug}`, () => post('/communications/topics', t));
        if (c) { bump('comm topics', 'created'); topicBy[t.slug] = c; }
    }

    const template = await step('template', () => findBy('/communications/templates', 'name', 'Monthly newsletter'));
    const list = await step('list', () => findBy('/communications/lists', 'name', 'Customers — newsletter'));
    const audiences = list ? [{ mode: 'INCLUDE', list_id: list.id }] : undefined;
    const campaigns = rows(await get('/communications/campaigns?limit=100'));

    // A/B test draft (two subject lines)
    let ab = campaigns.find((c) => c.name === 'Product launch — subject line test');
    if (ab) bump('campaigns (draft)', 'reused');
    else {
        ab = await step('A/B campaign', () => post('/communications/campaigns', {
            name: 'Product launch — subject line test', channel: 'EMAIL', description: 'A/B test of two subject lines; the better opener goes to the rest of the list.', campaign_type: 'announcement', template_id: template?.id, from_name: 'Logiqdev',
            audiences, topic_id: topicBy['product-updates']?.id, ab_test_enabled: true, ab_metric: 'OPEN', ab_test_percent: 30, ab_wait_hours: 24,
        }));
        if (ab) bump('campaigns (draft)', 'created');
        if (ab) await step('A/B variants', () => put(`/communications/campaigns/${ab.id}/variants`, { variants: [
            { subject: 'We just launched something new for your team', preheader: 'Take a look at the new release', body_html: '<h1>Hi {{first_name | there}},</h1><p>We just launched a new release. Here is what changed.</p>', body_text: 'Hi {{first_name | there}}, we just launched a new release.', share_percent: 50 },
            { subject: '{{first_name | Hi}}, your projects just got faster', preheader: 'Three improvements you will notice today', body_html: '<h1>Hi {{first_name | there}},</h1><p>Your projects just got faster. Here are three improvements.</p>', body_text: 'Hi {{first_name | there}}, your projects just got faster.', share_percent: 50 },
        ] }).then(() => bump('campaign variants', 'created')));
    }

    // recurring draft (first Monday style weekly digest) - stays a draft
    if (campaigns.some((c) => c.name === 'Weekly project digest')) bump('campaigns (draft)', 'reused');
    else await step('recurring campaign', async () => {
        await post('/communications/campaigns', {
            name: 'Weekly project digest', channel: 'EMAIL', description: 'Recurring Monday digest for customers. Draft - not scheduled.', campaign_type: 'newsletter', template_id: template?.id, from_name: 'Logiqdev',
            audiences, topic_id: topicBy.newsletter?.id, recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO', recurrence_ends_at: iso(at(120, 0)), send_in_recipient_timezone: true,
        });
        bump('campaigns (draft)', 'created');
    });
}
REG.communications = communications;
// @@END communications
// ---------------------------------------------------------------- @@BEGIN admin
// ---------------------------------------------------------------- Admin

async function admin(ctx) {
    section('Admin: delegation, access review (draft), retention, domain, SSO (not enabled)');
    const m = ctx.m;

    // delegation from the owner to a colleague, starting in the future (no effect on permissions today)
    if (m.elena) {
        const existing = rows(await get('/delegations?limit=100'));
        if (existing.some((d) => d.reason === 'Cover during annual leave')) bump('delegations', 'reused');
        else await step('delegation', async () => {
            await post('/delegations', { delegate_membership_id: m.elena.id, permission_keys: ['crm.deals.read', 'crm.companies.read', 'projects.projects.read'], scope_type: 'ORGANIZATION', starts_at: iso(at(30, 7)), ends_at: iso(at(37, 18)), reason: 'Cover during annual leave' });
            bump('delegations', 'created');
        });
    }

    // quarterly access review, created as a draft (start is not requested); the owner is the only reviewer
    const reviews = rows(await get('/access-reviews?limit=100'));
    if (reviews.some((r) => r.name === 'Q1 access review')) bump('access reviews (draft)', 'reused');
    else await step('access review', async () => {
        await post('/access-reviews', { name: 'Q1 access review', description: 'Quarterly certification of who has access to what.', scope_type: 'ORGANIZATION', modules: ['CRM', 'FINANCE', 'DOCUMENTS'], reviewer_strategy: 'SPECIFIC', reviewer_membership_ids: [m.owner.id], due_at: iso(at(45, 17)), start: false });
        bump('access reviews (draft)', 'created');
    });

    // retention policies (long periods so nothing existing is touched)
    const retention = [
        ['SESSIONS', { retention_days: 365, action: 'DELETE' }],
        ['INVITATIONS', { retention_days: 365, action: 'DELETE' }],
        ['WEBHOOK_DELIVERIES', { retention_days: 180, action: 'DELETE' }],
        ['AUDIT_EVENTS', { retention_days: 1095, action: 'ARCHIVE' }],
    ];
    for (const [cls, body] of retention) await step(`retention ${cls}`, async () => { await put(`/retention-policies/${cls}`, body); bump('admin retention policies', 'created'); });

    // domain entry (not verified; no auto-provisioning)
    const domains = rows(await get('/domains?limit=100'));
    if (domains.some((d) => d.domain === 'demo-agency.example.com')) bump('domains', 'reused');
    else await step('domain', async () => { await post('/domains', { domain: 'demo-agency.example.com', allow_discovery: false, auto_provision: false }); bump('domains', 'created'); });

    // SSO configuration, left as it is created (never enabled, no handshake exists)
    const sso = rows(await get('/sso-configurations'));
    if (sso.some((s) => s.name === 'Demo OIDC provider')) bump('sso configurations', 'reused');
    else await step('sso', async () => {
        const c = await post('/sso-configurations', { protocol: 'OIDC', name: 'Demo OIDC provider', auto_provision: false, config: { issuer: 'https://login.example.com', client_id: 'logiqdev-demo-client', scopes: ['openid', 'email', 'profile'], attribute_mapping: { email: 'email', first_name: 'given_name', last_name: 'family_name', groups: 'groups' } }, secrets: { client_secret: 'demo-secret-not-real' } });
        bump('sso configurations', 'created');
        const role = rows(await get('/roles?limit=100')).find((r) => r.slug === 'developer');
        if (c?.id && role) await step('sso group mapping', () => post(`/sso-configurations/${c.id}/group-mappings`, { external_group: 'engineering', role_id: role.id, team_id: ctx.teams.WEB?.id ?? null }));
    });
}
REG.admin = admin;
// @@END admin
// ---------------------------------------------------------------- @@BEGIN notifications
// ---------------------------------------------------------------- Notifications

async function notifications(ctx) {
    section('Notifications: org defaults, delivery rule');
    // NOTE: /notification-settings (enabled channels) is deliberately not touched here: main() mutes + restores it.
    const defaults = [
        { module: 'TASKS', enabled: true, channels: ['IN_APP', 'EMAIL'], delivery_mode: 'DIGEST', digest_frequency: 'DAILY' },
        { module: 'CRM', enabled: true, channels: ['IN_APP', 'EMAIL'], delivery_mode: 'IMMEDIATE' },
        { module: 'MESSAGING', enabled: true, channels: ['IN_APP'], delivery_mode: 'IMMEDIATE' },
        { module: 'SUPPORT', enabled: true, channels: ['IN_APP', 'EMAIL'], delivery_mode: 'IMMEDIATE', is_mandatory: false },
        { module: 'FINANCE', enabled: true, channels: ['IN_APP', 'EMAIL'], delivery_mode: 'IMMEDIATE' },
    ];
    for (const d of defaults) await step(`default ${d.module}`, async () => { await put('/notification-defaults', d); bump('notification org defaults', 'created'); });

    const rules = rows(await get('/notification-delivery-rules?limit=100'));
    const ruleDefs = [
        { name: 'Coalesce task comments per task', kind: 'COALESCE', module: 'TASKS', channel: 'EMAIL', window_seconds: 900, coalesce_key: 'RECORD', priority: 10, is_active: true },
        { name: 'Throttle message e-mails', kind: 'THROTTLE', module: 'MESSAGING', channel: 'EMAIL', window_seconds: 3600, max_per_window: 5, coalesce_key: 'RECIPIENT', priority: 20, is_active: true },
    ];
    for (const r of ruleDefs) {
        if (rules.some((x) => x.name === r.name)) { bump('notification delivery rules', 'reused'); continue; }
        await step(`delivery rule ${r.name}`, async () => { await post('/notification-delivery-rules', r); bump('notification delivery rules', 'created'); });
    }
}
REG.notifications = notifications;
// @@END notifications
//@@SECTIONS@@

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
