import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermission } from "@/hooks/use-permission";
import { TaskCreateForm, type TaskCreateDefaults } from "./task-create-form";

interface QuickCreateContextValue {
    open: (defaults?: TaskCreateDefaults) => void;
}

const QuickCreateContext = createContext<QuickCreateContextValue>({ open: () => undefined });

export const useQuickCreate = () => useContext(QuickCreateContext);

/** Quick-create dialog for the Tasks area; press "c" anywhere outside a text field to open it (06 mockup). */
export function QuickCreateProvider({ children }: { children: ReactNode }) {
    const canCreate = usePermission("tasks.tasks.create");
    const navigate = useNavigate();
    const [defaults, setDefaults] = useState<TaskCreateDefaults | null>(null);
    const open = useCallback((d?: TaskCreateDefaults) => canCreate && setDefaults(d ?? {}), [canCreate]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "c" || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
            const el = e.target as HTMLElement | null;
            if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.closest("[role=dialog],[role=menu],[role=listbox]"))) return;
            e.preventDefault();
            open();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    const value = useMemo(() => ({ open }), [open]);
    return (
        <QuickCreateContext.Provider value={value}>
            {children}
            <Dialog open={!!defaults} onOpenChange={(o) => !o && setDefaults(null)}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>New task</DialogTitle>
                        <DialogDescription className="sr-only">Create a task. Press Ctrl+Enter to save.</DialogDescription>
                    </DialogHeader>
                    {defaults && (
                        <TaskCreateForm
                            defaults={defaults}
                            allowCreateMore
                            onCancel={() => setDefaults(null)}
                            onCreated={(task) => { setDefaults(null); navigate(`/tasks/${task.identifier}`); }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </QuickCreateContext.Provider>
    );
}
