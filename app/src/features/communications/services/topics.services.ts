import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated, CommConsentStatus } from "../interfaces/communications.interfaces";
import type { CommTopic, CommTopicInput, ContactTopicSubscriptions } from "../interfaces/topics.interfaces";

const R = ApiRoutes.communications.topics;

export const getTopics = async (params: Record<string, unknown>): Promise<Paginated<CommTopic>> => (await axiosInstance.get(R.list, { params })).data;
export const createTopic = async (dto: CommTopicInput): Promise<CommTopic> => (await axiosInstance.post(R.list, dto)).data;
export const updateTopic = async ({ id, ...dto }: Partial<CommTopicInput> & { id: string }): Promise<CommTopic> => (await axiosInstance.patch(R.detail(id), dto)).data;
export const topicAction = async ({ id, action }: { id: string; action: "archive" | "restore" }): Promise<CommTopic> => (await axiosInstance.post(R.action(id, action))).data;
export const deleteTopic = async (id: string) => (await axiosInstance.delete(R.detail(id))).data;
export const getContactTopics = async (contactId: string): Promise<ContactTopicSubscriptions> => (await axiosInstance.get(R.contact(contactId))).data;
export const setContactTopics = async ({ contactId, subscriptions }: { contactId: string; subscriptions: { topic_id: string; status: CommConsentStatus }[] }): Promise<ContactTopicSubscriptions> =>
    (await axiosInstance.put(R.contact(contactId), { subscriptions })).data;
