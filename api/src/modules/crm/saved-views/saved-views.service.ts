import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Prisma, RecordEntityType, SavedViewVisibility } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';

export const MANAGE_SHARED = 'platform.saved_views.manage_shared';

export class CreateSavedViewDto {
    @ApiProperty({ enum: RecordEntityType }) @IsEnum(RecordEntityType) entity_type: RecordEntityType;
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) name: string;
    @ApiProperty({ required: false, description: 'table | kanban | pipeline | list | timeline | calendar | forecast' }) @IsOptional() @IsString() @MaxLength(20) layout?: string;
    @ApiProperty({ enum: SavedViewVisibility, required: false, description: 'TEAM / ORGANIZATION need platform.saved_views.manage_shared' }) @IsOptional() @IsEnum(SavedViewVisibility) visibility?: SavedViewVisibility;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() team_id?: string;
    @ApiProperty({ required: false, description: 'Filter values keyed like the list query (status, owner, …)' }) @IsOptional() @IsObject() filters?: Record<string, unknown>;
    @ApiProperty({ required: false }) @IsOptional() @IsObject() sorting?: Record<string, unknown>;
    @ApiProperty({ required: false }) @IsOptional() @IsObject() grouping?: Record<string, unknown>;
    @ApiProperty({ required: false }) @IsOptional() @IsObject() columns?: Record<string, unknown>;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) search?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() is_default?: boolean;
}
export class UpdateSavedViewDto extends PartialType(CreateSavedViewDto) { }

export const SavedViewQuerySchema = z.object({ entity_type: z.nativeEnum(RecordEntityType) });
export type SavedViewQuery = z.infer<typeof SavedViewQuerySchema>;

/** 02 §29 — saved list/board views: personal, team or organization-wide. */
@Injectable()
export class SavedViewsService {
    constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) { }

    private async myTeamIds(ctx: OrgContext) {
        if (!ctx.membership_id) return [];
        const rows = await this.prisma.teamMembership.findMany({ where: { membership_id: ctx.membership_id, ended_at: null }, select: { team_id: true } });
        return rows.map((r) => r.team_id);
    }

    async findAll(ctx: OrgContext, query: SavedViewQuery) {
        const teams = await this.myTeamIds(ctx);
        const views = await this.prisma.savedView.findMany({
            where: {
                organization_id: ctx.organization_id,
                entity_type: query.entity_type,
                OR: [
                    { visibility: 'ORGANIZATION' },
                    { visibility: 'TEAM', team_id: { in: teams } },
                    { visibility: 'PERSONAL', owner_membership_id: ctx.membership_id ?? '__none__' },
                ],
            },
            include: { team: { select: { id: true, name: true } } },
            orderBy: [{ visibility: 'asc' }, { name: 'asc' }],
        });
        return views.map((v) => ({ ...v, can_edit: this.canEdit(ctx, v) }));
    }

    private canEdit(ctx: OrgContext, v: { visibility: SavedViewVisibility; owner_membership_id: string | null }) {
        return v.visibility === 'PERSONAL' ? v.owner_membership_id === ctx.membership_id : ctx.can(MANAGE_SHARED);
    }

    private assertShared(ctx: OrgContext, visibility?: SavedViewVisibility) {
        if (visibility && visibility !== 'PERSONAL' && !ctx.can(MANAGE_SHARED)) {
            throw new ForbiddenException({ message: `Missing permission ${MANAGE_SHARED}`, code: 'permission_denied', permission: MANAGE_SHARED });
        }
    }

    async create(ctx: OrgContext, dto: CreateSavedViewDto) {
        this.assertShared(ctx, dto.visibility);
        if (dto.team_id && !(await this.prisma.team.findFirst({ where: { id: dto.team_id, organization_id: ctx.organization_id } }))) throw new NotFoundException({ message: 'Team not found', code: 'reference_not_found' });
        const view = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.savedView.updateMany({ where: { organization_id: ctx.organization_id, entity_type: dto.entity_type, owner_membership_id: ctx.membership_id }, data: { is_default: false } });
            return tx.savedView.create({
                data: {
                    ...dto,
                    organization_id: ctx.organization_id,
                    owner_membership_id: ctx.membership_id,
                    visibility: dto.visibility ?? 'PERSONAL',
                    filters: dto.filters as Prisma.InputJsonValue, sorting: dto.sorting as Prisma.InputJsonValue,
                    grouping: dto.grouping as Prisma.InputJsonValue, columns: dto.columns as Prisma.InputJsonValue,
                },
            });
        });
        await this.audit.record(ctx, 'saved_view.created', { resource_type: 'saved_view', resource_id: view.id, metadata: { after: { name: view.name, entity_type: view.entity_type, visibility: view.visibility } } });
        return { ...view, can_edit: true };
    }

    async update(ctx: OrgContext, id: string, dto: UpdateSavedViewDto) {
        const before = await this.getEditable(ctx, id);
        this.assertShared(ctx, dto.visibility);
        const view = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.savedView.updateMany({ where: { organization_id: ctx.organization_id, entity_type: before.entity_type, owner_membership_id: ctx.membership_id, id: { not: id } }, data: { is_default: false } });
            return tx.savedView.update({
                where: { id },
                data: {
                    ...dto,
                    filters: dto.filters as Prisma.InputJsonValue | undefined, sorting: dto.sorting as Prisma.InputJsonValue | undefined,
                    grouping: dto.grouping as Prisma.InputJsonValue | undefined, columns: dto.columns as Prisma.InputJsonValue | undefined,
                },
            });
        });
        await this.audit.record(ctx, 'saved_view.updated', { resource_type: 'saved_view', resource_id: id, metadata: { before: { name: before.name, visibility: before.visibility }, after: { name: view.name, visibility: view.visibility } } });
        return { ...view, can_edit: true };
    }

    async remove(ctx: OrgContext, id: string) {
        const view = await this.getEditable(ctx, id);
        await this.prisma.savedView.delete({ where: { id } });
        await this.audit.record(ctx, 'saved_view.deleted', { resource_type: 'saved_view', resource_id: id, metadata: { before: { name: view.name } } });
        return { success: true };
    }

    private async getEditable(ctx: OrgContext, id: string) {
        const view = await this.prisma.savedView.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!view || (view.visibility === 'PERSONAL' && view.owner_membership_id !== ctx.membership_id)) throw new NotFoundException({ message: 'View not found', code: 'saved_view_not_found' });
        if (!this.canEdit(ctx, view)) throw new ForbiddenException({ message: `Missing permission ${MANAGE_SHARED}`, code: 'permission_denied', permission: MANAGE_SHARED });
        return view;
    }
}
