import type { ForecastCategory } from "../../deals/interfaces/deals.interfaces";

export interface PipelineStage {
    id: string;
    pipeline_id: string;
    name: string;
    slug: string;
    sort_order: number;
    probability: number;
    forecast_category: ForecastCategory;
    is_won: boolean;
    is_lost: boolean;
    stale_after_days: number | null;
    color: string | null;
}

export interface Pipeline {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    team_id: string | null;
    is_default: boolean;
    currency: string | null;
    archived_at: string | null;
    created_at: string;
    stages: PipelineStage[];
    team?: { id: string; name: string } | null;
    _count?: { deals: number };
}

export interface StageInput {
    id?: string;
    name: string;
    probability: number;
    forecast_category?: ForecastCategory;
    is_won?: boolean;
    is_lost?: boolean;
    stale_after_days?: number;
    color?: string;
}

export interface CreatePipelineDto {
    name: string;
    description?: string;
    currency?: string;
    is_default?: boolean;
    stages?: StageInput[];
}
export type UpdatePipelineDto = Partial<Omit<CreatePipelineDto, "stages">>;
