import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { AcceptSuggestionDto, TimeSuggestion, TimeSuggestionStatus } from "../interfaces/suggestions.interfaces";

const R = ApiRoutes.time.suggestions;

export const getSuggestions = async (status: TimeSuggestionStatus = "PENDING"): Promise<{ data: TimeSuggestion[]; totals: { count: number; minutes: number } }> =>
    (await axiosInstance.get(R.list, { params: { status } })).data;
export const generateSuggestions = async (): Promise<{ created: number; from: string; to: string }> => (await axiosInstance.post(R.generate, {})).data;
export const acceptSuggestion = async ({ id, ...dto }: AcceptSuggestionDto & { id: string }) => (await axiosInstance.post(R.accept(id), dto)).data;
export const acceptSuggestions = async (ids: string[]): Promise<{ accepted: number; results: { id: string; ok: boolean; error?: string }[] }> =>
    (await axiosInstance.post(R.acceptMany, { ids })).data;
export const dismissSuggestion = async (id: string) => (await axiosInstance.post(R.dismiss(id))).data;
