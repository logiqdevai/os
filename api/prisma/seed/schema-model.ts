/**
 * Minimal schema.prisma reader used by the demo seed. Prisma 7's runtime `Prisma.dmmf` omits isRequired /
 * hasDefaultValue / relation fields, so the seed reads the schema text itself and exposes a DMMF-like shape.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const SCALARS = new Set(['String', 'Int', 'BigInt', 'Float', 'Decimal', 'Boolean', 'DateTime', 'Json', 'Bytes']);

export interface SchemaField {
  name: string;
  dbName?: string;
  kind: 'scalar' | 'enum' | 'object' | 'unsupported';
  type: string;
  isList: boolean;
  isRequired: boolean;
  isId: boolean;
  isUnique: boolean;
  hasDefaultValue: boolean;
  isUpdatedAt: boolean;
  relationFromFields: string[];
  relationToFields: string[];
  nativeType?: [string, string[]];
}
export interface SchemaModel {
  name: string;
  dbName?: string;
  fields: SchemaField[];
  uniqueFields: string[][];
}

const list = (s: string | undefined) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);

export function readSchema(path = join(process.cwd(), 'prisma', 'schema.prisma')) {
  const text = readFileSync(path, 'utf8');
  const enums = new Map<string, string[]>();
  const rawModels: { name: string; lines: string[] }[] = [];
  const blockRe = /^(model|enum)\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  for (let m: RegExpExecArray | null; (m = blockRe.exec(text)); ) {
    const lines = m[3].split('\n').map((l) => l.replace(/\s\/\/.*$/, '').replace(/^\s*\/\/.*$/, '').trim()).filter(Boolean);
    if (m[1] === 'enum') enums.set(m[2], lines.map((l) => l.split(/\s+/)[0]));
    else rawModels.push({ name: m[2], lines });
  }
  const modelNames = new Set(rawModels.map((m) => m.name));

  const models: SchemaModel[] = rawModels.map(({ name, lines }) => {
    const model: SchemaModel = { name, fields: [], uniqueFields: [] };
    const idGroups: string[][] = [];
    for (const line of lines) {
      if (line.startsWith('@@')) {
        const map = line.match(/^@@map\("([^"]+)"\)/);
        if (map) model.dbName = map[1];
        const uq = line.match(/^@@unique\(\[([^\]]*)\]/);
        if (uq) model.uniqueFields.push(list(uq[1]));
        const id = line.match(/^@@id\(\[([^\]]*)\]/);
        if (id) idGroups.push(list(id[1]));
        continue;
      }
      const fm = line.match(/^(\w+)\s+(Unsupported\("[^"]*"\)|\w+)(\[\]|\?)?\s*(.*)$/);
      if (!fm) continue;
      const [, fname, rawType, mod, attrs] = fm;
      const type = rawType.startsWith('Unsupported') ? 'Unsupported' : rawType;
      const kind: SchemaField['kind'] = type === 'Unsupported' ? 'unsupported' : enums.has(type) ? 'enum' : modelNames.has(type) ? 'object' : SCALARS.has(type) ? 'scalar' : 'scalar';
      const rel = attrs.match(/@relation\(([^)]*)\)/);
      const relFields = rel?.[1].match(/fields:\s*\[([^\]]*)\]/);
      const relRefs = rel?.[1].match(/references:\s*\[([^\]]*)\]/);
      const nt = attrs.match(/@db\.(\w+)(?:\(([^)]*)\))?/);
      const map = attrs.match(/@map\("([^"]+)"\)/);
      model.fields.push({
        name: fname,
        dbName: map?.[1],
        kind,
        type,
        isList: mod === '[]',
        isRequired: mod !== '?' && mod !== '[]',
        isId: /@id\b/.test(attrs),
        isUnique: /@unique\b/.test(attrs),
        hasDefaultValue: /@default\(/.test(attrs),
        isUpdatedAt: /@updatedAt\b/.test(attrs),
        relationFromFields: list(relFields?.[1]),
        relationToFields: list(relRefs?.[1]),
        nativeType: nt ? [nt[1], list(nt[2])] : undefined,
      });
    }
    idGroups.forEach((g) => g.forEach((n) => { const f = model.fields.find((x) => x.name === n); if (f) f.isId = true; }));
    return model;
  });
  return { models, enums };
}
