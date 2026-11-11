import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { isLoggedIn, useAuthStore } from "@/stores/auth";
import * as service from "../services/session.services";
import type { AuthResponse, Session } from "../interfaces/session.interfaces";

export const SESSION_QUERY_KEY = ["session"] as const;

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

export function useSignIn() {
    const store = useStoreCredentials();
    return useMutation({ mutationFn: service.signIn, onSuccess: store });
}

export function useSignUp() {
    const store = useStoreCredentials();
    return useMutation({ mutationFn: service.signUp, onSuccess: store });
}

export function useForgotPassword() {
    return useMutation({ mutationFn: service.forgotPassword });
}

export function useResetPassword() {
    return useMutation({ mutationFn: service.resetPassword });
}

export function useLogout() {
    const clear = useAuthStore((s) => s.clear);
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    return useMutation({
        mutationFn: service.logout,
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
    return useMutation({ mutationFn: service.acceptInvitation, onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }) });
}

export function useUpdateProfile() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: service.updateProfile, onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }) });
}

export function useChangePassword() {
    return useMutation({ mutationFn: service.changePassword });
}

export function useUpdatePreferences() {
    return useMutation({ mutationFn: service.updatePreferences });
}

export function useMySessions() {
    return useQuery({ queryKey: ["my-sessions"], queryFn: service.getMySessions });
}

export function useRevokeMySession() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: service.revokeMySession, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-sessions"] }) });
}
