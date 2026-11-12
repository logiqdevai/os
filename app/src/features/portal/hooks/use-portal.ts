import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePortalStore } from "@/stores/portal";
import * as s from "../services/portal.services";

/** Every query key includes the open company so switching companies never shows stale data. */
function useKey() {
    const membership = usePortalStore((st) => st.membership_id);
    return (...parts: unknown[]) => ["portal", membership, ...parts];
}

function usePortalMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ["portal"] }) });
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
export const useReviewDeliverable = () => usePortalMutation(s.reviewDeliverable);
export const usePortalRequests = (params: Record<string, unknown>) => { const k = useKey(); return useQuery({ queryKey: k("requests", params), queryFn: () => s.getPortalRequests(params), placeholderData: keepPreviousData }); };
export const usePortalRequest = (ref: string | undefined) => { const k = useKey(); return useQuery({ queryKey: k("request", ref), queryFn: () => s.getPortalRequest(ref as string), enabled: !!ref, refetchInterval: 30_000 }); };
export const useCreatePortalRequest = () => usePortalMutation(s.createPortalRequest);
export const useUpdatePortalRequest = () => usePortalMutation(s.updatePortalRequest);
export const useReplyToPortalRequest = () => usePortalMutation(s.replyToPortalRequest);
export const useRatePortalRequest = () => usePortalMutation(s.ratePortalRequest);
export const usePortalConversations = (params: Record<string, unknown>) => { const k = useKey(); return useQuery({ queryKey: k("conversations", params), queryFn: () => s.getPortalConversations(params), placeholderData: keepPreviousData, refetchInterval: 30_000 }); };
export const usePortalConversation = (id: string | undefined) => { const k = useKey(); return useQuery({ queryKey: k("conversation", id), queryFn: () => s.getPortalConversation(id as string), enabled: !!id, refetchInterval: 20_000 }); };
export const useStartPortalConversation = () => usePortalMutation(s.startPortalConversation);
export const usePostPortalMessage = () => usePortalMutation(s.postPortalMessage);
export const usePortalDocuments = (params: Record<string, unknown>) => { const k = useKey(); return useQuery({ queryKey: k("documents", params), queryFn: () => s.getPortalDocuments(params), placeholderData: keepPreviousData }); };
export const usePortalProposals = (params: Record<string, unknown>, enabled = true) => { const k = useKey(); return useQuery({ queryKey: k("proposals", params), queryFn: () => s.getPortalProposals(params), enabled }); };
export const usePortalContracts = (params: Record<string, unknown>, enabled = true) => { const k = useKey(); return useQuery({ queryKey: k("contracts", params), queryFn: () => s.getPortalContracts(params), enabled }); };
export const usePortalInvoices = (params: Record<string, unknown>) => { const k = useKey(); return useQuery({ queryKey: k("invoices", params), queryFn: () => s.getPortalInvoices(params), placeholderData: keepPreviousData }); };
export const useHelpHome = () => { const k = useKey(); return useQuery({ queryKey: k("help"), queryFn: s.getHelpHome }); };
export const useHelpArticles = (params: Record<string, unknown>, enabled = true) => { const k = useKey(); return useQuery({ queryKey: k("help-articles", params), queryFn: () => s.getHelpArticles(params), enabled, placeholderData: keepPreviousData }); };
export const useHelpArticle = (slug: string | undefined) => { const k = useKey(); return useQuery({ queryKey: k("help-article", slug), queryFn: () => s.getHelpArticle(slug as string), enabled: !!slug }); };
export const usePortalCompany = () => { const k = useKey(); return useQuery({ queryKey: k("company"), queryFn: s.getPortalCompany }); };
export const useRequestProfileChange = () => usePortalMutation(s.requestProfileChange);
export const usePortalTeam = () => { const k = useKey(); return useQuery({ queryKey: k("team"), queryFn: s.getPortalTeam }); };
export const useInviteColleagues = () => usePortalMutation(s.inviteColleagues);
export const useCancelColleagueInvitation = () => usePortalMutation(s.cancelColleagueInvitation);
export const useUpdateTeamMember = () => usePortalMutation(s.updateTeamMember);
export const useUploadPortalDocument = () => usePortalMutation(s.uploadPortalDocument);
export const useOpenPortalProposal = () => useMutation({ mutationFn: s.openPortalProposal });
export const useSignPortalContract = () => useMutation({ mutationFn: s.signPortalContract });
export const usePortalNotificationPreferences = () => { const k = useKey(); return useQuery({ queryKey: k("notification-preferences"), queryFn: s.getPortalNotificationPreferences }); };
export const useUpdatePortalNotificationPreferences = () => usePortalMutation(s.updatePortalNotificationPreferences);
