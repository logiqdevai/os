import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as s from "../services/campaign-variants.services";

const K = ["communications", "campaigns"] as const;

function useInvalidate() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: K });
}

/** A/B variants of a campaign; polls while the test is running. */
export const useCampaignVariants = (id: string | undefined, poll = false) =>
    useQuery({ queryKey: [...K, "variants", id], queryFn: () => s.getCampaignVariants(id as string), enabled: !!id, refetchInterval: poll ? 10_000 : false });
export const useSetCampaignVariants = () => useMutation({ mutationFn: s.setCampaignVariants, onSuccess: useInvalidate() });
export const usePickCampaignWinner = () => useMutation({ mutationFn: s.pickCampaignWinner, onSuccess: useInvalidate() });
