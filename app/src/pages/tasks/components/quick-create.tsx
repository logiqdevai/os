import { createContext, useCallback, useRef, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { usePermission } from "@/hooks/use-permission";
import { TaskCreateForm, type TaskCreateDefaults } from "./task-create-form";

interface QuickCreateContextValue {
    open: (defaults?: TaskCreateDefaults, onClose?: () => void) => void;
}

const QuickCreateContext = createContext<QuickCreateContextValue>({ open: () => undefined });

export const useQuickCreate = () => useContext(QuickCreateContext);

/** Quick-create dialog for the Tasks area; press "c" anywhere outside a text field to open it (06 mockup). */
export function QuickCreateProvider({ children }: { children: ReactNode }) {
    const canCreate = usePermission("tasks.tasks.create");
    const navigate = useNavigate();
    const [defaults, setDefaults] = useState<TaskCreateDefaults | null>(null);
    const onCloseRef = useRef<(() => void) | undefined>(undefined);
    const open = useCallback((d?: TaskCreateDefaults, onClose?: () => void) => {
        if (!canCreate) return;
        onCloseRef.current = onClose;
        setDefaults(d ?? {});
    }, [canCreate]);
    const close = useCallback(() => {
        setDefaults(null);
        const cb = onCloseRef.current;
        onCloseRef.current = undefined;
        cb?.();
    }, []);

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
            <Dialog open={!!defaults} onOpenChange={(o) => !o && close()}>
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[680px] sm:rounded-2xl">
                    <DialogHeader className="sr-only">
                        <DialogTitle>New task</DialogTitle>
                        <DialogDescription>Create a task. Press Ctrl+Enter to save.</DialogDescription>
                    </DialogHeader>
                    {defaults && (
                        <TaskCreateForm
                            variant="modal"
                            defaults={defaults}
                            allowCreateMore
                            onCancel={close}
                            onCreated={(task) => toast({ title: "Task created", description: `${task.identifier} · ${task.title}`, action: <ToastAction altText="Open task" onClick={() => navigate(`/tasks/${task.identifier}`)}>Open</ToastAction> })}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </QuickCreateContext.Provider>
    );
}
