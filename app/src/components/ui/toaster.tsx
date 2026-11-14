import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CopyButton } from "@/components/ui/copy-button";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

const VARIANT_ICONS: Record<string, LucideIcon> = {
  success: CheckCircle2,
  destructive: XCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

/** Plain text of a toast (title + body) for the copy button; React-node parts are skipped. */
const copyText = (...parts: ReactNode[]) => parts.filter((p): p is string => typeof p === "string" && p.length > 0).join("\n");

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const Icon = VARIANT_ICONS[variant ?? "success"];

        return (
          <Toast key={id} variant={variant} {...props}>
            {Icon && <Icon className="mt-0.5 h-5 w-5 flex-none" />}
            <div className="grid flex-1 select-text gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            {copyText(title, description) && (
              <CopyButton text={copyText(title, description)} iconOnly variant="ghost" size="icon-sm" label="Copy message" className="absolute right-8 top-1.5 size-6 text-current/60 opacity-0 hover:bg-current/10 hover:text-current focus:opacity-100 group-hover:opacity-100" />
            )}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
