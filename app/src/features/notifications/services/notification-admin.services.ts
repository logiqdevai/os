import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated } from "../interfaces/notifications.interfaces";
import type {
    DefaultsResponse, DeliveryDetail, DeliveryList, DeliveryRule, DeliveryRuleDto, DigestRow, EventLogRow, EventTypeDetail, EventTypeDto, EventTypeList, EventTypeRow, OrgDefault, OrgDefaultDto,
    OrgSettings, OrgSettingsDto, TemplateDetail, TemplateDto, TemplatePreview, TemplateRow,
} from "../interfaces/notification-admin.interfaces";

const R = ApiRoutes.notifications.admin;
type Params = Record<string, unknown>;

export const getEventTypes = async (params: Params): Promise<EventTypeList> => (await axiosInstance.get(R.eventTypes, { params })).data;
export const getEventType = async (id: string): Promise<EventTypeDetail> => (await axiosInstance.get(R.eventType(id))).data;
export const createEventType = async (dto: EventTypeDto): Promise<EventTypeRow> => (await axiosInstance.post(R.eventTypes, dto)).data;
export const updateEventType = async ({ id, ...dto }: EventTypeDto & { id: string }): Promise<EventTypeRow> => (await axiosInstance.patch(R.eventType(id), dto)).data;
export const deprecateEventType = async (id: string): Promise<EventTypeRow> => (await axiosInstance.post(R.eventTypeDeprecate(id))).data;

export const getTemplates = async (params: Params): Promise<Paginated<TemplateRow>> => (await axiosInstance.get(R.templates, { params })).data;
export const getTemplate = async (id: string): Promise<TemplateDetail> => (await axiosInstance.get(R.template(id))).data;
export const createTemplate = async (dto: TemplateDto): Promise<TemplateRow> => (await axiosInstance.post(R.templates, dto)).data;
export const updateTemplate = async ({ id, ...dto }: Partial<TemplateDto> & { id: string }): Promise<TemplateRow> => (await axiosInstance.patch(R.template(id), dto)).data;
export const deleteTemplate = async (id: string) => (await axiosInstance.delete(R.template(id))).data;
export const restoreTemplateVersion = async ({ id, version }: { id: string; version: number }): Promise<TemplateRow> => (await axiosInstance.post(R.templateRestore(id, version))).data;
export const previewTemplate = async (dto: { subject?: string | null; title: string; body: string; cta_label?: string | null }): Promise<TemplatePreview> => (await axiosInstance.post(R.templatePreview, dto)).data;

export const getDefaults = async (): Promise<DefaultsResponse> => (await axiosInstance.get(R.defaults)).data;
export const setDefault = async (dto: OrgDefaultDto): Promise<OrgDefault> => (await axiosInstance.put(R.defaults, dto)).data;
export const removeDefault = async (id: string) => (await axiosInstance.delete(R.default(id))).data;

export const getRules = async (): Promise<DeliveryRule[]> => (await axiosInstance.get(R.rules)).data;
export const createRule = async (dto: DeliveryRuleDto): Promise<DeliveryRule> => (await axiosInstance.post(R.rules, dto)).data;
export const updateRule = async ({ id, ...dto }: DeliveryRuleDto & { id: string }): Promise<DeliveryRule> => (await axiosInstance.patch(R.rule(id), dto)).data;
export const deleteRule = async (id: string) => (await axiosInstance.delete(R.rule(id))).data;

export const getDeliveries = async (params: Params): Promise<DeliveryList> => (await axiosInstance.get(R.deliveries, { params })).data;
export const getDelivery = async (id: string): Promise<DeliveryDetail> => (await axiosInstance.get(R.delivery(id))).data;
export const retryDelivery = async (id: string) => (await axiosInstance.post(R.deliveryRetry(id))).data;
export const getEventLog = async (params: Params): Promise<Paginated<EventLogRow>> => (await axiosInstance.get(R.events, { params })).data;
export const getDigests = async (params: Params): Promise<Paginated<DigestRow>> => (await axiosInstance.get(R.digests, { params })).data;

export const getOrgSettings = async (): Promise<OrgSettings> => (await axiosInstance.get(R.settings)).data;
export const updateOrgSettings = async (dto: OrgSettingsDto): Promise<OrgSettings> => (await axiosInstance.patch(R.settings, dto)).data;
