import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { CreateNoteDto, CrmNote, NoteEntityType, UpdateNoteDto } from "../interfaces/notes.interfaces";

const R = () => ApiRoutes.crm.notes;

export const getNotes = async (entity_type: NoteEntityType, entity_id: string): Promise<CrmNote[]> => (await axiosInstance.get(R().list, { params: { entity_type, entity_id } })).data;
export const createNote = async (dto: CreateNoteDto): Promise<CrmNote> => (await axiosInstance.post(R().list, dto)).data;
export const updateNote = async ({ id, ...dto }: UpdateNoteDto & { id: string }): Promise<CrmNote> => (await axiosInstance.patch(R().detail(id), dto)).data;
export const deleteNote = async (id: string) => (await axiosInstance.delete(R().detail(id))).data;
