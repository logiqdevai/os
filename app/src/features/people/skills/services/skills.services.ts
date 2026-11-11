import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated } from "@/features/people/employees/interfaces/employees.interfaces";
import type { Certification, EmployeeSkill, Skill, SkillCategory, SkillMatch, SkillProficiency } from "../interfaces/skills.interfaces";

const R = ApiRoutes.people.skills;

export const getSkills = async (params: Record<string, unknown>): Promise<Paginated<Skill>> => (await axiosInstance.get(R.list, { params })).data;
export const searchPeopleBySkill = async (params: Record<string, unknown>): Promise<Paginated<SkillMatch>> => (await axiosInstance.get(R.search, { params })).data;
export const createSkill = async (dto: { name: string; category?: SkillCategory; description?: string }): Promise<Skill> => (await axiosInstance.post(R.list, dto)).data;
export const archiveSkill = async (id: string) => (await axiosInstance.post(R.archive(id))).data;
export const getEmployeeSkills = async (employeeId: string): Promise<{ skills: EmployeeSkill[]; certifications: Certification[] }> =>
    (await axiosInstance.get(ApiRoutes.people.employees.skills(employeeId))).data;
export const assignSkill = async ({ employeeId, ...dto }: { employeeId: string; skill_id: string; proficiency?: SkillProficiency; is_primary?: boolean; years_experience?: number }) =>
    (await axiosInstance.post(ApiRoutes.people.employees.skills(employeeId), dto)).data;
export const removeEmployeeSkill = async (id: string) => (await axiosInstance.delete(R.employeeSkill(id))).data;
export const verifyEmployeeSkill = async (id: string) => (await axiosInstance.post(R.verify(id))).data;
export const addCertification = async ({ employeeId, ...dto }: { employeeId: string; name: string; issuer?: string; issued_on?: string; expires_on?: string }) =>
    (await axiosInstance.post(ApiRoutes.people.employees.certifications(employeeId), dto)).data;
export const removeCertification = async (id: string) => (await axiosInstance.delete(R.certification(id))).data;
