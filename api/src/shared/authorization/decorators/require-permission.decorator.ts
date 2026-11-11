import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { OrgContext } from '../interfaces/org-context.interface';

export const PERMISSIONS_METADATA = 'lq:permissions';
export const PUBLIC_METADATA = 'lq:public';

export interface PermissionRequirement {
    mode: 'all' | 'any' | 'member';
    keys: string[];
}

/** Caller must hold every listed permission key (`<module>.<resource>.<action>`). */
export const RequirePermission = (...keys: string[]) => SetMetadata(PERMISSIONS_METADATA, { mode: 'all', keys } satisfies PermissionRequirement);

/** Caller must hold at least one of the keys (e.g. `time.entries.read_own` or `time.entries.read_all`). The service narrows scope. */
export const RequireAnyPermission = (...keys: string[]) => SetMetadata(PERMISSIONS_METADATA, { mode: 'any', keys } satisfies PermissionRequirement);

/**
 * Any active member of the organization (self-service endpoints such as "my notifications", "my preferences").
 * The service must still restrict data to the caller's own records.
 */
export const RequireOrgMember = () => SetMetadata(PERMISSIONS_METADATA, { mode: 'member', keys: [] } satisfies PermissionRequirement);

/** Explicitly public endpoint (no credential). */
export const Public = () => SetMetadata(PUBLIC_METADATA, true);

/** The resolved tenant + identity context (set by PermissionsGuard). */
export const CurrentOrg = createParamDecorator((_: unknown, ctx: ExecutionContext): OrgContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.org;
});
