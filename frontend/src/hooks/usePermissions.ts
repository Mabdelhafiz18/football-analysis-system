import { useAuth } from "@/contexts/AuthContext";
import { Permission, hasPermission, canAccessRoute } from "@/utils/permissions";

export const usePermissions = () => {
  const { user } = useAuth();

  return {
    hasPermission: (permission: Permission) => hasPermission(user?.role, permission),
    canAccessRoute: (path: string) => canAccessRoute(user?.role, path),
    role: user?.role,
    isAdmin: user?.role === "manager" || user?.role === "academy_admin",
  };
};

