import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Copy `text` to the clipboard; the button itself shows "Copied" for a moment (no toast). */
export function CopyButton({ text, label = "Copy", iconOnly, onCopied, ...props }: { text: string; label?: string; iconOnly?: boolean; onCopied?: () => void } & Omit<ButtonProps, "onClick" | "children">) {
    const [copied, setCopied] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
    const copy = () => {
        void navigator.clipboard?.writeText(text).then(() => {
            setCopied(true);
            onCopied?.();
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 1600);
        });
    };
    return (
        <Button type="button" {...props} aria-label={copied ? "Copied" : (props["aria-label"] ?? label)} onClick={copy}>
            {copied ? <Check /> : <Copy />}
            {!iconOnly && (copied ? "Copied" : label)}
        </Button>
    );
}
