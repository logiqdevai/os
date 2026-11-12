import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as service from "../services/employees.services";
import { patchEntity, removeEntity, useEntityRemove, useEntityUpdate, useOptimisticMutation } from "@/lib/query/optimistic";
import type { EmployeeChecklistRun } from "../interfaces/employees.interfaces";

/** Root key of the People area: writes refresh everything under it (profiles, lists, dashboard). */
export const PEOPLE_KEY = ["people"] as const;
const KEY = [...PEOPLE_KEY, "employees"] as const;

export const useEmployees = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getEmployees(params), placeholderData: keepPreviousData, enabled });
export const useEmployee = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getEmployee(id as string), enabled: !!id });
export const useMyEmployee = (enabled = true) => useQuery({ queryKey: [...KEY, "me"], queryFn: service.getMyEmployee, enabled, retry: false, staleTime: 60_000 });
export const useDirectory = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "directory", params], queryFn: () => service.getDirectory(params), placeholderData: keepPreviousData, enabled });
export const useOrgChart = (enabled = true) => useQuery({ queryKey: [...KEY, "org-chart"], queryFn: service.getOrgChart, enabled });
export const useCandidates = (search: string, enabled = true) => useQuery({ queryKey: [...KEY, "candidates", search], queryFn: () => service.getCandidates(search), enabled });
export const useCompensation = (id: string | undefined, enabled = true) =>
    useQuery({ queryKey: [...KEY, "compensation", id], queryFn: () => service.getCompensation(id as string), enabled: !!id && enabled });
export const useChangeRequests = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "change-requests", params], queryFn: () => service.getChangeRequests(params), placeholderData: keepPreviousData, enabled });

export const useChecklistRuns = (id: string | undefined, enabled = true) =>
    useQuery({ queryKey: [...KEY, "checklist-runs", id], queryFn: () => service.getChecklistRuns(id as string), enabled: !!id && enabled });
export const useAvailableChecklists = (kind: "ONBOARDING" | "OFFBOARDING", enabled = true) =>
    useQuery({ queryKey: [...KEY, "available-checklists", kind], queryFn: () => service.getAvailableChecklists(kind), enabled });

/**
 * People mutation: refreshes everything under PEOPLE_KEY when it settles. No success toast (the UI shows the result);
 * a failure is toasted once by the global MutationCache with `errorTitle` (unless `errorToast` is false because the
 * form shows the error inline).
 */
export function usePeopleMutation<A, R>(fn: (a: A) => Promise<R>, errorTitle: string, errorToast = true) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, meta: { errorTitle, errorToast }, onSettled: () => qc.invalidateQueries({ queryKey: PEOPLE_KEY }) });
}
const useMutate = usePeopleMutation;
const meta = (errorTitle: string) => ({ errorTitle });

export const useCreateEmployee = () => useMutate(service.createEmployee, "Could not create the employee");
/** Optimistic: profile fields change at once in every list and detail; `optimistic` carries display objects for id fields. */
export const useUpdateEmployee = () => useEntityUpdate({ root: PEOPLE_KEY, mutationFn: service.updateEmployee, meta: meta("Could not update the employee") });
/** Optimistic: the employee leaves every list at once and comes back if the API refuses. */
export const useArchiveEmployee = () => useEntityRemove({ root: PEOPLE_KEY, mutationFn: service.archiveEmployee, meta: meta("Could not archive the employee") });
export const useCompleteOnboarding = () => useMutate(service.completeOnboarding, "Could not complete onboarding");
export const useStartOffboarding = () => useMutate(service.startOffboarding, "Could not start offboarding");
export const useCompleteOffboarding = () => useMutate(service.completeOffboarding, "Could not complete offboarding");
/** Optimistic: the availability badge changes at once. */
export const useSetAvailability = () =>
    useOptimisticMutation({
        roots: [PEOPLE_KEY],
        mutationFn: service.setAvailability,
        meta: meta("Could not set availability"),
        apply: (qc, v) => patchEntity(qc, PEOPLE_KEY, v.id, { availability_status: v.status, availability_note: v.note ?? null }),
    });
export const useAddCompensation = () => useMutate(service.addCompensation, "Could not add the compensation record");
export const useAddEquipment = () => useMutate(service.addEquipment, "Could not add the equipment");
/** Optimistic: the equipment row changes at once (e.g. marked returned). */
export const useUpdateEquipment = () =>
    useOptimisticMutation({
        roots: [PEOPLE_KEY],
        mutationFn: service.updateEquipment,
        meta: meta("Could not update the equipment"),
        apply: (qc, { id: _id, itemId, ...patch }) => patchEntity(qc, PEOPLE_KEY, itemId, patch),
    });
export const useAddDocument = () => useMutate(service.addDocument, "Could not add the document");
/** Optimistic: the document row changes at once (status, visibility…). */
export const useUpdateDocument = () =>
    useOptimisticMutation({
        roots: [PEOPLE_KEY],
        mutationFn: service.updateDocument,
        meta: meta("Could not update the document"),
        apply: (qc, { id: _id, documentId, ...patch }) => patchEntity(qc, PEOPLE_KEY, documentId, patch),
    });
export const useAddHrNote = () => useMutate(service.addHrNote, "Could not add the note");
/** Optimistic: the note disappears at once. */
export const useRemoveHrNote = () =>
    useOptimisticMutation({ roots: [PEOPLE_KEY], mutationFn: service.removeHrNote, meta: meta("Could not remove the note"), apply: (qc, v) => removeEntity(qc, PEOPLE_KEY, v.noteId) });
export const useAddEmergencyContact = () => useMutate(service.addEmergencyContact, "Could not add the contact");
/** Optimistic: the contact disappears at once. */
export const useRemoveEmergencyContact = () =>
    useOptimisticMutation({ roots: [PEOPLE_KEY], mutationFn: service.removeEmergencyContact, meta: meta("Could not remove the contact"), apply: (qc, v) => removeEntity(qc, PEOPLE_KEY, v.contactId) });
export const useSetWorkSchedule = () => useMutate(service.setWorkSchedule, "Could not save the work schedule");
/** Optimistic: the request shows Approved / Rejected at once. */
export const useDecideChangeRequest = () =>
    useOptimisticMutation({
        roots: [PEOPLE_KEY],
        mutationFn: service.decideChangeRequest,
        meta: meta("Could not decide the change request"),
        apply: (qc, v) => patchEntity(qc, [...KEY, "change-requests"], v.id, { status: v.approve ? "APPROVED" : "REJECTED", decision_note: v.decision_note ?? null }),
    });
export const useDownloadEmployeesCsv = () => useMutation({ mutationFn: service.downloadEmployeesCsv, meta: meta("Could not export employees") });
export const useStartChecklist = () => useMutate(service.startChecklist, "Could not start the checklist");
/** Optimistic: the checkbox and the run's progress change at once. */
export const useSetChecklistItem = () =>
    useOptimisticMutation({
        roots: [[...KEY, "checklist-runs"]],
        alsoInvalidate: [PEOPLE_KEY],
        mutationFn: service.setChecklistItem,
        meta: meta("Could not update the checklist"),
        apply: (qc, v) =>
            qc.setQueriesData<EmployeeChecklistRun[]>({ queryKey: [...KEY, "checklist-runs", v.id] }, (runs) =>
                runs?.map((run) => {
                    if (run.id !== v.runId) return run;
                    const items = run.items.map((i) =>
                        i.id === v.itemId ? { ...i, status: v.done ? ("COMPLETED" as const) : ("PENDING" as const), completed_at: v.done ? new Date().toISOString() : null } : i,
                    );
                    const done_count = items.filter((i) => i.status === "COMPLETED" || i.status === "SKIPPED").length;
                    return { ...run, items, done_count, progress_percent: run.total_count ? Math.round((done_count / run.total_count) * 100) : 0 };
                }),
            ),
    });
