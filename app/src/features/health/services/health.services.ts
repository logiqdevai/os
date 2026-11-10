import axios from "axios";
import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { HealthResponse, HealthScope } from "../interfaces/health.interfaces";
import { HealthServiceName } from "../interfaces/health.interfaces";

const getHealthParams = (scope: HealthScope) => {
    if (scope === HealthServiceName.POSTGRES) {
        return { postgres: "true" };
    }

    if (scope === HealthServiceName.REDIS) {
        return { redis: "true" };
    }

    return undefined;
};

export const getHealth = async (scope: HealthScope): Promise<HealthResponse> => {
    try {
        const response = await axiosInstance.get<HealthResponse>(ApiRoutes.health.prefix, {
            params: getHealthParams(scope),
            validateStatus: (status) => status === 200 || status === 503,
        });

        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.data) {
            return error.response.data as HealthResponse;
        }

        throw new Error("Failed to fetch health status. Please try again.");
    }
};
