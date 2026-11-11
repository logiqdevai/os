import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as service from "../services/home.services";

const KEY = ["home"] as const;

/** Home widgets never retry: a module that is not built / enabled answers 404 and the widget shows its empty state. */
export const useMyOpenTasks = (enabled: boolean) => useQuery({ queryKey: [...KEY, "tasks"], queryFn: () => service.getMyOpenTasks(8), enabled, retry: false, staleTime: 30_000 });
export const useMyWorkTasks = (params: Record<string, unknown>, enabled: boolean) =>
    useQuery({ queryKey: [...KEY, "my-work", params], queryFn: () => service.getMyWorkTasks(params), enabled, retry: false, placeholderData: keepPreviousData });
export const useMyProjects = (enabled: boolean) => useQuery({ queryKey: [...KEY, "projects"], queryFn: () => service.getMyProjects(5), enabled, retry: false, staleTime: 60_000 });
export const useHomeFavoriteProjects = (enabled: boolean) =>
    useQuery({
        queryKey: [...KEY, "favorite-projects"],
        queryFn: async () => {
            const res = await service.getFavoriteProjects();
            return Array.isArray(res) ? res : res.data;
        },
        enabled,
        retry: false,
    });
