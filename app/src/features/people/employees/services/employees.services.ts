import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    ChangeRequest, Compensation, CompensationDto, CreateEmployeeDto, DirectoryCard, DocumentDto, EmergencyContactDto, Employee, EmployeeDetail, EmployeeDocument,
    Equipment, EquipmentDto, HrNote, HrNoteDto, MemberCandidate, OffboardingDto, OrgChartNode, Paginated, UpdateEmployeeDto, WorkScheduleDto,
} from "../interfaces/employees.interfaces";

const R = ApiRoutes.people.employees;

export const getEmployees = async (params: Record<string, unknown>): Promise<Paginated<Employee>> => (await axiosInstance.get(R.list, { params })).data;
export const getEmployee = async (id: string): Promise<EmployeeDetail> => (await axiosInstance.get(R.detail(id))).data;
export const getMyEmployee = async (): Promise<EmployeeDetail> => (await axiosInstance.get(ApiRoutes.people.me)).data;
export const getDirectory = async (params: Record<string, unknown>): Promise<Paginated<DirectoryCard>> => (await axiosInstance.get(ApiRoutes.people.directory, { params })).data;
export const getOrgChart = async (): Promise<OrgChartNode[]> => (await axiosInstance.get(ApiRoutes.people.orgChart)).data;
export const getCandidates = async (search?: string): Promise<MemberCandidate[]> => (await axiosInstance.get(R.candidates, { params: search ? { search } : undefined })).data;
export const createEmployee = async (dto: CreateEmployeeDto): Promise<EmployeeDetail> => (await axiosInstance.post(R.list, dto)).data;
export const updateEmployee = async ({ id, ...dto }: UpdateEmployeeDto & { id: string }): Promise<EmployeeDetail> => (await axiosInstance.patch(R.detail(id), dto)).data;
export const archiveEmployee = async (id: string) => (await axiosInstance.post(R.archive(id))).data;
export const completeOnboarding = async (id: string) => (await axiosInstance.post(R.onboardingComplete(id))).data;
export const startOffboarding = async ({ id, ...dto }: OffboardingDto & { id: string }) => (await axiosInstance.post(R.offboarding(id), dto)).data;
export const completeOffboarding = async (id: string) => (await axiosInstance.post(R.offboardingComplete(id))).data;
export const setAvailability = async ({ id, ...dto }: { id: string; status: string; note?: string; starts_at?: string; ends_at?: string }) =>
    (await axiosInstance.post(R.availability(id), dto)).data;

export const getCompensation = async (id: string): Promise<Compensation[]> => (await axiosInstance.get(R.compensation(id))).data;
export const addCompensation = async ({ id, ...dto }: CompensationDto & { id: string }) => (await axiosInstance.post(R.compensation(id), dto)).data;
export const addEquipment = async ({ id, ...dto }: EquipmentDto & { id: string }): Promise<Equipment> => (await axiosInstance.post(R.equipment(id), dto)).data;
export const updateEquipment = async ({ id, itemId, ...dto }: Partial<EquipmentDto> & { id: string; itemId: string }): Promise<Equipment> =>
    (await axiosInstance.patch(R.equipmentItem(id, itemId), dto)).data;
export const addDocument = async ({ id, ...dto }: DocumentDto & { id: string }): Promise<EmployeeDocument> => (await axiosInstance.post(R.documents(id), dto)).data;
export const updateDocument = async ({ id, documentId, ...dto }: Partial<DocumentDto> & { id: string; documentId: string }) =>
    (await axiosInstance.patch(R.document(id, documentId), dto)).data;
export const addHrNote = async ({ id, ...dto }: HrNoteDto & { id: string }): Promise<HrNote> => (await axiosInstance.post(R.hrNotes(id), dto)).data;
export const removeHrNote = async ({ id, noteId }: { id: string; noteId: string }) => (await axiosInstance.delete(R.hrNote(id, noteId))).data;
export const addEmergencyContact = async ({ id, ...dto }: EmergencyContactDto & { id: string }) => (await axiosInstance.post(R.emergencyContacts(id), dto)).data;
export const removeEmergencyContact = async ({ id, contactId }: { id: string; contactId: string }) => (await axiosInstance.delete(R.emergencyContact(id, contactId))).data;
export const setWorkSchedule = async ({ id, ...dto }: WorkScheduleDto & { id: string }) => (await axiosInstance.put(R.workSchedule(id), dto)).data;

export const getChangeRequests = async (params: Record<string, unknown>): Promise<Paginated<ChangeRequest>> => (await axiosInstance.get(ApiRoutes.people.changeRequests.list, { params })).data;
export const decideChangeRequest = async ({ id, approve, decision_note }: { id: string; approve: boolean; decision_note?: string }) =>
    (await axiosInstance.post(approve ? ApiRoutes.people.changeRequests.approve(id) : ApiRoutes.people.changeRequests.reject(id), { decision_note })).data;

/** Downloads the employee CSV export (sensitive, audited by the API). */
export async function downloadEmployeesCsv(params: Record<string, unknown>) {
    const res = await axiosInstance.get(R.export, { params, responseType: "blob" });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employees.csv";
    a.click();
    URL.revokeObjectURL(url);
}
