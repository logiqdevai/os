import type { FolderTemplateNode } from "@/features/files/interfaces/files.interfaces";

const CUSTOMER_TAG = /\s*\(customer\)\s*$/i;

/**
 * Indented outline ⇄ folder tree. Two spaces (or a tab) per level; "(customer)" at the end of a line marks a folder
 * that is visible in the Customer Portal.
 */
export function outlineToTree(text: string): { tree: FolderTemplateNode[]; error: string | null } {
    const root: FolderTemplateNode[] = [];
    const stack: { depth: number; node: FolderTemplateNode }[] = [];
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i].replace(/\t/g, "  ");
        if (!raw.trim()) continue;
        const depth = Math.floor((raw.length - raw.trimStart().length) / 2);
        let name = raw.trim().replace(/^[-*•]\s*/, "");
        const customer = CUSTOMER_TAG.test(name);
        name = name.replace(CUSTOMER_TAG, "").trim();
        if (!name) continue;
        if (/[\\/:*?"<>|]/.test(name)) return { tree: [], error: `Line ${i + 1}: folder names cannot contain \\ / : * ? " < > |` };
        if (name.length > 120) return { tree: [], error: `Line ${i + 1}: name is longer than 120 characters` };
        const node: FolderTemplateNode = { name, ...(customer ? { customer_visible: true } : {}) };
        while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
        if (stack.length && depth > stack[stack.length - 1].depth + 1) return { tree: [], error: `Line ${i + 1}: indented more than one level below its parent` };
        if (!stack.length && depth > 0) return { tree: [], error: `Line ${i + 1}: the first folder cannot be indented` };
        const parent = stack[stack.length - 1]?.node;
        if (parent) (parent.children ??= []).push(node);
        else root.push(node);
        stack.push({ depth, node });
    }
    return { tree: root, error: root.length ? null : "Add at least one folder" };
}

export function treeToOutline(nodes: FolderTemplateNode[], depth = 0): string {
    return nodes.map((n) => `${"  ".repeat(depth)}${n.name}${n.customer_visible ? " (customer)" : ""}${n.children?.length ? `\n${treeToOutline(n.children, depth + 1)}` : ""}`).join("\n");
}
