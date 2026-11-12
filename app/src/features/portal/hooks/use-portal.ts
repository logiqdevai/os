import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { usePortalStore } from "@/stores/portal";
import { patchEntity, removeEntity, useOptimisticMutation } from "@/lib/query/optimistic";
import * as s from "../services/portal.services";
import type { PortalDeliverable, PortalMessage, PortalNotificationPreferences, PortalNotificationPreferencesDto } from "../interfaces/portal.interfaces";

const ROOT = ["portal"] as const;
type Meta = { errorTitle?: string; errorToast?: boolean };

/** Every query key includes the open company so switching companies never shows stale data. */
function useKey() {
    const membership = usePortalStore((st) => st.membership_id);
    return (...parts: unknown[]) => ["portal", membership, ...parts];
}

/**
 * Portal mutation without an optimistic change (create, upload, invite): refreshes the portal when it settles.
 * No success toast (the page shows the result); a failure is toasted once globally with `errorTitle`.
 */
function usePortalMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>, meta: Meta) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, meta, onSettled: () => qc.invalidateQueries({ queryKey: ROOT }) });
}
/** Optimistic patch of one portal entity by id (lists and details), rolled back if the API refuses. */
const usePortalPatch = <TVars, TData>(mutationFn: (v: TVars) => Promise<TData>, idOf: (v: TVars) => string, patch: (v: TVars) => object, meta: Meta) =>
    useOptimisticMutation<TData, TVars>({ roots: [ROOT], meta, mutationFn, apply: (qc, v) => patchEntity(qc, ROOT, idOf(v), patch(v)) });

/** Patch a deliverable wherever it is cached: approval lists and the `deliverables` of a project page. */
function patchDeliverable(qc: QueryClient, id: string, fn: (d: PortalDeliverable) => PortalDeliverable) {
    patchEntity<PortalDeliverable>(qc, ROOT, id, fn);
    qc.setQueriesData({ queryKey: ROOT }, (data: unknown) => {
        const d = data as { deliverables?: PortalDeliverable[] } | undefined;
        if (!d || typeof d !== "object" || !Array.isArray(d.deliverables) || !d.deliverables.some((x) => x.id === id)) return data;
        return { ...d, deliverables: d.deliverables.map((x) => (x.id === id ? fn(x) : x)) };
    });
}

// Replies and messages the client sends: shown in the thread at once ("Sending…"), "Not sent · Retry" when refused.

/** A message the client sent that the server has not confirmed yet (kept outside the refetched portal queries). */
export type OutgoingPortalMessage = PortalMessage & { local_state: "sending" | "failed" };
const outboxKey = (threadId: string) => ["portal-outbox", threadId] as const;
const setOutbox = (qc: QueryClient, threadId: string, fn: (l: OutgoingPortalMessage[]) => OutgoingPortalMessage[]) => qc.setQueryData<OutgoingPortalMessage[]>(outboxKey(threadId), (l) => fn(l ?? []));

/** Messages of a request / conversation still on their way (or refused), shown after the server's messages. */
export function usePortalOutbox(threadId: string | undefined) {
    const { data } = useQuery({ queryKey: outboxKey(threadId ?? ""), queryFn: () => [] as OutgoingPortalMessage[], initialData: [] as OutgoingPortalMessage[], staleTime: Infinity, gcTime: Infinity, enabled: !!threadId });
    return data;
}
export function useDiscardPortalOutgoing() {
    const qc = useQueryClient();
    return (threadId: string, localId: string) => setOutbox(qc, threadId, (l) => l.filter((m) => m.id !== localId));
}

type SendVars = { id: string; body: string; local_id?: string };
function usePortalSend(send: (v: { id: string; body: string }) => Promise<unknown>, errorTitle: string) {
    const qc = useQueryClient();
    return useMutation({
        meta: { errorTitle },
        mutationFn: ({ id, body }: SendVars) => send({ id, body }),
        onMutate: (v) => {
            const local_id = v.local_id ?? `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const msg: OutgoingPortalMessage = { id: local_id, kind: "CUSTOMER", body: v.body, created_at: new Date().toISOString(), author: null, author_user: null, author_name: null, mine: true, local_state: "sending" };
            setOutbox(qc, v.id, (l) => (l.some((m) => m.id === local_id) ? l.map((m) => (m.id === local_id ? msg : m)) : [...l, msg]));
            return { local_id };
        },
        // Show the server's copy first, then drop the local one, so the message never flickers out.
        onSuccess: async (_r, v, ctx) => {
            await qc.refetchQueries({ queryKey: ROOT, type: "active" });
            setOutbox(qc, v.id, (l) => l.filter((m) => m.id !== ctx.local_id));
        },
        onError: (_e, v, ctx) => setOutbox(qc, v.id, (l) => l.map((m) => (m.id === ctx?.local_id ? { ...m, local_state: "failed" } : m))),
    });
}

export const usePortalMemberships = (enabled = true) => useQuery({ queryKey: ["portal-memberships"], queryFn: s.getPortalMemberships, enabled, retry: false });
export const usePortalSession = (enabled = true) => {
    const k = useKey();
    return useQuery({ queryKey: k("me"), queryFn: s.getPortalSession, enabled, retry: false, staleTime: 60_000 });
};
export const usePortalDashboard = () => { const k = useKey(); return useQuery({ queryKey: k("dashboard"), queryFn: s.getPortalDashboard }); };
export const usePortalProjects = (params: Record<string, unknown>) => { const k = useKey(); return useQuery({ queryKey: k("projects", params), queryFn: () => s.getPortalProjects(params), placeholderData: keepPreviousData }); };
export const usePortalProject = (id: string | undefined) => { const k = useKey(); return useQuery({ queryKey: k("project", id), queryFn: () => s.getPortalProject(id as string), enabled: !!id }); };
export const usePortalApprovals = (params: Record<string, unknown>) => { const k = useKey(); return useQuery({ queryKey: k("approvals", params), queryFn: () => s.getPortalApprovals(params), placeholderData: keepPreviousData }); };
/** The decision shows at once (the Review button disappears and the status / review history update). */
export const useReviewDeliverable = () =>
    useOptimisticMutation({
        roots: [ROOT],
        meta: { errorTitle: "Could not send your review" },
        mutationFn: s.reviewDeliverable,
        apply: (qc, v) =>
            patchDeliverable(qc, v.id, (d) => ({
                ...d,
                you_can_decide: false,
                status: v.decision !== "ACCEPTED" || d.approval_mode === "ANY_ONE" ? v.decision : d.status,
                reviews: [...d.reviews, { decision: v.decision, comment: v.comment ?? null, decided_at: new Date().toISOString() }],
            })),
    });
export const usePortalRequests = (params: Record<string, unknown>) => { const k = useKey(); return useQuery({ queryKey: k("requests", params), queryFn: () => s.getPortalRequests(params), placeholderData: keepPreviousData }); };
export const usePortalRequest = (ref: string | undefined) => { const k = useKey(); return useQuery({ queryKey: k("request", ref), queryFn: () => s.getPortalRequest(ref as string), enabled: !!ref, refetchInterval: 30_000 }); };
export const useCreatePortalRequest = () => usePortalMutation(s.createPortalRequest, { errorTitle: "Could not send your request" });
export const useUpdatePortalRequest = () => usePortalPatch(s.updatePortalRequest, (v) => v.id, ({ id: _id, ...v }) => v, { errorTitle: "Could not update your request" });
/** `id` is the request id; the reply shows in the thread at once. */
export const useReplyToPortalRequest = () => usePortalSend(s.replyToPortalRequest, "Could not send your reply");
/** The rating form turns into "You rated this n/5" at once. */
export const useRatePortalRequest = () =>
    usePortalPatch(s.ratePortalRequest, (v) => v.id, (v) => ({ rating: { submitted: true, rating: v.rating, comment: v.comment ?? null, can_rate: false } }), { errorTitle: "Could not send your rating" });
export const usePortalConversations = (params: Record<string, unknown>) => { const k = useKey(); return useQuery({ queryKey: k("conversations", params), queryFn: () => s.getPortalConversations(params), placeholderData: keepPreviousData, refetchInterval: 30_000 }); };
export const usePortalConversation = (id: string | undefined) => { const k = useKey(); return useQuery({ queryKey: k("conversation", id), queryFn: () => s.getPortalConversation(id as string), enabled: !!id, refetchInterval: 20_000 }); };
export const useStartPortalConversation = () => usePortalMutation(s.startPortalConversation, { errorTitle: "Could not send your message" });
/** `id` is the conversation id; the message shows in the thread at once. */
export const usePostPortalMessage = () => usePortalSend(s.postPortalMessage, "Could not send your message");
export const usePortalDocuments = (params: Record<string, unknown>) => { const k = useKey(); return useQuery({ queryKey: k("documents", params), queryFn: () => s.getPortalDocuments(params), placeholderData: keepPreviousData }); };
export const usePortalProposals = (params: Record<string, unknown>, enabled = true) => { const k = useKey(); return useQuery({ queryKey: k("proposals", params), queryFn: () => s.getPortalProposals(params), enabled }); };
export const usePortalContracts = (params: Record<string, unknown>, enabled = true) => { const k = useKey(); return useQuery({ queryKey: k("contracts", params), queryFn: () => s.getPortalContracts(params), enabled }); };
export const usePortalInvoices = (params: Record<string, unknown>) => { const k = useKey(); return useQuery({ queryKey: k("invoices", params), queryFn: () => s.getPortalInvoices(params), placeholderData: keepPreviousData }); };
export const useHelpHome = () => { const k = useKey(); return useQuery({ queryKey: k("help"), queryFn: s.getHelpHome }); };
export const useHelpArticles = (params: Record<string, unknown>, enabled = true) => { const k = useKey(); return useQuery({ queryKey: k("help-articles", params), queryFn: () => s.getHelpArticles(params), enabled, placeholderData: keepPreviousData }); };
export const useHelpArticle = (slug: string | undefined) => { const k = useKey(); return useQuery({ queryKey: k("help-article", slug), queryFn: () => s.getHelpArticle(slug as string), enabled: !!slug }); };
export const usePortalCompany = () => { const k = useKey(); return useQuery({ queryKey: k("company"), queryFn: s.getPortalCompany }); };
export const useRequestProfileChange = () => usePortalMutation(s.requestProfileChange, { errorTitle: "Could not save the changes" });
export const usePortalTeam = () => { const k = useKey(); return useQuery({ queryKey: k("team"), queryFn: s.getPortalTeam }); };
export const useInviteColleagues = () => usePortalMutation(s.inviteColleagues, { errorTitle: "Could not send the invitations" });
/** The invitation leaves the list at once. */
export const useCancelColleagueInvitation = () =>
    useOptimisticMutation<unknown, string>({ roots: [ROOT], meta: { errorTitle: "Could not cancel the invitation" }, mutationFn: s.cancelColleagueInvitation, apply: (qc, id) => removeEntity(qc, ROOT, id) });
/** Role / access changes show at once; pass `role` (display object) with `role_id`. */
export const useUpdateTeamMember = () =>
    useOptimisticMutation<unknown, { id: string; role_id?: string; status?: string; role?: { id: string; name: string; slug: string } }>({
        roots: [ROOT],
        meta: { errorTitle: "Could not update the team member" },
        mutationFn: ({ role: _r, ...v }) => s.updateTeamMember(v),
        apply: (qc, { id, role_id: _rid, ...patch }) => patchEntity(qc, ROOT, id, patch),
    });
export const useUploadPortalDocument = () => usePortalMutation(s.uploadPortalDocument, { errorTitle: "Upload failed" });
export const useOpenPortalProposal = () => useMutation({ mutationFn: s.openPortalProposal, meta: { errorTitle: "Could not open the proposal" } });
export const useSignPortalContract = () => useMutation({ mutationFn: s.signPortalContract, meta: { errorTitle: "Could not open signing" } });
export const usePortalNotificationPreferences = () => { const k = useKey(); return useQuery({ queryKey: k("notification-preferences"), queryFn: s.getPortalNotificationPreferences }); };
/** Switches and the frequency change at once (rolled back if the API refuses). */
export const useUpdatePortalNotificationPreferences = () =>
    useOptimisticMutation<unknown, PortalNotificationPreferencesDto>({
        roots: [ROOT],
        meta: { errorTitle: "Could not save your preferences" },
        mutationFn: s.updatePortalNotificationPreferences,
        apply: (qc, { topics, ...rest }) =>
            qc.setQueriesData<PortalNotificationPreferences>({ queryKey: ROOT, predicate: (q) => q.queryKey[q.queryKey.length - 1] === "notification-preferences" }, (p) =>
                p ? { ...p, ...rest, topics: p.topics.map((t) => ({ ...t, enabled: topics?.find((x) => x.module === t.module)?.enabled ?? t.enabled })) } : p,
            ),
    });
