import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as service from "../services/sso.services";

const KEY = ["admin", "sso"] as const;

export const useSsoConfigurations = () => useQuery({ queryKey: KEY, queryFn: service.getSsoConfigurations });

function useInvalidate() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: KEY });
}

export const useCreateSsoConfiguration = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.createSsoConfiguration, onSuccess: invalidate });
};
export const useUpdateSsoConfiguration = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.updateSsoConfiguration, onSuccess: invalidate });
};
export const useUpdateSsoSettings = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.updateSsoSettings, onSuccess: invalidate });
};
export const useDeleteSsoConfiguration = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.deleteSsoConfiguration, onSuccess: invalidate });
};
export const useAddGroupMapping = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.addGroupMapping, onSuccess: invalidate });
};
export const useUpdateGroupMapping = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.updateGroupMapping, onSuccess: invalidate });
};
export const useDeleteGroupMapping = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.deleteGroupMapping, onSuccess: invalidate });
};
