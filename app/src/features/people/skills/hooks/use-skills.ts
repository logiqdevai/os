import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PEOPLE_KEY, usePeopleMutation } from "@/features/people/employees/hooks/use-employees";
import { patchEntity, useEntityRemove, useOptimisticMutation } from "@/lib/query/optimistic";
import * as service from "../services/skills.services";

const KEY = [...PEOPLE_KEY, "skills"] as const;

export const useSkills = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getSkills(params), placeholderData: keepPreviousData, enabled });
export const useSkillSearch = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "search", params], queryFn: () => service.searchPeopleBySkill(params), placeholderData: keepPreviousData, enabled });
export const useEmployeeSkills = (employeeId: string | undefined, enabled = true) =>
    useQuery({ queryKey: [...KEY, "employee", employeeId], queryFn: () => service.getEmployeeSkills(employeeId as string), enabled: !!employeeId && enabled });

const useMutate = usePeopleMutation;
const meta = (errorTitle: string) => ({ errorTitle });
export const useCreateSkill = () => useMutate(service.createSkill, "Could not create the skill");
/** Optimistic: the skill disappears from the catalog at once. */
export const useArchiveSkill = () => useEntityRemove({ root: KEY, mutationFn: service.archiveSkill, alsoInvalidate: [PEOPLE_KEY], meta: meta("Could not archive the skill") });
export const useAssignSkill = () => useMutate(service.assignSkill, "Could not add the skill");
/** Optimistic: the skill disappears from the profile at once. */
export const useRemoveEmployeeSkill = () => useEntityRemove({ root: KEY, mutationFn: service.removeEmployeeSkill, alsoInvalidate: [PEOPLE_KEY], meta: meta("Could not remove the skill") });
/** Optimistic: the Verified badge shows at once. */
export const useVerifyEmployeeSkill = () =>
    useOptimisticMutation({ roots: [KEY], alsoInvalidate: [PEOPLE_KEY], mutationFn: service.verifyEmployeeSkill, meta: meta("Could not verify the skill"), apply: (qc, id) => patchEntity(qc, KEY, id, { verified_at: new Date().toISOString() }) });
export const useAddCertification = () => useMutate(service.addCertification, "Could not add the certification");
/** Optimistic: the certification disappears at once. */
export const useRemoveCertification = () => useEntityRemove({ root: KEY, mutationFn: service.removeCertification, alsoInvalidate: [PEOPLE_KEY], meta: meta("Could not remove the certification") });
