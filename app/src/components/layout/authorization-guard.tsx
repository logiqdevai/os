import { useAuthStore } from "@/stores/auth";
import { RoleTypes, type RoleType } from "@/features/user/interfaces/user.interface";

interface AuthorizationGuardProps {
  roles?: RoleType[];
  children: React.ReactNode;
}

export const AuthorizationGuard = ({ roles, children }: AuthorizationGuardProps) => {
  const { role: userRole } = useAuthStore((state) => state);

  if (roles?.length && (!userRole || !roles.includes(userRole)) && userRole !== RoleTypes.SUPER_ADMIN) {
    return null;
  }


  return <>{children}</>;
};
