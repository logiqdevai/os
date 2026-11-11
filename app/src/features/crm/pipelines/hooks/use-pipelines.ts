import { useMutation, useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmInvalidate } from "../../common/hooks/use-crm-invalidate";
import * as service from "../services/pipelines.services";

const KEY = [...CRM_KEY, "pipelines"] as const;

export const usePipelines = (enabled = true) => useQuery({ queryKey: [...KEY, "active"], queryFn: () => service.getPipelines(), staleTime: 60_000, enabled });

export const useCreatePipeline = () => useMutation({ mutationFn: service.createPipeline, onSuccess: useCrmInvalidate() });
export const useUpdatePipeline = () => useMutation({ mutationFn: service.updatePipeline, onSuccess: useCrmInvalidate() });
export const useReplaceStages = () => useMutation({ mutationFn: service.replaceStages, onSuccess: useCrmInvalidate() });
export const useArchivePipeline = () => useMutation({ mutationFn: service.archivePipeline, onSuccess: useCrmInvalidate() });
