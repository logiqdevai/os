import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown, Network, Users } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { useOrgChart } from "@/features/people/employees/hooks/use-employees";
import type { OrgChartNode } from "@/features/people/employees/interfaces/employees.interfaces";
import { cn } from "@/lib/utils";
import { AvailabilityBadge, PersonCell } from "../../components/person";
import { PeoplePaths } from "../../paths";

interface TreeNode extends OrgChartNode {
    children: TreeNode[];
    /** Every person below this node (direct + indirect). */
    total: number;
}

/** Builds the reporting tree from manager_employee_id. A manager outside the list (archived, terminated) makes the node a root. */
function buildTree(nodes: OrgChartNode[]) {
    const byId = new Map<string, TreeNode>(nodes.map((n) => [n.id, { ...n, children: [], total: 0 }]));
    const roots: TreeNode[] = [];
    for (const n of byId.values()) {
        const parent = n.manager_employee_id ? byId.get(n.manager_employee_id) : undefined;
        if (parent && parent.id !== n.id) parent.children.push(n);
        else roots.push(n);
    }
    const count = (n: TreeNode, depth = 0): number => {
        if (depth > 50) return 0; // defensive: the API refuses reporting cycles
        n.children.sort((a, b) => b.children.length - a.children.length || a.name.localeCompare(b.name));
        n.total = n.children.reduce((s, c) => s + 1 + count(c, depth + 1), 0);
        return n.total;
    };
    roots.forEach((r) => count(r));
    roots.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    return { roots, byId };
}

/** Ids of the matches and all their managers, so a search keeps the path to each match visible. */
function matchPaths(byId: Map<string, TreeNode>, term: string) {
    const q = term.trim().toLowerCase();
    if (!q) return null;
    const keep = new Set<string>();
    const hits = new Set<string>();
    for (const n of byId.values()) {
        const hay = [n.name, n.job_title, n.department?.name, n.employee_number].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) continue;
        hits.add(n.id);
        let cur: TreeNode | undefined = n;
        for (let i = 0; cur && i < 50; i++) {
            keep.add(cur.id);
            cur = cur.manager_employee_id ? byId.get(cur.manager_employee_id) : undefined;
        }
    }
    return { keep, hits };
}

/**
 * /people/org-chart — reporting lines from Employee.manager_employee_id.
 * Desktop: collapsible tree (no pan/zoom). Phones: drill-down list (tap a person to see their reports).
 * @perm employees.directory.read · HR profile links need employees.employees.read · @api GET /people/org-chart
 */
export default function OrgChartPage() {
    const p = usePermissions();
    const q = useOrgChart();
    const { filters, setFilter } = useListParams();
    const [term, setTerm] = useState("");
    const branch = filters.branch ?? "all";
    const nodes = useMemo(() => (q.data ?? []).filter((n) => branch === "all" || n.primary_branch?.id === branch), [q.data, branch]);
    const { roots, byId } = useMemo(() => buildTree(nodes), [nodes]);
    const branches = useMemo(() => {
        const map = new Map<string, string>();
        for (const n of q.data ?? []) if (n.primary_branch) map.set(n.primary_branch.id, n.primary_branch.name);
        return [...map].sort((a, b) => a[1].localeCompare(b[1]));
    }, [q.data]);
    const search = useMemo(() => matchPaths(byId, term), [byId, term]);
    const canOpen = p.canAny("employees.employees.read", "employees.directory.read");

    const managers = [...byId.values()].filter((n) => n.children.length);
    const avgSpan = managers.length ? managers.reduce((s, n) => s + n.children.length, 0) / managers.length : 0;
    const depth = (n: TreeNode): number => (n.children.length ? 1 + Math.max(...n.children.map(depth)) : 1);
    const levels = roots.length ? Math.max(...roots.map(depth)) : 0;

    return (
        <Page width="wide">
            <PageHeader title="Org chart" description="Reporting lines across the organization." />
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search name, title, department…" className="h-8 sm:max-w-xs" aria-label="Search the org chart" />
                {branches.length > 1 && (
                    <Select value={branch} onValueChange={(v) => setFilter("branch", v === "all" ? null : v)}>
                        <SelectTrigger className="h-8 w-full sm:w-48" aria-label="Filter by branch"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All branches</SelectItem>
                            {branches.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                )}
                {!!byId.size && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground sm:ml-auto">
                        <span><span className="tabular text-foreground">{byId.size}</span> people</span>
                        <span><span className="tabular text-foreground">{managers.length}</span> managers</span>
                        <span>avg. span <span className="tabular text-foreground">{avgSpan.toFixed(1)}</span></span>
                        <span><span className="tabular text-foreground">{levels}</span> levels</span>
                    </div>
                )}
            </div>
            {q.isLoading ? <ListSkeleton rows={8} /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !roots.length ? (
                <EmptyState icon={Network} title="No one to show" description="Add employees and set their manager to build the org chart." />
            ) : search && !search.hits.size ? (
                <EmptyState icon={Users} title="No matches" description={`Nobody matches “${term}”.`} />
            ) : (
                <>
                    <div className="hidden md:block"><TreeView roots={roots} search={search} canOpen={canOpen} /></div>
                    <div className="md:hidden"><DrillList roots={roots} byId={byId} search={search} canOpen={canOpen} /></div>
                </>
            )}
        </Page>
    );
}

// ------------------------------------------------------------------ desktop: collapsible tree

function TreeView({ roots, search, canOpen }: { roots: TreeNode[]; search: ReturnType<typeof matchPaths>; canOpen: boolean }) {
    // Collapsed set: by default everything below the second level is collapsed in large orgs.
    const [collapsed, setCollapsed] = useState<Set<string>>(() => {
        const set = new Set<string>();
        const walk = (n: TreeNode, level: number) => {
            if (level >= 2 && n.children.length) set.add(n.id);
            n.children.forEach((c) => walk(c, level + 1));
        };
        roots.forEach((r) => walk(r, 0));
        return set;
    });
    const toggle = (id: string) => setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
    const all = (open: boolean) => {
        if (open) return setCollapsed(new Set());
        const set = new Set<string>();
        const walk = (n: TreeNode) => { if (n.children.length) set.add(n.id); n.children.forEach(walk); };
        roots.forEach(walk);
        setCollapsed(set);
    };
    return (
        <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-end gap-1 border-b border-border px-3 py-2">
                <Button size="sm" variant="ghost" onClick={() => all(true)}><ChevronsUpDown /> Expand all</Button>
                <Button size="sm" variant="ghost" onClick={() => all(false)}><ChevronsDownUp /> Collapse all</Button>
            </div>
            <ul className="p-2" role="tree" aria-label="Org chart">
                {roots.filter((r) => !search || search.keep.has(r.id)).map((r) => (
                    <TreeItem key={r.id} node={r} level={0} collapsed={collapsed} onToggle={toggle} search={search} canOpen={canOpen} />
                ))}
            </ul>
        </div>
    );
}

function TreeItem({ node, level, collapsed, onToggle, search, canOpen }: {
    node: TreeNode; level: number; collapsed: Set<string>; onToggle: (id: string) => void; search: ReturnType<typeof matchPaths>; canOpen: boolean;
}) {
    const children = node.children.filter((c) => !search || search.keep.has(c.id));
    // While searching, the path to every match is open.
    const open = children.length > 0 && (search ? true : !collapsed.has(node.id));
    return (
        <li role="treeitem" aria-expanded={children.length ? open : undefined} aria-level={level + 1}>
            <div className={cn("flex items-center gap-2 rounded-md py-1.5 pr-2 hover:bg-accent", search?.hits.has(node.id) && "bg-info-soft hover:bg-info-soft")} style={{ paddingLeft: `${level * 24 + 4}px` }}>
                {children.length ? (
                    <button type="button" onClick={() => onToggle(node.id)} className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`}>
                        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </button>
                ) : <span className="size-6 shrink-0" />}
                <NodeCard node={node} canOpen={canOpen} />
            </div>
            {open && (
                <ul role="group" className="relative">
                    <span aria-hidden className="absolute bottom-2 top-0 border-l border-border" style={{ left: `${level * 24 + 16}px` }} />
                    {children.map((c) => <TreeItem key={c.id} node={c} level={level + 1} collapsed={collapsed} onToggle={onToggle} search={search} canOpen={canOpen} />)}
                </ul>
            )}
        </li>
    );
}

function NodeCard({ node, canOpen }: { node: TreeNode; canOpen: boolean }) {
    const subtitle = [node.job_title, node.department?.name].filter(Boolean).join(" · ");
    return (
        <div className="flex min-w-0 flex-1 items-center gap-3">
            <PersonCell name={node.is_me ? `${node.name} (you)` : node.name} photoUrl={node.photo_url} subtitle={subtitle || undefined} size="md" to={canOpen ? PeoplePaths.employee(node.id) : undefined} className="min-w-0 flex-1" />
            <div className="flex shrink-0 items-center gap-1.5">
                {node.employment_status === "OFFBOARDING" && <Badge variant="violet">Offboarding</Badge>}
                {node.employment_status === "ONBOARDING" && <Badge variant="info">New</Badge>}
                <span className="hidden lg:inline-flex"><AvailabilityBadge status={node.availability_status} /></span>
                {node.children.length > 0 && <Badge variant="neutral" className="tabular">{node.children.length} direct · {node.total}</Badge>}
            </div>
        </div>
    );
}

// ------------------------------------------------------------------ phones: drill-down list

function DrillList({ roots, byId, search, canOpen }: { roots: TreeNode[]; byId: Map<string, TreeNode>; search: ReturnType<typeof matchPaths>; canOpen: boolean }) {
    const [focusId, setFocusId] = useState<string | null>(null);
    const focus = focusId ? byId.get(focusId) : undefined;

    // Searching shows the matches flat with their manager, which reads better on a phone than a deep tree.
    if (search) {
        const hits = [...search.hits].map((id) => byId.get(id)!).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
        return <PersonList people={hits} byId={byId} canOpen={canOpen} onOpen={(n) => n.children.length && setFocusId(n.id)} showManager />;
    }
    const trail: TreeNode[] = [];
    for (let cur = focus; cur && trail.length < 50; cur = cur.manager_employee_id ? byId.get(cur.manager_employee_id) : undefined) trail.unshift(cur);
    const list = focus ? focus.children : roots;
    return (
        <div className="space-y-3">
            {focus && (
                <div className="rounded-lg border border-border bg-card p-3">
                    <Button size="sm" variant="ghost" className="-ml-2 mb-2" onClick={() => setFocusId(focus.manager_employee_id && byId.has(focus.manager_employee_id) ? focus.manager_employee_id : null)}>
                        <ChevronLeft /> {trail.length > 1 ? trail[trail.length - 2].name : "Top level"}
                    </Button>
                    <PersonCell name={focus.name} photoUrl={focus.photo_url} subtitle={[focus.job_title, focus.department?.name].filter(Boolean).join(" · ") || undefined} size="md" to={canOpen ? PeoplePaths.employee(focus.id) : undefined} />
                    <div className="mt-2 text-xs text-muted-foreground">{focus.children.length} direct report{focus.children.length === 1 ? "" : "s"} · {focus.total} in total</div>
                </div>
            )}
            <PersonList people={list} byId={byId} canOpen={canOpen} onOpen={(n) => n.children.length && setFocusId(n.id)} />
        </div>
    );
}

function PersonList({ people, byId, canOpen, onOpen, showManager }: { people: TreeNode[]; byId: Map<string, TreeNode>; canOpen: boolean; onOpen: (n: TreeNode) => void; showManager?: boolean }) {
    return (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {people.map((n) => {
                const manager = n.manager_employee_id ? byId.get(n.manager_employee_id) : undefined;
                const sub = showManager ? [n.job_title, manager ? `reports to ${manager.name}` : null].filter(Boolean).join(" · ") : [n.job_title, n.department?.name].filter(Boolean).join(" · ");
                return (
                    <li key={n.id} className="flex items-center gap-2 px-3 py-2.5">
                        {canOpen ? (
                            <Link to={PeoplePaths.employee(n.id)} className="min-w-0 flex-1"><PersonCell name={n.is_me ? `${n.name} (you)` : n.name} photoUrl={n.photo_url} subtitle={sub || undefined} size="md" /></Link>
                        ) : <PersonCell name={n.name} photoUrl={n.photo_url} subtitle={sub || undefined} size="md" className="flex-1" />}
                        {n.employment_status === "OFFBOARDING" && <Badge variant="violet">Offboarding</Badge>}
                        {n.children.length > 0 && (
                            <Button size="sm" variant="outline" className="shrink-0" onClick={() => onOpen(n)} aria-label={`Show reports of ${n.name}`}>
                                <span className="tabular">{n.children.length}</span><ChevronRight />
                            </Button>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
