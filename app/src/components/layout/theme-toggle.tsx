import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ variant = "button" }: { variant?: "button" | "rail" }) {
    const { resolved, toggleTheme } = useTheme();
    const label = resolved === "dark" ? "Switch to light theme" : "Switch to dark theme";
    const Icon = resolved === "dark" ? Sun : Moon;
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={label}
                    onClick={toggleTheme}
                    className={cn(variant === "rail" && "h-[38px] w-10 rounded-[10px] [&_svg]:size-[18px]")}
                >
                    <Icon />
                </Button>
            </TooltipTrigger>
            <TooltipContent side={variant === "rail" ? "right" : "bottom"}>{label}</TooltipContent>
        </Tooltip>
    );
}
