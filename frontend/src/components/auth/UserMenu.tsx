import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User, Settings, ShieldCheck, ChevronRight } from "lucide-react";
import { RoleBadge } from "./RoleBadge";

export const UserMenu: React.FC<{ collapsed?: boolean }> = ({ collapsed }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className={collapsed ? "flex justify-center" : "px-3 py-2 cursor-pointer rounded-xl hover:bg-muted/50 transition-colors group"}>
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-primary/20 ring-2 ring-primary/5 group-hover:ring-primary/20 transition-all">
              <AvatarImage src={user.avatar} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                {user.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{user.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <RoleBadge role={user.role} />
                </div>
              </div>
            )}
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={collapsed ? "center" : "end"} className="w-64 glass-card p-2" side={collapsed ? "right" : "bottom"}>
        <DropdownMenuLabel className="font-normal px-2 py-3">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-bold text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            {user.clubName && (
              <div className="flex items-center gap-1.5 mt-2 text-[10px] text-primary font-bold uppercase tracking-tighter">
                <ShieldCheck className="h-3 w-3" />
                {user.clubName}
              </div>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/50" />
        <Link to="/settings">
          <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer py-2.5">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>Profile</span>
          </DropdownMenuItem>
        </Link>
        <Link to="/settings">
          <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer py-2.5">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span>Account Settings</span>
          </DropdownMenuItem>
        </Link>
        <DropdownMenuSeparator className="bg-border/50" />
        <DropdownMenuItem 
          onClick={handleLogout} 
          className="gap-2 rounded-lg cursor-pointer py-2.5 text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          <span>Log Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

