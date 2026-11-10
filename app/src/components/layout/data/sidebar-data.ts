import {
  IconCalendarDue,
  IconHelp,
  IconLayoutDashboard,
  IconLockPassword,
  IconUserCircle,
  IconUserCog,
  IconAlertTriangle,
  IconUser,
  IconHeartbeat,
} from "@tabler/icons-react";
import { Command, CreditCard } from "lucide-react";
import { type SidebarData } from "../types";
import { Routes } from "@/routes/routes";
import { RoleTypes } from "@/features/user/interfaces/user.interface";
import { environments } from "@/config/environments";

export const sidebarData: SidebarData = {
  teams: [
    {
      name: environments.APP_NAME,
      logo: Command,
      plan: "Vite + ShadcnUI",
    },
  ],
  navGroups: [
    {
      access: [RoleTypes.ADMIN],
      title: "Admin",
      items: [
        {
          title: "Health",
          url: Routes.admin.health,
          icon: IconHeartbeat,
        },
        {
          title: "Users",
          url: Routes.admin.users,
          icon: IconUser,
        },
        {
          title: "Alerts",
          url: Routes.admin.alerts,
          icon: IconAlertTriangle,
        },
      ],
    },
    {
      title: "Console",
      items: [
        {
          title: "Dashboard",
          url: Routes.dashboard,
          icon: IconLayoutDashboard,
        },
      ],
    },
    {
      title: "Settings",
      items: [
        {
          title: "Account",
          icon: IconUserCircle,
          items: [
            {
              title: "Profile",
              url: "#",
              icon: IconUserCog,
            },

            {
              title: "Password",
              url: "#",
              icon: IconLockPassword,
            },
          ],
        },
        {
          title: "Billing",
          icon: CreditCard,
          items: [
            {
              title: "Subscription",
              url: "#",
              icon: IconCalendarDue,
            },
          ],
        },

      ],
    },
    {
      title: "Other",
      items: [
        {
          title: "Help Center",
          url: "#",
          icon: IconHelp,
        },
      ],
    },
  ],
};
