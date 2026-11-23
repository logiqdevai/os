/**
 * Adds ONE sample form that uses every question type (non-destructive: nothing is wiped, re-running replaces only this form).
 *
 *   npx dotenv run -f .env.staging -- npx tsx prisma/seed/docs-sample-form.ts --email=anna.zoi@yahoo.com
 *
 * Development stage only (AGENTS.md): handy for checking the form builder, the fill page and the responses table.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? 'true']));
const EMAIL = args.email ?? 'anna.zoi@yahoo.com';
const prisma: any = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }) });

const SLUG = 'all-question-types';
const FIELDS = [
  { key: 'about_you', type: 'SECTION', label: 'About you', description: 'A section heading: no answer is collected here.', required: false },
  { key: 'full_name', type: 'SHORT_TEXT', label: 'Full name', required: true },
  { key: 'email', type: 'EMAIL', label: 'Work email', description: 'Must be a valid email address.', required: true },
  { key: 'bio', type: 'LONG_TEXT', label: 'Tell us about your role', required: false },
  { key: 'age', type: 'NUMBER', label: 'Age', required: false },
  { key: 'start_date', type: 'DATE', label: 'Start date', required: false },
  { key: 'feedback', type: 'SECTION', label: 'Your feedback', required: false },
  {
    key: 'department', type: 'SINGLE_CHOICE', label: 'Department', required: true,
    options: [{ value: 'option_1', label: 'Engineering' }, { value: 'option_2', label: 'Sales' }, { value: 'option_3', label: 'Support' }, { value: 'option_4', label: 'Operations' }],
  },
  {
    key: 'tools', type: 'MULTI_CHOICE', label: 'Which tools do you use weekly?', required: false,
    options: [{ value: 'option_1', label: 'Tasks' }, { value: 'option_2', label: 'Docs' }, { value: 'option_3', label: 'CRM' }, { value: 'option_4', label: 'Calendar' }],
  },
  { key: 'satisfaction', type: 'SCALE', label: 'How satisfied are you?', required: true, scale: { min: 1, max: 5, min_label: 'Not at all', max_label: 'Very' } },
  { key: 'agree_terms', type: 'CHECKBOX', label: 'I agree to be contacted about this feedback', required: true },
];

async function main() {
  const user = await prisma.user.findFirst({ where: { email: EMAIL } });
  if (!user?.default_organization_id) throw new Error(`User ${EMAIL} or their organization not found`);
  const org: string = user.default_organization_id;
  const me = await prisma.membership.findFirst({ where: { organization_id: org, user_id: user.id, status: 'ACTIVE' } });

  await prisma.customForm.deleteMany({ where: { organization_id: org, slug: SLUG } });
  const form = await prisma.customForm.create({
    data: {
      organization_id: org,
      name: 'All question types',
      slug: SLUG,
      description: 'Sample form with every question type, to check the builder, the fill page and the responses table.',
      kind: 'CUSTOM',
      status: 'PUBLISHED',
      fields_schema: FIELDS,
      allow_multiple_submissions: true,
      confirmation_message: 'Thanks, we got it.',
      current_version_number: 1,
      owner_membership_id: me?.id ?? null,
      published_at: new Date(),
      created_by_user_id: user.id,
      versions: { create: { version_number: 1, fields_schema: FIELDS, change_summary: 'Seeded sample', created_by_user_id: user.id } },
    },
  });
  console.log(`Created form ${form.id}\n  http://localhost:5173/docs/forms/${form.id}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
