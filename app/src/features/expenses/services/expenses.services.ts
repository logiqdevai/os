import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    Budget, BudgetDetail, ClaimList, ExpenseClaimDetail, FinancialPeriod, LedgerApprovals, LedgerCategory, LedgerDashboard, LedgerInsight, LedgerPaymentMethod, LedgerRecord,
    LedgerRecordDetail, LedgerRecordInput, LedgerRecordList, LedgerSettings, Paginated, ProfitLoss, Profitability, RecurringExpense, RecurringExpenseDetail, Supplier, SupplierDetail, VatReport,
} from "../interfaces/expenses.interfaces";

/** 09 Income & expense service functions (ledger API). */
type Params = Record<string, unknown>;
type Body = Record<string, unknown>;
const R = ApiRoutes.expenses;
const get = async <T>(url: string, params?: Params): Promise<T> => (await axiosInstance.get(url, { params })).data;
const post = async <T>(url: string, body?: unknown): Promise<T> => (await axiosInstance.post(url, body ?? {})).data;
const patch = async <T>(url: string, body: unknown): Promise<T> => (await axiosInstance.patch(url, body)).data;
const put = async <T>(url: string, body: unknown): Promise<T> => (await axiosInstance.put(url, body)).data;

export const getLedgerDashboard = (params: Params) => get<LedgerDashboard>(R.dashboard, params);
export const getRecords = (params: Params) => get<LedgerRecordList>(R.records.list, params);
export const exportRecords = async (params: Params): Promise<string> => (await axiosInstance.get(R.records.export, { params, responseType: "text" })).data;
export const getRecord = (id: string) => get<LedgerRecordDetail>(R.records.detail(id));
export const createRecord = (dto: LedgerRecordInput) => post<LedgerRecord>(R.records.list, dto);
export const updateRecord = ({ id, ...dto }: Partial<LedgerRecordInput> & { id: string }) => patch<LedgerRecord>(R.records.detail(id), dto);
export const deleteRecord = async (id: string) => (await axiosInstance.delete(R.records.detail(id))).data;
export const recordAction = ({ id, action, body }: { id: string; action: "post" | "approve" | "reject" | "void"; body?: Body }) => post<LedgerRecord>(R.records.action(id, action), body);
export const addSettlement = ({ id, ...dto }: Body & { id: string }) => post<LedgerRecord>(R.records.settlements(id), dto);
export const getLedgerApprovals = () => get<LedgerApprovals>(R.approvals);

export const getLedgerSettings = () => get<LedgerSettings>(R.settings);
export const updateLedgerSettings = (dto: Body) => patch<LedgerSettings>(R.settings, dto);
export const getCategories = (params?: Params) => get<LedgerCategory[]>(R.categories.list, params);
export const createCategory = (dto: Body) => post<LedgerCategory>(R.categories.list, dto);
export const updateCategory = ({ id, ...dto }: Body & { id: string }) => patch<LedgerCategory>(R.categories.detail(id), dto);
export const categoryAction = ({ id, action }: { id: string; action: "archive" | "restore" }) => post<LedgerCategory>(R.categories.action(id, action));
export const getPaymentMethods = () => get<LedgerPaymentMethod[]>(R.payment_methods.list);
export const createPaymentMethod = (dto: Body) => post<LedgerPaymentMethod>(R.payment_methods.list, dto);
export const archivePaymentMethod = (id: string) => post<LedgerPaymentMethod>(R.payment_methods.archive(id));

export const getSuppliers = (params: Params) => get<Paginated<Supplier>>(R.suppliers.list, params);
export const getSupplier = (id: string) => get<SupplierDetail>(R.suppliers.detail(id));
export const saveSupplierProfile = ({ id, ...dto }: Body & { id: string }) => put(R.suppliers.profile(id), dto);

export const getRecurring = (params: Params) => get<Paginated<RecurringExpense> & { monthly_total: string }>(R.recurring.list, params);
export const getRecurringOne = (id: string) => get<RecurringExpenseDetail>(R.recurring.detail(id));
export const getUpcoming = (days = 30) => get<{ recurring_expense_id: string; name: string; date: string; gross: string; currency: string; company?: string | null }[]>(R.recurring.upcoming, { days });
export const createRecurring = (dto: Body) => post<RecurringExpense>(R.recurring.list, dto);
export const updateRecurring = ({ id, ...dto }: Body & { id: string }) => patch<RecurringExpense>(R.recurring.detail(id), dto);
export const recurringAction = ({ id, action }: { id: string; action: "pause" | "resume" | "end" | "generate-now" }) => post(R.recurring.action(id, action));

export const getClaims = (params: Params) => get<ClaimList>(R.claims.list, params);
export const getClaim = (id: string) => get<ExpenseClaimDetail>(R.claims.detail(id));
export const createClaim = (dto: Body) => post<ExpenseClaimDetail>(R.claims.list, dto);
export const updateClaim = ({ id, ...dto }: Body & { id: string }) => patch<ExpenseClaimDetail>(R.claims.detail(id), dto);
export const claimAction = ({ id, action, body }: { id: string; action: "submit" | "approve" | "reject" | "pay"; body?: Body }) => post<ExpenseClaimDetail>(R.claims.action(id, action), body);

export const getBudgets = (params: Params) => get<Budget[]>(R.budgets.list, params);
export const getBudget = (id: string) => get<BudgetDetail>(R.budgets.detail(id));
export const createBudget = (dto: Body) => post<BudgetDetail>(R.budgets.list, dto);
export const updateBudget = ({ id, ...dto }: Body & { id: string }) => patch<BudgetDetail>(R.budgets.detail(id), dto);
export const deleteBudget = async (id: string) => (await axiosInstance.delete(R.budgets.detail(id))).data;

export const getPeriods = (params: Params) => get<FinancialPeriod[]>(R.periods.list, params);
export const generatePeriods = (dto: Body) => post<{ created: number }>(R.periods.generate, dto);
export const periodAction = ({ id, action }: { id: string; action: "close" | "reopen" | "lock" }) => post<FinancialPeriod>(R.periods.action(id, action));
export const createVatReturn = (dto: Body) => post(R.vat_returns.list, dto);
export const vatReturnAction = ({ id, action, body }: { id: string; action: "file" | "paid"; body?: Body }) => post(R.vat_returns.action(id, action), body);

export const getProfitLoss = (params: Params) => get<ProfitLoss>(R.reports.profit_loss, params);
export const getVatReport = (params: Params) => get<VatReport>(R.reports.vat, params);
export const getProfitability = (params: Params) => get<Profitability>(R.profitability, params);
export const getInsights = (params: Params) => get<Paginated<LedgerInsight>>(R.insights.list, params);
export const detectInsights = () => post<{ created: number }>(R.insights.detect);
export const insightAction = ({ id, action }: { id: string; action: "accept" | "dismiss" }) => post(R.insights.action(id, action));
