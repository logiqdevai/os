import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated } from "@/features/people/employees/interfaces/employees.interfaces";
import type { AttendanceBoard, AttendanceRecord, MyAttendance } from "../interfaces/attendance.interfaces";

const R = ApiRoutes.people.attendance;

export const getMyAttendance = async (): Promise<MyAttendance> => (await axiosInstance.get(R.me)).data;
export const clockIn = async (dto: { work_location?: string; note?: string }): Promise<MyAttendance> => (await axiosInstance.post(R.clockIn, { ...dto, source: "WEB" })).data;
export const clockOut = async (dto: { note?: string } = {}): Promise<MyAttendance> => (await axiosInstance.post(R.clockOut, { ...dto, source: "WEB" })).data;
export const startBreak = async (): Promise<MyAttendance> => (await axiosInstance.post(R.breakStart, {})).data;
export const endBreak = async (): Promise<MyAttendance> => (await axiosInstance.post(R.breakEnd, {})).data;
export const getAttendanceRecords = async (params: Record<string, unknown>): Promise<Paginated<AttendanceRecord>> => (await axiosInstance.get(R.records, { params })).data;
export const getAttendanceBoard = async (params: { date?: string; team_id?: string }): Promise<AttendanceBoard> => (await axiosInstance.get(R.board, { params })).data;
export const approveOvertime = async (id: string) => (await axiosInstance.post(R.approveOvertime(id))).data;
export const addManualAttendance = async (dto: { employee_id: string; clock_in_at: string; clock_out_at: string; reason: string }) => (await axiosInstance.post(R.records, dto)).data;
