import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

/**
 * "Want to leave?" guard shared by Dialog and Sheet.
 *
 * A modal that contains a form (a modal that writes data) closes immediately on an outside click, Escape or the X button
 * as long as nothing was changed. Once the user edits a field it asks "Discard changes?" first;
 * "Leave" closes the modal, "Keep editing" returns to the form.
 * Modals without a <form> (confirmations, pickers, read-only views, search) close immediately.
 * Pass `confirmClose={false}` on the content to opt out. Tag a form-less modal that writes data with `data-leave-guard`.
 */
type Dismiss = { defaultPrevented: boolean; preventDefault: () => void };

export function useLeaveGuard(enabled = true) {
    const bypass = useRef(false);
    const closeRef = useRef<HTMLButtonElement>(null);
    const [asking, setAsking] = useState(false);

    // The X button lives inside the modal content, so its parent is the content element.
    const writesData = () => !!closeRef.current?.parentElement?.querySelector("form, [data-leave-guard]");
    // Set once the user edits any field inside the modal; an untouched modal closes without asking.
    const dirty = useRef(false);
    const markDirty = () => {
        dirty.current = true;
    };
    const blocked = () => enabled && !bypass.current && dirty.current && writesData();

    return {
        closeRef,
        /** Spread on the modal content: marks the modal as changed when any field inside it is edited. */
        track: { onInputCapture: markDirty, onChangeCapture: markDirty },
        /** Wrap Radix `onPointerDownOutside` / `onEscapeKeyDown`: keeps the caller's handler, then asks before closing. */
        dismiss: <E extends Dismiss>(userHandler?: (e: E) => void) => (e: E) => {
            userHandler?.(e);
            if (e.defaultPrevented) return;
            // A click inside a dropdown, select, combobox or menu that is portaled out of the modal is not an outside click.
            const target = (e as unknown as { detail?: { originalEvent?: Event } }).detail?.originalEvent?.target;
            if (target instanceof Element && target.closest("[data-radix-popper-content-wrapper], [data-radix-select-content], [role=listbox], [role=menu], [cmdk-root]")) {
                e.preventDefault();
                return;
            }
            if (blocked()) {
                e.preventDefault();
                setAsking(true);
            }
        },
        /** `onClick` of the X button. */
        closeClick: (e: MouseEvent) => {
            if (blocked()) {
                e.preventDefault();
                setAsking(true);
            }
        },
        confirm: (
            <AlertDialog open={asking} onOpenChange={setAsking}>
                <AlertDialogContent className="sm:max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Discard changes?</AlertDialogTitle>
                        <AlertDialogDescription>Anything you entered will be lost. Want to leave?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep editing</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                // The click is synchronous; reset afterwards because this component outlives the open/close cycle.
                                bypass.current = true;
                                closeRef.current?.click();
                                bypass.current = false;
                            }}
                        >
                            Leave
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        ) as ReactNode,
    };
}
