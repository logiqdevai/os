import { useState } from "react";
import { EntityPicker } from "@/components/ui/entity-picker";
import { useProjectLookup } from "@/features/projects/hooks/use-projects";
import { useLeads } from "@/features/crm/leads/hooks/use-leads";
import { useContactLookup } from "@/features/crm/contacts/hooks/use-contacts";

interface PickerProps {
    value: string | undefined;
    onChange: (id: string | undefined) => void;
    /** The saved selection (from the event detail) so its name shows before the search results load. */
    known?: { id: string; name: string } | null;
}

function withKnown(items: { id: string; label: string; hint?: string | null }[], known?: PickerProps["known"]) {
    return known && !items.some((i) => i.id === known.id) ? [{ id: known.id, label: known.name }, ...items] : items;
}

/** Optional project (GET /projects/lookup). */
export function EventProjectPicker({ value, onChange, known }: PickerProps) {
    const [search, setSearch] = useState("");
    const q = useProjectLookup({ search: search || undefined, limit: 20 });
    const items = withKnown((q.data ?? []).map((p) => ({ id: p.id, label: p.name, hint: p.company?.name })), known);
    return <EntityPicker items={items} value={value} onChange={(id) => onChange(id ?? undefined)} onSearch={setSearch} loading={q.isFetching} placeholder="No project" ariaLabel="Project" noneLabel="No project" searchPlaceholder="Search projects…" emptyText={q.isError ? "Projects are not available to you" : "No projects found"} />;
}

/** Optional CRM lead (GET /crm/leads). */
export function EventLeadPicker({ value, onChange, known }: PickerProps) {
    const [search, setSearch] = useState("");
    const q = useLeads({ search: search || undefined, limit: 20 });
    const items = withKnown((q.data?.data ?? []).map((l) => ({ id: l.id, label: l.name, hint: l.company_name })), known);
    return <EntityPicker items={items} value={value} onChange={(id) => onChange(id ?? undefined)} onSearch={setSearch} loading={q.isFetching} placeholder="No lead" ariaLabel="Lead" noneLabel="No lead" searchPlaceholder="Search leads…" emptyText={q.isError ? "You cannot read CRM leads" : "No leads found"} />;
}

/** Optional CRM contact (GET /crm/contacts/lookup). */
export function EventContactPicker({ value, onChange, known }: PickerProps) {
    const [search, setSearch] = useState("");
    const q = useContactLookup(search);
    const items = withKnown((q.data ?? []).map((c) => ({ id: c.id, label: [c.first_name, c.last_name].filter(Boolean).join(" "), hint: [c.email, c.company?.name].filter(Boolean).join(" · ") })), known);
    return <EntityPicker items={items} value={value} onChange={(id) => onChange(id ?? undefined)} onSearch={setSearch} loading={q.isFetching} placeholder="No contact" ariaLabel="Contact" noneLabel="No contact" searchPlaceholder="Search contacts…" emptyText={q.isError ? "You cannot read CRM contacts" : "No contacts found"} />;
}
