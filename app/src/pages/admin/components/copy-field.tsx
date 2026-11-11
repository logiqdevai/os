import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/** Read-only value with a copy button (secrets shown once, invite links, webhook URLs). */
export function CopyField({ value, label, className, mono = true }: { value: string; label?: string; className?: string; mono?: boolean }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            toast({ variant: "destructive", title: "Could not copy", description: "Select the text and copy it manually." });
        }
    };
    return (
        <div className={cn("flex min-w-0 items-center gap-2 rounded-md border border-border bg-secondary px-2.5 py-1.5", className)}>
            <span className={cn("min-w-0 flex-1 select-all break-all text-[12.5px] text-foreground", mono && "font-mono")}>{value}</span>
            <Button type="button" variant="ghost" size="icon-sm" onClick={copy} aria-label={label ? `Copy ${label}` : "Copy"}>
                {copied ? <Check className="text-success" /> : <Copy />}
            </Button>
        </div>
    );
}
