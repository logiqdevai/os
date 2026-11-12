import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patchEntity, removeEntity, useEntityRemove, useEntityUpdate, useOptimisticMutation } from "@/lib/query/optimistic";
import * as s from "../services/expenses.services";
import type { FinancialPeriodStatus, LedgerApprovals, LedgerCategory, LedgerSettings, RecurringExpenseStatus } from "../interfaces/expenses.interfaces";

/**
 * 09 Income & expense hooks. Mutations refresh the whole ledger cache when they settle. No success toasts (the UI shows
 * the result); failures are toasted once by the global MutationCache with the given title.
 */
const KEY = ["expenses"] as const;
type P = Record<string, unknown>;

function useLedgerMutation<TVars, TData = unknown>(fn: (v: TVars) => Promise<TData>, errorTitle = "Something went wrong", errorToast = true) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: fn,
        meta: { errorTitle, errorToast },
        onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
    });
}

export const useLedgerDashboard = (params: P) => useQuery({ queryKey: [...KEY, "dashboard", params], queryFn: () => s.getLedgerDashboard(params), placeholderData: keepPreviousData });
export const useRecords = (params: P) => useQuery({ queryKey: [...KEY, "records", params], queryFn: () => s.getRecords(params), placeholderData: keepPreviousData });
export const useRecord = (id: string | undefined) => useQuery({ queryKey: [...KEY, "record", id], queryFn: () => s.getRecord(id as string), enabled: !!id });
export const useLedgerApprovals = (enabled = true) => useQuery({ queryKey: [...KEY, "approvals"], queryFn: s.getLedgerApprovals, enabled });
export const useLedgerSettings = (enabled = true) => useQuery({ queryKey: [...KEY, "settings"], queryFn: s.getLedgerSettings, enabled });
export const useCategories = (params?: P, enabled = true) => useQuery({ queryKey: [...KEY, "categories", params], queryFn: () => s.getCategories(params), enabled, staleTime: 60_000 });
export const usePaymentMethods = (enabled = true) => useQuery({ queryKey: [...KEY, "payment-methods"], queryFn: s.getPaymentMethods, enabled, staleTime: 60_000 });
export const useSuppliers = (params: P) => useQuery({ queryKey: [...KEY, "suppliers", params], queryFn: () => s.getSuppliers(params), placeholderData: keepPreviousData });
export const useSupplier = (id: string | undefined) => useQuery({ queryKey: [...KEY, "supplier", id], queryFn: () => s.getSupplier(id as string), enabled: !!id });
export const useRecurring = (params: P) => useQuery({ queryKey: [...KEY, "recurring", params], queryFn: () => s.getRecurring(params), placeholderData: keepPreviousData });
export const useRecurringOne = (id: string | undefined) => useQuery({ queryKey: [...KEY, "recurring-one", id], queryFn: () => s.getRecurringOne(id as string), enabled: !!id });
export const useUpcoming = (days = 30, enabled = true) => useQuery({ queryKey: [...KEY, "upcoming", days], queryFn: () => s.getUpcoming(days), enabled });
export const useClaims = (params: P) => useQuery({ queryKey: [...KEY, "claims", params], queryFn: () => s.getClaims(params), placeholderData: keepPreviousData });
export const useClaim = (id: string | undefined) => useQuery({ queryKey: [...KEY, "claim", id], queryFn: () => s.getClaim(id as string), enabled: !!id });
export const useBudgets = (params: P) => useQuery({ queryKey: [...KEY, "budgets", params], queryFn: () => s.getBudgets(params) });
export const useBudget = (id: string | undefined) => useQuery({ queryKey: [...KEY, "budget", id], queryFn: () => s.getBudget(id as string), enabled: !!id });
export const usePeriods = (params: P) => useQuery({ queryKey: [...KEY, "periods", params], queryFn: () => s.getPeriods(params) });
export const useProfitLoss = (params: P) => useQuery({ queryKey: [...KEY, "pnl", params], queryFn: () => s.getProfitLoss(params), placeholderData: keepPreviousData });
export const useVatReport = (params: P) => useQuery({ queryKey: [...KEY, "vat", params], queryFn: () => s.getVatReport(params), placeholderData: keepPreviousData });
export const useProfitability = (params: P) => useQuery({ queryKey: [...KEY, "profitability", params], queryFn: () => s.getProfitability(params), placeholderData: keepPreviousData });
export const useInsights = (params: P, enabled = true) => useQuery({ queryKey: [...KEY, "insights", params], queryFn: () => s.getInsights(params), enabled });

export const useCreateRecord = () => useLedgerMutation(s.createRecord, "Could not save the record");
/** Explicit save of a posted record (an audited amendment). */
export const useUpdateRecord = () => useLedgerMutation(s.updateRecord, "Could not update the record");
/** Autosave of a draft record: failures show in the editor's <SaveStatus />, not as a toast. */
export const useAutosaveRecord = () => useLedgerMutation(s.updateRecord, "Could not save the draft", false);
export const useDeleteRecord = () => useEntityRemove({ root: KEY, mutationFn: s.deleteRecord, meta: { errorTitle: "Could not delete" } });
/** Post / approve / reject / void. Approving or rejecting removes the record from the approvals inbox at once. */
export const useRecordAction = () =>
    useOptimisticMutation({
        roots: [[...KEY, "approvals"]],
        alsoInvalidate: [KEY],
        meta: { errorTitle: "Could not update the record" },
        mutationFn: s.recordAction,
        apply: (qc, v) => {
            if (v.action === "approve" || v.action === "reject")
                qc.setQueriesData<LedgerApprovals>({ queryKey: [...KEY, "approvals"] }, (d) => (d ? { ...d, records: d.records.filter((r) => r.id !== v.id) } : d));
        },
    });
export const useAddSettlement = () => useLedgerMutation(s.addSettlement, "Could not record the payment");
/** Optimistic: switches and selects show the new value at once. */
export const useUpdateLedgerSettings = () =>
    useOptimisticMutation({
        roots: [[...KEY, "settings"]],
        alsoInvalidate: [KEY],
        meta: { errorTitle: "Could not save settings" },
        mutationFn: s.updateLedgerSettings,
        apply: (qc, dto) => qc.setQueriesData<LedgerSettings>({ queryKey: [...KEY, "settings"] }, (d) => (d ? ({ ...d, ...dto } as LedgerSettings) : d)),
    });
export const useCreateCategory = () => useLedgerMutation(s.createCategory, "Could not create the category");
export const useUpdateCategory = () => useEntityUpdate({ root: KEY, mutationFn: s.updateCategory, meta: { errorTitle: "Could not save the category" } });
/** Archive removes the category (and its subcategories) from the tree at once; restore refreshes. */
export const useCategoryAction = () =>
    useOptimisticMutation({
        roots: [[...KEY, "categories"]],
        alsoInvalidate: [KEY],
        meta: { errorTitle: "Could not update the category" },
        mutationFn: s.categoryAction,
        apply: (qc, v) => {
            if (v.action !== "archive") return;
            qc.setQueriesData<LedgerCategory[]>({ queryKey: [...KEY, "categories"] }, (d) => d?.filter((c) => c.id !== v.id && c.parent_category_id !== v.id));
        },
    });
export const useCreatePaymentMethod = () => useLedgerMutation(s.createPaymentMethod, "Could not create the payment method");
export const useArchivePaymentMethod = () => useEntityRemove({ root: [...KEY, "payment-methods"], mutationFn: s.archivePaymentMethod, alsoInvalidate: [KEY], meta: { errorTitle: "Could not archive" } });
/** Supplier ledger defaults autosave: failures show in the section's <SaveStatus />. */
export const useSaveSupplierProfile = () => useLedgerMutation(s.saveSupplierProfile, "Could not save", false);
export const useCreateRecurring = () => useLedgerMutation(s.createRecurring, "Could not create");
export const useUpdateRecurring = () => useEntityUpdate({ root: KEY, mutationFn: s.updateRecurring, meta: { errorTitle: "Could not save" } });
const RECURRING_STATUS: Partial<Record<string, RecurringExpenseStatus>> = { pause: "PAUSED", resume: "ACTIVE", end: "ENDED" };
/** Pause / resume / end show the new status at once; "generate now" refreshes when done. */
export const useRecurringAction = () =>
    useOptimisticMutation({
        roots: [KEY],
        meta: { errorTitle: "Could not update" },
        mutationFn: s.recurringAction,
        apply: (qc, v) => {
            const status = RECURRING_STATUS[v.action];
            if (status) patchEntity(qc, [...KEY, "recurring"], v.id, { status });
        },
    });
export const useCreateClaim = () => useLedgerMutation(s.createClaim, "Could not save the claim");
export const useUpdateClaim = () => useLedgerMutation(s.updateClaim, "Could not save the claim");
/** Submit / approve / reject / pay. Approving or rejecting removes the claim from the approvals inbox at once. */
export const useClaimAction = () =>
    useOptimisticMutation({
        roots: [[...KEY, "approvals"]],
        alsoInvalidate: [KEY],
        meta: { errorTitle: "Could not update the claim" },
        mutationFn: s.claimAction,
        apply: (qc, v) => {
            if (v.action === "approve" || v.action === "reject")
                qc.setQueriesData<LedgerApprovals>({ queryKey: [...KEY, "approvals"] }, (d) => (d ? { ...d, claims: d.claims.filter((c) => c.id !== v.id) } : d));
        },
    });
export const useCreateBudget = () => useLedgerMutation(s.createBudget, "Could not create the budget");
export const useUpdateBudget = () => useEntityUpdate({ root: KEY, mutationFn: s.updateBudget, meta: { errorTitle: "Could not save the budget" } });
export const useDeleteBudget = () => useEntityRemove({ root: KEY, mutationFn: s.deleteBudget, meta: { errorTitle: "Could not delete the budget" } });
export const useGeneratePeriods = () => useLedgerMutation(s.generatePeriods, "Could not create periods");
const PERIOD_STATUS: Record<string, FinancialPeriodStatus> = { close: "CLOSED", reopen: "OPEN", lock: "LOCKED" };
/** Close / reopen / lock show the new status at once. */
export const usePeriodAction = () =>
    useOptimisticMutation({
        roots: [[...KEY, "periods"]],
        alsoInvalidate: [KEY],
        meta: { errorTitle: "Could not update the period" },
        mutationFn: s.periodAction,
        apply: (qc, v) => patchEntity(qc, [...KEY, "periods"], v.id, { status: PERIOD_STATUS[v.action] }),
    });
export const useCreateVatReturn = () => useLedgerMutation(s.createVatReturn, "Could not prepare the VAT return");
/** "Mark paid" shows at once; filing refreshes. */
export const useVatReturnAction = () =>
    useOptimisticMutation({
        roots: [[...KEY, "vat"]],
        alsoInvalidate: [KEY],
        meta: { errorTitle: "Could not update the VAT return" },
        mutationFn: s.vatReturnAction,
        apply: (qc, v) => {
            if (v.action === "paid") patchEntity(qc, [...KEY, "vat"], v.id, { status: "PAID" });
        },
    });
export const useDetectInsights = () => useLedgerMutation(s.detectInsights, "Could not check the ledger");
/** Accept / dismiss: the insight leaves the list at once. */
export const useInsightAction = () =>
    useOptimisticMutation({
        roots: [[...KEY, "insights"]],
        alsoInvalidate: [KEY],
        meta: { errorTitle: "Could not update" },
        mutationFn: s.insightAction,
        apply: (qc, v) => removeEntity(qc, [...KEY, "insights"], v.id),
    });
