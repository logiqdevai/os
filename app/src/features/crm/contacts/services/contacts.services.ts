import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { downloadCsv } from "../../common/services/crm-download.services";
import type { Paginated } from "../../common/interfaces/crm-common.interfaces";
import type { Contact, ContactDetail, ContactLookupItem, CreateContactDto, UpdateContactDto } from "../interfaces/contacts.interfaces";

const R = () => ApiRoutes.crm.contacts;

export const getContacts = async (params: Record<string, unknown>): Promise<Paginated<Contact>> => (await axiosInstance.get(R().list, { params })).data;
export const lookupContacts = async (params: { search?: string; limit?: number; company_id?: string }): Promise<ContactLookupItem[]> => (await axiosInstance.get(R().lookup, { params })).data;
export const getContact = async (id: string): Promise<ContactDetail> => (await axiosInstance.get(R().detail(id))).data;
export const createContact = async (dto: CreateContactDto): Promise<Contact> => (await axiosInstance.post(R().list, dto)).data;
export const updateContact = async ({ id, ...dto }: UpdateContactDto & { id: string }): Promise<Contact> => (await axiosInstance.patch(R().detail(id), dto)).data;
export const archiveContact = async (id: string): Promise<Contact> => (await axiosInstance.post(R().archive(id))).data;
export const deleteContact = async (id: string) => (await axiosInstance.delete(R().detail(id))).data;
export const exportContacts = (params: Record<string, unknown>) => downloadCsv(R().export, params, "contacts.csv");
