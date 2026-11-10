import { useState, type JSX } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useLocation, useNavigate } from "react-router-dom";

interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  items: {
    href: string;
    title: string;
    icon: JSX.Element;
    disabled?: boolean;
  }[];
}

export default function SidebarNav({ className, items, ...props }: SidebarNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [val, setVal] = useState(location.pathname ?? "/settings");

  const handleSelect = (e: string) => {
    setVal(e);
    navigate(e);
  };

  return (
    <>
      <div className="p-1 md:hidden">
        <Select value={val} onValueChange={handleSelect}>
          <SelectTrigger className="h-12 sm:w-48">
            <SelectValue placeholder="Theme" />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.href} value={item.href} disabled={item.disabled}>
                <div className={cn("flex gap-x-4 px-2 py-1", item.disabled && "opacity-50 blur-[0.5px]")}>
                  <span className="scale-125">{item.icon}</span>
                  <span className="text-md">{item.title}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea orientation="horizontal" type="always" className="hidden w-full min-w-40 bg-background px-1 py-2 md:block">
        <nav className={cn("flex space-x-2 py-1 lg:flex-col lg:space-x-0 lg:space-y-1", className)} {...props}>
          {items.map((item) => {
            if (item.disabled) {
              return (
                <div key={item.href} className={cn(buttonVariants({ variant: "ghost" }), "justify-start opacity-50 blur-[0.5px] cursor-not-allowed pointer-events-none")}>
                  <span className="mr-2">{item.icon}</span>
                  {item.title}
                </div>
              );
            }

            return (
              <Link key={item.href} to={item.href} className={cn(buttonVariants({ variant: "ghost" }), location.pathname === item.href ? "bg-muted hover:bg-muted" : "hover:bg-muted hover:text-foreground", "justify-start")}>
                <span className="mr-2">{item.icon}</span>
                {item.title}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
    </>
  );
}
