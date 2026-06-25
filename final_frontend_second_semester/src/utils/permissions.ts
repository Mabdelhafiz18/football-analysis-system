import { UserRole } from "@/contexts/AuthContext";

export type Permission = 
  | "upload_video"
  | "view_matches"
  | "view_decisions"
  | "view_tactical"
  | "view_analytics"
  | "generate_reports"
  | "view_dashboard"
  | "manage_players";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  coach: [
    "upload_video",
    "view_matches",
    "view_decisions",
    "view_tactical",
    "view_analytics",
    "generate_reports",
    "view_dashboard",
  ],
  referee: [
    "view_matches",
    "view_decisions",
    "generate_reports",
    "view_dashboard",
  ],
  manager: [
    "upload_video",
    "view_matches",
    "view_decisions",
    "view_tactical",
    "view_analytics",
    "generate_reports",
    "view_dashboard",
    "manage_players",
  ],
  academy_admin: [
    "upload_video",
    "view_matches",
    "view_decisions",
    "view_tactical",
    "view_analytics",
    "generate_reports",
    "view_dashboard",
    "manage_players",
  ],
};

export const hasPermission = (role: UserRole | undefined, permission: Permission): boolean => {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
};

export const canAccessRoute = (role: UserRole | undefined, path: string): boolean => {
  if (!role) return false;
  
  if (path.startsWith("/upload")) return hasPermission(role, "upload_video");
  if (path.startsWith("/match") && path.includes("/tactical")) return hasPermission(role, "view_tactical");
  if (path.startsWith("/analytics")) return hasPermission(role, "view_analytics");
  
  return true; // Default to allow if not explicitly restricted
};

