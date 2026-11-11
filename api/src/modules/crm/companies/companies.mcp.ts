import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { CrmCompaniesService } from './companies.service';
import { CreateCompanySchema, UpdateCompanySchema } from './dto/company.dto';
import { CompanyQuerySchema } from './dto/company-query.schema';

@Injectable()
export class CrmCompaniesMcp implements OnModuleInit {
    constructor(private readonly registry: McpRegistry, private readonly companies: CrmCompaniesService) { }

    onModuleInit() {
        const base = { module: ModuleKey.CRM, resource_type: 'crm_company' };
        this.registry.registerMany([
            {
                ...base, name: 'crm_companies_list', permission: 'crm.companies.read',
                description: 'List CRM companies (search by name/website/email; filter by type PROSPECT|CUSTOMER|PARTNER|VENDOR|OTHER, owner "me", lifecycle stage, team, branch, country).',
                input: CompanyQuerySchema,
                handler: (ctx, args) => this.companies.findAll(ctx, args),
            },
            {
                ...base, name: 'crm_companies_get', permission: 'crm.companies.read',
                description: 'Get one company with owner, lifecycle, tags and a Customer 360 summary (deal counts, values, last activity).',
                input: z.object({ id: z.string().uuid() }),
                handler: (ctx, args) => this.companies.findOne(ctx, args.id),
            },
            {
                ...base, name: 'crm_companies_create', permission: 'crm.companies.create',
                description: 'Create a company. Fails with possible_duplicates when the name or domain exists unless allow_duplicate is true.',
                input: CreateCompanySchema,
                handler: (ctx, args) => this.companies.create(ctx, args),
            },
            {
                ...base, name: 'crm_companies_update', permission: 'crm.companies.update',
                description: 'Update company fields by id (owner changes also need crm.companies.assign).',
                input: UpdateCompanySchema,
                handler: (ctx, { id, ...dto }) => this.companies.update(ctx, id, dto),
            },
            {
                ...base, name: 'crm_companies_assign', permission: 'crm.companies.assign',
                description: 'Change the owner of a company.',
                input: z.object({ id: z.string().uuid(), owner_membership_id: z.string().uuid() }),
                handler: (ctx, args) => this.companies.assign(ctx, args.id, args.owner_membership_id),
            },
            {
                ...base, name: 'crm_companies_archive', permission: 'crm.companies.archive', sensitive: true,
                description: 'Archive a company (hidden from lists and pickers; can be restored).',
                input: z.object({ id: z.string().uuid() }),
                handler: (ctx, args) => this.companies.archive(ctx, args.id),
            },
        ]);
    }
}
