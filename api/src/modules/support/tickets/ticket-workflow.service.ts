import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TicketStatus, TicketStatusCategory } from 'generated/prisma';
import { SlaService } from '../sla/sla.service';
import { CLOSED_CATEGORIES } from '../common/support.constants';

type Tx = Prisma.TransactionClient;

export interface TransitionActor {
    membership_id?: string | null;
    user_id?: string | null;
}

/**
 * Ticket status transitions (13 §2, §7): workflow rules, status history with time-in-status, lifecycle timestamps
 * and SLA pause/resume. Used by TicketsService, conversations (auto-transitions on replies) and the portal.
 */
@Injectable()
export class TicketWorkflowService {
    constructor(private readonly sla: SlaService) { }

    async statusByCategory(tx: Tx, organizationId: string, category: TicketStatusCategory) {
        return tx.ticketStatus.findFirst({ where: { organization_id: organizationId, category, archived_at: null }, orderBy: [{ is_default: 'desc' }, { sort_order: 'asc' }] });
    }

    async defaultStatus(tx: Tx, organizationId: string) {
        return (
            (await tx.ticketStatus.findFirst({ where: { organization_id: organizationId, is_default: true, archived_at: null } })) ??
            (await this.statusByCategory(tx, organizationId, 'NEW')) ??
            (await tx.ticketStatus.findFirst({ where: { organization_id: organizationId, archived_at: null }, orderBy: { sort_order: 'asc' } }))
        );
    }

    /**
     * Move a ticket to `to`. `enforce` = check the from-status' allowed_transitions (manual changes);
     * automatic transitions (customer replied, agent replied) skip the check.
     */
    async transition(
        tx: Tx,
        ticketId: string,
        to: TicketStatus,
        actor: TransitionActor,
        opts: { via?: string; reason?: string | null; enforce?: boolean; resolution?: string | null } = {},
    ) {
        const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { status: true } });
        if (ticket.status_id === to.id) return { ...ticket, previous_status: ticket.status, wasClosed: false, closing: false };
        const from = ticket.status;
        if (opts.enforce && from?.allowed_transitions.length && !from.allowed_transitions.includes(to.slug)) {
            throw new BadRequestException({ message: `A ticket in "${from.name}" cannot move to "${to.name}"`, code: 'ticket_transition_not_allowed' });
        }
        const now = new Date();
        const lastChange = await tx.ticketStatusHistory.findFirst({ where: { ticket_id: ticketId }, orderBy: { changed_at: 'desc' }, select: { changed_at: true } });
        const since = lastChange?.changed_at ?? ticket.created_at;
        const wasClosed = !!from && CLOSED_CATEGORIES.includes(from.category);
        const closing = CLOSED_CATEGORIES.includes(to.category);

        await tx.ticketStatusHistory.create({
            data: {
                ticket_id: ticketId,
                from_status_id: from?.id ?? null,
                to_status_id: to.id,
                from_category: from?.category ?? null,
                to_category: to.category,
                changed_by_membership_id: actor.membership_id ?? null,
                changed_by_user_id: actor.user_id ?? null,
                changed_via: opts.via ?? 'manual',
                reason: opts.reason ?? null,
                seconds_in_previous: Math.max(0, Math.round((now.getTime() - since.getTime()) / 1000)),
            },
        });

        const data: Prisma.TicketUncheckedUpdateInput = { status_id: to.id };
        if (to.category === 'RESOLVED') {
            data.resolved_at = ticket.resolved_at ?? now;
            data.resolved_by_membership_id = actor.membership_id ?? ticket.resolved_by_membership_id;
            if (opts.resolution !== undefined) data.resolution = opts.resolution;
        }
        if (to.category === 'CLOSED') {
            data.closed_at = now;
            data.resolved_at = ticket.resolved_at ?? now;
        }
        if (wasClosed && !closing) {
            data.reopened_at = now;
            data.reopen_count = { increment: 1 };
            data.resolved_at = null;
            data.closed_at = null;
            data.resolved_by_membership_id = null;
        }
        const updated = await tx.ticket.update({ where: { id: ticketId }, data });
        await this.sla.onStatusChange(tx, ticketId, { category: to.category, pauses_sla: to.pauses_sla }, wasClosed);
        return { ...updated, previous_status: from, wasClosed, closing };
    }
}
