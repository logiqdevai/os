import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    ApprovalInbox, BillingProfile, BillingProfileDetail, CompanyLookup, Coupon, CreditNote, FinanceDashboard, FinanceReport, Invoice, InvoiceDetail, InvoiceInput,
    InvoiceListResponse, Paginated, PaymentDetail, PaymentLink, PaymentListResponse, Product, ProjectLookup, ProviderConnection, Refund, SubscriptionDetail,
    SubscriptionListResponse, TaxRate,
} from "../interfaces/billing.interfaces";

/** 08 Billing service functions (plain async wrappers over axiosInstance). */
type Params = Record<string, unknown>;
type Body = Record<string, unknown>;
const R = ApiRoutes.billing;
const get = async <T>(url: string, params?: Params): Promise<T> => (await axiosInstance.get(url, { params })).data;
const post = async <T>(url: string, body?: unknown): Promise<T> => (await axiosInstance.post(url, body ?? {})).data;
const patch = async <T>(url: string, body: unknown): Promise<T> => (await axiosInstance.patch(url, body)).data;
const put = async <T>(url: string, body: unknown): Promise<T> => (await axiosInstance.put(url, body)).data;

export const getFinanceDashboard = (params: Params) => get<FinanceDashboard>(R.dashboard, params);
export const getFinanceReport = (key: string, params: Params) => get<FinanceReport>(R.report(key), params);
export const exportFinanceReport = async (key: string, params: Params): Promise<string> => (await axiosInstance.get(R.report_export(key), { params, responseType: "text" })).data;

export const getInvoices = (params: Params) => get<InvoiceListResponse>(R.invoices.list, params);
export const getInvoice = (id: string) => get<InvoiceDetail>(R.invoices.detail(id));
export const createInvoice = (dto: InvoiceInput) => post<Invoice>(R.invoices.list, dto);
export const updateInvoice = ({ id, ...dto }: Partial<InvoiceInput> & { id: string }) => patch<Invoice>(R.invoices.detail(id), dto);
export const deleteInvoice = async (id: string) => (await axiosInstance.delete(R.invoices.detail(id))).data;
export const invoiceAction = ({ id, action, body }: { id: string; action: string; body?: Body }) => post<InvoiceDetail>(R.invoices.action(id, action), body);
export const invoiceCheckout = (id: string) => post<{ url: string; expires_at: string | null; connection: { id: string; display_name: string } }>(R.invoices.action(id, "checkout"));

export const getCreditNotes = (params: Params) => get<Paginated<CreditNote>>(R.credit_notes.list, params);
export const createCreditNote = (dto: Body) => post<CreditNote>(R.credit_notes.list, dto);
export const creditNoteAction = ({ id, action }: { id: string; action: string }) => post<CreditNote>(R.credit_notes.action(id, action));

export const getPayments = (params: Params) => get<PaymentListResponse>(R.payments.list, params);
export const getPayment = (id: string) => get<PaymentDetail>(R.payments.detail(id));
export const recordPayment = (dto: Body) => post<PaymentDetail>(R.payments.list, dto);
export const refundPayment = ({ id, ...dto }: { id: string; amount: string; reason: string }) => post<PaymentDetail>(R.payments.refunds(id), dto);
export const getRefunds = (params: Params) => get<(Refund & { payment: { id: string; currency: string; amount: string; billing_profile?: { legal_name: string } | null } })[]>(R.refunds.list, params);
export const refundDecision = ({ id, action, reason }: { id: string; action: "approve" | "reject"; reason?: string }) => post<PaymentDetail>(R.refunds.action(id, action), reason ? { reason } : {});

export const getSubscriptions = (params: Params) => get<SubscriptionListResponse>(R.subscriptions.list, params);
export const getSubscription = (id: string) => get<SubscriptionDetail>(R.subscriptions.detail(id));
export const createSubscription = (dto: Body) => post<SubscriptionDetail>(R.subscriptions.list, dto);
export const subscriptionAction = ({ id, action, body }: { id: string; action: string; body?: Body }) => post<SubscriptionDetail>(R.subscriptions.action(id, action), body);

export const getProducts = (params: Params) => get<Paginated<Product>>(R.products.list, params);
export const createProduct = (dto: Body) => post<Product>(R.products.list, dto);
export const updateProduct = ({ id, ...dto }: Body & { id: string }) => patch<Product>(R.products.detail(id), dto);
export const archiveProduct = (id: string) => post<Product>(R.products.archive(id));
export const addPrice = ({ productId, ...dto }: Body & { productId: string }) => post(R.products.prices(productId), dto);
export const updatePrice = ({ id, ...dto }: Body & { id: string }) => patch(R.prices.detail(id), dto);

export const getTaxRates = (params?: Params) => get<TaxRate[]>(R.tax_rates.list, params);
export const createTaxRate = (dto: Body) => post<TaxRate>(R.tax_rates.list, dto);
export const updateTaxRate = ({ id, ...dto }: Body & { id: string }) => patch<TaxRate>(R.tax_rates.detail(id), dto);

export const getCoupons = (params?: Params) => get<Coupon[]>(R.coupons.list, params);
export const createCoupon = (dto: Body) => post<Coupon>(R.coupons.list, dto);
export const couponAction = ({ id, action }: { id: string; action: "activate" | "deactivate" }) => post<Coupon>(R.coupons.action(id, action));

export const getBillingProfiles = (params: Params) => get<Paginated<BillingProfile>>(R.billing_profiles.list, params);
export const getBillingProfile = (id: string) => get<BillingProfileDetail>(R.billing_profiles.detail(id));
export const createBillingProfile = (dto: Body) => post<BillingProfile>(R.billing_profiles.list, dto);
export const updateBillingProfile = ({ id, ...dto }: Body & { id: string }) => patch<BillingProfile>(R.billing_profiles.detail(id), dto);

export const getProviders = () => get<ProviderConnection[]>(R.providers.list);
export const getProvider = (id: string) => get<ProviderConnection>(R.providers.detail(id));
export const connectProvider = (dto: Body) => post<ProviderConnection>(R.providers.list, dto);
export const updateProvider = ({ id, ...dto }: Body & { id: string }) => patch<ProviderConnection>(R.providers.detail(id), dto);
export const providerAction = ({ id, action }: { id: string; action: "verify" | "disconnect" }) => post<ProviderConnection>(R.providers.action(id, action));

export const getPaymentLinks = (params: Params) => get<Paginated<PaymentLink>>(R.payment_links.list, params);
export const createPaymentLink = (dto: Body) => post<PaymentLink>(R.payment_links.list, dto);
export const disablePaymentLink = (id: string) => post<PaymentLink>(R.payment_links.disable(id));

export const getApprovals = () => get<ApprovalInbox>(R.approvals);
export const getDunningPolicies = () => get<{ id: string; name: string; is_default: boolean; steps: { offset_days: number; action: string }[]; _count: { billing_profiles: number } }[]>(R.dunning.list);
export const saveDunningPolicy = ({ id, ...dto }: Body & { id?: string }) => (id ? put(R.dunning.detail(id), dto) : post(R.dunning.list, dto));

export const lookupCompanies = (search: string) => get<CompanyLookup[]>(R.company_lookup, { search, limit: 20 });
export const lookupProjects = async (search: string): Promise<ProjectLookup[]> => {
    const res = await get<{ data: ProjectLookup[] } | ProjectLookup[]>(R.projects, { search, limit: 20 });
    return Array.isArray(res) ? res : res.data;
};
