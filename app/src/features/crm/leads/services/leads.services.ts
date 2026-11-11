import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { downloadCsv } from "../../common/services/crm-download.services";
import type { Paginated } from "../../common/interfaces/crm-common.interfaces";
import type { ConvertLeadDto, ConvertPreview, ConvertResult, CreateLeadDto, Lead, LeadDetail, UpdateLeadDto } from "../interfaces/leads.interfaces";

const R = () => ApiRoutes.crm.leads;

export const getLeads = async (params: Record<string, unknown>): Promise<Paginated<Lead>> => (await axiosInstance.get(R().list, { params })).data;
export const getLead = async (id: string): Promise<LeadDetail> => (await axiosInstance.get(R().detail(id))).data;
export const createLead = async (dto: CreateLeadDto): Promise<Lead> => (await axiosInstance.post(R().list, dto)).data;
export const updateLead = async ({ id, ...dto }: UpdateLeadDto & { id: string }): Promise<Lead> => (await axiosInstance.patch(R().detail(id), dto)).data;
export const setLeadStatus = async ({ id, ...dto }: { id: string; status_id: string; lost_reason_id?: string; lost_reason?: string }): Promise<LeadDetail> =>
    (await axiosInstance.post(R().status(id), dto)).data;
export const getConvertPreview = async (id: string): Promise<ConvertPreview> => (await axiosInstance.get(R().convert_preview(id))).data;
export const convertLead = async ({ id, ...dto }: ConvertLeadDto & { id: string }): Promise<ConvertResult> => (await axiosInstance.post(R().convert(id), dto)).data;
export const archiveLead = async (id: string): Promise<Lead> => (await axiosInstance.post(R().archive(id))).data;
export const deleteLead = async (id: string) => (await axiosInstance.delete(R().detail(id))).data;
export const exportLeads = (params: Record<string, unknown>) => downloadCsv(R().export, params, "leads.csv");
