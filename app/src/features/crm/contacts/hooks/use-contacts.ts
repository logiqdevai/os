import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmArchive, useCrmMutation, useCrmRemove, useCrmUpdate, type CrmMutationMeta } from "../../common/hooks/use-crm-invalidate";
import * as service from "../services/contacts.services";

const KEY = [...CRM_KEY, "contacts"] as const;

export const useContacts = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getContacts(params), placeholderData: keepPreviousData, enabled });
export const useContact = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getContact(id as string), enabled: !!id });
export const useContactLookup = (search: string, company_id?: string, enabled = true) =>
    useQuery({ queryKey: [...KEY, "lookup", search, company_id], queryFn: () => service.lookupContacts({ search: search || undefined, company_id, limit: 20 }), enabled, placeholderData: keepPreviousData });

export const useCreateContact = (meta: CrmMutationMeta = { errorTitle: "Could not create contact" }) => useCrmMutation(service.createContact, meta);
/** Optimistic; pass display objects through `optimistic`. */
export const useUpdateContact = (meta: CrmMutationMeta = { errorTitle: "Could not update contact" }) => useCrmUpdate(KEY, service.updateContact, meta);
export const useArchiveContact = () => useCrmArchive(KEY, service.archiveContact, { errorTitle: "Could not archive contact" });
export const useDeleteContact = () => useCrmRemove(KEY, service.deleteContact, { errorTitle: "Could not delete contact" });
export const useExportContacts = () => useMutation({ mutationFn: service.exportContacts, meta: { errorTitle: "Could not export" } });
