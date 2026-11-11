import { useState } from "react";
import { Check, Plus, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { useCreateTag, useSetTaggings, useTags } from "@/features/crm/tags/hooks/use-tags";
import type { CrmEntityType, TagRef } from "@/features/crm/common/interfaces/crm-common.interfaces";
import { TagList } from "./crm-ui";

/**
 * Tags of a record (02 §28).
 * @perm applying tags = the record's update key · creating a new tag platform.tags.manage
 * @api GET /tags?entity_type= · PUT /taggings · POST /tags
 */
export function TagEditor({ entityType, entityId, tags, canEdit }: { entityType: CrmEntityType; entityId: string; tags: TagRef[] | undefined; canEdit: boolean }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const all = useTags(entityType, open);
    const setTags = useSetTaggings();
    const createTag = useCreateTag();
    const canManage = usePermission("platform.tags.manage");
    const selected = new Set((tags ?? []).map((t) => t.id));

    const apply = (ids: string[]) =>
        setTags.mutate({ entity_type: entityType, entity_id: entityId, tag_ids: ids }, { onError: (e) => toast({ variant: "destructive", title: "Could not update tags", description: getApiErrorMessage(e) }) });

    const toggle = (id: string) => apply(selected.has(id) ? [...selected].filter((x) => x !== id) : [...selected, id]);

    const exact = all.data?.some((t) => t.name.toLowerCase() === search.trim().toLowerCase());

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <TagList tags={tags} max={8} />
            {!tags?.length && !canEdit && <span className="text-xs text-muted-foreground">No tags</span>}
            {canEdit && (
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" aria-label="Edit tags"><Tags className="size-3.5" /> {tags?.length ? "Edit" : "Add tag"}</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Find or create a tag…" value={search} onValueChange={setSearch} />
                            <CommandList>
                                <CommandEmpty>{all.isPending ? "Loading…" : "No tags"}</CommandEmpty>
                                <CommandGroup>
                                    {all.data?.map((t) => (
                                        <CommandItem key={t.id} value={t.name} onSelect={() => toggle(t.id)}>
                                            <Check className={cn("size-4", selected.has(t.id) ? "opacity-100" : "opacity-0")} />
                                            {t.name}
                                        </CommandItem>
                                    ))}
                                    {canManage && search.trim() && !exact && (
                                        <CommandItem
                                            value={`__create ${search}`}
                                            onSelect={() => createTag.mutate({ name: search.trim() }, {
                                                onSuccess: (t) => { apply([...selected, t.id]); setSearch(""); },
                                                onError: (e) => toast({ variant: "destructive", title: "Could not create tag", description: getApiErrorMessage(e) }),
                                            })}
                                        >
                                            <Plus className="size-4" /> Create “{search.trim()}”
                                        </CommandItem>
                                    )}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            )}
        </div>
    );
}
