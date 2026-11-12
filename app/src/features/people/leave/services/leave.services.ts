import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    BranchHoliday, CompanyHoliday, EmployeeBalances, HolidayDto, LeaveCalendar, LeavePolicy, LeavePolicyDto, LeavePreview, LeaveRequest, LeaveRequestDto, LeaveTransaction, LeaveType, LeaveTypeDto,
    Paginated, PolicyAssignment,
} from "../interfaces/leave.interfaces";

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
export const getLeaveTypes = async (archived = false): Promise<LeaveType[]> => (await axiosInstance.get(R.types, { params: archived ? { archived: "true" } : undefined })).data;
export const createLeaveType = async (dto: LeaveTypeDto): Promise<LeaveType> => (await axiosInstance.post(R.types, dto)).data;
export const updateLeaveType = async ({ id, ...dto }: Partial<LeaveTypeDto> & { id: string }): Promise<LeaveType> => (await axiosInstance.patch(R.type(id), dto)).data;
export const setLeaveTypeArchived = async ({ id, archived }: { id: string; archived: boolean }) => (await axiosInstance.post(archived ? R.archiveType(id) : R.restoreType(id))).data;
export const getLeavePolicies = async (): Promise<LeavePolicy[]> => (await axiosInstance.get(R.policies)).data;
export const createLeavePolicy = async (dto: LeavePolicyDto): Promise<LeavePolicy> => (await axiosInstance.post(R.policies, dto)).data;
export const updateLeavePolicy = async ({ id, ...dto }: Partial<LeavePolicyDto> & { id: string }): Promise<LeavePolicy> => (await axiosInstance.patch(R.policy(id), dto)).data;
export const archiveLeavePolicy = async (id: string) => (await axiosInstance.post(R.archivePolicy(id))).data;
export const assignLeavePolicy = async ({ id, employee_id, effective_from }: { id: string; employee_id: string; effective_from: string }) =>
    (await axiosInstance.post(R.assignPolicy(id), { employee_id, effective_from })).data;
export const getPolicyAssignments = async (id: string): Promise<PolicyAssignment[]> => (await axiosInstance.get(R.policyAssignments(id))).data;
export const updateHoliday = async ({ id, ...dto }: Partial<HolidayDto> & { id: string }): Promise<CompanyHoliday> => (await axiosInstance.patch(R.holiday(id), dto)).data;
export const getBranchHolidays = async (year?: number): Promise<BranchHoliday[]> => (await axiosInstance.get(R.branchHolidays, { params: year ? { year } : undefined })).data;
export const createBranchHoliday = async (dto: { branch_id: string; name: string; date: string; recurring?: boolean }): Promise<BranchHoliday> =>
    (await axiosInstance.post(R.branchHolidays, dto)).data;
export const removeBranchHoliday = async (id: string) => (await axiosInstance.delete(R.branchHoliday(id))).data;
export const getHolidays = async (year?: number): Promise<CompanyHoliday[]> => (await axiosInstance.get(R.holidays, { params: year ? { year } : undefined })).data;
export const createHoliday = async (dto: HolidayDto): Promise<CompanyHoliday> =>
    (await axiosInstance.post(R.holidays, dto)).data;
export const removeHoliday = async (id: string) => (await axiosInstance.delete(R.holiday(id))).data;
