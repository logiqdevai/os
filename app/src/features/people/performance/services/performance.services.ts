import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated } from "@/features/people/employees/interfaces/employees.interfaces";
import type {
    CalibrationView, Feedback, FeedbackKind, FeedbackRequest, FeedbackVisibility, Goal, GoalStatus, ImprovementPlan, PipDto, PipItemStatus, Review, ReviewCycle, ReviewType,
} from "../interfaces/performance.interfaces";

const R = ApiRoutes.people.performance;

export const getCycles = async (params: Record<string, unknown>): Promise<Paginated<ReviewCycle>> => (await axiosInstance.get(R.cycles, { params })).data;
export const createCycle = async (dto: { name: string; type?: ReviewType; period_start: string; period_end: string; due_date?: string }): Promise<ReviewCycle> =>
    (await axiosInstance.post(R.cycles, dto)).data;
export const launchCycle = async (id: string): Promise<{ launched: number }> => (await axiosInstance.post(R.launch(id), {})).data;
export const getReviews = async (params: Record<string, unknown>): Promise<Paginated<Review>> => (await axiosInstance.get(R.reviews, { params })).data;
export const getReview = async (id: string): Promise<Review> => (await axiosInstance.get(R.review(id))).data;
export const updateReview = async ({ id, ...dto }: Partial<Pick<Review, "self_assessment" | "manager_assessment" | "strengths" | "improvement_areas" | "summary" | "employee_comment">> & { id: string; ratings?: Record<string, number>; overall_rating?: number }) =>
    (await axiosInstance.patch(R.review(id), dto)).data;
export const reviewAction = async ({ id, action }: { id: string; action: "submit-self" | "submit" | "complete" | "acknowledge" }) => (await axiosInstance.post(R.reviewAction(id, action))).data;
export const getGoals = async (params: Record<string, unknown>): Promise<Paginated<Goal>> => (await axiosInstance.get(R.goals, { params })).data;
export const createGoal = async (dto: { employee_id: string; title: string; description?: string; due_date?: string; target_value?: number; unit?: string }): Promise<Goal> =>
    (await axiosInstance.post(R.goals, dto)).data;
export const addGoalUpdate = async ({ id, ...dto }: { id: string; progress_percent?: number; status?: GoalStatus; note?: string }) => (await axiosInstance.post(R.goalUpdates(id), dto)).data;
export const getFeedback = async (params: Record<string, unknown>): Promise<Paginated<Feedback>> => (await axiosInstance.get(R.feedback, { params })).data;
export const addFeedback = async (dto: { employee_id: string; kind: FeedbackKind; visibility?: FeedbackVisibility; title?: string; body: string }): Promise<Feedback> =>
    (await axiosInstance.post(R.feedback, dto)).data;

export const getPlans = async (params: Record<string, unknown>): Promise<Paginated<ImprovementPlan>> => (await axiosInstance.get(R.plans, { params })).data;
export const createPlan = async (dto: PipDto): Promise<ImprovementPlan> => (await axiosInstance.post(R.plans, dto)).data;
export const activatePlan = async (id: string): Promise<ImprovementPlan> => (await axiosInstance.post(R.planAction(id, "activate"))).data;
export const closePlan = async ({ id, ...dto }: { id: string; outcome: "COMPLETED_SUCCESSFUL" | "COMPLETED_UNSUCCESSFUL" | "CANCELLED"; outcome_note: string }): Promise<ImprovementPlan> =>
    (await axiosInstance.post(R.planAction(id, "close"), dto)).data;
export const addPlanItem = async ({ id, ...dto }: { id: string; title: string; due_date?: string }): Promise<ImprovementPlan> => (await axiosInstance.post(R.planItems(id), dto)).data;
export const updatePlanItem = async ({ id, itemId, ...dto }: { id: string; itemId: string; status?: PipItemStatus; note?: string }): Promise<ImprovementPlan> =>
    (await axiosInstance.patch(R.planItem(id, itemId), dto)).data;
export const getFeedbackRequests = async (params: Record<string, unknown>): Promise<Paginated<FeedbackRequest>> => (await axiosInstance.get(R.requests, { params })).data;
export const createFeedbackRequests = async (dto: { employee_id: string; requested_from_membership_ids: string[]; due_date?: string; message?: string; is_anonymous?: boolean }): Promise<{ created: number; already_pending: number }> =>
    (await axiosInstance.post(R.requests, dto)).data;
export const submitFeedbackRequest = async ({ id, ...dto }: { id: string; body: string; rating?: number }) => (await axiosInstance.post(R.requestAction(id, "submit"), dto)).data;
export const declineFeedbackRequest = async ({ id, reason }: { id: string; reason?: string }) => (await axiosInstance.post(R.requestAction(id, "decline"), { reason })).data;
export const cancelFeedbackRequest = async (id: string) => (await axiosInstance.post(R.requestAction(id, "cancel"))).data;
export const getCalibration = async (cycleId: string): Promise<CalibrationView> => (await axiosInstance.get(R.calibration(cycleId))).data;
export const calibrateReview = async ({ id, ...dto }: { id: string; calibrated_rating: number; reason: string }) => (await axiosInstance.post(R.calibrate(id), dto)).data;
