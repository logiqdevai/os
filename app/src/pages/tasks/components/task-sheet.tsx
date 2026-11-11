import { Link } from "react-router-dom";
import { Maximize2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { TaskDetailView } from "./task-detail-view";

/** Side peek of a task from any list or board. */
export function TaskSheet({ taskKey, onClose }: { taskKey: string | null; onClose: () => void }) {
    return (
        <Sheet open={!!taskKey} onOpenChange={(o) => !o && onClose()}>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
                <SheetHeader className="flex-row items-center justify-between space-y-0 pr-8">
                    <SheetTitle className="font-mono text-sm text-muted-foreground">{taskKey}</SheetTitle>
                    <SheetDescription className="sr-only">Task details</SheetDescription>
                    {taskKey && (
                        <Button variant="ghost" size="sm" asChild>
                            <Link to={`/tasks/${taskKey}`}><Maximize2 /> Open</Link>
                        </Button>
                    )}
                </SheetHeader>
                <div className="mt-4">{taskKey && <TaskDetailView taskKey={taskKey} compact onDeleted={onClose} />}</div>
            </SheetContent>
        </Sheet>
    );
}
