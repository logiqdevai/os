import { useMutation, useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmInvalidate } from "../../common/hooks/use-crm-invalidate";
import * as service from "../services/notes.services";
import type { NoteEntityType } from "../interfaces/notes.interfaces";

const KEY = [...CRM_KEY, "notes"] as const;

export const useNotes = (entity_type: NoteEntityType, entity_id: string | undefined) =>
    useQuery({ queryKey: [...KEY, entity_type, entity_id], queryFn: () => service.getNotes(entity_type, entity_id as string), enabled: !!entity_id });

export const useCreateNote = () => useMutation({ mutationFn: service.createNote, onSuccess: useCrmInvalidate() });
export const useUpdateNote = () => useMutation({ mutationFn: service.updateNote, onSuccess: useCrmInvalidate() });
export const useDeleteNote = () => useMutation({ mutationFn: service.deleteNote, onSuccess: useCrmInvalidate() });
