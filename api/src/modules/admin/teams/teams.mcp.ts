import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { TeamsService } from './teams.service';
import { CreateTeamSchema } from './dto/create-team.dto';
import { TeamQuerySchema } from './dto/team-query.schema';

/** REFERENCE MCP ADAPTER — one tool per agent-useful permission, same service methods as REST. */
@Injectable()
export class TeamsMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly teams: TeamsService,
    ) { }

    onModuleInit() {
        this.registry.registerMany([
            {
                name: 'organizations_teams_list',
                description: 'List teams of the organization (search by name, filter by kind or branch).',
                permission: 'organizations.teams.read',
                module: ModuleKey.ADMINISTRATION,
                resource_type: 'team',
                input: TeamQuerySchema,
                handler: (ctx, args) => this.teams.findAll(ctx, args),
            },
            {
                name: 'organizations_teams_get',
                description: 'Get one team with its members.',
                permission: 'organizations.teams.read',
                module: ModuleKey.ADMINISTRATION,
                resource_type: 'team',
                input: z.object({ id: z.string().uuid() }),
                handler: (ctx, args) => this.teams.findOne(ctx, args.id),
            },
            {
                name: 'organizations_teams_create',
                description: 'Create a team.',
                permission: 'organizations.teams.manage',
                module: ModuleKey.ADMINISTRATION,
                resource_type: 'team',
                input: CreateTeamSchema,
                handler: (ctx, args) => this.teams.create(ctx, args),
            },
            {
                name: 'organizations_teams_archive',
                description: 'Archive a team.',
                permission: 'organizations.teams.manage',
                module: ModuleKey.ADMINISTRATION,
                resource_type: 'team',
                sensitive: true,
                input: z.object({ id: z.string().uuid() }),
                handler: (ctx, args) => this.teams.archive(ctx, args.id),
            },
        ]);
    }
}
