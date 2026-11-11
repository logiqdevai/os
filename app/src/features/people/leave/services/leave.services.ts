import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { CompanyHoliday, EmployeeBalances, LeaveCalendar, LeavePreview, LeaveRequest, LeaveRequestDto, LeaveTransaction, LeaveType, Paginated } from "../interfaces/leave.interfaces";

const R = ApiRoutes.people.leave;

export const getLeaveRequests = async (params: Record<string, unknown>): Promise<Paginated<LeaveRequest>> => (await axiosInstance.get(R.requests, { params })).data;
export const getLeaveRequest = async (id: string): Promise<LeaveRequest> => (await axiosInstance.get(R.request(id))).data;
export const previewLeave = async (dto: LeaveRequestDto): Promise<LeavePreview> => (await axiosInstance.post(R.preview, dto)).data;
export const createLeave = async (dto: LeaveRequestDto): Promise<LeaveRequest> => (await axiosInstance.post(R.requests, dto)).data;
export const approveLeave = async ({ id, note }: { id: string; note?: string }): Promise<LeaveRequest> => (await axiosInstance.post(R.approve(id), { note })).data;
export const rejectLeave = async ({ id, note }: { id: string; note?: string }): Promise<LeaveRequest> => (await axiosInstance.post(R.reject(id), { note })).data;
export const cancelLeave = async ({ id, cancellation_reason }: { id: string; cancellation_reason?: string }): Promise<LeaveRequest> =>
    (await axiosInstance.post(R.cancel(id), { cancellation_reason })).data;
export const getLeaveCalendar = async (params: { from: string; to: string; team_id?: string; branch_id?: string }): Promise<LeaveCalendar> =>
    (await axiosInstance.get(R.calendar, { params })).data;
export const getLeaveBalances = async (params: Record<string, unknown>): Promise<Paginated<EmployeeBalances>> => (await axiosInstance.get(R.balances, { params })).data;
export const getLeaveTransactions = async (id: string): Promise<LeaveTransaction[]> => (await axiosInstance.get(R.transactions(id))).data;
export const adjustBalance = async ({ id, days, reason }: { id: string; days: number; reason: string }) => (await axiosInstance.post(R.adjust(id), { days, reason })).data;
export const getLeaveTypes = async (): Promise<LeaveType[]> => (await axiosInstance.get(R.types)).data;
export const getHolidays = async (year?: number): Promise<CompanyHoliday[]> => (await axiosInstance.get(R.holidays, { params: year ? { year } : undefined })).data;
export const createHoliday = async (dto: { name: string; date: string; kind?: string; is_half_day?: boolean; recurring?: boolean }): Promise<CompanyHoliday> =>
    (await axiosInstance.post(R.holidays, dto)).data;
export const removeHoliday = async (id: string) => (await axiosInstance.delete(R.holiday(id))).data;
