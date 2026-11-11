import { useState } from "react";
import { EntityPicker } from "@/components/ui/entity-picker";
import { useBillingProfiles, useCompanyLookup, useProjectLookup } from "@/features/billing/hooks/use-billing";

interface PickerProps {
    value: string | null | undefined;
    onChange: (id: string | null) => void;
    disabled?: boolean;
    placeholder?: string;
    noneLabel?: string;
}

/** Customer = billing profile (searchable). */
export function BillingProfilePicker({ value, onChange, disabled, placeholder = "Choose a customer", noneLabel }: PickerProps) {
    const [search, setSearch] = useState("");
    const profiles = useBillingProfiles({ search: search || undefined, limit: 30 });
    const items = (profiles.data?.data ?? []).map((p) => ({ id: p.id, label: p.legal_name, hint: p.currency, keywords: p.company?.name ?? "" }));
    return <EntityPicker items={items} value={value} onChange={onChange} onSearch={setSearch} loading={profiles.isFetching} disabled={disabled} placeholder={placeholder} ariaLabel="Customer" noneLabel={noneLabel} emptyText="No billing profiles. Create one under Customer billing." />;
}

/** CRM company (02) picker, optionally limited to a company type. */
export function CompanyPicker({ value, onChange, disabled, placeholder = "Choose a company", noneLabel, label }: PickerProps & { label?: string }) {
    const [search, setSearch] = useState("");
    const companies = useCompanyLookup(search);
    const items = (companies.data ?? []).map((c) => ({ id: c.id, label: c.name, hint: c.type?.toLowerCase() }));
    return <EntityPicker items={items} value={value} onChange={onChange} onSearch={setSearch} loading={companies.isFetching} disabled={disabled} placeholder={placeholder} ariaLabel={label ?? "Company"} noneLabel={noneLabel} emptyText={companies.isError ? "You cannot read CRM companies" : "No companies found"} />;
}

export function ProjectPicker({ value, onChange, disabled, placeholder = "No project", noneLabel = "No project" }: PickerProps) {
    const [search, setSearch] = useState("");
    const projects = useProjectLookup(search);
    const items = (projects.data ?? []).map((p) => ({ id: p.id, label: p.name }));
    return <EntityPicker items={items} value={value} onChange={onChange} onSearch={setSearch} loading={projects.isFetching} disabled={disabled} placeholder={placeholder} ariaLabel="Project" noneLabel={noneLabel} emptyText={projects.isError ? "Projects are not available to you" : "No projects found"} />;
}
