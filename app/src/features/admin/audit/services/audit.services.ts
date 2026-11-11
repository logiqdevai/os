import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated } from "@/features/admin/teams/interfaces/teams.interfaces";
import type { AuditEvent, AuditEventDetail, AuditEventType } from "../interfaces/audit.interfaces";

const R = ApiRoutes.admin.audit;

export const getAuditEvents = async (params: Record<string, unknown>): Promise<Paginated<AuditEvent>> => (await axiosInstance.get(R.list, { params })).data;
export const getAuditEvent = async (id: string): Promise<AuditEventDetail> => (await axiosInstance.get(R.detail(id))).data;
export const getAuditEventTypes = async (): Promise<AuditEventType[]> => (await axiosInstance.get(R.types)).data;
