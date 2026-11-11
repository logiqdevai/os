import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmInvalidate } from "../../common/hooks/use-crm-invalidate";
import * as service from "../services/contacts.services";

const KEY = [...CRM_KEY, "contacts"] as const;

export const useContacts = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getContacts(params), placeholderData: keepPreviousData, enabled });
export const useContact = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getContact(id as string), enabled: !!id });
export const useContactLookup = (search: string, company_id?: string, enabled = true) =>
    useQuery({ queryKey: [...KEY, "lookup", search, company_id], queryFn: () => service.lookupContacts({ search: search || undefined, company_id, limit: 20 }), enabled, placeholderData: keepPreviousData });

export const useCreateContact = () => useMutation({ mutationFn: service.createContact, onSuccess: useCrmInvalidate() });
export const useUpdateContact = () => useMutation({ mutationFn: service.updateContact, onSuccess: useCrmInvalidate() });
export const useArchiveContact = () => useMutation({ mutationFn: service.archiveContact, onSuccess: useCrmInvalidate() });
export const useDeleteContact = () => useMutation({ mutationFn: service.deleteContact, onSuccess: useCrmInvalidate() });
export const useExportContacts = () => useMutation({ mutationFn: service.exportContacts });
