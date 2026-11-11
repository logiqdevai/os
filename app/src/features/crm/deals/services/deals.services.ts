import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { downloadCsv } from "../../common/services/crm-download.services";
import type { ChangeStageDto, CreateDealDto, Deal, DealBoard, DealDetail, DealList, LineItemInput, UpdateDealDto } from "../interfaces/deals.interfaces";

const R = () => ApiRoutes.crm.deals;

export const getDeals = async (params: Record<string, unknown>): Promise<DealList> => (await axiosInstance.get(R().list, { params })).data;
export const getDealBoard = async (params: Record<string, unknown>): Promise<DealBoard> => (await axiosInstance.get(R().board, { params })).data;
export const getDeal = async (id: string): Promise<DealDetail> => (await axiosInstance.get(R().detail(id))).data;
export const createDeal = async (dto: CreateDealDto): Promise<Deal> => (await axiosInstance.post(R().list, dto)).data;
export const updateDeal = async ({ id, ...dto }: UpdateDealDto & { id: string }): Promise<Deal> => (await axiosInstance.patch(R().detail(id), dto)).data;
export const changeDealStage = async ({ id, ...dto }: ChangeStageDto & { id: string }): Promise<DealDetail> => (await axiosInstance.post(R().stage(id), dto)).data;
export const reopenDeal = async ({ id, stage_id }: { id: string; stage_id?: string }): Promise<DealDetail> => (await axiosInstance.post(R().reopen(id), { stage_id })).data;
export const assignDeal = async ({ id, owner_membership_id }: { id: string; owner_membership_id: string }): Promise<Deal> =>
    (await axiosInstance.post(R().assign(id), { owner_membership_id })).data;
export const replaceLineItems = async ({ id, items, discount_percent }: { id: string; items: LineItemInput[]; discount_percent?: number }): Promise<DealDetail> =>
    (await axiosInstance.put(R().line_items(id), { items, discount_percent })).data;
export const addDealContact = async ({ id, contact_id, role }: { id: string; contact_id: string; role?: string }) => (await axiosInstance.post(R().contacts(id), { contact_id, role })).data;
export const removeDealContact = async ({ id, contact_id }: { id: string; contact_id: string }) => (await axiosInstance.delete(R().contact(id, contact_id))).data;
export const archiveDeal = async (id: string): Promise<Deal> => (await axiosInstance.post(R().archive(id))).data;
export const deleteDeal = async (id: string) => (await axiosInstance.delete(R().detail(id))).data;
export const exportDeals = (params: Record<string, unknown>) => downloadCsv(R().export, params, "deals.csv");
