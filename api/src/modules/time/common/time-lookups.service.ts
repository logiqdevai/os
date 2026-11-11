import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { MEMBER_SELECT, TimeAccessService, TimeScope } from './time-access.service';

/**
 * Pickers for the time entry form and the week grid. Projects (05) and tasks (06) are read-only lookups here;
 * those modules own the records and their services. Projects with time tracking disabled are excluded, and
 * members_only projects only list for their members.
 */
@Injectable()
export class TimeLookupsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly access: TimeAccessService,
    ) { }

    async projects(ctx: OrgContext, search?: string) {
        const me = ctx.membership_id;
        const where: Prisma.ProjectWhereInput = {
            organization_id: ctx.organization_id,
            archived_at: null,
            cancelled_at: null,
            ...(search && { OR: [{ name: { contains: search, mode: 'insensitive' } }, { code: { contains: search, mode: 'insensitive' } }] }),
            AND: [
                { OR: [{ time_settings: null }, { time_settings: { time_tracking_enabled: true } }] },
                {
                    OR: [
                        { time_settings: null },
                        { time_settings: { members_only: false } },
                        ...(me ? [{ members: { some: { membership_id: me, is_active: true } } }, { owner_membership_id: me }] : []),
                    ],
                },
            ],
        };
        return this.prisma.project.findMany({
            where,
            take: 100,
            orderBy: { name: 'asc' },
            select: { id: true, name: true, code: true, color: true, company: { select: { id: true, name: true } }, time_settings: { select: { default_billable: true, require_task: true, default_activity_type_id: true } } },
        });
    }

    async tasks(ctx: OrgContext, projectId?: string, search?: string) {
        return this.prisma.task.findMany({
            where: {
                organization_id: ctx.organization_id,
                ...(projectId && { project_id: projectId }),
                cancelled_at: null,
                ...(search && { title: { contains: search, mode: 'insensitive' } }),
            },
            take: 100,
            orderBy: [{ completed_at: { sort: 'desc', nulls: 'first' } }, { updated_at: 'desc' }],
            select: { id: true, number: true, title: true, project_id: true, completed_at: true, team: { select: { task_key: true } } },
        });
    }

    /** Members the caller can see or act for (team scope); used by filters and "log for" pickers. */
    async members(ctx: OrgContext, scope: TimeScope = 'all') {
        const ids = await this.access.memberIds(ctx, this.access.effectiveScope(ctx, scope));
        return this.prisma.membership.findMany({
            where: { organization_id: ctx.organization_id, status: 'ACTIVE', type: 'INTERNAL', ...(ids && { id: { in: ids } }) },
            select: MEMBER_SELECT,
            orderBy: { user: { first_name: 'asc' } },
            take: 500,
        });
    }
}
