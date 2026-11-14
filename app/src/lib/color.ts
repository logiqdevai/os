export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const TOKENS = ["info", "success", "warning", "danger", "violet", "ash"] as const;
/** Hex shown in a color picker when the stored value is a legacy semantic token name. */
const TOKEN_HEX: Record<string, string> = { neutral: "#8a8a93", ash: "#8a8a93", info: "#0b72b5", success: "#12804f", warning: "#9a6200", danger: "#d02f2f", violet: "#6d4bd1" };

/** Stored color (user-picked hex, or a semantic token name from seed data) → CSS color. `undefined` when unset. */
export function cssColor(color: string | null | undefined): string | undefined {
    if (!color) return undefined;
    if (HEX_COLOR.test(color)) return color;
    if ((TOKENS as readonly string[]).includes(color)) return `var(--${color})`;
    if (color === "neutral") return "var(--ash)";
    return undefined;
}

/** Stored color → `#rrggbb` for `<input type="color">`. */
export const pickerHex = (color: string | null | undefined, fallback = "#8a8a93") => (color && HEX_COLOR.test(color) ? color.toLowerCase() : (color && TOKEN_HEX[color]) || fallback);
