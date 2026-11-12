import { z } from "zod";

export const customFieldFormSchema = z.object({
    key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,49}$/, "Use snake_case: a letter, then letters, digits or underscores"),
    label: z.string().trim().min(1, "Enter a label").max(120),
    description: z.string().max(500).optional(),
    type: z.string().min(1),
    entity_types: z.array(z.string()).min(1, "Pick at least one record type"),
    group_id: z.string().optional(),
    is_required: z.boolean(),
    /** One option per line: `value | Label` or just `Label`. */
    options_text: z.string().optional(),
    min: z.string().optional(),
    max: z.string().optional(),
});
export type CustomFieldFormValues = z.infer<typeof customFieldFormSchema>;

/** `Label` or `value | Label` per line → options (value derived from the label when omitted). */
export function parseOptionsText(text: string | undefined) {
    return (text ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
            const [a, b] = line.split("|").map((s) => s.trim());
            const label = b || a;
            const value = b ? a : a.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || a;
            return { value, label };
        });
}

export const optionsToText = (options: { value: string; label: string }[] | null | undefined) =>
    (options ?? []).map((o) => (o.value === o.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") ? o.label : `${o.value} | ${o.label}`)).join("\n");

export const keyFromLabel = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "f_$1").slice(0, 50);
