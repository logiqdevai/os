import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { SessionsService } from './sessions.service';
import { RevokeAllSessionsSchema, RevokeSessionSchema, SessionQuerySchema } from './dto/session.dto';

@Injectable()
export class SessionsMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly sessions: SessionsService,
    ) { }

    onModuleInit() {
        this.registry.registerMany([
            {
                name: 'users_sessions_list',
                description: 'List active sign-in sessions of organization members (device, browser, IP, last activity). Filter by member_id.',
                permission: 'users.sessions.read',
                module: ModuleKey.ADMINISTRATION,
                resource_type: 'user_session',
                input: SessionQuerySchema,
                handler: (ctx, args) => this.sessions.findAll(ctx, args),
            },
            {
                name: 'users_sessions_revoke',
                description: 'Revoke one session; the device is signed out immediately.',
                permission: 'users.sessions.revoke',
                module: ModuleKey.ADMINISTRATION,
                resource_type: 'user_session',
                sensitive: true,
                input: RevokeSessionSchema,
                handler: (ctx, args) => this.sessions.revoke(ctx, args.id, args.reason),
            },
            {
                name: 'users_sessions_revoke_all',
                description: 'Revoke all sessions of one member (member_id), or of every member in scope.',
                permission: 'users.sessions.revoke',
                module: ModuleKey.ADMINISTRATION,
                resource_type: 'user_session',
                sensitive: true,
                input: RevokeAllSessionsSchema,
                handler: (ctx, args) => this.sessions.revokeAll(ctx, args),
            },
        ]);
    }
}
