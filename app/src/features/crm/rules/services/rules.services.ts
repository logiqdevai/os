import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { getBranches } from "@/features/admin/branches/services/branches.services";
import type { AssignmentRule, RuleField, SalesTarget, SaveTargetDto, ScoringRule, TargetAttainment } from "../interfaces/rules.interfaces";

const R = () => ApiRoutes.crm.rules;
const T = () => ApiRoutes.crm.targets;

export const getRuleFields = async (): Promise<{ fields: RuleField[] }> => (await axiosInstance.get(R().fields)).data;
export const getAssignmentRules = async (): Promise<AssignmentRule[]> => (await axiosInstance.get(R().assignment)).data;
export const createAssignmentRule = async (dto: Omit<AssignmentRule, "id" | "priority"> & { priority?: number }): Promise<AssignmentRule> => (await axiosInstance.post(R().assignment, dto)).data;
export const updateAssignmentRule = async ({ id, ...dto }: Partial<AssignmentRule> & { id: string }): Promise<AssignmentRule> => (await axiosInstance.patch(R().assignment_detail(id), dto)).data;
export const deleteAssignmentRule = async (id: string) => (await axiosInstance.delete(R().assignment_detail(id))).data;

export const getScoringRules = async (): Promise<ScoringRule[]> => (await axiosInstance.get(R().scoring)).data;
export const createScoringRule = async (dto: Omit<ScoringRule, "id" | "sort_order"> & { sort_order?: number }): Promise<ScoringRule> => (await axiosInstance.post(R().scoring, dto)).data;
export const updateScoringRule = async ({ id, ...dto }: Partial<ScoringRule> & { id: string }): Promise<ScoringRule> => (await axiosInstance.patch(R().scoring_detail(id), dto)).data;
export const deleteScoringRule = async (id: string) => (await axiosInstance.delete(R().scoring_detail(id))).data;
export const recalculateScores = async (): Promise<{ leads: number; changed: number }> => (await axiosInstance.post(R().recalculate)).data;

export const getTargetAttainment = async (params: { date?: string; owner?: string; period?: string }): Promise<TargetAttainment> => (await axiosInstance.get(T().attainment, { params })).data;
export const getTargets = async (params: { year?: number; period?: string }): Promise<SalesTarget[]> => (await axiosInstance.get(T().list, { params })).data;
export const createTarget = async (dto: SaveTargetDto): Promise<SalesTarget> => (await axiosInstance.post(T().list, dto)).data;
export const updateTarget = async ({ id, ...dto }: Partial<SaveTargetDto> & { id: string }): Promise<SalesTarget> => (await axiosInstance.patch(T().detail(id), dto)).data;
export const deleteTarget = async (id: string) => (await axiosInstance.delete(T().detail(id))).data;

/** Branches for territory conditions (needs organizations.branches.read). */
export const getBranchOptions = async () => (await getBranches({ limit: 200 })).data.map((b) => ({ id: b.id, name: b.name }));
