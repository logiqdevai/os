import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated } from "@/features/people/employees/interfaces/employees.interfaces";
import type { Feedback, FeedbackKind, FeedbackVisibility, Goal, GoalStatus, Review, ReviewCycle, ReviewType } from "../interfaces/performance.interfaces";

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
