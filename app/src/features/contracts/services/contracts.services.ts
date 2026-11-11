import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    ApprovalPreview, ApprovalRule, Certificate, ContractClause, ContractComment, ContractDashboard, ContractDetail, ContractListItem, ContractTemplate, ContractType,
    ContractVersionDetail, CreateContractDto, CreateObligationDto, CreateSignatureResult, HistoryItem, LookupItem, MyApproval, Obligation, Paginated, PartyInput, PublicSigningState,
    RenewalItem, SectionInput, SignatureRequest, SigningLink, TemplateSectionDef, UpdateContractDto, UpdateObligationDto, VersionCompare,
} from "../interfaces/contracts.interfaces";

const R = ApiRoutes.contracts;
const get = async <T>(url: string, params?: Record<string, unknown>): Promise<T> => (await axiosInstance.get(url, { params })).data;
const post = async <T>(url: string, body?: unknown): Promise<T> => (await axiosInstance.post(url, body ?? {})).data;
const patch = async <T>(url: string, body: unknown): Promise<T> => (await axiosInstance.patch(url, body)).data;
const put = async <T>(url: string, body: unknown): Promise<T> => (await axiosInstance.put(url, body)).data;
const del = async <T>(url: string): Promise<T> => (await axiosInstance.delete(url)).data;

// Contracts
export const getContracts = (params: Record<string, unknown>) => get<Paginated<ContractListItem>>(R.contracts.list, params);
export const getContract = (id: string) => get<ContractDetail>(R.contracts.detail(id));
export const getContractDashboard = () => get<ContractDashboard>(R.contracts.dashboard);
export const getRenewals = (params: Record<string, unknown>) => get<Paginated<RenewalItem>>(R.contracts.renewals, params);
export const getContractHistory = (id: string) => get<{ data: HistoryItem[] }>(R.contracts.history(id));
export const lookup = (kind: "members" | "companies" | "contacts" | "projects", params: { search?: string; company_id?: string }) => get<{ data: LookupItem[] }>(R.contracts.lookup(kind), params);
export const createContract = (dto: CreateContractDto) => post<ContractDetail>(R.contracts.list, dto);
export const updateContract = ({ id, ...dto }: UpdateContractDto & { id: string }) => patch<ContractDetail>(R.contracts.detail(id), dto);
export const setParties = ({ id, parties }: { id: string; parties: PartyInput[] }) => put<ContractDetail>(R.contracts.parties(id), { parties });
export const linkProject = ({ id, project_id }: { id: string; project_id: string }) => post(R.contracts.projects(id), { project_id });
export const unlinkProject = ({ id, project_id }: { id: string; project_id: string }) => del(R.contracts.project(id, project_id));
export const archiveContract = (id: string) => post(R.contracts.archive(id));
export const restoreContract = (id: string) => post(R.contracts.restore(id));
export const deleteContract = (id: string) => del(R.contracts.detail(id));
export const renewalDecision = ({ id, ...dto }: { id: string; decision: "RENEW" | "DO_NOT_RENEW"; reason?: string }) => post(R.contracts.renewal_decision(id), dto);
export const renewContract = ({ id, ...dto }: { id: string; term_months?: number; effective_date?: string; value_change_type?: "none" | "percent" | "amount"; value_change?: number; title?: string }) => post<ContractDetail>(R.contracts.renew(id), dto);
export const amendContract = ({ id, ...dto }: { id: string; kind: "AMENDMENT" | "CHANGE_ORDER" | "SOW"; title?: string; reason?: string; effective_date?: string; value_delta?: number; changes?: { section_key: string; action: "replace" | "add" | "remove"; title?: string; text?: string }[] }) => post<ContractDetail>(R.contracts.amend(id), dto);
export const terminateContract = ({ id, ...dto }: { id: string; type: string; reason?: string; effective_date: string; notice_date?: string; notes?: string; close_obligations?: "waive" | "cancel" | "keep" }) => post<ContractDetail>(R.contracts.terminate(id), dto);

// Versions, review, approval, comments
export const getVersion = (id: string, vid: string) => get<ContractVersionDetail>(R.contracts.version(id, vid));
export const createVersion = ({ id, ...dto }: { id: string; from_version_id?: string; change_summary?: string }) => post<ContractVersionDetail>(R.contracts.versions(id), dto);
export const saveSections = ({ id, vid, sections }: { id: string; vid: string; sections: SectionInput[] }) => put<ContractVersionDetail>(R.contracts.sections(id, vid), { sections });
export const compareVersions = (id: string, from: string, to: string) => get<VersionCompare>(R.contracts.compare(id), { from, to });
export const requestReview = ({ id, vid, ...dto }: { id: string; vid: string; reviewer_membership_ids?: string[]; due_at?: string; comment?: string }) => post<ContractVersionDetail>(R.contracts.reviews(id, vid), dto);
export const decideReview = ({ id, reviewId, ...dto }: { id: string; reviewId: string; decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED"; comment?: string }) => post<ContractVersionDetail>(R.contracts.review_decision(id, reviewId), dto);
export const getApprovalPreview = (id: string, vid: string) => get<ApprovalPreview>(R.contracts.approval_preview(id, vid));
export const submitForApproval = ({ id, vid, ...dto }: { id: string; vid: string; comment?: string; steps?: { step: number; step_name?: string; approver_membership_id: string }[] }) => post<ContractVersionDetail>(R.contracts.submit_for_approval(id, vid), dto);
export const decideApproval = ({ id, approvalId, ...dto }: { id: string; approvalId: string; decision: "APPROVED" | "REJECTED"; comment?: string }) => post<ContractVersionDetail>(R.contracts.approval_decision(id, approvalId), dto);
export const getMyApprovals = () => get<{ data: MyApproval[] }>(R.my_approvals);
export const getComments = (id: string, params: Record<string, unknown>) => get<{ data: ContractComment[]; current_version_id: string | null }>(R.contracts.comments(id), params);
export const createComment = ({ id, ...dto }: { id: string; body: string; version_id?: string; section_id?: string; is_internal?: boolean; is_blocking?: boolean; parent_comment_id?: string }) => post<ContractComment>(R.contracts.comments(id), dto);
export const resolveComment = ({ id, commentId, resolved }: { id: string; commentId: string; resolved: boolean }) => patch<ContractComment>(R.contracts.comment(id, commentId), { resolved });

// Signatures
export const sendForSignature = ({ id, vid, ...dto }: { id: string; vid: string; signing_order?: "SEQUENTIAL" | "PARALLEL"; message?: string; expires_in_days?: number; signers?: { signatory_id?: string; name: string; email: string; title?: string; order?: number }[] }) =>
    post<CreateSignatureResult>(R.contracts.signature_requests(id, vid), dto);
export const getSignatureRequests = (params: Record<string, unknown>) => get<Paginated<SignatureRequest>>(R.signature_requests.list, params);
export const getSignatureRequest = (id: string) => get<SignatureRequest>(R.signature_requests.detail(id));
export const getCertificate = (id: string) => get<Certificate>(R.signature_requests.certificate(id));
export const remindSignature = (id: string) => post<{ links: SigningLink[]; email_sent: boolean; mail_configured: boolean }>(R.signature_requests.remind(id));
export const reissueLink = ({ id, signerId }: { id: string; signerId: string }) => post<SigningLink & { emailed: boolean; mail_configured: boolean }>(R.signature_requests.link(id, signerId));
export const cancelSignature = ({ id, reason }: { id: string; reason?: string }) => post<SignatureRequest>(R.signature_requests.cancel(id), { reason });

// Obligations
export const getObligations = (params: Record<string, unknown>) => get<Paginated<Obligation>>(R.obligations.list, params);
export const createObligation = (dto: CreateObligationDto) => post<Obligation>(R.obligations.list, dto);
export const updateObligation = ({ id, ...dto }: UpdateObligationDto & { id: string }) => patch<Obligation>(R.obligations.detail(id), dto);
export const fulfilObligation = (id: string) => post<Obligation>(R.obligations.fulfil(id));
export const waiveObligation = (id: string) => post<Obligation>(R.obligations.waive(id));
export const deleteObligation = (id: string) => del(R.obligations.detail(id));

// Library
export const getContractTypes = (params: Record<string, unknown>) => get<Paginated<ContractType>>(R.types.list, params);
export const createContractType = (dto: { name: string; description?: string; default_renewal_type?: string; default_notice_days?: number; default_template_id?: string }) => post<ContractType>(R.types.list, dto);
export const updateContractType = ({ id, ...dto }: { id: string; name?: string; description?: string; default_renewal_type?: string; default_notice_days?: number; default_template_id?: string }) => patch<ContractType>(R.types.detail(id), dto);
export const archiveContractType = (id: string) => post(R.types.archive(id));
export const getContractTemplates = (params: Record<string, unknown>) => get<Paginated<ContractTemplate>>(R.templates.list, params);
export const getContractTemplate = (id: string) => get<ContractTemplate>(R.templates.detail(id));
export const createContractTemplate = (dto: { name: string; description?: string; type_id?: string; sections: TemplateSectionDef[]; publish?: boolean }) => post<ContractTemplate>(R.templates.list, dto);
export const addTemplateVersion = ({ id, ...dto }: { id: string; change_summary?: string; sections: TemplateSectionDef[] }) => post(R.templates.versions(id), dto);
export const publishTemplateVersion = ({ id, vid }: { id: string; vid: string }) => post<ContractTemplate>(R.templates.publish(id, vid));
export const deprecateTemplate = (id: string) => post<ContractTemplate>(R.templates.deprecate(id));
export const getContractClauses = (params: Record<string, unknown>) => get<Paginated<ContractClause>>(R.clauses.list, params);
export const getContractClause = (id: string) => get<ContractClause>(R.clauses.detail(id));
export const createContractClause = (dto: { key: string; name: string; category: string; description?: string; text: string }) => post<ContractClause>(R.clauses.list, dto);
export const updateContractClause = ({ id, ...dto }: { id: string; name?: string; category?: string; description?: string; status?: string }) => patch<ContractClause>(R.clauses.detail(id), dto);
export const addClauseVersion = ({ id, ...dto }: { id: string; text: string; change_summary?: string }) => post<ContractClause>(R.clauses.versions(id), dto);
export const getApprovalRules = () => get<ApprovalRule[]>(R.approval_rules.list);
export const createApprovalRule = (dto: Omit<ApprovalRule, "id">) => post<ApprovalRule>(R.approval_rules.list, dto);
export const updateApprovalRule = ({ id, ...dto }: Partial<ApprovalRule> & { id: string }) => patch<ApprovalRule>(R.approval_rules.detail(id), dto);
export const deleteApprovalRule = (id: string) => del(R.approval_rules.detail(id));

// Public signing (no auth header needed; axios adds it only when signed in)
export const getSigningState = (token: string) => get<PublicSigningState>(R.public_sign.state(token));
export const sendSigningCode = (token: string) => post<{ sent: boolean; recipient: string; expires_in_seconds: number; dev_code?: string }>(R.public_sign.send_code(token), { channel: "EMAIL" });
export const verifySigningCode = ({ token, code }: { token: string; code: string }) => post<{ verified: boolean }>(R.public_sign.verify(token), { code });
export const signDocument = ({ token, ...dto }: { token: string; signature_type: "TYPED" | "DRAWN"; typed_name?: string; signature_data_url?: string; consent_accepted: boolean; consent_text_id: string }) => post<PublicSigningState>(R.public_sign.sign(token), dto);
export const declineSigning = ({ token, reason }: { token: string; reason: string }) => post<PublicSigningState>(R.public_sign.decline(token), { reason });
export const getPublicCertificate = (token: string) => get<Certificate>(R.public_sign.certificate(token));
