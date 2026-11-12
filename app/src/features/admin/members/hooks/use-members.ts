import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { patchEntity, useOptimisticMutation } from "@/lib/query/optimistic";
import * as service from "../services/members.services";
import type { MemberDetail, MembershipStatus } from "../interfaces/members.interfaces";

const KEY = ["admin", "members"] as const;

export const useMembers = (params: Record<string, unknown>, options: { enabled?: boolean } = {}) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getMembers(params), placeholderData: keepPreviousData, enabled: options.enabled ?? true });

export const useMember = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getMember(id as string), enabled: !!id });

export const useEffectivePermissions = (id: string | undefined, enabled = true) =>
    useQuery({ queryKey: [...KEY, "effective", id], queryFn: () => service.getEffectivePermissions(id as string), enabled: !!id && enabled });

/** Member changes affect teams, branches and the overview counts too. */
const ALSO: readonly (readonly string[])[] = [["admin", "teams"], ["admin", "branches"], ["admin", "overview"], ["admin", "grants"]];

function useInvalidate() {
    const qc = useQueryClient();
    return () => {
        qc.invalidateQueries({ queryKey: KEY });
        for (const queryKey of ALSO) qc.invalidateQueries({ queryKey });
    };
}

/** Plain member mutation: no success toast, the global MutationCache toasts failures with `errorTitle`. */
const mutation = <TArgs,>(fn: (args: TArgs) => Promise<unknown>, errorTitle: string) => () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: fn, meta: { errorTitle }, onSettled: invalidate });
};

/** Optimistic member mutation: `apply` patches the cached lists / detail before the request; rollback on failure. */
const optimistic = <TArgs,>(fn: (args: TArgs) => Promise<unknown>, errorTitle: string, apply: (qc: QueryClient, args: TArgs) => void) => () =>
    useOptimisticMutation<unknown, TArgs>({ roots: [KEY], alsoInvalidate: [...ALSO], mutationFn: fn, meta: { errorTitle }, apply });

/** Patch the member detail (only the detail cache has the nested arrays touched here). */
const patchDetail = (qc: QueryClient, id: string, fn: (m: MemberDetail) => MemberDetail) =>
    qc.setQueryData<MemberDetail>([...KEY, "detail", id], (m) => (m ? fn(m) : m));
const setStatus = (status: MembershipStatus) => (qc: QueryClient, id: string) => patchEntity(qc, KEY, id, { status });

/** Optimistic: profile fields (job title, type, default branch / team) change at once. `errorToast: false` when autosaved. */
export const useUpdateMember = (errorToast = true) =>
    useOptimisticMutation<unknown, Parameters<typeof service.updateMember>[0]>({
        roots: [KEY],
        alsoInvalidate: [...ALSO],
        mutationFn: service.updateMember,
        meta: { errorTitle: "Could not update the member", errorToast },
        apply: (qc, { id, ...dto }) => patchEntity(qc, KEY, id, dto),
    });
/** Optimistic: the status badge changes at once in lists and the detail. */
export const useSuspendMember = optimistic(service.suspendMember, "Could not suspend the member", setStatus("SUSPENDED"));
export const useReactivateMember = optimistic(service.reactivateMember, "Could not reactivate the member", setStatus("ACTIVE"));
export const useOffboardMember = optimistic(service.offboardMember, "Could not offboard the member", (qc, { id }) => setStatus("DEACTIVATED")(qc, id));
export const useResetMemberMfa = mutation(service.resetMemberMfa, "Could not reset two-step verification");
export const useAssignRole = mutation(service.assignRole, "Could not assign the role");
/** Optimistic: the role assignment disappears at once. */
export const useRemoveRole = optimistic(service.removeRole, "Could not remove the role", (qc, { id, assignment_id }) =>
    patchDetail(qc, id, (m) => ({ ...m, role_assignments: m.role_assignments.filter((r) => r.id !== assignment_id) })));
/** Optimistic when only the primary flag changes on a branch the member already has; adding a new branch waits for the API. */
export const useAddMemberBranch = optimistic(service.addMemberBranch, "Could not update the member's branches", (qc, { id, branch_id, is_primary }) =>
    patchDetail(qc, id, (m) => (is_primary && m.branches.some((b) => b.branch_id === branch_id)
        ? { ...m, branches: m.branches.map((b) => ({ ...b, is_primary: b.branch_id === branch_id })) }
        : m)));
/** Optimistic: the branch disappears at once. */
export const useRemoveMemberBranch = optimistic(service.removeMemberBranch, "Could not remove the branch", (qc, { id, branch_id }) =>
    patchDetail(qc, id, (m) => ({ ...m, branches: m.branches.filter((b) => b.branch_id !== branch_id) })));
/** Optimistic: the module switch flips at once. */
export const useSetModuleAccess = optimistic(service.setModuleAccess, "Could not change module access", (qc, { id, module, enabled }) =>
    patchDetail(qc, id, (m) => ({
        ...m,
        module_access: m.module_access.some((a) => a.module === module)
            ? m.module_access.map((a) => (a.module === module ? { ...a, enabled } : a))
            : [...m.module_access, { id: `optimistic-${module}`, module: module as MemberDetail["module_access"][number]["module"], enabled }],
    })));
/** Optimistic: the override disappears at once (the module follows the organization setting). */
export const useResetModuleAccess = optimistic(service.resetModuleAccess, "Could not reset module access", (qc, { id, module }) =>
    patchDetail(qc, id, (m) => ({ ...m, module_access: m.module_access.filter((a) => a.module !== module) })));
