import type { DealStatus, ForecastCategory } from "@/features/crm/deals/interfaces/deals.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** CrmDeal.status (02 §9). */
export const DealStatusFormOptions: DropdownOption<DealStatus>[] = [
    { id: "OPEN", label: "Open" },
    { id: "WON", label: "Won" },
    { id: "LOST", label: "Lost" },
    { id: "ABANDONED", label: "Abandoned" },
];
export const DealStatusFilterOptions: DropdownOption<DealStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...DealStatusFormOptions];

/** CrmForecastCategory (02 §11). */
export const ForecastCategoryFormOptions: DropdownOption<ForecastCategory>[] = [
    { id: "PIPELINE", label: "Pipeline" },
    { id: "BEST_CASE", label: "Best case" },
    { id: "COMMIT", label: "Commit" },
    { id: "CLOSED_WON", label: "Closed won" },
    { id: "CLOSED_LOST", label: "Closed lost" },
];

/** Deals screen layouts. */
export const DealViewOptions: DropdownOption<"board" | "list">[] = [
    { id: "board", label: "Board" },
    { id: "list", label: "List" },
];
