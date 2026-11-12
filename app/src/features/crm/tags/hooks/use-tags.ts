import { useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmMutation, useCrmRemove, useCrmUpdate } from "../../common/hooks/use-crm-invalidate";
import { patchEntity, useOptimisticMutation } from "@/lib/query/optimistic";
import type { SetTaggingsDto } from "../interfaces/tags.interfaces";
import type { TagRef } from "../../common/interfaces/crm-common.interfaces";
import * as service from "../services/tags.services";

export const useTags = (entity_type?: string, enabled = true) =>
    useQuery({ queryKey: [...CRM_KEY, "tags", entity_type ?? "all"], queryFn: () => service.getTags(entity_type), staleTime: 60_000, enabled });

export const useCreateTag = () => useCrmMutation(service.createTag, { errorTitle: "Could not create tag" });
/** Optimistic. */
export const useUpdateTag = () => useCrmUpdate([...CRM_KEY, "tags"], service.updateTag, { errorTitle: "Could not save tag" });
export const useDeleteTag = () => useCrmRemove([...CRM_KEY, "tags"], service.deleteTag, { errorTitle: "Could not delete tag" });
/** Optimistic: the record's tag chips change at once (`tags` = display objects, never sent). */
export const useSetTaggings = () =>
    useOptimisticMutation<TagRef[], SetTaggingsDto & { tags?: TagRef[] }>({
        roots: [CRM_KEY],
        meta: { errorTitle: "Could not update tags" },
        mutationFn: ({ tags: _t, ...dto }) => service.setTaggings(dto),
        apply: (qc, { entity_id, tags }) => { if (tags) patchEntity(qc, CRM_KEY, entity_id, { tags }); },
    });
