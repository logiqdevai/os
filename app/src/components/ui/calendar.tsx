import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { cn } from "@/lib/utils";

export type CalendarProps = DayPickerProps;

/** react-day-picker v9 styled with the app tokens: pill day cells, soft rounded container, light/dark via theme variables. */
function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      weekStartsOn={1}
      className={cn("p-1", className)}
      classNames={{
        root: "w-fit",
        months: "relative flex flex-col gap-4",
        month: "space-y-3",
        month_caption: "flex h-9 items-center justify-center px-9",
        caption_label: "text-sm font-semibold text-foreground",
        dropdowns: "flex items-center gap-1.5 text-sm font-semibold",
        nav: "absolute inset-x-0 top-0 flex h-9 items-center justify-between",
        button_previous: "grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40",
        button_next: "grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40",
        month_grid: "border-collapse",
        weekdays: "flex",
        weekday: "w-9 pb-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
        week: "mt-1 flex",
        day: "relative size-9 p-0 text-center text-[13px]",
        day_button: "size-9 rounded-full font-normal text-foreground tabular transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        selected: "[&>button]:bg-primary [&>button]:font-semibold [&>button]:text-primary-foreground [&>button:hover]:bg-primary",
        today: "[&>button]:bg-primary/10 [&>button]:font-semibold [&>button]:text-primary",
        outside: "[&>button]:text-muted-foreground/60",
        disabled: "[&>button]:pointer-events-none [&>button]:opacity-30",
        hidden: "invisible",
        range_start: "rounded-l-full bg-primary/10",
        range_end: "rounded-r-full bg-primary/10",
        range_middle: "bg-primary/10 [&>button]:bg-transparent [&>button]:text-foreground",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: c }) =>
          orientation === "left" ? <ChevronLeft className={cn("size-4", c)} /> : orientation === "right" ? <ChevronRight className={cn("size-4", c)} /> : <ChevronRight className={cn("size-4 rotate-90", c)} />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
