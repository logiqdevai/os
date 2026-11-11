import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PEOPLE_KEY } from "@/features/people/employees/hooks/use-employees";
import * as service from "../services/skills.services";

const KEY = [...PEOPLE_KEY, "skills"] as const;

export const useSkills = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getSkills(params), placeholderData: keepPreviousData, enabled });
export const useSkillSearch = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "search", params], queryFn: () => service.searchPeopleBySkill(params), placeholderData: keepPreviousData, enabled });
export const useEmployeeSkills = (employeeId: string | undefined, enabled = true) =>
    useQuery({ queryKey: [...KEY, "employee", employeeId], queryFn: () => service.getEmployeeSkills(employeeId as string), enabled: !!employeeId && enabled });

function useMutate<A, R>(fn: (a: A) => Promise<R>) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: PEOPLE_KEY }) });
}
export const useCreateSkill = () => useMutate(service.createSkill);
export const useArchiveSkill = () => useMutate(service.archiveSkill);
export const useAssignSkill = () => useMutate(service.assignSkill);
export const useRemoveEmployeeSkill = () => useMutate(service.removeEmployeeSkill);
export const useVerifyEmployeeSkill = () => useMutate(service.verifyEmployeeSkill);
export const useAddCertification = () => useMutate(service.addCertification);
export const useRemoveCertification = () => useMutate(service.removeCertification);
