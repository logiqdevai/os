import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated } from "@/features/admin/teams/interfaces/teams.interfaces";
import type { AccessReview, AccessReviewDetail, AccessReviewItem, ApplyResult, CreateAccessReviewDto, DecideItemDto } from "../interfaces/access-reviews.interfaces";

const R = () => ApiRoutes.admin.accessReviews;

export const getAccessReviews = async (params: Record<string, unknown>): Promise<Paginated<AccessReview>> => (await axiosInstance.get(R().list, { params })).data;
export const getAccessReview = async (id: string): Promise<AccessReviewDetail> => (await axiosInstance.get(R().detail(id))).data;
export const getAccessReviewItems = async (id: string, params: Record<string, unknown>): Promise<Paginated<AccessReviewItem>> => (await axiosInstance.get(R().items(id), { params })).data;
export const createAccessReview = async (dto: CreateAccessReviewDto): Promise<AccessReviewDetail> => (await axiosInstance.post(R().list, dto)).data;
export const startAccessReview = async (id: string): Promise<AccessReviewDetail> => (await axiosInstance.post(R().start(id))).data;
export const applyAccessReview = async (id: string): Promise<ApplyResult> => (await axiosInstance.post(R().apply(id))).data;
export const completeAccessReview = async (id: string): Promise<AccessReviewDetail> => (await axiosInstance.post(R().complete(id))).data;
export const cancelAccessReview = async (id: string): Promise<AccessReviewDetail> => (await axiosInstance.post(R().cancel(id))).data;
export const decideAccessReviewItem = async ({ itemId, ...dto }: DecideItemDto & { itemId: string }): Promise<AccessReviewItem> => (await axiosInstance.patch(R().item(itemId), dto)).data;
export const reassignAccessReviewItem = async ({ itemId, reviewer_membership_id }: { itemId: string; reviewer_membership_id: string }): Promise<AccessReviewItem> =>
    (await axiosInstance.post(R().reassign(itemId), { reviewer_membership_id })).data;
