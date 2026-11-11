import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

/** Customer portal (07): which company (CustomerPortalMembership) the signed-in user has open. Sent as X-Portal-Membership-Id. */
interface PortalState {
    membership_id: string | null;
    setMembership(id: string | null): void;
}

const STORE_KEY = "portal";

export const usePortalStore = create<PortalState>()(
    devtools(
        persist(
            (set) => ({
                membership_id: null,
                setMembership: (membership_id) => set({ membership_id }),
            }),
            { name: STORE_KEY },
        ),
    ),
);

export const getPortalStoreState = () => usePortalStore.getState();
