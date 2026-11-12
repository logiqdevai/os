import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { patchEntity, useOptimisticMutation } from "@/lib/query/optimistic";
import * as s from "../services/ai-threads.services";
import type { CommThreadMessage } from "../interfaces/ai-threads.interfaces";

const K = { ai: ["communications", "ai"] as const, threads: ["communications", "threads"] as const, messages: ["communications", "messages"] as const };

export const useAiStatus = (enabled = true) => useQuery({ queryKey: [...K.ai, "status"], queryFn: s.getAiStatus, enabled, staleTime: 60_000 });
export const useGenerateAi = () => useMutation({ mutationFn: s.generateAi, meta: { errorTitle: "The assistant could not answer" } });
/** Background signal; never worth interrupting the user for. */
export const useAiFeedback = () => useMutation({ mutationFn: s.aiFeedback, meta: { errorToast: false } });

export const useThreads = (params: Record<string, unknown>) => useQuery({ queryKey: [...K.threads, "list", params], queryFn: () => s.getThreads(params), placeholderData: keepPreviousData });
export const useThread = (id: string | undefined) => useQuery({ queryKey: [...K.threads, "detail", id], queryFn: () => s.getThread(id as string), enabled: !!id });

// Replies: shown in the thread at once ("Sending…"), kept with "Not sent · Retry · Discard" when refused.

/** A reply the server has not confirmed yet (kept outside the refetched thread query). */
export type OutgoingThreadMessage = CommThreadMessage & { local_state: "sending" | "failed" };
type ReplyVars = Parameters<typeof s.replyInThread>[0] & { local_id?: string; to_address?: string };
const outboxKey = (threadId: string) => ["comm-thread-outbox", threadId] as const;
const setOutbox = (qc: QueryClient, threadId: string, fn: (l: OutgoingThreadMessage[]) => OutgoingThreadMessage[]) => qc.setQueryData<OutgoingThreadMessage[]>(outboxKey(threadId), (l) => fn(l ?? []));

export function useThreadOutbox(threadId: string | undefined) {
    const { data } = useQuery({ queryKey: outboxKey(threadId ?? ""), queryFn: () => [] as OutgoingThreadMessage[], initialData: [] as OutgoingThreadMessage[], staleTime: Infinity, gcTime: Infinity, enabled: !!threadId });
    return data;
}
export function useDiscardThreadOutgoing() {
    const qc = useQueryClient();
    return (threadId: string, localId: string) => setOutbox(qc, threadId, (l) => l.filter((m) => m.id !== localId));
}

export const useReplyInThread = () => {
    const qc = useQueryClient();
    return useMutation({
        meta: { errorTitle: "Could not send the reply" },
        mutationFn: ({ local_id: _l, to_address: _t, ...v }: ReplyVars) => s.replyInThread(v),
        onMutate: (v) => {
            const local_id = v.local_id ?? `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const now = new Date().toISOString();
            const msg: OutgoingThreadMessage = {
                id: local_id, channel: v.body_html ? "EMAIL" : "SMS", kind: "REPLY", status: "SENDING", subject: v.subject ?? null, body_html: v.body_html ?? null, body_text: v.body_text ?? null,
                to_address: v.to_address ?? "", to_name: null, from_address: null, from_name: null, in_reply_to_message_id: null, created_at: now, scheduled_at: null, sent_at: null,
                delivered_at: null, first_opened_at: null, replied_at: null, failure_reason: null, sent_by: null, local_state: "sending",
            };
            setOutbox(qc, v.id, (l) => (l.some((m) => m.id === local_id) ? l.map((m) => (m.id === local_id ? msg : m)) : [...l, msg]));
            return { local_id };
        },
        // Show the server's copy (with its real delivery status) first, then drop the local one.
        onSuccess: async (_m, v, ctx) => {
            await qc.refetchQueries({ queryKey: [...K.threads, "detail", v.id] });
            setOutbox(qc, v.id, (l) => l.filter((m) => m.id !== ctx.local_id));
        },
        onError: (_e, v, ctx) => setOutbox(qc, v.id, (l) => l.map((m) => (m.id === ctx?.local_id ? { ...m, local_state: "failed" } : m))),
        onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: K.threads }), qc.invalidateQueries({ queryKey: K.messages })]),
    });
};
/** Archive / restore shows at once. */
export const useThreadAction = () =>
    useOptimisticMutation({
        roots: [K.threads],
        meta: { errorTitle: "Could not update the thread" },
        mutationFn: s.threadAction,
        apply: (qc, v) => patchEntity(qc, K.threads, v.id, { archived_at: v.action === "archive" ? new Date().toISOString() : null }),
    });
