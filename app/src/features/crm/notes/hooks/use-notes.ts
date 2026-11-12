import { useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmMutation, useCrmRemove, useCrmUpdate } from "../../common/hooks/use-crm-invalidate";
import * as service from "../services/notes.services";
import type { NoteEntityType } from "../interfaces/notes.interfaces";

const KEY = [...CRM_KEY, "notes"] as const;

export const useNotes = (entity_type: NoteEntityType, entity_id: string | undefined) =>
    useQuery({ queryKey: [...KEY, entity_type, entity_id], queryFn: () => service.getNotes(entity_type, entity_id as string), enabled: !!entity_id });

export const useCreateNote = () => useCrmMutation(service.createNote, { errorTitle: "Could not add note" });
/** Optimistic (pin, edit). */
export const useUpdateNote = () => useCrmUpdate(KEY, service.updateNote, { errorTitle: "Could not update note" });
export const useDeleteNote = () => useCrmRemove(KEY, service.deleteNote, { errorTitle: "Could not delete note" });
