import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as s from "../services/campaign-variants.services";

const K = ["communications", "campaigns"] as const;

/** A/B variants of a campaign; polls while the test is running. */
export const useCampaignVariants = (id: string | undefined, poll = false) =>
    useQuery({ queryKey: [...K, "variants", id], queryFn: () => s.getCampaignVariants(id as string), enabled: !!id, refetchInterval: poll ? 10_000 : false });
/** Autosaved A/B section: failures show in its <SaveStatus />. */
export const useSetCampaignVariants = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: s.setCampaignVariants, meta: { errorToast: false }, onSettled: () => qc.invalidateQueries({ queryKey: K }) });
};
/** Picking the winner is an explicit action (sends the winner to the rest); the results card shows the outcome. */
export const usePickCampaignWinner = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: s.pickCampaignWinner, meta: { errorTitle: "Could not pick the winner" }, onSettled: () => qc.invalidateQueries({ queryKey: K }) });
};
