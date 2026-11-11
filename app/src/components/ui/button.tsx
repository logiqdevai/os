import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium tracking-[0.2px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", {
  variants: {
    variant: {
      default: "border border-primary bg-primary text-primary-foreground hover:bg-primary-hover",
      destructive: "border border-transparent bg-danger-soft text-danger hover:bg-danger hover:text-destructive-foreground",
      outline: "border border-border bg-secondary text-foreground hover:border-border-strong hover:bg-accent",
      secondary: "border border-border bg-secondary text-foreground hover:bg-accent",
      ghost: "text-muted-foreground hover:bg-border-soft hover:text-foreground",
      link: "text-primary underline-offset-4 hover:underline",
    },
    size: {
      default: "h-8 px-3",
      sm: "h-7 rounded-md px-2.5 text-[12.5px]",
      lg: "h-9 rounded-md px-4 text-sm",
      icon: "size-8",
      "icon-sm": "size-7",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, loading = false, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";

  if (asChild) {
    return <Slot className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }

  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} disabled={loading || props.disabled}>
      {loading && <Loader className="animate-spin" />}
      {props.children}
    </Comp>
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
