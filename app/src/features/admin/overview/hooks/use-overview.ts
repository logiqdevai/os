import { useQuery } from "@tanstack/react-query";
import { getOverview } from "../services/overview.services";

export const useAdminOverview = () => useQuery({ queryKey: ["admin", "overview"], queryFn: getOverview });
