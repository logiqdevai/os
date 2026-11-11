import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { ApprovalRow, Paginated, TeamWeek, Timesheet, TimesheetDetail, WeekData } from "../interfaces/timesheets.interfaces";

const R = ApiRoutes.time.timesheets;

export const getWeek = async (params: { period_start?: string; membership_id?: string }): Promise<WeekData> => (await axiosInstance.get(R.week, { params })).data;
export const getTeamWeek = async (params: Record<string, unknown>): Promise<TeamWeek> => (await axiosInstance.get(R.team, { params })).data;
export const getTimesheets = async (params: Record<string, unknown>): Promise<Paginated<Timesheet>> => (await axiosInstance.get(R.list, { params })).data;
export const getTimesheet = async (id: string): Promise<TimesheetDetail> => (await axiosInstance.get(R.detail(id))).data;
export const getApprovals = async (params: Record<string, unknown>): Promise<Paginated<ApprovalRow>> => (await axiosInstance.get(ApiRoutes.time.approvals, { params })).data;
export const submitTimesheet = async (dto: { period_start: string; comment?: string }): Promise<TimesheetDetail> => (await axiosInstance.post(R.submit, dto)).data;
export const approveTimesheet = async ({ id, comment }: { id: string; comment?: string }): Promise<TimesheetDetail> => (await axiosInstance.post(R.approve(id), { comment })).data;
export const rejectTimesheet = async ({ id, comment }: { id: string; comment: string }): Promise<TimesheetDetail> => (await axiosInstance.post(R.reject(id), { comment })).data;
export const reopenTimesheet = async ({ id, comment }: { id: string; comment?: string }): Promise<TimesheetDetail> => (await axiosInstance.post(R.reopen(id), { comment })).data;
export const unlockTimesheet = async ({ id, reason }: { id: string; reason: string }): Promise<TimesheetDetail> => (await axiosInstance.post(R.unlock(id), { reason })).data;
export const bulkDecideTimesheets = async (dto: {
    ids: string[];
    action: "approve" | "reject";
    comment?: string;
}): Promise<{ succeeded: number; failed: number; results: { id: string; ok: boolean; message?: string }[] }> => (await axiosInstance.post(R.bulk, dto)).data;
