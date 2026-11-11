import { useQueryClient } from "@tanstack/react-query";

/** Root query key of every CRM query. */
export const CRM_KEY = ["crm"] as const;

/** CRM records reference each other (deal ↔ company ↔ contact ↔ activity), so writes refresh the whole CRM cache. */
export function useCrmInvalidate() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: CRM_KEY });
}
