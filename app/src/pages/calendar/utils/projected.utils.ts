import { addDays, parseISO } from "date-fns";
import type { CalendarEventItem, ProjectedItem } from "@/features/calendar/interfaces/calendar.interfaces";

const SOURCE: Record<ProjectedItem["module"], string> = { projects: "Milestone", tasks: "Task due", leave: "Leave" };

/**
 * Projected dates (milestones, task due dates, approved leave) are read-only all-day chips on the grid. They are mapped to the
 * event-item shape so every view renders them; `projected` marks them and carries the link into the owning module.
 */
export function projectedToEvents(items: ProjectedItem[]): CalendarEventItem[] {
    return items.map((p) => ({
        id: p.key,
        key: `projected:${p.key}`,
        occurrence_start: null,
        starts_at: parseISO(p.start_date).toISOString(),
        ends_at: addDays(parseISO(p.end_date), 1).toISOString(),
        all_day: true,
        status: "CONFIRMED",
        masked: false,
        title: p.done ? `✓ ${p.title}` : p.title,
        location: null,
        meeting_url: null,
        visibility: "TEAM",
        shows_as_busy: false,
        color: p.color,
        recurring: false,
        calendar: { id: `projected:${p.module}`, name: `${SOURCE[p.module]}${p.detail ? ` · ${p.detail}` : ""}`, color: p.color, kind: "PROJECT" },
        event_type: null,
        organizer: null,
        my_response: null,
        is_organizer: false,
        attendee_count: 0,
        project_id: null,
        can_edit: false,
        projected: { module: p.module, link: p.link },
    }));
}
