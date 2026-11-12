import type { CommChannel, CommConsentStatus } from "./communications.interfaces";

/** 11 preference-center topic (CommTopic) with subscriber counts. */
export interface CommTopic {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    channel: CommChannel | null;
    default_opt_in: boolean;
    sort_order: number;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
    campaign_count?: number;
    subscribed_count?: number;
    unsubscribed_count?: number;
}

export interface CommTopicInput {
    name: string;
    slug?: string;
    description?: string | null;
    channel?: CommChannel | null;
    default_opt_in?: boolean;
    sort_order?: number;
}

export interface ContactTopicSubscriptions {
    contact: { id: string; first_name: string; last_name: string | null; email: string | null };
    topics: { topic: CommTopic; status: CommConsentStatus; source: string | null; updated_at: string | null; effective: boolean }[];
}
