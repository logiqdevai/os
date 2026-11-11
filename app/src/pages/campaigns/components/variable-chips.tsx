import { CommTemplateVariableOptions } from "@/config/constants/dropdowns/communications/comm-template-category-form.options";

/** Buttons that append a `{{variable}}` to the focused content field. */
export function VariableChips({ onInsert, exclude = [] }: { onInsert: (token: string) => void; exclude?: string[] }) {
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Insert:</span>
            {CommTemplateVariableOptions.filter((v) => !exclude.includes(v.id)).map((v) => (
                <button
                    key={v.id}
                    type="button"
                    onClick={() => onInsert(`{{${v.id}}}`)}
                    className="rounded-xs border border-border bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                    title={v.label}
                >
                    {`{{${v.id}}}`}
                </button>
            ))}
        </div>
    );
}
