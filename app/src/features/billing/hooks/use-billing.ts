import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import * as s from "../services/billing.services";

/** 08 Billing query + mutation hooks. Every mutation invalidates the whole billing cache (and the ledger, which mirrors it). */
const KEY = ["billing"] as const;
type P = Record<string, unknown>;

function useBillingMutation<TVars, TData = unknown>(fn: (v: TVars) => Promise<TData>, success?: string | ((d: TData) => string), errorTitle = "Something went wrong") {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: fn,
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: KEY });
            qc.invalidateQueries({ queryKey: ["expenses"] });
            if (success) toast({ title: typeof success === "function" ? success(data) : success });
        },
        onError: (e) => toast({ variant: "destructive", title: errorTitle, description: getApiErrorMessage(e) }),
    });
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
export const useCreateInvoice = () => useBillingMutation(s.createInvoice, "Draft invoice created", "Could not create the invoice");
export const useUpdateInvoice = () => useBillingMutation(s.updateInvoice, "Invoice saved", "Could not save the invoice");
export const useDeleteInvoice = () => useBillingMutation(s.deleteInvoice, "Draft deleted", "Could not delete the draft");
export const useDownloadInvoicePdf = () => useBillingMutation(s.downloadInvoicePdf, (name) => `Downloaded ${name}`, "Could not create the PDF");
export const useInvoiceAction = () => useBillingMutation(s.invoiceAction, undefined, "Could not update the invoice");
export const useInvoiceCheckout = () => useBillingMutation(s.invoiceCheckout, "Payment link created", "Could not create the payment link");
export const useCreateCreditNote = () => useBillingMutation(s.createCreditNote, "Credit note created", "Could not create the credit note");
export const useCreditNoteAction = () => useBillingMutation(s.creditNoteAction, "Credit note updated", "Could not update the credit note");
export const useRecordPayment = () => useBillingMutation(s.recordPayment, "Payment recorded", "Could not record the payment");
export const useRefundPayment = () => useBillingMutation(s.refundPayment, "Refund requested", "Could not refund");
export const useRefundDecision = () => useBillingMutation(s.refundDecision, "Refund updated", "Could not update the refund");
export const useCreateSubscription = () => useBillingMutation(s.createSubscription, "Subscription created", "Could not create the subscription");
export const useSubscriptionAction = () => useBillingMutation(s.subscriptionAction, "Subscription updated", "Could not update the subscription");
export const useCreateProduct = () => useBillingMutation(s.createProduct, "Product created", "Could not create the product");
export const useUpdateProduct = () => useBillingMutation(s.updateProduct, "Product saved", "Could not save the product");
export const useArchiveProduct = () => useBillingMutation(s.archiveProduct, "Product archived", "Could not archive");
export const useAddPrice = () => useBillingMutation(s.addPrice, "Price added", "Could not add the price");
export const useCreateTaxRate = () => useBillingMutation(s.createTaxRate, "Tax rate created", "Could not create the tax rate");
export const useUpdateTaxRate = () => useBillingMutation(s.updateTaxRate, "Tax rate saved", "Could not save the tax rate");
export const useCreateCoupon = () => useBillingMutation(s.createCoupon, "Coupon created", "Could not create the coupon");
export const useCouponAction = () => useBillingMutation(s.couponAction, "Coupon updated", "Could not update the coupon");
export const useCreateBillingProfile = () => useBillingMutation(s.createBillingProfile, "Billing profile created", "Could not create the profile");
export const useUpdateBillingProfile = () => useBillingMutation(s.updateBillingProfile, "Billing profile saved", "Could not save the profile");
export const useConnectProvider = () => useBillingMutation(s.connectProvider, "Payment provider connected", "Could not connect the provider");
export const useUpdateProvider = () => useBillingMutation(s.updateProvider, "Connection saved", "Could not save the connection");
export const useProviderAction = () => useBillingMutation(s.providerAction, undefined, "Could not update the connection");
export const useCreatePaymentLink = () => useBillingMutation(s.createPaymentLink, "Payment link created", "Could not create the link");
export const useDisablePaymentLink = () => useBillingMutation(s.disablePaymentLink, "Payment link disabled", "Could not disable the link");
export const useSaveDunningPolicy = () => useBillingMutation(s.saveDunningPolicy, "Dunning policy saved", "Could not save the policy");
