import { useState } from "react";
import { Archive, BadgeCheck, MoreHorizontal, Plus, Search, Tags } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { useAssignSkill, useArchiveSkill, useCreateSkill, useSkillSearch, useSkills } from "@/features/people/skills/hooks/use-skills";
import { useMyEmployee } from "@/features/people/employees/hooks/use-employees";
import type { Skill, SkillCategory, SkillProficiency } from "@/features/people/skills/interfaces/skills.interfaces";
import {
    SkillCategoryFilterOptions, SkillCategoryFormOptions, SkillProficiencyFilterOptions, SkillProficiencyFormOptions,
} from "@/config/constants/dropdowns/people/performance-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { AvailabilityBadge, PersonCell } from "../../components/person";
import { PeoplePaths } from "../../paths";

/**
 * /people/skills — skill catalogue (employees.skills.read / manage) and "Find people" staffing search.
 * @api GET /people/skills · POST /people/skills · GET /people/skills/search · POST /people/employees/:id/skills
 */
export default function SkillsPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const tab = filters.tab === "find" ? "find" : "catalogue";
    const canManage = usePermission("employees.skills.manage");
    const canOwn = usePermission("employees.profile.update_own");
    const me = useMyEmployee(canOwn);
    const skills = useSkills({ ...params, tab: undefined, limit: 50 }, tab === "catalogue");
    const archive = useArchiveSkill();
    const [creating, setCreating] = useState(false);
    const [adding, setAdding] = useState<Skill | null>(null);

    const columns: DataTableColumn<Skill>[] = [
        { key: "name", header: "Skill", cell: (s) => <span className="font-medium text-foreground">{s.name}</span> },
        { key: "category", header: "Category", cell: (s) => <Badge>{getDropdownOptionLabel(SkillCategoryFormOptions, s.category)}</Badge>, hideBelow: "sm" },
        { key: "people", header: "People", cell: (s) => <span className="tabular">{s._count.employees}</span>, className: "text-right", headerClassName: "text-right" },
        {
            key: "actions", header: <span className="sr-only">Actions</span>, className: "w-10",
            cell: (s) => (canManage || (canOwn && me.data)) && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${s.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {canOwn && me.data && <DropdownMenuItem onSelect={() => setAdding(s)}><Plus /> Add to my profile</DropdownMenuItem>}
                        {canManage && <DropdownMenuItem onSelect={() => setFilter("skill", s.id)}><Search /> Find people</DropdownMenuItem>}
                        {canManage && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => archive.mutate(s.id)}><Archive /> Archive</DropdownMenuItem>}
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Skills"
                description="The skill catalogue and who has which skills, for staffing projects."
                actions={<Can permission="employees.skills.manage"><Button onClick={() => setCreating(true)}><Plus /> New skill</Button></Can>}
            />
            <Tabs value={tab} onValueChange={(v) => setFilter("tab", v === "catalogue" ? null : v)} className="mb-3">
                <TabsList><TabsTrigger value="catalogue">Catalogue</TabsTrigger><TabsTrigger value="find">Find people</TabsTrigger></TabsList>
            </Tabs>
            {tab === "catalogue" ? (
                <>
                    <TableToolbar search={search} onSearch={setSearch} placeholder="Search skills…">
                        <Select value={filters.category ?? "all"} onValueChange={(v) => setFilter("category", v)}>
                            <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Filter by category"><SelectValue /></SelectTrigger>
                            <SelectContent>{SkillCategoryFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </TableToolbar>
                    <DataTable columns={columns} data={skills.data?.data} rowKey={(s) => s.id} loading={skills.isFetching} error={skills.error} onRetry={() => skills.refetch()} pagination={skills.data?.pagination} onPageChange={setPage}
                        empty={{ icon: Tags, title: search ? "No skills match" : "No skills yet", description: "Build a catalogue of technologies, languages and specializations." }} />
                </>
            ) : <FindPeople />}
            <CreateSkillDialog open={creating} onOpenChange={setCreating} />
            <AddSkillDialog skill={adding} employeeId={me.data?.id} onClose={() => setAdding(null)} />
        </Page>
    );
}

function FindPeople() {
    const { filters, setFilter, setPage, params } = useListParams();
    const all = useSkills({ limit: 200 });
    const skillId = filters.skill;
    const level = filters.level ?? "all";
    const q = useSkillSearch({ page: params.page, limit: 24, ...(skillId && { skill_ids: skillId }), ...(level !== "all" && { min_proficiency: level }) }, !!skillId);
    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={skillId ?? ""} onValueChange={(v) => setFilter("skill", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-64" aria-label="Skill"><SelectValue placeholder="Pick a skill" /></SelectTrigger>
                    <SelectContent>{all.data?.data.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={level} onValueChange={(v) => setFilter("level", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Minimum level"><SelectValue /></SelectTrigger>
                    <SelectContent>{SkillProficiencyFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            {!skillId ? <EmptyState icon={Search} title="Pick a skill" description="See who has it, at which level, and whether they are available." /> : q.isLoading ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.data.length ? (
                <EmptyState icon={Search} title="No one matches" description="Lower the minimum level or pick another skill." />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {q.data.data.map((m) => {
                        const match = m.skills.find((s) => s.skill_id === skillId);
                        return (
                            <div key={m.id} className="rounded-lg border border-border bg-card p-4">
                                <div className="flex items-start justify-between gap-2">
                                    <PersonCell name={m.name} photoUrl={m.photo_url} subtitle={m.job_title} to={PeoplePaths.employee(m.id, "skills")} size="md" />
                                    <AvailabilityBadge status={m.availability_status} />
                                </div>
                                {match && (
                                    <div className="mt-3 flex items-center gap-1.5 text-[13px] text-foreground">
                                        {match.skill.name}: <Badge variant="info">{getDropdownOptionLabel(SkillProficiencyFormOptions, match.proficiency)}</Badge>
                                        {match.verified_at && <BadgeCheck className="size-4 text-success" aria-label="Verified" />}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            {q.data && q.data.pagination.total_pages > 1 && <div className="flex justify-end"><Button variant="outline" size="sm" disabled={!q.data.pagination.has_next} onClick={() => setPage(q.data!.pagination.page + 1)}>Next page</Button></div>}
        </div>
    );
}

function CreateSkillDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const create = useCreateSkill();
    const [name, setName] = useState("");
    const [category, setCategory] = useState<SkillCategory>("TECHNICAL");
    return (
        <Dialog open={open} onOpenChange={(o) => { if (!create.isPending) { onOpenChange(o); setName(""); } }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>New skill</DialogTitle><DialogDescription>Added to the organization's skill catalogue.</DialogDescription></DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1.5"><Label htmlFor="skill-name">Name</Label><Input id="skill-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="React" autoFocus /></div>
                    <div className="space-y-1.5">
                        <Label>Category</Label>
                        <Select value={category} onValueChange={(v) => setCategory(v as SkillCategory)}>
                            <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
                            <SelectContent>{SkillCategoryFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button disabled={!name.trim()} loading={create.isPending} onClick={() => create.mutate({ name: name.trim(), category }, { onSuccess: () => { onOpenChange(false); setName(""); } })}>Create</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AddSkillDialog({ skill, employeeId, onClose }: { skill: Skill | null; employeeId?: string; onClose: () => void }) {
    const assign = useAssignSkill();
    const [level, setLevel] = useState<SkillProficiency>("INTERMEDIATE");
    return (
        <Dialog open={!!skill} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader><DialogTitle>Add {skill?.name}</DialogTitle><DialogDescription>Self-declared skills show as unverified until HR verifies them.</DialogDescription></DialogHeader>
                <div className="space-y-1.5">
                    <Label>Level</Label>
                    <Select value={level} onValueChange={(v) => setLevel(v as SkillProficiency)}>
                        <SelectTrigger aria-label="Level"><SelectValue /></SelectTrigger>
                        <SelectContent>{SkillProficiencyFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button loading={assign.isPending} disabled={!employeeId || !skill} onClick={() => skill && employeeId && assign.mutate({ employeeId, skill_id: skill.id, proficiency: level }, { onSuccess: () => onClose() })}>Add</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
