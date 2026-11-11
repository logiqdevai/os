import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { EntityPicker } from "@/components/ui/entity-picker";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { usePermission } from "@/hooks/use-permission";
import { useTaskLabels, useTaskPeople } from "@/features/tasks/hooks/use-tasks";
import { useProjectLookup } from "@/features/projects/hooks/use-projects";
import type { MemberRef, TaskPriority, TaskStatus } from "@/features/tasks/interfaces/tasks.interfaces";
import { TaskPriorityFormOptions } from "@/config/constants/dropdowns/tasks/task-form.options";
import { personName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LabelDot, PriorityGlyph, StatusIcon } from "./task-badges";

interface Common {
    disabled?: boolean;
    trigger?: ReactNode;
    className?: string;
}

export function AssigneePicker({ value, onChange, selected, ...rest }: Common & { value: string | null | undefined; onChange: (id: string | null) => void; selected?: MemberRef | null }) {
    const [search, setSearch] = useState("");
    const people = useTaskPeople(search);
    const rows = [...(people.data ?? [])];
    if (selected && !rows.some((p) => p.id === selected.id)) rows.unshift(selected);
    return (
        <EntityPicker
            {...rest}
            items={rows.map((p) => ({ id: p.id, label: personName(p.user), keywords: p.user.email, icon: <MemberAvatar person={p.user} size="xs" /> }))}
            value={value}
            onChange={onChange}
            onSearch={setSearch}
            loading={people.isFetching}
            placeholder="Unassigned"
            searchPlaceholder="Assign to…"
            noneLabel="Unassigned"
            ariaLabel="Assignee"
        />
    );
}

export function StatusPicker({ value, onChange, statuses, ...rest }: Common & { value: string | null | undefined; onChange: (id: string | null) => void; statuses: TaskStatus[] }) {
    return (
        <EntityPicker
            {...rest}
            items={statuses.map((s) => ({ id: s.id, label: s.name, icon: <StatusIcon category={s.category} color={s.color} /> }))}
            value={value}
            onChange={(v) => v && onChange(v)}
            placeholder="Status"
            searchPlaceholder="Change status…"
            ariaLabel="Status"
        />
    );
}

export function PriorityPicker({ value, onChange, ...rest }: Common & { value: TaskPriority; onChange: (p: TaskPriority) => void }) {
    return (
        <EntityPicker
            {...rest}
            items={TaskPriorityFormOptions.map((o) => ({ id: o.id, label: o.label, icon: <PriorityGlyph priority={o.id} /> }))}
            value={value}
            onChange={(v) => v && onChange(v as TaskPriority)}
            placeholder="Priority"
            searchPlaceholder="Set priority…"
            ariaLabel="Priority"
        />
    );
}

/** Project picker (needs projects.projects.read; otherwise shows the current project read-only). */
export function ProjectPicker({ value, onChange, currentName, ...rest }: Common & { value: string | null | undefined; onChange: (id: string | null) => void; currentName?: string | null }) {
    const canRead = usePermission("projects.projects.read");
    const [search, setSearch] = useState("");
    const projects = useProjectLookup({ search: search || undefined, limit: 20 }, canRead);
    const rows = (projects.data ?? []).map((p) => ({ id: p.id, label: p.name, hint: p.company?.name, keywords: p.code ?? "" }));
    if (value && currentName && !rows.some((r) => r.id === value)) rows.unshift({ id: value, label: currentName, hint: undefined, keywords: "" });
    return (
        <EntityPicker
            {...rest}
            items={rows}
            value={value}
            onChange={onChange}
            onSearch={setSearch}
            loading={projects.isFetching}
            placeholder={currentName ?? "No project"}
            searchPlaceholder="Search projects…"
            noneLabel="No project"
            disabled={rest.disabled || !canRead}
            ariaLabel="Project"
        />
    );
}

/** Multi-select labels (Popover + Command with check marks). */
export function LabelsPicker({ value, onChange, disabled, trigger }: { value: string[]; onChange: (ids: string[]) => void; disabled?: boolean; trigger: ReactNode }) {
    const labels = useTaskLabels();
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild disabled={disabled}>{trigger}</PopoverTrigger>
            <PopoverContent className="w-60 p-0" align="start">
                <Command>
                    <CommandInput placeholder="Labels…" />
                    <CommandList>
                        <CommandEmpty>No labels. Add them in Setup.</CommandEmpty>
                        <CommandGroup>
                            {(labels.data ?? []).map((l) => {
                                const on = value.includes(l.id);
                                return (
                                    <CommandItem key={l.id} value={`${l.name} ${l.id}`} onSelect={() => onChange(on ? value.filter((v) => v !== l.id) : [...value, l.id])}>
                                        <Check className={cn("size-4", on ? "opacity-100" : "opacity-0")} />
                                        <LabelDot color={l.color} />
                                        {l.name}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
