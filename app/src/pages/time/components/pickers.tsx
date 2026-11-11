import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActivityTypes, useTimeProjects, useTimeTasks } from "@/features/time/settings/hooks/use-time-settings";
import { cn } from "@/lib/utils";

export const NONE = "__none";

/** "1:30", "1.5", "90m" → minutes (null when invalid). */
export function parseDuration(input: string): number | null {
    const v = input.trim().toLowerCase();
    if (!v) return 0;
    const colon = /^(\d{1,2}):(\d{1,2})$/.exec(v);
    if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
    const mins = /^(\d+)\s*m$/.exec(v);
    if (mins) return Number(mins[1]);
    const n = Number(v.replace(",", ".").replace(/h$/, ""));
    return Number.isFinite(n) && n >= 0 && n <= 24 ? Math.round(n * 60) : null;
}

/** Minutes → "1:30" for grid cells ("" for 0). */
export const toClock = (m: number) => (m ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}` : "");

export function ProjectSelect({ value, onChange, className, allowNone = true }: { value: string | null; onChange: (v: string | null) => void; className?: string; allowNone?: boolean }) {
    const projects = useTimeProjects();
    return (
        <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
            <SelectTrigger className={cn("min-w-0", className)} aria-label="Project"><SelectValue placeholder={projects.isLoading ? "Loading…" : "Project"} /></SelectTrigger>
            <SelectContent>
                {allowNone && <SelectItem value={NONE}>No project (internal)</SelectItem>}
                {projects.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ""}{p.name}{p.company ? ` — ${p.company.name}` : ""}</SelectItem>)}
            </SelectContent>
        </Select>
    );
}

export function TaskSelect({ projectId, value, onChange, className }: { projectId: string | null; value: string | null; onChange: (v: string | null) => void; className?: string }) {
    const tasks = useTimeTasks(projectId);
    return (
        <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)} disabled={!projectId}>
            <SelectTrigger className={cn("min-w-0", className)} aria-label="Task"><SelectValue placeholder="Task" /></SelectTrigger>
            <SelectContent>
                <SelectItem value={NONE}>No task</SelectItem>
                {tasks.data?.map((t) => <SelectItem key={t.id} value={t.id}>{t.team?.task_key ? `${t.team.task_key}-${t.number} ` : `#${t.number} `}{t.title}</SelectItem>)}
            </SelectContent>
        </Select>
    );
}

export function ActivitySelect({ value, onChange, className }: { value: string | null; onChange: (v: string | null) => void; className?: string }) {
    const types = useActivityTypes();
    return (
        <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
            <SelectTrigger className={cn("min-w-0", className)} aria-label="Activity"><SelectValue placeholder="Activity" /></SelectTrigger>
            <SelectContent>
                <SelectItem value={NONE}>No activity</SelectItem>
                {types.data?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
        </Select>
    );
}
