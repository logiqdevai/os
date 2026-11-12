import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { patchEntity, useEntityRemove, useEntityUpdate, useOptimisticMutation } from "@/lib/query/optimistic";
import * as s from "../services/billing.services";
import type { ApprovalInbox } from "../interfaces/billing.interfaces";

/**
 * 08 Billing query + mutation hooks. Every mutation refreshes the whole billing cache (and the ledger, which mirrors it)
 * when it settles. No success toasts (the UI shows the result); failures are toasted once by the global MutationCache
 * with the given title.
 */
const KEY = ["billing"] as const;
const LEDGER = ["expenses"] as const;
type P = Record<string, unknown>;

function useBillingMutation<TVars, TData = unknown>(fn: (v: TVars) => Promise<TData>, errorTitle = "Something went wrong", errorToast = true) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: fn,
        meta: { errorTitle, errorToast },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: KEY });
            qc.invalidateQueries({ queryKey: LEDGER });
        },
    });
}

/** Drop an invoice / refund from the cached approvals inbox (the approver sees it leave at once). */
function dropFromApprovals(qc: QueryClient, match: (i: ApprovalInbox["items"][number]) => boolean, invoiceId?: string) {
    qc.setQueriesData<ApprovalInbox>({ queryKey: [...KEY, "approvals"] }, (d) =>
        d ? { ...d, items: d.items.filter((i) => !match(i)), invoices_awaiting: invoiceId ? d.invoices_awaiting.filter((i) => i.id !== invoiceId) : d.invoices_awaiting } : d,
    );
}

// --- Queries -------------------------------------------------------------------------------------
export const useFinanceDashboard = (params: P, enabled = true) => useQuery({ queryKey: [...KEY, "dashboard", params], queryFn: () => s.getFinanceDashboard(params), enabled });
export const useFinanceReport = (key: string, params: P) => useQuery({ queryKey: [...KEY, "report", key, params], queryFn: () => s.getFinanceReport(key, params), placeholderData: keepPreviousData });
export const useInvoices = (params: P) => useQuery({ queryKey: [...KEY, "invoices", params], queryFn: () => s.getInvoices(params), placeholderData: keepPreviousData });
export const useInvoice = (id: string | undefined) => useQuery({ queryKey: [...KEY, "invoice", id], queryFn: () => s.getInvoice(id as string), enabled: !!id });
export const useCreditNotes = (params: P) => useQuery({ queryKey: [...KEY, "credit-notes", params], queryFn: () => s.getCreditNotes(params), placeholderData: keepPreviousData });
export const usePayments = (params: P, enabled = true) => useQuery({ queryKey: [...KEY, "payments", params], queryFn: () => s.getPayments(params), placeholderData: keepPreviousData, enabled });
export const usePayment = (id: string | undefined) => useQuery({ queryKey: [...KEY, "payment", id], queryFn: () => s.getPayment(id as string), enabled: !!id });
export const useRefunds = (params: P, enabled = true) => useQuery({ queryKey: [...KEY, "refunds", params], queryFn: () => s.getRefunds(params), enabled });
export const useSubscriptions = (params: P) => useQuery({ queryKey: [...KEY, "subscriptions", params], queryFn: () => s.getSubscriptions(params), placeholderData: keepPreviousData });
export const useSubscription = (id: string | undefined) => useQuery({ queryKey: [...KEY, "subscription", id], queryFn: () => s.getSubscription(id as string), enabled: !!id });
export const useProducts = (params: P, enabled = true) => useQuery({ queryKey: [...KEY, "products", params], queryFn: () => s.getProducts(params), placeholderData: keepPreviousData, enabled });
export const useTaxRates = (params?: P, enabled = true) => useQuery({ queryKey: [...KEY, "tax-rates", params], queryFn: () => s.getTaxRates(params), enabled });
export const useCoupons = (params?: P, enabled = true) => useQuery({ queryKey: [...KEY, "coupons", params], queryFn: () => s.getCoupons(params), enabled });
export const useBillingProfiles = (params: P, enabled = true) => useQuery({ queryKey: [...KEY, "profiles", params], queryFn: () => s.getBillingProfiles(params), placeholderData: keepPreviousData, enabled });
export const useBillingProfile = (id: string | undefined) => useQuery({ queryKey: [...KEY, "profile", id], queryFn: () => s.getBillingProfile(id as string), enabled: !!id });
export const useProviders = (enabled = true) => useQuery({ queryKey: [...KEY, "providers"], queryFn: s.getProviders, enabled });
export const useProvider = (id: string | undefined) => useQuery({ queryKey: [...KEY, "provider", id], queryFn: () => s.getProvider(id as string), enabled: !!id });
export const usePaymentLinks = (params: P) => useQuery({ queryKey: [...KEY, "links", params], queryFn: () => s.getPaymentLinks(params), placeholderData: keepPreviousData });
export const useBillingApprovals = (enabled = true) => useQuery({ queryKey: [...KEY, "approvals"], queryFn: s.getApprovals, enabled });
export const useDunningPolicies = (enabled = true) => useQuery({ queryKey: [...KEY, "dunning"], queryFn: s.getDunningPolicies, enabled });
export const useCompanyLookup = (search: string, enabled = true) => useQuery({ queryKey: ["crm", "lookup", search], queryFn: () => s.lookupCompanies(search), enabled, placeholderData: keepPreviousData });
export const useProjectLookup = (search: string, enabled = true) => useQuery({ queryKey: ["projects", "lookup", search], queryFn: () => s.lookupProjects(search), enabled, placeholderData: keepPreviousData, retry: false });

// --- Mutations ------------------------------------------------------------------------------------
export const useCreateInvoice = () => useBillingMutation(s.createInvoice, "Could not create the invoice");
/** Used by the autosaving draft editor: failures show in its <SaveStatus />, not as a toast. */
export const useUpdateInvoice = () => useBillingMutation(s.updateInvoice, "Could not save the invoice", false);
export const useDeleteInvoice = () => useEntityRemove({ root: KEY, mutationFn: s.deleteInvoice, alsoInvalidate: [LEDGER], meta: { errorTitle: "Could not delete the draft" } });
/** The browser download is the feedback. */
export const useDownloadInvoicePdf = () => useMutation({ mutationFn: s.downloadInvoicePdf, meta: { errorTitle: "Could not create the PDF" } });
/** Lifecycle actions. Approving removes the invoice from the approvals inbox at once. */
export const useInvoiceAction = () =>
    useOptimisticMutation({
        roots: [[...KEY, "approvals"]],
        alsoInvalidate: [KEY, LEDGER],
        meta: { errorTitle: "Could not update the invoice" },
        mutationFn: s.invoiceAction,
        apply: (qc, v) => { if (v.action === "approve") dropFromApprovals(qc, (i) => i.invoice?.id === v.id || i.entity_id === v.id, v.id); },
    });
export const useInvoiceCheckout = () => useBillingMutation(s.invoiceCheckout, "Could not create the payment link");
export const useCreateCreditNote = () => useBillingMutation(s.createCreditNote, "Could not create the credit note");
export const useCreditNoteAction = () => useBillingMutation(s.creditNoteAction, "Could not update the credit note");
export const useRecordPayment = () => useBillingMutation(s.recordPayment, "Could not record the payment");
export const useRefundPayment = () => useBillingMutation(s.refundPayment, "Could not refund");
/** Approve / reject a refund: it leaves the approvals inbox at once. */
export const useRefundDecision = () =>
    useOptimisticMutation({
        roots: [[...KEY, "approvals"]],
        alsoInvalidate: [KEY, LEDGER],
        meta: { errorTitle: "Could not update the refund" },
        mutationFn: s.refundDecision,
        apply: (qc, v) => dropFromApprovals(qc, (i) => i.entity_id === v.id || i.refund?.id === v.id),
    });
export const useCreateSubscription = () => useBillingMutation(s.createSubscription, "Could not create the subscription");
export const useSubscriptionAction = () => useBillingMutation(s.subscriptionAction, "Could not update the subscription");
export const useCreateProduct = () => useBillingMutation(s.createProduct, "Could not create the product");
export const useUpdateProduct = () => useEntityUpdate({ root: KEY, mutationFn: s.updateProduct, alsoInvalidate: [LEDGER], meta: { errorTitle: "Could not save the product" } });
export const useArchiveProduct = () => useEntityRemove({ root: [...KEY, "products"], mutationFn: s.archiveProduct, alsoInvalidate: [KEY], meta: { errorTitle: "Could not archive" } });
export const useAddPrice = () => useBillingMutation(s.addPrice, "Could not add the price");
export const useCreateTaxRate = () => useBillingMutation(s.createTaxRate, "Could not create the tax rate");
/** Optimistic: the rate row (and the active switch) change at once. */
export const useUpdateTaxRate = () => useEntityUpdate({ root: KEY, mutationFn: s.updateTaxRate, alsoInvalidate: [LEDGER], meta: { errorTitle: "Could not save the tax rate" } });
export const useCreateCoupon = () => useBillingMutation(s.createCoupon, "Could not create the coupon");
/** Optimistic activate / deactivate. */
export const useCouponAction = () =>
    useOptimisticMutation({
        roots: [KEY],
        meta: { errorTitle: "Could not update the coupon" },
        mutationFn: s.couponAction,
        apply: (qc, v) => patchEntity(qc, KEY, v.id, { is_active: v.action === "activate" }),
    });
export const useCreateBillingProfile = () => useBillingMutation(s.createBillingProfile, "Could not create the profile");
/** Autosaved edit form: failures show in its <SaveStatus />. */
export const useUpdateBillingProfile = () => useEntityUpdate({ root: KEY, mutationFn: s.updateBillingProfile, meta: { errorTitle: "Could not save the profile", errorToast: false } });
export const useConnectProvider = () => useBillingMutation(s.connectProvider, "Could not connect the provider", false);
export const useUpdateProvider = () => useEntityUpdate({ root: KEY, mutationFn: s.updateProvider, meta: { errorTitle: "Could not save the connection" } });
/** Verify / disconnect: the card shows the new status and last error (no toast). Disconnect is optimistic. */
export const useProviderAction = () =>
    useOptimisticMutation({
        roots: [[...KEY, "providers"]],
        meta: { errorTitle: "Could not update the connection" },
        mutationFn: s.providerAction,
        apply: (qc, v) => { if (v.action === "disconnect") patchEntity(qc, [...KEY, "providers"], v.id, { status: "DISCONNECTED" }); },
    });
export const useCreatePaymentLink = () => useBillingMutation(s.createPaymentLink, "Could not create the link");
/** Optimistic: the link shows Disabled at once. */
export const useDisablePaymentLink = () =>
    useOptimisticMutation({
        roots: [[...KEY, "links"]],
        meta: { errorTitle: "Could not disable the link" },
        mutationFn: s.disablePaymentLink,
        apply: (qc, id) => patchEntity(qc, [...KEY, "links"], id, { status: "DISABLED" }),
    });
export const useSaveDunningPolicy = () => useBillingMutation(s.saveDunningPolicy, "Could not save the policy");
