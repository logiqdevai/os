import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PEOPLE_KEY } from "@/features/people/employees/hooks/use-employees";
import * as service from "../services/performance.services";
import { patchEntity, useOptimisticMutation } from "@/lib/query/optimistic";
import type { ImprovementPlan } from "../interfaces/performance.interfaces";

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

function useMutate<A, R>(fn: (a: A) => Promise<R>, errorTitle: string, errorToast = true) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, meta: { errorTitle, errorToast }, onSettled: () => qc.invalidateQueries({ queryKey: KEY }) });
}
const meta = (errorTitle: string) => ({ errorTitle });
export const useCreateCycle = () => useMutate(service.createCycle, "Could not create the review cycle");
export const useLaunchCycle = () => useMutate(service.launchCycle, "Could not launch the cycle");
/** `errorToast: false` for the autosaving review drafts (their <SaveStatus /> shows the failure). */
export const useUpdateReview = (errorToast = true) => useMutate(service.updateReview, "Could not save the review", errorToast);
export const useReviewAction = () => useMutate(service.reviewAction, "Could not update the review");
export const useCreateGoal = () => useMutate(service.createGoal, "Could not create the goal");
export const useAddGoalUpdate = () => useMutate(service.addGoalUpdate, "Could not post the update");
export const useAddFeedback = () => useMutate(service.addFeedback, "Could not send the feedback");
export const useCreatePlan = () => useMutate(service.createPlan, "Could not create the plan");
export const useActivatePlan = () => useMutate(service.activatePlan, "Could not activate the plan");
export const useClosePlan = () => useMutate(service.closePlan, "Could not close the plan");
export const useAddPlanItem = () => useMutate(service.addPlanItem, "Could not add the item");
/** Optimistic: the item's status / note change at once. */
export const useUpdatePlanItem = () =>
    useOptimisticMutation({
        roots: [KEY],
        mutationFn: service.updatePlanItem,
        meta: meta("Could not update the item"),
        apply: (qc, { id, itemId, ...patch }) => patchEntity<ImprovementPlan>(qc, KEY, id, (p) => ({ ...p, items: p.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) })),
    });
export const useCreateFeedbackRequests = () => useMutate(service.createFeedbackRequests, "Could not request feedback");
export const useSubmitFeedbackRequest = () => useMutate(service.submitFeedbackRequest, "Could not submit the feedback");
/** Optimistic: the request shows Declined / Cancelled at once. */
export const useDeclineFeedbackRequest = () =>
    useOptimisticMutation({ roots: [KEY], mutationFn: service.declineFeedbackRequest, meta: meta("Could not decline the request"), apply: (qc, v) => patchEntity(qc, KEY, v.id, { status: "DECLINED" }) });
export const useCancelFeedbackRequest = () =>
    useOptimisticMutation({ roots: [KEY], mutationFn: service.cancelFeedbackRequest, meta: meta("Could not cancel the request"), apply: (qc, id) => patchEntity(qc, KEY, id, { status: "CANCELLED" }) });
export const useCalibrateReview = () => useMutate(service.calibrateReview, "Could not calibrate the review");
