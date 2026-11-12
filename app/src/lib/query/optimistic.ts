import { useMutation, useQueryClient, type QueryClient, type QueryKey, type UseMutationOptions } from "@tanstack/react-query";

/**
 * Optimistic updates (Linear-style): the UI changes the moment the user acts, the request runs in the background,
 * and a refused request rolls the cache back (the global MutationCache shows the error toast).
 *
 * Cache shapes handled by the entity helpers, anywhere under a root key:
 *   - list pages  `{ data: T[], pagination }`
 *   - plain arrays `T[]`
 *   - detail objects `T` (matched by `id`)
 *   - objects holding arrays of entities (`{ tasks: T[] }`, `{ items: T[] }` …) — one level deep
 */
type Entity = { id: string };
type Snapshot = [QueryKey, unknown][];

const isEntity = (v: unknown): v is Entity => !!v && typeof v === "object" && typeof (v as Entity).id === "string";

function mapEntities(data: unknown, fn: (e: Entity) => Entity | null): unknown {
    if (Array.isArray(data)) {
        let changed = false;
        const out: unknown[] = [];
        for (const item of data) {
            if (isEntity(item)) {
                const next = fn(item);
                if (next !== item) changed = true;
                if (next) out.push(next);
            } else out.push(item);
        }
        return changed ? out : data;
    }
    if (!data || typeof data !== "object") return data;
    if (isEntity(data)) {
        // A detail object is never removed from the cache (the page decides what to show); only patched. Its own
        // arrays of entities (grants, items, comments…) are patched too, so nested rows update optimistically.
        return mapArrayFields(fn(data) ?? data, fn);
    }
    return mapArrayFields(data, fn);
}

/** Apply `fn` to the entities inside the array fields of an object (one level deep). */
function mapArrayFields(data: unknown, fn: (e: Entity) => Entity | null): unknown {
    let changed = false;
    const copy: Record<string, unknown> = { ...(data as Record<string, unknown>) };
    for (const [k, v] of Object.entries(copy)) {
        if (Array.isArray(v) && v.some(isEntity)) {
            const next = mapEntities(v, fn);
            if (next !== v) {
                copy[k] = next;
                changed = true;
            }
        }
    }
    return changed ? copy : data;
}

/** Snapshot every query under `roots` (for rollback). */
export async function snapshot(qc: QueryClient, roots: QueryKey[]): Promise<Snapshot> {
    await Promise.all(roots.map((queryKey) => qc.cancelQueries({ queryKey })));
    return roots.flatMap((queryKey) => qc.getQueriesData({ queryKey }));
}

export function restore(qc: QueryClient, snap: Snapshot | undefined) {
    for (const [key, data] of snap ?? []) qc.setQueryData(key, data);
}

/** Merge `patch` into the entity with `id` in every cached query under `root`. */
export function patchEntity<T extends object>(qc: QueryClient, root: QueryKey, id: string, patch: Partial<T> | ((e: T) => T)) {
    qc.setQueriesData({ queryKey: root }, (data: unknown) =>
        mapEntities(data, (e) => (e.id === id ? (typeof patch === "function" ? (patch as (x: T) => T)(e as unknown as T) : { ...e, ...patch }) as Entity : e)),
    );
}

/** Remove the entity with `id` from every cached list under `root` (detail caches are kept). */
export function removeEntity(qc: QueryClient, root: QueryKey, id: string) {
    qc.setQueriesData({ queryKey: root }, (data: unknown) => {
        const next = mapEntities(data, (e) => (e.id === id ? null : e));
        // keep list totals honest
        if (next !== data && next && typeof next === "object" && "pagination" in (next as object)) {
            const p = (next as { pagination?: { total?: number } }).pagination;
            if (p && typeof p.total === "number") return { ...(next as object), pagination: { ...p, total: Math.max(0, p.total - 1) } };
        }
        return next;
    });
}

/** Temporary ids for optimistic rows (replaced by the server row when the mutation settles). */
export const tempId = () => `temp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
export const isTempId = (id: string | null | undefined) => !!id && id.startsWith("temp_");

/**
 * Append a (temporary) entity at the END of a list (comments, checklist items, chat messages). `field` targets an
 * array inside a detail object (e.g. `"comments"` of a task); without it, plain arrays and `{ data: [] }` lists.
 */
export function appendEntity<T extends Entity>(qc: QueryClient, root: QueryKey, entity: T, field?: string) {
    qc.setQueriesData({ queryKey: root }, (data: unknown) => {
        if (field) {
            if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>)[field])) {
                return { ...(data as object), [field]: [...((data as Record<string, unknown[]>)[field]), entity] };
            }
            return data;
        }
        if (Array.isArray(data)) return [...data, entity];
        if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
            const d = data as { data: unknown[]; pagination?: { total?: number } };
            return { ...d, data: [...d.data, entity], ...(d.pagination && typeof d.pagination.total === "number" ? { pagination: { ...d.pagination, total: d.pagination.total + 1 } } : {}) };
        }
        return data;
    });
}

/** Prepend a (temporary) entity to every cached `{ data: [] }` list under `root`. */
export function insertEntity<T extends Entity>(qc: QueryClient, root: QueryKey, entity: T) {
    qc.setQueriesData({ queryKey: root }, (data: unknown) => {
        if (Array.isArray(data)) return [entity, ...data];
        if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
            const d = data as { data: unknown[]; pagination?: { total?: number } };
            return { ...d, data: [entity, ...d.data], ...(d.pagination && typeof d.pagination.total === "number" ? { pagination: { ...d.pagination, total: d.pagination.total + 1 } } : {}) };
        }
        return data;
    });
}

export interface OptimisticOptions<TData, TVars> extends Omit<UseMutationOptions<TData, Error, TVars, { snap: Snapshot }>, "onMutate" | "onError" | "onSettled"> {
    /** Query roots this mutation touches: snapshotted for rollback and invalidated when it settles. */
    roots: QueryKey[];
    /** Apply the expected result to the cache before the request (use patchEntity / removeEntity / insertEntity). */
    apply?: (qc: QueryClient, vars: TVars) => void;
    /** Extra roots to refresh after settling that are not patched optimistically (dashboards, counts…). */
    alsoInvalidate?: QueryKey[];
    /** Called after a successful request with the server result (e.g. replace a temp id, navigate). */
    onDone?: (data: TData, vars: TVars) => void;
}

/**
 * `useMutation` with optimistic cache updates, rollback on failure and a background refresh on settle.
 * No success feedback by design; failures are toasted globally (see QueryProvider) unless `meta.errorToast` is false.
 */
export function useOptimisticMutation<TData = unknown, TVars = void>({ roots, apply, alsoInvalidate = [], onDone, ...options }: OptimisticOptions<TData, TVars>) {
    const qc = useQueryClient();
    return useMutation<TData, Error, TVars, { snap: Snapshot }>({
        ...options,
        onMutate: async (vars) => {
            const snap = await snapshot(qc, roots);
            apply?.(qc, vars);
            return { snap };
        },
        onError: (_e, _v, ctx) => restore(qc, ctx?.snap),
        onSuccess: (data, vars) => onDone?.(data, vars),
        onSettled: () => {
            for (const queryKey of [...roots, ...alsoInvalidate]) qc.invalidateQueries({ queryKey });
        },
    });
}

/**
 * Variables of an entity update: the API body plus `optimistic`, the display-only fields the UI already knows
 * (e.g. the picked `status` object when sending `status_id`). `optimistic` is applied to the cache, never sent.
 */
export type EntityPatchVars<TBody> = TBody & { id: string; optimistic?: Record<string, unknown> };

/**
 * The common case — update one entity by id: the cache gets `{ ...body, ...optimistic }` immediately, the request
 * runs, failures roll back and toast globally.
 *
 *   export const useUpdateCompany = () => useEntityUpdate({ root: COMPANIES_KEY, mutationFn: service.updateCompany });
 *   update.mutate({ id, owner_membership_id: m.id, optimistic: { owner: m } });
 */
export function useEntityUpdate<TBody extends object, TData = unknown>({
    root, mutationFn, alsoInvalidate, meta,
}: { root: QueryKey; mutationFn: (vars: TBody & { id: string }) => Promise<TData>; alsoInvalidate?: QueryKey[]; meta?: { errorTitle?: string; errorToast?: boolean } }) {
    return useOptimisticMutation<TData, EntityPatchVars<TBody>>({
        roots: [root],
        alsoInvalidate,
        meta,
        mutationFn: ({ optimistic: _o, ...body }) => mutationFn(body as TBody & { id: string }),
        apply: (qc, { id, optimistic, ...body }) => patchEntity(qc, root, id, { ...(body as object), ...(optimistic ?? {}) }),
    });
}

/** Remove (archive / delete) one entity by id: it disappears from lists at once and comes back if the API refuses. */
export function useEntityRemove<TData = unknown>({
    root, mutationFn, alsoInvalidate, meta,
}: { root: QueryKey; mutationFn: (id: string) => Promise<TData>; alsoInvalidate?: QueryKey[]; meta?: { errorTitle?: string; errorToast?: boolean } }) {
    return useOptimisticMutation<TData, string>({ roots: [root], alsoInvalidate, meta, mutationFn, apply: (qc, id) => removeEntity(qc, root, id) });
}
