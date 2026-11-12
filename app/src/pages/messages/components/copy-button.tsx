import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

/** Copy `text` to the clipboard; the button itself shows "Copied" for a moment (no success toast). */
export function CopyButton({ text, label = "Copy", iconOnly = true, ...props }: { text: string; label?: string; iconOnly?: boolean } & Omit<ButtonProps, "onClick" | "children">) {
    const [copied, setCopied] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
    const copy = () =>
        navigator.clipboard.writeText(text).then(
            () => {
                setCopied(true);
                if (timer.current) clearTimeout(timer.current);
                timer.current = setTimeout(() => setCopied(false), 1600);
            },
            () => toast({ variant: "destructive", title: "Could not copy", description: "Select the text and copy it manually." }),
        );
    return (
        <Button type="button" variant="outline" size="icon" {...props} aria-label={copied ? "Copied" : (props["aria-label"] ?? label)} onClick={() => void copy()}>
            {copied ? <Check className="text-success" /> : <Copy />}
            {!iconOnly && (copied ? "Copied" : label)}
        </Button>
    );
}
