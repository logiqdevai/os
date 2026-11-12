import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as service from "../services/members.services";

const KEY = ["admin", "members"] as const;

export const useMembers = (params: Record<string, unknown>, options: { enabled?: boolean } = {}) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getMembers(params), placeholderData: keepPreviousData, enabled: options.enabled ?? true });

export const useMember = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getMember(id as string), enabled: !!id });

export const useEffectivePermissions = (id: string | undefined, enabled = true) =>
    useQuery({ queryKey: [...KEY, "effective", id], queryFn: () => service.getEffectivePermissions(id as string), enabled: !!id && enabled });

/** Member changes affect teams, branches and the overview counts too. */
function useInvalidate() {
    const qc = useQueryClient();
    return () => {
        qc.invalidateQueries({ queryKey: KEY });
        qc.invalidateQueries({ queryKey: ["admin", "teams"] });
        qc.invalidateQueries({ queryKey: ["admin", "branches"] });
        qc.invalidateQueries({ queryKey: ["admin", "overview"] });
        qc.invalidateQueries({ queryKey: ["admin", "grants"] });
    };
}

const mutation = <TArgs,>(fn: (args: TArgs) => Promise<unknown>) => () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: fn, onSuccess: invalidate });
};

export const useUpdateMember = mutation(service.updateMember);
export const useSuspendMember = mutation(service.suspendMember);
export const useReactivateMember = mutation(service.reactivateMember);
export const useOffboardMember = mutation(service.offboardMember);
export const useResetMemberMfa = mutation(service.resetMemberMfa);
export const useAssignRole = mutation(service.assignRole);
export const useRemoveRole = mutation(service.removeRole);
export const useAddMemberBranch = mutation(service.addMemberBranch);
export const useRemoveMemberBranch = mutation(service.removeMemberBranch);
export const useSetModuleAccess = mutation(service.setModuleAccess);
export const useResetModuleAccess = mutation(service.resetModuleAccess);
