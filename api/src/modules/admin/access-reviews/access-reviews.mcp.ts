import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { AccessReviewsService } from './access-reviews.service';
import { AccessReviewItemQuerySchema, AccessReviewQuerySchema, CreateAccessReviewSchema, DecideItemSchema } from './dto/access-review.dto';

@Injectable()
export class AccessReviewsMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly reviews: AccessReviewsService,
    ) { }

    onModuleInit() {
        const base = { module: ModuleKey.ADMINISTRATION, resource_type: 'access_review' } as const;
        const id = z.object({ id: z.string().uuid() });
        this.registry.registerMany([
            { ...base, name: 'organizations_access_reviews_list', description: 'List access reviews with progress (decided / pending / pending apply).', permission: 'organizations.access_reviews.read', input: AccessReviewQuerySchema, handler: (ctx, args) => this.reviews.findAll(ctx, args) },
            { ...base, name: 'organizations_access_reviews_get', description: 'Get one access review with stats and reviewer progress.', permission: 'organizations.access_reviews.read', input: id, handler: (ctx, args) => this.reviews.get(ctx, args.id) },
            {
                ...base,
                name: 'organizations_access_review_items_list',
                description: 'List the members in an access review with their access snapshot and decision. Reviewers see only items assigned to them.',
                permission: 'organizations.access_reviews.decide',
                input: AccessReviewItemQuerySchema.extend({ review_id: z.string().uuid() }),
                handler: (ctx, { review_id, ...query }) => this.reviews.items(ctx, review_id, query),
            },
            { ...base, name: 'organizations_access_reviews_create', description: 'Create an access review (scope, module filter, reviewer strategy, due date; `start: true` to start now).', permission: 'organizations.access_reviews.manage', sensitive: true, input: CreateAccessReviewSchema, handler: (ctx, args) => this.reviews.create(ctx, args) },
            { ...base, name: 'organizations_access_reviews_start', description: 'Start a draft access review (snapshots members, assigns reviewers, notifies them).', permission: 'organizations.access_reviews.manage', sensitive: true, input: id, handler: (ctx, args) => this.reviews.start(ctx, args.id) },
            {
                ...base,
                resource_type: 'access_review_item',
                name: 'organizations_access_review_items_decide',
                description: 'Certify, revoke or modify the access of a member assigned to you (comment required for revoke / modify).',
                permission: 'organizations.access_reviews.decide',
                sensitive: true,
                input: z.object({ item_id: z.string().uuid(), decision: z.enum(['CERTIFIED', 'REVOKED', 'MODIFIED']), comment: z.string().max(1000).optional(), changes: z.unknown().optional() }),
                handler: async (ctx, { item_id, ...rest }) => {
                    const parsed = DecideItemSchema.safeParse(rest);
                    if (!parsed.success) throw new BadRequestException({ message: parsed.error.issues[0]?.message ?? 'Invalid decision', code: 'validation_failed' });
                    return this.reviews.decide(ctx, item_id, parsed.data);
                },
            },
            { ...base, name: 'organizations_access_reviews_apply', description: 'Apply every revoke / modify decision of a review (removes roles, grants or module access).', permission: 'organizations.access_reviews.manage', sensitive: true, input: id, handler: (ctx, args) => this.reviews.apply(ctx, args.id) },
            { ...base, name: 'organizations_access_reviews_complete', description: 'Complete an access review once every item is decided and applied.', permission: 'organizations.access_reviews.manage', input: id, handler: (ctx, args) => this.reviews.complete(ctx, args.id) },
        ]);
    }
}
