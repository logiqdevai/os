export interface DropdownOption<T extends string = string> {
    id: T;
    label: string;
}

/** Display label for an enum value from a `config/constants/dropdowns/**` options array (falls back to the raw value). */
export function getDropdownOptionLabel<T extends string>(options: readonly DropdownOption<T>[], id: T | string | null | undefined): string {
    if (id === null || id === undefined) return "—";
    return options.find((o) => o.id === id)?.label ?? String(id);
}
