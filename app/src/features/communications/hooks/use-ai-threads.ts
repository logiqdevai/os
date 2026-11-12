import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as s from "../services/ai-threads.services";

const K = { ai: ["communications", "ai"] as const, threads: ["communications", "threads"] as const, messages: ["communications", "messages"] as const };

export const useAiStatus = (enabled = true) => useQuery({ queryKey: [...K.ai, "status"], queryFn: s.getAiStatus, enabled, staleTime: 60_000 });
export const useGenerateAi = () => useMutation({ mutationFn: s.generateAi });
export const useAiFeedback = () => useMutation({ mutationFn: s.aiFeedback });

export const useThreads = (params: Record<string, unknown>) => useQuery({ queryKey: [...K.threads, "list", params], queryFn: () => s.getThreads(params), placeholderData: keepPreviousData });
export const useThread = (id: string | undefined) => useQuery({ queryKey: [...K.threads, "detail", id], queryFn: () => s.getThread(id as string), enabled: !!id });
export const useReplyInThread = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: s.replyInThread, onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: K.threads }), qc.invalidateQueries({ queryKey: K.messages })]) });
};
export const useThreadAction = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: s.threadAction, onSuccess: () => qc.invalidateQueries({ queryKey: K.threads }) });
};
