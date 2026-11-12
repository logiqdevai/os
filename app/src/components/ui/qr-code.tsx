import { useMemo } from "react";
import qrcode from "qrcode-generator";
import { cn } from "@/lib/utils";

/**
 * QR code as an inline SVG (no image, no network). Scanners need dark modules on a light background, so in dark mode
 * the colors swap tokens (foreground ↔ background) instead of inverting the code.
 */
export function QrCode({ value, size = 184, label, className }: { value: string; size?: number; label: string; className?: string }) {
    const { count, path } = useMemo(() => {
        const qr = qrcode(0, "M");
        qr.addData(value);
        qr.make();
        const n = qr.getModuleCount();
        let d = "";
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
        return { count: n, path: d };
    }, [value]);
    const quiet = 4;
    return (
        <svg
            role="img"
            aria-label={label}
            width={size}
            height={size}
            viewBox={`${-quiet} ${-quiet} ${count + quiet * 2} ${count + quiet * 2}`}
            shapeRendering="crispEdges"
            className={cn("rounded-md bg-background dark:bg-foreground", className)}
        >
            <path d={path} className="fill-foreground dark:fill-background" />
        </svg>
    );
}
