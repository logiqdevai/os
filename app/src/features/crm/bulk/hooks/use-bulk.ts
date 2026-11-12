import { useCrmMutation } from "../../common/hooks/use-crm-invalidate";
import * as service from "../services/bulk.services";

export const useBulkAction = () => useCrmMutation(service.runBulkAction, { errorTitle: "Bulk action failed" });
