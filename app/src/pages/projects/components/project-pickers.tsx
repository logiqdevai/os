import { useState } from "react";
import { EntityPicker } from "@/components/ui/entity-picker";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { useProjectPeople } from "@/features/projects/hooks/use-projects";
import { useCompanyLookup } from "@/features/crm/companies/hooks/use-companies";
import { usePermission } from "@/hooks/use-permission";
import { personName } from "@/lib/format";
import type { MemberRef } from "@/features/projects/interfaces/projects.interfaces";

interface PickerProps {
    value: string | null | undefined;
    onChange: (id: string | null) => void;
    placeholder?: string;
    noneLabel?: string;
    disabled?: boolean;
    /** Show this person even before the list has loaded (e.g. the current owner). */
    selected?: MemberRef | null;
}

/** Owner / member picker (active members of the organization). */
export function PersonPicker({ value, onChange, placeholder = "Choose a person", noneLabel, disabled, selected }: PickerProps) {
    const [search, setSearch] = useState("");
    const people = useProjectPeople(search);
    const rows = [...(people.data ?? [])];
    if (selected && !rows.some((p) => p.id === selected.id)) rows.unshift(selected);
    return (
        <EntityPicker
            items={rows.map((p) => ({ id: p.id, label: personName(p.user), keywords: p.user.email, icon: <MemberAvatar person={p.user} size="xs" />, hint: p.job_title ?? undefined }))}
            value={value}
            onChange={onChange}
            onSearch={setSearch}
            loading={people.isFetching}
            placeholder={placeholder}
            searchPlaceholder="Search people…"
            noneLabel={noneLabel}
            disabled={disabled}
            ariaLabel={placeholder}
        />
    );
}

/** Customer picker (CRM companies). Hidden behind crm.companies.read; shows the current customer otherwise. */
export function CustomerPicker({ value, onChange, currentName, disabled }: { value: string | null | undefined; onChange: (id: string | null) => void; currentName?: string | null; disabled?: boolean }) {
    const canRead = usePermission("crm.companies.read");
    const [search, setSearch] = useState("");
    const companies = useCompanyLookup(search, canRead);
    const rows = (companies.data ?? []).map((c) => ({ id: c.id, label: c.name, keywords: c.website ?? "" }));
    if (value && currentName && !rows.some((r) => r.id === value)) rows.unshift({ id: value, label: currentName, keywords: "" });
    return (
        <EntityPicker
            items={rows}
            value={value}
            onChange={onChange}
            onSearch={setSearch}
            loading={companies.isFetching}
            placeholder={canRead ? "Internal project (no customer)" : currentName ?? "Internal project"}
            searchPlaceholder="Search customers…"
            noneLabel="Internal project (no customer)"
            disabled={disabled || !canRead}
            ariaLabel="Customer"
        />
    );
}
