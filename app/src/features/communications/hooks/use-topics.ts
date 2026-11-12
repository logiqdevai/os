import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as s from "../services/topics.services";
import { patchEntity, useEntityRemove, useEntityUpdate, useOptimisticMutation } from "@/lib/query/optimistic";
import type { ContactTopicSubscriptions } from "../interfaces/topics.interfaces";

const K = ["communications", "topics"] as const;

export const useTopics = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...K, "list", params], queryFn: () => s.getTopics(params), placeholderData: keepPreviousData, enabled });
/** Creating is explicit (dialog); no success toast — the topic appears in the list. */
export const useCreateTopic = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: s.createTopic, meta: { errorTitle: "Could not create the topic" }, onSettled: () => qc.invalidateQueries({ queryKey: K }) });
};
/** Autosaved topic dialog: the list shows edits at once; failures show in the dialog's <SaveStatus />. */
export const useUpdateTopic = () => useEntityUpdate({ root: K, mutationFn: s.updateTopic, meta: { errorToast: false } });
export const useTopicAction = () =>
    useOptimisticMutation({
        roots: [K],
        meta: { errorTitle: "Could not update the topic" },
        mutationFn: s.topicAction,
        apply: (qc, v) => patchEntity(qc, K, v.id, { archived_at: v.action === "archive" ? new Date().toISOString() : null }),
    });
export const useDeleteTopic = () => useEntityRemove({ root: K, mutationFn: s.deleteTopic, meta: { errorTitle: "Could not delete the topic" } });
export const useContactTopics = (contactId: string | undefined) =>
    useQuery({ queryKey: [...K, "contact", contactId], queryFn: () => s.getContactTopics(contactId as string), enabled: !!contactId });
/** Subscription switches change at once (rolled back if the API refuses). */
export const useSetContactTopics = () =>
    useOptimisticMutation({
        roots: [K],
        meta: { errorTitle: "Could not update the subscriptions" },
        mutationFn: s.setContactTopics,
        apply: (qc, v) =>
            qc.setQueryData<ContactTopicSubscriptions>([...K, "contact", v.contactId], (d) => {
                if (!d) return d;
                const next = new Map(v.subscriptions.map((x) => [x.topic_id, x.status]));
                return { ...d, topics: d.topics.map((t) => (next.has(t.topic.id) ? { ...t, status: next.get(t.topic.id) as typeof t.status, effective: next.get(t.topic.id) === "OPTED_IN" } : t)) };
            }),
    });
