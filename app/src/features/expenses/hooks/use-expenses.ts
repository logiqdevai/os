import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import * as s from "../services/expenses.services";

/** 09 Income & expense hooks. Mutations invalidate the whole ledger cache. */
const KEY = ["expenses"] as const;
type P = Record<string, unknown>;

function useLedgerMutation<TVars, TData = unknown>(fn: (v: TVars) => Promise<TData>, success?: string, errorTitle = "Something went wrong") {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: fn,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: KEY });
            if (success) toast({ title: success });
        },
        onError: (e) => toast({ variant: "destructive", title: errorTitle, description: getApiErrorMessage(e) }),
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

export const useCreateRecord = () => useLedgerMutation(s.createRecord, "Record saved", "Could not save the record");
export const useUpdateRecord = () => useLedgerMutation(s.updateRecord, "Record updated", "Could not update the record");
export const useDeleteRecord = () => useLedgerMutation(s.deleteRecord, "Draft deleted", "Could not delete");
export const useRecordAction = () => useLedgerMutation(s.recordAction, undefined, "Could not update the record");
export const useAddSettlement = () => useLedgerMutation(s.addSettlement, "Payment recorded", "Could not record the payment");
export const useUpdateLedgerSettings = () => useLedgerMutation(s.updateLedgerSettings, "Settings saved", "Could not save settings");
export const useCreateCategory = () => useLedgerMutation(s.createCategory, "Category created", "Could not create the category");
export const useUpdateCategory = () => useLedgerMutation(s.updateCategory, "Category saved", "Could not save the category");
export const useCategoryAction = () => useLedgerMutation(s.categoryAction, "Category updated", "Could not update the category");
export const useCreatePaymentMethod = () => useLedgerMutation(s.createPaymentMethod, "Payment method created", "Could not create the payment method");
export const useArchivePaymentMethod = () => useLedgerMutation(s.archivePaymentMethod, "Payment method archived", "Could not archive");
export const useSaveSupplierProfile = () => useLedgerMutation(s.saveSupplierProfile, "Supplier defaults saved", "Could not save");
export const useCreateRecurring = () => useLedgerMutation(s.createRecurring, "Recurring expense created", "Could not create");
export const useUpdateRecurring = () => useLedgerMutation(s.updateRecurring, "Recurring expense saved", "Could not save");
export const useRecurringAction = () => useLedgerMutation(s.recurringAction, "Recurring expense updated", "Could not update");
export const useCreateClaim = () => useLedgerMutation(s.createClaim, "Expense claim saved", "Could not save the claim");
export const useUpdateClaim = () => useLedgerMutation(s.updateClaim, "Expense claim saved", "Could not save the claim");
export const useClaimAction = () => useLedgerMutation(s.claimAction, "Expense claim updated", "Could not update the claim");
export const useCreateBudget = () => useLedgerMutation(s.createBudget, "Budget created", "Could not create the budget");
export const useUpdateBudget = () => useLedgerMutation(s.updateBudget, "Budget saved", "Could not save the budget");
export const useDeleteBudget = () => useLedgerMutation(s.deleteBudget, "Budget deleted", "Could not delete the budget");
export const useGeneratePeriods = () => useLedgerMutation(s.generatePeriods, "Periods created", "Could not create periods");
export const usePeriodAction = () => useLedgerMutation(s.periodAction, "Period updated", "Could not update the period");
export const useCreateVatReturn = () => useLedgerMutation(s.createVatReturn, "VAT return prepared", "Could not prepare the VAT return");
export const useVatReturnAction = () => useLedgerMutation(s.vatReturnAction, "VAT return updated", "Could not update the VAT return");
export const useDetectInsights = () => useLedgerMutation(s.detectInsights, "Ledger checked", "Could not check the ledger");
export const useInsightAction = () => useLedgerMutation(s.insightAction, "Insight updated", "Could not update");
