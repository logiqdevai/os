import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Task } from "@/features/tasks/interfaces/tasks.interfaces";
import type { Paginated, ProjectListItem } from "@/features/projects/interfaces/projects.interfaces";

/**
 * Home aggregates read-only summaries from the modules that own the data (no Home tables). Each call is made only when the
 * caller holds the module's read key; the owning module's API re-checks scope.
 */
export const getMyOpenTasks = async (limit = 8): Promise<Paginated<Task>> =>
    (await axiosInstance.get(ApiRoutes.tasks.list, { params: { mine: true, open: true, order_by: "due_date", order_direction: "asc", limit } })).data;

export const getMyWorkTasks = async (params: Record<string, unknown>): Promise<Paginated<Task>> =>
    (await axiosInstance.get(ApiRoutes.tasks.list, { params: { mine: true, open: true, order_by: "due_date", order_direction: "asc", ...params } })).data;

export const getMyProjects = async (limit = 5): Promise<Paginated<ProjectListItem>> =>
    (await axiosInstance.get(ApiRoutes.projects.list, { params: { owner_id: "me", limit } })).data;

export const getFavoriteProjects = async (): Promise<ProjectListItem[] | Paginated<ProjectListItem>> => (await axiosInstance.get(ApiRoutes.projects.favorites)).data;
