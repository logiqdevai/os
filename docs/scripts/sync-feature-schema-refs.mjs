#!/usr/bin/env node
// Syncs a "Data model" section into every docs/features/NN-*.md file, listing the Prisma
// models/tables and enums the module owns, the tables it reuses from other modules, and the
// tables that reference it. Re-run after every schema change:
//
//   node docs/scripts/sync-feature-schema-refs.mjs
//
// Ownership is read from the section banners in api/prisma/schema.prisma
// (`// ====` blocks naming a module number). The generated block lives between
// <!-- schema-refs:start --> and <!-- schema-refs:end --> and is replaced on each run.
//
// It also injects a one-line "Schema:" pointer under every spec section heading (`## 3. Title` or
// `## Title`) that a model, enum or column references in its `///` doc comment (`06 §3`, `09 "Expense
// Management"`), between <!-- schema-section:start --> and <!-- schema-section:end -->.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const schemaPath = join(root, 'api', 'prisma', 'schema.prisma');
const featuresDir = join(root, 'docs', 'features');
const START = '<!-- schema-refs:start -->';
const END = '<!-- schema-refs:end -->';

const lines = readFileSync(schemaPath, 'utf8').split(/\r?\n/);

// ---------------------------------------------------------------------------
// 1. Parse banners → owning module, plus models and enums.
// ---------------------------------------------------------------------------

/** Banner text → owner. "platform" sections are attributed to the module that defines them. */
function ownerFromBanner(text) {
  if (/^Legacy — owned by docs\/features\/17/.test(text)) return { module: '17', note: 'legacy (pre-module 17)' };
  if (/^Platform shared concepts defined by 02/.test(text)) return { module: '02', note: 'platform shared' };
  if (/^Platform shared concept — document numbering/.test(text)) return { module: '03', note: 'platform shared' };
  const m = text.match(/^(\d{2}) /) || text.match(/— (\d{2})\b/);
  return m ? { module: m[1], note: null } : null;
}

const entities = new Map(); // name → { kind, module, note, table, line, doc, fields: [{name,type,comment}] }
let owner = null;
let subsection = null;
let pendingDoc = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/^\/\/ =+$/.test(line) && i + 1 < lines.length && /^\/\/ \S/.test(lines[i + 1])) {
    const o = ownerFromBanner(lines[i + 1].slice(3).trim());
    if (o) {
      owner = o;
      subsection = null;
    }
    continue;
  }
  const sub = line.match(/^\/\/ --- (.+?) -+$/);
  if (sub) {
    subsection = sub[1].trim();
    continue;
  }
  if (line.startsWith('///')) {
    pendingDoc.push(line.slice(3).trim());
    continue;
  }
  const decl = line.match(/^(model|enum) (\w+) \{/);
  if (decl && owner) {
    const [, kind, name] = decl;
    const ent = {
      kind,
      name,
      module: owner.module,
      note: owner.note,
      subsection,
      line: i + 1,
      doc: pendingDoc.join(' '),
      table: null,
      fields: [],
    };
    let fieldDoc = [];
    for (i = i + 1; i < lines.length && !/^\}/.test(lines[i]); i++) {
      const l = lines[i].trim();
      if (l.startsWith('///')) {
        fieldDoc.push(l.slice(3).trim());
        continue;
      }
      const map = l.match(/^@@map\("([^"]+)"\)/);
      if (map) ent.table = map[1];
      const f = l.match(/^(\w+)\s+(\w+)(\[\])?\??/);
      if (kind === 'model' && f && !l.startsWith('@@')) {
        const inline = l.includes('//') ? l.slice(l.indexOf('//') + 2).replace(/^\/?\s*/, '') : '';
        ent.fields.push({ name: f[1], type: f[2], list: !!f[3], comment: [...fieldDoc, inline].join(' ').trim() });
      }
      fieldDoc = [];
    }
    entities.set(name, ent);
  }
  pendingDoc = [];
}

const models = [...entities.values()].filter((e) => e.kind === 'model');
const enums = [...entities.values()].filter((e) => e.kind === 'enum');

// ---------------------------------------------------------------------------
// 2. Cross-module relations (Prisma relation fields only, not list back-relations).
// ---------------------------------------------------------------------------

/** For module X: { uses: Map<model, Set<viaModel.field>>, usedBy: Map<model, Set<model>> } */
const uses = new Map();
const usedBy = new Map();
const enumUses = new Map();
const bucket = (map, key) => (map.has(key) ? map.get(key) : map.set(key, new Map()).get(key));

for (const m of models) {
  for (const f of m.fields) {
    const target = entities.get(f.type);
    if (!target || target.module === m.module) continue;
    if (target.kind === 'enum') {
      const b = bucket(enumUses, m.module);
      (b.get(target.name) ?? b.set(target.name, new Set()).get(target.name)).add(`${m.name}.${f.name}`);
      continue;
    }
    if (f.list) continue; // back-relation; the owning side records it
    const u = bucket(uses, m.module);
    (u.get(target.name) ?? u.set(target.name, new Set()).get(target.name)).add(`${m.name}.${f.name}`);
    const ub = bucket(usedBy, target.module);
    (ub.get(m.name) ?? ub.set(m.name, new Set()).get(m.name)).add(target.name);
  }
}

// Plain-string references to modules without tables yet, found in schema comments,
// e.g. `document_id String /// 17 — …`.
function commentRefs(mod) {
  const n = Number(mod);
  const re = new RegExp(`(^|[^\\d§.])(${mod}|${n}) ?§|\\((${mod}|${n})\\)|docs/features/${mod}-|\\b${mod} [A-Z][a-z]`);
  const hits = [];
  for (const m of models) {
    if (m.module === mod) continue;
    for (const f of m.fields) if (f.comment && re.test(f.comment)) hits.push({ model: m, field: f });
  }
  return hits;
}


// ---------------------------------------------------------------------------
// 2b. Spec-section references: "NN §K" / "NN §K–M" / "NN §K, §L" / NN "Heading title" in doc comments.
// ---------------------------------------------------------------------------

/** text → [{ module, key }] where key is a section number string or a lowercased heading title. */
function parseSectionRefs(text) {
  const out = [];
  if (!text) return out;
  const numbered = /(?:^|[^\d])(\d{2}) ((?:§\s?\d+(?:\s?[–-]\s?\d+)?)(?:\s?,\s?§\s?\d+(?:\s?[–-]\s?\d+)?)*)/g;
  let m;
  while ((m = numbered.exec(text))) {
    const mod = m[1];
    for (const part of m[2].split(',')) {
      const r = part.match(/§\s?(\d+)(?:\s?[–-]\s?(\d+))?/);
      if (!r) continue;
      const a = Number(r[1]);
      const b = r[2] ? Number(r[2]) : a;
      if (b < a || b - a > 40) { out.push({ module: mod, key: String(a) }); continue; }
      for (let k = a; k <= b; k++) out.push({ module: mod, key: String(k) });
    }
  }
  // NN "Title" or NN "Title A", "Title B", … (unnumbered specs: 03, 08, 09, 10, 11).
  const quoted = /(?:^|[^\d])(\d{2}) ("[^"]+"(?:\s?,\s?"[^"]+")*)/g;
  while ((m = quoted.exec(text))) {
    for (const t of m[2].match(/"([^"]+)"/g)) out.push({ module: m[1], key: normalizeTitle(t.slice(1, -1)) });
  }
  return out;
}
const normalizeTitle = (t) => t.toLowerCase().replace(/[^a-z0-9 &/-]+/g, '').replace(/\s+/g, ' ').trim();

/** `${module}|${key}` → { models: Map<name, Set<field>>, enums: Set<name> } (entities of any module). */
const sectionIndex = new Map();
function sectionBucket(ref) {
  const k = `${ref.module}|${ref.key}`;
  if (!sectionIndex.has(k)) sectionIndex.set(k, { models: new Map(), enums: new Set() });
  return sectionIndex.get(k);
}
for (const e of entities.values()) {
  for (const ref of parseSectionRefs(e.doc)) {
    const b = sectionBucket(ref);
    if (e.kind === 'enum') b.enums.add(e.name);
    else if (!b.models.has(e.name)) b.models.set(e.name, new Set());
  }
  if (e.kind !== 'model') continue;
  for (const f of e.fields) {
    if (entities.has(f.type)) continue; // relation fields: the FK column carries the comment
    for (const ref of parseSectionRefs(f.comment)) {
      const b = sectionBucket(ref);
      (b.models.get(e.name) ?? b.models.set(e.name, new Set()).get(e.name)).add(f.name);
    }
  }
}

const SEC_START = '<!-- schema-section:start -->';
const SEC_END = '<!-- schema-section:end -->';

/** One-line pointer for a spec section, or null when nothing references it. */
function renderSection(mod, key, link) {
  const b = sectionIndex.get(`${mod}|${key}`);
  if (!b) return null;
  const own = [];
  const foreign = [];
  const fmt = (name, fields) => {
    const e = entities.get(name);
    const base = `\`${name}\` ([${e.table ?? 'enum'}](${link}#L${e.line}))`;
    const cols = [...fields].sort().map((f) => `\`${f}\``).join(', ');
    return cols ? `${base}: ${cols}` : base;
  };
  for (const [name, fields] of [...b.models].sort()) {
    const e = entities.get(name);
    (e.module === mod ? own : foreign).push(e.module === mod ? fmt(name, fields) : `${fmt(name, fields)} (${modLink(e.module)})`);
  }
  for (const name of [...b.enums].sort()) {
    const e = entities.get(name);
    const t = `enum \`${name}\` ([L${e.line}](${link}#L${e.line}))`;
    (e.module === mod ? own : foreign).push(e.module === mod ? t : `${t} (${modLink(e.module)})`);
  }
  if (!own.length && !foreign.length) return null;
  const parts = [];
  if (own.length) parts.push(own.join(' · '));
  if (foreign.length) parts.push(`other modules: ${foreign.join(' · ')}`);
  return `> **Schema:** ${parts.join(' — ')}`;
}

/** Heading line → section key, or null for headings that are not spec sections. */
function headingKey(line) {
  const h = line.match(/^(#{1,3}) (.+?)\s*#*\s*$/);
  if (!h) return null;
  const title = h[2].trim();
  if (/^Data model \(Prisma\)/.test(title)) return null;
  const n = title.match(/^(\d+)\.\s/);
  if (n) return n[1];
  if (h[1] === '##') return normalizeTitle(title);
  return null;
}

/** Insert / refresh / remove the per-section pointer blocks of one spec file. */
function syncSections(text, mod, link, eol) {
  const src = text.split(eol);
  const out = [];
  let inFence = false;
  let inTop = false;
  for (let i = 0; i < src.length; i++) {
    const line = src[i];
    if (line.startsWith('```')) inFence = !inFence;
    if (line === START) inTop = true;
    if (line === END) inTop = false;
    out.push(line);
    if (inFence || inTop) continue;
    const key = headingKey(line);
    if (key === null) continue;
    // Drop an existing generated block right after the heading (allowing one blank line).
    let j = i + 1;
    while (j < src.length && src[j].trim() === '') j++;
    if (src[j] === SEC_START) {
      let k = j;
      while (k < src.length && src[k] !== SEC_END) k++;
      i = k; // skip old block (its trailing blank line is re-added below)
      while (i + 1 < src.length && src[i + 1].trim() === '') i++;
      out.push('');
    }
    const block =
      renderSection(mod, key, link) ??
      '> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.';
    if (out[out.length - 1] !== '') out.push('');
    out.push(SEC_START, block, SEC_END);
    // Keep exactly one blank line between the block and the following content.
    if (i + 1 < src.length && src[i + 1].trim() !== '') out.push('');
  }
  return out.join(eol);
}

// ---------------------------------------------------------------------------
// 3. Render.
// ---------------------------------------------------------------------------

const featureFiles = readdirSync(featuresDir).filter((f) => /^\d{2}-.*\.md$/.test(f));
const fileForModule = Object.fromEntries(featureFiles.map((f) => [f.slice(0, 2), f]));
const schemaLink = (docFile) => relative(dirname(docFile), schemaPath).replace(/\\/g, '/');
const shortDoc = (d) => {
  const s = d.replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
  return s.length > 160 ? `${s.slice(0, 157)}…` : s;
};
/** Shared tables other modules attach to (mostly polymorphically) instead of creating their own. */
const PLATFORM = [
  ['AuditEvent', '01', 'activity & change history'],
  ['CustomFieldDefinition', '02', 'custom fields'],
  ['Tagging', '02', 'tags'],
  ['SavedView', '02', 'saved views'],
  ['CrmNote', '02', 'notes, polymorphic by entity type'],
  ['NumberSequence', '03', 'document numbering'],
  ['SignatureRequest', '04', 'e-signatures'],
  ['ProviderWebhookEvent', '08', 'idempotent provider webhooks'],
];
const modLink = (mod) => (fileForModule[mod] ? `[${mod}](./${fileForModule[mod]})` : mod);

function render(mod, docFile) {
  const link = schemaLink(docFile);
  const owned = models.filter((m) => m.module === mod);
  const ownedEnums = enums.filter((e) => e.module === mod);
  const out = [START, '', '## Data model (Prisma)', ''];
  out.push(
    `> Generated from [\`api/prisma/schema.prisma\`](${link}) by \`node docs/scripts/sync-feature-schema-refs.mjs\` — do not edit by hand.`,
    '> Before implementing API or app code for this module, read these models in the schema and reuse the existing',
    '> tables, enums and services of the modules listed under "Reuses". Never redefine a table owned by another module.',
    '',
  );
  const platform = PLATFORM.filter(([name, owner]) => owner !== mod && entities.has(name)).map(
    ([name, owner, what]) => `\`${entities.get(name).table}\` (${what}, ${modLink(owner)})`,
  );
  out.push(`**Platform tables to reuse, not rebuild:** ${platform.join(' · ')}`, '');

  if (owned.length === 0 && ownedEnums.length === 0) {
    out.push('**Owned tables:** none yet — this module is not modelled in the schema. Add its tables in a new banner section', `\`// NN Module name — docs/features/${docFile.split(/[\\/]/).pop()}\` and re-run the script.`, '');
  } else {
    out.push(`### Owned tables (${owned.length})`, '', '| Model | Table | Schema line | Purpose |', '| -- | -- | -- | -- |');
    let lastSub;
    for (const m of owned) {
      const group = m.note ?? m.subsection;
      if (group && group !== lastSub) out.push(`| **${group}** | | | |`);
      lastSub = group;
      out.push(`| \`${m.name}\` | \`${m.table ?? '—'}\` | [L${m.line}](${link}#L${m.line}) | ${shortDoc(m.doc)} |`);
    }
    out.push('');
    if (ownedEnums.length) {
      out.push(`**Owned enums (${ownedEnums.length}):** ${ownedEnums.map((e) => `\`${e.name}\``).join(', ')}`, '');
    }
  }

  const u = uses.get(mod);
  if (u?.size) {
    const byModule = new Map();
    for (const [target, via] of u) {
      const tm = entities.get(target).module;
      (byModule.get(tm) ?? byModule.set(tm, []).get(tm)).push([target, via]);
    }
    out.push('### Reuses from other modules (foreign keys)', '', '| Module | Model (table) | Referenced by |', '| -- | -- | -- |');
    for (const [tm, list] of [...byModule].sort()) {
      for (const [target, via] of list.sort()) {
        const t = entities.get(target);
        const v = [...via].sort();
        const viaText = v.length > 4 ? `${v.slice(0, 4).map((x) => `\`${x}\``).join(', ')} +${v.length - 4} more` : v.map((x) => `\`${x}\``).join(', ');
        out.push(`| ${modLink(tm)} | \`${target}\` (\`${t.table}\`) | ${viaText} |`);
      }
    }
    out.push('');
  }

  const eu = enumUses.get(mod);
  if (eu?.size) {
    out.push(`**Reused enums:** ${[...eu.keys()].sort().map((e) => `\`${e}\` (${modLink(entities.get(e).module)})`).join(', ')}`, '');
  }

  const ub = usedBy.get(mod);
  if (ub?.size) {
    const byModule = new Map();
    for (const [src, targets] of ub) {
      const sm = entities.get(src).module;
      (byModule.get(sm) ?? byModule.set(sm, new Set()).get(sm)).add(src);
    }
    out.push('### Referenced by other modules', '');
    for (const [sm, srcs] of [...byModule].sort()) {
      out.push(`- ${modLink(sm)}: ${[...srcs].sort().map((s) => `\`${s}\``).join(', ')}`);
    }
    out.push('');
  }

  const hits = commentRefs(mod);
  if (hits.length) {
    out.push(
      '### Plain-id references from other modules',
      '',
      owned.length > 0
        ? 'Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.'
        : 'Plain-string ids (no Prisma relation) that other modules already store for records this module will own. Turn them into relations when this module is modelled.',
      '',
    );
    for (const { model, field } of hits) {
      out.push(`- \`${model.name}.${field.name}\` (${modLink(model.module)}, [L${model.line}](${link}#L${model.line})) — ${shortDoc(field.comment)}`);
    }
    out.push('');
  }

  out.push(END);
  return out.join('\n');
}

let changed = 0;
for (const file of featureFiles) {
  const mod = file.slice(0, 2);
  const path = join(featuresDir, file);
  const src = readFileSync(path, 'utf8');
  if (/^> Linear: .*Status: Canceled/m.test(src)) continue; // e.g. 16 parking lot
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const block = render(mod, path).replace(/\n/g, eol);
  let next;
  if (src.includes(START)) {
    next = src.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
  } else {
    // Insert after the header blockquotes, before the first "## " heading.
    const idx = src.search(/^## /m);
    next = idx === -1 ? `${src}${eol}${block}${eol}` : `${src.slice(0, idx)}${block}${eol}${eol}${src.slice(idx)}`;
  }
  next = syncSections(next, mod, schemaLink(path), eol);
  if (next !== src) {
    writeFileSync(path, next);
    changed++;
  }
}
console.log(`schema: ${models.length} models, ${enums.length} enums · updated ${changed} feature docs`);
