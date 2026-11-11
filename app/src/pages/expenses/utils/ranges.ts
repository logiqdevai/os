/** Date range presets for the ledger reports (page-local helper). */
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function presetRange(preset: string): { from: string; to: string } {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    switch (preset) {
        case "this_month":
            return { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 0))) };
        case "last_month":
            return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) };
        case "this_quarter": {
            const q = Math.floor(m / 3) * 3;
            return { from: iso(new Date(Date.UTC(y, q, 1))), to: iso(new Date(Date.UTC(y, q + 3, 0))) };
        }
        case "last_year":
            return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
        default:
            return { from: `${y}-01-01`, to: `${y}-12-31` };
    }
}

export const todayIso = () => iso(new Date());
