import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { isLoggedIn, useAuthStore } from "@/stores/auth";
import * as service from "../services/session.services";
import { useEntityRemove } from "@/lib/query/optimistic";
import { isMfaChallenge, type AuthResponse, type Session, type SignInResult } from "../interfaces/session.interfaces";

export const SESSION_QUERY_KEY = ["session"] as const;

/** Auth and account forms show the API error inline, so the global error toast is skipped. */
const INLINE = { errorToast: false } as const;

/** The signed-in person's session: user, organizations, active organization, effective permissions, enabled modules. */
export function useSession() {
    const auth = useAuthStore();
    return useQuery({
        queryKey: [...SESSION_QUERY_KEY, auth.organization_id],
        queryFn: service.getSession,
        enabled: isLoggedIn(auth),
        staleTime: 60_000,
        refetchOnWindowFocus: true,
    });
}

/** Read the cached session (null before it loads). */
export function useSessionData(): Session | null {
    const { data } = useSession();
    return data ?? null;
}

function useStoreCredentials() {
    const setCredentials = useAuthStore((s) => s.setCredentials);
    const setOrganization = useAuthStore((s) => s.setOrganization);
    const queryClient = useQueryClient();
    return (res: AuthResponse) => {
        queryClient.clear();
        setOrganization(res.user.default_organization_id ?? null);
        setCredentials({ access_token: res.access_token, expires_in: res.expires_in });
    };
}

/** Password step. Stores the session unless the account uses MFA (then the caller shows the code step). */
export function useSignIn() {
    const store = useStoreCredentials();
    return useMutation({ mutationFn: service.signIn, meta: INLINE, onSuccess: (res: SignInResult) => { if (!isMfaChallenge(res)) store(res); } });
}

/** Second sign-in step: code or recovery code → session. */
export function useVerifyMfa() {
    const store = useStoreCredentials();
    return useMutation({ mutationFn: service.verifyMfa, meta: INLINE, onSuccess: store });
}

export function useSignUp() {
    const store = useStoreCredentials();
    return useMutation({ mutationFn: service.signUp, meta: INLINE, onSuccess: store });
}

export function useForgotPassword() {
    return useMutation({ mutationFn: service.forgotPassword, meta: INLINE });
}

export function useResetPassword() {
    return useMutation({ mutationFn: service.resetPassword, meta: INLINE });
}

export function useLogout() {
    const clear = useAuthStore((s) => s.clear);
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    return useMutation({
        mutationFn: service.logout,
        meta: { errorToast: false }, // signs out locally either way
        onSettled: () => {
            clear();
            queryClient.clear();
            navigate("/auth/sign-in", { replace: true });
        },
    });
}

export function useSwitchOrganization() {
    const setOrganization = useAuthStore((s) => s.setOrganization);
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    return useMutation({
        mutationFn: service.switchOrganization,
        meta: { errorTitle: "Could not switch organization" },
        onSuccess: (session) => {
            queryClient.clear();
            setOrganization(session.active_organization?.id ?? null);
            navigate("/", { replace: true });
        },
    });
}

export function useCreateOrganization() {
    const setOrganization = useAuthStore((s) => s.setOrganization);
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: service.createOrganization,
        meta: { errorTitle: "Could not create the organization" },
        onSuccess: (session) => {
            queryClient.clear();
            setOrganization(session.active_organization?.id ?? null);
        },
    });
}

export function useInvitation(token: string | null) {
    return useQuery({ queryKey: ["invitation", token], queryFn: () => service.getInvitation(token as string), enabled: !!token, retry: false });
}

export function useAcceptInvitation() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: service.acceptInvitation, meta: INLINE, onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }) });
}

/** Own profile; autosaved by Settings → Profile, which shows failures in its <SaveStatus /> (no toast). */
export function useUpdateProfile() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: service.updateProfile, meta: INLINE, onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }) });
}

export function useChangePassword() {
    return useMutation({ mutationFn: service.changePassword, meta: INLINE });
}

/** Upload or replace own profile photo; the session (and every avatar reading it) refreshes. */
export function useUploadProfilePhoto() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: service.uploadProfilePhoto, meta: { errorTitle: "Could not upload the photo" }, onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }) });
}

export function useRemoveProfilePhoto() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: service.removeProfilePhoto, meta: { errorTitle: "Could not remove the photo" }, onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }) });
}

/** Save own appearance for the active organization and write it into the cached session. */
export function useUpdateAppearance() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: service.updateAppearance,
        meta: { errorTitle: "Could not save your appearance" },
        onSuccess: (appearance) => queryClient.setQueriesData<Session>({ queryKey: SESSION_QUERY_KEY }, (s) => (s && s.active_organization?.id === appearance.organization_id ? { ...s, appearance } : s)),
    });
}

export function useMySessions() {
    return useQuery({ queryKey: ["my-sessions"], queryFn: service.getMySessions });
}

/** Optimistic: the session row disappears at once and comes back if the API refuses. */
export function useRevokeMySession() {
    return useEntityRemove({ root: ["my-sessions"], mutationFn: service.revokeMySession, meta: { errorTitle: "Could not end the session" } });
}

export const MFA_QUERY_KEY = ["my-mfa"] as const;

export function useMfaStatus() {
    return useQuery({ queryKey: MFA_QUERY_KEY, queryFn: service.getMfaStatus });
}

export function useStartTotpSetup() {
    return useMutation({ mutationFn: service.startTotpSetup, meta: INLINE });
}

/** Refreshes the session too: the enrolment gate opens as soon as MFA is on. */
function useMfaMutation<TVars, TData>(fn: (v: TVars) => Promise<TData>) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: fn,
        meta: INLINE,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: MFA_QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
        },
    });
}

export const useConfirmTotpSetup = () => useMfaMutation(service.confirmTotpSetup);
export const useRegenerateRecoveryCodes = () => useMfaMutation(service.regenerateRecoveryCodes);
export const useDisableMfa = () => useMfaMutation(service.disableMfa);
