import type { ModuleKey } from "@/config/apps/app.types";

export interface OrganizationBranding {
    primary_color?: string;
    accent_color?: string;
    logo_url?: string;
    logo_dark_url?: string;
    email_footer?: string;
    apply_to_portal?: boolean;
}

export interface OrganizationProfile {
    id: string;
    legal_name: string;
    display_name: string;
    short_name: string | null;
    slug: string;
    logo_url: string | null;
    website: string | null;
    country: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    status: string;
    default_currency: string;
    default_timezone: string;
    default_language: string;
    date_format: string | null;
    week_start: number;
    branding: OrganizationBranding | null;
    created_at: string;
}

export interface UpdateOrganizationDto {
    legal_name?: string;
    display_name?: string;
    short_name?: string;
    website?: string;
    country?: string;
    contact_email?: string;
    contact_phone?: string;
    default_currency?: string;
    default_timezone?: string;
    default_language?: string;
    date_format?: string;
    week_start?: number;
}

/** Empty string clears a field. */
export interface UpdateBrandingDto {
    primary_color?: string;
    accent_color?: string;
    logo_url?: string;
    logo_dark_url?: string;
    email_footer?: string;
    apply_to_portal?: boolean;
}

export interface OrganizationModuleRow {
    module: ModuleKey;
    enabled: boolean;
    enabled_at: string | null;
    disabled_at: string | null;
    locked: boolean;
    members_blocked: number;
    active_members: number;
}
