import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface ProtectedRouteWithRoleProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export const ProtectedRouteWithRole: React.FC<ProtectedRouteWithRoleProps> = ({ 
  children, 
  allowedRoles 
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
        <div className="glass-card rounded-2xl p-12 max-w-md w-full border-destructive/20 shadow-2xl shadow-destructive/5">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-destructive/10 mb-6">
            <ShieldAlert className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Access Restricted</h1>
          <p className="text-muted-foreground mb-8">
            Your current role (<span className="text-primary font-bold uppercase">{user.role}</span>) does not have permission to access this section.
          </p>
          <div className="space-y-3">
            <Link to="/dashboard">
              <Button className="w-full h-12 lime-glow">
                Return to Dashboard
              </Button>
            </Link>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => window.history.back()}>
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

