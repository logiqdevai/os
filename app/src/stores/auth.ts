import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Credentials only. Everything else about the session (user, organizations, permissions) comes from `useSession()`. */
interface AuthState {
    access_token: string | null;
    expires_in: number | null;
    /** Organization chosen in the switcher; sent as `X-Organization-Id`. */
    organization_id: string | null;
    setCredentials(input: { access_token: string; expires_in: number }): void;
    setOrganization(organization_id: string | null): void;
    clear(): void;
}

const STORE_KEY = "auth";

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            access_token: null,
            expires_in: null,
            organization_id: null,
            setCredentials: ({ access_token, expires_in }) => set({ access_token, expires_in }),
            setOrganization: (organization_id) => set({ organization_id }),
            clear: () => set({ access_token: null, expires_in: null, organization_id: null }),
        }),
        { name: STORE_KEY }
    )
);

export const getAuthStoreState = () => useAuthStore.getState();

export const isLoggedIn = (state: Pick<AuthState, "access_token" | "expires_in">) =>
    !!state.access_token && (!state.expires_in || state.expires_in * 1000 > Date.now());
