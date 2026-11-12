import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContractObligationStatus, ExtractionReviewState, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { ContractsService } from '../contracts/contracts.service';
import { MEMBER_SELECT, addDays, today } from '../shared/contracts.utils';
import { CreateObligationDto, ObligationQuery, UpdateObligationDto } from './dto/obligation.dto';

const OPEN: ContractObligationStatus[] = [ContractObligationStatus.OPEN, ContractObligationStatus.IN_PROGRESS, ContractObligationStatus.OVERDUE];

/** 04 §49–50 — obligations tracked across contracts. `is_overdue` is derived from due_date for open items. */
@Injectable()
export class ContractObligationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly contracts: ContractsService,
    ) { }

    private decorate<T extends { status: ContractObligationStatus; due_date: Date | null }>(o: T) {
        return { ...o, is_overdue: OPEN.includes(o.status) && !!o.due_date && o.due_date.getTime() < today().getTime() };
    }

    async findAll(ctx: OrgContext, query: ObligationQuery) {
        const now = today();
        const where: Prisma.ContractObligationWhereInput = {
            contract: { organization_id: ctx.organization_id, ...this.contracts.scopeWhere(ctx) },
            ...(query.contract_id && { contract_id: query.contract_id }),
            ...(query.status?.length && { status: { in: query.status } }),
            ...(query.type && { type: query.type }),
            ...(query.responsible_membership_id && { responsible_membership_id: query.responsible_membership_id }),
            ...(query.mine && { responsible_membership_id: ctx.membership_id ?? '-' }),
            ...(query.overdue && { status: { in: OPEN }, due_date: { lt: now } }),
            ...(query.due_within_days && { status: { in: OPEN }, due_date: { gte: now, lte: addDays(now, query.due_within_days) } }),
            ...(query.search && { title: { contains: query.search, mode: 'insensitive' } }),
            // AI suggestions waiting for review (or rejected) are not obligations yet (04 §75).
            NOT: { review_state: { in: [ExtractionReviewState.PENDING_REVIEW, ExtractionReviewState.REJECTED] } },
        };
        const [items, total] = await Promise.all([
            this.prisma.contractObligation.findMany({
                where, ...skipTake(query), orderBy: query.order_by ? orderBy(query, ['due_date', 'created_at', 'title', 'status'], 'due_date') : [{ due_date: { sort: 'asc', nulls: 'last' } }, { created_at: 'desc' }],
                include: { contract: { select: { id: true, number: true, title: true, status: true } }, section: { select: { id: true, key: true, title: true } } },
            }),
            this.prisma.contractObligation.count({ where }),
        ]);
        const members = await this.members(items.map((i) => i.responsible_membership_id));
        return paginate(items.map((o) => ({ ...this.decorate(o), responsible: members.find((m) => m.id === o.responsible_membership_id) ?? null })), total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const o = await this.prisma.contractObligation.findFirst({
            where: { id, contract: { organization_id: ctx.organization_id, ...this.contracts.scopeWhere(ctx) } },
            include: { contract: { select: { id: true, number: true, title: true, status: true, owner_membership_id: true } }, section: { select: { id: true, key: true, title: true } } },
        });
        if (!o) throw new NotFoundException({ message: 'Obligation not found', code: 'obligation_not_found' });
        const [responsible] = await this.members([o.responsible_membership_id]);
        return { ...this.decorate(o), responsible: responsible ?? null };
    }

    async create(ctx: OrgContext, dto: CreateObligationDto) {
        const contract = await this.contracts.assertContract(ctx, dto.contract_id);
        await this.assertRefs(ctx, dto.contract_id, dto);
        const o = await this.prisma.contractObligation.create({
            data: { ...dto, due_date: dto.due_date ? new Date(dto.due_date) : null },
        });
        await this.audit.record(ctx, 'contract.obligation_created', { resource_type: 'contract', resource_id: dto.contract_id, metadata: { obligation_id: o.id, after: dto } });
        this.events.publish(ctx, {
            event_key: 'contracts.obligation.created', module: ModuleKey.CONTRACTS, entity_kind: 'contract_obligation', entity_id: o.id,
            payload: { contract_id: contract.id, number: contract.number, title: o.title, due_date: dto.due_date, owner_membership_id: contract.owner_membership_id, assignee_membership_ids: o.responsible_membership_id ? [o.responsible_membership_id] : [] },
        });
        return this.findOne(ctx, o.id);
    }

    async update(ctx: OrgContext, id: string, dto: UpdateObligationDto) {
        const before = await this.findOne(ctx, id);
        await this.assertRefs(ctx, before.contract_id, dto);
        const data: Prisma.ContractObligationUncheckedUpdateInput = {
            ...dto,
            due_date: dto.due_date ? new Date(dto.due_date) : undefined,
            ...(dto.status === ContractObligationStatus.FULFILLED && !before.fulfilled_at ? { fulfilled_at: new Date() } : {}),
            ...(dto.status && dto.status !== ContractObligationStatus.FULFILLED ? { fulfilled_at: null } : {}),
        };
        await this.prisma.contractObligation.update({ where: { id }, data });
        await this.audit.record(ctx, 'contract.obligation_updated', { resource_type: 'contract', resource_id: before.contract_id, metadata: { obligation_id: id, before: { status: before.status, due_date: before.due_date, title: before.title }, after: dto } });
        this.events.publish(ctx, {
            event_key: dto.status === ContractObligationStatus.FULFILLED ? 'contracts.obligation.fulfilled' : 'contracts.obligation.updated', module: ModuleKey.CONTRACTS, entity_kind: 'contract_obligation', entity_id: id,
            payload: { contract_id: before.contract_id, title: before.title, status: dto.status ?? before.status, owner_membership_id: before.contract.owner_membership_id },
        });
        return this.findOne(ctx, id);
    }

    setStatus(ctx: OrgContext, id: string, status: ContractObligationStatus) {
        return this.update(ctx, id, { status });
    }

    async remove(ctx: OrgContext, id: string) {
        const o = await this.findOne(ctx, id);
        await this.prisma.contractObligation.delete({ where: { id } });
        await this.audit.record(ctx, 'contract.obligation_deleted', { resource_type: 'contract', resource_id: o.contract_id, metadata: { obligation_id: id, title: o.title } });
        return { success: true };
    }

    private async members(ids: (string | null)[]) {
        const list = [...new Set(ids.filter(Boolean) as string[])];
        return list.length ? this.prisma.membership.findMany({ where: { id: { in: list } }, select: MEMBER_SELECT }) : [];
    }

    private async assertRefs(ctx: OrgContext, contractId: string, dto: Partial<CreateObligationDto>) {
        if (dto.section_id && !(await this.prisma.contractSection.findFirst({ where: { id: dto.section_id, version: { contract_id: contractId } } }))) {
            throw new BadRequestException({ message: 'Section is not part of this contract', code: 'section_not_found' });
        }
        if (dto.responsible_party_id && !(await this.prisma.contractParty.findFirst({ where: { id: dto.responsible_party_id, contract_id: contractId } }))) {
            throw new BadRequestException({ message: 'Party is not part of this contract', code: 'party_not_found' });
        }
        if (dto.responsible_membership_id && !(await this.prisma.membership.findFirst({ where: { id: dto.responsible_membership_id, organization_id: ctx.organization_id } }))) {
            throw new NotFoundException({ message: 'Member not found', code: 'membership_not_found' });
        }
        if (dto.project_id && !(await this.prisma.project.findFirst({ where: { id: dto.project_id, organization_id: ctx.organization_id } }))) {
            throw new NotFoundException({ message: 'Project not found', code: 'project_not_found' });
        }
    }
}
