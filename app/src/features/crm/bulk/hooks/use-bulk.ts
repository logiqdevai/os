import { useMutation } from "@tanstack/react-query";
import { useCrmInvalidate } from "../../common/hooks/use-crm-invalidate";
import * as service from "../services/bulk.services";

export const useBulkAction = () => useMutation({ mutationFn: service.runBulkAction, onSuccess: useCrmInvalidate() });
