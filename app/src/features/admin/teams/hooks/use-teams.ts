import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patchEntity, useEntityUpdate, useOptimisticMutation } from "@/lib/query/optimistic";
import type { MemberDetail } from "@/features/admin/members/interfaces/members.interfaces";
import type { TeamDetail } from "../interfaces/teams.interfaces";
import * as service from "../services/teams.services";

const KEY = ["admin", "teams"] as const;

export const useTeams = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getTeams(params), placeholderData: keepPreviousData });

export const useTeam = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getTeam(id as string), enabled: !!id });

const MEMBERS = ["admin", "members"] as const;

/** Team membership shows on member pages too, so both are refreshed. */
function useInvalidate() {
    const qc = useQueryClient();
    return () => {
        qc.invalidateQueries({ queryKey: KEY });
        qc.invalidateQueries({ queryKey: MEMBERS });
    };
}

export const useCreateTeam = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.createTeam, meta: { errorTitle: "Could not create team" }, onSettled: invalidate });
};
/** Optimistic: the team changes at once in every list and the detail (`optimistic` carries display objects). */
export const useUpdateTeam = (errorToast = true) =>
    useEntityUpdate({ root: KEY, mutationFn: service.updateTeam, alsoInvalidate: [MEMBERS], meta: { errorTitle: "Could not update the team", errorToast } });
/** Optimistic: the team shows Archived at once. */
export const useArchiveTeam = () =>
    useOptimisticMutation({ roots: [KEY], alsoInvalidate: [MEMBERS], mutationFn: service.archiveTeam, meta: { errorTitle: "Could not archive the team" }, apply: (qc, id) => patchEntity(qc, KEY, id, { archived_at: new Date().toISOString() }) });
export const useAddTeamMember = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.addTeamMember, meta: { errorTitle: "Could not add the member to the team" }, onSettled: invalidate });
};
/** Optimistic: the person leaves the team list (and the team leaves the member's page) at once. */
export const useRemoveTeamMember = () =>
    useOptimisticMutation({
        roots: [KEY, MEMBERS],
        mutationFn: service.removeTeamMember,
        meta: { errorTitle: "Could not remove the member from the team" },
        apply: (qc, v) => {
            qc.setQueryData<TeamDetail>([...KEY, "detail", v.id], (t) => (t ? { ...t, members: t.members.filter((m) => m.membership.id !== v.membership_id) } : t));
            qc.setQueryData<MemberDetail>([...MEMBERS, "detail", v.membership_id], (m) => (m ? { ...m, teams: m.teams.filter((t) => t.team_id !== v.id) } : m));
        },
    });
