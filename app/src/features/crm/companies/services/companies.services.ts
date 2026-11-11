import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { downloadCsv } from "../../common/services/crm-download.services";
import type { Paginated } from "../../common/interfaces/crm-common.interfaces";
import type { Company, CompanyDetail, CompanyLookupItem, CreateCompanyDto, UpdateCompanyDto } from "../interfaces/companies.interfaces";

const R = () => ApiRoutes.crm.companies;

export const getCompanies = async (params: Record<string, unknown>): Promise<Paginated<Company>> => (await axiosInstance.get(R().list, { params })).data;
export const lookupCompanies = async (params: { search?: string; limit?: number; type?: string }): Promise<CompanyLookupItem[]> => (await axiosInstance.get(R().lookup, { params })).data;
export const getCompany = async (id: string): Promise<CompanyDetail> => (await axiosInstance.get(R().detail(id))).data;
export const createCompany = async (dto: CreateCompanyDto): Promise<Company> => (await axiosInstance.post(R().list, dto)).data;
export const updateCompany = async ({ id, ...dto }: UpdateCompanyDto & { id: string }): Promise<Company> => (await axiosInstance.patch(R().detail(id), dto)).data;
export const archiveCompany = async (id: string): Promise<Company> => (await axiosInstance.post(R().archive(id))).data;
export const restoreCompany = async (id: string): Promise<Company> => (await axiosInstance.post(R().restore(id))).data;
export const deleteCompany = async (id: string) => (await axiosInstance.delete(R().detail(id))).data;
export const exportCompanies = (params: Record<string, unknown>) => downloadCsv(R().export, params, "companies.csv");
