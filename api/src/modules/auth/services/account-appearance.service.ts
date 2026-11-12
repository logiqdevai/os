import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AppColorMode, AppTheme } from 'generated/prisma';

export interface AppearanceDto {
    color_mode?: AppColorMode;
    theme?: AppTheme;
    /** #rrggbb; null resets to the theme color. */
    primary_color?: string | null;
}

export const DEFAULT_APPEARANCE = { color_mode: AppColorMode.SYSTEM, theme: AppTheme.DEFAULT, primary_color: null as string | null };

/**
 * 01 §127 — per-user, per-organization appearance (Slack-style: each workspace keeps its own theme).
 * Personal preference, not a permission: any active member or customer-portal user of the organization may set their own.
 */
@Injectable()
export class AccountAppearanceService {
    constructor(private readonly prisma: PrismaService) { }

    async get(userId: string, organizationId: string | null) {
        if (!organizationId) return { ...DEFAULT_APPEARANCE, organization_id: null };
        const row = await this.prisma.userAppearance.findUnique({ where: { user_id_organization_id: { user_id: userId, organization_id: organizationId } } });
        return { organization_id: organizationId, color_mode: row?.color_mode ?? DEFAULT_APPEARANCE.color_mode, theme: row?.theme ?? DEFAULT_APPEARANCE.theme, primary_color: row?.primary_color ?? null };
    }

    async update(userId: string, organizationId: string | null, dto: AppearanceDto) {
        if (!organizationId) throw new ForbiddenException({ message: 'Select an organization first', code: 'organization_required' });
        await this.assertBelongs(userId, organizationId);
        const data = {
            ...(dto.color_mode !== undefined && { color_mode: dto.color_mode }),
            ...(dto.theme !== undefined && { theme: dto.theme }),
            ...(dto.primary_color !== undefined && { primary_color: dto.primary_color ? dto.primary_color.toLowerCase() : null }),
        };
        await this.prisma.userAppearance.upsert({
            where: { user_id_organization_id: { user_id: userId, organization_id: organizationId } },
            update: data,
            create: { user_id: userId, organization_id: organizationId, ...data },
        });
        return this.get(userId, organizationId);
    }

    private async assertBelongs(userId: string, organizationId: string) {
        const [member, customer] = await Promise.all([
            this.prisma.membership.findFirst({ where: { user_id: userId, organization_id: organizationId, status: 'ACTIVE' }, select: { id: true } }),
            this.prisma.customerPortalMembership.findFirst({ where: { user_id: userId, organization_id: organizationId, status: 'ACTIVE' }, select: { id: true } }),
        ]);
        if (!member && !customer) throw new ForbiddenException({ message: 'You are not a member of this organization', code: 'not_a_member' });
    }
}
