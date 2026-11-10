import { useQuery } from "@tanstack/react-query";
import type { HealthScope } from "../interfaces/health.interfaces";
import { getHealth } from "../services/health.services";

export const useGetHealth = (scope: HealthScope) => {
    return useQuery({
        queryKey: ["health", scope],
        queryFn: () => getHealth(scope),
        refetchInterval: 30000,
    });
};
