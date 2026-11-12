import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

/**
 * Clipboard copy with in-place feedback (no success toast): `copied` is true for a moment after a successful copy.
 * A refused copy (no permission / insecure context) shows one error toast.
 */
export function useCopyFeedback(ms = 1600) {
    const [copied, setCopied] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
    const copy = useCallback(
        (text: string) =>
            (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject(new Error("Clipboard unavailable"))).then(
                () => {
                    setCopied(true);
                    if (timer.current) clearTimeout(timer.current);
                    timer.current = setTimeout(() => setCopied(false), ms);
                    return true;
                },
                () => {
                    toast({ variant: "destructive", title: "Could not copy", description: "Select the text and copy it manually." });
                    return false;
                },
            ),
        [ms],
    );
    return { copied, copy };
}

/** Copy `text`; the button itself shows "Copied" for a moment. */
export function CopyButton({
    text, label = "Copy", iconOnly, onCopied, ...props
}: { text: string; label?: string; iconOnly?: boolean; onCopied?: () => void } & Omit<ButtonProps, "onClick" | "children">) {
    const { copied, copy } = useCopyFeedback();
    return (
        <Button
            type="button"
            {...props}
            aria-label={copied ? "Copied" : (props["aria-label"] ?? label)}
            onClick={() => void copy(text).then((ok) => ok && onCopied?.())}
        >
            {copied ? <Check className="text-success" /> : <Copy />}
            {!iconOnly && (copied ? "Copied" : label)}
        </Button>
    );
}
