import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PEOPLE_KEY } from "@/features/people/employees/hooks/use-employees";
import * as service from "../services/performance.services";

const KEY = [...PEOPLE_KEY, "performance"] as const;

export const useCycles = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "cycles", params], queryFn: () => service.getCycles(params), placeholderData: keepPreviousData, enabled });
export const useReviews = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "reviews", params], queryFn: () => service.getReviews(params), placeholderData: keepPreviousData, enabled });
export const useReview = (id: string | undefined) => useQuery({ queryKey: [...KEY, "review", id], queryFn: () => service.getReview(id as string), enabled: !!id });
export const useGoals = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "goals", params], queryFn: () => service.getGoals(params), placeholderData: keepPreviousData, enabled });
export const useFeedback = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "feedback", params], queryFn: () => service.getFeedback(params), placeholderData: keepPreviousData, enabled });

export const usePlans = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "plans", params], queryFn: () => service.getPlans(params), placeholderData: keepPreviousData, enabled });
export const useFeedbackRequests = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "requests", params], queryFn: () => service.getFeedbackRequests(params), placeholderData: keepPreviousData, enabled });
export const useCalibration = (cycleId: string | undefined) => useQuery({ queryKey: [...KEY, "calibration", cycleId], queryFn: () => service.getCalibration(cycleId as string), enabled: !!cycleId });

function useMutate<A, R>(fn: (a: A) => Promise<R>) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}
export const useCreateCycle = () => useMutate(service.createCycle);
export const useLaunchCycle = () => useMutate(service.launchCycle);
export const useUpdateReview = () => useMutate(service.updateReview);
export const useReviewAction = () => useMutate(service.reviewAction);
export const useCreateGoal = () => useMutate(service.createGoal);
export const useAddGoalUpdate = () => useMutate(service.addGoalUpdate);
export const useAddFeedback = () => useMutate(service.addFeedback);
export const useCreatePlan = () => useMutate(service.createPlan);
export const useActivatePlan = () => useMutate(service.activatePlan);
export const useClosePlan = () => useMutate(service.closePlan);
export const useAddPlanItem = () => useMutate(service.addPlanItem);
export const useUpdatePlanItem = () => useMutate(service.updatePlanItem);
export const useCreateFeedbackRequests = () => useMutate(service.createFeedbackRequests);
export const useSubmitFeedbackRequest = () => useMutate(service.submitFeedbackRequest);
export const useDeclineFeedbackRequest = () => useMutate(service.declineFeedbackRequest);
export const useCancelFeedbackRequest = () => useMutate(service.cancelFeedbackRequest);
export const useCalibrateReview = () => useMutate(service.calibrateReview);
