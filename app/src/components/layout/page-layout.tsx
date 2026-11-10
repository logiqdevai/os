import { Separator } from "@/components/ui/separator";
import { Main } from "@/components/layout/main";
import SidebarNav from "@/components/layout/sidebar-nav";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type JSX } from "react";

interface PageLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
  sidebarNavItems: {
    title: string;
    icon: JSX.Element;
    href: string;
    disabled?: boolean;
  }[];
}

export default function PageLayout({ title, description, children, className, sidebarNavItems }: PageLayoutProps) {
  return (
    <>
      <Main fixed>
        <div className="space-y-0.5 mb-2">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">{description}</p>
        </div>
        <Separator className="my-1 lg:my-1" />
        <div className="flex flex-1 flex-col space-y-2 overflow-hidden md:space-y-2 lg:flex-row lg:space-x-12 lg:space-y-0">
          <aside className="top-0 lg:sticky lg:w-1/5">
            <SidebarNav items={sidebarNavItems} />
          </aside>
          <div className={cn("flex w-full overflow-y-hidden p-1 pr-1 sm:pr-2", className)}>
            <ScrollArea className={cn("w-full max-w-none lg:max-w-[700px]", className)}>{children}</ScrollArea>
          </div>
        </div>
      </Main>
    </>
  );
}
