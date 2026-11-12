import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as service from "../services/employees.services";

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

function useMutate<A, R>(fn: (a: A) => Promise<R>) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: PEOPLE_KEY }) });
}

export const useCreateEmployee = () => useMutate(service.createEmployee);
export const useUpdateEmployee = () => useMutate(service.updateEmployee);
export const useArchiveEmployee = () => useMutate(service.archiveEmployee);
export const useCompleteOnboarding = () => useMutate(service.completeOnboarding);
export const useStartOffboarding = () => useMutate(service.startOffboarding);
export const useCompleteOffboarding = () => useMutate(service.completeOffboarding);
export const useSetAvailability = () => useMutate(service.setAvailability);
export const useAddCompensation = () => useMutate(service.addCompensation);
export const useAddEquipment = () => useMutate(service.addEquipment);
export const useUpdateEquipment = () => useMutate(service.updateEquipment);
export const useAddDocument = () => useMutate(service.addDocument);
export const useUpdateDocument = () => useMutate(service.updateDocument);
export const useAddHrNote = () => useMutate(service.addHrNote);
export const useRemoveHrNote = () => useMutate(service.removeHrNote);
export const useAddEmergencyContact = () => useMutate(service.addEmergencyContact);
export const useRemoveEmergencyContact = () => useMutate(service.removeEmergencyContact);
export const useSetWorkSchedule = () => useMutate(service.setWorkSchedule);
export const useDecideChangeRequest = () => useMutate(service.decideChangeRequest);
export const useDownloadEmployeesCsv = () => useMutation({ mutationFn: service.downloadEmployeesCsv });
export const useStartChecklist = () => useMutate(service.startChecklist);
export const useSetChecklistItem = () => useMutate(service.setChecklistItem);
