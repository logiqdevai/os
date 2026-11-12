export type DiffOp = { type: "equal" | "add" | "remove"; line: string };

/** Line diff (LCS) from `before` to `after`. Inputs above ~4k lines fall back to remove-all / add-all. */
export function diffLines(before: string, after: string): DiffOp[] {
    const a = before.split("\n");
    const b = after.split("\n");
    if (a.length * b.length > 16_000_000) return [...a.map((line) => ({ type: "remove" as const, line })), ...b.map((line) => ({ type: "add" as const, line }))];
    const n = a.length;
    const m = b.length;
    const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    const ops: DiffOp[] = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (a[i] === b[j]) { ops.push({ type: "equal", line: a[i] }); i++; j++; }
        else if (lcs[i + 1][j] >= lcs[i][j + 1]) ops.push({ type: "remove", line: a[i++] });
        else ops.push({ type: "add", line: b[j++] });
    }
    while (i < n) ops.push({ type: "remove", line: a[i++] });
    while (j < m) ops.push({ type: "add", line: b[j++] });
    return ops;
}

/**
 * Merge draft: identical lines are kept once; every block where the two versions differ is wrapped in conflict markers
 * (theirs first, then yours) so the editor can resolve it by hand.
 */
export function mergeWithMarkers(theirs: string, mine: string, theirLabel: string): { text: string; conflicts: number } {
    const ops = diffLines(theirs, mine);
    const out: string[] = [];
    let conflicts = 0;
    for (let k = 0; k < ops.length;) {
        if (ops[k].type === "equal") { out.push(ops[k].line); k++; continue; }
        const removed: string[] = [];
        const added: string[] = [];
        while (k < ops.length && ops[k].type !== "equal") {
            if (ops[k].type === "remove") removed.push(ops[k].line);
            else added.push(ops[k].line);
            k++;
        }
        conflicts++;
        out.push(`<<<<<<< ${theirLabel}`, ...removed, "=======", ...added, ">>>>>>> Your changes");
    }
    return { text: out.join("\n"), conflicts };
}
