import { useEffect } from "react";

// Radix UI's modal overlays (Dialog, AlertDialog, DropdownMenu, Select, ...)
// lock the page by setting document.body.style.pointerEvents = "none" while
// open, then restore it once closed. When two overlays close in the same
// render (e.g. a confirmation dialog nested inside another dialog closing
// together, or a parent unmounting a menu mid-close), Radix can skip that
// restore step, leaving the whole page permanently unclickable. This watches
// for that stuck state and clears it whenever no overlay is actually open.
const OPEN_OVERLAY_SELECTOR = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"], [role="listbox"][data-state="open"]';

export function RadixPointerEventsGuard() {
  useEffect(() => {
    const clearIfStuck = () => {
      if (document.body.style.pointerEvents !== "none") return;
      if (!document.querySelector(OPEN_OVERLAY_SELECTOR)) {
        document.body.style.pointerEvents = "";
      }
    };

    const observer = new MutationObserver(clearIfStuck);
    observer.observe(document.body, { attributes: true, attributeFilter: ["style"], childList: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
