import { useMutation, useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmInvalidate } from "../../common/hooks/use-crm-invalidate";
import * as service from "../services/tags.services";

export const useTags = (entity_type?: string, enabled = true) =>
    useQuery({ queryKey: [...CRM_KEY, "tags", entity_type ?? "all"], queryFn: () => service.getTags(entity_type), staleTime: 60_000, enabled });

export const useCreateTag = () => useMutation({ mutationFn: service.createTag, onSuccess: useCrmInvalidate() });
export const useUpdateTag = () => useMutation({ mutationFn: service.updateTag, onSuccess: useCrmInvalidate() });
export const useDeleteTag = () => useMutation({ mutationFn: service.deleteTag, onSuccess: useCrmInvalidate() });
export const useSetTaggings = () => useMutation({ mutationFn: service.setTaggings, onSuccess: useCrmInvalidate() });
