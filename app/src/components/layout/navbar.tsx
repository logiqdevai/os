import { Menu } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from "@/components/ui/navigation-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuthStore } from "@/stores/auth";
import Logo from "@/assets/favicon.ico";
import { Suspense } from "react";
import { ThemeSwitch } from "../ui/theme-switch";
import { environments } from "@/config/environments";

interface MenuItem {
  title: string;
  url: string;
  description?: string;
  icon?: React.ReactNode;
  items?: MenuItem[];
}

interface Navbar1Props {
  logo?: {
    url: string;
    src: any;
    alt: string;
    title: string;
  };
  menu?: MenuItem[];
  auth?: {
    login: {
      title: string;
      url: string;
    };
    signup: {
      title: string;
      url: string;
    };
    dashboard?: {
      title: string;
      url: string;
    };
  };
}

export const Navbar = () => {
  return (
    <Suspense fallback={null}>
      <NavbarContent />
    </Suspense>
  );
};

const NavbarContent = ({
  logo = {
    url: "/",
    src: Logo,
    alt: "logo",
    title: environments.APP_NAME,
  },
  menu = [
    { title: "Home", url: "#hero" },
    {
      title: "Templates",
      url: `${environments.LANDING_URL}/#templates`,
    },
    {
      title: "Pricing",
      url: `${environments.LANDING_URL}/#pricing`,
    },
    {
      title: "Roadmap",
      url: `${environments.LANDING_URL}/#roadmap`,
    },
    {
      title: "Contact",
      url: `${environments.LANDING_URL}/#contact`,
    },
  ],
  auth = {
    login: { title: "Login", url: "/auth/sign-in" },
    signup: { title: "Sign up", url: "/auth/sign-up" },
    dashboard: { title: "Dashboard", url: "/console/dashboard" },
  },
}: Navbar1Props) => {
  const { isLoggedIn } = useAuthStore();

  return (
    <section className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto">
        <nav className="hidden justify-between items-center h-16 lg:flex">
          <div className="flex items-center">
            <a href={logo.url} className="flex items-center gap-2">
              <img src={logo.src} className="size-7" alt="logo" />

              <span className="text-lg font-semibold tracking-tighter">{logo.title}</span>
            </a>
          </div>

          <div className="flex items-center justify-center flex-1">
            <NavigationMenu>
              <NavigationMenuList>{menu.map((item) => renderMenuItem(item))}</NavigationMenuList>
            </NavigationMenu>
          </div>

          <div className="flex items-center gap-2">
            <ThemeSwitch />
            {isLoggedIn ? (
              <Button asChild size="sm">
                <a href={auth.dashboard?.url}>{auth.dashboard?.title}</a>
              </Button>
            ) : (
              <>
                <Button asChild variant="outline" size="sm">
                  <a href={auth.login.url}>{auth.login.title}</a>
                </Button>
                <Button asChild size="sm">
                  <a href={auth.signup.url}>{auth.signup.title}</a>
                </Button>
              </>
            )}
          </div>
        </nav>

        {/* Mobile Menu */}
        <div className="block lg:hidden">
          <div className="flex items-center justify-between h-16">
            <a href={logo.url} className="flex items-center gap-2">
              <img src={logo.src} width={32} height={32} className="max-h-8" alt={logo.alt} />
            </a>
            <div className="flex items-center gap-2">
              <ThemeSwitch />
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Menu className="size-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent className="overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>
                      <a href={logo.url} className="flex items-center gap-2">
                        <img src={logo.src} width={32} height={32} className="max-h-8" alt={logo.alt} />
                      </a>
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-6 p-4">
                    <Accordion type="single" collapsible className="flex w-full flex-col gap-4">
                      {menu.map((item) => renderMobileMenuItem(item))}
                    </Accordion>

                    <div className="flex flex-col gap-3">
                      {isLoggedIn ? (
                        <Button asChild>
                          <a href={auth.dashboard?.url}>{auth.dashboard?.title}</a>
                        </Button>
                      ) : (
                        <>
                          <Button asChild variant="outline">
                            <a href={auth.login.url}>{auth.login.title}</a>
                          </Button>
                          <Button asChild>
                            <a href={auth.signup.url}>{auth.signup.title}</a>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const renderMenuItem = (item: MenuItem) => {
  if (item.items) {
    return (
      <NavigationMenuItem key={item.title}>
        <NavigationMenuTrigger>{item.title}</NavigationMenuTrigger>
        <NavigationMenuContent className="bg-popover text-popover-foreground">
          {item.items.map((subItem) => (
            <NavigationMenuLink asChild key={subItem.title} className="w-80">
              <SubMenuLink item={subItem} />
            </NavigationMenuLink>
          ))}
        </NavigationMenuContent>
      </NavigationMenuItem>
    );
  }

  return (
    <NavigationMenuItem key={item.title}>
      <NavigationMenuLink href={item.url} className="group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-accent-foreground">
        {item.title}
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
};

const renderMobileMenuItem = (item: MenuItem) => {
  if (item.items) {
    return (
      <AccordionItem key={item.title} value={item.title} className="border-b-0">
        <AccordionTrigger className="text-md py-0 font-semibold hover:no-underline">{item.title}</AccordionTrigger>
        <AccordionContent className="mt-2">
          {item.items.map((subItem) => (
            <SubMenuLink key={subItem.title} item={subItem} />
          ))}
        </AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <a key={item.title} href={item.url} className="text-md font-semibold">
      {item.title}
    </a>
  );
};

const SubMenuLink = ({ item }: { item: MenuItem }) => {
  return (
    <a className="flex flex-row gap-4 rounded-md p-3 leading-none no-underline transition-colors outline-none select-none hover:bg-muted hover:text-accent-foreground" href={item.url}>
      <div className="text-foreground">{item.icon}</div>
      <div>
        <div className="text-sm font-semibold">{item.title}</div>
        {item.description && <p className="text-sm leading-snug text-muted-foreground">{item.description}</p>}
      </div>
    </a>
  );
};

export default Navbar;
