import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { patchEntity, removeEntity, useEntityRemove, useEntityUpdate, useOptimisticMutation } from "@/lib/query/optimistic";

/** Root query key of every CRM query. */
export const CRM_KEY = ["crm"] as const;

/** Mutation meta read by the global MutationCache (see QueryProvider). */
export type CrmMutationMeta = { errorTitle?: string; errorToast?: boolean };

/** CRM records reference each other (deal ↔ company ↔ contact ↔ activity), so writes refresh the whole CRM cache. */
export function useCrmInvalidate() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: CRM_KEY });
}

/**
 * Plain CRM write (create, send, run…): refreshes the CRM cache when it settles. No success toast — the UI shows the
 * result; a failure is toasted once by the global MutationCache with `meta.errorTitle` (or shown inline when
 * `meta.errorToast` is false).
 */
export function useCrmMutation<TData, TVars>(mutationFn: (vars: TVars) => Promise<TData>, meta: CrmMutationMeta) {
    const invalidate = useCrmInvalidate();
    return useMutation<TData, Error, TVars>({ mutationFn, meta, onSettled: () => invalidate() });
}

/** Optimistic CRM update by id: every cached list/detail under `root` changes at once, rolls back on failure. */
export function useCrmUpdate<TBody extends object, TData = unknown>(root: QueryKey, mutationFn: (vars: TBody & { id: string }) => Promise<TData>, meta: CrmMutationMeta) {
    return useEntityUpdate<TBody, TData>({ root, mutationFn, alsoInvalidate: [CRM_KEY], meta });
}

/** Optimistic CRM archive / delete by id: the record leaves every cached list at once and comes back on failure. */
export function useCrmRemove<TData = unknown>(root: QueryKey, mutationFn: (id: string) => Promise<TData>, meta: CrmMutationMeta) {
    return useEntityRemove<TData>({ root, mutationFn, alsoInvalidate: [CRM_KEY], meta });
}

/**
 * Optimistic by-id action with a known outcome (archive in place, restore, make default…): `patch` is applied to the
 * record in every cached list/detail under `root` at once; rolls back on failure. Called as `mutate(id)`.
 */
export function useCrmPatchById<TData = unknown>(root: QueryKey, mutationFn: (id: string) => Promise<TData>, patch: () => Record<string, unknown>, meta: CrmMutationMeta) {
    return useOptimisticMutation<TData, string>({ roots: [root], alsoInvalidate: [CRM_KEY], meta, mutationFn, apply: (qc, id) => patchEntity(qc, root, id, patch()) });
}

/** Optimistic archive: the record leaves every cached list and its open detail page shows it as archived at once. */
export function useCrmArchive<TData = unknown>(root: QueryKey, mutationFn: (id: string) => Promise<TData>, meta: CrmMutationMeta) {
    return useOptimisticMutation<TData, string>({
        roots: [root], alsoInvalidate: [CRM_KEY], meta, mutationFn,
        apply: (qc, id) => { removeEntity(qc, root, id); patchEntity(qc, root, id, { archived_at: new Date().toISOString() }); },
    });
}
