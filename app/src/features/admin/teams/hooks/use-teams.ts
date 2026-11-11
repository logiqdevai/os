import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as service from "../services/teams.services";

const KEY = ["admin", "teams"] as const;

export const useTeams = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getTeams(params), placeholderData: keepPreviousData });

export const useTeam = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getTeam(id as string), enabled: !!id });

function useInvalidate() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: KEY });
}

export const useCreateTeam = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.createTeam, onSuccess: invalidate });
};
export const useUpdateTeam = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.updateTeam, onSuccess: invalidate });
};
export const useArchiveTeam = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.archiveTeam, onSuccess: invalidate });
};
export const useAddTeamMember = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.addTeamMember, onSuccess: invalidate });
};
export const useRemoveTeamMember = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.removeTeamMember, onSuccess: invalidate });
};
