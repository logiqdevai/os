import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { CrmContactsService } from './contacts.service';
import { ContactQuerySchema, CreateContactSchema, UpdateContactSchema } from './dto/contact.dto';

@Injectable()
export class CrmContactsMcp implements OnModuleInit {
    constructor(private readonly registry: McpRegistry, private readonly contacts: CrmContactsService) { }

    onModuleInit() {
        const base = { module: ModuleKey.CRM, resource_type: 'crm_contact' };
        this.registry.registerMany([
            {
                ...base, name: 'crm_contacts_list', permission: 'crm.contacts.read',
                description: 'List CRM contacts (search by name/email/company; filter by company_id, role, owner "me").',
                input: ContactQuerySchema,
                handler: (ctx, args) => this.contacts.findAll(ctx, args),
            },
            {
                ...base, name: 'crm_contacts_get', permission: 'crm.contacts.read',
                description: 'Get one contact with company, owner and tags.',
                input: z.object({ id: z.string().uuid() }),
                handler: (ctx, args) => this.contacts.findOne(ctx, args.id),
            },
            {
                ...base, name: 'crm_contacts_create', permission: 'crm.contacts.create',
                description: 'Create a contact. Fails with possible_duplicates when the email exists unless allow_duplicate is true.',
                input: CreateContactSchema,
                handler: (ctx, args) => this.contacts.create(ctx, args),
            },
            {
                ...base, name: 'crm_contacts_update', permission: 'crm.contacts.update',
                description: 'Update contact fields by id.',
                input: UpdateContactSchema,
                handler: (ctx, { id, ...dto }) => this.contacts.update(ctx, id, dto),
            },
        ]);
    }
}
