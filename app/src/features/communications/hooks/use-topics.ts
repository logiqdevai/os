import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as s from "../services/topics.services";

const K = ["communications", "topics"] as const;

function useInvalidate() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: K });
}

export const useTopics = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...K, "list", params], queryFn: () => s.getTopics(params), placeholderData: keepPreviousData, enabled });
export const useCreateTopic = () => useMutation({ mutationFn: s.createTopic, onSuccess: useInvalidate() });
export const useUpdateTopic = () => useMutation({ mutationFn: s.updateTopic, onSuccess: useInvalidate() });
export const useTopicAction = () => useMutation({ mutationFn: s.topicAction, onSuccess: useInvalidate() });
export const useDeleteTopic = () => useMutation({ mutationFn: s.deleteTopic, onSuccess: useInvalidate() });
export const useContactTopics = (contactId: string | undefined) =>
    useQuery({ queryKey: [...K, "contact", contactId], queryFn: () => s.getContactTopics(contactId as string), enabled: !!contactId });
export const useSetContactTopics = () => useMutation({ mutationFn: s.setContactTopics, onSuccess: useInvalidate() });
