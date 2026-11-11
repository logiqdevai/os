import { Check } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useMessaging } from "./messaging-context";
import { PersonAvatar } from "./person-avatar";

/** Searchable multi-select of organization members (Command list), used by new DM, create channel and add members. */
export function PeoplePicker({ selected, onChange, exclude = [] }: { selected: string[]; onChange: (ids: string[]) => void; exclude?: string[] }) {
    const { directory, presenceOf } = useMessaging();
    const people = directory.filter((m) => !m.is_me && !exclude.includes(m.membership_id));
    const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    return (
        <div className="space-y-2">
            {selected.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {selected.map((id) => {
                        const p = directory.find((m) => m.membership_id === id);
                        return (
                            <Badge key={id} variant="info" className="cursor-pointer" onClick={() => toggle(id)}>
                                {p?.name ?? "Member"} ×
                            </Badge>
                        );
                    })}
                </div>
            )}
            <Command className="rounded-lg border border-border">
                <CommandInput placeholder="Search people…" />
                <CommandList className="max-h-56">
                    <CommandEmpty>No one found.</CommandEmpty>
                    <CommandGroup>
                        {people.map((m) => (
                            <CommandItem key={m.membership_id} value={`${m.name} ${m.email}`} onSelect={() => toggle(m.membership_id)} className="gap-2">
                                <PersonAvatar size="sm" name={m.name} src={m.profile_photo_url} presence={presenceOf(m.membership_id)} />
                                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                                <span className="hidden truncate text-xs text-muted-foreground sm:inline">{m.job_title ?? m.email}</span>
                                <Check className={cn("size-4 text-primary", !selected.includes(m.membership_id) && "invisible")} />
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </CommandList>
            </Command>
        </div>
    );
}
