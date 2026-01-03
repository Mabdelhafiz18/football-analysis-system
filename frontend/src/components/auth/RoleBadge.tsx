import React from "react";
import { UserRole } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface RoleBadgeProps {
  role: UserRole;
  className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, className }) => {
  const configs: Record<UserRole, { label: string; color: string; bgColor: string }> = {
    coach: {
      label: "Coach",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    referee: {
      label: "Referee",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    manager: {
      label: "Manager",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    academy_admin: {
      label: "Academy",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
  };

  const config = configs[role];

  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
        config.color,
        config.bgColor,
        className
      )}
    >
      {config.label}
    </span>
  );
};

