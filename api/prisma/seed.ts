/**
 * Seed — docs/features/01-users-organizations-permissions.md
 *
 * Idempotent. Upserts the global permission catalog (§46) and the platform role templates
 * (§111, §79) that organizations clone. Run with:
 *   npx dotenv run -f .env.staging -- npx prisma db seed
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma';
import { PERMISSION_CATALOG, ROLE_TEMPLATES, resolvePermissionKeys } from './seed/permission-catalog';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

async function seedPermissions() {
  for (const p of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: {
        module: p.module,
        resource: p.resource,
        action: p.action,
        description: p.description,
        is_sensitive: p.is_sensitive ?? false,
        is_field_level: p.is_field_level ?? false,
      },
      create: {
        key: p.key,
        module: p.module,
        resource: p.resource,
        action: p.action,
        description: p.description,
        is_sensitive: p.is_sensitive ?? false,
        is_field_level: p.is_field_level ?? false,
      },
    });
  }
  console.log(`permissions: ${PERMISSION_CATALOG.length} upserted`);
}

async function seedRoleTemplates() {
  const permissions = await prisma.permission.findMany({ select: { id: true, key: true } });
  const idByKey = new Map(permissions.map((p) => [p.key, p.id]));

  for (const template of ROLE_TEMPLATES) {
    // organization_id null = platform template (01 §111). Postgres treats NULL as distinct in
    // unique indexes, so look the template up explicitly instead of relying on upsert.
    const data = {
      name: template.name,
      description: template.description,
      type: template.type,
      default_scope: template.default_scope,
      modules: template.modules,
      is_system: true,
    };
    const existing = await prisma.role.findFirst({ where: { organization_id: null, slug: template.slug } });
    const role = existing
      ? await prisma.role.update({ where: { id: existing.id }, data })
      : await prisma.role.create({ data: { ...data, organization_id: null, slug: template.slug } });

    const keys = resolvePermissionKeys(template.permissions, PERMISSION_CATALOG);
    const missing = keys.filter((k) => !idByKey.has(k));
    if (missing.length) throw new Error(`Role template "${template.slug}" references unknown permissions: ${missing.join(', ')}`);

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { role_id: role.id } }),
      prisma.rolePermission.createMany({
        data: keys.map((key) => ({ role_id: role.id, permission_id: idByKey.get(key) as string })),
        skipDuplicates: true,
      }),
    ]);
  }
  console.log(`role templates: ${ROLE_TEMPLATES.length} upserted`);
}

async function main() {
  await seedPermissions();
  await seedRoleTemplates();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
