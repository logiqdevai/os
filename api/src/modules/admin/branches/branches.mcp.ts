import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { BranchesService } from './branches.service';
import { BranchQuerySchema, CreateBranchSchema } from './dto/branch.dto';

@Injectable()
export class BranchesMcp implements OnModuleInit {
    constructor(private readonly registry: McpRegistry, private readonly branches: BranchesService) { }

    onModuleInit() {
        const base = { module: ModuleKey.ADMINISTRATION, resource_type: 'branch' };
        this.registry.registerMany([
            { ...base, name: 'organizations_branches_list', description: 'List branches of the organization (search by name, code or city).', permission: 'organizations.branches.read', input: BranchQuerySchema, handler: (ctx, a) => this.branches.findAll(ctx, a) },
            { ...base, name: 'organizations_branches_get', description: 'Get one branch with children, managers, members and teams.', permission: 'organizations.branches.read', input: z.object({ id: z.string().uuid() }), handler: (ctx, a) => this.branches.findOne(ctx, a.id) },
            { ...base, name: 'organizations_branches_create', description: 'Create a branch.', permission: 'organizations.branches.manage', sensitive: true, input: CreateBranchSchema, handler: (ctx, a) => this.branches.create(ctx, a) },
        ]);
    }
}
