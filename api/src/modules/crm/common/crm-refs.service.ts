import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';

type RefKind = 'membership' | 'team' | 'branch' | 'company' | 'contact' | 'lead_source' | 'lifecycle_stage' | 'lead_status' | 'loss_reason' | 'pipeline';

/**
 * Tenant checks for every id a CRM write receives (ids never cross organizations) and small shared lookups
 * (tags of many records, assign-permission checks).
 */
@Injectable()
export class CrmRefsService {
    constructor(private readonly prisma: PrismaService) { }

    /** Throws 404 `reference_not_found` when any given id is not in the caller's organization. */
    async assert(ctx: OrgContext, refs: Partial<Record<RefKind, (string | null | undefined)[] | string | null | undefined>>) {
        const org = ctx.organization_id;
        const checks: Promise<{ kind: string; ok: boolean }>[] = [];
        const add = (kind: string, ids: string[], count: (ids: string[]) => Promise<number>) => {
            const unique = [...new Set(ids)];
            if (unique.length) checks.push(count(unique).then((n) => ({ kind, ok: n === unique.length })));
        };
        const list = (v: unknown) => (Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === 'string' && !!x);
        for (const [kind, raw] of Object.entries(refs)) {
            const ids = list(raw);
            switch (kind as RefKind) {
                case 'membership': add(kind, ids, (i) => this.prisma.membership.count({ where: { id: { in: i }, organization_id: org } })); break;
                case 'team': add(kind, ids, (i) => this.prisma.team.count({ where: { id: { in: i }, organization_id: org } })); break;
                case 'branch': add(kind, ids, (i) => this.prisma.branch.count({ where: { id: { in: i }, organization_id: org } })); break;
                case 'company': add(kind, ids, (i) => this.prisma.crmCompany.count({ where: { id: { in: i }, organization_id: org } })); break;
                case 'contact': add(kind, ids, (i) => this.prisma.crmContact.count({ where: { id: { in: i }, organization_id: org } })); break;
                case 'lead_source': add(kind, ids, (i) => this.prisma.crmLeadSource.count({ where: { id: { in: i }, organization_id: org } })); break;
                case 'lifecycle_stage': add(kind, ids, (i) => this.prisma.crmLifecycleStage.count({ where: { id: { in: i }, organization_id: org } })); break;
                case 'lead_status': add(kind, ids, (i) => this.prisma.crmLeadStatus.count({ where: { id: { in: i }, organization_id: org } })); break;
                case 'loss_reason': add(kind, ids, (i) => this.prisma.crmLossReason.count({ where: { id: { in: i }, organization_id: org } })); break;
                case 'pipeline': add(kind, ids, (i) => this.prisma.crmPipeline.count({ where: { id: { in: i }, organization_id: org } })); break;
            }
        }
        const results = await Promise.all(checks);
        const bad = results.find((r) => !r.ok);
        if (bad) throw new NotFoundException({ message: `Referenced ${bad.kind.replace('_', ' ')} not found`, code: 'reference_not_found', reference: bad.kind });
    }

    /** Changing an owner field needs the resource's `assign` key (02 §20). */
    assertCanAssign(ctx: OrgContext, key: string, changed: boolean) {
        if (changed && !ctx.can(key)) throw new ForbiddenException({ message: `Missing permission ${key}`, code: 'permission_denied', permission: key });
    }

    async tagsFor(entity_type: RecordEntityType, ids: string[]) {
        const map = new Map<string, { id: string; name: string; color: string | null }[]>();
        if (!ids.length) return map;
        const rows = await this.prisma.tagging.findMany({ where: { entity_type, entity_id: { in: ids } }, include: { tag: { select: { id: true, name: true, color: true } } } });
        for (const r of rows) map.set(r.entity_id, [...(map.get(r.entity_id) ?? []), r.tag]);
        return map;
    }

    async withTags<T extends { id: string }>(entity_type: RecordEntityType, items: T[]): Promise<(T & { tags: { id: string; name: string; color: string | null }[] })[]> {
        const map = await this.tagsFor(entity_type, items.map((i) => i.id));
        return items.map((i) => ({ ...i, tags: map.get(i.id) ?? [] }));
    }

    /** Tag ids to restrict a list to (records carrying the tag). */
    async idsWithTag(entity_type: RecordEntityType, tag_id?: string): Promise<string[] | undefined> {
        if (!tag_id) return undefined;
        const rows = await this.prisma.tagging.findMany({ where: { entity_type, tag_id }, select: { entity_id: true } });
        return rows.map((r) => r.entity_id);
    }

    async orgCurrency(ctx: OrgContext) {
        const org = await this.prisma.organization.findUnique({ where: { id: ctx.organization_id }, select: { default_currency: true } });
        return org?.default_currency ?? 'EUR';
    }
}
