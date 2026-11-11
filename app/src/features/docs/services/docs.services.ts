import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    ChecklistItemInput, CreateChecklistDto, CreateFormDto, CreatePageDto, CreateSpaceDto, CreateTemplateDto, CustomForm, CustomFormDetail, DocsDirectory,
    FillableForm, FormAssignment, FormRecipient, FormSubmission, FormSummary, MyFormAssignment, Paginated, UpdateFormDto, UpdatePageDto, UpdateSpaceDto,
    WikiAcknowledgements, WikiChecklist, WikiChecklistRun, WikiChecklistRunDetail, WikiHome, WikiPageComment, WikiPageDetail, WikiPageLinks, WikiPageListItem,
    WikiPageVersion, WikiSpace, WikiSpaceDetail, WikiTemplate, WikiTreeNode,
} from "../interfaces/docs.interfaces";

const R = () => ApiRoutes.docs;
type Params = Record<string, unknown>;
const get = async <T,>(url: string, params?: Params): Promise<T> => (await axiosInstance.get(url, { params })).data;
const post = async <T,>(url: string, body?: unknown): Promise<T> => (await axiosInstance.post(url, body ?? {})).data;
const patch = async <T,>(url: string, body: unknown): Promise<T> => (await axiosInstance.patch(url, body)).data;
const put = async <T,>(url: string, body: unknown): Promise<T> => (await axiosInstance.put(url, body)).data;
const del = async <T,>(url: string): Promise<T> => (await axiosInstance.delete(url)).data;

export const getHome = () => get<WikiHome>(R().home);
export const searchPages = (params: Params) => get<Paginated<WikiPageListItem>>(R().search, params);
export const getTrash = (params: Params) => get<Paginated<WikiPageListItem>>(R().trash, params);
export const getDirectory = (search?: string) => get<DocsDirectory>(R().spaces.directory, { search });

// Spaces
export const getSpaces = (params: Params) => get<Paginated<WikiSpace>>(R().spaces.list, params);
export const getSpace = (id: string) => get<WikiSpaceDetail>(R().spaces.detail(id));
export const getSpaceTree = (id: string) => get<WikiTreeNode[]>(R().spaces.tree(id));
export const createSpace = (dto: CreateSpaceDto) => post<WikiSpace>(R().spaces.list, dto);
export const updateSpace = ({ id, ...dto }: UpdateSpaceDto & { id: string }) => patch<WikiSpace>(R().spaces.detail(id), dto);
export const archiveSpace = (id: string) => post<WikiSpace>(R().spaces.archive(id));

// Pages
export const getPages = (params: Params) => get<Paginated<WikiPageListItem>>(R().pages.list, params);
export const getPage = (id: string) => get<WikiPageDetail>(R().pages.detail(id));
export const createPage = (dto: CreatePageDto) => post<WikiPageDetail>(R().pages.list, dto);
export const updatePage = ({ id, ...dto }: UpdatePageDto & { id: string }) => patch<WikiPageDetail>(R().pages.detail(id), dto);
export const movePage = ({ id, ...dto }: { id: string; parent_page_id?: string | null; sort_order?: number }) => post(R().pages.action(id, "move"), dto);
export const pageAction = ({ id, action, body }: { id: string; action: "publish" | "unpublish" | "archive" | "unarchive" | "trash" | "restore" | "acknowledge"; body?: unknown }) => post(R().pages.action(id, action), body);
export const deletePage = (id: string) => del(R().pages.detail(id));
export const setFavorite = ({ id, on }: { id: string; on: boolean }) => (on ? post(R().pages.action(id, "favorite")) : del(R().pages.action(id, "favorite")));
export const recordView = (id: string) => post(R().pages.action(id, "view"));
export const getVersions = (id: string) => get<WikiPageVersion[]>(R().pages.versions(id));
export const getVersion = (id: string, n: number) => get<WikiPageVersion>(R().pages.version(id, n));
export const restoreVersion = ({ id, n }: { id: string; n: number }) => post(R().pages.restoreVersion(id, n));
export const getComments = (id: string) => get<WikiPageComment[]>(R().pages.comments(id));
export const addComment = ({ id, body, parent_comment_id }: { id: string; body: string; parent_comment_id?: string }) => post<WikiPageComment>(R().pages.comments(id), { body, parent_comment_id });
export const commentAction = ({ id, commentId, action }: { id: string; commentId: string; action: "resolve" | "reopen" }) => post(R().pages.commentAction(id, commentId, action));
export const deleteComment = ({ id, commentId }: { id: string; commentId: string }) => del(R().pages.comment(id, commentId));
export const getLinks = (id: string) => get<WikiPageLinks>(R().pages.links(id));
export const getAcknowledgements = (id: string) => get<WikiAcknowledgements>(R().pages.acknowledgements(id));

// Templates
export const getTemplates = (params: Params) => get<Paginated<WikiTemplate>>(R().templates.list, params);
export const createTemplate = (dto: CreateTemplateDto) => post<WikiTemplate>(R().templates.list, dto);
export const updateTemplate = ({ id, ...dto }: Partial<CreateTemplateDto> & { id: string }) => patch<WikiTemplate>(R().templates.detail(id), dto);
export const archiveTemplate = (id: string) => post(R().templates.action(id, "archive"));

// Checklists
export const getChecklists = (params: Params) => get<Paginated<WikiChecklist>>(R().checklists.list, params);
export const getChecklist = (id: string) => get<WikiChecklist>(R().checklists.detail(id));
export const createChecklist = (dto: CreateChecklistDto) => post<WikiChecklist>(R().checklists.list, dto);
export const updateChecklist = ({ id, ...dto }: Partial<Omit<CreateChecklistDto, "items">> & { id: string }) => patch<WikiChecklist>(R().checklists.detail(id), dto);
export const replaceChecklistItems = ({ id, items }: { id: string; items: ChecklistItemInput[] }) => put<WikiChecklist>(R().checklists.items(id), { items });
export const archiveChecklist = (id: string) => post(R().checklists.archive(id));
export const startChecklistRun = ({ id, subject_membership_id, due_at }: { id: string; subject_membership_id: string; due_at?: string }) => post<WikiChecklistRun>(R().checklists.runs(id), { subject_membership_id, due_at });
export const getChecklistRuns = (params: Params) => get<Paginated<WikiChecklistRun>>(R().runs.list, params);
export const getChecklistRun = (id: string) => get<WikiChecklistRunDetail>(R().runs.detail(id));
export const runItemAction = ({ id, itemId, action, reason }: { id: string; itemId: string; action: "complete" | "reopen" | "skip"; reason?: string }) => post(R().runs.item(id, itemId, action), action === "skip" ? { reason } : {});
export const cancelChecklistRun = (id: string) => post(R().runs.cancel(id));

// Forms
export const getForms = (params: Params) => get<Paginated<CustomForm>>(R().forms.list, params);
export const getAssignedForms = () => get<MyFormAssignment[]>(R().forms.assigned);
export const getForm = (id: string) => get<CustomFormDetail>(R().forms.detail(id));
export const createForm = (dto: CreateFormDto) => post<CustomForm>(R().forms.list, dto);
export const updateForm = ({ id, ...dto }: UpdateFormDto & { id: string }) => patch<CustomForm>(R().forms.detail(id), dto);
export const formAction = ({ id, action, body }: { id: string; action: "publish" | "close" | "reopen" | "archive" | "unarchive"; body?: unknown }) => post<CustomForm>(R().forms.action(id, action), body);
export const deleteForm = (id: string) => del(R().forms.detail(id));
export const getFormAssignments = (id: string) => get<FormAssignment[]>(R().forms.assignments(id));
export const getFormRecipients = (id: string) => get<FormRecipient[]>(R().forms.recipients(id));
export const createFormAssignment = ({ id, ...dto }: { id: string; target_type: string; target_id?: string; due_at?: string; message?: string }) => post<FormAssignment>(R().forms.assignments(id), dto);
export const getFillableForm = (id: string) => get<FillableForm>(R().forms.fill(id));
export const submitForm = ({ id, answers }: { id: string; answers: Record<string, unknown> }) => post(R().forms.submissions(id), { answers });
export const getFormResponses = (id: string, params: Params) => get<Paginated<FormSubmission>>(R().forms.responses(id), params);
export const getFormSummary = (id: string) => get<FormSummary>(R().forms.summary(id));
export const reviewResponse = ({ id, submissionId, status, review_notes }: { id: string; submissionId: string; status: string; review_notes?: string }) => patch(R().forms.response(id, submissionId), { status, review_notes });

// Public form (no credential)
export const getPublicForm = (id: string) => get<FillableForm>(R().publicForms.detail(id));
export const submitPublicForm = ({ id, answers }: { id: string; answers: Record<string, unknown> }) => post<{ confirmation_message?: string | null }>(R().publicForms.submit(id), { answers });
