/**
 * Demo seed — fills (almost) every table with plausible test data for one organization so the whole UI can be exercised.
 *
 * Schema-driven: it walks the Prisma data model (Prisma.dmmf), orders tables by their foreign keys, and generates
 * values per column from the column name / type. Every foreign key points at a row of the SAME organization
 * (tenant isolation); platform-global tables are only filled when they are empty.
 *
 * Idempotent-ish: a table is topped up to a target row count, so re-running adds nothing once the target is reached.
 *
 *   npx dotenv run -f .env.staging -- npx tsx prisma/seed/demo.ts --email=anna.zoi@yahoo.com
 *   flags: --only=Tag,Team   (restrict to models)   --target=8   --users=5
 *
 * Safety: models that can lock a user out or gate features (SSO, security policy, entitlements) are skipped, and
 * in-flight enum values (PENDING / QUEUED / SENDING …) are avoided on job-like tables so no worker sends anything.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaClient } from '../../src/generated/prisma';
import { readSchema } from './schema-model';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? 'true']));
const EMAIL = args.email ?? 'anna.zoi@yahoo.com';
const TARGET = Number(args.target ?? 8);
const BIG_TARGET = Math.max(TARGET, 25);
const EXTRA_USERS = Number(args.users ?? 5);
const ONLY = args.only ? new Set(args.only.split(',')) : null;
const SALT = randomBytes(2).toString('hex');

const prisma: any = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }) });
const schema = readSchema();
const models: any[] = schema.models;
const enums = schema.enums;
const modelByName = new Map<string, any>(models.map((m) => [m.name, m]));
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Never seeded: they can lock the user out or change feature gating. */
const SKIP = new Set(['Organization', 'OrganizationSecurityPolicy', 'SsoConfiguration', 'SsoGroupMapping', 'OrganizationEntitlement', 'PlatformWebPushKey']);
/** Seeded with column defaults only (no enum cycling). */
const DEFAULTS_ONLY = new Set<string>([]);
const BIG = new Set([
  'CrmContact', 'CrmCompany', 'CrmLead', 'CrmDeal', 'Task', 'Project', 'Ticket', 'Invoice', 'LedgerRecord', 'Document', 'Employee',
  'TimeEntry', 'Message', 'Notification', 'CalendarEvent', 'Proposal', 'Contract', 'WikiPage', 'SupportConversation',
]);
const JOBLIKE = /Job|Delivery|Outbox|Queue|Webhook|Campaign|Run|Export|Import|Retry|CommMessage|Dispatch|Schedule|Timer/;
const INFLIGHT = /^(PENDING|QUEUED|SCHEDULED|SENDING|RUNNING|PROCESSING|RETRYING|IN_PROGRESS|STARTED|ACTIVE_RUN)$/;
const AVOID_VALUE = /DELET|PURG|ERASE/;

// ---------------------------------------------------------------------------------------------- word lists
const FIRST = ['Maria', 'Nikos', 'Eleni', 'Giorgos', 'Sofia', 'Dimitris', 'Katerina', 'Yannis', 'Anna', 'Petros', 'Ioanna', 'Costas'];
const LAST = ['Papadopoulos', 'Georgiou', 'Nikolaou', 'Dimitriou', 'Alexiou', 'Ioannou', 'Vasileiou', 'Markou', 'Stavrou', 'Lazaridis'];
const COMPANIES = ['Acme Hellas', 'Blue Harbor Studio', 'Nordlicht GmbH', 'Olive & Co', 'Delta Logistics', 'Atlas Software', 'Kyma Hotels', 'Zenith Retail', 'Pallas Consulting', 'Meltemi Foods', 'Orion Labs', 'Helios Energy'];
const PROJECTS = ['Website redesign', 'Mobile app MVP', 'ERP migration', 'Brand refresh', 'Customer portal', 'Data warehouse', 'Q4 campaign', 'Onboarding revamp', 'Security audit', 'Booking engine'];
const TITLES = ['Quarterly review', 'Contract renewal follow-up', 'Kick-off preparation', 'Invoice reconciliation', 'Onboarding checklist', 'Pricing proposal update', 'Support escalation', 'Roadmap planning', 'Vendor evaluation', 'Budget approval'];
const LOREM = [
  'Reviewed the latest figures with the team and agreed on the next steps.',
  'The customer asked for an updated timeline before the end of the month.',
  'Waiting on approval; follow up on Thursday if there is no answer.',
  'All deliverables were checked against the acceptance criteria.',
  'This item was created automatically for demo and testing purposes.',
  'Please confirm the details below and let us know if anything is missing.',
  'We discussed scope, pricing and the delivery schedule in detail.',
  'No blockers at the moment; progress is on track for the planned date.',
];
const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#4b5563'];
const CITIES = ['Athens', 'Thessaloniki', 'Patras', 'Heraklion', 'Larissa', 'Volos'];

const humanize = (model: string) => model.replace(/^(Crm|Comm|Wiki|Support|Project|Time|Calendar)(?=[A-Z])/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
const kebab = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/_/g, '-').toLowerCase();
const hashStr = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pick = <T>(arr: T[], i: number) => arr[i % arr.length];
const pascal = (s: string) => s.split('_').filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join('');

// ---------------------------------------------------------------------------------------------- model analysis
const fkFields = (m: any) => m.fields.filter((f: any) => f.kind === 'object' && f.relationFromFields?.length);
const uniqueScalarNames = (m: any) => {
  const s = new Set<string>();
  m.fields.forEach((f: any) => f.isUnique && s.add(f.name));
  (m.uniqueFields ?? []).forEach((g: string[]) => g.forEach((n) => s.add(n)));
  (m.uniqueIndexes ?? []).forEach((u: any) => (u.fields ?? []).forEach((n: string) => s.add(n)));
  return s;
};
const tableOf = (m: any) => m.dbName ?? m.name;
/** Column list without Unsupported types (tsvector etc.) that raw queries cannot deserialize. */
const colsOf = (m: any, alias = '') =>
  m.fields.filter((f: any) => f.kind === 'scalar' || f.kind === 'enum').map((f: any) => `${alias}"${f.dbName ?? f.name}"`).join(', ');

type Scope = 'org' | 'scoped' | 'global';
const scopeOf = new Map<string, Scope>();
const order: any[] = [];
{
  const state = new Map<string, number>();
  const visit = (m: any) => {
    if (state.has(m.name)) return;
    state.set(m.name, 1);
    for (const f of fkFields(m)) {
      if (f.type !== m.name) {
        const t = modelByName.get(f.type);
        if (t) visit(t);
      }
    }
    state.set(m.name, 2);
    order.push(m);
  };
  models.forEach(visit);
  for (const m of order) {
    if (m.name === 'User' || m.name === 'Organization' || m.fields.some((f: any) => f.name === 'organization_id')) scopeOf.set(m.name, 'org');
    else if (fkFields(m).some((f: any) => scopeOf.get(f.type) && scopeOf.get(f.type) !== 'global')) scopeOf.set(m.name, 'scoped');
    else scopeOf.set(m.name, 'global');
  }
}

// ---------------------------------------------------------------------------------------------- pools
const pools = new Map<string, any[]>();
let ORG = '';
const POOL_CAP = 300;

async function loadPool(m: any): Promise<any[]> {
  const t = tableOf(m);
  const scope = scopeOf.get(m.name);
  if (m.name === 'Organization') return prisma.$queryRawUnsafe(`select ${colsOf(m)} from "${t}" where id::text = $1`, ORG);
  if (m.name === 'User')
    return prisma.$queryRawUnsafe(`select ${colsOf(m, "u.")} from "${t}" u where u.id::text in (select user_id::text from "${tableOf(modelByName.get('Membership'))}" where organization_id::text = $1) limit ${POOL_CAP}`, ORG);
  if (scope === 'org') return prisma.$queryRawUnsafe(`select ${colsOf(m)} from "${t}" where organization_id::text = $1 limit ${POOL_CAP}`, ORG);
  if (scope === 'scoped') {
    const conds: string[] = [];
    const params: any[] = [];
    for (const f of fkFields(m)) {
      const target = pools.get(f.type);
      if (scopeOf.get(f.type) === 'global' || !target?.length || f.relationFromFields.length !== 1) continue;
      params.push(target.map((r) => String(r[f.relationToFields[0]])));
      conds.push(`"${f.relationFromFields[0]}"::text = any($${params.length}::text[])`);
    }
    if (!conds.length) return [];
    return prisma.$queryRawUnsafe(`select ${colsOf(m)} from "${t}" where ${conds.join(' or ')} limit ${POOL_CAP}`, ...params);
  }
  return prisma.$queryRawUnsafe(`select ${colsOf(m)} from "${t}" limit ${POOL_CAP}`);
}

// ---------------------------------------------------------------------------------------------- value generation
function enumValue(model: any, field: any, i: number): string {
  let values = enums.get(field.type) ?? [];
  const filtered = values.filter((v) => !AVOID_VALUE.test(v) && !(JOBLIKE.test(model.name) && INFLIGHT.test(v)));
  if (filtered.length) values = filtered;
  return values[(i + (hashStr(field.name) % 3)) % values.length];
}

function maxLen(field: any): number | undefined {
  const nt = field.nativeType;
  if (nt && /^(VarChar|Char)$/.test(nt[0]) && nt[1]?.[0]) return Number(nt[1][0]);
  return undefined;
}

function genString(model: any, field: any, i: number, unique: boolean): string {
  const n: string = field.name;
  const suffix = unique ? `-${SALT}${i}` : '';
  const humanModel = humanize(model.name);
  let v: string;
  if (/email/.test(n)) v = `${pick(FIRST, i).toLowerCase()}.${pick(LAST, i + 3).toLowerCase()}.${SALT}${i}@example.com`;
  else if (/phone|mobile|fax/.test(n)) v = `+3069${String(10000000 + ((i * 7919 + hashStr(model.name)) % 89999999))}`;
  else if (/first_name/.test(n)) v = pick(FIRST, i);
  else if (/last_name|surname/.test(n)) v = pick(LAST, i);
  else if (/display_name|full_name|contact_name|person|author_name|sender_name|recipient_name|signer_name|owner_name/.test(n)) v = `${pick(FIRST, i)} ${pick(LAST, i)}`;
  else if (/(image|photo|avatar|logo|icon|banner|thumbnail).*(url|link)|^(avatar|logo|icon)$/.test(n)) v = `https://picsum.photos/seed/${SALT}${i}/200`;
  else if (/(^|_)(url|link|href|uri|endpoint)$|website|webhook/.test(n)) v = `https://example.com/${kebab(model.name)}/${i + 1}`;
  else if (/slug/.test(n)) v = `${kebab(model.name)}-${i + 1}`;
  else if (/colou?r/.test(n)) v = pick(COLORS, i);
  else if (/currency/.test(n)) v = 'EUR';
  else if (/country/.test(n)) v = 'GR';
  else if (/locale|language/.test(n)) v = 'en';
  else if (/timezone|(^|_)tz$/.test(n)) v = 'Europe/Athens';
  // String columns validated against a closed list by the DTOs: obligations use none|weekly|monthly|quarterly|annual, billing uses monthly|quarterly|annual.
  else if (/(^|_)frequency$/.test(n)) v = pick(model.name === 'ContractObligation' ? ['none', 'weekly', 'monthly', 'quarterly', 'annual'] : ['monthly', 'quarterly', 'annual'], i);
  else if (/(^|_)ip(_address)?$/.test(n)) v = `203.0.113.${(i % 250) + 1}`;
  else if (/mime|content_type/.test(n)) v = 'application/pdf';
  else if (/file_?name|filename/.test(n)) v = `document-${i + 1}.pdf`;
  else if (/(^|_)(extension|ext)$/.test(n)) v = 'pdf';
  else if (/storage_key|object_key|(^|_)path$|file_key/.test(n)) v = `demo/${kebab(model.name)}/${SALT}-${i + 1}.pdf`;
  else if (/hash|checksum|sha|secret|token|signature|digest|nonce|fingerprint|(public|private|api|signing|encryption)_key|salt/.test(n)) v = randomBytes(32).toString('hex');
  else if (n === 'task_key') v = pick(['WEB', 'OPS', 'MKT', 'FIN', 'HR', 'SUP', 'DEV', 'SAL'], i);
  else if (/(^|_)key$/.test(n)) v = `${kebab(model.name).replace(/-/g, '_')}_${n.replace(/_key$/, '') || 'item'}_${i + 1}`;
  else if (/(^|_)(code|number|no|reference|ref|sku|identifier|external_id|prefix)$/.test(n)) v = `${model.name.replace(/[a-z]/g, '').slice(0, 4) || 'REF'}-${1000 + i}`;
  else if (/(^|_)(title|subject|headline|label)$/.test(n)) v = `${pick(TITLES, i + hashStr(model.name))}`;
  else if (/company_name|legal_name|organization_name|account_name|vendor|customer_name/.test(n)) v = pick(COMPANIES, i);
  else if (/name$/.test(n)) v = /Compan|Account|Vendor|Customer|Client/.test(model.name) ? pick(COMPANIES, i) : /Project|Workstream|Deliverable/.test(model.name) ? pick(PROJECTS, i) : `${humanModel} ${i + 1}`;
  else if (/description|body|content|notes?|message|summary|reason|comment|text|details|bio|excerpt|markdown|html|plain|transcript|instructions|terms|memo|remark|goal|objective/.test(n)) v = `${pick(LOREM, i)} ${pick(LOREM, i + 3)}`;
  else if (/street|address/.test(n)) v = `${10 + i} Ermou Street`;
  else if (/city/.test(n)) v = pick(CITIES, i);
  else if (/postal|zip/.test(n)) v = String(10551 + i);
  else if (/(^|_)(state|region)$/.test(n)) v = 'Attica';
  else if (/vat|tax_id|tax_number/.test(n)) v = `EL${String(100000000 + i * 1117)}`;
  else if (/iban/.test(n)) v = `GR16011012500000000${String(1234567 + i)}`;
  else v = `${humanModel} ${n.replace(/_/g, ' ')} ${i + 1}`;
  if (unique && !/email/.test(n)) v += suffix;
  const max = maxLen(field);
  return max ? v.slice(0, max) : v;
}

function genDecimal(field: any, i: number): string {
  const [p, s] = field.nativeType?.[1]?.map(Number) ?? [18, 2];
  const intDigits = Math.max(1, p - s);
  const cap = Math.pow(10, Math.min(intDigits, 6));
  const pct = /percent|pct|rate|tax|vat|discount|margin/.test(field.name);
  const raw = pct ? 5 + ((i * 3) % 20) : ((i + 1) * 137.25 + 50) % cap;
  return raw.toFixed(s);
}

function genInt(field: any, i: number): number {
  const n: string = field.name;
  if (/percent|pct/.test(n)) return 10 + ((i * 7) % 90);
  if (/minutes|duration|(^|_)mins$/.test(n)) return 30 + ((i * 45) % 450);
  if (/seconds/.test(n)) return 60 + i * 30;
  if (/quantity|(^|_)qty$/.test(n)) return 1 + (i % 10);
  if (/position|sort_order|(^|_)order$|rank|index|sequence/.test(n)) return i;
  if (/version|revision/.test(n)) return 1 + (i % 3);
  if (/amount|price|total|cents|cost|budget|balance|fee/.test(n)) return 10000 + ((i * 2750) % 90000);
  if (/size|bytes/.test(n)) return 20000 + i * 4096;
  if (/year/.test(n)) return 2026;
  if (/month/.test(n)) return 1 + (i % 12);
  if (/(^|_)day$|day_of/.test(n)) return 1 + (i % 28);
  if (/hour/.test(n)) return 8 + (i % 10);
  if (/priority|level|score|rating/.test(n)) return i % 4;
  if (/limit|max/.test(n)) return 100 + i * 10;
  return 1 + (i % 10);
}

const FUTURE = /(due|end|ends|expire|expires|expiry|until|valid_to|next|scheduled|deadline|renew|target|respond_by|resolve_by|remind|to_date|effective_to)/;
function genDate(field: any, i: number): Date {
  const n: string = field.name;
  const now = Date.now();
  const day = 86400000;
  if (/birth|dob/.test(n)) return new Date(Date.UTC(1985 + (i % 15), i % 12, 1 + (i % 27)));
  if (FUTURE.test(n)) return new Date(now + (1 + i * 3) * day + (i % 6) * 3600000);
  return new Date(now - ((1 + ((i * 4) % 60)) * day + (i % 9) * 3600000));
}

const PAIRS: [RegExp, string][] = [
  [/^start(s?)_/, 'end$1_'], [/_start(s?)$/, '_end$1'], [/^start(s?)$/, 'end$1'], [/^from_/, 'to_'], [/_from$/, '_to'], [/valid_from/, 'valid_until'],
  [/valid_from/, 'valid_to'], [/effective_from/, 'effective_to'], [/period_start/, 'period_end'],
];
function fixDatePairs(model: any, data: any) {
  for (const [re, rep] of PAIRS) {
    for (const k of Object.keys(data)) {
      if (!re.test(k) || !(data[k] instanceof Date)) continue;
      const other = k.replace(re, rep);
      if (other !== k && data[other] instanceof Date && data[other] < data[k]) [data[k], data[other]] = [data[other], data[k]];
    }
  }
}

const NULL_NAME = /deleted|archived|revoked|cancel|removed|suspended|deactivated|terminated|rejected|withdrawn|voided|erased|purged|disabled/;

function plainRefModel(fieldName: string): any | null {
  const tokens = fieldName.replace(/_ids?$/, '').split('_').filter(Boolean);
  for (let s = 0; s < tokens.length; s++) {
    const cand = pascal(tokens.slice(s).join('_'));
    if (modelByName.has(cand)) return modelByName.get(cand);
    const crm = 'Crm' + cand;
    if (modelByName.has(crm)) return modelByName.get(crm);
  }
  return null;
}

function pickRow(poolName: string, i: number, fieldName: string): any | undefined {
  const pool = pools.get(poolName);
  if (!pool?.length) return undefined;
  return pool[(i + (hashStr(fieldName) % pool.length)) % pool.length];
}

/** Builds one row, or returns a string naming the missing dependency pool (row cannot be built yet). */
function buildRow(model: any, i: number, overrides: Record<string, any> = {}): any | string {
  const data: any = {};
  const uniques = uniqueScalarNames(model);
  const fkScalar = new Set<string>();
  const defaultsOnly = DEFAULTS_ONLY.has(model.name);

  // 1. foreign keys (relation-backed)
  for (const rel of fkFields(model)) {
    rel.relationFromFields.forEach((n: string) => fkScalar.add(n));
    const scalars = rel.relationFromFields.map((n: string) => model.fields.find((f: any) => f.name === n));
    const required = scalars.every((f: any) => f.isRequired);
    const selfRef = rel.type === model.name;
    const row = selfRef ? undefined : pickRow(rel.type, i, rel.relationFromFields[0]);
    const forceNull = scalars.some((f: any) => NULL_NAME.test(f.name));
    if (!row || (!required && (forceNull || i % 4 === 3))) {
      if (required && !overrides[rel.relationFromFields[0]]) return selfRef ? `self:${rel.name}` : rel.type;
      continue;
    }
    rel.relationFromFields.forEach((n: string, k: number) => (data[n] = row[rel.relationToFields[k]]));
  }

  // 2. scalar / enum columns
  for (const f of model.fields) {
    if (f.kind === 'object' || fkScalar.has(f.name) || f.isUpdatedAt) continue;
    const n: string = f.name;
    if (n === 'organization_id') { data[n] = ORG; continue; }
    if (f.hasDefaultValue && f.kind !== 'enum') continue;
    if (f.hasDefaultValue && defaultsOnly) continue;
    if (f.isGenerated || f.isReadOnly) continue;
    if (!f.isRequired && !f.isList && !f.isId && (NULL_NAME.test(n) || (i + hashStr(n)) % 4 === 0)) continue;
    const unique = uniques.has(n) && !f.isId;

    if (f.isList) {
      if (f.kind === 'scalar' && f.type === 'String') data[n] = /tag|label|keyword/.test(n) ? ['demo', 'test'] : [];
      else if (!f.hasDefaultValue) data[n] = [];
      continue;
    }
    if (f.kind === 'enum') { data[n] = enumValue(model, f, i); continue; }
    switch (f.type) {
      case 'String': {
        if (/_id$/.test(n)) {
          const ref = plainRefModel(n);
          const row = ref && pickRow(ref.name, i, n);
          data[n] = row ? row.id : randomUUID();
        } else data[n] = genString(model, f, i, unique || f.isId);
        break;
      }
      case 'Int': data[n] = genInt(f, i); break;
      case 'BigInt': data[n] = BigInt(genInt(f, i)); break;
      case 'Float': data[n] = 1.5 * i + 1; break;
      case 'Decimal': data[n] = genDecimal(f, i); break;
      case 'Boolean': data[n] = NULL_NAME.test(n) ? false : i % 3 !== 2; break;
      case 'DateTime': data[n] = genDate(f, i); break;
      case 'Json': data[n] = /address/.test(n) ? { street: `${10 + i} Ermou Street`, city: pick(CITIES, i), country: 'GR' } : /s$|list|items|rules|steps|blocks|fields|tags/.test(n) ? [] : {}; break;
      case 'Bytes': data[n] = randomBytes(16); break;
      default: break;
    }
  }
  fixDatePairs(model, data);
  return { ...data, ...overrides };
}

// ---------------------------------------------------------------------------------------------- run
const report: { model: string; created: number; note?: string }[] = [];
const deferred: any[] = [];

async function seedModel(model: any, count: number, overrides?: (i: number) => Record<string, any>): Promise<number | string> {
  const delegate = prisma[lowerFirst(model.name)];
  let created = 0, fails = 0, lastErr = '';
  for (let i = 0; i < count && fails < 3; i++) {
    const row = buildRow(model, i, overrides?.(i));
    if (typeof row === 'string') return row;
    try {
      const rec = await delegate.create({ data: row });
      created++;
      fails = 0;
      const pool = pools.get(model.name) ?? [];
      if (pool.length < POOL_CAP) pool.push(rec);
      pools.set(model.name, pool);
    } catch (e: any) {
      fails++;
      lastErr = String(e.message ?? e).split('\n').filter((l) => l.trim()).slice(-6).join(' ').replace(/\s+/g, ' ').slice(-260);
      if (args.debug) console.log(model.name, JSON.stringify(row).slice(0, 900));
    }
  }
  if (created === 0 && lastErr) report.push({ model: model.name, created, note: `FAILED: ${lastErr}` });
  else report.push({ model: model.name, created, note: fails >= 3 ? `stopped early: ${lastErr}` : undefined });
  return created;
}

async function main() {
  const user = await prisma.user.findFirst({ where: { email: EMAIL } });
  if (!user) throw new Error(`User ${EMAIL} not found`);
  ORG = user.default_organization_id;
  if (!ORG) throw new Error('User has no default organization');
  console.log(`Seeding organization ${ORG} for ${EMAIL} (target ${TARGET}, salt ${SALT})`);

  // Load pools in dependency order so scoped tables can resolve their parents.
  for (const m of order) pools.set(m.name, await loadPool(m));

  // Extra demo members so assignee / owner pickers have more than one person.
  const members = pools.get('Membership')!;
  if (!ONLY && members.length < EXTRA_USERS + 1) {
    const userModel = modelByName.get('User');
    const membershipModel = modelByName.get('Membership');
    for (let i = 0; i < EXTRA_USERS; i++) {
      const email = `${pick(FIRST, i + 2).toLowerCase()}.${pick(LAST, i).toLowerCase()}.${SALT}@example.com`;
      const u = await prisma.user.create({
        data: { email, password: user.password, first_name: pick(FIRST, i + 2), last_name: pick(LAST, i), display_name: `${pick(FIRST, i + 2)} ${pick(LAST, i)}`, status: 'ACTIVE', default_organization_id: ORG },
      });
      pools.get('User')!.push(u);
      const mem = await prisma.membership.create({ data: { user_id: u.id, organization_id: ORG, type: 'INTERNAL', status: 'ACTIVE', job_title: pick(['Developer', 'Designer', 'Account manager', 'Support agent', 'Accountant'], i) } });
      members.push(mem);
    }
    console.log(`created ${EXTRA_USERS} demo users + memberships (they share ${EMAIL}'s password)`);
  }

  const todo = order.filter((m) => !SKIP.has(m.name) && (!ONLY || ONLY.has(m.name)));
  for (let pass = 0; pass < 4; pass++) {
    const next: any[] = [];
    let progress = false;
    for (const m of pass === 0 ? todo : deferred.splice(0)) {
      const scope = scopeOf.get(m.name);
      const existing = pools.get(m.name)?.length ?? 0;
      const want = BIG.has(m.name) ? BIG_TARGET : TARGET;
      if (m.name === 'User' || m.name === 'Membership') continue;
      if (scope === 'global' ? existing > 0 : existing >= want) continue;
      if (scope === 'global' && !ONLY) {
        const total: any[] = await prisma.$queryRawUnsafe(`select count(*)::int c from "${tableOf(m)}"`);
        if (total[0].c > 0) continue;
      }
      const res = await seedModel(m, want - existing);
      if (typeof res === 'string') next.push(m);
      else if (res > 0) progress = true;
    }
    deferred.push(...next);
    if (!next.length || (!progress && pass > 0)) break;
  }

  // Every proposal needs a current version, otherwise its detail page has nothing to show.
  const bare = await prisma.proposal.findMany({ where: { organization_id: ORG, current_version_id: null }, select: { id: true } });
  for (const pr of bare) {
    const existing = await prisma.proposalVersion.findFirst({ where: { proposal_id: pr.id }, orderBy: { version_number: 'desc' } });
    const v = existing ?? (await prisma.proposalVersion.create({ data: { proposal_id: pr.id, version_number: 1, status: 'DRAFT' } }));
    await prisma.proposal.update({ where: { id: pr.id }, data: { current_version_id: v.id } });
  }
  if (bare.length) console.log(`gave ${bare.length} proposals a current version`);

  const created = report.reduce((s, r) => s + r.created, 0);
  console.log(`\nDONE: ${created} rows across ${report.filter((r) => r.created > 0).length} tables`);
  const failed = report.filter((r) => r.note);
  console.log(`\n${failed.length} tables with problems:`);
  failed.forEach((r) => console.log(` - ${r.model} (+${r.created}): ${r.note}`));
  console.log(`\n${deferred.length} tables never seeded (missing parent rows): ${deferred.map((m) => m.name).join(', ')}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
