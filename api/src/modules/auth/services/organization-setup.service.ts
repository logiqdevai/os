import { Injectable } from '@nestjs/common';
import { ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';

export const slugify = (value: string) =>
    value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'org';

/**
 * Creates a new tenant: Organization, headquarters Branch, every module enabled, the creator's ACTIVE membership
 * with the system Owner role (01 §8–15, §111). Must run inside a transaction.
 */
@Injectable()
export class OrganizationSetupService {
    constructor(private readonly prisma: PrismaService) { }

    async uniqueSlug(name: string, tx: Prisma.TransactionClient = this.prisma): Promise<string> {
        const base = slugify(name);
        let slug = base;
        for (let i = 2; await tx.organization.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
        return slug;
    }

    async createOrganization(tx: Prisma.TransactionClient, input: { name: string; owner_user_id: string; job_title?: string }) {
        const slug = await this.uniqueSlug(input.name, tx);
        const organization = await tx.organization.create({
            data: { legal_name: input.name, display_name: input.name, slug, status: 'ACTIVE' },
        });

        const branch = await tx.branch.create({
            data: { organization_id: organization.id, name: 'Headquarters', code: 'HQ', is_headquarters: true },
        });

        await tx.organizationModule.createMany({
            data: Object.values(ModuleKey).map((module) => ({ organization_id: organization.id, module, enabled: true, enabled_at: new Date() })),
        });

        const membership = await tx.membership.create({
            data: {
                user_id: input.owner_user_id,
                organization_id: organization.id,
                status: 'ACTIVE',
                default_branch_id: branch.id,
                job_title: input.job_title ?? 'Owner',
                branches: { create: { branch_id: branch.id, is_primary: true } },
            },
        });

        const owner = await tx.role.findFirst({ where: { organization_id: null, slug: 'owner' }, select: { id: true } });
        if (owner) {
            await tx.roleAssignment.create({
                data: { membership_id: membership.id, role_id: owner.id, scope_type: 'ORGANIZATION', granted_by_user_id: input.owner_user_id, reason: 'Organization creator' },
            });
        }

        return { organization, membership, branch };
    }
}
